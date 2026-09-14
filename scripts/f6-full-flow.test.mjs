import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
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

const cleanup = [];
const deprecatedF6ReportArtifactName = ["Feature6", "Composed", "Report"].join("-");
const HASH = "a".repeat(64);
const PDF = Buffer.from("%PDF-1.7\nvalidated report\n");
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
  });
  if (loaded.status !== "accepted") throw new Error(`failed to build mock v4 optimization fixture: ${JSON.stringify(loaded)}`);
  return createF6OptimizationV4(loaded.request, {
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
      request: { request: true },
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
  const parsed = { ...bundle, interactionLanguage, ...parsedOverrides };
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

  it("writes all five fixed artifacts and passes validated reports to the final report projection", () => {
    const context = setup();
    const result = runF6FullValidation({ args: ["ignored"] }, context.deps);

    expect(result.status).toBe("completed");
    expect(readdirSync(context.runRoot).sort()).toEqual([
      "Feature6-Optimization.json",
      "Feature6-Report.md",
      "Feature6-Report.pdf",
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
      modelInterpretation: { contractVersion: "f5-multimodal-artifact-v3" },
    }, {
      outputRoot: context.runRoot,
      f1ArtifactRoot: undefined,
      publishRoot: context.publishRoot,
      requireMultimodalV3: true,
    });
    expect(result.finalReportMdPath).toBe(path.join(context.runRoot, "Feature6-Report.md"));
    expect(result.finalReportPdfPath).toBe(path.join(context.runRoot, "Feature6-Report.pdf"));
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
    const loaded = loadF6ArtifactBundle({ ...bundle, requireMultimodalV3: true });
    expect(loaded.status, JSON.stringify(loaded)).toBe("accepted");
    const optimized = createF6OptimizationV4(loaded.request, {
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
      expect(reportMarkdown).toContain("| [Analysis-B](#worksheet-2) | Loop Analysis-B | Multimodal blocker (evaluation\\_incomplete): Incomplete image assessment. | Fail |");
      expect(reportMarkdown).toContain("| Fail |");
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
      "Feature6-Optimization.json",
      "Feature6-Report.md",
      "Feature6-Report.pdf",
      "Feature6-Run-Summary.json",
      "manifest.json",
    ]);
    const summary = readJson(path.join(runRoot, "Feature6-Run-Summary.json"));
    const cliResult = JSON.parse(lines.join("\n"));
    const manifest = readJson(path.join(runRoot, "manifest.json"));
    assertRunSummaryMatchesProjection(summary, manifest, cliResult);
    expect(summary.hashes).toEqual({
      optimizationJsonSha256: artifactHash(path.join(runRoot, "Feature6-Optimization.json")),
      finalReportMarkdownSha256: artifactHash(path.join(runRoot, "Feature6-Report.md")),
      finalReportPdfSha256: artifactHash(path.join(runRoot, "Feature6-Report.pdf")),
    });
    const optimization = readJson(path.join(runRoot, "Feature6-Optimization.json"));
    const finalMarkdown = readFileSync(path.join(runRoot, "Feature6-Report.md"), "utf8");

    expect(optimization.optimizationVersion).toBe("f6-optimization-v4");
    expect(optimization.sequentialPolicyId).toBe("f6-sequential-optimization-policy-v2");
    expect(optimization.worksheets.every(({ steps }) =>
      steps.map(({ step }) => step).join(",") === "meanResponseCentering,toleranceReverseSolve,specificationRelaxation")).toBe(true);
    assertWorksheetLineageMatchesProvenance(optimization);
    expect(finalMarkdown).toContain("Analysis-A");
    expect(finalMarkdown).toContain("# F6 final report");
    expect(finalMarkdown).not.toContain(deprecatedF6ReportArtifactName);
    expect(cliResult.finalReportMdPath).toBe(path.join(runRoot, "Feature6-Report.md"));
    expect(cliResult.finalReportPdfPath).toBe(path.join(runRoot, "Feature6-Report.pdf"));
    expect(cliResult).not.toHaveProperty("composedReportJsonPath");
    expect(cliResult).not.toHaveProperty("composedReportMdPath");
    expect(manifest).toEqual({
      contractVersion: "v1",
      artifactSetVersion: "f6-artifact-set-v3",
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
      artifacts: {
        optimizationJson: "Feature6-Optimization.json",
        finalReportMarkdown: "Feature6-Report.md",
        finalReportPdf: "Feature6-Report.pdf",
        runSummary: "Feature6-Run-Summary.json",
      },
    });
    for (const [key, filePath] of Object.entries(bundle.paths)) {
      expect(readFileSync(filePath).equals(inputSnapshots[key].bytes)).toBe(true);
      expect(fixtureFileSha256(filePath)).toBe(inputSnapshots[key].sha256);
    }
  });

  it("runs the package workflow:f6 script and succeeds for multimodal v4 with governed artifacts", () => {
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

    const child = spawnSync(npmExecutable, [
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
    });

    expect(child.error).toBeUndefined();
    expect(child.status, child.stderr || child.stdout).toBe(0);
    expect(child.stderr).toBe("");
    const result = JSON.parse(child.stdout);
    expect(result).toMatchObject({ status: "completed" });
    const runDirectories = readdirSync(outputRoot);
    expect(runDirectories).toHaveLength(1);
    const runRoot = path.join(outputRoot, runDirectories[0]);
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
    expect(readFileSync(bundle.paths.f5).equals(f5Bytes)).toBe(true);
    expect(fixtureFileSha256(bundle.paths.f5)).toBe(f5Sha256);
    expect(readFileSync(modelPath)).not.toEqual(originalModel);
  });

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