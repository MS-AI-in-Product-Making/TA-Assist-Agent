import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { hashUtf8 } from "./hash.js";

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
  const eventsPath = resolve(rootDirectory, "events.jsonl");
  const manifestPath = resolve(rootDirectory, "manifest.json");

  return {
    async append(event) {
      validateEvent(event);
      const eventRecord = {
        eventId: randomUUID(),
        timestamp: new Date().toISOString(),
        type: event.type,
        classification: event.classification,
        payloadHash: hashPayload(event.payload),
      };
      await appendFile(eventsPath, `${JSON.stringify(eventRecord)}\n`, "utf8");
    },

    async writeManifest(input) {
      validateManifestInput(input);
      const artifacts = await Promise.all(
        input.artifacts.map(async ({ path }) => ({
          path,
          sha256: await hashArtifact(rootDirectory, path),
        })),
      );
      const manifest: AuditManifest = {
        runId: input.runId,
        schemaHash: hashUtf8(manifestSchema),
        skillHash: input.skillHash ?? hashUtf8(""),
        configurationHash: input.configurationHash ?? hashUtf8(""),
        inputHash: input.inputHash ?? hashUtf8(""),
        outputHash: input.outputHash ?? hashUtf8(""),
        artifacts,
      };
      const temporaryManifestPath = resolve(rootDirectory, `manifest.${randomUUID()}.tmp`);
      await writeFile(temporaryManifestPath, JSON.stringify(manifest, null, 2), "utf8");
      await rename(temporaryManifestPath, manifestPath);
    },

    async verify() {
      let manifest: AuditManifest;
      try {
        manifest = JSON.parse(await readFile(manifestPath, "utf8")) as AuditManifest;
      } catch {
        return { valid: false, failures: ["manifest is missing or invalid"] };
      }

      const failures: string[] = [];
      if (!isSafeRelativePath(rootDirectory, "manifest.json") || manifest.schemaHash !== hashUtf8(manifestSchema)) {
        failures.push("manifest schema hash is invalid");
      }
      if (!Array.isArray(manifest.artifacts)) {
        return { valid: false, failures: [...failures, "manifest artifacts are invalid"] };
      }
      for (const artifact of manifest.artifacts) {
        if (!isSafeRelativePath(rootDirectory, artifact.path)) {
          failures.push(`artifact path is unsafe: ${artifact.path}`);
          continue;
        }
        try {
          if (await hashArtifact(rootDirectory, artifact.path) !== artifact.sha256) {
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
  if (typeof input.runId !== "string" || input.runId.length === 0 || !Array.isArray(input.artifacts)) {
    throw new Error("validation_error: invalid manifest input");
  }
  for (const value of [input.skillHash, input.configurationHash, input.inputHash, input.outputHash]) {
    if (value !== undefined && !isSha256Hash(value)) {
      throw new Error("validation_error: manifest hashes must be SHA-256 hex values");
    }
  }
  for (const artifact of input.artifacts) {
    if (!isSafeRelativePath(".", artifact.path)) {
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
  return hashUtf8(await readFile(resolve(rootDirectory, artifactPath), "utf8"));
}

function isSafeRelativePath(rootDirectory: string, artifactPath: string): boolean {
  return typeof artifactPath === "string" &&
    artifactPath.length > 0 &&
    !isAbsolute(artifactPath) &&
    !relative(resolve(rootDirectory), resolve(rootDirectory, artifactPath)).startsWith("..");
}

function isJsonValue(value: unknown): boolean {
  try {
    return JSON.stringify(value) !== undefined;
  } catch {
    return false;
  }
}

function isSha256Hash(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}