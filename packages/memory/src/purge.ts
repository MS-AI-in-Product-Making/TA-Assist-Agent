import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import type { RunStoreState } from "./run-store.js";

export interface PurgePlan {
  confirmationToken: string;
  runDirectory: string;
}

export async function planPurge(state: RunStoreState): Promise<PurgePlan> {
  if (await state.auditStore.isSealed()) {
    throw new Error("dependency_error: sealed audit runs cannot be purged; purge must complete before final sealing");
  }
  const confirmationToken = randomBytes(32).toString("base64url");
  await state.auditStore.append({ type: "purge_planned", classification: "internal", payload: { confirmationToken } });
  return { confirmationToken, runDirectory: state.runDirectory };
}

export async function executePurge(state: RunStoreState): Promise<void> {
  await state.auditStore.runUnsealedTransaction(async (audit) => {
    await audit.append({ type: "purge_completed", classification: "internal", payload: { runDirectory: state.runDirectory } });
    for (const path of [
      state.transcriptPath,
      state.decisionsPath,
      state.metadataPath,
      state.artifactsDirectory,
      resolve(state.runDirectory, "exports"),
    ]) {
      await rm(path, { recursive: true, force: true });
    }
  });
}