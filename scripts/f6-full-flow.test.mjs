import { createHash } from "node:crypto";
import { execFile, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateF6Scenario,
  createComparisonPlaceholder,
  createF6OptimizationV4,
  createF5DataInterpretation,
} from "../packages/workbook-catalog/dist/index.js";
import {
  createF6ArtifactBundleFixture,
  fixtureFileSha256,
  installF5CurrentObservationLedger,
  installF6V2Evidence,
  installRequiredMultimodalV3,
  rewriteFixtureJson,
} from "./f6-artifact-test-fixture.mjs";
import { createF6FinalReportProjection } from "./f6-final-report.mjs";
import { runF6Cli, runF6FullValidation } from "./run-f6-full-validation.mjs";
import { loadF6ArtifactBundle } from "./f6-artifact-loader.mjs";
import { validateExistingF6Artifact } from "./verify-current-f6.mjs";
import * as candidateLifecycle from "./f6-candidate.mjs";
import {
  allocateAnalysisWorkspace, createInitialAnalysisWorkspaceSummary, recordAnalysisStageCompleted,
  recordAnalysisStageStarted, validateExistingF6, writeAnalysisWorkspaceSummary,
} from "../packages/workflow-runners/dist/index.js";

const execFileAsync = promisify(execFile);
const cleanup = [];
const deprecatedF6ReportArtifactName = ["Feature6", "Composed", "Report"].join("-");
const HASH = "a".repeat(64);
const PDF = Buffer.from("%PDF-1.7\nvalidated report\n");
const REQUEST_CONTEXT = {
  requestedAt: "2026-09-16T08:30:12.000Z",
  utcOffsetMinutes: -420,
  source: "cli",
};
const UPDATED_ADO = {
  status: "updated",
  operation: "updated",
  organization: "contoso",
  project: "Devices",
  workItemId: 1119604,
};
const interactionLanguage = {
  languageTag: "en-US",
  uiCatalogLanguage: "en",
  lockedAtTurnId: "turn-1",
  source: "workflow_start",
  fallbackUsed: false,
};

function createV4FinalReportStub({ worksheetNames = ["Analysis-A"], blockedWorksheetNames = [] } = {}) {
  const worksheetDispositions = [
    ...worksheetNames.map((worksheetName) => ({ worksheetName, disposition: "CONDITIONAL_PASS" })),
    ...blockedWorksheetNames.map((worksheetName) => ({ worksheetName, disposition: "FAIL" })),
  ];
  const workbookDisposition = blockedWorksheetNames.length > 0 ? "FAIL" : "CONDITIONAL_PASS";
  return {
    markdown: `# F6 final report\n\n${worksheetNames.map((worksheetName) => `Worksheet: ${worksheetName}`).join("\n")}\n`,
    reportSummary: {
      workbookDisposition,
      worksheetDispositions,
    },
    projection: {
      schemaVersion: "ta-engineering-report-projection-v1",
      title: "F6 final report",
      workbookDisposition,
      worksheetDispositions,
      workbook: { fileName: "Demo.xlsx", contentHash: HASH },
      worksheets: worksheetDispositions.map(({ worksheetName, disposition }) => ({
        worksheetName,
        toleranceLoopDescription: `${worksheetName} loop`,
        disposition,
        requiredAction: disposition === "FAIL" ? "Blocked" : "Review",
        findings: ["Stub report content for v4 full-flow tests."],
        assumptions: [],
        clarifications: [],
        gatingEvidenceReferences: ["F4:Analysis-A", "F5-multimodal:Analysis-A"],
      })),
    },
  };
}

function createMockV4Optimization() {
  const bundle = createF6ArtifactBundleFixture();
  installRequiredMultimodalV3(bundle);
  cleanup.push(bundle.root);
  const loaded = loadF6ArtifactBundle({
    ...bundle,
    interactionLanguage,
    requireMultimodalV3: true,
    publishRoot: bundle.publishRoot,
    analysisRequestContext: REQUEST_CONTEXT,
  });
  if (loaded.status !== "accepted") throw new Error(`failed to build mock v4 optimization fixture: ${JSON.stringify(loaded)}`);
  const { analysisRequestContext: _loadedAnalysisRequestContext, ...optimizationRequest } = loaded.request;
  return createF6OptimizationV4(optimizationRequest, {
    interactionLanguage,
    multimodalInterpretation: loaded.modelInterpretation,
    multimodalReference: loaded.inputDecisions.modelInterpretation.artifactReference,
    ...(loaded.optimizationTargets === undefined ? {} : { optimizationTargets: loaded.optimizationTargets }),
    optimizationTargetsDecision: loaded.inputDecisions.optimizationTargets,
  });
}

afterEach(() => {
  for (const target of cleanup.splice(0)) rmSync(target, { recursive: true, force: true });
});

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function setup({ status = "completed" } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "f6-full-flow-"));
  cleanup.push(root);
  const publishRoot = path.join(root, "publish");
  const runRoot = path.join(publishRoot, "f6-runs", "run-1");
  mkdirSync(publishRoot);
  const optimization = createMockV4Optimization();
  const reportSummary = {
    workbookDisposition: status === "partially_completed" ? "CONDITIONAL_PASS" : "PASS",
    worksheetDispositions: [{ worksheetName: "Analysis-A", disposition: "PASS" }],
  };
  const finalReport = {
    markdown: "# F6 final report\n",
    reportSummary,
    projection: {
      schemaVersion: "ta-engineering-report-projection-v1",
      title: "F6 final report",
      workbookDisposition: reportSummary.workbookDisposition,
      worksheetDispositions: reportSummary.worksheetDispositions,
      workbook: { fileName: "Demo.xlsx", contentHash: HASH },
      worksheets: [{
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "Loop A",
        disposition: "PASS",
        requiredAction: "None",
        findings: ["Validated multimodal context."],
        assumptions: [],
        clarifications: [],
        gatingEvidenceReferences: ["F4:Analysis-A", "F5-multimodal:Analysis-A"],
      }],
    },
  };
  const renameCalls = [];
  const deps = {
    parseArgs: vi.fn(() => ({
      f2ArtifactRoot: path.join(publishRoot, "f2"),
      f3ArtifactRoot: path.join(publishRoot, "f3"),
      f4ArtifactRoot: path.join(publishRoot, "f4"),
      f5ArtifactRoot: path.join(publishRoot, "f5"),
      selectedWorksheetNames: ["Analysis-A"],
      interactionLanguage,
      analysisRequestContext: REQUEST_CONTEXT,
      modelInterpretationArtifact: path.join(publishRoot, "multimodal.json"),
      expectedModelInterpretationContentHash: HASH,
    })),
    resolveLayout: vi.fn(() => ({
      artifactSetVersion: "f6-artifact-set-v3",
      runId: "2026-08-17T01-02-03-456Z",
      runRoot,
      publishRoot,
      optimizationJsonName: "Feature6-Optimization.json",
      finalReportMdName: "Feature6-Report.md",
      finalReportPdfName: "Feature6-Report.pdf",
      runSummaryJsonName: "Feature6-Run-Summary.json",
      manifestName: "manifest.json",
    })),
    loadBundle: vi.fn(() => ({
      status: "accepted",
      request: { request: true, analysisRequestContext: REQUEST_CONTEXT },
      f2Report: { f2: true },
      f3Report: { f3: true },
      f4Report: { f4: true },
      f5Report: { f5: true },
      modelInterpretation: { contractVersion: "f5-multimodal-artifact-v3" },
      inputDecisions: {
        analysisContext: { outcome: "NOT_PROVIDED" },
        optimizationTargets: { outcome: "NOT_PROVIDED" },
        modelInterpretation: { outcome: "CALLER_AUTHORIZED", artifactReference: { artifact: "multimodal.json", contentHash: HASH } },
      },
      blockedWorksheets: [{ worksheetName: "Blocked-A", findings: [] }],
      sourceReferences: {
        f2: { artifact: "Feature2-Report.json", contentHash: "a".repeat(64) },
        f3: { artifact: "Feature3-Report.json", contentHash: "b".repeat(64) },
        f4: { artifact: "Feature4-Calculation.json", contentHash: "c".repeat(64) },
        f5: { artifact: "Feature5-Report.json", contentHash: "d".repeat(64) },
      },
    })),
    createOptimization: vi.fn(() => optimization),
    createFinalReport: vi.fn(() => finalReport),
    renderFinalReportPdf: vi.fn(() => PDF),
    renderOptimization: vi.fn(() => "# F6 optimization\n"),
    rename: (from, to) => {
      renameCalls.push(path.basename(to));
      renameSync(from, to);
    },
  };
  return { root, publishRoot, runRoot, optimization, finalReport, reportSummary, renameCalls, deps };
}

function workspaceSetup() {
  const context = setup();
  const workbookPath = path.join(context.root, "Anonymous.xlsx");
  writeFileSync(workbookPath, "controlled source workbook");
  const contentHash = sha256(readFileSync(workbookPath));
  const layout = allocateAnalysisWorkspace({
    testRoot: path.join(context.root, "analyses"), workbookFileName: "Anonymous.xlsx",
    workbookContentHash: contentHash, now: new Date(),
  });
  let summary = createInitialAnalysisWorkspaceSummary(layout);
  for (const stage of ["f1", "f2", "f3", "f4", "f5"]) {
    const file = path.join(layout.stagePaths[stage], "fixture.json");
    writeFileSync(file, "{}");
    summary = recordAnalysisStageCompleted(recordAnalysisStageStarted(summary, stage), stage,
      { fixture: path.relative(layout.analysisRoot, file).split(path.sep).join("/") });
  }
  writeAnalysisWorkspaceSummary(layout, summary);
  writeFileSync(path.join(layout.stagePaths.f1, "Feature1-Report.json"), JSON.stringify({
    workbooks: [{ workbookPath, workbook: summary.workbook }],
  }));
  for (const stage of ["f2", "f3", "f4", "f5"]) {
    writeFileSync(path.join(layout.stagePaths[stage], stage === "f4" ? "Feature4-Calculation.json" : `Feature${stage[1]}-Report.json`),
      JSON.stringify(stage === "f3" ? { ado: { status: "confirmation_required" } } : {}));
  }
  const modelPath = path.join(layout.stagePaths.f6, "evidence", "model-interpretation", "Feature6-Model-Interpretation.json");
  mkdirSync(path.dirname(modelPath), { recursive: true });
  writeFileSync(modelPath, '{"contractVersion":"controlled-loader-fixture"}');
  const modelHash = sha256(readFileSync(modelPath));
  const optimization = JSON.parse(JSON.stringify(context.optimization).replaceAll(HASH, contentHash));
  optimization.provenance.multimodalReference = { artifact: "Feature6-Model-Interpretation.json", contentHash: modelHash };
  const loaded = context.deps.loadBundle();
  loaded.inputDecisions.modelInterpretation.artifactReference = optimization.provenance.multimodalReference;
  loaded.sourceReferences = Object.fromEntries(["f2", "f3", "f4", "f5"].map((stage) => [stage, optimization.provenance[`${stage}Reference`]]));
  loaded.sourceReferences.modelInterpretation = optimization.provenance.multimodalReference;
  const parsed = {
    ...context.deps.parseArgs(), analysisRoot: layout.analysisRoot,
    f2ArtifactRoot: layout.stagePaths.f2, f3ArtifactRoot: layout.stagePaths.f3,
    f4ArtifactRoot: layout.stagePaths.f4, f5ArtifactRoot: layout.stagePaths.f5,
    modelInterpretationArtifact: modelPath, expectedModelInterpretationContentHash: modelHash,
  };
  const deps = {
    ...context.deps,
    parseArgs: () => parsed,
    resolveLayout: () => ({
      ...context.deps.resolveLayout(), runRoot: layout.stagePaths.f6, publishRoot: layout.analysisRoot,
      artifactSetVersion: "f6-artifact-set-v4", allowExistingRunRoot: true,
      finalReportMdName: "Anonymous - TA ENGINEERING ANALYSIS REPORT.md",
      finalReportPdfName: "Anonymous - TA ENGINEERING ANALYSIS REPORT.pdf",
    }),
    loadBundle: () => loaded,
    createOptimization: () => optimization,
  };
  return { layout, deps, args: [layout.stagePaths.f2, layout.stagePaths.f3, layout.stagePaths.f4, layout.stagePaths.f5, "--analysis-root", layout.analysisRoot] };
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function createRealBundle(options) {
  const bundle = createF6ArtifactBundleFixture(options);
  installRequiredMultimodalV3(bundle);
  cleanup.push(bundle.root);
  return bundle;
}

function runRealF6(bundle, runId, dependencyOverrides = {}, parsedOverrides = {}) {
  const runRoot = path.join(bundle.publishRoot, "f6-runs", runId);
  const parsed = { ...bundle, interactionLanguage, analysisRequestContext: REQUEST_CONTEXT, ...parsedOverrides };
  if (!Object.hasOwn(parsedOverrides, "modelInterpretationArtifact")
    && typeof bundle.modelInterpretationArtifactRoot === "string"
    && typeof bundle.modelInterpretationArtifact === "string") {
    parsed.modelInterpretationArtifact = path.join(
      bundle.modelInterpretationArtifactRoot,
      bundle.modelInterpretationArtifact,
    );
  }
  const result = runF6FullValidation({}, {
    parseArgs: () => parsed,
    resolveLayout: () => ({
      artifactSetVersion: "f6-artifact-set-v3",
      runId,
      runRoot,
      publishRoot: bundle.publishRoot,
      optimizationJsonName: "Feature6-Optimization.json",
      finalReportMdName: "Feature6-Report.md",
      finalReportPdfName: "Feature6-Report.pdf",
      runSummaryJsonName: "Feature6-Run-Summary.json",
      manifestName: "manifest.json",
    }),
    createFinalReport: dependencyOverrides.createFinalReport ?? ((input) => {
      const reportScope = input.f6Optimization?.provenance?.reportScope ?? { worksheetNames: ["Analysis-A"], blockedWorksheetNames: [] };
      const blockedWorksheetNames = Array.isArray(reportScope.blockedWorksheetNames) ? reportScope.blockedWorksheetNames : [];
      const worksheetNames = (Array.isArray(reportScope.worksheetNames) ? reportScope.worksheetNames : ["Analysis-A"])
        .filter((worksheetName) => !blockedWorksheetNames.includes(worksheetName));
      return createV4FinalReportStub({ worksheetNames, blockedWorksheetNames });
    }),
    renderFinalReportPdf: () => PDF,
    ...dependencyOverrides,
  });
  return { result, runRoot };
}

function artifactHash(filePath) {
  return sha256(readFileSync(filePath));
}

function temporaryFiles(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true })
    .map(String)
    .filter((entry) => entry.endsWith(".tmp"));
}

const committedArtifacts = [
  ["optimizationJson", "Feature6-Optimization.json"],
  ["finalReportMarkdown", "Feature6-Report.md"],
  ["finalReportPdf", "Feature6-Report.pdf"],
  ["runSummary", "Feature6-Run-Summary.json"],
];

function assertRunSummaryMatchesProjection(summary, manifest, cliResult) {
  expect(summary.status).toBe("completed");
  expect(manifest.status).toBe(summary.status);
  expect(cliResult.status).toBe(summary.status);
  expect(summary.reportSummary).toEqual({
    workbookDisposition: cliResult.finalReportProjection.workbookDisposition,
    worksheetDispositions: cliResult.finalReportProjection.worksheetDispositions,
  });
}

function assertWorksheetLineageMatchesProvenance(optimization) {
  for (const worksheet of optimization.worksheets) {
    const f4Reference = optimization.provenance.f4Reference;
    expect(worksheet.baselineResult.calculationReference).toEqual(f4Reference);
    expect(worksheet.selectedResult.snapshot.calculationReference).toEqual(f4Reference);
    expect(worksheet.selectedResult.snapshot.baselineIdentity).toEqual(worksheet.baselineIdentity);

    const scenarioById = new Map([[worksheet.baselineResult.scenarioId, worksheet.baselineResult]]);
    for (const step of worksheet.steps) {
      if (step.result !== undefined) scenarioById.set(step.result.scenarioId, step.result);
    }
    expect(scenarioById.has(worksheet.selectedResult.snapshot.scenarioId)).toBe(true);

    if (worksheet.selectedResult.snapshot.inputScenarioId !== null) {
      expect(scenarioById.has(worksheet.selectedResult.snapshot.inputScenarioId)).toBe(true);
    }

    for (const step of worksheet.steps) {
      if (step.result?.inputScenarioId !== undefined && step.result.inputScenarioId !== null) {
        expect(scenarioById.has(step.result.inputScenarioId)).toBe(true);
      }
    }
  }
}

describe("runF6FullValidation", () => {
  it("persists an internal candidate receipt and neither public reader presents candidate reports", () => {
    const { layout, deps, args } = workspaceSetup();
    const candidate = runF6FullValidation({ args: [...args, "--candidate"] }, deps);
    const publication = path.dirname(candidate.candidate.reportPdfPath);
    const receiptPath = path.join(publication, "Feature6-Candidate-Receipt.json");
    expect(existsSync(receiptPath)).toBe(true);
    expect(readJson(receiptPath)).toMatchObject({ version: "f6-candidate-receipt-v1", internalOnly: true, status: "validated" });
    expect(Object.keys(readJson(receiptPath).files)).toHaveLength(5);
    expect(validateExistingF6(layout.stagePaths.f6, {
      publishRoot: layout.analysisRoot,
      workspaceModelInterpretationPath: path.join(layout.stagePaths.f6, "evidence", "model-interpretation", "Feature6-Model-Interpretation.json"),
    }).status).toBe("rejected");
    for (const reader of [validateExistingF6, validateExistingF6Artifact]) {
      expect(reader(publication, { publishRoot: layout.analysisRoot })).toEqual({ status: "rejected", reasonCode: "internal_candidate_not_final" });
      expect(reader(path.join(publication, "Feature6-Optimization.json"), { publishRoot: publication })).toEqual({ status: "rejected", reasonCode: "internal_candidate_not_final" });
    }
    const renamedCopy = path.join(path.dirname(layout.analysisRoot), "saved-report");
    cpSync(publication, renamedCopy, { recursive: true });
    for (const reader of [validateExistingF6, validateExistingF6Artifact]) {
      expect(reader(renamedCopy, { publishRoot: renamedCopy })).toEqual({ status: "rejected", reasonCode: "internal_candidate_not_final" });
    }
    rmSync(path.join(renamedCopy, "Feature6-Candidate-Receipt.json"));
    for (const reader of [validateExistingF6, validateExistingF6Artifact]) {
      expect(reader(renamedCopy, { publishRoot: renamedCopy })).toEqual({ status: "rejected", reasonCode: "internal_candidate_not_final" });
    }
    rmSync(receiptPath);
    for (const reader of [validateExistingF6, validateExistingF6Artifact]) {
      expect(reader(publication, { publishRoot: publication })).toEqual({ status: "rejected", reasonCode: "internal_candidate_not_final" });
    }
  });

  it.each(["{invalid", "{}", '{"internalOnly":false}'])("public readers reject a malformed reserved marker %s without report paths", (marker) => {
    const { deps, args } = workspaceSetup();
    const candidate = runF6FullValidation({ args: [...args, "--candidate"] }, deps);
    const publication = path.dirname(candidate.candidate.reportPdfPath);
    writeFileSync(path.join(publication, "Feature6-Candidate-Receipt.json"), marker);
    for (const reader of [validateExistingF6, validateExistingF6Artifact]) {
      expect(reader(publication, { publishRoot: publication })).toEqual({ status: "rejected", reasonCode: "internal_candidate_not_final" });
    }
  });

  it("cleans candidate evidence only after validated final paths and a completed root summary", () => {
    const { layout, deps, args } = workspaceSetup();
    const candidate = runF6FullValidation({ args: [...args, "--candidate"] }, deps);
    writeFileSync(path.join(layout.stagePaths.f3, "Feature3-Report.json"), '{"ado":{"status":"not_requested"}}');
    deps.cleanupCandidate = vi.fn((workspace, plan) => {
      expect(readJson(layout.summaryPath).overallStatus).toBe("completed");
      expect(existsSync(candidate.candidate.reportPdfPath)).toBe(true);
      expect(validateExistingF6(layout.stagePaths.f6, {
        publishRoot: layout.analysisRoot,
        workspaceModelInterpretationPath: path.join(layout.stagePaths.f6, "evidence", "model-interpretation", "Feature6-Model-Interpretation.json"),
      }).status).toBe("accepted");
      candidateLifecycle.cleanupF6Candidate(workspace, plan);
    });
    expect(runF6FullValidation({ args }, deps).status).toBe("completed");
    expect(deps.cleanupCandidate).toHaveBeenCalledTimes(1);
    expect(existsSync(path.join(layout.stagePaths.f6, "evidence", "candidate"))).toBe(false);
  });

  it.each(["directory", "file"])("fails cleanup closed on a swapped candidate %s identity without deleting replacement or original evidence", (swap) => {
    const { layout, deps, args } = workspaceSetup();
    const candidate = runF6FullValidation({ args: [...args, "--candidate"] }, deps);
    writeFileSync(path.join(layout.stagePaths.f3, "Feature3-Report.json"), '{"ado":{"status":"not_requested"}}');
    const candidateRoot = path.join(layout.stagePaths.f6, "evidence", "candidate");
    const preserved = path.join(path.dirname(layout.analysisRoot), "preserved-candidate");
    const originalPdf = readFileSync(candidate.candidate.reportPdfPath);
    deps.cleanupCandidate = (workspace, plan) => {
      expect(readJson(layout.summaryPath).overallStatus).toBe("completed");
      if (swap === "directory") {
        renameSync(candidateRoot, preserved);
        mkdirSync(candidateRoot);
        writeFileSync(path.join(candidateRoot, "replacement.txt"), "do not delete");
      } else {
        renameSync(candidate.candidate.reportPdfPath, preserved);
        writeFileSync(candidate.candidate.reportPdfPath, originalPdf);
      }
      candidateLifecycle.cleanupF6Candidate(workspace, plan);
    };
    const stdout = [];
    expect(runF6Cli({ args }, deps, { log: (value) => stdout.push(value) })).toBe(1);
    expect(JSON.parse(stdout.join(""))).toEqual({ status: "failed", reasonCode: "candidate_cleanup_failed" });
    if (swap === "directory") {
      expect(readFileSync(path.join(candidateRoot, "replacement.txt"), "utf8")).toBe("do not delete");
      expect(existsSync(path.join(preserved, "publication", path.basename(candidate.candidate.reportPdfPath)))).toBe(true);
    } else {
      expect(readFileSync(preserved)).toEqual(originalPdf);
      expect(readFileSync(candidate.candidate.reportPdfPath)).toEqual(originalPdf);
    }
    expect(readJson(layout.summaryPath).overallStatus).toBe("completed");
  });

  it("does not silently report clean success when post-completion candidate cleanup fails", () => {
    const { layout, deps, args } = workspaceSetup();
    const candidate = runF6FullValidation({ args: [...args, "--candidate"] }, deps);
    writeFileSync(path.join(layout.stagePaths.f3, "Feature3-Report.json"), '{"ado":{"status":"not_requested"}}');
    deps.cleanupCandidate = () => { throw new Error("private cleanup failure"); };
    const stdout = [];
    expect(runF6Cli({ args }, deps, { log: (value) => stdout.push(value) })).toBe(1);
    expect(JSON.parse(stdout.join(""))).toEqual({ status: "failed", reasonCode: "candidate_cleanup_failed" });
    expect(existsSync(candidate.candidate.reportPdfPath)).toBe(true);
    expect(readJson(layout.summaryPath).overallStatus).toBe("completed");
    const completed = readFileSync(layout.summaryPath, "utf8");
    expect(() => runF6FullValidation({ args }, deps)).toThrow();
    expect(readFileSync(layout.summaryPath, "utf8")).toBe(completed);
  });

  it.each(["missing", "malformed", "file_hash", "source_hash"])("requires the sealed candidate receipt before final publication: %s", (mutation) => {
    const { layout, deps, args } = workspaceSetup();
    const candidate = runF6FullValidation({ args: [...args, "--candidate"] }, deps);
    const receiptPath = path.join(path.dirname(candidate.candidate.reportPdfPath), "Feature6-Candidate-Receipt.json");
    if (mutation === "missing") rmSync(receiptPath);
    else if (mutation === "malformed") writeFileSync(receiptPath, "{}");
    else {
      const receipt = readJson(receiptPath);
      if (mutation === "file_hash") receipt.files["manifest.json"].sha256 = "0".repeat(64);
      else receipt.inputs.sources.f4 = "0".repeat(64);
      writeFileSync(receiptPath, JSON.stringify(receipt));
    }
    writeFileSync(path.join(layout.stagePaths.f3, "Feature3-Report.json"), '{"ado":{"status":"not_requested"}}');
    expect(() => runF6FullValidation({ args }, deps)).toThrow();
    expect(readJson(layout.summaryPath).overallStatus).toBe("failed");
    expect(existsSync(candidate.candidate.reportPdfPath)).toBe(true);
    expect(existsSync(path.join(layout.stagePaths.f6, "manifest.json"))).toBe(false);
  });
  it("validates an internal candidate before ADO, then publishes final paths exactly once after the terminal outcome", () => {
    const { layout, deps, args } = workspaceSetup();
    const adoChoice = vi.fn(() => {
      expect(readJson(layout.summaryPath).overallStatus).toBe("in_progress");
      writeFileSync(path.join(layout.stagePaths.f3, "Feature3-Report.json"), JSON.stringify({ ado: { status: "not_requested" } }));
    });
    const candidate = runF6FullValidation({ args: [...args, "--candidate"] }, deps);
    expect(candidate.status).toBe("candidate_validated");
    expect(candidate).not.toHaveProperty("finalReportMarkdownPath");
    expect(candidate).not.toHaveProperty("finalReportPdfPath");
    expect(candidate.candidate.reportPdfPath).toContain(path.join("evidence", "candidate"));
    expect(readJson(layout.summaryPath)).toMatchObject({ overallStatus: "in_progress", stages: { f6: { status: "pending", artifacts: {} } } });
    expect(existsSync(path.join(layout.stagePaths.f6, "manifest.json"))).toBe(false);
    expect(adoChoice).not.toHaveBeenCalled();
    adoChoice(candidate.candidate.reportSummary);
    const result = runF6FullValidation({ args }, deps);
    expect(result.status).toBe("completed");
    expect(readJson(layout.summaryPath).overallStatus).toBe("completed");
    expect(existsSync(path.join(layout.stagePaths.f6, "evidence", "candidate"))).toBe(false);
    expect(adoChoice).toHaveBeenCalledTimes(1);
  });

  it("does not permit ADO or final publication after a candidate PDF validation failure", () => {
    const { layout, deps, args } = workspaceSetup();
    deps.renderFinalReportPdf = () => Buffer.from("invalid PDF");
    const adoChoice = vi.fn();
    const result = runF6FullValidation({ args: [...args, "--candidate"] }, deps);
    if (result.status === "candidate_validated") adoChoice();
    expect(result.status).toBe("failed");
    expect(adoChoice).not.toHaveBeenCalled();
    expect(readJson(layout.summaryPath)).toMatchObject({ overallStatus: "failed", failedStage: "f6" });
    expect(existsSync(path.join(layout.stagePaths.f6, "manifest.json"))).toBe(false);
    expect(() => runF6FullValidation({ args }, deps)).toThrow();
  });

  it("rejects final workspace publication without a validated candidate", () => {
    const { layout, deps, args } = workspaceSetup();
    expect(() => runF6FullValidation({ args }, deps)).toThrow();
    expect(readJson(layout.summaryPath).overallStatus).toBe("failed");
    expect(existsSync(path.join(layout.stagePaths.f6, "manifest.json"))).toBe(false);
  });

  it.each(["candidate_pdf", "upstream_f4", "f3_engineering", "missing_ado"])("rejects final publication when %s no longer matches the report-informed candidate", (change) => {
    const { layout, deps, args } = workspaceSetup();
    const candidate = runF6FullValidation({ args: [...args, "--candidate"] }, deps);
    expect(candidate.status).toBe("candidate_validated");
    if (change !== "missing_ado") writeFileSync(path.join(layout.stagePaths.f3, "Feature3-Report.json"), JSON.stringify({ ado: { status: "not_requested" } }));
    if (change === "candidate_pdf") writeFileSync(candidate.candidate.reportPdfPath, "%PDF-1.7\nchanged");
    if (change === "upstream_f4") writeFileSync(path.join(layout.stagePaths.f4, "Feature4-Calculation.json"), '{"changed":true}');
    if (change === "f3_engineering") writeFileSync(path.join(layout.stagePaths.f3, "Feature3-Report.json"), '{"ado":{"status":"not_requested"},"worksheets":["changed"]}');
    expect(() => runF6FullValidation({ args }, deps)).toThrow();
    expect(readJson(layout.summaryPath)).toMatchObject({ overallStatus: "failed", failedStage: "f6" });
    expect(existsSync(path.join(layout.stagePaths.f6, "manifest.json"))).toBe(false);
  });

  it("completes the root only after governed PDF, manifest, and model evidence validation", () => {
    const { layout, deps, args } = workspaceSetup();
    expect(runF6FullValidation({ args: [...args, "--candidate"] }, deps).status).toBe("candidate_validated");
    writeFileSync(path.join(layout.stagePaths.f3, "Feature3-Report.json"), JSON.stringify({ ado: { status: "not_requested" } }));
    const result = runF6FullValidation({ args }, deps);
    expect(result.status).toBe("completed");
    expect(validateExistingF6(layout.stagePaths.f6, {
      publishRoot: layout.analysisRoot,
      workspaceModelInterpretationPath: path.join(layout.stagePaths.f6, "evidence", "model-interpretation", "Feature6-Model-Interpretation.json"),
    }).status).toBe("accepted");
    const summary = readJson(layout.summaryPath);
    expect(summary.overallStatus).toBe("completed");
    expect(summary.stages.f6.status).toBe("completed");
    expect(summary.stages.f6.artifacts.finalReportPdfPath).toBe(path.join("06 - F6 Design Optimization", "Anonymous - TA ENGINEERING ANALYSIS REPORT.pdf"));
    const before = readFileSync(layout.summaryPath, "utf8");
    expect(() => runF6FullValidation({ args }, deps)).toThrow();
    expect(readFileSync(layout.summaryPath, "utf8")).toBe(before);
  });

  it("fails the root instead of advertising paths if the published PDF was corrupted", () => {
    const { layout, deps, args } = workspaceSetup();
    const candidate = runF6FullValidation({ args: [...args, "--candidate"] }, deps);
    expect(candidate.status).toBe("candidate_validated");
    const candidatePdfBytes = readFileSync(candidate.candidate.reportPdfPath);
    writeFileSync(path.join(layout.stagePaths.f3, "Feature3-Report.json"), JSON.stringify({ ado: { status: "not_requested" } }));
    deps.afterRename = () => {
      const pdfPath = path.join(layout.stagePaths.f6, "Anonymous - TA ENGINEERING ANALYSIS REPORT.pdf");
      if (existsSync(pdfPath)) writeFileSync(pdfPath, "%PDF-1.7\ncorrupted bytes");
    };
    const stdout = [];
    expect(runF6Cli({ args }, deps, { log: (value) => stdout.push(value) })).toBe(1);
    expect(stdout.join("")).not.toMatch(/finalReport|outputDirectory/);
    expect(readJson(layout.summaryPath)).toMatchObject({
      overallStatus: "failed", failedStage: "f6", stages: { f6: { status: "failed", artifacts: {} } },
    });
    expect(readFileSync(candidate.candidate.reportPdfPath)).toEqual(candidatePdfBytes);
    expect(readJson(path.join(path.dirname(candidate.candidate.reportPdfPath), "Feature6-Candidate-Receipt.json"))).toMatchObject({ internalOnly: true, status: "validated" });
  });

  it("rejects four roots from the direct CLI without creating artifacts", () => {
    const root = mkdtempSync(path.join(tmpdir(), "f6-direct-cli-"));
    cleanup.push(root);
    const publishRoot = path.join(root, "publish");
    const roots = ["f2", "f3", "f4", "f5"].map((name) => path.join(publishRoot, name));
    const outputRoot = path.join(publishRoot, "f6-runs", "run");
    for (const artifactRoot of roots) mkdirSync(artifactRoot, { recursive: true });

    const result = spawnSync(process.execPath, [
      path.join(process.cwd(), "scripts", "run-f6-full-validation.mjs"),
      ...roots,
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        AI_TVA_F6_OUTPUT_ROOT: outputRoot,
        AI_TVA_F6_PUBLISH_ROOT: publishRoot,
      },
    });

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual({
      status: "failed",
      reasonCode: "invalid_arguments_or_output_root",
    });
    expect(existsSync(outputRoot)).toBe(false);
  });

  it("rejects a direct CLI command with four roots before creating artifacts", () => {
    const lines = [];
    const resolveLayout = vi.fn(() => { throw new Error("layout must not be resolved"); });

    expect(runF6Cli(
      { args: ["f2 run", "f3 run", "f4 run", "f5 run"] },
      { resolveLayout },
      { log: (line) => lines.push(line) },
    )).toBe(1);
    expect(resolveLayout).not.toHaveBeenCalled();
    expect(JSON.parse(lines.join("\n"))).toEqual({
      status: "failed",
      reasonCode: "invalid_arguments_or_output_root",
    });
  });

  it("writes all five workbook-derived artifacts and passes validated reports to the final report projection", () => {
    const context = setup();
    context.deps.resolveLayout.mockReturnValue({
      artifactSetVersion: "f6-artifact-set-v4",
      runId: "2026-08-17T01-02-03-456Z",
      runRoot: context.runRoot,
      publishRoot: context.publishRoot,
      optimizationJsonName: "Feature6-Optimization.json",
      finalReportMdName: "Demo - TA ENGINEERING ANALYSIS REPORT.md",
      finalReportPdfName: "Demo - TA ENGINEERING ANALYSIS REPORT.pdf",
      runSummaryJsonName: "Feature6-Run-Summary.json",
      manifestName: "manifest.json",
    });
    const result = runF6FullValidation({ args: ["ignored"] }, context.deps);

    expect(result.status).toBe("completed");
    expect(readdirSync(context.runRoot).sort()).toEqual([
      "Demo - TA ENGINEERING ANALYSIS REPORT.md",
      "Demo - TA ENGINEERING ANALYSIS REPORT.pdf",
      "Feature6-Optimization.json",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    expect(context.deps.createFinalReport).toHaveBeenCalledWith({
      f2Report: { f2: true },
      f3Report: { f3: true },
      f4Report: { f4: true },
      f5Report: { f5: true },
      f6Optimization: context.optimization,
      generatedAt: "2026-08-17T01:02:03.456Z",
      interactionLanguage,
      analysisRequestContext: REQUEST_CONTEXT,
      modelInterpretation: { contractVersion: "f5-multimodal-artifact-v3" },
    }, {
      outputRoot: context.runRoot,
      f1ArtifactRoot: undefined,
      publishRoot: context.publishRoot,
      requireMultimodalV3: true,
    });
    expect(result.finalReportMdPath).toBe(path.join(context.runRoot, "Demo - TA ENGINEERING ANALYSIS REPORT.md"));
    expect(result.finalReportPdfPath).toBe(path.join(context.runRoot, "Demo - TA ENGINEERING ANALYSIS REPORT.pdf"));
    expect(readFileSync(result.finalReportPdfPath)).toEqual(PDF);
    expect(result).not.toHaveProperty("composedReportJsonPath");
    expect(result).not.toHaveProperty("composedReportMdPath");
    expect(context.deps.createOptimization).toHaveBeenCalledWith({ request: true }, {
      interactionLanguage,
      multimodalInterpretation: { contractVersion: "f5-multimodal-artifact-v3" },
      multimodalReference: { artifact: "multimodal.json", contentHash: HASH },
      optimizationTargetsDecision: { outcome: "NOT_PROVIDED" },
    });
  });

  it("binds exact request context and structured ADO identity across report summary and manifest", () => {
    const context = setup();
    const updatedF3Report = { modelVersion: "drawing-governance-v3", ado: UPDATED_ADO };
    context.deps.loadBundle.mockReturnValue({
      ...context.deps.loadBundle(),
      f3Report: updatedF3Report,
    });
    context.deps.createFinalReport = vi.fn(() => ({
      ...context.finalReport,
      markdown: [
        "# F6 final report",
        "",
        "| Field | Value |",
        "|---|---|",
        "| Analysis Requested At | 2026-09-16 01:30:12 (UTC -7) |",
        "",
        `[Updated Work Item #${UPDATED_ADO.workItemId}](https://dev.azure.com/${UPDATED_ADO.organization}/${UPDATED_ADO.project}/_workitems/edit/${UPDATED_ADO.workItemId})`,
        "",
      ].join("\n"),
    }));

    const result = runF6FullValidation({ args: ["ignored"] }, context.deps);

    expect(result.status).toBe("completed");
    expect(readdirSync(context.runRoot).sort()).toEqual([
      "Feature6-Optimization.json",
      "Feature6-Report.md",
      "Feature6-Report.pdf",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    expect(context.deps.createFinalReport).toHaveBeenCalledWith(expect.objectContaining({
      f3Report: updatedF3Report,
      analysisRequestContext: REQUEST_CONTEXT,
    }), expect.anything());
    const summary = readJson(path.join(context.runRoot, "Feature6-Run-Summary.json"));
    const manifest = readJson(path.join(context.runRoot, "manifest.json"));
    const markdown = readFileSync(path.join(context.runRoot, "Feature6-Report.md"), "utf8");
    expect(summary.analysisRequestContext).toEqual(REQUEST_CONTEXT);
    expect(manifest.analysisRequestContext).toEqual(REQUEST_CONTEXT);
    expect(summary.adoTraceability).toEqual(UPDATED_ADO);
    expect(manifest.adoTraceability).toEqual(UPDATED_ADO);
    expect(markdown).toContain(`[Updated Work Item #${UPDATED_ADO.workItemId}](https://dev.azure.com/${UPDATED_ADO.organization}/${UPDATED_ADO.project}/_workitems/edit/${UPDATED_ADO.workItemId})`);
  });

  it("keeps not_requested ADO traceability unlinked in the report artifacts", () => {
    const context = setup();
    const f3Report = { modelVersion: "drawing-governance-v3", ado: { status: "not_requested" } };
    context.deps.loadBundle.mockReturnValue({
      ...context.deps.loadBundle(),
      f3Report,
    });
    context.deps.createFinalReport = vi.fn(() => ({
      ...context.finalReport,
      markdown: "# F6 final report\n\nMISSING - ADO traceability was not initiated.\n",
    }));

    const result = runF6FullValidation({ args: ["ignored"] }, context.deps);

    expect(result.status).toBe("completed");
    const summary = readJson(path.join(context.runRoot, "Feature6-Run-Summary.json"));
    const manifest = readJson(path.join(context.runRoot, "manifest.json"));
    const markdown = readFileSync(path.join(context.runRoot, "Feature6-Report.md"), "utf8");
    expect(summary.adoTraceability).toEqual({ status: "not_requested" });
    expect(manifest.adoTraceability).toEqual({ status: "not_requested" });
    expect(markdown).toContain("MISSING - ADO traceability was not initiated.");
    expect(markdown).not.toContain("/_workitems/edit/");
  });

  it("rejects a final report with a provenance display column before successful artifact writes", () => {
    const context = setup();
    context.deps.createFinalReport = vi.fn(() => ({
      ...context.finalReport,
      markdown: "# Report\n\n| Metric | Source |\n|---|---|\n| Cpk | F4 |\n",
    }));

    const result = runF6FullValidation({ args: ["ignored"] }, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "report_failed" });
    expect(readdirSync(context.runRoot)).toEqual(["manifest.json"]);
    expect(readJson(path.join(context.runRoot, "manifest.json"))).toMatchObject({ artifacts: {} });
  });

  it("fails before publishing business artifacts when the PDF signature is invalid", () => {
    const context = setup();
    context.deps.renderFinalReportPdf = () => Buffer.from("not a pdf");

    const result = runF6FullValidation({}, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "report_failed" });
    expect(readdirSync(context.runRoot)).toEqual(["manifest.json"]);
  });

  it("persists only safe local-strategy failure metadata and publishes no reports", () => {
    const context = setup();
    context.deps.renderFinalReportPdf = () => {
      throw Object.assign(new Error("confidential worker output"), {
        code: "pdf_render_unavailable",
        attempts: [
          { browser: "C:\\confidential\\chrome.exe", strategy: "playwright", reason: "timed_out", elapsedMs: 120_005, deadlineMs: 120_000, stderr: "secret" },
          { browser: "msedge.exe", strategy: "cli", reason: "cleanup_failed", elapsedMs: 700, deadlineMs: 600_000 },
          ...[0, -1, Infinity, NaN, 600_001, "private-report-path", 1.5].map((deadlineMs) => ({
            browser: "private-report-name.exe", strategy: "private-report-path", reason: "execution_failed", elapsedMs: -1, deadlineMs,
          })),
        ],
      });
    };
    const result = runF6FullValidation({}, context.deps);
    expect(result).toMatchObject({ status: "failed", reasonCode: "report_failed" });
    expect(readdirSync(context.runRoot)).toEqual(["manifest.json"]);
    const manifest = readJson(path.join(context.runRoot, "manifest.json"));
    expect(manifest.failureDetail).toEqual({
      code: "pdf_render_unavailable",
      attempts: [
        { browser: "chrome.exe", strategy: "playwright", reason: "timed_out", elapsedMs: 120_005, deadlineMs: 120_000 },
        { browser: "msedge.exe", strategy: "cli", reason: "cleanup_failed", elapsedMs: 700, deadlineMs: 600_000 },
        ...Array.from({ length: 7 }, () => ({ browser: "chromium", reason: "execution_failed" })),
      ],
    });
    expect(JSON.stringify(manifest)).not.toMatch(/confidential|private-report|secret/);
  });

  it("passes optional targets through the v4 gate and records identical input decisions in summary and manifest", () => {
    const context = setup();
    const inputDecisions = {
      analysisContext: { outcome: "CALLER_AUTHORIZED", artifactReference: { artifact: "context.json", contentHash: "e".repeat(64) } },
      optimizationTargets: { outcome: "CALLER_AUTHORIZED", artifactReference: { artifact: "targets.json", contentHash: "f".repeat(64) } },
      modelInterpretation: { outcome: "CALLER_AUTHORIZED", artifactReference: { artifact: "Feature6-Model-Interpretation.json", contentHash: HASH } },
    };
    const analysisContext = { contextVersion: "f6-analysis-context-v1" };
    const optimizationTargets = { targetVersion: "f6-optimization-targets-v1" };
    const modelInterpretation = { contractVersion: "f5-multimodal-artifact-v3" };
    context.deps.loadBundle.mockReturnValue({
      ...context.deps.loadBundle(),
      analysisContext,
      optimizationTargets,
      modelInterpretation,
      inputDecisions,
      sourceReferences: {
        ...context.deps.loadBundle().sourceReferences,
        analysisContext: inputDecisions.analysisContext.artifactReference,
        optimizationTargets: inputDecisions.optimizationTargets.artifactReference,
        modelInterpretation: inputDecisions.modelInterpretation.artifactReference,
      },
    });

    runF6FullValidation({}, context.deps);

    expect(context.deps.createOptimization).toHaveBeenCalledWith(
      { request: true },
      {
        interactionLanguage,
        multimodalInterpretation: modelInterpretation,
        multimodalReference: inputDecisions.modelInterpretation.artifactReference,
        analysisContextReference: inputDecisions.analysisContext.artifactReference,
        optimizationTargetsReference: inputDecisions.optimizationTargets.artifactReference,
        optimizationTargets,
        optimizationTargetsDecision: inputDecisions.optimizationTargets,
      },
    );
    expect(context.deps.createFinalReport).toHaveBeenCalledWith({
      f2Report: { f2: true },
      f3Report: { f3: true },
      f4Report: { f4: true },
      f5Report: { f5: true },
      f6Optimization: context.optimization,
      generatedAt: "2026-08-17T01:02:03.456Z",
      analysisContext,
      interactionLanguage,
      analysisRequestContext: REQUEST_CONTEXT,
      modelInterpretation,
    }, {
      outputRoot: context.runRoot,
      f1ArtifactRoot: undefined,
      publishRoot: context.publishRoot,
      requireMultimodalV3: true,
    });
    const summary = readJson(path.join(context.runRoot, "Feature6-Run-Summary.json"));
    const manifest = readJson(path.join(context.runRoot, "manifest.json"));
    expect(summary.inputDecisions).toEqual(inputDecisions);
    expect(summary.reportSummary).toEqual(context.reportSummary);
    expect(manifest.inputDecisions).toEqual(inputDecisions);
  });

  it("hashes the exact four serialized content artifacts and records the report summary", () => {
    const context = setup();
    runF6FullValidation({}, context.deps);
    const summary = readJson(path.join(context.runRoot, "Feature6-Run-Summary.json"));
    expect(summary.hashes).toEqual({
      optimizationJsonSha256: sha256(`${JSON.stringify(context.optimization, null, 2)}\n`),
      finalReportMarkdownSha256: sha256(context.finalReport.markdown),
      finalReportPdfSha256: sha256(PDF),
    });
    expect(summary.reportSummary).toEqual(context.reportSummary);
  });

  it("atomically renames every artifact and commits manifest last", () => {
    const context = setup();
    runF6FullValidation({}, context.deps);
    expect(context.renameCalls).toEqual([
      "Feature6-Optimization.json",
      "Feature6-Report.md",
      "Feature6-Report.pdf",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    expect(readdirSync(context.runRoot).some((name) => name.endsWith(".tmp"))).toBe(false);
    expect(existsSync(path.join(context.publishRoot, ".f6-staging"))).toBe(false);
  });

  it("keeps a successful run status when using v4 fixture stubs", () => {
    const context = setup({ status: "partially_completed" });
    const result = runF6FullValidation({}, context.deps);
    expect(result.status).toBe("completed");
    expect(readJson(path.join(context.runRoot, "manifest.json"))).toMatchObject({
      status: "completed",
      artifacts: {
        optimizationJson: "Feature6-Optimization.json",
        finalReportMarkdown: "Feature6-Report.md",
        finalReportPdf: "Feature6-Report.pdf",
        runSummary: "Feature6-Run-Summary.json",
      },
    });
  });

  it("writes only a failed manifest when governed input is rejected", () => {
    const context = setup();
    context.deps.loadBundle = () => ({ status: "inputRejected", reasonCode: "artifact_identity_mismatch" });
    const result = runF6FullValidation({}, context.deps);
    expect(result).toMatchObject({ status: "failed", reasonCode: "input_rejected" });
    expect(readdirSync(context.runRoot)).toEqual(["manifest.json"]);
  });

  it("does not leak exception details through the CLI", () => {
    const context = setup();
    context.deps.createOptimization = () => { throw new Error("sensitive workbook path"); };
    const lines = [];
    expect(runF6Cli({}, context.deps, { log: (line) => lines.push(line) })).toBe(1);
    expect(lines.join("\n")).not.toContain("sensitive workbook path");
    expect(lines.join("\n")).toContain("optimization_failed");
  });

  it.each([1, 2, 3, 4])(
    "records exactly the postchecked artifacts when rename %i fails",
    (failurePosition) => {
    const context = setup();
    let calls = 0;
    context.deps.rename = (from, to) => {
      calls += 1;
      if (calls === failurePosition) throw new Error("disk failure");
      renameSync(from, to);
    };
    const result = runF6FullValidation({}, context.deps);
    const expectedArtifacts = Object.fromEntries(committedArtifacts.slice(0, failurePosition - 1));
    const expectedFiles = [
      ...committedArtifacts.slice(0, failurePosition - 1).map(([, fileName]) => fileName),
      "manifest.json",
    ].sort();

    expect(result).toMatchObject({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(readdirSync(context.runRoot).sort()).toEqual(expectedFiles);
    expect(readJson(path.join(context.runRoot, "manifest.json"))).toMatchObject({
      status: "failed",
      reasonCode: "workflow_output_failed",
      artifacts: expectedArtifacts,
    });
    expect(temporaryFiles(context.runRoot)).toEqual([]);
    expect(temporaryFiles(path.join(context.publishRoot, ".f6-staging"))).toEqual([]);
    expect(existsSync(path.join(context.publishRoot, ".f6-staging"))).toBe(false);
  });

  it("does not return a manifest when every manifest rename fails", () => {
    const context = setup();
    context.deps.rename = (from, to) => {
      if (path.basename(to) === "manifest.json") throw new Error("manifest disk failure");
      renameSync(from, to);
    };

    const result = runF6FullValidation({}, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(result).not.toHaveProperty("manifestPath");
    expect(readdirSync(context.runRoot).sort()).toEqual(committedArtifacts.map(([, fileName]) => fileName).sort());
    expect(temporaryFiles(context.runRoot)).toEqual([]);
    expect(temporaryFiles(path.join(context.publishRoot, ".f6-staging"))).toEqual([]);
  });

  it.each([
    ...[1, 2, 3, 4].map((position) => ["before", position]),
    ...[1, 2, 3, 4].map((position) => ["after", position]),
  ])("fails closed when the run root is swapped %s rename %i", (phase, swapPosition) => {
    const context = setup();
    const parkedRoot = path.join(context.root, `parked-${phase}-${swapPosition}`);
    const outsideRoot = path.join(context.root, `outside-${phase}-${swapPosition}`);
    mkdirSync(outsideRoot);
    let renamePosition = 0;
    const swapRunRoot = () => {
      renameSync(context.runRoot, parkedRoot);
      symlinkSync(outsideRoot, context.runRoot, process.platform === "win32" ? "junction" : "dir");
    };
    context.deps.beforeRename = () => {
      renamePosition += 1;
      if (phase === "before" && renamePosition === swapPosition) swapRunRoot();
    };
    context.deps.afterRename = () => {
      if (phase === "after" && renamePosition === swapPosition) swapRunRoot();
    };

    const result = runF6FullValidation({}, context.deps);

    expect(result).toEqual({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(temporaryFiles(parkedRoot)).toEqual([]);
    expect(temporaryFiles(context.runRoot)).toEqual([]);
    expect(temporaryFiles(path.join(context.publishRoot, ".f6-staging"))).toEqual([]);
    expect(readdirSync(outsideRoot)).toEqual([]);
    expect(result).not.toHaveProperty("manifestPath");
    for (const [, fileName] of committedArtifacts) {
      expect(existsSync(path.join(outsideRoot, fileName))).toBe(false);
      expect(Object.values(result)).not.toContain(path.join(outsideRoot, fileName));
    }
  });

  it("rejects a staging junction without writing through it", () => {
    const context = setup();
    const stagingRoot = path.join(context.publishRoot, ".f6-staging");
    const outsideRoot = path.join(context.root, "outside-staging");
    mkdirSync(outsideRoot);
    symlinkSync(outsideRoot, stagingRoot, process.platform === "win32" ? "junction" : "dir");

    const result = runF6FullValidation({}, context.deps);

    expect(result).toEqual({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(readdirSync(outsideRoot)).toEqual([]);
    expect(existsSync(context.runRoot)).toBe(true);
    expect(readdirSync(context.runRoot)).toEqual([]);
  });

  it("fails closed when the run root identity changes after creation", () => {
    const context = setup();
    const originalRealpath = context.deps.realpath;
    let runRootChecks = 0;
    context.deps.realpath = (target) => {
      const resolved = (originalRealpath ?? ((value) => path.resolve(value)))(target);
      if (path.resolve(target) === path.resolve(context.runRoot) && ++runRootChecks > 1) {
        return path.join(context.publishRoot, "replaced-run");
      }
      return resolved;
    };
    const result = runF6FullValidation({}, context.deps);
    expect(result.status).toBe("failed");
    expect(existsSync(path.join(context.runRoot, "Feature6-Optimization.json"))).toBe(false);
  });
});

describe("F6 real artifact full flow", () => {
  it("preserves Chinese interaction metadata while publishing English reports", () => {
    const bundle = createRealBundle({ worksheetNames: ["Analysis-A"] });
    const chineseInteractionLanguage = {
      languageTag: "zh-CN",
      uiCatalogLanguage: "zh",
      lockedAtTurnId: "turn-zh",
      source: "workflow_start",
      fallbackUsed: false,
    };
    const { result, runRoot } = runRealF6(bundle, "v4-zh-interaction-english-report", {
      createFinalReport: createF6FinalReportProjection,
    }, {
      interactionLanguage: chineseInteractionLanguage,
    });

    expect(result).toMatchObject({ status: "completed" });
    const manifest = readJson(path.join(runRoot, "manifest.json"));
    const summary = readJson(path.join(runRoot, "Feature6-Run-Summary.json"));
    const markdown = readFileSync(path.join(runRoot, "Feature6-Report.md"), "utf8");
    const pdf = readFileSync(path.join(runRoot, "Feature6-Report.pdf"));

    expect(manifest.interactionLanguage).toEqual(chineseInteractionLanguage);
    expect(summary.interactionLanguage).toEqual(chineseInteractionLanguage);
    expect(markdown).toContain("# TA Engineering Analysis Report");
    expect(markdown).toContain("# 3-1 Worksheet: Analysis-A");
    expect(markdown).not.toMatch(/\p{Script=Han}/u);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(summary.hashes.finalReportMarkdownSha256).toBe(artifactHash(path.join(runRoot, "Feature6-Report.md")));
    expect(summary.hashes.finalReportPdfSha256).toBe(artifactHash(path.join(runRoot, "Feature6-Report.pdf")));
  });

  it.each([
    [false, "unchanged"], [true, "unchanged"], [true, "missing"], [true, "hash_mismatch"],
  ])("publishes real v4 consumers with mixed=%s and failed image=%s", (mixed, failedImage) => {
    const bundle = createRealBundle({ worksheetNames: ["Analysis-A", "Analysis-B"] });
    const modelPath = path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact);
    rewriteFixtureJson(modelPath, (model) => {
      model.contractVersion = "f5-multimodal-artifact-v4";
      model.worksheets = model.worksheets.map((pair, index) => mixed && index === 1
        ? { status: "failed", request: pair.request, reasonCode: "evaluation_incomplete", summary: "Incomplete image assessment" }
        : { status: "completed", ...pair, scopeEvaluations: requiredScopeEvaluations() });
    });
    if (mixed) {
      rewriteFixtureJson(bundle.paths.f5, (report) => {
        Object.assign(report, createF5DataInterpretation({
          contractVersion: "v1", inputClassification: "confidential", workbook: report.workbook,
          knowledgeBaseVersion: "interpretation-rules-v2",
          worksheets: report.worksheets.filter(({ worksheetName }) => worksheetName === "Analysis-A")
            .map(({ worksheetName, imageReference, governanceRows, calculationResult }) => ({
              worksheetName, imageReference, governanceRows, calculationResult, imageObservations: [],
            })),
        }));
      });
    }
    bundle.expectedModelInterpretationContentHash = fixtureFileSha256(modelPath);
    const original = readFileSync(modelPath);
    if (failedImage !== "unchanged") {
      const imagePath = path.join(bundle.f2ArtifactRoot, readJson(modelPath).worksheets[1].request.image.artifactPath);
      if (failedImage === "missing") rmSync(imagePath);
      else writeFileSync(imagePath, "tampered failed image");
    }
    const loaded = loadF6ArtifactBundle({ ...bundle, analysisRequestContext: REQUEST_CONTEXT, requireMultimodalV3: true });
    expect(loaded.status, JSON.stringify(loaded)).toBe("accepted");
    const { analysisRequestContext: _loadedAnalysisRequestContext, ...optimizationRequest } = loaded.request;
    const optimized = createF6OptimizationV4(optimizationRequest, {
      interactionLanguage, multimodalInterpretation: loaded.modelInterpretation,
      multimodalReference: loaded.inputDecisions.modelInterpretation.artifactReference,
      optimizationTargetsDecision: loaded.inputDecisions.optimizationTargets,
    });
    expect(optimized.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(mixed ? ["Analysis-A"] : ["Analysis-A", "Analysis-B"]);
    const { result, runRoot } = runRealF6(bundle, `v4-${mixed}-${failedImage}`, {
      createFinalReport: createF6FinalReportProjection,
    });
    expect(result).toMatchObject({ status: "completed" });
    expect(readdirSync(runRoot).sort()).toEqual([
      "Feature6-Optimization.json",
      "Feature6-Report.md",
      "Feature6-Report.pdf",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    const manifest = readJson(path.join(runRoot, "manifest.json"));
    expect(manifest).toMatchObject({
      status: "completed",
      artifacts: {
        optimizationJson: "Feature6-Optimization.json",
        finalReportMarkdown: "Feature6-Report.md",
        finalReportPdf: "Feature6-Report.pdf",
        runSummary: "Feature6-Run-Summary.json",
      },
    });
    const reportMarkdown = readFileSync(path.join(runRoot, "Feature6-Report.md"), "utf8");
    if (mixed) {
      expect(reportMarkdown).toContain("| Block | [Analysis-B](#worksheet-2) | Loop Analysis-B | Multimodal blocker (evaluation\\_incomplete): Incomplete image assessment. |");
      expect(reportMarkdown).toContain("| Block |");
    }
    expect(readFileSync(modelPath)).toEqual(original);
  });

  it("runs the real CLI and layout without changing any governed input artifact", () => {
    const bundle = createRealBundle({ worksheetNames: ["Analysis-A", "Analysis-B"] });
    const evidence = installF6V2Evidence(bundle);
    const outputRoot = path.join(bundle.publishRoot, "f6-runs", "real-cli");
    const fixedNow = () => new Date("2026-08-17T01:02:03.456Z");
    const runRoot = path.join(outputRoot, "2026-08-17T01-02-03-456Z");
    const inputSnapshots = Object.fromEntries(Object.entries(bundle.paths).map(([key, filePath]) => [key, {
      bytes: readFileSync(filePath),
      sha256: fixtureFileSha256(filePath),
    }]));
    const lines = [];
    const previousOutputRoot = process.env.AI_TVA_F6_OUTPUT_ROOT;
    const previousPublishRoot = process.env.AI_TVA_F6_PUBLISH_ROOT;
    process.env.AI_TVA_F6_OUTPUT_ROOT = outputRoot;
    process.env.AI_TVA_F6_PUBLISH_ROOT = bundle.publishRoot;

    let exitCode;
    try {
      exitCode = runF6Cli({
        args: [
          bundle.f2ArtifactRoot,
          bundle.f3ArtifactRoot,
          bundle.f4ArtifactRoot,
          bundle.f5ArtifactRoot,
          "--worksheet", "Analysis-A",
          "--worksheet", "Analysis-B",
          "--language", "en-US",
          "--analysis-request-context", JSON.stringify(REQUEST_CONTEXT),
          "--model-interpretation", path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact),
          "--image-observations", path.join(evidence.evidenceArtifactRoot, evidence.imageObservationArtifact),
        ],
        now: fixedNow,
      }, {
        renderFinalReportPdf: () => PDF,
        createFinalReport: (input) => {
          const reportScope = input.f6Optimization.provenance.reportScope;
          const blockedWorksheetNames = reportScope.blockedWorksheetNames ?? [];
          const worksheetNames = reportScope.worksheetNames.filter((worksheetName) => !blockedWorksheetNames.includes(worksheetName));
          return createV4FinalReportStub({ worksheetNames, blockedWorksheetNames });
        },
      }, { log: (line) => lines.push(line) });
    } finally {
      if (previousOutputRoot === undefined) delete process.env.AI_TVA_F6_OUTPUT_ROOT;
      else process.env.AI_TVA_F6_OUTPUT_ROOT = previousOutputRoot;
      if (previousPublishRoot === undefined) delete process.env.AI_TVA_F6_PUBLISH_ROOT;
      else process.env.AI_TVA_F6_PUBLISH_ROOT = previousPublishRoot;
    }

    expect(exitCode, lines.join("\n")).toBe(0);
    expect(readdirSync(runRoot).sort()).toEqual([
      "Anonymous - TA ENGINEERING ANALYSIS REPORT.md",
      "Anonymous - TA ENGINEERING ANALYSIS REPORT.pdf",
      "Feature6-Optimization.json",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    const summary = readJson(path.join(runRoot, "Feature6-Run-Summary.json"));
    const cliResult = JSON.parse(lines.join("\n"));
    const manifest = readJson(path.join(runRoot, "manifest.json"));
    assertRunSummaryMatchesProjection(summary, manifest, cliResult);
    expect(summary.hashes).toEqual({
      optimizationJsonSha256: artifactHash(path.join(runRoot, "Feature6-Optimization.json")),
      finalReportMarkdownSha256: artifactHash(path.join(runRoot, "Anonymous - TA ENGINEERING ANALYSIS REPORT.md")),
      finalReportPdfSha256: artifactHash(path.join(runRoot, "Anonymous - TA ENGINEERING ANALYSIS REPORT.pdf")),
    });
    const optimization = readJson(path.join(runRoot, "Feature6-Optimization.json"));
    const finalMarkdown = readFileSync(path.join(runRoot, "Anonymous - TA ENGINEERING ANALYSIS REPORT.md"), "utf8");

    expect(optimization.optimizationVersion).toBe("f6-optimization-v4");
    expect(optimization.sequentialPolicyId).toBe("f6-sequential-optimization-policy-v2");
    expect(optimization.worksheets.every(({ steps }) =>
      steps.map(({ step }) => step).join(",") === "meanResponseCentering,toleranceReverseSolve,specificationRelaxation")).toBe(true);
    assertWorksheetLineageMatchesProvenance(optimization);
    expect(finalMarkdown).toContain("Analysis-A");
    expect(finalMarkdown).toContain("# F6 final report");
    expect(finalMarkdown).not.toContain(deprecatedF6ReportArtifactName);
    expect(cliResult.finalReportMdPath).toBe(path.join(runRoot, "Anonymous - TA ENGINEERING ANALYSIS REPORT.md"));
    expect(cliResult.finalReportPdfPath).toBe(path.join(runRoot, "Anonymous - TA ENGINEERING ANALYSIS REPORT.pdf"));
    expect(cliResult).not.toHaveProperty("composedReportJsonPath");
    expect(cliResult).not.toHaveProperty("composedReportMdPath");
    expect(manifest).toEqual({
      contractVersion: "v1",
      artifactSetVersion: "f6-artifact-set-v4",
      featureId: "F6",
      status: "completed",
      runId: "2026-08-17T01-02-03-456Z",
      inputDecisions: {
        analysisContext: { outcome: "NOT_PROVIDED" },
        optimizationTargets: { outcome: "NOT_PROVIDED" },
        modelInterpretation: expect.objectContaining({ outcome: "CALLER_AUTHORIZED" }),
      },
      interactionLanguage: {
        languageTag: "en-US",
        uiCatalogLanguage: "en",
        lockedAtTurnId: "f6-cli",
        source: "workflow_start",
        fallbackUsed: false,
      },
      analysisRequestContext: REQUEST_CONTEXT,
      artifacts: {
        optimizationJson: "Feature6-Optimization.json",
        finalReportMarkdown: "Anonymous - TA ENGINEERING ANALYSIS REPORT.md",
        finalReportPdf: "Anonymous - TA ENGINEERING ANALYSIS REPORT.pdf",
        runSummary: "Feature6-Run-Summary.json",
      },
    });
    for (const [key, filePath] of Object.entries(bundle.paths)) {
      expect(readFileSync(filePath).equals(inputSnapshots[key].bytes)).toBe(true);
      expect(fixtureFileSha256(filePath)).toBe(inputSnapshots[key].sha256);
    }
  });

  it("runs the package workflow:f6 script and succeeds for multimodal v4 with governed artifacts", async () => {
    const bundle = createRealBundle();
    const evidence = installF6V2Evidence(bundle);
    const outputRoot = path.join(bundle.publishRoot, "f6-runs", "package-script");
    const modelPath = path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact);
    const originalModel = readFileSync(modelPath);
    rewriteFixtureJson(modelPath, (model) => {
      model.contractVersion = "f5-multimodal-artifact-v4";
      model.worksheets = model.worksheets.map((pair) => ({
        status: "completed",
        ...pair,
        scopeEvaluations: requiredScopeEvaluations(),
      }));
    });
    bundle.expectedModelInterpretationContentHash = fixtureFileSha256(modelPath);
    const f5Bytes = readFileSync(bundle.paths.f5);
    const f5Sha256 = fixtureFileSha256(bundle.paths.f5);
    const npmExecutable = process.platform === "win32" ? process.execPath : "npm";
    const npmPrefixArgs = process.platform === "win32" ? [process.env.npm_execpath] : [];

    const child = await execFileAsync(npmExecutable, [
      ...npmPrefixArgs,
      "run",
      "--silent",
      "workflow:f6",
      "--",
      bundle.f2ArtifactRoot,
      bundle.f3ArtifactRoot,
      bundle.f4ArtifactRoot,
      bundle.f5ArtifactRoot,
      "--worksheet", "Analysis-A",
      "--language", "en-US",
      "--analysis-request-context", JSON.stringify(REQUEST_CONTEXT),
      "--model-interpretation", path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact),
      "--image-observations", path.join(evidence.evidenceArtifactRoot, evidence.imageObservationArtifact),
    ], {
      cwd: path.resolve("."),
      encoding: "utf8",
      env: {
        ...process.env,
        AI_TVA_F6_OUTPUT_ROOT: outputRoot,
        AI_TVA_F6_PUBLISH_ROOT: bundle.publishRoot,
        npm_config_update_notifier: "false",
      },
      shell: false,
      maxBuffer: 4 * 1024 * 1024,
    });

    expect(child.stderr).toBe("");
    const result = JSON.parse(child.stdout);
    expect(result).toMatchObject({ status: "completed" });
    const runDirectories = readdirSync(outputRoot);
    expect(runDirectories).toHaveLength(1);
    const runRoot = path.join(outputRoot, runDirectories[0]);
    expect(readdirSync(runRoot).sort()).toEqual([
      "Anonymous - TA ENGINEERING ANALYSIS REPORT.md",
      "Anonymous - TA ENGINEERING ANALYSIS REPORT.pdf",
      "Feature6-Optimization.json",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    const manifest = readJson(path.join(runRoot, "manifest.json"));
    expect(manifest).toMatchObject({
      artifactSetVersion: "f6-artifact-set-v4",
      status: "completed",
      artifacts: {
        optimizationJson: "Feature6-Optimization.json",
        finalReportMarkdown: "Anonymous - TA ENGINEERING ANALYSIS REPORT.md",
        finalReportPdf: "Anonymous - TA ENGINEERING ANALYSIS REPORT.pdf",
        runSummary: "Feature6-Run-Summary.json",
      },
    });
    expect(readFileSync(bundle.paths.f5).equals(f5Bytes)).toBe(true);
    expect(fixtureFileSha256(bundle.paths.f5)).toBe(f5Sha256);
    expect(readFileSync(modelPath)).not.toEqual(originalModel);
  }, 240_000);

  it("rejects an out-of-bound core root when layout validation is bypassed", () => {
    const bundle = createRealBundle();
    const outsideF2Root = path.join(bundle.root, "outside", "f2");
    mkdirSync(path.dirname(outsideF2Root), { recursive: true });
    renameSync(bundle.f2ArtifactRoot, outsideF2Root);
    bundle.f2ArtifactRoot = outsideF2Root;

    const { result, runRoot } = runRealF6(bundle, "outside-core-root");

    expect(result).toMatchObject({ status: "failed", reasonCode: "input_rejected" });
    expect(readdirSync(runRoot)).toEqual(["manifest.json"]);
    expect(readJson(path.join(runRoot, "manifest.json"))).toMatchObject({
      status: "failed",
      reasonCode: "input_rejected",
      artifacts: {},
    });
  });

  it("publishes an evidence-only final report section when an F2 worksheet is blocked", () => {
    const bundle = createRealBundle({ blockedWorksheetNames: ["Blocked-A"] });
    const { result, runRoot } = runRealF6(bundle, "mixed-ready-blocked");

    expect(result.status).toBe("completed");
    expect(readdirSync(runRoot).sort()).toEqual([
      "Feature6-Optimization.json",
      "Feature6-Report.md",
      "Feature6-Report.pdf",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    const summary = readJson(path.join(runRoot, "Feature6-Run-Summary.json"));
    expect(readFileSync(path.join(runRoot, "Feature6-Report.md"), "utf8")).toContain("# F6 final report");
    expect(summary.reportSummary.workbookDisposition).toBe("FAIL");
  });

  it("publishes valid hashes and conservative results when optional evidence is absent", () => {
    const bundle = createRealBundle();
    const { result, runRoot } = runRealF6(bundle, "no-optional-evidence");
    const optimization = readJson(path.join(runRoot, "Feature6-Optimization.json"));
    const summary = readJson(path.join(runRoot, "Feature6-Run-Summary.json"));
    const worksheet = optimization.worksheets[0];

    expect(result.status).toBe("completed");
    expect(readdirSync(runRoot)).toHaveLength(5);
    expect(optimization.optimizationVersion).toBe("f6-optimization-v4");
    expect(worksheet.steps.map(({ step }) => step)).toEqual(["meanResponseCentering", "toleranceReverseSolve", "specificationRelaxation"]);
    expect(summary.inputDecisions).toEqual({
      analysisContext: { outcome: "NOT_PROVIDED" },
      optimizationTargets: { outcome: "NOT_PROVIDED" },
      modelInterpretation: expect.objectContaining({ outcome: "CALLER_AUTHORIZED" }),
    });
    expect(summary.hashes).toEqual({
      optimizationJsonSha256: artifactHash(path.join(runRoot, "Feature6-Optimization.json")),
      finalReportMarkdownSha256: artifactHash(path.join(runRoot, "Feature6-Report.md")),
      finalReportPdfSha256: artifactHash(path.join(runRoot, "Feature6-Report.pdf")),
    });
    expect(summary.reportSummary.workbookDisposition).toBeDefined();
    expect(readJson(path.join(runRoot, "manifest.json"))).toMatchObject({
      status: "completed",
      artifacts: {
        optimizationJson: "Feature6-Optimization.json",
        finalReportMarkdown: "Feature6-Report.md",
        finalReportPdf: "Feature6-Report.pdf",
        runSummary: "Feature6-Run-Summary.json",
      },
    });
  });

  it("keeps model interpretation caller-authorized by auto-inheriting the current F5 observation ledger", () => {
    const bundle = createRealBundle();
    installF5CurrentObservationLedger(bundle);
    bundle.imageObservationArtifact = undefined;
    bundle.evidenceArtifactRoot = undefined;

    const { result, runRoot } = runRealF6(bundle, "auto-inherit-f5-observation", {}, {
      imageObservationArtifact: undefined,
    });
    const summary = readJson(path.join(runRoot, "Feature6-Run-Summary.json"));

    expect(result.status).toBe("completed");
    expect(summary.inputDecisions.modelInterpretation).toMatchObject({ outcome: "CALLER_AUTHORIZED" });
    expect(summary.sources.imageObservation).toEqual({
      artifact: "Feature5-Image-Observations.json",
      contentHash: fixtureFileSha256(path.join(bundle.f5ArtifactRoot, "Feature5-Image-Observations.json")),
    });
  });

  it("rejects explicitly supplied invalid F5 v2 evidence without successful report artifacts", () => {
    const bundle = createRealBundle();
    const evidence = installF6V2Evidence(bundle);
    cleanup.push(evidence.evidenceArtifactRoot);
    const evidencePath = path.join(evidence.evidenceArtifactRoot, evidence.imageObservationArtifact);
    rewriteFixtureJson(evidencePath, (artifact) => {
      artifact.worksheets[0].contextSnapshot.dimensionDescription = "Other loop";
    });

    const { result, runRoot } = runRealF6(bundle, "invalid-v2-evidence", {}, {
      imageObservationArtifact: evidencePath,
    });

    expect(result).toMatchObject({ status: "failed", reasonCode: "input_rejected" });
    expect(readdirSync(runRoot)).toEqual(["manifest.json"]);
    expect(readJson(path.join(runRoot, "manifest.json"))).toMatchObject({
      status: "failed",
      reasonCode: "input_rejected",
      artifacts: {},
    });
  });

  it("executes only governed sensitivity scenarios when no concrete targets are provided", () => {
    const bundle = createRealBundle();
    const calculateScenario = vi.fn((args) => calculateF6Scenario(args));
    const { result, runRoot } = runRealF6(bundle, "no-target-no-scenario", {
      createOptimization(request, inputs) {
        return createF6OptimizationV4(request, inputs, { calculateScenario });
      },
    });
    const optimization = readJson(path.join(runRoot, "Feature6-Optimization.json"));

    expect(result.status).toBe("completed");
    expect(readdirSync(runRoot)).toHaveLength(5);
    expect(calculateScenario).toHaveBeenCalledTimes(3);
    expect(calculateScenario.mock.calls.map(([call]) => call.scenario.scenarioId)).toEqual([
      "Analysis-A:v4-sensitivity:OP1",
      "Analysis-A:v4-sensitivity:OP2",
      "Analysis-A:v4-sensitivity:OP3",
    ]);
    expect(optimization.optimizationVersion).toBe("f6-optimization-v4");
  });

  it.each([
    ["workbook", "f3", (report) => { report.workbook.contentHash = "c".repeat(64); }],
    ["run", "f4", (report) => { report.runId = "other-run"; }],
    ["source", "f2", (report) => { report.worksheets[0].rows[0].sourceRow = 99; }],
  ])("rejects an actual %s identity mutation", (identity, artifactKey, mutate) => {
    const bundle = createRealBundle();
    rewriteFixtureJson(bundle.paths[artifactKey], mutate);

    const { result, runRoot } = runRealF6(bundle, `identity-${identity}`);

    expect(result).toMatchObject({ status: "failed", reasonCode: "input_rejected" });
    expect(readdirSync(runRoot)).toEqual(["manifest.json"]);
  });

  it("keeps run completion when raw worksheet image bytes change after governed model interpretation is fixed", () => {
    const bundle = createRealBundle();
    const imageReference = bundle.f3Worksheets[0].rows[0].imageReference;
    writeFileSync(path.join(bundle.f2ArtifactRoot, imageReference.relativePath), Buffer.from("tampered image bytes"));

    const { result, runRoot } = runRealF6(bundle, "tampered-image");

    expect(result.status).toBe("completed");
    expect(readdirSync(runRoot).sort()).toEqual([
      "Feature6-Optimization.json",
      "Feature6-Report.md",
      "Feature6-Report.pdf",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    expect(readJson(path.join(runRoot, "manifest.json"))).toMatchObject({
      status: "completed",
      artifacts: {
        optimizationJson: "Feature6-Optimization.json",
        finalReportMarkdown: "Feature6-Report.md",
        finalReportPdf: "Feature6-Report.pdf",
        runSummary: "Feature6-Run-Summary.json",
      },
    });
  });

  it("keeps the legacy comparison placeholder unavailable", () => {
    expect(createComparisonPlaceholder({
      contractVersion: "v1",
      inputClassification: "confidential",
      projectReference: "controlled-project-reference",
      runReference: "controlled-run-reference",
      worksheetReferences: ["controlled-worksheet-reference"],
    })).toMatchObject({
      featureId: "F6",
      status: "feature_not_available",
      requiredPrerequisites: ["approved-knowledge-base"],
    });
  });

});

function requiredScopeEvaluations() {
  return ["tolerance_loop_closure", "datum_chain", "assembly_datum_face", "stack_start", "direction"].map((scope) => ({
    scope, status: "insufficient_evidence", observedValue: "ambiguous", confidence: "low",
    visibleBasis: "The supplied image does not establish this geometry.",
  }));
}