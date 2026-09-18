import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSessionStore, openSessionStore } from "@ai-assist/workbench";

import { WorkbenchAuth } from "../auth.js";
import type { WorkbenchServerContext } from "../server.js";
import { hostActionsRoutes } from "./host-actions.js";

const SESSION_ID = "57575757-5757-4757-8757-575757575757";
const ACTION_ID = "ado-write:session:1";
const WORK_ITEM_URL = "https://dev.azure.com/contoso/Devices/_workitems/edit/1119604";
const roots: string[] = [];
const INTERACTION_LANGUAGE = {
  languageTag: "en-US",
  uiCatalogLanguage: "en",
  lockedAtTurnId: "turn-start-en",
  source: "workflow_start",
  fallbackUsed: false,
} as const;
const ANALYSIS_REQUEST_CONTEXT = {
  requestedAt: "2026-09-16T08:00:00.000Z",
  utcOffsetMinutes: 0,
  source: "web",
} as const;

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function acceptedV2Report() {
  return {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: "completed",
    artifactRoot: "controlled/f1",
    workbook: { fileName: "Anonymous.xlsx", contentHash: "a".repeat(64) },
    worksheets: [],
    ado: { status: "not_requested" },
    summary: { worksheetCount: 0, factorCount: 0, completeCount: 0, governanceRequiredCount: 0, duplicateConflictCount: 0 },
  };
}

function confirmation() {
  const nextContent = "Governed ADO body";
  return {
    status: "confirmation_required" as const,
    workItemReference: WORK_ITEM_URL,
    ownerReference: "owner@example.com",
    commentReference: "comment-0",
    expectedVersion: "1",
    beforeContentHash: "b".repeat(64),
    nextContent,
    factorCount: 0,
    confirmationHash: createHash("sha256").update(JSON.stringify([WORK_ITEM_URL, "comment-0", "1", nextContent])).digest("hex"),
    diff: [],
  };
}

function writeResult(options: { readonly workItemId?: number } = {}) {
  const payload = {
    status: "completed" as const,
    outcome: {
      kind: "surface_write" as const,
      receipt: {
        operation: "updated" as const,
        targetIdentity: { organization: "contoso", project: "Devices", workItemId: options.workItemId ?? 1119604 },
        verifiedAt: "2026-09-16T08:30:12.000Z",
      },
    },
  };
  return {
    contractVersion: "f8-host-action-result-v1" as const,
    actionId: ACTION_ID,
    hostInstanceId: "host-a",
    leaseId: "lease-1",
    status: "completed" as const,
    resultHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
    payload,
  };
}

async function createHarness(options: {
  readonly withReport: boolean;
  readonly sideTable?: "matching" | "missing" | "hash_mismatch" | "outside_root";
  readonly report?: Record<string, unknown>;
}) {
  const rootDir = mkdtempSync(path.join(tmpdir(), "host-actions-f3-"));
  roots.push(rootDir);
  const outsideRoot = options.sideTable === "outside_root"
    ? mkdtempSync(path.join(tmpdir(), "host-actions-f3-outside-"))
    : undefined;
  if (outsideRoot !== undefined) roots.push(outsideRoot);
  const relativePath = options.sideTable === "outside_root"
    ? path.relative(rootDir, path.join(outsideRoot!, "Feature3-Report.json"))
    : "managed/f3/Feature3-Report.json";
  const reportBytes = `${JSON.stringify(options.report ?? acceptedV2Report(), null, 2)}\n`;
  const reportHash = createHash("sha256").update(reportBytes).digest("hex");
  if (options.withReport) {
    mkdirSync(path.dirname(path.join(rootDir, relativePath)), { recursive: true });
    writeFileSync(path.join(rootDir, relativePath), reportBytes, "utf8");
  }
  const sideTableStore = await createSessionStore({
    rootDir,
    sessionId: SESSION_ID,
    interactionLanguage: INTERACTION_LANGUAGE,
    analysisRequestContext: ANALYSIS_REQUEST_CONTEXT,
  });
  try {
    await sideTableStore.applySnapshotMutation(0, (current) => ({
      snapshot: { ...current, state: "ado_action_pending", activeAttempt: null },
      ...((options.sideTable ?? "matching") === "missing"
        ? {}
        : {
          artifactReferenceOps: {
          upsert: [{
            artifactId: "f3:1",
            sessionId: SESSION_ID,
            inputRevision: 1,
            kind: "f3_report",
            relativePath,
            contentHash: options.sideTable === "hash_mismatch" ? "f".repeat(64) : reportHash,
            reviewContext: {
              workbookHash: "a".repeat(64),
              downstreamSelectionHash: "b".repeat(64),
              baselineRunReference: "run-1",
            },
          }],
          },
        }),
    }));
  } finally {
    await sideTableStore.close();
  }
  const auth = new WorkbenchAuth(new Uint8Array(32).fill(5));
  const action = {
    contractVersion: "f8-host-action-request-v1" as const,
    actionId: ACTION_ID,
    sessionId: SESSION_ID,
    expectedRevision: 1,
    expiresAt: "2026-09-17T00:00:00.000Z",
    kind: "surface_write" as const,
    validationActionId: "ado-validation:session:1",
    confirmationHash: confirmation().confirmationHash,
    expectedTargetVersion: "1",
    confirmation: confirmation(),
  };
  const snapshot = {
    sessionId: SESSION_ID,
    state: "ado_action_pending",
    revision: 1,
    inputRevision: 1,
    artifactRefs: [{ artifactId: "f3:1", kind: "f3_report", revision: 1, validated: true }],
  };
  const enqueueActiveAttempt = vi.fn(async () => undefined);
  const context = {
    rootDir,
    auth,
    hostActions: {
      readRecord: vi.fn(async () => ({ status: "claimed", request: action })),
      complete: vi.fn(async () => "accepted" as const),
    },
    sessions: { read: vi.fn(async () => snapshot) },
    artifacts: { read: vi.fn(() => ({ relativePath, fileName: "Feature3-Report.json", classification: "confidential", mimeType: "application/json" })) },
    enqueueActiveAttempt,
    requireAuthenticated(request: Parameters<WorkbenchServerContext["requireAuthenticated"]>[0]) { return auth.authenticate(request); },
  } as unknown as WorkbenchServerContext;
  const app = Fastify();
  await app.register(hostActionsRoutes, { context });
  await app.ready();
  const token = auth.issueHostBearer(SESSION_ID, ["host-actions:result"], { actionId: ACTION_ID, hostInstanceId: "host-a" });
  const readPersisted = async () => {
    const store = await openSessionStore({ rootDir, sessionId: SESSION_ID });
    try {
      return {
        snapshot: await store.readSnapshot(),
        reference: await store.readArtifactReference("f3:1"),
      };
    } finally {
      await store.close();
    }
  };
  return { app, token, enqueueActiveAttempt, readPersisted, reportPath: path.join(rootDir, relativePath) };
}

describe("surface write host action persistence", () => {
  it("persists F3 v3 traceability before advancing review", async () => {
    const harness = await createHarness({ withReport: true });
    try {
      const response = await harness.app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/host-actions/${encodeURIComponent(ACTION_ID)}/result`,
        headers: { authorization: `Bearer ${harness.token}` },
        payload: writeResult(),
      });

      expect(response.statusCode, response.body).toBe(204);
      const persisted = await harness.readPersisted();
      const reportBytes = readFileSync(harness.reportPath);
      expect(persisted.snapshot.state).toBe("review_required");
      expect(persisted.reference?.contentHash).toBe(createHash("sha256").update(reportBytes).digest("hex"));
      expect(JSON.parse(reportBytes.toString("utf8")).modelVersion).toBe("drawing-governance-v3");
      expect(harness.enqueueActiveAttempt).toHaveBeenCalledTimes(1);
    } finally {
      await harness.app.close();
    }
  });

  it("does not advance or retry a write when F3 persistence fails", async () => {
    const harness = await createHarness({ withReport: false });
    try {
      const response = await harness.app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/host-actions/${encodeURIComponent(ACTION_ID)}/result`,
        headers: { authorization: `Bearer ${harness.token}` },
        payload: writeResult(),
      });

      expect(response.statusCode, response.body).toBe(409);
      expect(response.json()).toEqual({ error: "f3_ado_traceability_persistence_failed" });
      expect((await harness.readPersisted()).snapshot.state).toBe("ado_action_pending");
      expect(harness.enqueueActiveAttempt).not.toHaveBeenCalled();
    } finally {
      await harness.app.close();
    }
  });

  it("fails closed when the current F3 snapshot display ref has no side-table evidence", async () => {
    const harness = await createHarness({ withReport: true, sideTable: "missing" });
    try {
      const response = await harness.app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/host-actions/${encodeURIComponent(ACTION_ID)}/result`,
        headers: { authorization: `Bearer ${harness.token}` },
        payload: writeResult(),
      });

      expect(response.statusCode, response.body).toBe(409);
      expect(response.json()).toEqual({ error: "f3_ado_traceability_persistence_failed" });
      expect((await harness.readPersisted()).snapshot.state).toBe("ado_action_pending");
      expect(harness.enqueueActiveAttempt).not.toHaveBeenCalled();
    } finally {
      await harness.app.close();
    }
  });

  it("fails closed when the side-table hash does not match the current F3 bytes", async () => {
    const harness = await createHarness({ withReport: true, sideTable: "hash_mismatch" });
    try {
      const response = await harness.app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/host-actions/${encodeURIComponent(ACTION_ID)}/result`,
        headers: { authorization: `Bearer ${harness.token}` },
        payload: writeResult(),
      });

      expect(response.statusCode, response.body).toBe(409);
      expect(response.json()).toEqual({ error: "f3_ado_traceability_persistence_failed" });
      expect((await harness.readPersisted()).snapshot.state).toBe("ado_action_pending");
      expect(harness.enqueueActiveAttempt).not.toHaveBeenCalled();
    } finally {
      await harness.app.close();
    }
  });

  it("fails closed when side-table evidence points outside the managed root", async () => {
    const harness = await createHarness({ withReport: true, sideTable: "outside_root" });
    try {
      const response = await harness.app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/host-actions/${encodeURIComponent(ACTION_ID)}/result`,
        headers: { authorization: `Bearer ${harness.token}` },
        payload: writeResult(),
      });

      expect(response.statusCode, response.body).toBe(409);
      expect(response.json()).toEqual({ error: "f3_ado_traceability_persistence_failed" });
      expect((await harness.readPersisted()).snapshot.state).toBe("ado_action_pending");
      expect(harness.enqueueActiveAttempt).not.toHaveBeenCalled();
    } finally {
      await harness.app.close();
    }
  });

  it("fails closed when existing v3 traceability conflicts with the Surface receipt", async () => {
    const harness = await createHarness({
      withReport: true,
      report: {
        ...acceptedV2Report(),
        modelVersion: "drawing-governance-v3",
        ado: {
          status: "updated",
          operation: "updated",
          organization: "contoso",
          project: "Devices",
          workItemId: 2222222,
        },
      },
    });
    try {
      const response = await harness.app.inject({
        method: "POST",
        url: `/api/sessions/${SESSION_ID}/host-actions/${encodeURIComponent(ACTION_ID)}/result`,
        headers: { authorization: `Bearer ${harness.token}` },
        payload: writeResult(),
      });

      expect(response.statusCode, response.body).toBe(409);
      expect(response.json()).toEqual({ error: "f3_ado_traceability_persistence_failed" });
      expect((await harness.readPersisted()).snapshot.state).toBe("ado_action_pending");
      expect(harness.enqueueActiveAttempt).not.toHaveBeenCalled();
    } finally {
      await harness.app.close();
    }
  });
});