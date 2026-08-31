import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { f2UserReportSchema, f4WorkflowCalculationResultSchema } from "@ai-assist/contracts";
import { buildWorkbenchServer } from "@ai-assist/workbench-server";
import { canonicalSelectedWorksheetSetHash, createSessionStore, openSessionStore } from "@ai-assist/workbench";
import { createCalculation } from "@ai-assist/workbook-catalog";
import { runAgentCommand } from "../../apps/cli/dist/commands/agent.js";
import { classifyAnalyzeIntent } from "../../apps/vscode-extension/dist/analyze-intent.js";
import { importWorkbook } from "../../apps/vscode-extension/dist/workbook-import.js";

const fixtureWorkbookPath = "test/f8-e2e/fixtures/anonymous-ta-workbook.xlsx";
const f1ContentHash = "f".repeat(64);
const f1RelativePath = "synthetic/f1.png";
const sourceF5Path = "runtime/workbench/runner-output/5c39c3ec-3794-4712-930f-3d4fea93cc5f/production/f5/2026-08-26T06-25-06-229Z/Feature5-Report.json";
const sourceF6OptimizationPath = "runtime/workbench/runner-output/5c39c3ec-3794-4712-930f-3d4fea93cc5f/production/f6/2026-08-26T06-25-06-583Z/Feature6-Optimization.json";
const rootDir = await mkdtemp(join(tmpdir(), "chat-entry-e2e-"));
const stageLog = new Map();
const runner = async (job) => {
  const sessionId = readSessionId(job.payload);
  if (sessionId === undefined) throw new Error("runner job missing sessionId");
  const stages = stageLog.get(sessionId) ?? [];
  stages.push(job.stage);
  stageLog.set(sessionId, stages);
  await writeStageArtifact(rootDir, sessionId, job.stage);
  return buildStageResult(rootDir, sessionId, job.stage);
};
const server = await buildWorkbenchServer({ rootDir, runner, queueFactory: immediateQueue, skipWebAssets: false });
await server.listen(server.listenOptions);
const address = server.server.address();
const port = typeof address === "object" && address !== null ? address.port : server.listenOptions.port;
const origin = `http://127.0.0.1:${port}`;
const openedUrls = [];
const launcherProcess = {
  async launch(args) {
    const action = args[1];
    const rootIndex = args.indexOf("--root");
    const launchRoot = rootIndex >= 0 ? args[rootIndex + 1] : rootDir;
    if (action !== "analyze" || launchRoot !== rootDir) throw new Error(`unexpected launch args: ${args.join(" ")}`);
    const sessionId = randomUUID();
    const store = await createSessionStore({ rootDir, sessionId });
    await store.close();
    const bootstrapNonce = await server.bootstrap.issueBrowserBootstrap(sessionId);
    const url = `${origin}/?session=${encodeURIComponent(sessionId)}#bootstrap=${bootstrapNonce}`;
    openedUrls.push(`${origin}/?session=${encodeURIComponent(sessionId)}`);
    return { sessionId, url };
  },
  async importWorkbook(input) {
    return server.importHostWorkbook(input);
  },
};

process.stdout.write(`${JSON.stringify({ origin, rootDir })}\n`);

process.on("message", (message) => { void handleRequest(message); });
process.on("SIGTERM", () => { void close(0); });
process.on("SIGINT", () => { void close(0); });

async function handleRequest(message) {
  if (message?.type !== "chatEntryRequest" || typeof message.requestId !== "string" || typeof message.operation !== "string") return;
  try {
    const result = await runOperation(message.operation, message);
    process.send?.({ type: "chatEntryResult", requestId: message.requestId, ok: true, result });
  } catch (error) {
    process.send?.({ type: "chatEntryResult", requestId: message.requestId, ok: false, error: sanitizedHarnessError(error) });
  }
}

async function runOperation(operation, message) {
  switch (operation) {
    case "runAnalyze":
      return runAnalyze(requiredString(message.prompt, "prompt"));
    case "createSession":
      return createSession();
    case "classifyAnalyzeIntent":
      return classifyAnalyzeIntent(requiredString(message.prompt, "prompt"));
    case "importPhysicalWorkbook":
      return importWorkbook({ sessionId: requiredString(message.sessionId, "sessionId"), workbookPath: requiredString(message.workbookPath, "workbookPath") }, launcherProcess);
    case "importHostWorkbook":
      return server.importHostWorkbook({ requestId: requiredString(message.importRequestId, "importRequestId"), sessionId: requiredString(message.sessionId, "sessionId"), fileName: requiredString(message.fileName, "fileName"), bytes: await hostImportBytes(message) });
    case "readSnapshot":
      return readSnapshot(rootDir, requiredString(message.sessionId, "sessionId"));
    case "authenticate":
      return authenticateBrowserSession(requiredString(message.sessionId, "sessionId"));
    case "stages":
      return stageLog.get(requiredString(message.sessionId, "sessionId")) ?? [];
    default:
      throw new Error(`unknown operation: ${operation}`);
  }
}

async function runAnalyze(prompt) {
  const intent = classifyAnalyzeIntent(prompt);
  if (intent?.kind !== "analyze_ta") throw new Error("invalid analyze prompt");
  const output = await runAgentCommand({ action: "analyze", rootDir }, {
    analyze: async (launchRoot) => launcherProcess.launch(["agent", "analyze", "--root", launchRoot]),
  });
  const sessionId = output.match(/^session: (.+)$/m)?.[1];
  const url = output.match(/^url: (.+)$/m)?.[1];
  if (sessionId === undefined || url === undefined) throw new Error(output);
  let importReceipt;
  if (intent.workbookPath !== undefined) {
    importReceipt = await importWorkbook({ sessionId, workbookPath: intent.workbookPath }, launcherProcess);
  }
  return {
    sessionId,
    url,
    openedUrl: openedUrls.at(-1),
    importReceipt,
    responseText: importReceipt === undefined
      ? "TA Assist Workbench is ready. Upload a workbook to begin."
      : `Workbook accepted. Session ${sessionId} is running in TA Assist Workbench.`,
  };
}

async function createSession() {
  const sessionId = randomUUID();
  const store = await createSessionStore({ rootDir, sessionId });
  await store.close();
  return sessionId;
}

async function hostImportBytes(message) {
  if (message.oversize === true) return new Uint8Array(50 * 1024 * 1024 + 1);
  if (message.generatedZip === true) return new Uint8Array(await readFile(fixtureWorkbookPath));
  if (typeof message.bytesBase64 === "string") return new Uint8Array(Buffer.from(message.bytesBase64, "base64"));
  throw new Error("host import bytes missing");
}

async function authenticateBrowserSession(sessionId) {
  const authentication = await server.testAuthenticate(sessionId);
  setTimeout(() => {
    server.publishEventForTest(sessionId, "runner_progress", { kind: "stage_completed", featureId: "F6", stage: "f6_running", timestamp: new Date().toISOString() });
  }, 250);
  return authentication.headers.cookie;
}

async function immediateQueue(options) {
  return {
    async enqueue(job) {
      await options.sessionStore.persistAttempt({ attemptId: job.attemptId, status: "running", jobId: job.jobId, stage: job.stage });
      if (options.worker === undefined) throw new Error("worker required");
      const result = await options.worker(job);
      const accepted = await markImmediateAttemptResult(options.sessionStore, job, result);
      if (accepted) await applyLocalAdoDecisionIfRequired(job);
      return { jobId: job.jobId, attemptId: job.attemptId, status: accepted ? "completed" : "failed" };
    },
    async cancel() { return false; },
    async reconcile() {},
  };
}

async function markImmediateAttemptResult(sessionStore, job, result) {
  try {
    return await sessionStore.markAttemptResult(job.attemptId, result, "running", job);
  } catch (error) {
    if (result?.status === "completed" && attemptAlreadyAdvanced(error, job.attemptId)) return true;
    throw error;
  }
}

function attemptAlreadyAdvanced(error, attemptId) {
  const typed = error ?? {};
  return typed.code === "validation_error"
    && typeof typed.summary === "string"
    && typed.summary.startsWith(`Attempt result for ${attemptId} cannot switch the active attempt to `);
}

async function applyLocalAdoDecisionIfRequired(job) {
  if (job.stage !== "f3_running") return;
  const sessionId = readSessionId(job.payload);
  if (sessionId === undefined) return;
  const snapshot = await readSnapshot(rootDir, sessionId);
  if (snapshot.state !== "ado_decision_required") return;
  const cookie = (await server.testAuthenticate(sessionId)).headers.cookie;
  const csrfResponse = await fetch(`${origin}/api/csrf`, { headers: { cookie } });
  if (!csrfResponse.ok) throw new Error(`csrf fetch failed (${csrfResponse.status})`);
  const { csrfToken } = await csrfResponse.json();
  const response = await fetch(`${origin}/api/sessions/${encodeURIComponent(sessionId)}/commands`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": csrfToken, cookie },
    body: JSON.stringify({
      contractVersion: "f8-session-command-v1",
      sessionId,
      commandId: `${job.attemptId}:ado-local-only`,
      expectedRevision: snapshot.revision,
      command: "confirm_ado_decision",
      payload: { decision: "local_only" },
    }),
  });
  if (!response.ok) throw new Error(`local ADO decision failed (${response.status})`);
}

function buildStageResult(rootDir, sessionId, stage) {
  const workbookHash = readManagedWorkbookHash(rootDir, sessionId);
  const reviewContext = { workbookHash, downstreamSelectionHash: canonicalSelectedWorksheetSetHash(["Synthetic_A"]), baselineRunReference: "synthetic-f2-run" };
  if (stage === "f0_validating") {
    return {
      featureId: "F0",
      status: "completed",
      versions: ["v1", "internal-v1"],
      worksheetCapabilities: [{ worksheetName: "Synthetic_A", whatIfAvailable: true }],
      selectionPrompt: {
        contractVersion: "v1",
        inputClassification: "confidential",
        status: "selectionRequired",
        workbook: { fileName: "anonymous-ta-workbook.xlsx", contentHash: workbookHash },
        options: [{ selectionIndex: 1, worksheetName: "Synthetic_A", toleranceLoopDescription: "Synthetic tolerance loop", worksheetKind: "analysis", source: { discoveryMethod: "worksheet_scan", descriptionCell: "Synthetic_A!A1", worksheetAnchor: "Synthetic_A!A1" } }],
      },
      events: [{ eventName: "runner_progress", payload: { kind: "stage_completed", featureId: "F0", stage: "validate_capabilities" } }],
    };
  }
  if (stage === "f1_f2_running") {
    return {
      featureId: "F2",
      status: "completed",
      runId: "synthetic-f2-run",
      f2Root: join(rootDir, "synthetic", sessionId, "f2"),
      workbookContentHash: workbookHash,
      report: buildF2Report(workbookHash),
      events: [{ eventName: "runner_progress", payload: { kind: "stage_completed", featureId: "F2", stage: "f1_f2" } }],
    };
  }
  const artifact = artifactRef(sessionId, stage);
  return {
    featureId: stage === "f3_running" ? "F3" : stage === "f4_running" ? "F4" : stage === "f5_running" ? "F5" : "F6",
    status: "completed",
    governance: { status: stage === "f3_running" ? "governance_required" : "completed" },
    reviewContext,
    artifactReferences: [artifact],
    events: [{ eventName: "runner_progress", payload: { kind: "stage_completed", featureId: stage, stage } }],
  };
}

async function writeStageArtifact(rootDir, sessionId, stage) {
  if (stage === "f0_validating") return;
  if (stage === "f1_f2_running") {
    const f2Root = join(rootDir, "synthetic", sessionId, "f2");
    await writeJson(join(f2Root, "Feature2-Report.json"), buildF2Report(readManagedWorkbookHash(rootDir, sessionId)));
    return;
  }
  const artifact = artifactRef(sessionId, stage);
  if (stage === "f5_running" || stage === "f6_running") {
    await mkdir(dirname(join(rootDir, artifact.relativePath)), { recursive: true });
    await writeFile(join(rootDir, artifact.relativePath), await readFile(stage === "f5_running" ? sourceF5Path : sourceF6OptimizationPath));
    return;
  }
  await writeJson(join(rootDir, artifact.relativePath), buildF3F4Artifact(readManagedWorkbookHash(rootDir, sessionId), stage));
}

function artifactRef(sessionId, stage) {
  const kindByStage = {
    f3_running: "f3_report",
    f4_running: "f4_calculation",
    f5_running: "f5_report",
    f6_running: "f6_report",
  };
  const kind = kindByStage[stage];
  if (kind === undefined) throw new Error(`unsupported synthetic stage ${stage}`);
  const relativePath = `synthetic/${sessionId}/${kind}.json`;
  return { artifactId: `${kind}:synthetic`, kind, relativePath, contentHash: artifactContentHash(readManagedWorkbookHash(rootDir, sessionId), stage) };
}

function buildF2Report(workbookHash) {
  const systemSpecification = {
    status: "available",
    lowerSpecLimit: { status: "available", actualValue: -0.15, displayValue: "-0.15", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Synthetic_A!P54", valueOrigin: "numeric_literal" },
    upperSpecLimit: { status: "available", actualValue: 0.05, displayValue: "0.05", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Synthetic_A!P55", valueOrigin: "numeric_literal" },
    targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3.0σ", sourceLabel: "*Target σ Level ►", sourceCell: "Synthetic_A!P56", valueOrigin: "numeric_literal" },
    additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
  };
  const actualFields = buildActualFields();
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
    worksheetName: "Synthetic_A",
    tableId: "table-a",
    sourceRow: 2,
    imageReference: { artifact: "f1", relativePath: f1RelativePath, contentHash: f1ContentHash, worksheetName: "Synthetic_A" },
    actualFields,
    displayFields,
    sourceCells: { factorName: "Synthetic_A!A2" },
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
    workbookContentHash: workbookHash,
    worksheetName: "Synthetic_A",
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
    workbook: { fileName: "anonymous-ta-workbook.xlsx", contentHash: workbookHash, f1GeneratedAt: "2026-08-31T00:00:00.000Z" },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot: "synthetic/f2",
    artifactRoot: "test/f8-e2e/generated",
    worksheets: [{ worksheetName: "Synthetic_A", status: "ready", toleranceLoopDescription: "Synthetic tolerance loop", tolerancePathImageStatus: "available", systemSpecification, systemSpecificationIssues: [], rows: [row], missingFieldSummary: [], f4CalculabilityIssues: [] }],
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

function buildF3F4Artifact(workbookHash, stage) {
  if (stage === "f3_running") return buildF3Report(workbookHash);
  if (stage === "f4_running") return buildF4Report(workbookHash);
  throw new Error(`unsupported synthetic artifact stage ${stage}`);
}

function artifactContentHash(workbookHash, stage) {
  if (stage === "f5_running") return createHash("sha256").update(readFileSync(sourceF5Path)).digest("hex");
  if (stage === "f6_running") return createHash("sha256").update(readFileSync(sourceF6OptimizationPath)).digest("hex");
  return createHash("sha256").update(`${JSON.stringify(buildF3F4Artifact(workbookHash, stage), null, 2)}\n`).digest("hex");
}

function buildActualFields() {
  return {
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
}

function buildF3Report(workbookHash) {
  return {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: "governance_required",
    artifactRoot: "test/f8-e2e/generated",
    workbook: { fileName: "Anonymous.xlsx", contentHash: workbookHash },
    worksheets: [
      {
        worksheetName: "Synthetic_A",
        toleranceLoopDescription: "Synthetic tolerance loop",
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
            imageReference: { artifact: "f1", relativePath: f1RelativePath, contentHash: f1ContentHash, worksheetName: "Synthetic_A" },
            source: { worksheetName: "Synthetic_A", tableId: "table-a", sourceRow: 2, sourceCells: { factorName: "Synthetic_A!A2" } },
          },
        ],
      },
    ],
    ado: { status: "not_requested" },
    summary: { worksheetCount: 1, factorCount: 1, completeCount: 0, governanceRequiredCount: 1, duplicateConflictCount: 0 },
  };
}

function buildF4Report(workbookHash) {
  const text = (rawText, sourceCell) => ({ status: "available", rawText, sourceCell });
  const number = (numericValue, sourceCell) => ({ status: "available", rawText: String(numericValue), sourceCell, numericValue, unit: "mm" });
  const request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    projectReference: "project",
    runReference: "run-1",
    worksheetAnalysisAssets: {
      contractVersion: "v1",
      workbook: { classification: "confidential", contentHash: workbookHash, catalogContractVersion: "v1" },
      worksheets: [{
        worksheetName: "Synthetic_A",
        toleranceLoopDescription: "Synthetic tolerance loop",
        factorTables: [{
          tableId: "table-a",
          headerRow: 1,
          dataRange: { startRow: 2, endRow: 2 },
          columns: [
            { semanticField: "factorName", headerText: "Factor", sourceColumn: "A" },
            { semanticField: "nominalValue", headerText: "Nominal", sourceColumn: "B" },
            { semanticField: "upperTolerance", headerText: "Upper", sourceColumn: "C" },
            { semanticField: "lowerTolerance", headerText: "Lower", sourceColumn: "D" },
            { semanticField: "longTermSafetyFactor", headerText: "LTSF", sourceColumn: "E" },
            { semanticField: "standardDeviation", headerText: "Sigma", sourceColumn: "F" },
            { semanticField: "distribution", headerText: "Distribution", sourceColumn: "G" },
            { semanticField: "unit", headerText: "Unit", sourceColumn: "H" },
          ],
          rows: [{ sourceRow: 2, fields: { factorName: text("AJ center to C-bucket", "Synthetic_A!A2"), nominalValue: number(0, "Synthetic_A!B2"), upperTolerance: number(0.05, "Synthetic_A!C2"), lowerTolerance: number(-0.05, "Synthetic_A!D2"), longTermSafetyFactor: number(1, "Synthetic_A!E2"), standardDeviation: number(3, "Synthetic_A!F2"), distribution: text("normal", "Synthetic_A!G2"), unit: text("mm", "Synthetic_A!H2") } }],
        }],
        formulaCells: [],
        imageAssets: [],
      }],
    },
    requiredFieldCheck: { contractVersion: "v1", inputClassification: "confidential", workbookContentHash: workbookHash, status: "readyForNextCheck", blockingIssues: [], advisoryIssues: [], summary: { worksheetsChecked: 1, factorTablesChecked: 1, factorRowsChecked: 1, blockingIssueCount: 0, advisoryIssueCount: 0 } },
    exceptionResolution: { contractVersion: "v1", inputClassification: "confidential", workbookContentHash: workbookHash, knowledgeBaseVersion: "v1", status: "readyToContinue", readyToContinue: true, acceptedExceptions: [], pendingExceptions: [], summary: { actionableSignalCount: 0, acceptedExceptionCount: 0, pendingExceptionCount: 0, invalidCandidateCount: 0 } },
    worksheetSelection: { worksheetName: "Synthetic_A", tableId: "table-a" },
    systemSpecification: { designNominal: 0, lowerSpecLimit: -0.1, upperSpecLimit: 0.1, targetSigmaLevel: 3, targetCpk: 1, additionalMeanShift: 0 },
    criticality: "none",
    scenarioOverrides: [],
  };
  const calculation = createCalculation(request);
  if (calculation.status !== "completed") throw new Error("synthetic calculation failed");
  return f4WorkflowCalculationResultSchema.parse({ contractVersion: "v1", workflowVersion: "f4-f2-v1", outputClassification: "confidential", featureId: "F4", status: "completed", runId: "e2e-run", generatedAt: "2026-08-31T00:00:00.000Z", source: { artifactReference: "Feature2-Report.json", workbookFileName: "anonymous-ta-workbook.xlsx", workbookContentHash: workbookHash }, calculations: [calculation], summary: { selectedWorksheetCount: 1, completedWorksheetCount: 1 } });
}

async function readSnapshot(rootDir, sessionId) {
  const store = await openSessionStore({ rootDir, sessionId });
  try {
    return await store.readSnapshot();
  } finally {
    await store.close();
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readManagedWorkbookHash(rootDir, sessionId) {
  const active = JSON.parse(readFileSync(join(rootDir, "runtime", "workbench", "registries", "active-workbooks", `${sessionId}.json`), "utf8"));
  const artifact = JSON.parse(readFileSync(join(rootDir, "runtime", "workbench", "registries", "artifacts", `${sessionId}.json`), "utf8"));
  const relativePath = artifact[active.artifactId]?.relativePath;
  if (typeof relativePath !== "string") return "a".repeat(64);
  return createHash("sha256").update(readFileSync(join(rootDir, relativePath))).digest("hex");
}

function readSessionId(payload) {
  return typeof payload === "object" && payload !== null && "sessionId" in payload && typeof payload.sessionId === "string" ? payload.sessionId : undefined;
}

function requiredString(value, name) {
  if (typeof value !== "string") throw new Error(`${name} is required`);
  return value;
}

function sanitizedHarnessError(error) {
  const typed = error ?? {};
  return {
    code: typeof typed.code === "string" ? typed.code : "harness_error",
    summary: typeof typed.summary === "string" ? typed.summary : error instanceof Error ? error.message : "Chat E2E harness failed.",
    suggestedAction: typeof typed.suggestedAction === "string" ? typed.suggestedAction : "Inspect the chat E2E harness output.",
    affectedInputReferences: Array.isArray(typed.affectedInputReferences) ? typed.affectedInputReferences.filter((value) => typeof value === "string" && !value.includes(":\\")) : [],
  };
}

async function close(code) {
  server.server.closeAllConnections();
  await server.close();
  await rm(rootDir, { recursive: true, force: true });
  process.exit(code);
}