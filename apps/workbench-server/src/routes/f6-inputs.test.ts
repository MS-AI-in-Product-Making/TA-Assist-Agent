import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalSelectedWorksheetSetHash, openSessionStore } from "@ai-assist/workbench";

import { buildWorkbenchServer } from "../server.js";

const WORKBOOK_HASH = "a".repeat(64);
const REVIEW_CONTEXT = {
  workbookHash: WORKBOOK_HASH,
  downstreamSelectionHash: canonicalSelectedWorksheetSetHash(["Analysis-A"]),
  baselineRunReference: "f2-run-2026-09-05",
};
const SESSION_ID = "90909090-9090-4909-8909-909090909090";

function testRoot(name: string): string {
  return join(".tmp", `${name}-${randomUUID()}`);
}

describe("f6 input drafts routes", () => {
  it("materializes immutable managed draft, persists pending state, and supports read-preview confirmation", async () => {
    const rootDir = testRoot("workbench-server-f6-input-drafts-materialize");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate(SESSION_ID);
      await seedSessionLineage(rootDir, SESSION_ID);

      const createResponse = await server.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/f6-input-drafts`,
        headers: browser.headers,
        payload: {
          expectedRevision: 1,
          kind: "analysis_context",
          proposal: {
            proposalVersion: "f6-analysis-context-proposal-v1",
            userText: "Use current worksheet evidence to describe risk context.",
            worksheetSelectors: ["Analysis-A"],
            clarifications: [],
          },
        },
      });

      expect(createResponse.statusCode, createResponse.body).toBe(201);
      const created = createResponse.json<{
        status: "draft_ready";
        pendingDraft: {
          draftId: string;
          kind: "analysis_context";
          inputRevision: number;
          reviewContextId: string;
          artifactId: string;
          contentHash: string;
          status: "preview_required";
        };
        snapshotRevision: number;
      }>();
      expect(created.status).toBe("draft_ready");
      expect(created.pendingDraft).toMatchObject({
        kind: "analysis_context",
        inputRevision: 0,
        reviewContextId: expect.stringMatching(/^[a-f0-9]{64}$/),
        artifactId: expect.stringContaining("f6-input-draft:analysis_context:"),
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        status: "preview_required",
      });
      expect(JSON.stringify(created)).not.toContain("runtime/workbench");
      expect(JSON.stringify(created)).not.toContain("managed-artifacts");

      const store = await openSessionStore({ rootDir, sessionId: SESSION_ID });
      try {
        const snapshot = await store.readSnapshot();
        expect(snapshot.state).toBe("analysis_context_decision_required");
        expect(snapshot.activeAttempt).toBeNull();
        expect(snapshot.pendingAnalysisContextDraft).toEqual(created.pendingDraft);
        expect(snapshot.pendingOptimizationTargetsDraft).toBeUndefined();
        expect(await store.readCommittedCommand(`f6-input-draft:analysis_context:${created.pendingDraft.draftId}`)).toBeUndefined();

        const persisted = await store.readArtifactReference(created.pendingDraft.artifactId);
        expect(persisted).toMatchObject({
          artifactId: created.pendingDraft.artifactId,
          kind: "f6_input_draft",
          inputRevision: 0,
          contentHash: created.pendingDraft.contentHash,
          metadata: {
            pendingDraft: created.pendingDraft,
            materialization: {
              proposal: expect.objectContaining({ proposalVersion: "f6-analysis-context-proposal-v1" }),
            },
          },
        });
        const bytes = await readFile(join(rootDir, persisted!.relativePath));
        const hash = createHash("sha256").update(bytes).digest("hex");
        expect(hash).toBe(created.pendingDraft.contentHash);
      } finally {
        await store.close();
      }

      const previewBeforeConfirm = await server.inject({
        method: "GET",
        url: `/api/sessions/${SESSION_ID}/f6-input-drafts/${created.pendingDraft.draftId}`,
        headers: browser.headers,
      });
      expect(previewBeforeConfirm.statusCode).toBe(200);
      expect(previewBeforeConfirm.json()).toMatchObject({
        pendingDraft: created.pendingDraft,
        confirmed: false,
      });

      const confirmResponse = await server.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/commands`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: SESSION_ID,
          commandId: "confirm-analysis-context-draft",
          expectedRevision: created.snapshotRevision,
          command: "confirm_analysis_context",
          payload: {
            decision: "confirm",
            draftId: created.pendingDraft.draftId,
            draftHash: created.pendingDraft.contentHash,
          },
        },
      });
      expect(confirmResponse.statusCode, confirmResponse.body).toBe(202);

      const previewAfterConfirm = await server.inject({
        method: "GET",
        url: `/api/sessions/${SESSION_ID}/f6-input-drafts/${created.pendingDraft.draftId}`,
        headers: browser.headers,
      });
      expect(previewAfterConfirm.statusCode).toBe(200);
      expect(previewAfterConfirm.json()).toMatchObject({ confirmed: true });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects stale revision, ambiguous review context, and proposal-kind mismatch", async () => {
    const rootDir = testRoot("workbench-server-f6-input-drafts-rejections");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate(SESSION_ID);
      await seedSessionLineage(rootDir, SESSION_ID, { duplicateF4: true });

      const stale = await server.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/f6-input-drafts`,
        headers: browser.headers,
        payload: {
          expectedRevision: 0,
          kind: "analysis_context",
          proposal: {
            proposalVersion: "f6-analysis-context-proposal-v1",
            userText: "test",
            worksheetSelectors: ["Analysis-A"],
            clarifications: [],
          },
        },
      });
      expect(stale.statusCode).toBe(409);
      expect(stale.json()).toEqual({ error: "session_revision_conflict" });

      const ambiguous = await server.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/f6-input-drafts`,
        headers: browser.headers,
        payload: {
          expectedRevision: 1,
          kind: "analysis_context",
          proposal: {
            proposalVersion: "f6-analysis-context-proposal-v1",
            userText: "test",
            worksheetSelectors: ["Analysis-A"],
            clarifications: [],
          },
        },
      });
      expect(ambiguous.statusCode).toBe(409);
      expect(ambiguous.json<{ error: { code: string } }>()).toMatchObject({
        error: { code: "evidence_mismatch" },
      });

      const mismatch = await server.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/f6-input-drafts`,
        headers: browser.headers,
        payload: {
          expectedRevision: 1,
          kind: "optimization_targets",
          proposal: {
            proposalVersion: "f6-analysis-context-proposal-v1",
            userText: "test",
            worksheetSelectors: ["Analysis-A"],
            clarifications: [],
          },
        },
      });
      expect(mismatch.statusCode).toBe(400);
      expect(mismatch.json()).toEqual({ error: "f6_input_draft_schema_rejected" });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects cross-session access and enforces draft identity/hash without client path authority", async () => {
    const rootDir = testRoot("workbench-server-f6-input-drafts-confirm-boundary");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    try {
      const browserA = await server.testAuthenticate(SESSION_ID);
      const sessionB = "91919191-9191-4919-8919-919191919191";
      const browserB = await server.testAuthenticate(sessionB);
      await seedSessionLineage(rootDir, SESSION_ID);

      const created = await server.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/f6-input-drafts`,
        headers: browserA.headers,
        payload: {
          expectedRevision: 1,
          kind: "analysis_context",
          proposal: {
            proposalVersion: "f6-analysis-context-proposal-v1",
            userText: "test",
            worksheetSelectors: ["Analysis-A"],
            clarifications: [],
          },
        },
      });
      expect(created.statusCode, created.body).toBe(201);
      const body = created.json<{ pendingDraft: { draftId: string; contentHash: string }; snapshotRevision: number }>();

      const crossSessionWrite = await server.inject({
        method: "POST",
        url: `/api/sessions/${sessionB}/f6-input-drafts`,
        headers: browserA.headers,
        payload: {
          expectedRevision: 1,
          kind: "analysis_context",
          proposal: {
            proposalVersion: "f6-analysis-context-proposal-v1",
            userText: "test",
            worksheetSelectors: ["Analysis-A"],
            clarifications: [],
          },
        },
      });
      expect(crossSessionWrite.statusCode).toBe(403);
      expect(crossSessionWrite.json()).toEqual({ error: "session_scope_rejected" });

      const crossSessionRead = await server.inject({
        method: "GET",
        url: `/api/sessions/${SESSION_ID}/f6-input-drafts/${body.pendingDraft.draftId}`,
        headers: browserB.headers,
      });
      expect(crossSessionRead.statusCode).toBe(403);
      expect(crossSessionRead.json()).toEqual({ error: "session_scope_rejected" });

      const forgedPathAuthority = await server.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/commands`,
        headers: browserA.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: SESSION_ID,
          commandId: "confirm-analysis-context-forged-path",
          expectedRevision: body.snapshotRevision,
          command: "confirm_analysis_context",
          payload: {
            decision: "confirm",
            draftId: body.pendingDraft.draftId,
            draftHash: body.pendingDraft.contentHash,
            decisionReference: "runtime/workbench/managed-artifacts/forged.json#sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          },
        },
      });
      expect(forgedPathAuthority.statusCode).toBe(400);
      expect(forgedPathAuthority.json()).toEqual({ error: "command_schema_rejected" });

      const wrongHash = await server.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/commands`,
        headers: browserA.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: SESSION_ID,
          commandId: "confirm-analysis-context-wrong-hash",
          expectedRevision: body.snapshotRevision,
          command: "confirm_analysis_context",
          payload: {
            decision: "confirm",
            draftId: body.pendingDraft.draftId,
            draftHash: "f".repeat(64),
          },
        },
      });
      expect(wrongHash.statusCode).toBe(409);
      expect(wrongHash.json<{ error: { summary: string } }>()).toMatchObject({
        error: { summary: "draft_hash_mismatch" },
      });

      const wrongKind = await server.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/commands`,
        headers: browserA.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: SESSION_ID,
          commandId: "confirm-optimization-targets-wrong-kind",
          expectedRevision: body.snapshotRevision,
          command: "confirm_optimization_targets",
          payload: {
            decision: "confirm",
            draftId: body.pendingDraft.draftId,
            draftHash: body.pendingDraft.contentHash,
          },
        },
      });
      expect(wrongKind.statusCode).toBe(409);
      expect(wrongKind.json<{ error: { summary: string } }>()).toMatchObject({
        error: { summary: "draft_identity_mismatch" },
      });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});

async function seedSessionLineage(rootDir: string, sessionId: string, options: { duplicateF4?: boolean } = {}): Promise<void> {
  const f4PrimaryPath = "runtime/workbench/managed-artifacts/f4-primary.json";
  const f4SecondaryPath = "runtime/workbench/managed-artifacts/f4-secondary.json";
  const f5Path = "runtime/workbench/managed-artifacts/f5-report.json";
  await writeJsonArtifact(rootDir, f4PrimaryPath, f4CalculationFixture("table-analysis-a"));
  await writeJsonArtifact(rootDir, f4SecondaryPath, f4CalculationFixture("table-analysis-b"));
  await writeJsonArtifact(rootDir, f5Path, { reportId: "f5-report" });

  const store = await openSessionStore({ rootDir, sessionId });
  try {
    await store.applyCommand({
      contractVersion: "f8-session-command-v1",
      sessionId,
      commandId: "seed-f6-input-lineage",
      expectedRevision: 0,
      command: "upload_workbook",
      payload: {
        fileName: "book.xlsx",
        workbookBytes: new Uint8Array([80, 75, 3, 4]),
        inputClassification: "confidential",
      },
    }, async (snapshot) => ({
      snapshot: {
        ...snapshot,
        revision: snapshot.revision + 1,
        state: "analysis_context_decision_required",
        activeAttempt: null,
        downstreamScopeSelection: {
          workbookContentHash: WORKBOOK_HASH,
          selectedWorksheetNames: ["Analysis-A"],
          confirmed: true,
          provenance: "user",
        },
        priorRunReferences: [{
          featureId: "F2",
          referenceId: "f2-run-2026-09-05",
          contractVersion: "f2-user-report-v1",
          workbookHash: WORKBOOK_HASH,
          runReference: REVIEW_CONTEXT.baselineRunReference,
        }],
        artifactRefs: [
          {
            artifactId: "f4-calculation-primary",
            kind: "f4_calculation",
            revision: 0,
            validated: true,
            reviewContextId: "d".repeat(64),
          },
          ...(options.duplicateF4 === true
            ? [{
                artifactId: "f4-calculation-secondary",
                kind: "f4_calculation",
                revision: 0,
                validated: true,
                reviewContextId: "d".repeat(64),
              }]
            : []),
          {
            artifactId: "f5-report",
            kind: "f5_report",
            revision: 0,
            validated: true,
            reviewContextId: "d".repeat(64),
          },
        ],
      },
      artifactReferenceOps: {
        upsert: [
          {
            artifactId: "f4-calculation-primary",
            sessionId,
            inputRevision: 0,
            kind: "f4_calculation",
            relativePath: f4PrimaryPath,
            contentHash: "1".repeat(64),
            reviewContext: REVIEW_CONTEXT,
          },
          ...(options.duplicateF4 === true
            ? [{
                artifactId: "f4-calculation-secondary",
                sessionId,
                inputRevision: 0,
                kind: "f4_calculation",
                relativePath: f4SecondaryPath,
                contentHash: "2".repeat(64),
                reviewContext: REVIEW_CONTEXT,
              }]
            : []),
          {
            artifactId: "f5-report",
            sessionId,
            inputRevision: 0,
            kind: "f5_report",
            relativePath: f5Path,
            contentHash: "3".repeat(64),
            reviewContext: REVIEW_CONTEXT,
          },
        ],
      },
    }));
  } finally {
    await store.close();
  }
}

async function writeJsonArtifact(rootDir: string, relativePath: string, payload: unknown): Promise<void> {
  const absolutePath = join(rootDir, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function f4CalculationFixture(tableId: string): unknown {
  return {
    calculations: [
      {
        worksheetSelection: {
          worksheetName: "Analysis-A",
          tableId,
        },
        factors: [
          {
            source: { sourceRow: 14 },
            factorName: "Battery flatness",
            unit: "mm",
            lowerTolerance: -0.15,
            upperTolerance: 0.15,
          },
        ],
        system: {
          designNominal: 0,
          mean: 0,
          rssSigma: 0.1,
          lowerSpecLimit: -0.4,
          upperSpecLimit: 0.4,
          targetCpk: 1.33,
        },
      },
    ],
  };
}
