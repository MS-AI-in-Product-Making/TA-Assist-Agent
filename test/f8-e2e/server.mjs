import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { f4WorkflowCalculationResultSchema } from "@ai-assist/contracts";
import { createCalculation } from "@ai-assist/workbook-catalog";
import { openSessionStore } from "@ai-assist/workbench";
import { startWorkbenchServer } from "@ai-assist/workbench-server";

const SESSION_ID = "40404040-4040-4404-8404-404040404040";
const sourceWorkbookPath = "test/f8-e2e/fixtures/anonymous-ta-workbook.xlsx";
const sourceWorkbookBytes = await readFile(sourceWorkbookPath);
const HASH = createHash("sha256").update(sourceWorkbookBytes).digest("hex");
const rootDir = join(".tmp", `f8-e2e-${randomUUID()}`);
const calculatedDraft = {
  contractVersion: "f8-scenario-draft-v1", draftId: "e2e-draft", sessionId: SESSION_ID, worksheetName: "AJ_GAP", inputRevision: 1, status: "calculated", mode: "WHAT_IF",
  baselineWorkbookHash: HASH, baselineRunReference: "run-1", change: { upperTolerance: 0.04 }, calculationReference: "what-if:e2e-draft",
  calculationMetrics: { mean: 0, rssSigma: 0.018, cp: 1.7, cpkL: 1.6, cpkU: 1.8, cpk: 1.6, statisticalMargin: 0.1, worstCaseMargin: 0.05 },
  factorIdentity: { worksheetName: "AJ_GAP", tableId: "table-a", sourceRow: 2, factorName: "AJ center to C-bucket", unit: "mm" },
};
await rm(rootDir, { recursive: true, force: true });
const started = await startWorkbenchServer({ rootDir, port: 0, whatIfService: { calculate: async () => calculatedDraft, createPromotionPreview: async () => { throw new Error("not used"); } } });
const auth = await started.server.testAuthenticate(SESSION_ID);
const report = buildF4Report();
const relativePath = "e2e/f4.json";
const reviewIdentity = { workbookHash: HASH, downstreamSelectionHash: createHash("sha256").update(JSON.stringify(["AJ_GAP"])).digest("hex"), baselineRunReference: "f2-run-e2e" };
const reviewContextId = createHash("sha256").update(JSON.stringify(reviewIdentity)).digest("hex");
await mkdir(join(rootDir, "e2e"), { recursive: true });
const bytes = Buffer.from(JSON.stringify(report));
await writeFile(join(rootDir, relativePath), bytes);
const store = await openSessionStore({ rootDir, sessionId: SESSION_ID });
try {
  await store.applyCommand({ contractVersion: "f8-session-command-v1", sessionId: SESSION_ID, commandId: "seed-e2e", expectedRevision: 0, command: "upload_workbook", payload: { fileName: "anonymous-ta-workbook.xlsx", workbookBytes: sourceWorkbookBytes, inputClassification: "confidential" } }, async (snapshot) => ({
    snapshot: { ...snapshot, revision: 1, inputRevision: 1, state: "review_required", activeAttempt: null, downstreamScopeSelection: { workbookContentHash: HASH, selectedWorksheetNames: ["AJ_GAP"], confirmed: true }, artifactRefs: [{ artifactId: "f4-e2e", kind: "f4_calculation", revision: 1, validated: true, reviewContextId }] },
    artifactReferenceOps: { upsert: [{ artifactId: "f4-e2e", sessionId: SESSION_ID, inputRevision: 1, kind: "f4_calculation", relativePath, contentHash: createHash("sha256").update(bytes).digest("hex"), reviewContext: reviewIdentity }] },
  }));
} finally { await store.close(); }
started.server.registerArtifactForTest(SESSION_ID, "f4-e2e", relativePath, "f4.json", "confidential", "application/json");
process.stdout.write(`${JSON.stringify({ origin: new URL(started.url).origin, sessionId: SESSION_ID, rootDir })}\n`);
const close = async () => { started.server.server.closeAllConnections(); await started.server.close(); await rm(rootDir, { recursive: true, force: true }); process.exit(0); };
process.on("SIGTERM", () => { void close(); });
process.on("SIGINT", () => { void close(); });
process.on("message", async (message) => {
  if (message?.type === "readCookie" && typeof message.requestId === "string") {
    process.send?.({ type: "cookie", requestId: message.requestId, cookie: auth.headers.cookie });
    return;
  }
  if (message?.type !== "issueBootstrap" || typeof message.requestId !== "string") return;
  process.send?.({ type: "bootstrap", requestId: message.requestId, nonce: await started.server.bootstrap.issueBrowserBootstrap() });
});

function buildF4Report() {
  const text = (rawText, sourceCell) => ({ status: "available", rawText, sourceCell });
  const number = (numericValue, sourceCell) => ({ status: "available", rawText: String(numericValue), sourceCell, numericValue, unit: "mm" });
  const request = { contractVersion: "v1", inputClassification: "confidential", projectReference: "project", runReference: "run-1", worksheetAnalysisAssets: { contractVersion: "v1", workbook: { classification: "confidential", contentHash: HASH, catalogContractVersion: "v1" }, worksheets: [{ worksheetName: "AJ_GAP", toleranceLoopDescription: "Synthetic gap", factorTables: [{ tableId: "table-a", headerRow: 1, dataRange: { startRow: 2, endRow: 2 }, columns: [{ semanticField: "factorName", headerText: "Factor", sourceColumn: "A" }, { semanticField: "nominalValue", headerText: "Nominal", sourceColumn: "B" }, { semanticField: "upperTolerance", headerText: "Upper", sourceColumn: "C" }, { semanticField: "lowerTolerance", headerText: "Lower", sourceColumn: "D" }, { semanticField: "longTermSafetyFactor", headerText: "LTSF", sourceColumn: "E" }, { semanticField: "standardDeviation", headerText: "Sigma", sourceColumn: "F" }, { semanticField: "distribution", headerText: "Distribution", sourceColumn: "G" }, { semanticField: "unit", headerText: "Unit", sourceColumn: "H" }], rows: [{ sourceRow: 2, fields: { factorName: text("AJ center to C-bucket", "AJ_GAP!A2"), nominalValue: number(0, "AJ_GAP!B2"), upperTolerance: number(0.05, "AJ_GAP!C2"), lowerTolerance: number(-0.05, "AJ_GAP!D2"), longTermSafetyFactor: number(1, "AJ_GAP!E2"), standardDeviation: number(3, "AJ_GAP!F2"), distribution: text("normal", "AJ_GAP!G2"), unit: text("mm", "AJ_GAP!H2") } }] }], formulaCells: [], imageAssets: [] }] }, requiredFieldCheck: { contractVersion: "v1", inputClassification: "confidential", workbookContentHash: HASH, status: "readyForNextCheck", blockingIssues: [], advisoryIssues: [], summary: { worksheetsChecked: 1, factorTablesChecked: 1, factorRowsChecked: 1, blockingIssueCount: 0, advisoryIssueCount: 0 } }, exceptionResolution: { contractVersion: "v1", inputClassification: "confidential", workbookContentHash: HASH, knowledgeBaseVersion: "v1", status: "readyToContinue", readyToContinue: true, acceptedExceptions: [], pendingExceptions: [], summary: { actionableSignalCount: 0, acceptedExceptionCount: 0, pendingExceptionCount: 0, invalidCandidateCount: 0 } }, worksheetSelection: { worksheetName: "AJ_GAP", tableId: "table-a" }, systemSpecification: { designNominal: 0, lowerSpecLimit: -0.1, upperSpecLimit: 0.1, targetSigmaLevel: 3, targetCpk: 1, additionalMeanShift: 0 }, criticality: "none", scenarioOverrides: [] };
  const calculation = createCalculation(request);
  if (calculation.status !== "completed") throw new Error("synthetic calculation failed");
  return f4WorkflowCalculationResultSchema.parse({ contractVersion: "v1", workflowVersion: "f4-f2-v1", outputClassification: "confidential", featureId: "F4", status: "completed", runId: "e2e-run", generatedAt: "2026-08-25T00:00:00.000Z", source: { artifactReference: "Feature2-Report.json", workbookFileName: "anonymous-ta-workbook.xlsx", workbookContentHash: HASH }, calculations: [calculation], summary: { selectedWorksheetCount: 1, completedWorksheetCount: 1 } });
}
