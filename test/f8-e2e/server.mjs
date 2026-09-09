import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { f2UserReportSchema, f4WorkflowCalculationResultSchema, hostActionResultSchema, hostActionRequestSchema } from "@ai-assist/contracts";
import { createConversationStore } from "@ai-assist/conversation";
import { createCalculation } from "@ai-assist/workbook-catalog";
import { acceptAttemptResult, createHostActionStore, openSessionStore, reduceSessionCommand } from "@ai-assist/workbench";
import { renderF3AdoMarkdown } from "@ai-assist/workflow-runners";
import { startWorkbenchServer } from "@ai-assist/workbench-server";
import { createF6ArtifactBundleFixture } from "../../scripts/f6-artifact-test-fixture.mjs";

const SESSION_ID = "40404040-4040-4404-8404-404040404040";
const ADO_SELECTION_SESSION_ID = "50505050-5050-4505-8505-505050505050";
const ADO_CREATE_PREVIEW_SESSION_ID = "60606060-6060-4606-8606-606060606060";
const ADO_UPDATE_PREVIEW_SESSION_ID = "70707070-7070-4707-8707-707070707070";
const PRODUCT_EXPORT_FAILED_SESSION_ID = "80808080-8080-4808-8808-808080808080";
const F6_CHAT_INPUT_SESSION_ID = "90909090-9090-4909-8909-909090909090";
const MULTIMODAL_SESSION_ID = "31313131-3131-4313-8313-313131313131";
const MODEL_UNAVAILABLE_SESSION_ID = "32323232-3232-4323-8323-323232323232";
const AMBIGUOUS_MAPPING_SESSION_ID = "33333333-3333-4333-8333-333333333333";
const isMultimodalSession = (sessionId) => [MULTIMODAL_SESSION_ID, MODEL_UNAVAILABLE_SESSION_ID, AMBIGUOUS_MAPPING_SESSION_ID].includes(sessionId);
const sourceWorkbookPath = "test/f8-e2e/fixtures/anonymous-ta-workbook.xlsx";
const sourceWorkbookBytes = await readFile(sourceWorkbookPath);
const HASH = createHash("sha256").update(sourceWorkbookBytes).digest("hex");
const rootDir = join(".tmp", `f8-e2e-${randomUUID()}`);
const f1Bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
const f1ContentHash = createHash("sha256").update(f1Bytes).digest("hex");
const f1RelativePath = "e2e/f1.png";
const f1BRelativePath = "e2e/f1-b.png";
const f1BBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBgN2XxQAAAABJRU5ErkJggg==", "base64");
const f1BContentHash = createHash("sha256").update(f1BBytes).digest("hex");
const f3RelativePath = "e2e/f3.json";
const f3AdoReminderRelativePath = "e2e/Feature3-ADO-Reminder.json";
const f5RelativePath = "e2e/f5.json";
const f6ReportRelativePath = "e2e/f6-report.json";
const workbookUploadRelativePath = "e2e/upload-workbook.bytes";
const longWorkbookFileName = "anonymous-ta-workbook-very-long-governed-ui-filename-for-layout-overlap-validation-2026-09-01.xlsx";
const downstreamFixture = createF6ArtifactBundleFixture({ worksheetNames: ["AJ_GAP"] });
const calculatedDraft = {
  contractVersion: "f8-scenario-draft-v1", draftId: "e2e-draft", sessionId: SESSION_ID, worksheetName: "AJ_GAP", inputRevision: 1, status: "calculated", mode: "WHAT_IF",
  baselineWorkbookHash: HASH, baselineRunReference: "run-1", change: { upperTolerance: 0.04 }, calculationReference: "what-if:e2e-draft",
  calculationMetrics: { mean: 0, rssSigma: 0.018, cp: 1.7, cpkL: 1.6, cpkU: 1.8, cpk: 1.6, statisticalMargin: 0.1, worstCaseMargin: 0.05 },
  factorIdentity: { worksheetName: "AJ_GAP", tableId: "table-a", sourceRow: 2, factorName: "AJ center to C-bucket", unit: "mm" },
};
await rm(rootDir, { recursive: true, force: true });
const interactionLanguage = { languageTag: "en-US", uiCatalogLanguage: "en", lockedAtTurnId: "turn-en", source: "workflow_start", fallbackUsed: false };
const started = await startWorkbenchServer({ rootDir, port: 0, interactionLanguage, runner: runSeededAttempt, whatIfService: { calculate: async () => calculatedDraft, createPromotionPreview: async () => { throw new Error("not used"); } } });
const apiOrigin = new URL(started.url).origin;
const auth = await started.server.testAuthenticate(SESSION_ID);
const adoSelectionAuth = await started.server.testAuthenticate(ADO_SELECTION_SESSION_ID);
const adoCreatePreviewAuth = await started.server.testAuthenticate(ADO_CREATE_PREVIEW_SESSION_ID);
const adoUpdatePreviewAuth = await started.server.testAuthenticate(ADO_UPDATE_PREVIEW_SESSION_ID);
const productExportFailedAuth = await started.server.testAuthenticate(PRODUCT_EXPORT_FAILED_SESSION_ID);
const f6ChatInputAuth = await started.server.testAuthenticate(F6_CHAT_INPUT_SESSION_ID);
const multimodalAuth = await started.server.testAuthenticate(MULTIMODAL_SESSION_ID);
const modelUnavailableAuth = await started.server.testAuthenticate(MODEL_UNAVAILABLE_SESSION_ID);
const ambiguousMappingAuth = await started.server.testAuthenticate(AMBIGUOUS_MAPPING_SESSION_ID);
const f2Report = buildF2Report();
const multimodalF2Report = buildF2Report({ includeBStack: true, englishFactorIdentity: true });
const f3Report = buildF3Report();
const multimodalF3Report = buildF3Report({ includeBStack: true });
const f3AdoReminder = renderF3AdoMarkdown(f3Report);
const f4Report = buildF4Report();
const multimodalF4Report = buildMultimodalF4Report(f4Report);
const f2RelativePath = "e2e/f2.json";
const f4RelativePath = "e2e/f4.json";
const multimodalF4RelativePath = "e2e/f4-multimodal.json";
const downstreamSelectionHash = createHash("sha256").update(JSON.stringify(["AJ_GAP"])).digest("hex");
const multimodalDownstreamSelectionHash = createHash("sha256").update(JSON.stringify(["AJ_GAP", "B_STACK"])).digest("hex");
await mkdir(join(rootDir, "e2e"), { recursive: true });
const f2Bytes = Buffer.from(JSON.stringify(f2Report));
const f3Bytes = Buffer.from(JSON.stringify(f3Report));
const multimodalF3Bytes = Buffer.from(JSON.stringify(multimodalF3Report));
const f3AdoReminderBytes = Buffer.from(JSON.stringify(f3AdoReminder));
const f4Bytes = Buffer.from(JSON.stringify(f4Report));
const multimodalF4Bytes = Buffer.from(JSON.stringify(multimodalF4Report));
const f5Bytes = await readFile(downstreamFixture.paths.f5);
const f6ReportBytes = Buffer.from([
  "# TA engineering review complete",
  "",
  "## Section 4 - Model interpretation and adjustment assessment",
  "- Model interpretation decision: CALLER_AUTHORIZED",
  "- F5 observation auto lineage: Feature5-Image-Observations.json",
  "- Adjustment assessment: no explicit system specification rewrite was authorized in this run.",
  "",
].join("\n"), "utf8");
const f3ContentHash = createHash("sha256").update(f3Bytes).digest("hex");
const multimodalF3ContentHash = createHash("sha256").update(multimodalF3Bytes).digest("hex");
const f4ContentHash = createHash("sha256").update(f4Bytes).digest("hex");
const multimodalF4ContentHash = createHash("sha256").update(multimodalF4Bytes).digest("hex");
const f5ContentHash = createHash("sha256").update(f5Bytes).digest("hex");
const f6ContentHash = createHash("sha256").update(f6ReportBytes).digest("hex");
const trustedF3ContentHash = createHash("sha256").update(`${JSON.stringify(f3Report)}\n`, "utf8").digest("hex");
const trustedF4ContentHash = createHash("sha256").update(`${JSON.stringify(f4Report)}\n`, "utf8").digest("hex");
const trustedF6OptimizationContentHash = createHash("sha256").update('{"status":"completed"}\n', "utf8").digest("hex");
const trustedProjectionContentHash = createHash("sha256").update(`${JSON.stringify(projectionTemplate(), null, 2)}\n`, "utf8").digest("hex");
await writeFile(join(rootDir, f2RelativePath), f2Bytes);
await writeFile(join(rootDir, f3RelativePath), f3Bytes);
await writeFile(join(rootDir, "e2e/f3-multimodal.json"), multimodalF3Bytes);
await writeFile(join(rootDir, f3AdoReminderRelativePath), f3AdoReminderBytes);
await writeFile(join(rootDir, f4RelativePath), f4Bytes);
await writeFile(join(rootDir, multimodalF4RelativePath), multimodalF4Bytes);
await writeFile(join(rootDir, f5RelativePath), f5Bytes);
await writeFile(join(rootDir, f6ReportRelativePath), f6ReportBytes);
await writeFile(join(rootDir, f1RelativePath), f1Bytes);
await writeFile(join(rootDir, f1BRelativePath), f1BBytes);
await writeFile(join(rootDir, workbookUploadRelativePath), sourceWorkbookBytes);
for (const sessionId of [SESSION_ID, ADO_SELECTION_SESSION_ID, ADO_CREATE_PREVIEW_SESSION_ID, ADO_UPDATE_PREVIEW_SESSION_ID, PRODUCT_EXPORT_FAILED_SESSION_ID, F6_CHAT_INPUT_SESSION_ID, MULTIMODAL_SESSION_ID, MODEL_UNAVAILABLE_SESSION_ID, AMBIGUOUS_MAPPING_SESSION_ID]) {
  const imageRoot = join(rootDir, "runtime", "workbench", "runner-output", sessionId, "production", "f1", "e2e");
  await mkdir(imageRoot, { recursive: true });
  await writeFile(join(imageRoot, "f1.png"), f1Bytes);
  if (isMultimodalSession(sessionId)) await writeFile(join(imageRoot, "f1-b.png"), f1BBytes);
}
for (const sessionId of [SESSION_ID, ADO_SELECTION_SESSION_ID, ADO_CREATE_PREVIEW_SESSION_ID, ADO_UPDATE_PREVIEW_SESSION_ID, PRODUCT_EXPORT_FAILED_SESSION_ID, F6_CHAT_INPUT_SESSION_ID]) {
  started.server.registerArtifactForTest(sessionId, `f1-image:${f1ContentHash}`, f1RelativePath, "f1.png", "confidential", "image/png");
}
started.server.registerArtifactForTest(MULTIMODAL_SESSION_ID, `f1-image:${f1ContentHash}`, f1RelativePath, "f1.png", "confidential", "image/png");
started.server.registerArtifactForTest(MULTIMODAL_SESSION_ID, `f1-image:${f1BContentHash}`, f1BRelativePath, "f1-b.png", "confidential", "image/png");
for (const sessionId of [MODEL_UNAVAILABLE_SESSION_ID, AMBIGUOUS_MAPPING_SESSION_ID]) {
  started.server.registerArtifactForTest(sessionId, `f1-image:${f1ContentHash}`, f1RelativePath, "f1.png", "confidential", "image/png");
  started.server.registerArtifactForTest(sessionId, `f1-image:${f1BContentHash}`, f1BRelativePath, "f1-b.png", "confidential", "image/png");
}
registerWorkbookUploadArtifact(SESSION_ID);
registerWorkbookUploadArtifact(ADO_SELECTION_SESSION_ID);
registerWorkbookUploadArtifact(ADO_CREATE_PREVIEW_SESSION_ID);
registerWorkbookUploadArtifact(ADO_UPDATE_PREVIEW_SESSION_ID);
registerWorkbookUploadArtifact(PRODUCT_EXPORT_FAILED_SESSION_ID);
registerWorkbookUploadArtifact(F6_CHAT_INPUT_SESSION_ID);
registerWorkbookUploadArtifact(MULTIMODAL_SESSION_ID);
registerWorkbookUploadArtifact(MODEL_UNAVAILABLE_SESSION_ID);
registerWorkbookUploadArtifact(AMBIGUOUS_MAPPING_SESSION_ID);
await seedReviewSession(SESSION_ID, "review_required", auth.headers.cookie);
await seedReviewSession(ADO_SELECTION_SESSION_ID, "ado_decision_required", adoSelectionAuth.headers.cookie);
await seedPreviewSession(ADO_CREATE_PREVIEW_SESSION_ID, { mode: "create", title: `[TA Requirement][Project][Phase] Update Drawing Requirements for ${f3Report.workbook.fileName}`, sponsorEmail: "sponsor@example.com" }, adoCreatePreviewAuth.headers.cookie);
await seedPreviewSession(ADO_UPDATE_PREVIEW_SESSION_ID, { mode: "existing", workItemReference: "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/42" }, adoUpdatePreviewAuth.headers.cookie);
await seedFailedExecutionSession(PRODUCT_EXPORT_FAILED_SESSION_ID, productExportFailedAuth.headers.cookie);
await seedReviewSession(F6_CHAT_INPUT_SESSION_ID, "analysis_context_decision_required", f6ChatInputAuth.headers.cookie);
await seedReviewSession(MULTIMODAL_SESSION_ID, "f5_running", multimodalAuth.headers.cookie);
await seedReviewSession(MODEL_UNAVAILABLE_SESSION_ID, "f5_running", modelUnavailableAuth.headers.cookie);
await seedReviewSession(AMBIGUOUS_MAPPING_SESSION_ID, "f5_running", ambiguousMappingAuth.headers.cookie);
registerRunnerF2Artifact(SESSION_ID);
registerRunnerF2Artifact(ADO_SELECTION_SESSION_ID);
registerRunnerF2Artifact(ADO_CREATE_PREVIEW_SESSION_ID);
registerRunnerF2Artifact(ADO_UPDATE_PREVIEW_SESSION_ID);
registerRunnerF2Artifact(PRODUCT_EXPORT_FAILED_SESSION_ID);
registerRunnerF2Artifact(F6_CHAT_INPUT_SESSION_ID);
registerRunnerF2Artifact(MULTIMODAL_SESSION_ID);
registerRunnerF2Artifact(MODEL_UNAVAILABLE_SESSION_ID);
registerRunnerF2Artifact(AMBIGUOUS_MAPPING_SESSION_ID);
started.server.registerArtifactForTest(SESSION_ID, reviewArtifactId("f2-e2e", SESSION_ID), f2RelativePath, "f2.json", "confidential", "application/json");
started.server.registerArtifactForTest(SESSION_ID, reviewArtifactId("f3-e2e", SESSION_ID), f3RelativePath, "f3.json", "confidential", "application/json");
started.server.registerArtifactForTest(SESSION_ID, trustedArtifactId("f4-calculation", SESSION_ID), trustedProductionRelativePath(SESSION_ID, "f4"), "Tolerance-Calculation.json", "confidential", "application/json");
started.server.registerArtifactForTest(SESSION_ID, reviewArtifactId("f5-e2e", SESSION_ID), f5RelativePath, "f5.json", "confidential", "application/json");
started.server.registerArtifactForTest(SESSION_ID, reviewArtifactId("f6-report-e2e", SESSION_ID), f6ReportRelativePath, "f6-report.json", "confidential", "application/json");
started.server.registerArtifactForTest(SESSION_ID, `f1-image:${f1ContentHash}`, f1RelativePath, "f1.png", "confidential", "image/png");
started.server.registerArtifactForTest(ADO_SELECTION_SESSION_ID, reviewArtifactId("f2-e2e", ADO_SELECTION_SESSION_ID), f2RelativePath, "f2.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_SELECTION_SESSION_ID, reviewArtifactId("f3-e2e", ADO_SELECTION_SESSION_ID), f3RelativePath, "f3.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_SELECTION_SESSION_ID, reviewArtifactId("f3-ado-reminder-e2e", ADO_SELECTION_SESSION_ID), f3AdoReminderRelativePath, "Feature3-ADO-Reminder.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_SELECTION_SESSION_ID, reviewArtifactId("f4-calculation", ADO_SELECTION_SESSION_ID), f4RelativePath, "f4.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_SELECTION_SESSION_ID, reviewArtifactId("f5-e2e", ADO_SELECTION_SESSION_ID), f5RelativePath, "f5.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_SELECTION_SESSION_ID, reviewArtifactId("f6-report-e2e", ADO_SELECTION_SESSION_ID), f6ReportRelativePath, "f6-report.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_SELECTION_SESSION_ID, `f1-image:${f1ContentHash}`, f1RelativePath, "f1.png", "confidential", "image/png");
started.server.registerArtifactForTest(ADO_CREATE_PREVIEW_SESSION_ID, reviewArtifactId("f2-e2e", ADO_CREATE_PREVIEW_SESSION_ID), f2RelativePath, "f2.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_CREATE_PREVIEW_SESSION_ID, reviewArtifactId("f3-e2e", ADO_CREATE_PREVIEW_SESSION_ID), f3RelativePath, "f3.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_CREATE_PREVIEW_SESSION_ID, reviewArtifactId("f4-calculation", ADO_CREATE_PREVIEW_SESSION_ID), f4RelativePath, "f4.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_CREATE_PREVIEW_SESSION_ID, reviewArtifactId("f5-e2e", ADO_CREATE_PREVIEW_SESSION_ID), f5RelativePath, "f5.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_CREATE_PREVIEW_SESSION_ID, reviewArtifactId("f6-report-e2e", ADO_CREATE_PREVIEW_SESSION_ID), f6ReportRelativePath, "f6-report.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_CREATE_PREVIEW_SESSION_ID, `f1-image:${f1ContentHash}`, f1RelativePath, "f1.png", "confidential", "image/png");
started.server.registerArtifactForTest(ADO_UPDATE_PREVIEW_SESSION_ID, reviewArtifactId("f2-e2e", ADO_UPDATE_PREVIEW_SESSION_ID), f2RelativePath, "f2.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_UPDATE_PREVIEW_SESSION_ID, reviewArtifactId("f3-e2e", ADO_UPDATE_PREVIEW_SESSION_ID), f3RelativePath, "f3.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_UPDATE_PREVIEW_SESSION_ID, reviewArtifactId("f4-calculation", ADO_UPDATE_PREVIEW_SESSION_ID), f4RelativePath, "f4.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_UPDATE_PREVIEW_SESSION_ID, reviewArtifactId("f5-e2e", ADO_UPDATE_PREVIEW_SESSION_ID), f5RelativePath, "f5.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_UPDATE_PREVIEW_SESSION_ID, reviewArtifactId("f6-report-e2e", ADO_UPDATE_PREVIEW_SESSION_ID), f6ReportRelativePath, "f6-report.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_UPDATE_PREVIEW_SESSION_ID, `f1-image:${f1ContentHash}`, f1RelativePath, "f1.png", "confidential", "image/png");
started.server.registerArtifactForTest(F6_CHAT_INPUT_SESSION_ID, reviewArtifactId("f2-e2e", F6_CHAT_INPUT_SESSION_ID), f2RelativePath, "f2.json", "confidential", "application/json");
started.server.registerArtifactForTest(F6_CHAT_INPUT_SESSION_ID, reviewArtifactId("f3-e2e", F6_CHAT_INPUT_SESSION_ID), f3RelativePath, "f3.json", "confidential", "application/json");
started.server.registerArtifactForTest(F6_CHAT_INPUT_SESSION_ID, reviewArtifactId("f4-calculation", F6_CHAT_INPUT_SESSION_ID), f4RelativePath, "f4.json", "confidential", "application/json");
started.server.registerArtifactForTest(F6_CHAT_INPUT_SESSION_ID, reviewArtifactId("f5-e2e", F6_CHAT_INPUT_SESSION_ID), f5RelativePath, "f5.json", "confidential", "application/json");
started.server.registerArtifactForTest(F6_CHAT_INPUT_SESSION_ID, `f1-image:${f1ContentHash}`, f1RelativePath, "f1.png", "confidential", "image/png");
process.stdout.write(`${JSON.stringify({ origin: new URL(started.url).origin, sessionId: SESSION_ID, rootDir })}\n`);
const close = async () => { started.server.server.closeAllConnections(); await started.server.close(); await rm(rootDir, { recursive: true, force: true }); await rm(downstreamFixture.root, { recursive: true, force: true }); process.exit(0); };
process.on("SIGTERM", () => { void close(); });
process.on("SIGINT", () => { void close(); });
process.on("message", async (message) => {
  if (message?.type === "readCookie" && typeof message.requestId === "string") {
    const sessionId = message.sessionId === ADO_SELECTION_SESSION_ID
      || message.sessionId === ADO_CREATE_PREVIEW_SESSION_ID
      || message.sessionId === ADO_UPDATE_PREVIEW_SESSION_ID
      || message.sessionId === PRODUCT_EXPORT_FAILED_SESSION_ID
      || message.sessionId === F6_CHAT_INPUT_SESSION_ID
      || message.sessionId === MULTIMODAL_SESSION_ID
      || message.sessionId === MODEL_UNAVAILABLE_SESSION_ID
      || message.sessionId === AMBIGUOUS_MAPPING_SESSION_ID
      ? message.sessionId
      : SESSION_ID;
    const cookie = sessionId === ADO_SELECTION_SESSION_ID
      ? adoSelectionAuth.headers.cookie
      : sessionId === ADO_CREATE_PREVIEW_SESSION_ID
        ? adoCreatePreviewAuth.headers.cookie
        : sessionId === ADO_UPDATE_PREVIEW_SESSION_ID
          ? adoUpdatePreviewAuth.headers.cookie
          : sessionId === PRODUCT_EXPORT_FAILED_SESSION_ID
            ? productExportFailedAuth.headers.cookie
          : sessionId === F6_CHAT_INPUT_SESSION_ID
            ? f6ChatInputAuth.headers.cookie
          : sessionId === MULTIMODAL_SESSION_ID
            ? multimodalAuth.headers.cookie
          : sessionId === MODEL_UNAVAILABLE_SESSION_ID
            ? modelUnavailableAuth.headers.cookie
          : sessionId === AMBIGUOUS_MAPPING_SESSION_ID
            ? ambiguousMappingAuth.headers.cookie
          : auth.headers.cookie;
    process.send?.({ type: "cookie", requestId: message.requestId, cookie });
    return;
  }
  if (message?.type === "issueHostBearer" && typeof message.requestId === "string") {
    const sessionId = typeof message.sessionId === "string" ? message.sessionId : SESSION_ID;
    const scopes = Array.isArray(message.scopes) ? message.scopes.filter((scope) => typeof scope === "string") : [];
    const options = {
      ...(typeof message.actionId === "string" ? { actionId: message.actionId } : {}),
      ...(typeof message.hostInstanceId === "string" ? { hostInstanceId: message.hostInstanceId } : {}),
    };
    process.send?.({ type: "hostBearer", requestId: message.requestId, token: started.server.issueHostBearer(sessionId, scopes, options) });
    return;
  }
  if (message?.type === "seedConversationTurn" && typeof message.requestId === "string") {
    const sessionId = typeof message.sessionId === "string" ? message.sessionId : SESSION_ID;
    const turnId = typeof message.turnId === "string" ? message.turnId : `external-${message.requestId}`;
    const sequence = Number.isInteger(message.sequence) ? message.sequence : 1;
    const conversation = await createConversationStore({ rootDir: join(rootDir, "runtime", "workbench") });
    try {
      await conversation.appendTurn({
        contractVersion: "ta-conversation-turn-v1",
        turnId,
        sessionId,
        sequence,
        source: "vscode",
        role: "assistant",
        content: [{ kind: "text", text: `Seeded external turn ${sequence}` }],
        createdAt: "2026-08-31T00:00:01.000Z",
        relatedArtifactIds: [],
      }, `seed:${turnId}`);
      process.send?.({ type: "seedConversationTurn", requestId: message.requestId });
    } catch (error) {
      process.send?.({ type: "seedConversationTurn", requestId: message.requestId, error: error instanceof Error ? error.message : String(error) });
    } finally {
      await conversation.close();
    }
    return;
  }
  if (message?.type !== "issueBootstrap" || typeof message.requestId !== "string") return;
  const sessionId = message.sessionId === ADO_SELECTION_SESSION_ID || message.sessionId === ADO_CREATE_PREVIEW_SESSION_ID || message.sessionId === ADO_UPDATE_PREVIEW_SESSION_ID || message.sessionId === F6_CHAT_INPUT_SESSION_ID
    ? message.sessionId
    : undefined;
  process.send?.({ type: "bootstrap", requestId: message.requestId, nonce: await started.server.bootstrap.issueBrowserBootstrap(sessionId) });
});

function reviewArtifactId(kind, sessionId) {
  return `${kind}:${sessionId}`;
}

function trustedArtifactId(baseId, sessionId) {
  return `${baseId}:1:${sessionId}`;
}

function trustedProjectionArtifactId(sessionId) {
  return `engineering-summary-projection:1:${sessionId}`;
}

function seededF2RunReference(sessionId) {
  return `f2-run-e2e-${sessionId}`;
}

function trustedF6Stamp() {
  return "2026-09-02T00-00-00-000Z";
}

function trustedProductionRelativePath(sessionId, feature) {
  if (feature === "f3") return `runtime/workbench/runner-output/${sessionId}/production/f3/Feature3-Report.json`;
  if (feature === "f4") return `runtime/workbench/runner-output/${sessionId}/production/f4/Feature4-Calculation.json`;
  if (feature === "f5") return `runtime/workbench/runner-output/${sessionId}/production/f5/Feature5-Report.json`;
  if (feature === "f6-optimization") return `runtime/workbench/runner-output/${sessionId}/production/f6/${trustedF6Stamp()}/Feature6-Optimization.json`;
  if (feature === "f6-report") return `runtime/workbench/runner-output/${sessionId}/production/f6/${trustedF6Stamp()}/Feature6-Report.md`;
  if (feature === "projection") return `runtime/workbench/managed-artifacts/${sessionId}/engineering-summary-projection/revision-1.json`;
  throw new Error(`unsupported trusted feature ${feature}`);
}

function reviewIdentityForSession(sessionId) {
  return { workbookHash: HASH, downstreamSelectionHash: isMultimodalSession(sessionId) ? multimodalDownstreamSelectionHash : downstreamSelectionHash, baselineRunReference: seededF2RunReference(sessionId) };
}

function reviewContextIdForSession(sessionId) {
  return createHash("sha256").update(JSON.stringify(reviewIdentityForSession(sessionId))).digest("hex");
}

function savedScenarioDraft(sessionId) {
  return { ...calculatedDraft, draftId: `e2e-draft-${sessionId}`, sessionId, status: "saved" };
}

function projectionTemplate() {
  return {
    schemaVersion: "ta-engineering-report-projection-v1",
    title: "TA Engineering Analysis Report",
    workbookDisposition: "FAIL",
    worksheetDispositions: [{ worksheetName: "AJ_GAP", disposition: "FAIL" }],
    workbook: {
      fileName: "Anonymous.xlsx",
      contentHash: HASH,
    },
    worksheets: [{
      worksheetName: "AJ_GAP",
      toleranceLoopDescription: "Synthetic gap",
      disposition: "FAIL",
      requiredAction: "Engineering review required before release decision",
      findings: ["Finding A"],
      assumptions: ["Assumption A"],
      clarifications: ["Clarification A"],
      gatingEvidenceReferences: ["F3:AJ_GAP:governance", "F4:AJ_GAP:calculation", "F5:AJ_GAP:SIGNAL", "F6:AJ_GAP:summary"],
    }],
  };
}

async function writeArtifact(absolutePath, content, encoding = undefined) {
  await mkdir(join(absolutePath, ".."), { recursive: true });
  if (encoding === undefined) {
    await writeFile(absolutePath, content);
    const bytes = content instanceof Uint8Array ? content : Buffer.from(content);
    return { relativePath: relative(rootDir, absolutePath), contentHash: createHash("sha256").update(bytes).digest("hex") };
  }
  await writeFile(absolutePath, content, encoding);
  return { relativePath: relative(rootDir, absolutePath), contentHash: createHash("sha256").update(content, encoding).digest("hex") };
}

async function seedTrustedProductionArtifacts(sessionId) {
  const productionRoot = join(rootDir, "runtime", "workbench", "runner-output", sessionId, "production");
  const f2Root = join(productionRoot, "f2");
  const f3Root = join(productionRoot, "f3");
  const f4Root = join(productionRoot, "f4");
  const f5Root = join(productionRoot, "f5");
  const f6Root = join(productionRoot, "f6", trustedF6Stamp());
  const projectionRoot = join(rootDir, "runtime", "workbench", "managed-artifacts", sessionId, "engineering-summary-projection");

  const f2 = await writeArtifact(join(f2Root, "Feature2-Report.json"), `${JSON.stringify(isMultimodalSession(sessionId) ? multimodalF2Report : f2Report)}\n`, "utf8");
  const f3 = await writeArtifact(join(f3Root, "Feature3-Report.json"), `${JSON.stringify(isMultimodalSession(sessionId) ? multimodalF3Report : f3Report)}\n`, "utf8");
  const f4 = await writeArtifact(join(f4Root, "Feature4-Calculation.json"), `${JSON.stringify(isMultimodalSession(sessionId) ? multimodalF4Report : f4Report)}\n`, "utf8");
  const f5 = await writeArtifact(join(f5Root, "Feature5-Report.json"), Buffer.from(f5Bytes));
  const f6Optimization = await writeArtifact(join(f6Root, "Feature6-Optimization.json"), "{\"status\":\"completed\"}\n", "utf8");
  const f6Report = await writeArtifact(join(f6Root, "Feature6-Report.md"), f6ReportBytes);
  await writeArtifact(join(f6Root, "Feature6-Optimization.md"), "# TA Improvement Options\n", "utf8");
  await writeArtifact(join(f6Root, "Feature6-Run-Summary.json"), "{\"status\":\"completed\"}\n", "utf8");
  const projection = await writeArtifact(join(projectionRoot, "revision-1.json"), `${JSON.stringify(projectionTemplate(), null, 2)}\n`, "utf8");

  await mkdir(join(rootDir, "runtime", "workbench", "registries", "production-roots"), { recursive: true });
  await writeFile(
    join(rootDir, "runtime", "workbench", "registries", "production-roots", `${sessionId}.json`),
    JSON.stringify({ f1Root: join(productionRoot, "f1"), f2Root, f3Root, f4Root, f5Root, f6Root }),
    "utf8",
  );

  return { f2, f3, f4, f5, f6Optimization, f6Report, projection };
}

function buildReviewArtifactUpserts(sessionId, trustedArtifacts) {
  const reviewIdentity = reviewIdentityForSession(sessionId);
  const reviewArtifacts = [
    { artifactId: `f2-report:1:${seededF2RunReference(sessionId)}`, sessionId, inputRevision: 1, kind: "f2_report", relativePath: trustedArtifacts.f2.relativePath, contentHash: trustedArtifacts.f2.contentHash },
    { artifactId: reviewArtifactId("f3-e2e", sessionId), sessionId, inputRevision: 1, kind: "f3_report", relativePath: f3RelativePath, contentHash: createHash("sha256").update(f3Bytes).digest("hex"), reviewContext: reviewIdentity },
    sessionId === SESSION_ID
      ? { artifactId: trustedArtifactId("f4-calculation", sessionId), sessionId, inputRevision: 1, kind: "f4_calculation", relativePath: trustedArtifacts.f4.relativePath, contentHash: trustedArtifacts.f4.contentHash, reviewContext: reviewIdentity }
      : { artifactId: reviewArtifactId("f4-calculation", sessionId), sessionId, inputRevision: 1, kind: "f4_calculation", relativePath: f4RelativePath, contentHash: createHash("sha256").update(f4Bytes).digest("hex"), reviewContext: reviewIdentity },
    { artifactId: reviewArtifactId("f5-e2e", sessionId), sessionId, inputRevision: 1, kind: "f5_report", relativePath: f5RelativePath, contentHash: createHash("sha256").update(f5Bytes).digest("hex"), reviewContext: reviewIdentity },
    { artifactId: reviewArtifactId("f6-report-e2e", sessionId), sessionId, inputRevision: 1, kind: "f6_report", relativePath: f6ReportRelativePath, contentHash: createHash("sha256").update(f6ReportBytes).digest("hex"), reviewContext: reviewIdentity },
  ];
  if (sessionId !== SESSION_ID) {
    return reviewArtifacts;
  }
  return [
    ...reviewArtifacts,
    { artifactId: trustedArtifactId("f3-report", sessionId), sessionId, inputRevision: 1, kind: "f3_report", relativePath: trustedArtifacts.f3.relativePath, contentHash: trustedArtifacts.f3.contentHash, reviewContext: reviewIdentity },
    { artifactId: trustedArtifactId("f5-report", sessionId), sessionId, inputRevision: 1, kind: "f5_report", relativePath: trustedArtifacts.f5.relativePath, contentHash: trustedArtifacts.f5.contentHash, reviewContext: reviewIdentity },
    { artifactId: trustedArtifactId("f6-optimization", sessionId), sessionId, inputRevision: 1, kind: "f6_optimization", relativePath: trustedArtifacts.f6Optimization.relativePath, contentHash: trustedArtifacts.f6Optimization.contentHash, reviewContext: reviewIdentity },
    { artifactId: trustedArtifactId("f6-report", sessionId), sessionId, inputRevision: 1, kind: "f6_report", relativePath: trustedArtifacts.f6Report.relativePath, contentHash: trustedArtifacts.f6Report.contentHash, reviewContext: reviewIdentity },
    { artifactId: trustedProjectionArtifactId(sessionId), sessionId, inputRevision: 1, kind: "engineering_summary_projection", relativePath: trustedArtifacts.projection.relativePath, contentHash: trustedArtifacts.projection.contentHash, reviewContext: reviewIdentity, metadata: { reviewContext: reviewIdentity } },
    { artifactId: `f1-image:${f1ContentHash}`, sessionId, inputRevision: 1, kind: "f1_image", relativePath: f1RelativePath, contentHash: f1ContentHash, reviewContext: reviewIdentity, metadata: { mediaType: "image/png", description: "AJ_GAP tolerance loop image" } },
  ];
}

async function seedReviewSession(sessionId, targetState, cookie) {
  const preseedReviewArtifacts = sessionId !== F6_CHAT_INPUT_SESSION_ID && !isMultimodalSession(sessionId);
  const trustedArtifacts = await seedTrustedProductionArtifacts(sessionId);
  const reviewContextId = reviewContextIdForSession(sessionId);
  const store = await openSessionStore({ rootDir, sessionId });
  try {
    await store.applyCommand({ contractVersion: "f8-session-command-v1", sessionId, commandId: `seed-upload-${sessionId}`, expectedRevision: 0, command: "upload_workbook", payload: { fileName: longWorkbookFileName, workbookBytes: sourceWorkbookBytes, inputClassification: "confidential", managedArtifactId: workbookUploadArtifactId(sessionId) } }, async (snapshot) => ({
      snapshot: {
        ...snapshot,
        revision: 1,
        inputRevision: 1,
        state: "initial_scope_required",
        activeAttempt: null,
        initialScopeSelection: undefined,
        downstreamScopeSelection: undefined,
        priorRunReferences: sessionId === F6_CHAT_INPUT_SESSION_ID
          ? []
          : [{ featureId: "F2", referenceId: "f2-ref", contractVersion: "v1", workbookHash: HASH, runReference: seededF2RunReference(sessionId) }],
        scenarioDrafts: [savedScenarioDraft(sessionId)],
        artifactRefs: preseedReviewArtifacts
          ? [
              { artifactId: `f2-report:1:${seededF2RunReference(sessionId)}`, kind: "f2_report", revision: 1, validated: true },
              { artifactId: reviewArtifactId("f3-e2e", sessionId), kind: "f3_report", revision: 1, validated: true, reviewContextId },
              { artifactId: sessionId === SESSION_ID ? trustedArtifactId("f4-calculation", sessionId) : reviewArtifactId("f4-calculation", sessionId), kind: "f4_calculation", revision: 1, validated: true, reviewContextId },
              { artifactId: reviewArtifactId("f5-e2e", sessionId), kind: "f5_report", revision: 1, validated: true, reviewContextId },
              { artifactId: reviewArtifactId("f6-report-e2e", sessionId), kind: "f6_report", revision: 1, validated: true, reviewContextId },
              ...(sessionId === SESSION_ID ? [{ artifactId: `f1-image:${f1ContentHash}`, kind: "f1_image", revision: 1, validated: true, reviewContextId }] : []),
            ]
          : [],
      },
      artifactReferenceOps: {
        upsert: preseedReviewArtifacts ? buildReviewArtifactUpserts(sessionId, trustedArtifacts) : [],
      },
    }));
  } finally {
    await store.close();
  }
  await driveSessionScopeByHttp(sessionId, cookie, targetState);
  return trustedArtifacts;
}

function workbookUploadArtifactId(sessionId) {
  return `workbook-upload:${sessionId}`;
}

function registerWorkbookUploadArtifact(sessionId) {
  started.server.registerArtifactForTest(
    sessionId,
    workbookUploadArtifactId(sessionId),
    workbookUploadRelativePath,
    longWorkbookFileName,
    "confidential",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

function registerRunnerF2Artifact(sessionId) {
  started.server.registerArtifactForTest(
    sessionId,
    `f2-report:1:${seededF2RunReference(sessionId)}`,
    `runtime/workbench/runner-output/${sessionId}/production/f2/Feature2-Report.json`,
    "Feature2-Report.json",
    "confidential",
    "application/json",
  );
}

async function seedPreviewSession(sessionId, target, cookie) {
  await seedReviewSession(sessionId, "ado_decision_required", cookie);
  const beforeDecision = await readSessionSnapshot(sessionId, cookie);
  await postSessionCommand(sessionId, cookie, {
    commandId: `seed-preview-${target.mode}-${sessionId}`,
    expectedRevision: beforeDecision.revision,
    command: "confirm_ado_decision",
    payload: target.mode === "create"
      ? { decision: "create_new", title: target.title, sponsorEmail: target.sponsorEmail }
      : { decision: "use_existing", workItemReference: target.workItemReference },
  });
  const adoSnapshot = await waitForSessionState(sessionId, cookie, "ado_action_pending");
  const adoActionRevision = adoSnapshot.revision;
  const rendered = renderF3AdoMarkdown(f3Report);
  const actionId = `ado-validation:${sessionId}:${adoActionRevision}`;
  const hostActions = await createHostActionStore({ rootDir, sessionId });
  try {
    const request = hostActionRequestSchema.parse((await hostActions.getHostAction(actionId)).request);
    const confirmationHash = request.confirmationHash;
    const expectedFactorCount = request.kind === "surface_validate" ? request.prepareRequest.factorCount : f3Report.summary.factorCount;
    const claim = await hostActions.claimHostAction(actionId, "playwright-seed");
    await hostActions.completeHostAction(hostActionResultSchema.parse({
      contractVersion: "f8-host-action-result-v1",
      actionId,
      hostInstanceId: "playwright-seed",
      leaseId: claim.leaseId,
      status: "completed",
      resultHash: createHash("sha256").update(JSON.stringify({ status: "completed", outcome: { kind: "surface_validation", confirmation: previewConfirmation(target, rendered.markdown, confirmationHash, expectedFactorCount) } })).digest("hex"),
      payload: {
        status: "completed",
        outcome: {
          kind: "surface_validation",
          confirmation: previewConfirmation(target, rendered.markdown, confirmationHash, expectedFactorCount),
        },
      },
    }));
  } finally {
    await hostActions.close();
  }
}

async function seedFailedExecutionSession(sessionId, cookie) {
  await seedReviewSession(sessionId, "ado_decision_required", cookie);

  const store = await openSessionStore({ rootDir, sessionId });
  try {
    const adoRequired = await store.readSnapshot();
    await store.applyCommand({
      contractVersion: "f8-session-command-v1",
      sessionId,
      commandId: `seed-failed-local-only-${sessionId}`,
      expectedRevision: adoRequired.revision,
      command: "confirm_ado_decision",
      payload: { decision: "local_only" },
    }, (snapshot, command) => ({
      snapshot: reduceSessionCommand(snapshot, command),
    }));

    const running = await store.readSnapshot();
    const attemptId = running.activeAttempt?.attemptId;
    if (running.state !== "f4_running" || typeof attemptId !== "string") {
      throw new Error(`seeded failed execution expected f4_running active attempt for ${sessionId}`);
    }
    const endedAt = "2026-09-02T00:00:03.000Z";
    const failedSnapshot = acceptAttemptResult(running, {
      attemptId,
      status: "failed",
      result: {
        code: "seeded_execution_failed",
        summary: "Synthetic execution failure for product export denial test.",
      },
      endedAt,
    });
    await store.recordAttemptResult({
      attemptId,
      status: "failed",
      result: {
        code: "seeded_execution_failed",
        summary: "Synthetic execution failure for product export denial test.",
      },
      endedAt,
      snapshot: failedSnapshot,
    });
  } finally {
    await store.close();
  }

  await waitForSessionState(sessionId, cookie, "failed");
}

async function readCsrfToken(cookie) {
  const response = await fetch(`${apiOrigin}/api/csrf`, { headers: { cookie } });
  if (!response.ok) throw new Error(`csrf fetch failed (${response.status})`);
  const payload = await response.json();
  if (typeof payload.csrfToken !== "string" || payload.csrfToken.length === 0) {
    throw new Error("csrf token missing");
  }
  return payload.csrfToken;
}

async function readSessionSnapshot(sessionId, cookie) {
  const response = await fetch(`${apiOrigin}/api/sessions/${encodeURIComponent(sessionId)}`, { headers: { cookie } });
  if (!response.ok) throw new Error(`session fetch failed (${response.status})`);
  return response.json();
}

async function postSessionCommand(sessionId, cookie, commandEnvelope) {
  const csrfToken = await readCsrfToken(cookie);
  const response = await fetch(`${apiOrigin}/api/sessions/${encodeURIComponent(sessionId)}/commands`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": csrfToken, cookie },
    body: JSON.stringify({
      contractVersion: "f8-session-command-v1",
      sessionId,
      ...commandEnvelope,
    }),
  });
  if (!response.ok) {
    throw new Error(`session command ${commandEnvelope.command} failed (${response.status}): ${await response.text()}`);
  }
}

async function waitForSessionState(sessionId, cookie, expectedState, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastState = "unknown";
  let lastRevision = -1;
  let lastAttempt = "";
  while (Date.now() < deadline) {
    const snapshot = await readSessionSnapshot(sessionId, cookie);
    lastState = snapshot.state;
    lastRevision = snapshot.revision;
    if (snapshot.activeAttempt !== null) {
      lastAttempt = JSON.stringify(snapshot.activeAttempt);
    }
    if (snapshot.state === expectedState) return snapshot;
    await delay(100);
  }
  throw new Error(`timed out waiting for ${sessionId} to reach ${expectedState}; last state=${lastState} revision=${lastRevision} attempt=${lastAttempt}`);
}

async function driveSessionScopeByHttp(sessionId, cookie, targetState) {
  let snapshot = await waitForSessionState(sessionId, cookie, "initial_scope_required");
  await postSessionCommand(sessionId, cookie, {
    commandId: `seed-confirm-initial-${sessionId}`,
    expectedRevision: snapshot.revision,
    command: "confirm_initial_scope",
    payload: {
      workbookHash: HASH,
      worksheetNames: ["AJ_GAP", "B_STACK"],
    },
  });

  snapshot = await waitForSessionState(sessionId, cookie, "downstream_scope_required");
  await postSessionCommand(sessionId, cookie, {
    commandId: `seed-confirm-downstream-${sessionId}`,
    expectedRevision: snapshot.revision,
    command: "confirm_downstream_scope",
    payload: {
      workbookHash: HASH,
      worksheetNames: isMultimodalSession(sessionId) ? ["B_STACK", "AJ_GAP"] : ["AJ_GAP"],
    },
  });

  if (targetState === "ado_decision_required") {
    await waitForSessionState(sessionId, cookie, "ado_decision_required");
    return;
  }

  snapshot = await waitForSessionState(sessionId, cookie, "ado_decision_required");
  await postSessionCommand(sessionId, cookie, {
    commandId: `seed-ado-local-only-${sessionId}`,
    expectedRevision: snapshot.revision,
    command: "confirm_ado_decision",
    payload: { decision: "local_only" },
  });

  if (targetState === "f5_running") {
    await waitForSessionState(sessionId, cookie, "f5_running");
    return;
  }

  await completePendingMultimodalAction(sessionId, cookie);

  if (targetState === "analysis_context_decision_required") {
    await waitForSessionState(sessionId, cookie, "analysis_context_decision_required");
    return;
  }

  snapshot = await waitForSessionState(sessionId, cookie, "analysis_context_decision_required");
  await postSessionCommand(sessionId, cookie, {
    commandId: `seed-analysis-context-not-provided-${sessionId}`,
    expectedRevision: snapshot.revision,
    command: "confirm_analysis_context",
    payload: { decision: "not_provided", rationale: "No additional analysis context supplied." },
  });

  if (targetState === "optimization_targets_decision_required") {
    await waitForSessionState(sessionId, cookie, "optimization_targets_decision_required");
    return;
  }

  snapshot = await waitForSessionState(sessionId, cookie, "optimization_targets_decision_required");
  await postSessionCommand(sessionId, cookie, {
    commandId: `seed-optimization-targets-not-provided-${sessionId}`,
    expectedRevision: snapshot.revision,
    command: "confirm_optimization_targets",
    payload: { decision: "not_provided", rationale: "Use governed default optimization targets." },
  });
  await waitForSessionState(sessionId, cookie, "review_required");
}

async function completePendingMultimodalAction(sessionId, cookie) {
  await waitForSessionState(sessionId, cookie, "f5_running");
  const pendingToken = started.server.issueHostBearer(sessionId, ["sessions:read"]);
  let pendingResponse;
  const deadline = Date.now() + 5_000;
  do {
    pendingResponse = await fetch(`${apiOrigin}/api/sessions/${sessionId}/host-actions/pending`, { headers: { authorization: `Bearer ${pendingToken}` } });
    if (pendingResponse.status === 200) break;
    if (pendingResponse.status !== 204) throw new Error(`pending multimodal action unavailable (${pendingResponse.status}): ${await pendingResponse.text()}`);
    await delay(25);
  } while (Date.now() < deadline);
  if (pendingResponse.status !== 200) throw new Error("pending multimodal action was not materialized");
  const pending = await pendingResponse.json();
  const hostInstanceId = `seed-multimodal-${sessionId}`;
  const claimToken = started.server.issueHostBearer(sessionId, ["host-actions:claim"], { actionId: pending.actionId, hostInstanceId });
  const claimResponse = await fetch(`${apiOrigin}/api/sessions/${sessionId}/host-actions/${encodeURIComponent(pending.actionId)}/claim`, {
    method: "POST",
    headers: { authorization: `Bearer ${claimToken}`, "content-type": "application/json" },
    body: JSON.stringify({ hostInstanceId }),
  });
  if (!claimResponse.ok) throw new Error(`multimodal claim failed (${claimResponse.status})`);
  const claim = await claimResponse.json();
  const request = claim.request.request;
  const result = {
    contractVersion: "f5-multimodal-result-v3",
    outputClassification: "confidential",
    requestHash: request.requestHash,
    sessionId: request.sessionId,
    revision: request.revision,
    inputRevision: request.inputRevision,
    workbookContentHash: request.workbook.contentHash,
    worksheetName: request.worksheetName,
    tableId: request.tableId,
    imageContentHash: request.image.contentHash,
    model: { modelId: "seed-vision", supportsImage: true },
    imageTableInterpretation: `Seed interpretation for ${request.worksheetName}.`,
    rowMappings: request.factorRows.map((row) => ({ worksheetName: row.worksheetName, tableId: row.tableId, sourceRow: row.sourceRow, factorOrdinal: row.factorOrdinal, mappingStatus: "matched", visibleStatus: "visible", interpretation: `${row.factorOrdinal.value}:${row.factorName}` })),
  };
  const payload = { status: "completed", outcome: { kind: "worksheet_multimodal_response", result } };
  const resultToken = started.server.issueHostBearer(sessionId, ["host-actions:result"], { actionId: pending.actionId, hostInstanceId });
  const response = await fetch(`${apiOrigin}/api/sessions/${sessionId}/host-actions/${encodeURIComponent(pending.actionId)}/result`, {
    method: "POST",
    headers: { authorization: `Bearer ${resultToken}`, "content-type": "application/json" },
    body: JSON.stringify({ contractVersion: "f8-host-action-result-v1", actionId: pending.actionId, hostInstanceId, leaseId: claim.leaseId, status: "completed", resultHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"), payload }),
  });
  if (!response.ok) throw new Error(`multimodal completion failed (${response.status}): ${await response.text()}`);
}

async function runSeededAttempt(job) {
  const sessionId = readSessionIdFromJob(job);
  if (sessionId === undefined) throw new Error("seeded runner job missing sessionId");

  if (job.stage === "f1_f2_running") {
    return {
      featureId: "F2",
      status: "completed",
      runId: seededF2RunReference(sessionId),
      f2Root: join(rootDir, "runtime", "workbench", "runner-output", sessionId, "production", "f2"),
      workbookContentHash: HASH,
      report: isMultimodalSession(sessionId) ? multimodalF2Report : f2Report,
      worksheetCapabilities: isMultimodalSession(sessionId)
        ? [{ worksheetName: "AJ_GAP", whatIfAvailable: true }, { worksheetName: "B_STACK", whatIfAvailable: true }]
        : [{ worksheetName: "AJ_GAP", whatIfAvailable: true }],
    };
  }

  if (job.stage === "f3_running") {
    return {
      featureId: "F3",
      status: "completed",
      governance: { status: "governance_required" },
      reviewContext: reviewIdentityForSession(sessionId),
      artifactReferences: [
        { artifactId: reviewArtifactId("f3-e2e", sessionId), kind: "f3_report", relativePath: isMultimodalSession(sessionId) ? "e2e/f3-multimodal.json" : f3RelativePath, contentHash: isMultimodalSession(sessionId) ? multimodalF3ContentHash : f3ContentHash },
        ...(sessionId === SESSION_ID ? [{ artifactId: trustedArtifactId("f3-report", sessionId), kind: "f3_report", relativePath: trustedProductionRelativePath(sessionId, "f3"), contentHash: trustedF3ContentHash }] : []),
      ],
    };
  }

  if (job.stage === "f4_running") {
    return {
      featureId: "F4",
      status: "completed",
      reviewContext: reviewIdentityForSession(sessionId),
      artifactReferences: [
        sessionId === SESSION_ID
          ? { artifactId: trustedArtifactId("f4-calculation", sessionId), kind: "f4_calculation", relativePath: trustedProductionRelativePath(sessionId, "f4"), contentHash: trustedF4ContentHash }
          : { artifactId: reviewArtifactId("f4-e2e", sessionId), kind: "f4_calculation", relativePath: isMultimodalSession(sessionId) ? multimodalF4RelativePath : f4RelativePath, contentHash: isMultimodalSession(sessionId) ? multimodalF4ContentHash : f4ContentHash },
      ],
    };
  }

  if (job.stage === "f5_running") {
    const multimodalRegistry = JSON.parse(await readFile(join(rootDir, "runtime", "workbench", "registries", "multimodal-artifacts", `${sessionId}.json`), "utf8"));
    return {
      featureId: "F5",
      status: "completed",
      reviewContext: reviewIdentityForSession(sessionId),
      artifactReferences: [
        { artifactId: "f5-multimodal:1", kind: "f5_multimodal", relativePath: relative(rootDir, multimodalRegistry.path), contentHash: multimodalRegistry.contentHash },
        { artifactId: reviewArtifactId("f5-e2e", sessionId), kind: "f5_report", relativePath: f5RelativePath, contentHash: f5ContentHash },
        ...(sessionId === SESSION_ID ? [{ artifactId: trustedArtifactId("f5-report", sessionId), kind: "f5_report", relativePath: trustedProductionRelativePath(sessionId, "f5"), contentHash: f5ContentHash }] : []),
      ],
    };
  }

  if (job.stage === "f6_running") {
    return {
      featureId: "F6",
      status: "completed",
      reviewContext: reviewIdentityForSession(sessionId),
      artifactReferences: [
        { artifactId: reviewArtifactId("f6-report-e2e", sessionId), kind: "f6_report", relativePath: f6ReportRelativePath, contentHash: f6ContentHash },
        ...(sessionId === SESSION_ID
          ? [
              { artifactId: trustedArtifactId("f6-optimization", sessionId), kind: "f6_optimization", relativePath: trustedProductionRelativePath(sessionId, "f6-optimization"), contentHash: trustedF6OptimizationContentHash },
              { artifactId: trustedArtifactId("f6-report", sessionId), kind: "f6_report", relativePath: trustedProductionRelativePath(sessionId, "f6-report"), contentHash: f6ContentHash },
              {
                artifactId: trustedProjectionArtifactId(sessionId),
                kind: "engineering_summary_projection",
                relativePath: trustedProductionRelativePath(sessionId, "projection"),
                contentHash: trustedProjectionContentHash,
                metadata: { reviewContext: reviewIdentityForSession(sessionId) },
              },
            ]
          : []),
      ],
    };
  }

  throw new Error(`unsupported seeded stage ${job.stage}`);
}

function readSessionIdFromJob(job) {
  const payload = job?.payload;
  return typeof payload === "object" && payload !== null && typeof payload.sessionId === "string"
    ? payload.sessionId
    : undefined;
}

function previewConfirmation(target, nextContent, confirmationHash, factorCount) {
  return {
    status: "confirmation_required",
    workItemReference: target.mode === "create" ? "WI-900" : "WI-42",
    ownerReference: target.mode === "create" ? target.sponsorEmail : "owner-1",
    commentReference: "C0",
    expectedVersion: target.mode === "create" ? "1" : "7",
    beforeContentHash: "b".repeat(64),
    nextContent,
    factorCount,
    confirmationHash,
    diff: [{ before: target.mode === "create" ? "" : "old", after: nextContent, changed: true }],
  };
}

function buildF3Report({ includeBStack = false } = {}) {
  const report = {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: "governance_required",
    artifactRoot: "test/f8-e2e/generated",
    workbook: { fileName: "Anonymous.xlsx", contentHash: HASH },
    worksheets: [
      {
        worksheetName: "AJ_GAP",
        toleranceLoopDescription: "Synthetic gap",
        rows: [
          {
            factorInstanceId: "a".repeat(64),
            factorOrdinal: { value: "A", rawText: "A", sourceCell: "AJ_GAP!Z2" },
            deviceLevelDim: "TP_Gap_X",
            dimensionDescription: "Gap X",
            partCategory: "Display",
            partSubsystem: "Bracket",
            drawingNumber: "DRW-001-A",
            dimId: null,
            factorDescription: "AJ center to C-bucket",
            nominal: 0,
            upperTolerance: 0.05,
            lowerTolerance: -0.05,
            sigmaLevel: 3,
            dimIdStatus: "missing",
            qualitySignals: ["dim_id_missing"],
            governanceStatus: "needs_governance",
            imageReference: { artifact: "f1", relativePath: f1RelativePath, contentHash: f1ContentHash, worksheetName: "AJ_GAP" },
            source: { worksheetName: "AJ_GAP", tableId: "table-a", sourceRow: 2, sourceCells: { factorName: "AJ_GAP!A2" } },
          },
          {
            factorInstanceId: "b".repeat(64),
            factorOrdinal: { value: "B", rawText: "B", sourceCell: "AJ_GAP!Z3" },
            deviceLevelDim: "TP_Gap_Y",
            dimensionDescription: "Gap Y",
            partCategory: "Display",
            partSubsystem: "Cover",
            drawingNumber: null,
            dimId: null,
            factorDescription: "Cover gap to bracket",
            nominal: 0.2,
            upperTolerance: 0.08,
            lowerTolerance: -0.04,
            sigmaLevel: 4,
            dimIdStatus: "missing",
            qualitySignals: ["drawing_number_missing", "dim_id_missing"],
            governanceStatus: "needs_governance",
            imageReference: { artifact: "f1", relativePath: f1RelativePath, contentHash: f1ContentHash, worksheetName: "AJ_GAP" },
            source: { worksheetName: "AJ_GAP", tableId: "table-a", sourceRow: 3, sourceCells: { factorName: "AJ_GAP!A3" } },
          },
        ],
      },
      {
        worksheetName: "B_STACK",
        toleranceLoopDescription: "Stack",
        rows: [
          {
            factorInstanceId: "c".repeat(64),
            factorOrdinal: { value: "C", rawText: "C", sourceCell: "B_STACK!Z8" },
            deviceLevelDim: "TP_Stack_Z",
            dimensionDescription: "Stack Z",
            partCategory: "CNC",
            partSubsystem: "Bracket",
            drawingNumber: null,
            dimId: "DIM-17",
            factorDescription: "Bracket reinforcement subassembly",
            nominal: 1.2,
            upperTolerance: 0.12,
            lowerTolerance: -0.09,
            sigmaLevel: 3,
            dimIdStatus: "valid",
            qualitySignals: ["drawing_number_missing"],
            governanceStatus: "needs_governance",
            imageReference: { artifact: "f1", relativePath: f1RelativePath, contentHash: f1ContentHash, worksheetName: "B_STACK" },
            source: { worksheetName: "B_STACK", tableId: "table-b", sourceRow: 8, sourceCells: { factorName: "B_STACK!A8" } },
          },
        ],
      },
    ],
    ado: { status: "not_requested" },
    summary: { worksheetCount: 2, factorCount: 3, completeCount: 0, governanceRequiredCount: 3, duplicateConflictCount: 0 },
  };
  if (includeBStack) {
    report.worksheets[1].rows[0].imageReference = { artifact: "f1", relativePath: f1BRelativePath, contentHash: f1BContentHash, worksheetName: "B_STACK" };
    report.worksheets.reverse();
    return report;
  }
  return report;
}

function buildSystemSpecification(worksheetName) {
  return {
    status: "available",
    designNominal: { status: "available", actualValue: -0.05, displayValue: "-0.05", sourceLabel: "*Design Nominal ►", sourceCell: `${worksheetName}!P53`, valueOrigin: "numeric_literal" },
    lowerSpecLimit: { status: "available", actualValue: -0.15, displayValue: "-0.15", sourceLabel: "*Lower Spec Limit ►", sourceCell: `${worksheetName}!P54`, valueOrigin: "numeric_literal" },
    upperSpecLimit: { status: "available", actualValue: 0.05, displayValue: "0.05", sourceLabel: "*Upper Spec Limit ►", sourceCell: `${worksheetName}!P55`, valueOrigin: "numeric_literal" },
    targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3.0σ", sourceLabel: "*Target σ Level ►", sourceCell: `${worksheetName}!P56`, valueOrigin: "numeric_literal" },
    additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
  };
}

function buildF2Report({ includeBStack = false, englishFactorIdentity = false } = {}) {
  const systemSpecification = buildSystemSpecification("AJ_GAP");
  const actualFields = {
    factorName: englishFactorIdentity ? "AJ center to C-bucket" : "中心间隙",
    partName: "支架加强组件",
    drawingNumber: "DRW-001-A",
    dimCharacteristicId: "DIM-17",
    partCategory: "CNC",
    nominalValue: 0,
    upperTolerance: 0.05,
    lowerTolerance: -0.05,
    longTermSafetyFactor: 1,
    sigmaLevel: 3,
    distribution: "normal",
    mean: 0,
    tolerance: 0.1,
    oneSigma: 0.02,
    percentContributionToSigma: 0.1,
    notes: "Check stack-up at room temperature and hinge preload.",
  };
  const displayFields = {
    factorName: "AJ center to C-bucket",
    partName: "Bracket reinforcement subassembly",
    drawingNumber: "DRW-001-A",
    dimCharacteristicId: "DIM-17",
    partCategory: "CNC",
    nominalValue: "0.000",
    upperTolerance: "0.050",
    lowerTolerance: "-0.050",
    longTermSafetyFactor: "1",
    sigmaLevel: "3",
    distribution: "Normal",
    mean: "0.000",
    tolerance: "0.100",
    oneSigma: "0.020",
    percentContributionToSigma: "10.0%",
    notes: "Check stack-up at room temperature and hinge preload.",
  };
  const row = {
    worksheetName: "AJ_GAP",
    tableId: "table-a",
    sourceRow: 2,
    factorOrdinal: { value: "A", rawText: "A", sourceCell: "AJ_GAP!Z2" },
    imageReference: { artifact: "f1", relativePath: f1RelativePath, contentHash: f1ContentHash, worksheetName: "AJ_GAP" },
    actualFields,
    displayFields,
    sourceCells: { factorName: "AJ_GAP!A2" },
    missingRequiredFields: [],
    missingIdentifiers: [],
    capabilityStatus: "internal_within_guidance",
    f0KnowledgeBaseVersion: "internal-v1",
    recommendation: {
      kind: "internal-guidance",
      assessedTotalBand: 0.1,
      maximumRecommendedTotalBand: 0.2,
      unit: "mm",
      matchedEntryId: "cnc-linear-6",
      fallbackApplied: false,
      evidence: { sourceFileHash: "c".repeat(64), sheetName: "ISO 2768-1 Class m", sourceRange: "A6:F6" },
    },
    adoReminderRequested: false,
  };
  const handoff = {
    contractVersion: "v1",
    handoffVersion: "f4-handoff-v1",
    inputClassification: "confidential",
    status: "ready",
    workbookContentHash: HASH,
    worksheetName: "AJ_GAP",
    systemSpecification: {
      designNominal: systemSpecification.designNominal.actualValue,
      lowerSpecLimit: systemSpecification.lowerSpecLimit,
      upperSpecLimit: systemSpecification.upperSpecLimit,
      targetSigmaLevel: systemSpecification.targetSigmaLevel,
      targetCpk: 1,
      additionalMeanShift: systemSpecification.additionalMeanShift,
    },
    factors: [{ tableId: row.tableId, sourceRow: row.sourceRow, factorOrdinal: row.factorOrdinal, unit: "mm", actualFields: row.actualFields, sourceCells: row.sourceCells }],
  };
  const bRow = {
    ...structuredClone(row),
    worksheetName: "B_STACK",
    tableId: "table-b",
    sourceRow: 8,
    factorOrdinal: { value: "C", rawText: "C", sourceCell: "B_STACK!Z8" },
    imageReference: { artifact: "f1", relativePath: f1BRelativePath, contentHash: f1BContentHash, worksheetName: "B_STACK" },
    actualFields: { ...structuredClone(actualFields), factorName: "B bracket stack", partName: "B支架" },
    displayFields: { ...structuredClone(displayFields), factorName: "B bracket stack", partName: "B bracket" },
    sourceCells: { factorName: "B_STACK!A8" },
  };
  const bSpecification = buildSystemSpecification("B_STACK");
  const bHandoff = {
    ...structuredClone(handoff),
    worksheetName: "B_STACK",
    systemSpecification: {
      designNominal: bSpecification.designNominal.actualValue,
      lowerSpecLimit: bSpecification.lowerSpecLimit,
      upperSpecLimit: bSpecification.upperSpecLimit,
      targetSigmaLevel: bSpecification.targetSigmaLevel,
      targetCpk: 1,
      additionalMeanShift: bSpecification.additionalMeanShift,
    },
    factors: [{ tableId: bRow.tableId, sourceRow: bRow.sourceRow, factorOrdinal: bRow.factorOrdinal, unit: "mm", actualFields: bRow.actualFields, sourceCells: bRow.sourceCells }],
  };

  return f2UserReportSchema.parse({
    contractVersion: "v1",
    inputClassification: "confidential",
    status: "completed",
    workbook: { fileName: longWorkbookFileName, contentHash: HASH, f1GeneratedAt: "2026-08-25T00:00:00.000Z" },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot: "test/f8-e2e/generated",
    worksheets: includeBStack
      ? [
          { worksheetName: "B_STACK", status: "ready", toleranceLoopDescription: "Stack", tolerancePathImageStatus: "available", systemSpecification: bSpecification, systemSpecificationIssues: [], rows: [bRow], missingFieldSummary: [], f4CalculabilityIssues: [] },
          { worksheetName: "AJ_GAP", status: "ready", toleranceLoopDescription: "Synthetic gap", tolerancePathImageStatus: "available", systemSpecification, systemSpecificationIssues: [], rows: [row], missingFieldSummary: [], f4CalculabilityIssues: [] },
        ]
      : [{ worksheetName: "AJ_GAP", status: "ready", toleranceLoopDescription: "Synthetic gap", tolerancePathImageStatus: "available", systemSpecification, systemSpecificationIssues: [], rows: [row], missingFieldSummary: [], f4CalculabilityIssues: [] }],
    f4Handoffs: includeBStack ? [bHandoff, handoff] : [handoff],
    adoEvents: [],
    summary: {
      worksheetsChecked: includeBStack ? 2 : 1,
      blockedWorksheetCount: 0,
      readyWorksheetCount: includeBStack ? 2 : 1,
      factorRowCount: includeBStack ? 2 : 1,
      rowsWithRequiredMissing: 0,
      requiredMissingFieldCount: 0,
      missingImageWorksheetCount: 0,
      internalWithinGuidanceCount: includeBStack ? 2 : 1,
      internalGuidanceExceededCount: 0,
      f0InformationInsufficientCount: 0,
      publicLibraryMatchCount: 0,
      nonF0ProcessCategoryCount: 0,
      unableToCheckCount: 0,
      publicToleranceDifferenceCount: 0,
      publicDistributionDifferenceCount: 0,
      missingDimIdCount: 0,
      missingPartNumberCount: 0,
    },
  });
}

function buildF4Report() {
  const text = (rawText, sourceCell) => ({ status: "available", rawText, sourceCell });
  const number = (numericValue, sourceCell) => ({ status: "available", rawText: String(numericValue), sourceCell, numericValue, unit: "mm" });
  const request = { contractVersion: "v1", inputClassification: "confidential", projectReference: "project", runReference: "run-1", worksheetAnalysisAssets: { contractVersion: "v1", workbook: { classification: "confidential", contentHash: HASH, catalogContractVersion: "v1" }, worksheets: [{ worksheetName: "AJ_GAP", toleranceLoopDescription: "Synthetic gap", factorTables: [{ tableId: "table-a", headerRow: 1, dataRange: { startRow: 2, endRow: 2 }, columns: [{ semanticField: "factorName", headerText: "Factor", sourceColumn: "A" }, { semanticField: "nominalValue", headerText: "Nominal", sourceColumn: "B" }, { semanticField: "upperTolerance", headerText: "Upper", sourceColumn: "C" }, { semanticField: "lowerTolerance", headerText: "Lower", sourceColumn: "D" }, { semanticField: "longTermSafetyFactor", headerText: "LTSF", sourceColumn: "E" }, { semanticField: "standardDeviation", headerText: "Sigma", sourceColumn: "F" }, { semanticField: "distribution", headerText: "Distribution", sourceColumn: "G" }, { semanticField: "unit", headerText: "Unit", sourceColumn: "H" }], rows: [{ sourceRow: 2, fields: { factorName: text("AJ center to C-bucket", "AJ_GAP!A2"), nominalValue: number(0, "AJ_GAP!B2"), upperTolerance: number(0.05, "AJ_GAP!C2"), lowerTolerance: number(-0.05, "AJ_GAP!D2"), longTermSafetyFactor: number(1, "AJ_GAP!E2"), standardDeviation: number(3, "AJ_GAP!F2"), distribution: text("normal", "AJ_GAP!G2"), unit: text("mm", "AJ_GAP!H2") } }] }], formulaCells: [], imageAssets: [] }] }, requiredFieldCheck: { contractVersion: "v1", inputClassification: "confidential", workbookContentHash: HASH, status: "readyForNextCheck", blockingIssues: [], advisoryIssues: [], summary: { worksheetsChecked: 1, factorTablesChecked: 1, factorRowsChecked: 1, blockingIssueCount: 0, advisoryIssueCount: 0 } }, exceptionResolution: { contractVersion: "v1", inputClassification: "confidential", workbookContentHash: HASH, knowledgeBaseVersion: "v1", status: "readyToContinue", readyToContinue: true, acceptedExceptions: [], pendingExceptions: [], summary: { actionableSignalCount: 0, acceptedExceptionCount: 0, pendingExceptionCount: 0, invalidCandidateCount: 0 } }, worksheetSelection: { worksheetName: "AJ_GAP", tableId: "table-a" }, systemSpecification: { designNominal: 0, lowerSpecLimit: -0.1, upperSpecLimit: 0.1, targetSigmaLevel: 3, targetCpk: 1, additionalMeanShift: 0 }, criticality: "none", scenarioOverrides: [] };
  const systemSpecification = buildSystemSpecification("AJ_GAP");
  request.systemSpecification = {
    designNominal: systemSpecification.designNominal.actualValue,
    lowerSpecLimit: systemSpecification.lowerSpecLimit.actualValue,
    upperSpecLimit: systemSpecification.upperSpecLimit.actualValue,
    targetSigmaLevel: systemSpecification.targetSigmaLevel.actualValue,
    targetCpk: systemSpecification.targetSigmaLevel.actualValue / 3,
    additionalMeanShift: systemSpecification.additionalMeanShift.actualValue,
  };
  request.worksheetAnalysisAssets.worksheets[0].factorTables[0].rows[0].factorOrdinal = { value: "A", rawText: "A", sourceCell: "AJ_GAP!Z2" };
  request.worksheetAnalysisAssets.worksheets[0].factorTables[0].rows[0].fields.factorName = text("中心间隙", "AJ_GAP!A2");
  const calculation = createCalculation(request);
  if (calculation.status !== "completed") throw new Error("synthetic calculation failed");
  return f4WorkflowCalculationResultSchema.parse({ contractVersion: "v1", workflowVersion: "f4-f2-v1", outputClassification: "confidential", featureId: "F4", status: "completed", runId: "e2e-run", generatedAt: "2026-08-25T00:00:00.000Z", source: { artifactReference: "Feature2-Report.json", workbookFileName: longWorkbookFileName, workbookContentHash: HASH }, calculations: [calculation], summary: { selectedWorksheetCount: 1, completedWorksheetCount: 1 } });
}

function buildMultimodalF4Report(report) {
  const calculation = structuredClone(report.calculations[0]);
  calculation.factors[0].factorName = "AJ center to C-bucket";
  const calculationB = structuredClone(calculation);
  calculationB.runReference = "run-2";
  calculationB.worksheetSelection = { worksheetName: "B_STACK", tableId: "table-b" };
  calculationB.factors[0].factorName = "B bracket stack";
  calculationB.factors[0].source = { ...calculationB.factors[0].source, worksheetName: "B_STACK", tableId: "table-b", sourceRow: 8 };
  return f4WorkflowCalculationResultSchema.parse({ ...structuredClone(report), calculations: [calculationB, calculation], summary: { selectedWorksheetCount: 2, completedWorksheetCount: 2 } });
}
