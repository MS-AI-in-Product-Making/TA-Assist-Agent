import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { relative, resolve } from "node:path";
import type { ArtifactMetadata, RunStoreState } from "./run-store.js";

export interface ExportOptions {
  confirmConfidential?: boolean;
  includeSecret?: boolean;
}

export interface ExportResult {
  path: string;
  manifest: {
    artifacts: Array<Pick<ArtifactMetadata, "name" | "classification">>;
  };
}

export async function createExport(state: RunStoreState, options: ExportOptions = {}): Promise<ExportResult> {
  if (options.includeSecret) {
    throw new Error("policy_denied: secret data cannot be exported");
  }
  if (await state.auditStore.isSealed()) {
    return createExportFile(state, options);
  }
  return state.auditStore.runUnsealedTransaction(async (audit) => {
    if (await audit.hasEventType("purge_completed")) {
      throw new Error("dependency_error: run has been purged");
    }
    const exported = await createExportFile(state, options);
    await audit.append({ type: "export_created", classification: "internal", payload: { artifactCount: exported.manifest.artifacts.length } });
    return exported;
  });
}

async function createExportFile(state: RunStoreState, options: ExportOptions): Promise<ExportResult> {
  return state.withMemoryLock(async () => {
    const metadata = await readMetadata(state.metadataPath);
    if (metadata.some((artifact) => artifact.classification === "confidential") && !options.confirmConfidential) {
      throw new Error("policy_denied: confidential export requires explicit confirmation");
    }
    const exportsDirectory = resolve(state.runDirectory, "exports");
    const path = resolve(exportsDirectory, `export-${randomUUID()}.json`);
    if (!isWithin(exportsDirectory, path)) {
      throw new Error("validation_error: export path must remain in the run exports directory");
    }
    const manifest = {
      artifacts: metadata
        .filter((artifact) => artifact.retention === "retained")
        .map(({ name, classification }) => ({ name, classification })),
    };
    await mkdir(exportsDirectory, { recursive: true });
    await writeFile(path, JSON.stringify(manifest, null, 2), { encoding: "utf8", flag: "wx" });
    return { path, manifest };
  });
}

async function readMetadata(path: string): Promise<ArtifactMetadata[]> {
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(path, "utf8")) as ArtifactMetadata[];
}

function isWithin(rootDirectory: string, candidate: string): boolean {
  const difference = relative(rootDirectory, candidate);
  return difference !== "" && !difference.startsWith("..") && !difference.includes(":");
}