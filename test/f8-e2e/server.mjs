import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { f2UserReportSchema, f4WorkflowCalculationResultSchema, hostActionResultSchema, hostActionRequestSchema } from "@ai-assist/contracts";
import { createConversationStore } from "@ai-assist/conversation";
import { createCalculation } from "@ai-assist/workbook-catalog";
import { createHostActionStore, openSessionStore } from "@ai-assist/workbench";
import { renderF3AdoMarkdown } from "@ai-assist/workflow-runners";
import { startWorkbenchServer } from "@ai-assist/workbench-server";
import { createSeededAdoValidationHostAction } from "./ado-fixture-contract.mjs";
import { createF6ArtifactBundleFixture } from "../../scripts/f6-artifact-test-fixture.mjs";

const SESSION_ID = "40404040-4040-4404-8404-404040404040";
const ADO_SELECTION_SESSION_ID = "50505050-5050-4505-8505-505050505050";
const ADO_CREATE_PREVIEW_SESSION_ID = "60606060-6060-4606-8606-606060606060";
const ADO_UPDATE_PREVIEW_SESSION_ID = "70707070-7070-4707-8707-707070707070";
const sourceWorkbookPath = "test/f8-e2e/fixtures/anonymous-ta-workbook.xlsx";
const sourceWorkbookBytes = await readFile(sourceWorkbookPath);
const HASH = createHash("sha256").update(sourceWorkbookBytes).digest("hex");
const rootDir = join(".tmp", `f8-e2e-${randomUUID()}`);
const f1ContentHash = "f".repeat(64);
const f1RelativePath = "e2e/f1.png";
const f3RelativePath = "e2e/f3.json";
const f3AdoReminderRelativePath = "e2e/Feature3-ADO-Reminder.json";
const f5RelativePath = "e2e/f5.json";
const f6ReportRelativePath = "e2e/f6-report.json";
const downstreamFixture = createF6ArtifactBundleFixture({ worksheetNames: ["AJ_GAP"] });
const calculatedDraft = {
  contractVersion: "f8-scenario-draft-v1", draftId: "e2e-draft", sessionId: SESSION_ID, worksheetName: "AJ_GAP", inputRevision: 1, status: "calculated", mode: "WHAT_IF",
  baselineWorkbookHash: HASH, baselineRunReference: "run-1", change: { upperTolerance: 0.04 }, calculationReference: "what-if:e2e-draft",
  calculationMetrics: { mean: 0, rssSigma: 0.018, cp: 1.7, cpkL: 1.6, cpkU: 1.8, cpk: 1.6, statisticalMargin: 0.1, worstCaseMargin: 0.05 },
  factorIdentity: { worksheetName: "AJ_GAP", tableId: "table-a", sourceRow: 2, factorName: "AJ center to C-bucket", unit: "mm" },
};
await rm(rootDir, { recursive: true, force: true });
const started = await startWorkbenchServer({ rootDir, port: 0, whatIfService: { calculate: async () => calculatedDraft, createPromotionPreview: async () => { throw new Error("not used"); } } });
const auth = await started.server.testAuthenticate(SESSION_ID);
const adoSelectionAuth = await started.server.testAuthenticate(ADO_SELECTION_SESSION_ID);
const adoCreatePreviewAuth = await started.server.testAuthenticate(ADO_CREATE_PREVIEW_SESSION_ID);
const adoUpdatePreviewAuth = await started.server.testAuthenticate(ADO_UPDATE_PREVIEW_SESSION_ID);
const f2Report = buildF2Report();
const f3Report = buildF3Report();
const f3AdoReminder = renderF3AdoMarkdown(f3Report);
const f4Report = buildF4Report();
const f2RelativePath = "e2e/f2.json";
const f4RelativePath = "e2e/f4.json";
const reviewIdentity = { workbookHash: HASH, downstreamSelectionHash: createHash("sha256").update(JSON.stringify(["AJ_GAP"])).digest("hex"), baselineRunReference: "f2-run-e2e" };
const reviewContextId = createHash("sha256").update(JSON.stringify(reviewIdentity)).digest("hex");
await mkdir(join(rootDir, "e2e"), { recursive: true });
const f2Bytes = Buffer.from(JSON.stringify(f2Report));
const f3Bytes = Buffer.from(JSON.stringify(f3Report));
const f3AdoReminderBytes = Buffer.from(JSON.stringify(f3AdoReminder));
const f4Bytes = Buffer.from(JSON.stringify(f4Report));
const f5Bytes = await readFile(downstreamFixture.paths.f5);
const f6ReportBytes = Buffer.from("# F6 E2E review complete\n", "utf8");
const f1Bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==", "base64");
await writeFile(join(rootDir, f2RelativePath), f2Bytes);
await writeFile(join(rootDir, f3RelativePath), f3Bytes);
await writeFile(join(rootDir, f3AdoReminderRelativePath), f3AdoReminderBytes);
await writeFile(join(rootDir, f4RelativePath), f4Bytes);
await writeFile(join(rootDir, f5RelativePath), f5Bytes);
await writeFile(join(rootDir, f6ReportRelativePath), f6ReportBytes);
await writeFile(join(rootDir, f1RelativePath), f1Bytes);
await seedReviewSession(SESSION_ID, "review_required");
await seedReviewSession(ADO_SELECTION_SESSION_ID, "ado_decision_required");
await seedPreviewSession(ADO_CREATE_PREVIEW_SESSION_ID, { mode: "create", title: `TA Drawing Governance - ${f3Report.workbook.fileName}` });
await seedPreviewSession(ADO_UPDATE_PREVIEW_SESSION_ID, { mode: "existing", workItemReference: "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/42" });
started.server.registerArtifactForTest(SESSION_ID, reviewArtifactId("f2-e2e", SESSION_ID), f2RelativePath, "f2.json", "confidential", "application/json");
started.server.registerArtifactForTest(SESSION_ID, reviewArtifactId("f3-e2e", SESSION_ID), f3RelativePath, "f3.json", "confidential", "application/json");
started.server.registerArtifactForTest(SESSION_ID, reviewArtifactId("f4-e2e", SESSION_ID), f4RelativePath, "f4.json", "confidential", "application/json");
started.server.registerArtifactForTest(SESSION_ID, reviewArtifactId("f5-e2e", SESSION_ID), f5RelativePath, "f5.json", "confidential", "application/json");
started.server.registerArtifactForTest(SESSION_ID, reviewArtifactId("f6-report-e2e", SESSION_ID), f6ReportRelativePath, "f6-report.json", "confidential", "application/json");
started.server.registerArtifactForTest(SESSION_ID, `f1-image:${f1ContentHash}`, f1RelativePath, "f1.png", "confidential", "image/png");
started.server.registerArtifactForTest(ADO_SELECTION_SESSION_ID, reviewArtifactId("f2-e2e", ADO_SELECTION_SESSION_ID), f2RelativePath, "f2.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_SELECTION_SESSION_ID, reviewArtifactId("f3-e2e", ADO_SELECTION_SESSION_ID), f3RelativePath, "f3.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_SELECTION_SESSION_ID, reviewArtifactId("f3-ado-reminder-e2e", ADO_SELECTION_SESSION_ID), f3AdoReminderRelativePath, "Feature3-ADO-Reminder.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_SELECTION_SESSION_ID, reviewArtifactId("f4-e2e", ADO_SELECTION_SESSION_ID), f4RelativePath, "f4.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_SELECTION_SESSION_ID, reviewArtifactId("f5-e2e", ADO_SELECTION_SESSION_ID), f5RelativePath, "f5.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_SELECTION_SESSION_ID, reviewArtifactId("f6-report-e2e", ADO_SELECTION_SESSION_ID), f6ReportRelativePath, "f6-report.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_SELECTION_SESSION_ID, `f1-image:${f1ContentHash}`, f1RelativePath, "f1.png", "confidential", "image/png");
started.server.registerArtifactForTest(ADO_CREATE_PREVIEW_SESSION_ID, reviewArtifactId("f2-e2e", ADO_CREATE_PREVIEW_SESSION_ID), f2RelativePath, "f2.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_CREATE_PREVIEW_SESSION_ID, reviewArtifactId("f3-e2e", ADO_CREATE_PREVIEW_SESSION_ID), f3RelativePath, "f3.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_CREATE_PREVIEW_SESSION_ID, reviewArtifactId("f4-e2e", ADO_CREATE_PREVIEW_SESSION_ID), f4RelativePath, "f4.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_CREATE_PREVIEW_SESSION_ID, reviewArtifactId("f5-e2e", ADO_CREATE_PREVIEW_SESSION_ID), f5RelativePath, "f5.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_CREATE_PREVIEW_SESSION_ID, reviewArtifactId("f6-report-e2e", ADO_CREATE_PREVIEW_SESSION_ID), f6ReportRelativePath, "f6-report.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_CREATE_PREVIEW_SESSION_ID, `f1-image:${f1ContentHash}`, f1RelativePath, "f1.png", "confidential", "image/png");
started.server.registerArtifactForTest(ADO_UPDATE_PREVIEW_SESSION_ID, reviewArtifactId("f2-e2e", ADO_UPDATE_PREVIEW_SESSION_ID), f2RelativePath, "f2.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_UPDATE_PREVIEW_SESSION_ID, reviewArtifactId("f3-e2e", ADO_UPDATE_PREVIEW_SESSION_ID), f3RelativePath, "f3.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_UPDATE_PREVIEW_SESSION_ID, reviewArtifactId("f4-e2e", ADO_UPDATE_PREVIEW_SESSION_ID), f4RelativePath, "f4.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_UPDATE_PREVIEW_SESSION_ID, reviewArtifactId("f5-e2e", ADO_UPDATE_PREVIEW_SESSION_ID), f5RelativePath, "f5.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_UPDATE_PREVIEW_SESSION_ID, reviewArtifactId("f6-report-e2e", ADO_UPDATE_PREVIEW_SESSION_ID), f6ReportRelativePath, "f6-report.json", "confidential", "application/json");
started.server.registerArtifactForTest(ADO_UPDATE_PREVIEW_SESSION_ID, `f1-image:${f1ContentHash}`, f1RelativePath, "f1.png", "confidential", "image/png");
process.stdout.write(`${JSON.stringify({ origin: new URL(started.url).origin, sessionId: SESSION_ID, rootDir })}\n`);
const close = async () => { started.server.server.closeAllConnections(); await started.server.close(); await rm(rootDir, { recursive: true, force: true }); await rm(downstreamFixture.root, { recursive: true, force: true }); process.exit(0); };
process.on("SIGTERM", () => { void close(); });
process.on("SIGINT", () => { void close(); });
process.on("message", async (message) => {
  if (message?.type === "readCookie" && typeof message.requestId === "string") {
    const sessionId = message.sessionId === ADO_SELECTION_SESSION_ID || message.sessionId === ADO_CREATE_PREVIEW_SESSION_ID || message.sessionId === ADO_UPDATE_PREVIEW_SESSION_ID
      ? message.sessionId
      : SESSION_ID;
    const cookie = sessionId === ADO_SELECTION_SESSION_ID
      ? adoSelectionAuth.headers.cookie
      : sessionId === ADO_CREATE_PREVIEW_SESSION_ID
        ? adoCreatePreviewAuth.headers.cookie
        : sessionId === ADO_UPDATE_PREVIEW_SESSION_ID
          ? adoUpdatePreviewAuth.headers.cookie
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
  const sessionId = message.sessionId === ADO_SELECTION_SESSION_ID || message.sessionId === ADO_CREATE_PREVIEW_SESSION_ID || message.sessionId === ADO_UPDATE_PREVIEW_SESSION_ID
    ? message.sessionId
    : undefined;
  process.send?.({ type: "bootstrap", requestId: message.requestId, nonce: await started.server.bootstrap.issueBrowserBootstrap(sessionId) });
});

function reviewArtifactId(kind, sessionId) {
  return `${kind}:${sessionId}`;
}

function savedScenarioDraft(sessionId) {
  return { ...calculatedDraft, draftId: `e2e-draft-${sessionId}`, sessionId, status: "saved" };
}

function buildReviewArtifactUpserts(sessionId) {
  return [
    { artifactId: reviewArtifactId("f2-e2e", sessionId), sessionId, inputRevision: 1, kind: "f2_report", relativePath: f2RelativePath, contentHash: createHash("sha256").update(f2Bytes).digest("hex") },
    { artifactId: reviewArtifactId("f3-e2e", sessionId), sessionId, inputRevision: 1, kind: "f3_report", relativePath: f3RelativePath, contentHash: createHash("sha256").update(f3Bytes).digest("hex"), reviewContext: reviewIdentity },
    { artifactId: reviewArtifactId("f4-e2e", sessionId), sessionId, inputRevision: 1, kind: "f4_calculation", relativePath: f4RelativePath, contentHash: createHash("sha256").update(f4Bytes).digest("hex"), reviewContext: reviewIdentity },
    { artifactId: reviewArtifactId("f5-e2e", sessionId), sessionId, inputRevision: 1, kind: "f5_report", relativePath: f5RelativePath, contentHash: createHash("sha256").update(f5Bytes).digest("hex"), reviewContext: reviewIdentity },
    { artifactId: reviewArtifactId("f6-report-e2e", sessionId), sessionId, inputRevision: 1, kind: "f6_report", relativePath: f6ReportRelativePath, contentHash: createHash("sha256").update(f6ReportBytes).digest("hex"), reviewContext: reviewIdentity },
    ...(sessionId === SESSION_ID ? [{ artifactId: `f1-image:${f1ContentHash}`, sessionId, inputRevision: 1, kind: "f1_image", relativePath: f1RelativePath, contentHash: f1ContentHash, reviewContext: reviewIdentity, metadata: { mediaType: "image/png", description: "AJ_GAP tolerance loop image" } }] : []),
  ];
}

async function seedReviewSession(sessionId, state) {
  const store = await openSessionStore({ rootDir, sessionId });
  try {
    await store.applyCommand({ contractVersion: "f8-session-command-v1", sessionId, commandId: `seed-${state}-${sessionId}`, expectedRevision: 0, command: "upload_workbook", payload: { fileName: "anonymous-ta-workbook.xlsx", workbookBytes: sourceWorkbookBytes, inputClassification: "confidential" } }, async (snapshot) => ({
      snapshot: {
        ...snapshot,
        revision: 1,
        inputRevision: 1,
        state,
        activeAttempt: null,
        downstreamScopeSelection: { workbookContentHash: HASH, selectedWorksheetNames: ["AJ_GAP"], confirmed: true },
        scenarioDrafts: [savedScenarioDraft(sessionId)],
        artifactRefs: [
          { artifactId: reviewArtifactId("f2-e2e", sessionId), kind: "f2_report", revision: 1, validated: true },
          { artifactId: reviewArtifactId("f3-e2e", sessionId), kind: "f3_report", revision: 1, validated: true, reviewContextId },
          { artifactId: reviewArtifactId("f4-e2e", sessionId), kind: "f4_calculation", revision: 1, validated: true, reviewContextId },
          { artifactId: reviewArtifactId("f5-e2e", sessionId), kind: "f5_report", revision: 1, validated: true, reviewContextId },
          { artifactId: reviewArtifactId("f6-report-e2e", sessionId), kind: "f6_report", revision: 1, validated: true, reviewContextId },
          ...(sessionId === SESSION_ID ? [{ artifactId: `f1-image:${f1ContentHash}`, kind: "f1_image", revision: 1, validated: true, reviewContextId }] : []),
        ],
      },
      artifactReferenceOps: {
        upsert: buildReviewArtifactUpserts(sessionId),
      },
    }));
  } finally {
    await store.close();
  }
}

async function seedPreviewSession(sessionId, target) {
  await seedReviewSession(sessionId, "ado_decision_required");
  const store = await openSessionStore({ rootDir, sessionId });
  try {
    await store.applyCommand({
      contractVersion: "f8-session-command-v1",
      sessionId,
      commandId: `seed-preview-${target.mode}-${sessionId}`,
      expectedRevision: 1,
      command: "confirm_ado_decision",
      payload: target.mode === "create"
        ? { decision: "create_new" }
        : { decision: "use_existing", workItemReference: target.workItemReference },
    }, (snapshot) => ({
      snapshot: {
        ...snapshot,
        revision: 2,
        state: "ado_action_pending",
        activeAttempt: null,
      },
      artifactReferenceOps: {
        upsert: buildReviewArtifactUpserts(sessionId),
      },
    }));
  } finally {
    await store.close();
  }
  const rendered = renderF3AdoMarkdown(f3Report);
  const prepareRequest = target.mode === "create"
    ? { mode: "create", title: target.title, nextContent: rendered.markdown, factorCount: f3Report.summary.factorCount }
    : { mode: "existing", workItemReference: target.workItemReference, nextContent: rendered.markdown, factorCount: f3Report.summary.factorCount };
  const actionId = `ado-validation:${sessionId}:2`;
  const confirmationHash = createHash("sha256").update(JSON.stringify([target.mode === "create" ? "WI-900" : "WI-42", "C0", target.mode === "create" ? "1" : "7", rendered.markdown])).digest("hex");
  const hostActions = await createHostActionStore({ rootDir, sessionId });
  try {
    await hostActions.createHostAction(hostActionRequestSchema.parse(createSeededAdoValidationHostAction({
      actionId,
      sessionId,
      expectedRevision: 2,
      confirmationHash,
      prepareRequest,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    })));
    const claim = await hostActions.claimHostAction(actionId, "playwright-seed");
    await hostActions.completeHostAction(hostActionResultSchema.parse({
      contractVersion: "f8-host-action-result-v1",
      actionId,
      hostInstanceId: "playwright-seed",
      leaseId: claim.leaseId,
      status: "completed",
      resultHash: createHash("sha256").update(JSON.stringify({ status: "completed", outcome: { kind: "surface_validation", confirmation: previewConfirmation(target, rendered.markdown, confirmationHash, f3Report.summary.factorCount) } })).digest("hex"),
      payload: {
        status: "completed",
        outcome: {
          kind: "surface_validation",
          confirmation: previewConfirmation(target, rendered.markdown, confirmationHash, f3Report.summary.factorCount),
        },
      },
    }));
  } finally {
    await hostActions.close();
  }
}

function previewConfirmation(target, nextContent, confirmationHash, factorCount) {
  return {
    status: "confirmation_required",
    workItemReference: target.mode === "create" ? "WI-900" : "WI-42",
    ownerReference: "owner-1",
    commentReference: "C0",
    expectedVersion: target.mode === "create" ? "1" : "7",
    beforeContentHash: "b".repeat(64),
    nextContent,
    factorCount,
    confirmationHash,
    diff: [{ before: target.mode === "create" ? "" : "old", after: nextContent, changed: true }],
  };
}

function buildF3Report() {
  return {
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
}

function buildF2Report() {
  const systemSpecification = {
    status: "available",
    lowerSpecLimit: { status: "available", actualValue: -0.15, displayValue: "-0.15", sourceLabel: "*Lower Spec Limit ►", sourceCell: "AJ_GAP!P54", valueOrigin: "numeric_literal" },
    upperSpecLimit: { status: "available", actualValue: 0.05, displayValue: "0.05", sourceLabel: "*Upper Spec Limit ►", sourceCell: "AJ_GAP!P55", valueOrigin: "numeric_literal" },
    targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3.0σ", sourceLabel: "*Target σ Level ►", sourceCell: "AJ_GAP!P56", valueOrigin: "numeric_literal" },
    additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
  };
  const actualFields = {
    factorName: "中心间隙",
    partName: "支架加强组件",
    drawingNumber: "DRW-001-A",
    dimCharacteristicId: "DIM-17",
    partCategory: "CNC",
    nominalValue: 0,
    upperTolerance: 0.05,
    lowerTolerance: -0.05,
    longTermSafetyFactor: 1,
    sigmaLevel: 3,
    distribution: "Normal",
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
      designNominal: -0.05,
      lowerSpecLimit: systemSpecification.lowerSpecLimit,
      upperSpecLimit: systemSpecification.upperSpecLimit,
      targetSigmaLevel: systemSpecification.targetSigmaLevel,
      targetCpk: 1,
      additionalMeanShift: systemSpecification.additionalMeanShift,
    },
    factors: [{ tableId: row.tableId, sourceRow: row.sourceRow, unit: "mm", actualFields: row.actualFields, sourceCells: row.sourceCells }],
  };

  return f2UserReportSchema.parse({
    contractVersion: "v1",
    inputClassification: "confidential",
    status: "completed",
    workbook: { fileName: "anonymous-ta-workbook.xlsx", contentHash: HASH, f1GeneratedAt: "2026-08-25T00:00:00.000Z" },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot: "test/f8-e2e/generated",
    worksheets: [{ worksheetName: "AJ_GAP", status: "ready", toleranceLoopDescription: "Synthetic gap", tolerancePathImageStatus: "available", systemSpecification, systemSpecificationIssues: [], rows: [row], missingFieldSummary: [], f4CalculabilityIssues: [] }],
    f4Handoffs: [handoff],
    adoEvents: [],
    summary: {
      worksheetsChecked: 1,
      blockedWorksheetCount: 0,
      readyWorksheetCount: 1,
      factorRowCount: 1,
      rowsWithRequiredMissing: 0,
      requiredMissingFieldCount: 0,
      missingImageWorksheetCount: 0,
      internalWithinGuidanceCount: 1,
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
  const calculation = createCalculation(request);
  if (calculation.status !== "completed") throw new Error("synthetic calculation failed");
  return f4WorkflowCalculationResultSchema.parse({ contractVersion: "v1", workflowVersion: "f4-f2-v1", outputClassification: "confidential", featureId: "F4", status: "completed", runId: "e2e-run", generatedAt: "2026-08-25T00:00:00.000Z", source: { artifactReference: "Feature2-Report.json", workbookFileName: "anonymous-ta-workbook.xlsx", workbookContentHash: HASH }, calculations: [calculation], summary: { selectedWorksheetCount: 1, completedWorksheetCount: 1 } });
}
