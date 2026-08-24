import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

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