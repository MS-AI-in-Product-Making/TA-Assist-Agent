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
const ENGLISH_LOCK = {
  languageTag: "en-US",
  uiCatalogLanguage: "en",
  lockedAtTurnId: "turn-start-en",
  source: "workflow_start",
  fallbackUsed: false,
} as const;

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("SessionStore", () => {
  it("rejects creating a new session without an interaction language lock", async () => {
    const rootDir = await createTempRoot();

    await expect(createSessionStore({ rootDir, sessionId: SESSION_ID })).rejects.toMatchObject({
      code: "validation_error",
    });
    expect(readPersistedSessionCount(rootDir)).toBe(0);
  });

  it("reopens a session with the original interaction language", async () => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);

    expect((await store.readSnapshot()).interactionLanguage).toEqual(ENGLISH_LOCK);
    await store.close();

    const reopened = await openSessionStore({ rootDir, sessionId: SESSION_ID });
    expect((await reopened.readSnapshot()).interactionLanguage).toEqual(ENGLISH_LOCK);
    expect(readPersistedSnapshot(rootDir).interactionLanguage).toEqual(ENGLISH_LOCK);
    await reopened.close();
  });

  it("materializes missing historical interaction language as legacy_fallback and persists it", async () => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);
    await store.close();

    seedLegacySnapshot(rootDir, {
      contractVersion: "f8-session-snapshot-v1",
      sessionId: SESSION_ID,
      revision: 0,
      inputRevision: 0,
      state: "created",
      activeAttempt: null,
      priorRunReferences: [],
    });

    const reopened = await openSessionStore({ rootDir, sessionId: SESSION_ID });
    const migrated = await reopened.readSnapshot();
    await reopened.close();

    expect(migrated.interactionLanguage).toEqual({
      languageTag: "und",
      uiCatalogLanguage: "en",
      lockedAtTurnId: "legacy:session-001:revision-0",
      source: "legacy_fallback",
      fallbackUsed: true,
    });
    expect(readPersistedSnapshot(rootDir).interactionLanguage).toEqual(migrated.interactionLanguage);
  });

  it("applies a command once and recovers the same revision", async () => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);

    const first = await store.applyCommand(commandAt(0, COMMAND_ID), acceptWorkbook);
    const duplicate = await store.applyCommand(commandAt(0, COMMAND_ID), acceptWorkbook);

    expect(duplicate).toEqual(first);

    await store.close();

    const reopened = await openSessionStore({ rootDir, sessionId: SESSION_ID });
    expect(await reopened.readSnapshot()).toEqual(first);
    await reopened.close();
  });

  it("rejects newly created evidence-free downstream selections at the storage boundary", async () => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);
    try {
      await expect(store.applyCommand(commandAt(0, COMMAND_ID), async (snapshot) => {
        const mutation = acceptWorkbook(snapshot);
        return {
          ...mutation,
          snapshot: {
            ...mutation.snapshot,
            downstreamScopeSelection: {
              workbookContentHash: "a".repeat(64),
              selectedWorksheetNames: ["Analysis-A"],
              confirmed: true as const,
              provenance: "user" as const,
            },
          },
        };
      })).rejects.toThrow(/revision-bound evidence/i);
    } finally {
      await store.close();
    }
  });

  it("backfills historical worksheet selection provenance from committed command evidence", async () => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);
    await store.close();

    seedLegacySnapshot(rootDir, {
      ...snapshotWithAttempt({ revision: 0, state: "downstream_scope_required", activeAttempt: null }),
      revision: 2,
      inputRevision: 1,
      initialScopeSelection: {
        workbookContentHash: "a".repeat(64),
        selectedWorksheetNames: ["Analysis-A"],
        confirmed: true,
      },
      downstreamScopeSelection: {
        workbookContentHash: "a".repeat(64),
        selectedWorksheetNames: ["Analysis-A"],
        confirmed: true,
      },
    });
    insertCommittedCommand(rootDir, {
      commandId: "legacy-initial-user",
      expectedRevision: 1,
      committedRevision: 1,
      command: "confirm_initial_scope",
      payload: { workbookHash: "a".repeat(64), worksheetNames: ["Analysis-A"] },
    });
    insertCommittedCommand(rootDir, {
      commandId: "legacy-f1f2-attempt:auto-downstream",
      expectedRevision: 2,
      committedRevision: 2,
      command: "confirm_downstream_scope",
      payload: { workbookHash: "a".repeat(64), worksheetNames: ["Analysis-A"] },
    });

    const reopened = await openSessionStore({ rootDir, sessionId: SESSION_ID });
    const migrated = await reopened.readSnapshot();
    await reopened.close();

    expect(migrated.initialScopeSelection).toMatchObject({ provenance: "user" });
    expect(migrated.downstreamScopeSelection).toMatchObject({ provenance: "internal_fixture" });
    expect(readPersistedSnapshot(rootDir).initialScopeSelection).toMatchObject({ provenance: "user" });
    expect(readPersistedSnapshot(rootDir).downstreamScopeSelection).toMatchObject({ provenance: "internal_fixture" });
  });

  it("marks ambiguous or missing historical evidence as legacy_unverified and persists migration", async () => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);
    await store.close();

    seedLegacySnapshot(rootDir, {
      ...snapshotWithAttempt({ revision: 0, state: "downstream_scope_required", activeAttempt: null }),
      revision: 3,
      inputRevision: 1,
      initialScopeSelection: {
        workbookContentHash: "b".repeat(64),
        selectedWorksheetNames: ["Analysis-B"],
        confirmed: true,
      },
      downstreamScopeSelection: {
        workbookContentHash: "b".repeat(64),
        selectedWorksheetNames: ["Analysis-B"],
        confirmed: true,
      },
    });
    insertCommittedCommand(rootDir, {
      commandId: "legacy-1:auto-downstream",
      expectedRevision: 2,
      committedRevision: 2,
      command: "confirm_downstream_scope",
      payload: { workbookHash: "b".repeat(64), worksheetNames: ["Analysis-B"] },
    });
    insertCommittedCommand(rootDir, {
      commandId: "legacy-2-manual",
      expectedRevision: 3,
      committedRevision: 3,
      command: "confirm_downstream_scope",
      payload: { workbookHash: "b".repeat(64), worksheetNames: ["Analysis-B"] },
    });

    const reopened = await openSessionStore({ rootDir, sessionId: SESSION_ID });
    const migrated = await reopened.readSnapshot();
    await reopened.close();

    expect(migrated.initialScopeSelection).toMatchObject({ provenance: "legacy_unverified" });
    expect(migrated.downstreamScopeSelection).toMatchObject({ provenance: "legacy_unverified" });

    clearCommands(rootDir);

    const readWithoutEvidence = await openSessionStore({ rootDir, sessionId: SESSION_ID });
    const persisted = await readWithoutEvidence.readSnapshot();
    await readWithoutEvidence.close();

    expect(persisted.initialScopeSelection).toMatchObject({ provenance: "legacy_unverified" });
    expect(persisted.downstreamScopeSelection).toMatchObject({ provenance: "legacy_unverified" });
  });

  it("rejects stale revisions and late worker results", async () => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);

    await store.applyCommand(commandAt(0, COMMAND_ID), acceptWorkbook);

    await expect(store.applyCommand(commandAt(0, OTHER_COMMAND_ID), acceptWorkbook)).rejects.toMatchObject({
      code: "evidence_mismatch",
    });

    await expect(store.recordAttemptResult({ attemptId: "attempt-stale", result: {} })).resolves.toMatchObject({
      accepted: false,
    });

    await store.close();
  });

  it("reopens committed workbook bytes supplied as a Node Buffer", async () => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);
    await store.applyCommand({
      contractVersion: "f8-session-command-v1",
      sessionId: SESSION_ID,
      commandId: COMMAND_ID,
      expectedRevision: 0,
      command: "upload_workbook",
      payload: { fileName: "book.xlsx", workbookBytes: Buffer.from([80, 75, 3, 4]), inputClassification: "confidential", managedArtifactId: "managed-book" },
    }, acceptWorkbook);
    await store.close();

    const reopened = await openSessionStore({ rootDir, sessionId: SESSION_ID });
    try {
      const command = await reopened.readCommittedCommand(COMMAND_ID);
      expect(command?.command).toBe("upload_workbook");
      expect(command?.payload.workbookBytes).toEqual(new Uint8Array([80, 75, 3, 4]));
    } finally {
      await reopened.close();
    }
  });

  it("rejects attempt results that switch to a different active attempt", async () => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);
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

  it.each([
    ["f3_running", "f4_running"],
    ["f4_running", "f5_running"],
  ] as const)("accepts legal automatic successor %s -> %s", async (stage, successor) => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);
    try {
      await store.applyCommand(commandAt(0, COMMAND_ID), (snapshot) => {
        const accepted = acceptWorkbook(snapshot);
        return { ...accepted, snapshot: { ...accepted.snapshot, state: stage,
          activeAttempt: { ...accepted.snapshot.activeAttempt, stage } } };
      });

      const receipt = await store.recordAttemptResult({
        attemptId: ATTEMPT_ID,
        status: "completed",
        result: { ok: true },
        snapshot: snapshotWithAttempt({
          revision: 1,
          state: successor,
          activeAttempt: {
            attemptId: `${COMMAND_ID}:next:${successor}`,
            stage: successor,
            status: "running",
            commandId: `${COMMAND_ID}:next`,
            startedAt: "2026-08-24T01:00:00.000Z",
          },
        }),
      });

      expect(receipt.accepted).toBe(true);
      expect(receipt.snapshot).toMatchObject({
        state: successor,
        activeAttempt: {
          attemptId: `${COMMAND_ID}:next:${successor}`,
          stage: successor,
          status: "running",
        },
      });
    } finally {
      await store.close();
    }
  });

  it.each([
    ["f1_f2_running", "f3_running"],
    ["f0_validating", "f1_f2_running"],
    ["f3_running", "f6_running"],
    ["f6_running", "f7_running"],
    ["f5_running", "f6_running"],
  ] as const)("rejects automatic gate bypass %s -> %s without evidence", async (stage, successor) => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);
    try {
      await store.applyCommand(commandAt(0, COMMAND_ID), (snapshot) => {
        const accepted = acceptWorkbook(snapshot);
        return { ...accepted, snapshot: { ...accepted.snapshot, state: stage,
          activeAttempt: { ...accepted.snapshot.activeAttempt, stage } } };
      });
      await expect(store.recordAttemptResult({
        attemptId: ATTEMPT_ID, status: "completed", result: { ok: true },
        snapshot: snapshotWithAttempt({ revision: 1, state: successor, activeAttempt: {
          attemptId: `${COMMAND_ID}:next:${successor}`, commandId: `${COMMAND_ID}:next`,
          stage: successor, status: "running", startedAt: "2026-08-24T01:00:00.000Z",
        } }),
      })).rejects.toBeDefined();
      expect((await store.readSnapshot()).activeAttempt?.attemptId).toBe(ATTEMPT_ID);
      expect(readStageAttemptRows(rootDir)).toEqual([
        expect.objectContaining({ attempt_id: ATTEMPT_ID, status: "running", result_json: null }),
      ]);
    } finally { await store.close(); }
  });

  it("rejects terminal attempt results without a snapshot transition", async () => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);
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
    const store = await createStore(rootDir);
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
    const store = await createStore(rootDir);
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
    const store = await createStore(rootDir);
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
    const store = await createStore(rootDir);
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
    const store = await createStore(rootDir);
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
    const store = await createStore(rootDir);
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

  it("requires and persists a deterministic opaque review context for review artifacts", async () => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);
    try {
      await expect(store.applyCommand(commandAt(0, COMMAND_ID), (snapshot) => ({
        snapshot: snapshotWithAttempt({ revision: snapshot.revision, state: "f1_f2_running", activeAttempt: { attemptId: ATTEMPT_ID, stage: "f1_f2_running", status: "running", commandId: COMMAND_ID, startedAt: "2026-08-24T00:00:00.000Z" } }),
        artifactReferences: [{ ...artifactReference("f6-review"), kind: "f6_report" }],
      }))).rejects.toMatchObject({ code: "validation_error" });

      await store.applyCommand(commandAt(0, COMMAND_ID), (snapshot) => ({
        snapshot: snapshotWithAttempt({ revision: snapshot.revision, state: "f1_f2_running", activeAttempt: { attemptId: ATTEMPT_ID, stage: "f1_f2_running", status: "running", commandId: COMMAND_ID, startedAt: "2026-08-24T00:00:00.000Z" } }),
        artifactReferences: [{
          ...artifactReference("f6-review"),
          kind: "f6_report",
          reviewContext: { workbookHash: "a".repeat(64), downstreamSelectionHash: "b".repeat(64), baselineRunReference: "run-1" },
        }],
      }));

      expect(readArtifactRefMetadata(rootDir)).toEqual([expect.objectContaining({ reviewContextId: expect.stringMatching(/^[a-f0-9]{64}$/) })]);
    } finally {
      await store.close();
    }
  });

  it("projects snapshot-mutation artifact references into the returned and persisted snapshot", async () => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);
    try {
      await store.applyCommand(commandAt(0, COMMAND_ID), acceptWorkbook);
      const reference = { ...artifactReference("f2-current"), kind: "f2_report" as const };

      const updated = await store.applySnapshotMutation(1, (snapshot) => ({
        snapshot,
        artifactReferenceOps: { upsert: [reference] },
      }));

      expect(updated.artifactRefs).toEqual([expect.objectContaining({ artifactId: "f2-current", kind: "f2_report" })]);
      expect((await store.readSnapshot()).artifactRefs).toEqual(updated.artifactRefs);
      expect(readArtifactRefRows(rootDir).map((row) => row.artifact_id)).toEqual(["f2-current"]);
    } finally {
      await store.close();
    }
  });

  it("rejects malformed F6 pending draft artifact metadata and rolls back", async () => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);
    try {
      await expect(store.applyCommand(commandAt(0, COMMAND_ID), (snapshot) => ({
        snapshot: snapshotWithAttempt({
          revision: snapshot.revision,
          state: "analysis_context_decision_required",
          activeAttempt: null,
          pendingAnalysisContextDraft: {
            draftId: "draft-a",
            kind: "analysis_context",
            inputRevision: 0,
            reviewContextId: "a".repeat(64),
            artifactId: "f6-input-draft:analysis_context:draft-a",
            contentHash: "b".repeat(64),
            status: "preview_required",
          },
        }),
        artifactReferenceOps: {
          upsert: [{
            artifactId: "f6-input-draft:analysis_context:draft-a",
            sessionId: SESSION_ID,
            inputRevision: 0,
            kind: "f6_input_draft",
            relativePath: "runtime/workbench/managed-artifacts/session-001/f6-input-drafts/analysis_context/draft-a.json",
            contentHash: "b".repeat(64),
            metadata: {
              pendingDraft: {
                draftId: "draft-a",
                kind: "analysis_context",
                inputRevision: 0,
                reviewContextId: "a".repeat(64),
                artifactId: "f6-input-draft:analysis_context:draft-a",
                contentHash: "c".repeat(64),
                status: "preview_required",
              },
            },
          }],
        },
      }))).rejects.toMatchObject({ code: "validation_error" });

      expect(readArtifactRefRows(rootDir)).toEqual([]);
      expect((await store.readSnapshot()).pendingAnalysisContextDraft).toBeUndefined();
    } finally {
      await store.close();
    }
  });

  it("persists and projects both pending F6 draft kinds independently", async () => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);
    try {
      const snapshot = await store.applyCommand(commandAt(0, COMMAND_ID), (current) => ({
        snapshot: snapshotWithAttempt({
          revision: current.revision,
          state: "optimization_targets_decision_required",
          activeAttempt: null,
          pendingAnalysisContextDraft: {
            draftId: "draft-analysis",
            kind: "analysis_context",
            inputRevision: 0,
            reviewContextId: "a".repeat(64),
            artifactId: "f6-input-draft:analysis_context:draft-analysis",
            contentHash: "b".repeat(64),
            status: "preview_required",
          },
          pendingOptimizationTargetsDraft: {
            draftId: "draft-targets",
            kind: "optimization_targets",
            inputRevision: 0,
            reviewContextId: "a".repeat(64),
            artifactId: "f6-input-draft:optimization_targets:draft-targets",
            contentHash: "c".repeat(64),
            status: "preview_required",
          },
        }),
        artifactReferenceOps: {
          upsert: [
            {
              artifactId: "f6-input-draft:analysis_context:draft-analysis",
              sessionId: SESSION_ID,
              inputRevision: 0,
              kind: "f6_input_draft",
              relativePath: "runtime/workbench/managed-artifacts/session-001/f6-input-drafts/analysis_context/draft-analysis.json",
              contentHash: "b".repeat(64),
              metadata: {
                pendingDraft: {
                  draftId: "draft-analysis",
                  kind: "analysis_context",
                  inputRevision: 0,
                  reviewContextId: "a".repeat(64),
                  artifactId: "f6-input-draft:analysis_context:draft-analysis",
                  contentHash: "b".repeat(64),
                  status: "preview_required",
                },
              },
            },
            {
              artifactId: "f6-input-draft:optimization_targets:draft-targets",
              sessionId: SESSION_ID,
              inputRevision: 0,
              kind: "f6_input_draft",
              relativePath: "runtime/workbench/managed-artifacts/session-001/f6-input-drafts/optimization_targets/draft-targets.json",
              contentHash: "c".repeat(64),
              metadata: {
                pendingDraft: {
                  draftId: "draft-targets",
                  kind: "optimization_targets",
                  inputRevision: 0,
                  reviewContextId: "a".repeat(64),
                  artifactId: "f6-input-draft:optimization_targets:draft-targets",
                  contentHash: "c".repeat(64),
                  status: "preview_required",
                },
              },
            },
          ],
        },
      }));

      expect(snapshot.pendingAnalysisContextDraft?.draftId).toBe("draft-analysis");
      expect(snapshot.pendingOptimizationTargetsDraft?.draftId).toBe("draft-targets");
      expect(readArtifactRefRows(rootDir).map((row) => row.artifact_id)).toEqual([
        "f6-input-draft:analysis_context:draft-analysis",
        "f6-input-draft:optimization_targets:draft-targets",
      ]);
    } finally {
      await store.close();
    }
  });

  it("projects validated F2 reports without requiring a review context", async () => {
    const rootDir = await createTempRoot();
    const store = await createStore(rootDir);
    try {
      await store.applyCommand(commandAt(0, COMMAND_ID), (snapshot) => ({
        snapshot: snapshotWithAttempt({ revision: snapshot.revision, state: "f1_f2_running", activeAttempt: { attemptId: ATTEMPT_ID, stage: "f1_f2_running", status: "running", commandId: COMMAND_ID, startedAt: "2026-08-24T00:00:00.000Z" } }),
      }));

      const receipt = await store.recordAttemptResult({
        attemptId: ATTEMPT_ID,
        status: "completed",
        result: { featureId: "F2", status: "completed" },
        snapshot: snapshotWithAttempt({ revision: 1, state: "downstream_scope_required", activeAttempt: null }),
        artifactReferenceOps: { upsert: [{ ...artifactReference("f2-report"), kind: "f2_report" }] },
      });

      expect(receipt.snapshot.artifactRefs).toEqual([{ artifactId: "f2-report", kind: "f2_report", revision: 0, validated: true }]);
      expect((await store.readArtifactReference("f2-report"))?.kind).toBe("f2_report");
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
    const store = await createStore(rootDir, {
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

async function createStore(
  rootDir: string,
  overrides: Partial<Parameters<typeof createSessionStore>[0]> = {},
) {
  return createSessionStore({
    rootDir,
    sessionId: SESSION_ID,
    interactionLanguage: ENGLISH_LOCK,
    ...overrides,
  });
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
  pendingAnalysisContextDraft?: {
    draftId: string;
    kind: "analysis_context";
    inputRevision: number;
    reviewContextId: string;
    artifactId: string;
    contentHash: string;
    status: "preview_required";
  };
  pendingOptimizationTargetsDraft?: {
    draftId: string;
    kind: "optimization_targets";
    inputRevision: number;
    reviewContextId: string;
    artifactId: string;
    contentHash: string;
    status: "preview_required";
  };
}) {
  return {
    contractVersion: "f8-session-snapshot-v1",
    sessionId: SESSION_ID,
    revision: options.revision,
    inputRevision: 0,
    state: options.state,
    activeAttempt: options.activeAttempt,
    interactionLanguage: ENGLISH_LOCK,
    priorRunReferences: [],
    ...(options.scenarioDrafts === undefined ? {} : { scenarioDrafts: options.scenarioDrafts }),
    ...(options.pendingAnalysisContextDraft === undefined ? {} : { pendingAnalysisContextDraft: options.pendingAnalysisContextDraft }),
    ...(options.pendingOptimizationTargetsDraft === undefined ? {} : { pendingOptimizationTargetsDraft: options.pendingOptimizationTargetsDraft }),
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
      interactionLanguage: ENGLISH_LOCK,
      priorRunReferences: snapshot.priorRunReferences,
    },
    events: [],
  };
}

function readPersistedSnapshot(rootDir: string): Record<string, unknown> {
  const database = openDatabase(rootDir);
  try {
    const row = database.prepare("SELECT snapshot_json FROM sessions WHERE session_id = ?").get(SESSION_ID) as { snapshot_json: string };
    return JSON.parse(row.snapshot_json) as Record<string, unknown>;
  } finally {
    database.close();
  }
}

function readPersistedSessionCount(rootDir: string): number {
  const database = openDatabase(rootDir);
  try {
    const row = database.prepare("SELECT COUNT(*) AS count FROM sessions WHERE session_id = ?").get(SESSION_ID) as { count: number };
    return row.count;
  } finally {
    database.close();
  }
}

function readArtifactRefMetadata(rootDir: string): unknown[] {
  const database = openDatabase(rootDir);
  try {
    return (database.prepare("SELECT metadata_json FROM artifact_refs ORDER BY artifact_id").all() as Array<{ metadata_json: string }>).map((row) => JSON.parse(row.metadata_json));
  } finally {
    database.close();
  }
}

function seedLegacySnapshot(rootDir: string, snapshot: Record<string, unknown>): void {
  const database = openDatabase(rootDir);
  try {
    database.prepare("UPDATE sessions SET revision = ?, snapshot_json = ?, updated_at = ? WHERE session_id = ?").run(
      Number(snapshot.revision),
      JSON.stringify(snapshot),
      "2026-08-24T00:00:00.000Z",
      SESSION_ID,
    );
  } finally {
    database.close();
  }
}

function insertCommittedCommand(rootDir: string, input: {
  commandId: string;
  expectedRevision: number;
  committedRevision: number;
  command: "confirm_initial_scope" | "auto_confirm_initial_scope" | "confirm_downstream_scope";
  payload: { workbookHash: string; worksheetNames: string[] };
}): void {
  const database = openDatabase(rootDir);
  try {
    const command = {
      contractVersion: "f8-session-command-v1",
      sessionId: SESSION_ID,
      commandId: input.commandId,
      expectedRevision: input.expectedRevision,
      command: input.command,
      payload: input.payload,
    };
    database.prepare(`
      INSERT INTO commands(command_id, session_id, expected_revision, command_json, result_json, committed_revision, created_at, committed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.commandId,
      SESSION_ID,
      input.expectedRevision,
      JSON.stringify(command),
      JSON.stringify({ contractVersion: "f8-session-snapshot-v1", sessionId: SESSION_ID }),
      input.committedRevision,
      "2026-08-24T00:00:00.000Z",
      "2026-08-24T00:00:01.000Z",
    );
  } finally {
    database.close();
  }
}

function clearCommands(rootDir: string): void {
  const database = openDatabase(rootDir);
  try {
    database.prepare("DELETE FROM commands WHERE session_id = ?").run(SESSION_ID);
  } finally {
    database.close();
  }
}