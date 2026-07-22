import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { createAuditStore, type AuditStore } from "@ai-assist/audit";
import type { DataClassification } from "@ai-assist/contracts";
import { createExport, type ExportOptions, type ExportResult } from "./export.js";
import { executePurge, planPurge, type PurgePlan } from "./purge.js";

export interface CreateRunStoreOptions {
  rootDir: string;
  projectId?: string;
  sessionId?: string;
  runId?: string;
  retainConfidentialArtifacts?: boolean;
}

export interface ArtifactInput {
  name: string;
  classification: DataClassification;
  content: string | Buffer;
}

export interface ArtifactMetadata {
  classification: Exclude<DataClassification, "secret">;
  name: string;
  hash: string;
  retention: "retained" | "metadata_only";
}

export interface StoredArtifact {
  name: string;
  classification: Exclude<DataClassification, "secret">;
}

export interface RunStore {
  readonly runDirectory: string;
  recordArtifact(input: ArtifactInput): Promise<void>;
  recordTranscript(classification: DataClassification, entry: unknown): Promise<void>;
  recordDecision(classification: DataClassification, entry: unknown): Promise<void>;
  listArtifacts(): Promise<StoredArtifact[]>;
  listArtifactMetadata(): Promise<ArtifactMetadata[]>;
  createExport(options?: ExportOptions): Promise<ExportResult>;
  planPurge(): Promise<PurgePlan>;
  executePurge(confirmationToken: string): Promise<void>;
  hasEvent(type: "purge_completed"): Promise<boolean>;
}

interface RunStoreState {
  runDirectory: string;
  artifactsDirectory: string;
  metadataPath: string;
  transcriptPath: string;
  decisionsPath: string;
  auditStore: AuditStore;
  retainConfidentialArtifacts: boolean;
  purgeToken?: string;
  pendingOperation: Promise<void>;
}

export async function createRunStore(options: CreateRunStoreOptions): Promise<RunStore> {
  const rootDirectory = resolve(options.rootDir);
  const projectId = options.projectId ?? randomUUID();
  const sessionId = options.sessionId ?? randomUUID();
  const runId = options.runId ?? randomUUID();
  for (const identifier of [projectId, sessionId, runId]) {
    if (!isSafeDirectoryName(identifier)) {
      throw new Error("validation_error: project, session, and run identifiers must be safe directory names");
    }
  }

  const runDirectory = resolve(rootDirectory, "projects", projectId, "sessions", sessionId, "runs", runId);
  if (!isWithin(rootDirectory, runDirectory)) {
    throw new Error("validation_error: run directory must remain within the runtime root");
  }
  const artifactsDirectory = resolve(runDirectory, "artifacts");
  const state: RunStoreState = {
    runDirectory,
    artifactsDirectory,
    metadataPath: resolve(runDirectory, "artifact-metadata.json"),
    transcriptPath: resolve(runDirectory, "transcript.jsonl"),
    decisionsPath: resolve(runDirectory, "decisions.jsonl"),
    auditStore: await createAuditStore(runDirectory),
    retainConfidentialArtifacts: options.retainConfidentialArtifacts ?? false,
    pendingOperation: Promise.resolve(),
  };

  await mkdir(artifactsDirectory, { recursive: true });
  await Promise.all([
    writeFile(state.transcriptPath, "", { encoding: "utf8", flag: "a" }),
    writeFile(state.decisionsPath, "", { encoding: "utf8", flag: "a" }),
    writeFile(state.metadataPath, "[]", { encoding: "utf8", flag: "a" }),
  ]);
  await state.auditStore.append({ type: "run_created", classification: "internal", payload: { runId } });

  return {
    runDirectory,
    async recordArtifact(input) {
      return serialize(state, async () => {
        assertSafeArtifactName(input.name);
        if (input.classification === "secret") {
          throw new Error("policy_denied: secret artifacts cannot be persisted");
        }
        const content = Buffer.isBuffer(input.content) ? input.content : Buffer.from(input.content, "utf8");
        const metadata: ArtifactMetadata = {
          classification: input.classification,
          name: input.name,
          hash: hash(content),
          retention: input.classification === "confidential" && !state.retainConfidentialArtifacts
            ? "metadata_only"
            : "retained",
        };
        const entries = await readMetadata(state.metadataPath);
        if (entries.some((entry) => entry.name === metadata.name)) {
          throw new Error("validation_error: artifact name already exists");
        }
        if (metadata.retention === "retained") {
          const artifactPath = resolve(state.artifactsDirectory, input.name);
          await writeFile(artifactPath, content, { flag: "wx" });
          try {
            await writeMetadata(state.metadataPath, [...entries, metadata]);
          } catch (error) {
            await rm(artifactPath, { force: true });
            throw error;
          }
          return;
        }
        await writeMetadata(state.metadataPath, [...entries, metadata]);
      });
    },
    async recordTranscript(classification, entry) {
      return serialize(state, () => appendRecord(state.transcriptPath, classification, entry, state.retainConfidentialArtifacts));
    },
    async recordDecision(classification, entry) {
      return serialize(state, () => appendRecord(state.decisionsPath, classification, entry, state.retainConfidentialArtifacts));
    },
    async listArtifacts() {
      return serialize(state, async () => (await readMetadata(state.metadataPath))
        .filter((metadata) => metadata.retention === "retained")
        .map(({ name, classification }) => ({ name, classification })));
    },
    async listArtifactMetadata() {
      return serialize(state, () => readMetadata(state.metadataPath));
    },
    async createExport(options) {
      return serialize(state, () => createExport(state, options));
    },
    async planPurge() {
      return serialize(state, async () => {
        const plan = await planPurge(state);
        state.purgeToken = plan.confirmationToken;
        return plan;
      });
    },
    async executePurge(confirmationToken) {
      return serialize(state, async () => {
        if (confirmationToken !== state.purgeToken) {
          throw new Error("policy_denied: purge confirmation token is invalid or has already been used");
        }
        delete state.purgeToken;
        await executePurge(state);
      });
    },
    async hasEvent(type) {
      return serialize(state, () => state.auditStore.hasEventType(type));
    },
  };
}

export type { RunStoreState };

function assertSafeArtifactName(name: string): void {
  const deviceName = name.split(".", 1)[0]?.toUpperCase();
  if (!isSafeDirectoryName(name) || name.includes(":") || /[. ]$/.test(name) ||
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(deviceName ?? "")) {
    throw new Error("validation_error: artifact name must be a safe basename");
  }
}

function isSafeDirectoryName(value: string): boolean {
  return typeof value === "string" && value.length > 0 && value !== "." && value !== ".." &&
    !isAbsolute(value) && basename(value) === value && !value.includes("/") && !value.includes("\\");
}

function isWithin(rootDirectory: string, candidate: string): boolean {
  const difference = relative(rootDirectory, candidate);
  return difference !== "" && !difference.startsWith("..") && !isAbsolute(difference);
}

function hash(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

async function readMetadata(path: string): Promise<ArtifactMetadata[]> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as ArtifactMetadata[];
  } catch (error: unknown) {
    if (isErrorCode(error, "ENOENT")) {
      return [];
    }
    throw error;
  }
}

async function writeMetadata(path: string, entries: ArtifactMetadata[]): Promise<void> {
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, JSON.stringify(entries, null, 2), { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function appendRecord(
  path: string,
  classification: DataClassification,
  entry: unknown,
  retainConfidentialArtifacts: boolean,
): Promise<void> {
  if (classification === "secret") {
    throw new Error("policy_denied: secrets cannot be persisted");
  }
  if (classification === "confidential" && !retainConfidentialArtifacts) {
    throw new Error("policy_denied: confidential records require explicit retention opt-in");
  }
  await appendFile(path, `${JSON.stringify({ classification, entry })}\n`, "utf8");
}

function serialize<T>(state: RunStoreState, operation: () => Promise<T>): Promise<T> {
  const result = state.pendingOperation.then(operation, operation);
  state.pendingOperation = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: unknown }).code === code;
}