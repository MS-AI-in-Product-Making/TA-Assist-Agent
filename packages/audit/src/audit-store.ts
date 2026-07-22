import { randomUUID } from "node:crypto";
import { appendFile, mkdir, open, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { hashBytes, hashUtf8 } from "./hash.js";

const eventTypes = [
  "run_created",
  "policy_evaluated",
  "skill_started",
  "skill_completed",
  "skill_failed",
  "export_created",
  "purge_planned",
  "purge_completed",
] as const;

const classifications = ["public", "internal", "confidential", "secret"] as const;
const manifestSchema = "ai-assist.audit.manifest.v1";
const sha256Pattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AuditEventType = (typeof eventTypes)[number];
export type Classification = (typeof classifications)[number];

export interface AuditEventInput {
  type: AuditEventType;
  classification: Classification;
  payload: unknown;
}

export interface ManifestArtifactInput {
  path: string;
}

export interface ManifestInput {
  runId: string;
  artifacts: readonly ManifestArtifactInput[];
  skillHash?: string;
  configurationHash?: string;
  inputHash?: string;
  outputHash?: string;
}

export interface VerifyResult {
  valid: boolean;
  failures: string[];
}

interface AuditManifest {
  runId: string;
  schemaHash: string;
  skillHash: string;
  configurationHash: string;
  inputHash: string;
  outputHash: string;
  eventsHash: string;
  artifacts: Array<{ path: string; sha256: string }>;
}

export interface AuditStore {
  append(event: AuditEventInput): Promise<void>;
  writeManifest(manifest: ManifestInput): Promise<void>;
  verify(): Promise<VerifyResult>;
}

export async function createAuditStore(root: string): Promise<AuditStore> {
  const rootDirectory = resolve(root);
  await mkdir(rootDirectory, { recursive: true });
  const rootRealPath = await realpath(rootDirectory);
  const eventsPath = resolve(rootRealPath, "events.jsonl");
  const manifestPath = resolve(rootRealPath, "manifest.json");
  let pendingOperation = Promise.resolve();

  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = pendingOperation.then(operation, operation);
    pendingOperation = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return {
    async append(event) {
      validateEvent(event);
      await serialize(async () => {
        if (await manifestExists(manifestPath)) {
          throw new Error("validation_error: audit events are sealed by the manifest");
        }
        const eventRecord = {
          eventId: randomUUID(),
          timestamp: new Date().toISOString(),
          type: event.type,
          classification: event.classification,
          payloadHash: hashPayload(event.payload),
        };
        await appendFile(eventsPath, `${JSON.stringify(eventRecord)}\n`, "utf8");
      });
    },

    async writeManifest(input) {
      validateManifestInput(input);
      await serialize(async () => {
        const artifacts = await Promise.all(
          input.artifacts.map(async ({ path }) => ({
            path,
            sha256: await hashArtifact(rootRealPath, path),
          })),
        );
        const manifest: AuditManifest = {
          runId: input.runId,
          schemaHash: hashUtf8(manifestSchema),
          skillHash: input.skillHash ?? hashUtf8(""),
          configurationHash: input.configurationHash ?? hashUtf8(""),
          inputHash: input.inputHash ?? hashUtf8(""),
          outputHash: input.outputHash ?? hashUtf8(""),
          eventsHash: await hashEvents(eventsPath),
          artifacts,
        };
        const temporaryManifestPath = resolve(rootRealPath, `manifest.${randomUUID()}.tmp`);
        await writeFile(temporaryManifestPath, JSON.stringify(manifest, null, 2), "utf8");
        await rename(temporaryManifestPath, manifestPath);
      });
    },

    async verify() {
      let manifest: unknown;
      try {
        manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      } catch {
        return { valid: false, failures: ["manifest is missing or invalid"] };
      }

      const manifestFailures = validateManifest(manifest, rootRealPath);
      if (manifestFailures.length > 0) {
        return { valid: false, failures: manifestFailures };
      }
      if (!isAuditManifest(manifest)) {
        return { valid: false, failures: ["manifest structure is invalid"] };
      }

      const failures: string[] = [];
      if (manifest.schemaHash !== hashUtf8(manifestSchema)) {
        failures.push("manifest schema hash is invalid");
      }
      if (manifest.eventsHash !== await hashEvents(eventsPath)) {
        failures.push("events hash mismatch");
      }
      for (const artifact of manifest.artifacts) {
        if (!isSafeRelativePath(rootRealPath, artifact.path)) {
          failures.push(`artifact path is unsafe: ${artifact.path}`);
          continue;
        }
        try {
          if (await hashArtifact(rootRealPath, artifact.path) !== artifact.sha256) {
            failures.push(`artifact hash mismatch: ${artifact.path}`);
          }
        } catch {
          failures.push(`artifact is missing or unreadable: ${artifact.path}`);
        }
      }
      return { valid: failures.length === 0, failures };
    },
  };
}

function validateEvent(event: AuditEventInput): void {
  if (!eventTypes.includes(event.type) || !classifications.includes(event.classification)) {
    throw new Error("validation_error: invalid event type or classification");
  }
  if (event.payload === undefined || !isJsonValue(event.payload)) {
    throw new Error("validation_error: payload must be JSON serializable");
  }
}

function validateManifestInput(input: ManifestInput): void {
  if (!isUuid(input.runId) || !Array.isArray(input.artifacts)) {
    throw new Error("validation_error: invalid manifest input");
  }
  for (const value of [input.skillHash, input.configurationHash, input.inputHash, input.outputHash]) {
    if (value !== undefined && !isSha256Hash(value)) {
      throw new Error("validation_error: manifest hashes must be SHA-256 hex values");
    }
  }
  for (const artifact of input.artifacts) {
    if (!isManifestArtifactInput(artifact) || !isSafeRelativePath(".", artifact.path)) {
      throw new Error("validation_error: artifact path must remain within the audit root");
    }
  }
}

function hashPayload(payload: unknown): string {
  return hashUtf8(JSON.stringify(payload));
}

async function hashArtifact(rootDirectory: string, artifactPath: string): Promise<string> {
  if (!isSafeRelativePath(rootDirectory, artifactPath)) {
    throw new Error("validation_error: artifact path must remain within the audit root");
  }
  const resolvedArtifactPath = resolve(rootDirectory, artifactPath);
  const artifactFile = await open(resolvedArtifactPath, "r");
  let artifactBytes: Buffer;
  try {
    artifactBytes = await artifactFile.readFile();
  } finally {
    await artifactFile.close();
  }

  // Phase 0 requires a private, immutable audit root; this check limits path-swap exposure but cannot secure a shared root.
  const artifactRealPath = await realpath(resolvedArtifactPath);
  if (!isPathWithin(rootDirectory, artifactRealPath)) {
    throw new Error("validation_error: artifact path resolves outside the audit root");
  }
  return hashBytes(artifactBytes);
}

function isSafeRelativePath(rootDirectory: string, artifactPath: string): boolean {
  return typeof artifactPath === "string" &&
    artifactPath.length > 0 &&
    !isAbsolute(artifactPath) &&
    isPathWithin(resolve(rootDirectory), resolve(rootDirectory, artifactPath));
}

function isPathWithin(rootDirectory: string, candidatePath: string): boolean {
  const pathRelativeToRoot = relative(rootDirectory, candidatePath);
  return pathRelativeToRoot !== "" && !pathRelativeToRoot.startsWith("..") && !isAbsolute(pathRelativeToRoot);
}

function isJsonValue(value: unknown): boolean {
  try {
    return JSON.stringify(value) !== undefined;
  } catch {
    return false;
  }
}

function isSha256Hash(value: string): boolean {
  return sha256Pattern.test(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function isManifestArtifactInput(value: unknown): value is ManifestArtifactInput {
  return typeof value === "object" && value !== null &&
    "path" in value && typeof value.path === "string";
}

function isAuditManifest(value: unknown): value is AuditManifest {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const manifest = value as Record<string, unknown>;
  return isUuid(manifest.runId) &&
    [
      manifest.schemaHash,
      manifest.skillHash,
      manifest.configurationHash,
      manifest.inputHash,
      manifest.outputHash,
      manifest.eventsHash,
    ].every((hash) => typeof hash === "string" && isSha256Hash(hash)) &&
    Array.isArray(manifest.artifacts) &&
    manifest.artifacts.every(
      (artifact) => isManifestArtifactInput(artifact) &&
        "sha256" in artifact && typeof artifact.sha256 === "string" && isSha256Hash(artifact.sha256),
    );
}

function validateManifest(manifest: unknown, rootDirectory: string): string[] {
  if (!isAuditManifest(manifest)) {
    return ["manifest structure is invalid"];
  }
  return manifest.artifacts
    .filter((artifact) => !isSafeRelativePath(rootDirectory, artifact.path))
    .map((artifact) => `artifact path is unsafe: ${artifact.path}`);
}

async function hashEvents(eventsPath: string): Promise<string> {
  try {
    return hashUtf8(await readFile(eventsPath, "utf8"));
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return hashUtf8("");
    }
    throw error;
  }
}

async function manifestExists(manifestPath: string): Promise<boolean> {
  try {
    await readFile(manifestPath, "utf8");
    return true;
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}