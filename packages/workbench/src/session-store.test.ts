import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import { resolveManagedWorkbenchPaths } from "./managed-paths.js";
import { createSessionStore, openSessionStore } from "./session-store.js";

const SESSION_ID = "session-001";
const COMMAND_ID = "command-001";
const OTHER_COMMAND_ID = "command-002";
const ATTEMPT_ID = "attempt-001";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("SessionStore", () => {
  it("applies a command once and recovers the same revision", async () => {
    const rootDir = await createTempRoot();
    const store = await createSessionStore({ rootDir, sessionId: SESSION_ID });

    const first = await store.applyCommand(commandAt(0, COMMAND_ID), acceptWorkbook);
    const duplicate = await store.applyCommand(commandAt(0, COMMAND_ID), acceptWorkbook);

    expect(duplicate).toEqual(first);

    await store.close();

    const reopened = await openSessionStore({ rootDir, sessionId: SESSION_ID });
    expect(await reopened.readSnapshot()).toEqual(first);
    await reopened.close();
  });

  it("rejects stale revisions and late worker results", async () => {
    const rootDir = await createTempRoot();
    const store = await createSessionStore({ rootDir, sessionId: SESSION_ID });

    await store.applyCommand(commandAt(0, COMMAND_ID), acceptWorkbook);

    await expect(store.applyCommand(commandAt(0, OTHER_COMMAND_ID), acceptWorkbook)).rejects.toMatchObject({
      code: "evidence_mismatch",
    });

    await expect(store.recordAttemptResult({ attemptId: "attempt-stale", result: {} })).resolves.toMatchObject({
      accepted: false,
    });

    await store.close();
  });

  it("rejects attempt results that switch to a different active attempt", async () => {
    const rootDir = await createTempRoot();
    const store = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    try {
      await store.applyCommand(commandAt(0, COMMAND_ID), acceptWorkbook);

      await expect(store.recordAttemptResult({
        attemptId: ATTEMPT_ID,
        status: "completed",
        result: { ok: true },
        snapshot: snapshotWithAttempt({
          revision: 1,
          state: "f3_running",
          activeAttempt: {
            attemptId: "attempt-002",
            stage: "f3_running",
            status: "running",
            commandId: "command-003",
            startedAt: "2026-08-24T01:00:00.000Z",
          },
        }),
      })).rejects.toMatchObject({
        code: "validation_error",
      });

      expect(await store.readSnapshot()).toMatchObject({
        revision: 1,
        activeAttempt: { attemptId: ATTEMPT_ID, status: "running" },
      });
      expect(readStageAttemptRows(rootDir)).toEqual([
        expect.objectContaining({ attempt_id: ATTEMPT_ID, status: "running", result_json: null }),
      ]);
    } finally {
      await store.close();
    }
  });

  it("rejects terminal attempt results without a snapshot transition", async () => {
    const rootDir = await createTempRoot();
    const store = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    try {
      await store.applyCommand(commandAt(0, COMMAND_ID), acceptWorkbook);

      await expect(store.recordAttemptResult({
        attemptId: ATTEMPT_ID,
        status: "completed",
        result: { ok: true },
      })).rejects.toMatchObject({
        code: "validation_error",
      });

      expect(await store.readSnapshot()).toMatchObject({
        revision: 1,
        activeAttempt: { attemptId: ATTEMPT_ID, status: "running" },
      });
      expect(readStageAttemptRows(rootDir)).toEqual([
        expect.objectContaining({ attempt_id: ATTEMPT_ID, status: "running", result_json: null }),
      ]);
    } finally {
      await store.close();
    }
  });

  it("rolls back malformed or wrong-session drafts before persisting side tables", async () => {
    const rootDir = await createTempRoot();
    const store = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    try {
      await store.applyCommand(commandAt(0, COMMAND_ID), acceptWorkbook);

      await expect(store.recordAttemptResult({
        attemptId: ATTEMPT_ID,
        status: "completed",
        result: { ok: false },
        scenarioDrafts: [{
          contractVersion: "f8-scenario-draft-v1",
          draftId: "draft-wrong-session",
          sessionId: "session-other",
          worksheetName: "Sheet1",
          inputRevision: 1,
          status: "draft",
          mode: "WHAT_IF",
          nominalValue: 1,
          updatedAt: "2026-08-24T02:00:00.000Z",
        }],
      })).rejects.toMatchObject({
        code: "validation_error",
      });

      expect(await store.readSnapshot()).toMatchObject({
        revision: 1,
        activeAttempt: { attemptId: ATTEMPT_ID, status: "running" },
      });
      expect(readScenarioDraftRows(rootDir)).toEqual([]);
      expect(readStageAttemptRows(rootDir)).toEqual([
        expect.objectContaining({ attempt_id: ATTEMPT_ID, status: "running", result_json: null }),
      ]);
    } finally {
      await store.close();
    }
  });

  it("clears persisted scenario drafts when applyCommand snapshot omits them", async () => {
    const rootDir = await createTempRoot();
    const store = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    try {
      await store.applyCommand(commandAt(0, COMMAND_ID), (snapshot) => ({
        snapshot: snapshotWithAttempt({
          revision: snapshot.revision,
          state: "f1_f2_running",
          activeAttempt: {
            attemptId: ATTEMPT_ID,
            stage: "f1_f2_running",
            status: "running",
            commandId: COMMAND_ID,
            startedAt: "2026-08-24T00:00:00.000Z",
          },
          scenarioDrafts: [scenarioDraft("draft-001")],
        }),
      }));

      expect(readScenarioDraftRows(rootDir).map((row) => row.draft_id)).toEqual(["draft-001"]);

      const cleared = await store.applyCommand(commandAt(1, "command-omit-drafts"), (snapshot) => ({
        snapshot: snapshotWithAttempt({
          revision: snapshot.revision,
          state: "review_required",
          activeAttempt: null,
        }),
      }));

      expect(cleared.scenarioDrafts).toBeUndefined();
      expect(readScenarioDraftRows(rootDir)).toEqual([]);
    } finally {
      await store.close();
    }
  });

  it("preserves scenario drafts only when the next snapshot explicitly includes them", async () => {
    const rootDir = await createTempRoot();
    const store = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    try {
      const persistedDraft = scenarioDraft("draft-keep");
      await store.applyCommand(commandAt(0, COMMAND_ID), (snapshot) => ({
        snapshot: snapshotWithAttempt({
          revision: snapshot.revision,
          state: "f1_f2_running",
          activeAttempt: {
            attemptId: ATTEMPT_ID,
            stage: "f1_f2_running",
            status: "running",
            commandId: COMMAND_ID,
            startedAt: "2026-08-24T00:00:00.000Z",
          },
          scenarioDrafts: [persistedDraft],
        }),
      }));

      const nextSnapshot = await store.applyCommand(commandAt(1, "command-preserve-drafts"), (snapshot) => ({
        snapshot: snapshotWithAttempt({
          revision: snapshot.revision,
          state: "review_required",
          activeAttempt: null,
          scenarioDrafts: [persistedDraft],
        }),
      }));

      expect(nextSnapshot.scenarioDrafts).toEqual([persistedDraft]);
      expect(readScenarioDraftRows(rootDir).map((row) => row.draft_id)).toEqual(["draft-keep"]);
    } finally {
      await store.close();
    }
  });

  it("clears persisted scenario drafts when recordAttemptResult snapshot omits them", async () => {
    const rootDir = await createTempRoot();
    const store = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    try {
      await store.applyCommand(commandAt(0, COMMAND_ID), (snapshot) => ({
        snapshot: snapshotWithAttempt({
          revision: snapshot.revision,
          state: "f1_f2_running",
          activeAttempt: {
            attemptId: ATTEMPT_ID,
            stage: "f1_f2_running",
            status: "running",
            commandId: COMMAND_ID,
            startedAt: "2026-08-24T00:00:00.000Z",
          },
          scenarioDrafts: [scenarioDraft("draft-attempt")],
        }),
      }));

      const receipt = await store.recordAttemptResult({
        attemptId: ATTEMPT_ID,
        status: "completed",
        result: { ok: true },
        snapshot: snapshotWithAttempt({
          revision: 1,
          state: "review_required",
          activeAttempt: null,
        }),
      });

      expect(receipt.snapshot.scenarioDrafts).toBeUndefined();
      expect(readScenarioDraftRows(rootDir)).toEqual([]);
    } finally {
      await store.close();
    }
  });

  it("rejects compatibility scenario drafts when the next snapshot omits them", async () => {
    const rootDir = await createTempRoot();
    const store = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    try {
      const persistedDraft = scenarioDraft("draft-compat-override");
      await store.applyCommand(commandAt(0, COMMAND_ID), (snapshot) => ({
        snapshot: snapshotWithAttempt({
          revision: snapshot.revision,
          state: "f1_f2_running",
          activeAttempt: {
            attemptId: ATTEMPT_ID,
            stage: "f1_f2_running",
            status: "running",
            commandId: COMMAND_ID,
            startedAt: "2026-08-24T00:00:00.000Z",
          },
          scenarioDrafts: [persistedDraft],
        }),
      }));

      await expect(store.recordAttemptResult({
        attemptId: ATTEMPT_ID,
        status: "completed",
        result: { ok: true },
        snapshot: snapshotWithAttempt({
          revision: 1,
          state: "review_required",
          activeAttempt: null,
        }),
        scenarioDrafts: [persistedDraft],
      })).rejects.toMatchObject({
        code: "validation_error",
      });

      expect(await store.readSnapshot()).toMatchObject({
        revision: 1,
        activeAttempt: { attemptId: ATTEMPT_ID, status: "running" },
        scenarioDrafts: [persistedDraft],
      });
      expect(readScenarioDraftRows(rootDir).map((row) => row.draft_id)).toEqual(["draft-compat-override"]);
      expect(readStageAttemptRows(rootDir)).toEqual([
        expect.objectContaining({ attempt_id: ATTEMPT_ID, status: "running", result_json: null }),
      ]);
    } finally {
      await store.close();
    }
  });

  it("preserves side-table rows unless explicitly deleted", async () => {
    const rootDir = await createTempRoot();
    const store = await createSessionStore({ rootDir, sessionId: SESSION_ID });
    try {
      await store.applyCommand(commandAt(0, COMMAND_ID), (snapshot) => ({
        snapshot: snapshotWithAttempt({
          revision: snapshot.revision,
          state: "f1_f2_running",
          activeAttempt: {
            attemptId: ATTEMPT_ID,
            stage: "f1_f2_running",
            status: "running",
            commandId: COMMAND_ID,
            startedAt: "2026-08-24T00:00:00.000Z",
          },
        }),
        artifactReferences: [artifactReference("artifact-keep")],
        hostActions: [hostAction("action-keep")],
      }));

      await store.recordAttemptResult({
        attemptId: ATTEMPT_ID,
        status: "completed",
        result: { ok: true },
        snapshot: snapshotWithAttempt({
          revision: 1,
          state: "review_required",
          activeAttempt: null,
        }),
      });

      expect(readArtifactRefRows(rootDir).map((row) => row.artifact_id)).toEqual(["artifact-keep"]);
      expect(readHostActionRows(rootDir).map((row) => row.action_id)).toEqual(["action-keep"]);

      await store.applyCommand(commandAt(2, "command-003"), (snapshot) => ({
        snapshot: snapshotWithAttempt({
          revision: snapshot.revision,
          state: "review_required",
          activeAttempt: null,
        }),
        artifactReferenceOps: {
          delete: ["artifact-keep"],
        },
        hostActionOps: {
          delete: ["action-keep"],
        },
      }));

      expect(readArtifactRefRows(rootDir)).toEqual([]);
      expect(readHostActionRows(rootDir)).toEqual([]);
    } finally {
      await store.close();
    }
  });

  it.each([
    "afterCommandInsert",
    "afterSnapshotUpdate",
    "afterResultUpdate",
  ] as const)("rolls back injected failures at %s", async (failurePoint) => {
    const rootDir = await createTempRoot();
    const store = await createSessionStore({
      rootDir,
      sessionId: SESSION_ID,
      testHooks: {
        [failurePoint]: () => {
          throw new Error(`Injected failure at ${failurePoint}`);
        },
      },
    });

    await expect(store.applyCommand(commandAt(0, COMMAND_ID), acceptWorkbook)).rejects.toThrow(failurePoint);
    await store.close();

    const reopened = await openSessionStore({ rootDir, sessionId: SESSION_ID });
    expect(await reopened.readSnapshot()).toMatchObject({ revision: 0, state: "created", activeAttempt: null });
    await expect(reopened.readCommandReceipt(COMMAND_ID)).resolves.toBeNull();

    const recovered = await reopened.applyCommand(commandAt(0, COMMAND_ID), acceptWorkbook);
    expect(recovered).toMatchObject({
      revision: 1,
      state: "f1_f2_running",
      activeAttempt: { attemptId: ATTEMPT_ID },
    });

    await reopened.close();
  });
});

async function createTempRoot(): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), "f8-session-store-"));
  tempRoots.push(rootDir);
  return rootDir;
}

function commandAt(expectedRevision: number, commandId: string) {
  return {
    contractVersion: "f8-session-command-v1",
    sessionId: SESSION_ID,
    commandId,
    expectedRevision,
    command: "retry",
    payload: {
      stage: "f1_f2_running",
      attemptId: ATTEMPT_ID,
      reason: "Resume after workbook validation",
    },
  };
}

function snapshotWithAttempt(options: {
  revision: number;
  state: string;
  activeAttempt: {
    attemptId: string;
    stage: string;
    status: string;
    commandId?: string;
    startedAt: string;
    endedAt?: string;
  } | null;
  scenarioDrafts?: Array<ReturnType<typeof scenarioDraft>>;
}) {
  return {
    contractVersion: "f8-session-snapshot-v1",
    sessionId: SESSION_ID,
    revision: options.revision,
    inputRevision: 0,
    state: options.state,
    activeAttempt: options.activeAttempt,
    priorRunReferences: [],
    ...(options.scenarioDrafts === undefined ? {} : { scenarioDrafts: options.scenarioDrafts }),
  };
}

function scenarioDraft(draftId: string) {
  return {
    contractVersion: "f8-scenario-draft-v1",
    draftId,
    sessionId: SESSION_ID,
    worksheetName: "Sheet1",
    inputRevision: 1,
    status: "draft" as const,
    mode: "WHAT_IF" as const,
    nominalValue: 1,
    updatedAt: "2026-08-24T02:00:00.000Z",
  };
}

function artifactReference(artifactId: string) {
  return {
    artifactId,
    sessionId: SESSION_ID,
    inputRevision: 1,
    kind: "workbook",
    relativePath: `artifacts/${artifactId}.json`,
    contentHash: undefined,
    manifestHash: undefined,
    metadata: { source: artifactId },
  };
}

function hostAction(actionId: string) {
  return {
    actionId,
    sessionId: SESSION_ID,
    status: "pending" as const,
    request: {
      contractVersion: "f8-host-action-request-v1",
      actionId,
      sessionId: SESSION_ID,
      expectedRevision: 1,
      kind: "surface_validate" as const,
      expiresAt: "2026-08-24T03:00:00.000Z",
      confirmationHash: "a".repeat(64),
      expectedTargetVersion: "comment-v1",
    },
  };
}

function readScenarioDraftRows(rootDir: string): Array<{ draft_id: string; draft_json: string }> {
  const database = openDatabase(rootDir);
  try {
    return database.prepare("SELECT draft_id, draft_json FROM scenario_drafts ORDER BY draft_id").all() as Array<{
      draft_id: string;
      draft_json: string;
    }>;
  } finally {
    database.close();
  }
}

function readArtifactRefRows(rootDir: string): Array<{ artifact_id: string }> {
  const database = openDatabase(rootDir);
  try {
    return database.prepare("SELECT artifact_id FROM artifact_refs ORDER BY artifact_id").all() as Array<{ artifact_id: string }>;
  } finally {
    database.close();
  }
}

function readHostActionRows(rootDir: string): Array<{ action_id: string }> {
  const database = openDatabase(rootDir);
  try {
    return database.prepare("SELECT action_id FROM host_actions ORDER BY action_id").all() as Array<{ action_id: string }>;
  } finally {
    database.close();
  }
}

function readStageAttemptRows(rootDir: string): Array<{ attempt_id: string; status: string; result_json: string | null }> {
  const database = openDatabase(rootDir);
  try {
    return database.prepare("SELECT attempt_id, status, result_json FROM stage_attempts ORDER BY attempt_id").all() as Array<{
      attempt_id: string;
      status: string;
      result_json: string | null;
    }>;
  } finally {
    database.close();
  }
}

function openDatabase(rootDir: string): DatabaseSync {
  const paths = resolveManagedWorkbenchPaths(rootDir);
  return new DatabaseSync(paths.databasePath);
}

function acceptWorkbook(snapshot: {
  sessionId: string;
  revision: number;
  inputRevision: number;
  priorRunReferences: readonly unknown[];
}) {
  return {
    snapshot: {
      contractVersion: "f8-session-snapshot-v1",
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      inputRevision: snapshot.inputRevision,
      state: "f1_f2_running",
      activeAttempt: {
        attemptId: ATTEMPT_ID,
        stage: "f1_f2_running",
        status: "running",
        commandId: COMMAND_ID,
        startedAt: "2026-08-24T00:00:00.000Z",
      },
      priorRunReferences: snapshot.priorRunReferences,
    },
    events: [],
  };
}