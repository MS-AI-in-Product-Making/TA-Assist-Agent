import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import { createSessionStore, openSessionStore } from "./session-store.js";
import { createHostActionStore } from "./host-actions.js";
import { resolveManagedWorkbenchPaths } from "./managed-paths.js";

const SESSION_ID = "session-host-actions";
const WORKBOOK_HASH = "a".repeat(64);

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("host action lease lifecycle", () => {
  it("allows one host claim and rejects duplicate terminal completion mutations", async () => {
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

  it("serializes claims across store instances and recreates only after terminal tombstone retention expires", async () => {
    const rootDir = await createTempRoot();
    const sessionStore = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    await sessionStore.close();
    let now = new Date("2026-08-24T00:00:00.000Z");
    const first = await createHostActionStore({ rootDir, sessionId: SESSION_ID, terminalRetentionMs: 60_000, now: () => now });
    const second = await createHostActionStore({ rootDir, sessionId: SESSION_ID, terminalRetentionMs: 60_000, now: () => now });
    const action = await first.createHostAction(surfaceValidateRequest("action-cross-instance"));

    const claims = await Promise.allSettled([
      first.claimHostAction(action.actionId, "vscode-1"),
      second.claimHostAction(action.actionId, "vscode-2"),
    ]);
    expect(claims.filter((claim) => claim.status === "fulfilled")).toHaveLength(1);
    const claim = claims.find((candidate): candidate is PromiseFulfilledResult<{ leaseId: string; hostInstanceId: string }> => candidate.status === "fulfilled")!.value;
    await first.completeHostAction(completedResult(claim, action.actionId));

    await expect(second.createHostAction(surfaceValidateRequest(action.actionId))).resolves.toEqual(action);
    now = new Date("2026-08-24T00:01:01.000Z");
    const replacement = surfaceValidateRequest(action.actionId, { expiresAt: "2026-08-24T00:10:00.000Z" });
    await expect(second.createHostAction(replacement)).resolves.toEqual(replacement);

    await first.close();
    await second.close();
  });

  it("rejects duplicate terminal completion mutations after the session revision advances", async () => {
    const rootDir = await createTempRoot();
    const sessionStore = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    await sessionStore.close();

    const hostActions = await createHostActionStore({
      rootDir,
      sessionId: SESSION_ID,
      leaseDurationMs: 60_000,
      now: () => new Date("2026-08-24T00:00:00.000Z"),
    });

    const action = await hostActions.createHostAction(surfaceValidateRequest("action-validate-terminal-replay", {
      expectedRevision: 0,
    }));
    const claim = await hostActions.claimHostAction(action.actionId, "vscode-1");
    await hostActions.completeHostAction(completedResult(claim, action.actionId));

    await advanceSessionRevision(rootDir, 0, "command-revision-terminal-replay");

    await expect(hostActions.completeHostAction(completedResult(claim, action.actionId))).rejects.toMatchObject({
      code: "policy_denied",
    });

    await hostActions.close();
  });

  it("rejects stale expected revisions during create, claim, and complete", async () => {
    const rootDir = await createTempRoot();
    const sessionStore = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    await sessionStore.close();

    const hostActions = await createHostActionStore({
      rootDir,
      sessionId: SESSION_ID,
      leaseDurationMs: 60_000,
      now: () => new Date("2026-08-24T00:00:00.000Z"),
    });

    await advanceSessionRevision(rootDir, 0, "command-revision-1");
    await expect(hostActions.createHostAction(surfaceValidateRequest("action-stale-create"))).rejects.toMatchObject({
      code: "evidence_mismatch",
    });

    await hostActions.close();

    const freshHostActions = await createHostActionStore({
      rootDir,
      sessionId: SESSION_ID,
      leaseDurationMs: 60_000,
      now: () => new Date("2026-08-24T00:01:00.000Z"),
    });

    const freshAction = await freshHostActions.createHostAction(surfaceValidateRequest("action-fresh", { expectedRevision: 1 }));
    await advanceSessionRevision(rootDir, 1, "command-revision-2");

    await expect(freshHostActions.claimHostAction(freshAction.actionId, "vscode-1")).rejects.toMatchObject({
      code: "evidence_mismatch",
    });

    const currentAction = await freshHostActions.createHostAction(surfaceValidateRequest("action-current", { expectedRevision: 2 }));
    const currentClaim = await freshHostActions.claimHostAction(currentAction.actionId, "vscode-1");
    await advanceSessionRevision(rootDir, 2, "command-revision-3");

    await expect(freshHostActions.completeHostAction(completedResult(currentClaim, currentAction.actionId))).rejects.toMatchObject({
      code: "evidence_mismatch",
    });

    await freshHostActions.close();
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

    const boundWriteAction = await hostActions.createHostAction(surfaceWriteRequest("action-write-bound", {
      validationActionId: validationAction.actionId,
    }));
    await expect(hostActions.claimHostAction(boundWriteAction.actionId, "vscode-1")).resolves.toMatchObject({
      actionId: boundWriteAction.actionId,
      hostInstanceId: "vscode-1",
    });

    await hostActions.close();
  });

  it("rejects unrelated validations with the same hashes and accepts the exact referenced validation", async () => {
    const rootDir = await createTempRoot();
    const sessionStore = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    await sessionStore.close();

    const hostActions = await createHostActionStore({
      rootDir,
      sessionId: SESSION_ID,
      leaseDurationMs: 60_000,
      now: () => new Date("2026-08-24T00:00:00.000Z"),
    });

    const unrelatedValidation = await hostActions.createHostAction(surfaceValidateRequest("action-validate-unrelated"));
    const unrelatedClaim = await hostActions.claimHostAction(unrelatedValidation.actionId, "vscode-1");
    await hostActions.completeHostAction(completedResult(unrelatedClaim, unrelatedValidation.actionId));

    const exactValidation = await hostActions.createHostAction(surfaceValidateRequest("action-validate-exact"));
    const exactClaim = await hostActions.claimHostAction(exactValidation.actionId, "vscode-1");
    await hostActions.completeHostAction(completedResult(exactClaim, exactValidation.actionId));

    const unrelatedWrite = await hostActions.createHostAction(surfaceWriteRequest("action-write-unrelated", {
      validationActionId: "action-validate-missing",
    }));
    await expect(hostActions.claimHostAction(unrelatedWrite.actionId, "vscode-1")).rejects.toMatchObject({
      code: "prerequisite_not_ready",
    });

    const exactWrite = await hostActions.createHostAction(surfaceWriteRequest("action-write-exact", {
      validationActionId: exactValidation.actionId,
    }));
    await expect(hostActions.claimHostAction(exactWrite.actionId, "vscode-1")).resolves.toMatchObject({
      actionId: exactWrite.actionId,
      hostInstanceId: "vscode-1",
    });

    await hostActions.close();
  });

  it("rejects model requests and cross-session validations as surface write proof", async () => {
    const rootDir = await createTempRoot();
    const sessionStore = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    await sessionStore.close();
    const otherSessionStore = await createSessionStore({ rootDir, sessionId: "session-other" });
    await otherSessionStore.close();

    const hostActions = await createHostActionStore({
      rootDir,
      sessionId: SESSION_ID,
      leaseDurationMs: 60_000,
      now: () => new Date("2026-08-24T00:00:00.000Z"),
    });
    const otherHostActions = await createHostActionStore({
      rootDir,
      sessionId: "session-other",
      leaseDurationMs: 60_000,
      now: () => new Date("2026-08-24T00:00:00.000Z"),
    });

    const modelAction = await hostActions.createHostAction(modelRequest("action-model-proof", { expectedRevision: 0 }));
    const modelClaim = await hostActions.claimHostAction(modelAction.actionId, "vscode-1");
    await hostActions.completeHostAction(completedResult(modelClaim, modelAction.actionId));

    const modelWrite = await hostActions.createHostAction(surfaceWriteRequest("action-write-model", {
      validationActionId: modelAction.actionId,
    }));
    await expect(hostActions.claimHostAction(modelWrite.actionId, "vscode-1")).rejects.toMatchObject({
      code: "prerequisite_not_ready",
    });

    const crossSessionValidation = await otherHostActions.createHostAction(surfaceValidateRequest("action-validate-other-session", {
      sessionId: "session-other",
    }));
    const crossSessionClaim = await otherHostActions.claimHostAction(crossSessionValidation.actionId, "vscode-other");
    await otherHostActions.completeHostAction(completedResult(crossSessionClaim, crossSessionValidation.actionId, {
      hostInstanceId: "vscode-other",
    }));

    const crossSessionWrite = await hostActions.createHostAction(surfaceWriteRequest("action-write-cross-session", {
      validationActionId: crossSessionValidation.actionId,
    }));
    await expect(hostActions.claimHostAction(crossSessionWrite.actionId, "vscode-1")).rejects.toMatchObject({
      code: "prerequisite_not_ready",
    });

    await otherHostActions.close();
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

    const writeAction = await hostActions.createHostAction(surfaceWriteRequest("action-write-expired", {
      validationActionId: validationAction.actionId,
    }));
    const writeClaim = await hostActions.claimHostAction(writeAction.actionId, "vscode-1");

    now = new Date("2026-08-24T00:02:00.000Z");
    const expired = await hostActions.expireHostAction(writeAction.actionId, "vscode-1", writeClaim.leaseId);

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
    await expect(hostActions.expireHostAction(writeAction.actionId, "vscode-1", writeClaim.leaseId)).rejects.toMatchObject({
      code: "policy_denied",
    });

    await hostActions.close();
  });

  it("returns terminal host action state through read-only getHostAction without changing stored rows", async () => {
    const rootDir = await createTempRoot();
    const sessionStore = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    await sessionStore.close();

    const hostActions = await createHostActionStore({
      rootDir,
      sessionId: SESSION_ID,
      leaseDurationMs: 60_000,
      now: () => new Date("2026-08-24T00:00:00.000Z"),
    });

    const action = await hostActions.createHostAction(surfaceValidateRequest("action-read-terminal-state"));
    const claim = await hostActions.claimHostAction(action.actionId, "vscode-1");
    const result = completedResult(claim, action.actionId);
    await hostActions.completeHostAction(result);

    const rowBeforeRead = readPersistedHostActionRow(rootDir, action.actionId);
    const storedAction = await hostActions.getHostAction(action.actionId);
    const rowAfterRead = readPersistedHostActionRow(rootDir, action.actionId);

    expect(storedAction).toEqual({
      actionId: action.actionId,
      sessionId: SESSION_ID,
      status: "completed",
      request: action,
      claim,
      result,
      expiresAt: action.expiresAt,
      leaseId: claim.leaseId,
      leaseExpiresAt: claim.leaseExpiresAt,
      expectedRevision: action.expectedRevision,
      confirmationHash: action.confirmationHash,
      expectedTargetVersion: action.expectedTargetVersion,
    });
    expect(rowAfterRead).toEqual(rowBeforeRead);

    await hostActions.close();
  });

  it("rejects a completion from the wrong host even with a valid lease", async () => {
    const rootDir = await createTempRoot();
    const sessionStore = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    await sessionStore.close();

    const hostActions = await createHostActionStore({
      rootDir,
      sessionId: SESSION_ID,
      leaseDurationMs: 60_000,
      now: () => new Date("2026-08-24T00:00:00.000Z"),
    });

    const action = await hostActions.createHostAction(surfaceValidateRequest("action-wrong-host"));
    const claim = await hostActions.claimHostAction(action.actionId, "vscode-1");

    await expect(hostActions.completeHostAction(completedResult(claim, action.actionId, {
      hostInstanceId: "vscode-2",
    }))).rejects.toMatchObject({
      code: "validation_error",
    });

    await hostActions.close();
  });
});

async function createTempRoot(): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), "f8-host-actions-"));
  tempRoots.push(rootDir);
  return rootDir;
}

function readPersistedHostActionRow(rootDir: string, actionId: string) {
  const database = openDatabase(rootDir);
  try {
    return database.prepare(`
      SELECT action_id, status, result_json, updated_at
      FROM host_actions
      WHERE action_id = ?
    `).get(actionId) as {
      action_id: string;
      status: string;
      result_json: string | null;
      updated_at: string;
    };
  } finally {
    database.close();
  }
}

function surfaceValidateRequest(
  actionId: string,
  overrides: Partial<{
    sessionId: string;
    expectedRevision: number;
    expiresAt: string;
    confirmationHash: string;
    expectedTargetVersion: string;
  }> = {},
) {
  return {
    contractVersion: "f8-host-action-request-v1",
    actionId,
    sessionId: overrides.sessionId ?? SESSION_ID,
    expectedRevision: overrides.expectedRevision ?? 0,
    kind: "surface_validate" as const,
    expiresAt: overrides.expiresAt ?? "2026-08-24T00:05:00.000Z",
    confirmationHash: overrides.confirmationHash ?? WORKBOOK_HASH,
    expectedTargetVersion: overrides.expectedTargetVersion ?? "comment-v1",
  };
}

function surfaceWriteRequest(
  actionId: string,
  overrides: Partial<{
    sessionId: string;
    expectedRevision: number;
    validationActionId: string;
    confirmationHash: string;
    expectedTargetVersion: string;
  }> = {},
) {
  return {
    contractVersion: "f8-host-action-request-v1",
    actionId,
    sessionId: overrides.sessionId ?? SESSION_ID,
    expectedRevision: overrides.expectedRevision ?? 0,
    kind: "surface_write" as const,
    expiresAt: "2026-08-24T00:05:00.000Z",
    validationActionId: overrides.validationActionId ?? "action-validate-3",
    confirmationHash: overrides.confirmationHash ?? WORKBOOK_HASH,
    expectedTargetVersion: overrides.expectedTargetVersion ?? "comment-v1",
  };
}

function modelRequest(
  actionId: string,
  overrides: Partial<{
    expectedRevision: number;
  }> = {},
) {
  return {
    contractVersion: "f8-host-action-request-v1",
    actionId,
    sessionId: SESSION_ID,
    expectedRevision: overrides.expectedRevision ?? 0,
    kind: "model_request" as const,
    expiresAt: "2026-08-24T00:05:00.000Z",
  };
}

function completedResult(
  claim: { leaseId: string; hostInstanceId?: string },
  actionId: string,
  overrides: Partial<{
    hostInstanceId: string;
    resultHash: string;
  }> = {},
) {
  return {
    contractVersion: "f8-host-action-result-v1",
    actionId,
    hostInstanceId: overrides.hostInstanceId ?? claim.hostInstanceId ?? "vscode-1",
    leaseId: claim.leaseId,
    status: "completed" as const,
    resultHash: overrides.resultHash ?? WORKBOOK_HASH,
    payload: {
      status: "completed" as const,
    },
  };
}

async function advanceSessionRevision(rootDir: string, expectedRevision: number, commandId: string): Promise<void> {
  const store = await openSessionStore({ rootDir, sessionId: SESSION_ID });
  try {
    await store.applyCommand({
      contractVersion: "f8-session-command-v1",
      sessionId: SESSION_ID,
      commandId,
      expectedRevision,
      command: "complete_review",
      payload: { confirmed: true },
    }, (snapshot) => ({
      snapshot: {
        contractVersion: "f8-session-snapshot-v1",
        sessionId: snapshot.sessionId,
        revision: snapshot.revision,
        inputRevision: snapshot.inputRevision,
        state: "review_required",
        activeAttempt: null,
        priorRunReferences: snapshot.priorRunReferences,
        scenarioDrafts: snapshot.scenarioDrafts,
      },
    }));
  } finally {
    await store.close();
  }
}

function openDatabase(rootDir: string): DatabaseSync {
  const paths = resolveManagedWorkbenchPaths(rootDir);
  return new DatabaseSync(paths.databasePath);
}