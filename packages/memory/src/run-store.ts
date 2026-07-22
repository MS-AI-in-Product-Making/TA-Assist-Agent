import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
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
  auditDirectory: string;
  artifactsDirectory: string;
  metadataPath: string;
  transcriptPath: string;
  decisionsPath: string;
  auditStore: AuditStore;
  retainConfidentialArtifacts: boolean;
  purgeToken?: string;
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
  const auditDirectory = resolve(runDirectory, "audit");
  const state: RunStoreState = {
    runDirectory,
    auditDirectory,
    artifactsDirectory,
    metadataPath: resolve(runDirectory, "artifact-metadata.json"),
    transcriptPath: resolve(runDirectory, "transcript.jsonl"),
    decisionsPath: resolve(runDirectory, "decisions.jsonl"),
    auditStore: await createAuditStore(auditDirectory),
    retainConfidentialArtifacts: options.retainConfidentialArtifacts ?? false,
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
      if (metadata.retention === "retained") {
        await writeFile(resolve(state.artifactsDirectory, input.name), content, { flag: "wx" });
      }
      await writeMetadata(state.metadataPath, metadata);
    },
    async recordTranscript(classification, entry) {
      await appendRecord(state.transcriptPath, classification, entry);
    },
    async recordDecision(classification, entry) {
      await appendRecord(state.decisionsPath, classification, entry);
    },
    async listArtifacts() {
      return (await readMetadata(state.metadataPath))
        .filter((metadata) => metadata.retention === "retained")
        .map(({ name, classification }) => ({ name, classification }));
    },
    async listArtifactMetadata() {
      return readMetadata(state.metadataPath);
    },
    async createExport(options) {
      return createExport(state, options);
    },
    async planPurge() {
      const plan = await planPurge(state);
      state.purgeToken = plan.confirmationToken;
      return plan;
    },
    async executePurge(confirmationToken) {
      if (confirmationToken !== state.purgeToken) {
        throw new Error("policy_denied: purge confirmation token is invalid or has already been used");
      }
      delete state.purgeToken;
      await executePurge(state);
    },
    async hasEvent(type) {
      return hasAuditEvent(state.auditDirectory, type);
    },
  };
}

export type { RunStoreState };

function assertSafeArtifactName(name: string): void {
  if (!isSafeDirectoryName(name)) {
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

async function writeMetadata(path: string, metadata: ArtifactMetadata): Promise<void> {
  const entries = await readMetadata(path);
  if (entries.some((entry) => entry.name === metadata.name)) {
    throw new Error("validation_error: artifact name already exists");
  }
  await writeFile(path, JSON.stringify([...entries, metadata], null, 2), "utf8");
}

async function appendRecord(path: string, classification: DataClassification, entry: unknown): Promise<void> {
  if (classification === "secret") {
    throw new Error("policy_denied: secrets cannot be persisted");
  }
  await appendFile(path, `${JSON.stringify({ classification, entry })}\n`, "utf8");
}

async function hasAuditEvent(auditDirectory: string, type: string): Promise<boolean> {
  const eventsPath = resolve(auditDirectory, "events.jsonl");
  try {
    const events = await readFile(eventsPath, "utf8");
    return events.split("\n").some((line) => line.length > 0 && JSON.parse(line).type === type);
  } catch {
    return false;
  }
}

function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: unknown }).code === code;
}