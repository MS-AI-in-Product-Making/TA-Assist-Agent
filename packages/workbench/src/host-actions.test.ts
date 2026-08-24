import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { createSessionStore } from "./session-store.js";
import { createHostActionStore } from "./host-actions.js";

const SESSION_ID = "session-host-actions";
const WORKBOOK_HASH = "a".repeat(64);

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("host action lease lifecycle", () => {
  it("allows one host claim and rejects a second writer", async () => {
    const rootDir = await createTempRoot();
    const sessionStore = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    await sessionStore.close();

    const hostActions = await createHostActionStore({
      rootDir,
      sessionId: SESSION_ID,
      leaseDurationMs: 60_000,
      now: () => new Date("2026-08-24T00:00:00.000Z"),
    });

    const action = await hostActions.createHostAction(surfaceValidateRequest("action-validate-1"));
    const claim = await hostActions.claimHostAction(action.actionId, "vscode-1");

    await expect(hostActions.claimHostAction(action.actionId, "vscode-2")).rejects.toMatchObject({
      code: "prerequisite_not_ready",
    });

    await hostActions.completeHostAction(completedResult(claim, action.actionId));

    await expect(hostActions.completeHostAction(completedResult(claim, action.actionId))).rejects.toMatchObject({
      code: "policy_denied",
    });

    await hostActions.close();
  });

  it("requires a terminal validation action before a write claim", async () => {
    const rootDir = await createTempRoot();
    const sessionStore = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    await sessionStore.close();

    const hostActions = await createHostActionStore({
      rootDir,
      sessionId: SESSION_ID,
      leaseDurationMs: 60_000,
      now: () => new Date("2026-08-24T00:00:00.000Z"),
    });

    const writeAction = await hostActions.createHostAction(surfaceWriteRequest("action-write-missing"));

    await expect(hostActions.claimHostAction(writeAction.actionId, "vscode-1")).rejects.toMatchObject({
      code: "prerequisite_not_ready",
    });

    const validationAction = await hostActions.createHostAction(surfaceValidateRequest("action-validate-2"));
    const validationClaim = await hostActions.claimHostAction(validationAction.actionId, "vscode-1");
    await hostActions.completeHostAction(completedResult(validationClaim, validationAction.actionId));

    const boundWriteAction = await hostActions.createHostAction(surfaceWriteRequest("action-write-bound"));
    await expect(hostActions.claimHostAction(boundWriteAction.actionId, "vscode-1")).resolves.toMatchObject({
      actionId: boundWriteAction.actionId,
      hostInstanceId: "vscode-1",
    });

    await hostActions.close();
  });

  it("expires a claimed write action into manual reconciliation without auto retry", async () => {
    const rootDir = await createTempRoot();
    const sessionStore = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    await sessionStore.close();

    let now = new Date("2026-08-24T00:00:00.000Z");
    const hostActions = await createHostActionStore({
      rootDir,
      sessionId: SESSION_ID,
      leaseDurationMs: 60_000,
      now: () => now,
    });

    const validationAction = await hostActions.createHostAction(surfaceValidateRequest("action-validate-3"));
    const validationClaim = await hostActions.claimHostAction(validationAction.actionId, "vscode-1");
    await hostActions.completeHostAction(completedResult(validationClaim, validationAction.actionId));

    const writeAction = await hostActions.createHostAction(surfaceWriteRequest("action-write-expired"));
    const writeClaim = await hostActions.claimHostAction(writeAction.actionId, "vscode-1");

    now = new Date("2026-08-24T00:02:00.000Z");
    const expired = await hostActions.expireHostAction(writeAction.actionId, writeClaim.leaseId);

    expect(expired).toMatchObject({
      actionId: writeAction.actionId,
      leaseId: writeClaim.leaseId,
      status: "blocked",
      payload: {
        status: "blocked",
      },
    });

    await expect(hostActions.claimHostAction(writeAction.actionId, "vscode-2")).rejects.toMatchObject({
      code: "policy_denied",
    });
    await expect(hostActions.completeHostAction(completedResult(writeClaim, writeAction.actionId))).rejects.toMatchObject({
      code: "policy_denied",
    });

    await hostActions.close();
  });
});

async function createTempRoot(): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), "f8-host-actions-"));
  tempRoots.push(rootDir);
  return rootDir;
}

function surfaceValidateRequest(actionId: string) {
  return {
    contractVersion: "f8-host-action-request-v1",
    actionId,
    sessionId: SESSION_ID,
    expectedRevision: 0,
    kind: "surface_validate" as const,
    expiresAt: "2026-08-24T00:05:00.000Z",
    confirmationHash: WORKBOOK_HASH,
    expectedTargetVersion: "comment-v1",
  };
}

function surfaceWriteRequest(actionId: string) {
  return {
    contractVersion: "f8-host-action-request-v1",
    actionId,
    sessionId: SESSION_ID,
    expectedRevision: 0,
    kind: "surface_write" as const,
    expiresAt: "2026-08-24T00:05:00.000Z",
    confirmationHash: WORKBOOK_HASH,
    expectedTargetVersion: "comment-v1",
  };
}

function completedResult(claim: { leaseId: string }, actionId: string) {
  return {
    contractVersion: "f8-host-action-result-v1",
    actionId,
    leaseId: claim.leaseId,
    status: "completed" as const,
    resultHash: WORKBOOK_HASH,
    payload: {
      status: "completed" as const,
    },
  };
}