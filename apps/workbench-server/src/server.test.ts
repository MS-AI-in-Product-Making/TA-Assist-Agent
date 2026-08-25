import { createHash, randomUUID } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it, vi } from "vitest";
import { get } from "node:http";

import { buildWorkbenchServer } from "./server.js";
import { createConversationStore } from "@ai-assist/conversation";
import { openSessionStore, projectWorksheetReview, selectCompleteReviewContext } from "@ai-assist/workbench";
import type { PersistentWorkerQueueOptions, StageJob } from "./sqlite-worker-queue.js";

function testRoot(name: string): string {
  return join(".tmp", `${name}-${randomUUID()}`);
}

const REVIEW_CONTEXT = {
  workbookHash: "a".repeat(64),
  downstreamSelectionHash: createHash("sha256").update(JSON.stringify(["Analysis-A"])).digest("hex"),
  baselineRunReference: "f2-run-2026-08-25",
};

function structuredReviewResult(featureId: "F4" | "F5" | "F6", includeContext = true) {
  const artifacts = featureId === "F4"
    ? [{ artifactId: "f4-calculation", kind: "f4_calculation", relativePath: "f4/Feature4-Calculation.json", contentHash: "1".repeat(64) }]
    : featureId === "F5"
      ? [{ artifactId: "f5-report", kind: "f5_report", relativePath: "f5/Feature5-Report.json", contentHash: "2".repeat(64) }]
      : [
          { artifactId: "f6-optimization", kind: "f6_optimization", relativePath: "f6/Feature6-Optimization.json", contentHash: "3".repeat(64) },
          { artifactId: "f6-report", kind: "f6_report", relativePath: "f6/Feature6-Report.json", contentHash: "4".repeat(64) },
        ];
  return { featureId, status: "completed", ...(includeContext ? { reviewContext: REVIEW_CONTEXT } : {}), artifactReferences: artifacts };
}

async function immediateQueue(options: PersistentWorkerQueueOptions) {
  return {
    async enqueue(job: StageJob) {
      await options.sessionStore.persistAttempt({ attemptId: job.attemptId, status: "running", jobId: job.jobId, stage: job.stage });
      if (options.worker === undefined) {
        await options.sessionStore.markDependencyFailure(job.attemptId, "No worker executor is configured; retry is required.", job);
        return { jobId: job.jobId, attemptId: job.attemptId, status: "failed" as const };
      }
      try {
        const result = await options.worker(job);
        const accepted = await options.sessionStore.markAttemptResult(job.attemptId, result, "running", job);
        if (!accepted) {
          await options.sessionStore.markDependencyFailure(job.attemptId, "Attempt result was rejected by the session store.", job);
          return { jobId: job.jobId, attemptId: job.attemptId, status: "failed" as const };
        }
        return { jobId: job.jobId, attemptId: job.attemptId, status: "completed" as const };
      } catch {
        await options.sessionStore.markDependencyFailure(job.attemptId, "Worker failed.", job);
        return { jobId: job.jobId, attemptId: job.attemptId, status: "failed" as const };
      }
    },
    async cancel() { return false; },
    async reconcile() {},
  };
}

describe("workbench server routes", () => {
  it("persists Web turns in the shared TA ConversationStore", async () => {
    const rootDir = testRoot("workbench-server-shared-conversation");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "34343434-3434-4343-8343-343434343434";
    const server = await buildWorkbenchServer({ rootDir, skipWebAssets: true });
    let closed = false;
    try {
      const browser = await server.testAuthenticate(sessionId);
      const turn = { contractVersion: "ta-conversation-turn-v1", turnId: "web-turn-1", sessionId, sequence: 1, source: "web", role: "user", content: [{ kind: "text", text: "继续分析" }], createdAt: "2026-08-25T00:00:00.000Z", relatedArtifactIds: [] };
      const response = await server.inject({ method: "POST", url: `/api/sessions/${sessionId}/conversation`, headers: browser.headers, payload: turn });
      expect(response.statusCode).toBe(201);
      await server.close();
      closed = true;
      const conversation = await createConversationStore({ rootDir: join(rootDir, "runtime", "workbench") });
      try {
        await expect(conversation.readTurns(sessionId)).resolves.toEqual([turn]);
      } finally {
        await conversation.close();
      }
    } finally {
      if (!closed) await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("calculates without persistence, then saves and independently promotes one What-if draft", async () => {
    const rootDir = testRoot("workbench-server-what-if");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "33333333-3333-4333-8333-333333333333";
    const promotionPreview = {
      contractVersion: "v1" as const, inputClassification: "confidential" as const, targetVersion: "f6-optimization-targets-v1" as const, workbookContentHash: "a".repeat(64),
      worksheets: [{ worksheetName: "Analysis-A", tableId: "table-a", baselineIdentity: { calculationVersion: "excel-ta-v1" as const, projectReference: "project-a", runReference: "f4-run-a", workbookContentHash: "a".repeat(64), worksheetName: "Analysis-A", tableId: "table-a" }, targets: [{ targetId: "Analysis-A:table-a:2:tolerance", targetType: "factor_tolerance" as const, factor: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, factorName: "factor-a", unit: "mm" }, upperTolerance: 0.8, lowerTolerance: -1, unit: "mm" }] }],
    };
    const calculatedDraft = {
      contractVersion: "f8-scenario-draft-v1" as const, draftId: "draft-a", sessionId, worksheetName: "Analysis-A", inputRevision: 1, status: "calculated" as const, mode: "WHAT_IF" as const,
      baselineWorkbookHash: "a".repeat(64), baselineRunReference: "f4-run-a", calculationReference: "what-if:draft-a", change: { upperTolerance: 0.8 },
      calculationMetrics: { mean: 0, rssSigma: 0.8, cp: 1.2, cpkL: 1.1, cpkU: 1.3, cpk: 1.1, statisticalMargin: 2, worstCaseMargin: 1 },
    };
    const whatIfService = { calculate: vi.fn(async () => calculatedDraft), createPromotionPreview: vi.fn(async () => promotionPreview) };
    const server = await buildWorkbenchServer({ rootDir, whatIfService, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate(sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({ contractVersion: "f8-session-command-v1", sessionId, commandId: "seed-review", expectedRevision: 0, command: "upload_workbook", payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" } }, async (snapshot) => ({ snapshot: { ...snapshot, revision: 1, inputRevision: 1, state: "review_required", activeAttempt: null } }));
      } finally { await store.close(); }
      const requestBody = { draftId: "draft-a", worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, inputRevision: 1, patch: { upperTolerance: 0.8 } };
      const calculated = await server.inject({ method: "POST", url: `/api/sessions/${sessionId}/what-if/calculate`, headers: browser.headers, payload: requestBody });
      expect(calculated.statusCode).toBe(200);
      expect(calculated.json()).toMatchObject({ status: "calculated", calculationMetrics: { cpk: 1.1 } });
      const calculatedStore = await openSessionStore({ rootDir, sessionId });
      try {
        expect((await calculatedStore.readSnapshot()).revision).toBe(1);
      } finally {
        await calculatedStore.close();
      }

      const saved = await server.inject({ method: "POST", url: `/api/sessions/${sessionId}/commands`, headers: browser.headers, payload: { contractVersion: "f8-session-command-v1", sessionId, commandId: "save-draft", expectedRevision: 1, command: "save_what_if_draft", payload: requestBody } });
      expect(saved.statusCode).toBe(202);
      expect(saved.json()).toMatchObject({ revision: 2, scenarioDrafts: [{ draftId: "draft-a", status: "saved" }] });
      const promotionCommand = { contractVersion: "f8-session-command-v1", sessionId, commandId: "promote-draft", expectedRevision: 2, command: "confirm_what_if_tolerance_promotion", payload: { draftId: "draft-a", confirmed: true } };
      const promoted = await server.inject({ method: "POST", url: `/api/sessions/${sessionId}/commands`, headers: browser.headers, payload: promotionCommand });
      expect(promoted.statusCode).toBe(202);
      expect(promoted.json()).toMatchObject({ revision: 3, scenarioDrafts: [{ status: "promoted_to_f6_targets", promotionPreview }] });
      const replayed = await server.inject({ method: "POST", url: `/api/sessions/${sessionId}/commands`, headers: browser.headers, payload: promotionCommand });
      expect(replayed.statusCode).toBe(202);
      expect(replayed.json()).toEqual(promoted.json());
      expect(whatIfService.calculate).toHaveBeenCalledTimes(2);
      expect(whatIfService.calculate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tableId: "table-a", sourceRow: 2 }));
      expect(whatIfService.createPromotionPreview).toHaveBeenCalledOnce();
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("registers structured F4/F5/F6 results under one durable review context", async () => {
    const rootDir = testRoot("workbench-server-review-context-registration");
    await rm(rootDir, { recursive: true, force: true });
    const runner = vi.fn(async (job: { readonly stage: string }) => {
      const result = job.stage === "f4_running"
        ? structuredReviewResult("F4", false)
        : job.stage === "f5_running"
          ? structuredReviewResult("F5")
          : job.stage === "f6_running"
            ? structuredReviewResult("F6")
            : { status: "completed", artifactReferences: [] };
      await Promise.all((result.artifactReferences ?? []).map(async (artifact) => {
        const target = join(rootDir, artifact.relativePath);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, JSON.stringify({ artifactId: artifact.artifactId }));
      }));
      if (job.stage === "f4_running") return structuredReviewResult("F4", false);
      if (job.stage === "f5_running") return structuredReviewResult("F5");
      if (job.stage === "f6_running") return structuredReviewResult("F6");
      return { status: "completed" };
    });
    const server = await buildWorkbenchServer({ rootDir, runner, queueFactory: immediateQueue, skipWebAssets: true });
    const sessionId = "30303030-3030-4303-8303-303030303030";
    try {
      const browser = await server.testAuthenticate(sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "seed-f4",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot: {
            ...snapshot,
            revision: snapshot.revision + 1,
            inputRevision: 1,
            state: "failed",
            downstreamScopeSelection: {
              workbookContentHash: REVIEW_CONTEXT.workbookHash,
              selectedWorksheetNames: ["Analysis-A"],
              confirmed: true,
            },
            priorRunReferences: [{ featureId: "F2", referenceId: "f2-run-2026-08-25", contractVersion: "v1", workbookHash: REVIEW_CONTEXT.workbookHash, runReference: REVIEW_CONTEXT.baselineRunReference }],
            activeAttempt: { attemptId: "seed-f4:f4_running", stage: "f4_running", status: "failed", startedAt: "2026-08-25T00:00:00.000Z", endedAt: "2026-08-25T00:00:01.000Z" },
          },
        }));
      } finally {
        await store.close();
      }

      let expectedRevision = 1;
      const submit = async (commandId: string, command: string, payload: Record<string, unknown>) => {
        const response = await server.inject({
          method: "POST",
          url: `/api/sessions/${sessionId}/commands`,
          headers: browser.headers,
          payload: { contractVersion: "f8-session-command-v1", sessionId, commandId, expectedRevision, command, payload },
        });
        if (response.statusCode === 202) expectedRevision = response.json<{ revision: number }>().revision;
        return response;
      };

      expect((await submit("run-f4", "retry", { stage: "f4_running" })).statusCode).toBe(202);
      const f5Response = await submit("run-f5", "confirm_image_decision", { decision: "not_evaluated" });
      expect(f5Response.statusCode).toBe(202);
      expect((await submit("skip-context", "confirm_analysis_context", { decision: "not_provided" })).statusCode).toBe(202);
      expect((await submit("run-f6", "confirm_optimization_targets", { decision: "not_provided" })).statusCode).toBe(202);

      const reopened = await openSessionStore({ rootDir, sessionId });
      try {
        const snapshot = await reopened.readSnapshot();
        const f4Reference = await reopened.readArtifactReference("f4-calculation");
        expect(snapshot.state).toBe("review_required");
        expect(snapshot.artifactRefs?.map((artifact) => artifact.revision)).toEqual([1, 1, 1, 1]);
        expect(f4Reference?.metadata?.reviewContext).toEqual(REVIEW_CONTEXT);
        expect(selectCompleteReviewContext(snapshot)?.reviewContextId).toMatch(/^[a-f0-9]{64}$/);
        expect(projectWorksheetReview({ sessionId, snapshot, f4Report: { calculations: [] }, f5Report: { worksheets: [] }, f6Report: { worksheets: [] } }, "Analysis-A").worksheets).toHaveLength(1);
      } finally {
        await reopened.close();
      }
      expect(runner.mock.calls.map(([job]) => job.stage)).toEqual(["f4_running", "f5_running", "f6_running"]);
      expect(runner.mock.calls.map(([job]) => job.payload)).toEqual([
        { sessionId, baselineRunReference: REVIEW_CONTEXT.baselineRunReference },
        { sessionId, reviewContext: REVIEW_CONTEXT },
        { sessionId, reviewContext: REVIEW_CONTEXT },
      ]);
      const artifactResponse = await server.inject({
        method: "GET",
        url: `/api/sessions/${sessionId}/artifacts/f4-calculation`,
        headers: browser.headers,
      });
      expect({ statusCode: artifactResponse.statusCode, payload: artifactResponse.payload }).toEqual({
        statusCode: 200,
        payload: JSON.stringify({ artifactId: "f4-calculation" }),
      });
      expect(artifactResponse.json()).toEqual({ artifactId: "f4-calculation" });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("fails closed when current F4 artifacts contain ambiguous review contexts", async () => {
    const rootDir = testRoot("workbench-server-ambiguous-f4-context");
    await rm(rootDir, { recursive: true, force: true });
    const runner = vi.fn(async () => structuredReviewResult("F5"));
    const server = await buildWorkbenchServer({ rootDir, runner, queueFactory: immediateQueue, skipWebAssets: true });
    const sessionId = "32323232-3232-4323-8323-323232323232";
    try {
      const browser = await server.testAuthenticate(sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "seed-ambiguous-f4",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot: {
            ...snapshot,
            revision: 1,
            inputRevision: 1,
            state: "image_decision_required",
            downstreamScopeSelection: { workbookContentHash: REVIEW_CONTEXT.workbookHash, selectedWorksheetNames: ["Analysis-A"], confirmed: true },
            priorRunReferences: [{ featureId: "F2", referenceId: "f2-run-2026-08-25", contractVersion: "v1", workbookHash: REVIEW_CONTEXT.workbookHash, runReference: REVIEW_CONTEXT.baselineRunReference }],
            activeAttempt: null,
          },
          artifactReferenceOps: {
            upsert: [
              { artifactId: "f4-current", sessionId, inputRevision: 1, kind: "f4_calculation", relativePath: "f4/current.json", reviewContext: REVIEW_CONTEXT },
              { artifactId: "f4-conflict", sessionId, inputRevision: 1, kind: "f4_calculation", relativePath: "f4/conflict.json", reviewContext: { ...REVIEW_CONTEXT, baselineRunReference: "f2-run-other" } },
            ],
          },
        }));
      } finally {
        await store.close();
      }

      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${sessionId}/commands`,
        headers: browser.headers,
        payload: { contractVersion: "f8-session-command-v1", sessionId, commandId: "run-f5-ambiguous", expectedRevision: 1, command: "confirm_image_decision", payload: { decision: "not_evaluated" } },
      });
      expect(response.statusCode).toBe(409);
      const reopened = await openSessionStore({ rootDir, sessionId });
      try {
        expect(await reopened.readArtifactReference("f5-report")).toBeUndefined();
      } finally {
        await reopened.close();
      }
      expect(runner).not.toHaveBeenCalled();
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it.each([
    ["missing F2 lineage", { featureId: "F4", status: "completed", artifactReferences: structuredReviewResult("F4").artifactReferences }, false],
    ["missing artifact references", { featureId: "F4", status: "completed", reviewContext: REVIEW_CONTEXT }, true],
    ["mismatched workbook", { ...structuredReviewResult("F4"), reviewContext: { ...REVIEW_CONTEXT, workbookHash: "b".repeat(64) } }, true],
    ["mismatched worksheet selection", { ...structuredReviewResult("F4"), reviewContext: { ...REVIEW_CONTEXT, downstreamSelectionHash: "b".repeat(64) } }, true],
    ["mismatched baseline run", { ...structuredReviewResult("F4"), reviewContext: { ...REVIEW_CONTEXT, baselineRunReference: "f2-run-other" } }, true],
  ])("fails %s producer results with evidence_mismatch and registers no artifacts", async (_name, runnerResult, seedF2Lineage) => {
    const rootDir = testRoot("workbench-server-invalid-review-producer");
    await rm(rootDir, { recursive: true, force: true });
    const sessionId = "31313131-3131-4313-8313-313131313131";
    const server = await buildWorkbenchServer({ rootDir, runner: async () => runnerResult, queueFactory: immediateQueue, skipWebAssets: true });
    try {
      const browser = await server.testAuthenticate(sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "seed-invalid-producer",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot: {
            ...snapshot,
            revision: snapshot.revision + 1,
            inputRevision: 1,
            state: "failed",
            downstreamScopeSelection: {
              workbookContentHash: REVIEW_CONTEXT.workbookHash,
              selectedWorksheetNames: ["Analysis-A"],
              confirmed: true,
            },
            priorRunReferences: seedF2Lineage
              ? [{ featureId: "F2", referenceId: "f2-run-2026-08-25", contractVersion: "v1", workbookHash: REVIEW_CONTEXT.workbookHash, runReference: REVIEW_CONTEXT.baselineRunReference }]
              : [],
            activeAttempt: { attemptId: "seed-invalid-producer:f4_running", stage: "f4_running", status: "failed", startedAt: "2026-08-25T00:00:00.000Z", endedAt: "2026-08-25T00:00:01.000Z" },
          },
        }));
      } finally {
        await store.close();
      }
      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${sessionId}/commands`,
        headers: browser.headers,
        payload: { contractVersion: "f8-session-command-v1", sessionId, commandId: "run-invalid-producer", expectedRevision: 1, command: "retry", payload: { stage: "f4_running" } },
      });
      if (seedF2Lineage) {
        expect(response.statusCode).toBe(202);
        expect(response.json()).toMatchObject({ state: "failed", activeAttempt: { status: "failed" } });
      } else {
        expect(response.statusCode).toBe(409);
      }
      const reopened = await openSessionStore({ rootDir, sessionId });
      try {
        const snapshot = await reopened.readSnapshot();
        expect(snapshot.artifactRefs).toBeUndefined();
      } finally {
        await reopened.close();
      }
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("exchanges a one-time bootstrap nonce for a browser cookie and CSRF-protected session", async () => {
    const rootDir = testRoot("workbench-server-bootstrap-session");
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const nonce = await server.bootstrap.issueBrowserBootstrap();
      const bootstrap = await server.inject({ method: "POST", url: "/api/bootstrap", payload: { nonce } });
      const cookie = bootstrap.headers["set-cookie"];

      expect(bootstrap.statusCode).toBe(204);
      expect(cookie).toContain("HttpOnly");
      expect((await server.inject({ method: "POST", url: "/api/bootstrap", payload: { nonce } })).statusCode).toBe(401);
      const csrf = await server.inject({ method: "GET", url: "/api/csrf", headers: { host: "127.0.0.1:0", cookie } });
      expect(csrf.statusCode).toBe(200);
      const created = await server.inject({
        method: "POST",
        url: "/api/sessions",
        headers: { host: "127.0.0.1:0", cookie, "x-csrf-token": csrf.json<{ csrfToken: string }>().csrfToken },
      });
      expect(created.statusCode).toBe(201);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("serves only the configured built workbench assets after bootstrap", async () => {
    const rootDir = testRoot("workbench-server-web-assets");
    const webAssetsRoot = join(rootDir, "web-assets");
    await rm(rootDir, { recursive: true, force: true });
    await mkdir(webAssetsRoot, { recursive: true });
    await Promise.all([
      writeFile(join(webAssetsRoot, "workbench.js"), "export {}\n"),
      writeFile(join(webAssetsRoot, "workbench.css"), "body {}\n"),
    ]);
    const server = await buildWorkbenchServer({ rootDir, webAssetsRoot });
    try {
      expect((await server.inject({ method: "GET", url: "/" })).body).toContain('id="app"');
      expect((await server.inject({ method: "GET", url: "/" })).body).toContain('src="/bootstrap.js"');
      expect((await server.inject({ method: "GET", url: "/workbench.js" })).body).toBe("export {}\n");
      expect((await server.inject({ method: "GET", url: "/workbench.css" })).body).toBe("body {}\n");
      await rm(join(webAssetsRoot, "workbench.css"));
      const missingAsset = await server.inject({ method: "GET", url: "/workbench.css" });
      expect(missingAsset.statusCode, missingAsset.body).toBe(503);
      expect((await server.inject({ method: "GET", url: "/assets/unknown.js" })).statusCode).toBe(404);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("serves the package-local bundle from a built server fixture with stable content types and hashes", async () => {
    const rootDir = testRoot("workbench-server-package-assets");
    const fixturePackageRoot = join(rootDir, "package");
    const fixtureDistRoot = join(fixturePackageRoot, "dist");
    const fixtureAssetsRoot = join(fixturePackageRoot, "assets", "workbench");
    const sourcePackageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
    await mkdir(fixtureDistRoot, { recursive: true });
    await Promise.all([
      cp(join(sourcePackageRoot, "dist"), fixtureDistRoot, { recursive: true }),
      cp(join(sourcePackageRoot, "src"), join(fixturePackageRoot, "src"), { recursive: true }),
    ]);
    await mkdir(fixtureAssetsRoot, { recursive: true });
    await Promise.all([
      writeFile(join(fixtureAssetsRoot, "workbench.js"), "export const fixture = true;\n"),
      writeFile(join(fixtureAssetsRoot, "workbench.css"), ":root { color: #111; }\n"),
    ]);
    const { buildWorkbenchServer: buildFixtureServer } = await import(`${pathToFileURL(join(fixtureDistRoot, "server.js")).href}?fixture=${randomUUID()}`);
    const server = await buildFixtureServer({ rootDir });
    try {
      const script = await server.inject({ method: "GET", url: "/workbench.js" });
      const stylesheet = await server.inject({ method: "GET", url: "/workbench.css" });

      expect(script.statusCode).toBe(200);
      expect(script.headers["content-type"]).toContain("application/javascript");
      expect(createHash("sha256").update(script.body).digest("hex")).toBe(createHash("sha256").update(await readFile(join(fixtureAssetsRoot, "workbench.js"))).digest("hex"));
      expect(stylesheet.statusCode).toBe(200);
      expect(stylesheet.headers["content-type"]).toContain("text/css");
      expect(createHash("sha256").update(stylesheet.body).digest("hex")).toBe(createHash("sha256").update(await readFile(join(fixtureAssetsRoot, "workbench.css"))).digest("hex"));
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("returns CSRF only to the authenticated browser session", async () => {
    const rootDir = testRoot("workbench-server-csrf");
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const auth = await server.testAuthenticate();

      const response = await server.inject({ method: "GET", url: "/api/csrf", headers: { host: "127.0.0.1:0", cookie: auth.headers.cookie } });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ csrfToken: auth.csrfToken });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("reconciles a default runner dependency failure after committing the active attempt", async () => {
    const rootDir = testRoot("workbench-server-default-queue");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const auth = await server.testAuthenticate("12121212-1212-4212-8212-121212121212");
      const artifactId = "managed-workbook";
      server.registerArtifactForTest(auth.sessionId, artifactId, `uploads/${auth.sessionId}/workbook/${artifactId}-book.xlsx`, "book.xlsx", "confidential", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      const workbookPath = join(rootDir, `uploads/${auth.sessionId}/workbook/${artifactId}-book.xlsx`);
      await mkdir(dirname(workbookPath), { recursive: true });
      await writeFile(workbookPath, Buffer.from([80, 75, 3, 4]));
      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${auth.sessionId}/commands`,
        headers: auth.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: auth.sessionId,
          commandId: "missing-runner-upload",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { artifactId, inputClassification: "confidential" },
        },
      });

      expect(response.statusCode).toBe(202);
      expect(response.json()).toMatchObject({ state: "failed", activeAttempt: { status: "failed" } });
      expect(response.json()).not.toMatchObject({ state: "completed" });
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("keeps create/use ADO decisions pending for Task 13 Surface validation and independent Confirm write", async () => {
    const rootDir = testRoot("workbench-server-ado-host-action");
    await rm(rootDir, { recursive: true, force: true });
    const prepareRequest = { mode: "create" as const, title: "TA Drawing Governance", nextContent: "governed reminder", factorCount: 2 };
    const runner = vi.fn(async () => ({ status: "worker-ran" }));
    const server = await buildWorkbenchServer({ rootDir, runner, surfacePrepareService: { create: async () => prepareRequest } });
    try {
      const browser = await server.testAuthenticate("28282828-2828-4282-8282-282828282828");
      const session = await (await import("@ai-assist/workbench")).openSessionStore({ rootDir, sessionId: browser.sessionId });
      try {
        await session.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId: browser.sessionId,
          commandId: "seed-ado-decision",
          expectedRevision: 0,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({ snapshot: {
          ...snapshot,
          state: "ado_decision_required",
          revision: snapshot.revision + 1,
          activeAttempt: null,
          downstreamScopeSelection: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["Analysis-A"], confirmed: true },
          priorRunReferences: [{ featureId: "F2", referenceId: "f2-run-a", contractVersion: "v1", workbookHash: "a".repeat(64), runReference: "f2-baseline-a" }],
        } }));
      } finally {
        await session.close();
      }
      const snapshot = (await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}`, headers: browser.headers })).json<{ revision: number }>();
      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/commands`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-session-command-v1",
          sessionId: browser.sessionId,
          commandId: "request-ado-validation",
          expectedRevision: snapshot.revision,
          command: "confirm_ado_decision",
          payload: { decision: "create_new" },
        },
      });

      expect(response.statusCode).toBe(202);
      expect(response.json()).toMatchObject({ state: "ado_action_pending", activeAttempt: null });
      // Task 10 only projects the action; Task 13 owns Surface validation and the separate Confirm write.
      expect(response.json()).not.toMatchObject({ state: "f4_running" });
      const actionId = `ado-validation:${browser.sessionId}:${response.json<{ revision: number }>().revision}`;
      const token = server.issueHostBearer(browser.sessionId, ["host-actions:claim"], { actionId, hostInstanceId: "host-a" });
      const claimResponse = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/${actionId}/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${token}` },
        payload: { hostInstanceId: "host-a" },
      });
      expect(claimResponse.statusCode).toBe(200);
      expect(claimResponse.json()).toMatchObject({ request: { kind: "surface_validate", prepareRequest } });
      const validationClaim = claimResponse.json<{ leaseId: string }>();
      const missingOutcomePayload = { status: "completed" as const };
      const validationResultToken = server.issueHostBearer(browser.sessionId, ["host-actions:result"], { actionId, hostInstanceId: "host-a" });
      expect((await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${actionId}/result`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${validationResultToken}` }, payload: { contractVersion: "f8-host-action-result-v1", actionId, hostInstanceId: "host-a", leaseId: validationClaim.leaseId, status: "completed", resultHash: createHash("sha256").update(JSON.stringify(missingOutcomePayload)).digest("hex"), payload: missingOutcomePayload } })).statusCode).toBe(400);
      const confirmationHash = createHash("sha256").update(JSON.stringify(["WI-1", "C0", "1", prepareRequest.nextContent])).digest("hex");
      const confirmation = {
        status: "confirmation_required", workItemReference: "WI-1", ownerReference: "owner-1", commentReference: "C0", expectedVersion: "1",
        beforeContentHash: "b".repeat(64), nextContent: prepareRequest.nextContent, factorCount: prepareRequest.factorCount,
        confirmationHash, diff: [{ before: "before", after: prepareRequest.nextContent, changed: true }],
      } as const;
      const validationPayload = { status: "completed" as const, outcome: { kind: "surface_validation" as const, confirmation } };
      expect((await server.inject({
        method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${actionId}/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${validationResultToken}` },
        payload: { contractVersion: "f8-host-action-result-v1", actionId, hostInstanceId: "host-a", leaseId: validationClaim.leaseId, status: "completed", resultHash: createHash("sha256").update(JSON.stringify(validationPayload)).digest("hex"), payload: validationPayload },
      })).statusCode).toBe(204);
      expect((await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}`, headers: browser.headers })).json()).toMatchObject({ state: "ado_action_pending" });

      const writeActionId = `ado-write:${browser.sessionId}:${response.json<{ revision: number }>().revision}`;
      const writeClaimToken = server.issueHostBearer(browser.sessionId, ["host-actions:claim"], { actionId: writeActionId, hostInstanceId: "host-a" });
      const writeClaimResponse = await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${writeActionId}/claim`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${writeClaimToken}` }, payload: { hostInstanceId: "host-a" } });
      expect(writeClaimResponse.statusCode).toBe(200);
      expect(writeClaimResponse.json()).toMatchObject({ request: { kind: "surface_write", validationActionId: actionId, confirmation } });
      const writePayload = { status: "completed" as const, outcome: { kind: "surface_write" as const, receipt: { status: "updated" as const, workItemReference: "WI-1", commentReference: "C0", version: "2", contentHash: createHash("sha256").update(prepareRequest.nextContent).digest("hex") } } };
      const writeResultToken = server.issueHostBearer(browser.sessionId, ["host-actions:result"], { actionId: writeActionId, hostInstanceId: "host-a" });
      expect((await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions/${writeActionId}/result`, headers: { host: "127.0.0.1:0", authorization: `Bearer ${writeResultToken}` }, payload: { contractVersion: "f8-host-action-result-v1", actionId: writeActionId, hostInstanceId: "host-a", leaseId: writeClaimResponse.json<{ leaseId: string }>().leaseId, status: "completed", resultHash: createHash("sha256").update(JSON.stringify(writePayload)).digest("hex"), payload: writePayload } })).statusCode).toBe(204);
      expect((await server.inject({ method: "GET", url: `/api/sessions/${browser.sessionId}`, headers: browser.headers })).json()).toMatchObject({ state: "image_decision_required", activeAttempt: null });
      expect(runner).toHaveBeenCalledOnce();
      expect(runner).toHaveBeenCalledWith(expect.objectContaining({ stage: "f4_running" }));
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("requires scoped host bearer credentials for host action claim and result", async () => {
    const rootDir = testRoot("workbench-server-host-actions");
    await rm(rootDir, { recursive: true, force: true });
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const browser = await server.testAuthenticate("11111111-1111-4111-8111-111111111111");
      const request = {
        contractVersion: "f8-host-action-request-v1",
        actionId: "action-1",
        sessionId: browser.sessionId,
        expectedRevision: 0,
        kind: "model_request",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
      expect((await server.inject({ method: "POST", url: `/api/sessions/${browser.sessionId}/host-actions`, headers: browser.headers, payload: request })).statusCode).toBe(201);

      const wrongToken = server.issueHostBearer(browser.sessionId, ["host-actions:read"]);
      expect((await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-1/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${wrongToken}` },
        payload: { hostInstanceId: "host-a" },
      })).statusCode).toBe(403);

      const claimToken = server.issueHostBearer(browser.sessionId, ["host-actions:claim"], { actionId: "action-1", hostInstanceId: "host-a" });
      const claimResponse = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-1/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${claimToken}` },
        payload: { hostInstanceId: "host-a" },
      });
      expect(claimResponse.statusCode).toBe(200);
      const claim = claimResponse.json<{ leaseId: string }>();

      const resultToken = server.issueHostBearer(browser.sessionId, ["host-actions:result"], { actionId: "action-1", hostInstanceId: "host-a" });
      const payload = { status: "completed" };
      const resultResponse = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-1/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${resultToken}` },
        payload: {
          contractVersion: "f8-host-action-result-v1",
          actionId: "action-1",
          hostInstanceId: "host-a",
          leaseId: claim.leaseId,
          status: "completed",
          resultHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
          payload,
        },
      });

      expect(resultResponse.statusCode).toBe(204);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects host action results whose hash does not match the result payload", async () => {
    const rootDir = testRoot("workbench-server-host-action-hash");
    const server = await buildWorkbenchServer({ rootDir });
    try {
      const browser = await server.testAuthenticate("22222222-2222-4222-8222-222222222222");
      await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions`,
        headers: browser.headers,
        payload: {
          contractVersion: "f8-host-action-request-v1",
          actionId: "action-2",
          sessionId: browser.sessionId,
          expectedRevision: 0,
          kind: "model_request",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      });
      const claimToken = server.issueHostBearer(browser.sessionId, ["host-actions:claim"], { actionId: "action-2", hostInstanceId: "host-a" });
      const claim = (await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-2/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${claimToken}` },
        payload: { hostInstanceId: "host-a" },
      })).json<{ leaseId: string }>();

      const resultToken = server.issueHostBearer(browser.sessionId, ["host-actions:result"], { actionId: "action-2", hostInstanceId: "host-a" });
      const response = await server.inject({
        method: "POST",
        url: `/api/sessions/${browser.sessionId}/host-actions/action-2/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${resultToken}` },
        payload: {
          contractVersion: "f8-host-action-result-v1",
          actionId: "action-2",
          hostInstanceId: "host-a",
          leaseId: claim.leaseId,
          status: "completed",
          resultHash: "0".repeat(64),
          payload: { status: "completed" },
        },
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects duplicate host action IDs in the same or another session without replacing terminal state", async () => {
    const rootDir = testRoot("workbench-server-durable-host-actions");
    await rm(rootDir, { recursive: true, force: true });
    const first = await buildWorkbenchServer({ rootDir });
    const firstSessionId = "23232323-2323-4232-8232-232323232323";
    const secondSessionId = "24242424-2424-4242-8242-242424242424";
    try {
      const firstBrowser = await first.testAuthenticate(firstSessionId);
      const secondBrowser = await first.testAuthenticate(secondSessionId);
      const create = async (browser: typeof firstBrowser) => first.inject({
          method: "POST",
          url: `/api/sessions/${browser.sessionId}/host-actions`,
          headers: browser.headers,
          payload: {
            contractVersion: "f8-host-action-request-v1",
            actionId: "shared-action",
            sessionId: browser.sessionId,
            expectedRevision: 0,
            kind: "model_request",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          },
        });
      expect((await create(firstBrowser)).statusCode).toBe(201);
      expect((await create(firstBrowser)).statusCode).toBe(409);
      expect((await create(secondBrowser)).statusCode).toBe(409);

      const claimToken = first.issueHostBearer(firstSessionId, ["host-actions:claim"], { actionId: "shared-action", hostInstanceId: "host-a" });
      const claimResponse = await first.inject({
        method: "POST",
        url: `/api/sessions/${firstSessionId}/host-actions/shared-action/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${claimToken}` },
        payload: { hostInstanceId: "host-a" },
      });
      expect(claimResponse.statusCode).toBe(200);
      const claim = claimResponse.json<{ leaseId: string }>();
      const resultToken = first.issueHostBearer(firstSessionId, ["host-actions:result"], { actionId: "shared-action", hostInstanceId: "host-a" });
      const payload = { status: "completed" };
      expect((await first.inject({
        method: "POST",
        url: `/api/sessions/${firstSessionId}/host-actions/shared-action/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${resultToken}` },
        payload: {
          contractVersion: "f8-host-action-result-v1",
          actionId: "shared-action",
          hostInstanceId: "host-a",
          leaseId: claim.leaseId,
          status: "completed",
          resultHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
          payload,
        },
      })).statusCode).toBe(204);
      expect((await create(firstBrowser)).statusCode).toBe(409);
    } finally {
      await first.close();
    }

    const second = await buildWorkbenchServer({ rootDir });
    try {
      const replayToken = second.issueHostBearer(firstSessionId, ["host-actions:claim"], { actionId: "shared-action", hostInstanceId: "host-a" });
      expect((await second.inject({
        method: "POST",
        url: `/api/sessions/${firstSessionId}/host-actions/shared-action/claim`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${replayToken}` },
        payload: { hostInstanceId: "host-a" },
      })).statusCode).toBe(409);

      const replayResultToken = second.issueHostBearer(firstSessionId, ["host-actions:result"], { actionId: "shared-action", hostInstanceId: "host-a" });
      expect((await second.inject({
        method: "POST",
        url: `/api/sessions/${firstSessionId}/host-actions/shared-action/result`,
        headers: { host: "127.0.0.1:0", authorization: `Bearer ${replayResultToken}` },
        payload: {},
      })).statusCode).toBe(400);
    } finally {
      await second.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("keeps event IDs monotonic after retention rollover and marks an expired replay cursor", async () => {
    const rootDir = testRoot("workbench-server-event-rollover");
    await rm(rootDir, { recursive: true, force: true });
    const started = await (await import("./server.js")).startWorkbenchServer({ rootDir });
    try {
      const auth = await started.server.testAuthenticate("25252525-2525-4252-8252-252525252525");
      for (let index = 1; index <= 301; index += 1) {
        started.server.publishEventForTest(auth.sessionId, "progress", { index });
      }

      const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
        const request = get(`${started.url.replace(/\/#.*$/, "")}/api/sessions/${auth.sessionId}/events`, {
          headers: { cookie: auth.headers.cookie, "last-event-id": "1" },
        }, resolve);
        request.once("error", reject);
      });
      let stream = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { stream += chunk; });
      await vi.waitFor(() => {
        expect(stream).toContain("event: replay_truncated");
        expect(stream).toContain("id: 301");
      });

      started.server.publishEventForTest(auth.sessionId, "progress", { index: 302 });
      await vi.waitFor(() => expect(stream).toContain("id: 302"));
      response.destroy();
    } finally {
      started.server.server.closeAllConnections();
      await started.server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("replays persisted session events after a new server instance starts", async () => {
    const rootDir = testRoot("workbench-server-event-restart");
    const sessionId = "26262626-2626-4262-8262-262626262626";
    await rm(rootDir, { recursive: true, force: true });
    const first = await (await import("./server.js")).startWorkbenchServer({ rootDir });
    try {
      const auth = await first.server.testAuthenticate(sessionId);
      first.server.publishEventForTest(auth.sessionId, "progress", { sequence: 1 });
      first.server.publishEventForTest(auth.sessionId, "progress", { sequence: 2 });
    } finally {
      first.server.server.closeAllConnections();
      await first.server.close();
    }

    const second = await (await import("./server.js")).startWorkbenchServer({ rootDir });
    try {
      const auth = await second.server.testAuthenticate(sessionId);
      const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
        const request = get(`${second.url.replace(/\/#.*$/, "")}/api/sessions/${sessionId}/events`, {
          headers: { cookie: auth.headers.cookie, "last-event-id": "1" },
        }, resolve);
        request.once("error", reject);
      });
      let stream = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { stream += chunk; });
      await vi.waitFor(() => expect(stream).toContain("id: 2"));
      expect(stream).toContain('data: {"sequence":2}');
      response.destroy();
    } finally {
      second.server.server.closeAllConnections();
      await second.server.close();
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});