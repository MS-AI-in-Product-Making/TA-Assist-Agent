import { createHash, randomBytes } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { RunStoreState } from "./run-store.js";

export interface PurgePlan {
  confirmationToken: string;
  runDirectory: string;
}

interface PersistedPurgePlan {
  activeTokenHashes: string[];
  consumedTokenHashes: string[];
}

const purgePlanPath = "purge-plan.json";

export async function planPurge(state: RunStoreState): Promise<PurgePlan> {
  return state.auditStore.runUnsealedTransaction(async (audit) => {
    if (await audit.hasEventType("purge_completed")) {
      throw new Error("dependency_error: run has been purged");
    }
    const confirmationToken = randomBytes(32).toString("base64url");
    await state.withMemoryLock(async () => {
      const plan = await readPurgePlan(state);
      const tokenHash = hashToken(confirmationToken);
      plan.activeTokenHashes.push(tokenHash);
      await writePurgePlan(state, plan);
      await audit.append({ type: "purge_planned", classification: "internal", payload: { state: "planned", tokenHash } });
    });
    return { confirmationToken, runDirectory: state.runDirectory };
  });
}

export async function executePurge(state: RunStoreState, confirmationToken?: string): Promise<void> {
  if (confirmationToken === undefined) {
    throw new Error("policy_denied: purge confirmation token is invalid or has already been used");
  }
  await state.auditStore.runUnsealedTransaction(async (audit) => {
    const tokenHash = hashToken(confirmationToken);
    const plan = await state.withMemoryLock(() => readPurgePlan(state));
    if (!plan.activeTokenHashes.includes(tokenHash)) {
      if (await audit.hasEventType("purge_completed")) {
        if (await hasAuditTokenHash(state, "purge_completed", confirmationToken)) {
          throw new Error("policy_denied: purge confirmation token is invalid or has already been used");
        }
        throw new Error("dependency_error: run has been purged");
      }
      throw new Error("policy_denied: purge confirmation token is invalid or has already been used");
    }
    if (await audit.hasEventType("purge_completed")) {
      throw new Error("dependency_error: run has been purged");
    }
    await audit.append({ type: "purge_completed", classification: "internal", payload: { runDirectory: state.runDirectory, tokenHash } });
    await state.withMemoryLock(async () => {
      for (const path of [
        state.transcriptPath,
        state.decisionsPath,
        state.metadataPath,
        state.artifactsDirectory,
        resolve(state.runDirectory, "exports"),
        resolve(state.runDirectory, purgePlanPath),
      ]) {
        await rm(path, { recursive: true, force: true });
      }
    });
  });
}

async function readPurgePlan(state: RunStoreState): Promise<PersistedPurgePlan> {
  try {
    const parsed = JSON.parse(await readFile(resolve(state.runDirectory, purgePlanPath), "utf8")) as Partial<PersistedPurgePlan>;
    if (!Array.isArray(parsed.activeTokenHashes) || !Array.isArray(parsed.consumedTokenHashes) ||
      ![...parsed.activeTokenHashes, ...parsed.consumedTokenHashes].every(isTokenHash)) {
      throw new Error("validation_error: purge plan is invalid");
    }
    return { activeTokenHashes: parsed.activeTokenHashes, consumedTokenHashes: parsed.consumedTokenHashes };
  } catch {
    return { activeTokenHashes: [], consumedTokenHashes: [] };
  }
}

async function writePurgePlan(state: RunStoreState, plan: PersistedPurgePlan): Promise<void> {
  await writeFile(resolve(state.runDirectory, purgePlanPath), JSON.stringify(plan), { encoding: "utf8" });
}

function isTokenHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

async function hasAuditTokenHash(
  state: RunStoreState,
  type: "purge_planned" | "purge_completed",
  confirmationToken: string,
): Promise<boolean> {
  const tokenHash = hashToken(confirmationToken);
  const payload = type === "purge_planned"
    ? { state: "planned", tokenHash }
    : { runDirectory: state.runDirectory, tokenHash };
  const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const events = (await readFile(resolve(state.runDirectory, "events.jsonl"), "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { type?: unknown; payloadHash?: unknown });
  return events.some((event) => event.type === type && event.payloadHash === payloadHash);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}