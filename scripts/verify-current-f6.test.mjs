import { lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createF6ArtifactBundleFixture,
  fixtureFileSha256,
  installF5CurrentObservationLedger,
  installF6ModelInterpretation,
  installRequiredMultimodalV3,
  installF6V2Evidence,
} from "./f6-artifact-test-fixture.mjs";
import { runF6FullValidation } from "./run-f6-full-validation.mjs";
import { validateExistingF6Artifact } from "./verify-current-f6.mjs";

const OPTIONAL_SOURCE_KEYS = [
  "imageObservation",
  "supplierCapability",
  "datumStrategy",
  "cost",
  "analysisContext",
  "optimizationTargets",
  "modelInterpretation",
];
const INTERACTION_LANGUAGE = { languageTag: "en-US", uiCatalogLanguage: "en", lockedAtTurnId: "turn-1", source: "workflow_start", fallbackUsed: false };

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function rewriteAsHistoricalV2(runRoot, optionalArtifacts = {}, blockedWorksheetNames = []) {
  const optimizationPath = path.join(runRoot, "Feature6-Optimization.json");
  const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
  const manifestPath = path.join(runRoot, "manifest.json");
  const optimizationMarkdownPath = path.join(runRoot, "Feature6-Optimization.md");
  rmSync(path.join(runRoot, "Feature6-Report.pdf"));
  const current = readJson(optimizationPath);
  const baselineIdentity = current.worksheets[0].baselineIdentity;
  const metrics = { mean: 0, rssSigma: 0.05, worstCaseLower: -0.2, worstCaseUpper: 0.2, cp: 1, cpk: 0.9, yield: 0.99, dpm: 10000 };
  const notProvided = { outcome: "NOT_PROVIDED" };
  const artifactReference = (filePath) => ({ artifact: path.basename(filePath), contentHash: fixtureFileSha256(filePath) });
  const optimization = {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F6",
    optimizationVersion: "f6-optimization-v2",
    runStatus: "COMPLETED",
    workbook: current.workbook,
    provenance: {
      f2Reference: current.provenance.f2Reference,
      f3Reference: current.provenance.f3Reference,
      f4Reference: current.provenance.f4Reference,
      f5Reference: current.provenance.f5Reference,
      reportScope: { worksheetNames: [baselineIdentity.worksheetName, ...blockedWorksheetNames], blockedWorksheetNames },
      supplierCapabilityDecision: notProvided,
      datumStrategyDecision: notProvided,
      costDecision: notProvided,
      analysisContextDecision: notProvided,
      optimizationTargetsDecision: notProvided,
      ...(optionalArtifacts.imageObservationArtifact === undefined ? {} : { imageObservationReference: artifactReference(optionalArtifacts.imageObservationArtifact) }),
      ...(optionalArtifacts.supplierCapabilityArtifact === undefined ? {} : { supplierCapabilityReference: artifactReference(optionalArtifacts.supplierCapabilityArtifact) }),
      ...(optionalArtifacts.datumStrategyArtifact === undefined ? {} : { datumStrategyReference: artifactReference(optionalArtifacts.datumStrategyArtifact) }),
      ...(optionalArtifacts.costArtifact === undefined ? {} : { costReference: artifactReference(optionalArtifacts.costArtifact) }),
      ...(optionalArtifacts.analysisContextArtifact === undefined ? {} : { analysisContextDecision: { outcome: "CALLER_AUTHORIZED", artifactReference: artifactReference(optionalArtifacts.analysisContextArtifact) } }),
      ...(optionalArtifacts.optimizationTargetsArtifact === undefined ? {} : { optimizationTargetsDecision: { outcome: "CALLER_AUTHORIZED", artifactReference: artifactReference(optionalArtifacts.optimizationTargetsArtifact) } }),
      ...(optionalArtifacts.modelInterpretationArtifact === undefined ? {} : { modelInterpretationDecision: { outcome: "CALLER_AUTHORIZED", artifactReference: artifactReference(optionalArtifacts.modelInterpretationArtifact) } }),
    },
    worksheets: [{
      worksheetName: baselineIdentity.worksheetName,
      tableId: baselineIdentity.tableId,
      runStatus: "COMPLETED",
      baselineIdentity,
      baselineMetrics: metrics,
      targetCapability: { targetCpk: 1, targetSigmaLevel: 3, source: "WORKSHEET" },
      options: [{
        optionId: `${baselineIdentity.worksheetName}:candidate`,
        status: "candidate",
        reasonCode: "target_not_provided",
        candidateFactors: [{ worksheetName: baselineIdentity.worksheetName, tableId: baselineIdentity.tableId, sourceRow: 14, factorName: "Factor A", unit: "mm" }],
        requiredInputs: ["optimization_target"],
        calculationMethod: "Provide a governed target and rerun through F4.",
        baselineMetrics: metrics,
        impactRank: null,
      }],
      highestImpactAction: null,
      findings: [],
      risks: [],
      recommendations: [],
      clarifications: [],
    }],
    summary: { worksheetCount: 1, completedWorksheetCount: 1, partiallyCompletedWorksheetCount: 0, inputRejectedWorksheetCount: 0, candidateOptionCount: 1, completedOptionCount: 0, insufficientEvidenceOptionCount: 0, calculationFailedOptionCount: 0 },
  };
  writeJson(optimizationPath, optimization);

  const inputDecisions = {
    analysisContext: optimization.provenance.analysisContextDecision,
    optimizationTargets: optimization.provenance.optimizationTargetsDecision,
    ...(optimization.provenance.modelInterpretationDecision === undefined ? {} : { modelInterpretation: optimization.provenance.modelInterpretationDecision }),
  };
  const summary = readJson(summaryPath);
  summary.status = "completed";
  summary.counts = optimization.summary;
  summary.sources = Object.fromEntries([
    ...["f2", "f3", "f4", "f5", "imageObservation", "supplierCapability", "datumStrategy", "cost"]
      .map((key) => [key, optimization.provenance[`${key}Reference`]])
      .filter(([, reference]) => reference !== undefined),
    ...["analysisContext", "optimizationTargets", "modelInterpretation"]
      .map((key) => [key, optimization.provenance[`${key}Decision`]?.artifactReference])
      .filter(([, reference]) => reference !== undefined),
  ]);
  summary.inputDecisions = inputDecisions;
  if (blockedWorksheetNames.length > 0) {
    summary.reportSummary = {
      workbookDisposition: "FAIL",
      worksheetDispositions: [
        ...summary.reportSummary.worksheetDispositions,
        ...blockedWorksheetNames.map((worksheetName) => ({ worksheetName, disposition: "FAIL" })),
      ],
    };
  }
  summary.hashes.optimizationJsonSha256 = fixtureFileSha256(optimizationPath);
  delete summary.hashes.finalReportPdfSha256;
  writeFileSync(optimizationMarkdownPath, "# Historical F6 optimization\n", "utf8");
  summary.hashes.optimizationMarkdownSha256 = fixtureFileSha256(optimizationMarkdownPath);
  writeJson(summaryPath, summary);
  const manifest = readJson(manifestPath);
  delete manifest.artifactSetVersion;
  manifest.status = "completed";
  manifest.inputDecisions = inputDecisions;
  manifest.artifacts.optimizationMarkdown = "Feature6-Optimization.md";
  delete manifest.artifacts.finalReportPdf;
  writeJson(manifestPath, manifest);
}

function fileSymlinksAvailable() {
  const probeRoot = mkdirTempRoot("f6-existing-symlink-probe-");
  try {
    const target = path.join(probeRoot, "target.json");
    writeFileSync(target, "{}", "utf8");
    symlinkSync(target, path.join(probeRoot, "link.json"), "file");
    return true;
  } catch (error) {
    if (["EACCES", "EPERM", "UNKNOWN"].includes(error?.code)) return false;
    throw error;
  } finally {
    rmSync(probeRoot, { recursive: true, force: true });
  }
}

function mkdirTempRoot(prefix) {
  const root = path.join(tmpdir(), `${prefix}${process.pid}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

const FILE_SYMLINKS_AVAILABLE = fileSymlinksAvailable();

function baselineIdentity(calculation) {
  return {
    calculationVersion: calculation.calculationVersion,
    projectReference: calculation.projectReference,
    runReference: calculation.runReference,
    workbookContentHash: calculation.workbookContentHash,
    worksheetName: calculation.worksheetSelection.worksheetName,
    tableId: calculation.worksheetSelection.tableId,
  };
}

function factorIdentity(factor) {
  return {
    worksheetName: factor.source.worksheetName,
    tableId: factor.source.tableId,
    sourceRow: factor.source.sourceRow,
    factorName: factor.factorName,
    unit: factor.unit,
  };
}

function installAllOptionalInputs(bundle) {
  const evidence = installF6V2Evidence(bundle);
  const calculation = bundle.calculations[0];
  const factor = calculation.factors[0];
  const worksheetName = calculation.worksheetSelection.worksheetName;
  const tableId = calculation.worksheetSelection.tableId;
  const sourceRow = factor.source.sourceRow;
  const sourceRows = [{ worksheetName, tableId, sourceRow }];
  const evidenceLocator = {
    artifactReference: { artifact: "Feature4-Calculation.json", contentHash: fixtureFileSha256(bundle.paths.f4) },
    worksheetName,
    sourceRows,
  };
  const contextArtifact = "context.json";
  const targetsArtifact = "targets.json";
  const supplierArtifact = "supplier.json";
  const datumArtifact = "datum.json";
  const costArtifact = "cost.json";

  writeJson(path.join(evidence.evidenceArtifactRoot, contextArtifact), {
    contractVersion: "v1",
    inputClassification: "confidential",
    contextVersion: "f6-analysis-context-v1",
    workbookContentHash: calculation.workbookContentHash,
    worksheets: [{
      worksheetName,
      tableId,
      baselineIdentity: baselineIdentity(calculation),
      analysisObject: {
        kind: "GAP",
        name: "Gap A",
        physicalMeaning: "Controlled clearance.",
        measurementDirection: "Z",
        positiveDirectionDefinition: "Increasing clearance.",
        negativeDirectionDefinition: "Increasing interference.",
        evidence: evidenceLocator,
      },
      operatingConditions: [],
      correlationRequirement: { mode: "NOT_PROVIDED" },
    }],
  });
  writeJson(path.join(evidence.evidenceArtifactRoot, targetsArtifact), {
    contractVersion: "v1",
    inputClassification: "confidential",
    targetVersion: "f6-optimization-targets-v1",
    workbookContentHash: calculation.workbookContentHash,
    worksheets: [{
      worksheetName,
      tableId,
      baselineIdentity: baselineIdentity(calculation),
      targets: [{
        targetId: "target-a",
        targetType: "improvement_ratio",
        factor: factorIdentity(factor),
        ratio: 0.2,
        appliesTo: "tolerance_band",
      }],
    }],
  });
  writeJson(path.join(evidence.evidenceArtifactRoot, supplierArtifact), {
    evidenceVersion: "supplier-capability-v1",
    supplierReference: "supplier-a",
    processFamily: "cnc",
    partCategory: "CNC",
    capabilityTier: "T1",
    achievableToleranceBand: 0.3,
    distribution: "normal",
    source: supplierArtifact,
    effectiveVersion: "2026-Q3",
    contentHash: "c".repeat(64),
  });
  writeJson(path.join(evidence.evidenceArtifactRoot, datumArtifact), {
    evidenceVersion: "datum-strategy-v1",
    worksheetName,
    datumFace: "A",
    stackStart: "A",
    factorDirections: [{ tableId, sourceRow, direction: 1 }],
    datumChainEdges: [{ from: "A", to: "B" }],
    crossSubsystemRelations: [],
    drawingEvidence: ["drawing-a.pdf"],
    reviewStatus: "confirmed",
    source: datumArtifact,
    effectiveVersion: "v1",
    contentHash: "d".repeat(64),
  });
  writeJson(path.join(evidence.evidenceArtifactRoot, costArtifact), {
    evidenceVersion: "cost-model-v1",
    model: "relative-cost",
    unit: "index",
    optionCosts: [{ optionKind: "reduce_top_contributor_20", cost: 1 }],
    roiPolicyVersion: "f6-delta-cpk-per-cost-v1",
    roiCalculationReference: { artifact: "Feature4-Calculation.json", contentHash: fixtureFileSha256(bundle.paths.f4) },
    source: costArtifact,
    effectiveVersion: "v1",
    contentHash: "e".repeat(64),
  });
  const modelInterpretation = installF6ModelInterpretation(bundle);

  return {
    imageObservationArtifact: path.join(evidence.evidenceArtifactRoot, evidence.imageObservationArtifact),
    supplierCapabilityArtifact: path.join(evidence.evidenceArtifactRoot, supplierArtifact),
    datumStrategyArtifact: path.join(evidence.evidenceArtifactRoot, datumArtifact),
    costArtifact: path.join(evidence.evidenceArtifactRoot, costArtifact),
    analysisContextArtifact: path.join(evidence.evidenceArtifactRoot, contextArtifact),
    optimizationTargetsArtifact: path.join(evidence.evidenceArtifactRoot, targetsArtifact),
    modelInterpretationArtifact: modelInterpretation.filePath,
  };
}

function createVerifiedRun({ worksheetNames = ["Analysis-A"], blockedWorksheetNames = [], optionalInputs = false, currentObservation = false, currentV3Blocked = false } = {}) {
  const bundle = createF6ArtifactBundleFixture({ worksheetNames, blockedWorksheetNames: currentV3Blocked ? blockedWorksheetNames : [] });
  const optionalArtifacts = optionalInputs ? installAllOptionalInputs(bundle) : {};
  if (currentObservation) installF5CurrentObservationLedger(bundle);
  installRequiredMultimodalV3(bundle);
  optionalArtifacts.modelInterpretationArtifact = path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact);
  const runId = `2026-08-20T06-00-00-000Z-${worksheetNames.join("-")}`;
  const runRoot = path.join(bundle.publishRoot, "f6-runs", runId);

  const result = runF6FullValidation({}, {
    parseArgs: () => ({
      f2ArtifactRoot: bundle.f2ArtifactRoot,
      f3ArtifactRoot: bundle.f3ArtifactRoot,
      f4ArtifactRoot: bundle.f4ArtifactRoot,
      f5ArtifactRoot: bundle.f5ArtifactRoot,
      selectedWorksheetNames: bundle.selectedWorksheetNames,
      interactionLanguage: INTERACTION_LANGUAGE,
      modelInterpretationArtifact: path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact),
      expectedModelInterpretationContentHash: bundle.expectedModelInterpretationContentHash,
    }),
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
    renderFinalReportPdf: () => Buffer.from("%PDF-1.7\nvalidated report\n"),
  });

  expect(result.status, JSON.stringify(result, null, 2)).toBe("completed");
  if (optionalInputs || (blockedWorksheetNames.length > 0 && !currentV3Blocked)) rewriteAsHistoricalV2(runRoot, optionalArtifacts, blockedWorksheetNames);
  return { runRoot, bundle };
}

describe("validateExistingF6Artifact", () => {
  it("reads an untouched historical v2 bundle without adding model interpretation or rewriting files", () => {
    const { runRoot, bundle } = createVerifiedRun();
    rewriteAsHistoricalV2(runRoot);
    const before = readFileSync(path.join(runRoot, "Feature6-Optimization.json"));

    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toMatchObject({ status: "accepted" });
    expect(readFileSync(path.join(runRoot, "Feature6-Optimization.json"))).toEqual(before);
  });

  it("rejects a tampered historical v2 optimization through its recorded hash", () => {
    const { runRoot, bundle } = createVerifiedRun();
    rewriteAsHistoricalV2(runRoot);
    const optimizationPath = path.join(runRoot, "Feature6-Optimization.json");
    const optimization = readJson(optimizationPath);
    optimization.workbook.fileName = "Tampered.xlsx";
    writeJson(optimizationPath, optimization);

    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toEqual({
      status: "rejected",
      reasonCode: "artifact_hash_mismatch",
    });
  });

  it("rejects hash-consistent v3 optimization without mandatory multimodal provenance", () => {
    const { runRoot, bundle } = createVerifiedRun();
    const optimizationPath = path.join(runRoot, "Feature6-Optimization.json");
    const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
    const optimization = readJson(optimizationPath);
    delete optimization.provenance.multimodalReference;
    writeJson(optimizationPath, optimization);
    const summary = readJson(summaryPath);
    summary.hashes.optimizationJsonSha256 = fixtureFileSha256(optimizationPath);
    writeJson(summaryPath, summary);

    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toEqual({
      status: "rejected",
      reasonCode: "artifact_validation_failed",
    });
  });

  it("accepts a valid five-file run from the output directory", () => {
    const { runRoot, bundle } = createVerifiedRun({ worksheetNames: ["Analysis-A", "Analysis-B"] });

    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toMatchObject({
      status: "accepted",
      outputDirectory: runRoot,
      finalReportMarkdownPath: path.join(runRoot, "Feature6-Report.md"),
      finalReportPdfPath: path.join(runRoot, "Feature6-Report.pdf"),
    });
  });

  it("accepts a current v3 run with an auto-inherited F5 image-observation source", () => {
    const { runRoot, bundle } = createVerifiedRun({ currentObservation: true });
    const summary = readJson(path.join(runRoot, "Feature6-Run-Summary.json"));

    expect(summary.sources.imageObservation).toBeDefined();
    const result = validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot });
    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.outputDirectory).toBe(runRoot);
  });

  it("accepts a current v3 report with a governed blocked FAIL worksheet", () => {
    const { runRoot, bundle } = createVerifiedRun({
      worksheetNames: ["Analysis-A"],
      blockedWorksheetNames: ["Blocked-A"],
      currentV3Blocked: true,
    });

    const result = validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot });

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.reportSummary.worksheetDispositions).toEqual([
      { worksheetName: "Analysis-A", disposition: "CONDITIONAL_PASS" },
      { worksheetName: "Blocked-A", disposition: "FAIL" },
    ]);
  });

  it("rejects artifacts missing both required input decision ledgers", () => {
    const { runRoot, bundle } = createVerifiedRun();
    const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
    const manifestPath = path.join(runRoot, "manifest.json");
    const summary = readJson(summaryPath);
    const manifest = readJson(manifestPath);
    delete summary.inputDecisions;
    delete manifest.inputDecisions;
    writeJson(summaryPath, summary);
    writeJson(manifestPath, manifest);

    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toEqual({
      status: "rejected",
      reasonCode: "input_decisions_invalid",
    });
  });

  it("rejects summary counts that drift from optimization summary", () => {
    const { runRoot, bundle } = createVerifiedRun();
    const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
    const summary = readJson(summaryPath);
    summary.counts.completedOptionCount += 1;
    writeJson(summaryPath, summary);

    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toEqual({
      status: "rejected",
      reasonCode: "run_summary_invalid",
    });
  });

  it("rejects source bindings that drift from optimization provenance", () => {
    const { runRoot, bundle } = createVerifiedRun();
    const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
    const summary = readJson(summaryPath);
    summary.sources.f3.contentHash = "f".repeat(64);
    writeJson(summaryPath, summary);

    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toEqual({
      status: "rejected",
      reasonCode: "run_summary_invalid",
    });
  });

  it("accepts a valid five-file run with all optional governed source entries", () => {
    const { runRoot, bundle } = createVerifiedRun({ optionalInputs: true });
    const summary = readJson(path.join(runRoot, "Feature6-Run-Summary.json"));
    const optimization = readJson(path.join(runRoot, "Feature6-Optimization.json"));

    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toMatchObject({
      status: "accepted",
      outputDirectory: runRoot,
    });
    expect(Object.keys(summary.sources).sort()).toEqual([
      "analysisContext",
      "cost",
      "datumStrategy",
      "f2",
      "f3",
      "f4",
      "f5",
      "imageObservation",
      "modelInterpretation",
      "optimizationTargets",
      "supplierCapability",
    ]);
    expect(summary.sources.supplierCapability).toEqual(optimization.provenance.supplierCapabilityReference);
    expect(summary.sources.datumStrategy).toEqual(optimization.provenance.datumStrategyReference);
    expect(summary.sources.cost).toEqual(optimization.provenance.costReference);
    expect(summary.sources.analysisContext).toEqual(optimization.provenance.analysisContextDecision.artifactReference);
    expect(summary.sources.optimizationTargets).toEqual(optimization.provenance.optimizationTargetsDecision.artifactReference);
    expect(summary.sources.modelInterpretation).toEqual(optimization.provenance.modelInterpretationDecision.artifactReference);
  });

  it.each(OPTIONAL_SOURCE_KEYS)("rejects optional source %s when its run summary hash drifts", (sourceKey) => {
    const { runRoot, bundle } = createVerifiedRun({ optionalInputs: true });
    const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
    const summary = readJson(summaryPath);
    summary.sources[sourceKey].contentHash = "f".repeat(64);
    writeJson(summaryPath, summary);

    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toEqual({
      status: "rejected",
      reasonCode: "run_summary_invalid",
    });
  });

  it.each(OPTIONAL_SOURCE_KEYS)("rejects optional source %s when its run summary entry is removed", (sourceKey) => {
    const { runRoot, bundle } = createVerifiedRun({ optionalInputs: true });
    const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
    const summary = readJson(summaryPath);
    delete summary.sources[sourceKey];
    writeJson(summaryPath, summary);

    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toEqual({
      status: "rejected",
      reasonCode: "run_summary_invalid",
    });
  });

  it("accepts report summary worksheets absent from Optimization only when they are blocked FAIL dispositions", () => {
    const { runRoot, bundle } = createVerifiedRun({ worksheetNames: ["Analysis-A"], blockedWorksheetNames: ["Blocked-A"] });
    const result = validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot });

    expect(result).toMatchObject({ status: "accepted" });
    expect(result.reportSummary.worksheetDispositions).toEqual([
      { worksheetName: "Analysis-A", disposition: "CONDITIONAL_PASS" },
      { worksheetName: "Blocked-A", disposition: "FAIL" },
    ]);
    expect(result.reportSummary.workbookDisposition).toBe("FAIL");
  });

  it("rejects report summary worksheets absent from Optimization when their disposition is not FAIL", () => {
    const { runRoot, bundle } = createVerifiedRun({ worksheetNames: ["Analysis-A"], blockedWorksheetNames: ["Blocked-A"] });
    const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
    const summary = readJson(summaryPath);
    summary.reportSummary.worksheetDispositions.find(({ worksheetName }) => worksheetName === "Blocked-A").disposition = "INCOMPLETE";
    writeJson(summaryPath, summary);

    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toMatchObject({ status: "rejected", reasonCode: "report_summary_invalid" });
  });

  it("rejects arbitrary extra FAIL report summary worksheets outside persisted report scope", () => {
    const { runRoot, bundle } = createVerifiedRun({ worksheetNames: ["Analysis-A"] });
    const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
    const summary = readJson(summaryPath);
    summary.reportSummary = {
      workbookDisposition: "FAIL",
      worksheetDispositions: [
        ...summary.reportSummary.worksheetDispositions,
        { worksheetName: "Injected-FAIL", disposition: "FAIL" },
      ],
    };
    writeJson(summaryPath, summary);

    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toEqual({
      status: "rejected",
      reasonCode: "report_summary_invalid",
    });
  });

  it("requires callers of the exported validator to provide an explicit publish root", () => {
    const { runRoot } = createVerifiedRun();
    expect(validateExistingF6Artifact(runRoot)).toEqual({ status: "rejected", reasonCode: "artifact_publish_root_required" });
  });

  it("rejects a missing publish root before reading the artifact", () => {
    const { runRoot, bundle } = createVerifiedRun();
    expect(validateExistingF6Artifact(runRoot, { publishRoot: path.join(bundle.root, "missing-publish-root") })).toEqual({ status: "rejected", reasonCode: "artifact_outside_publish_root" });
  });

  it("rejects linked artifact files without following them", ({ skip }) => {
    if (!FILE_SYMLINKS_AVAILABLE) return skip();
    const { runRoot, bundle } = createVerifiedRun();
    const realReport = path.join(runRoot, "Feature6-Report.real.md");
    const report = path.join(runRoot, "Feature6-Report.md");
    writeFileSync(realReport, readFileSync(report));
    rmSync(report);
    symlinkSync(realReport, report, "file");
    expect(lstatSync(report).isSymbolicLink()).toBe(true);

    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toEqual({ status: "rejected", reasonCode: "artifact_file_set_invalid" });
  });

  it("does not return raw exception details for malformed JSON artifacts", () => {
    const { runRoot, bundle } = createVerifiedRun();
    writeFileSync(path.join(runRoot, "manifest.json"), "{ secret: C:\\private\\manifest.json", "utf8");
    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toEqual({ status: "rejected", reasonCode: "artifact_validation_failed" });
  });

  it("binds manifest and run summary status to the Optimization runStatus mapping", () => {
    const { runRoot, bundle } = createVerifiedRun();
    const manifestPath = path.join(runRoot, "manifest.json");
    const manifest = readJson(manifestPath);
    manifest.status = "partially_completed";
    writeJson(manifestPath, manifest);
    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toMatchObject({ status: "rejected", reasonCode: "manifest_invalid" });
  });

  it("rejects a run summary status that drifts from the Optimization runStatus mapping", () => {
    const { runRoot, bundle } = createVerifiedRun();
    const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
    const summary = readJson(summaryPath);
    summary.status = "partially_completed";
    writeJson(summaryPath, summary);
    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toMatchObject({ status: "rejected", reasonCode: "run_summary_invalid" });
  });

  it("validates run summary input decisions against Optimization provenance", () => {
    const { runRoot, bundle } = createVerifiedRun();
    const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
    const summary = readJson(summaryPath);
    summary.inputDecisions.optimizationTargets = { outcome: "CALLER_AUTHORIZED", artifactReference: { artifact: "targets.json", contentHash: "c".repeat(64) } };
    writeJson(summaryPath, summary);
    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toMatchObject({ status: "rejected", reasonCode: "input_decisions_invalid" });
  });

  it("accepts Feature6-Optimization.json as the existing-artifact entry", () => {
    const { runRoot, bundle } = createVerifiedRun();
    expect(validateExistingF6Artifact(path.join(runRoot, "Feature6-Optimization.json"), { publishRoot: bundle.publishRoot })).toMatchObject({ status: "accepted", outputDirectory: runRoot });
  });

  it("rejects a changed final Markdown report through the recorded hash", () => {
    const { runRoot, bundle } = createVerifiedRun();
    writeFileSync(path.join(runRoot, "Feature6-Report.md"), "# altered\n", "utf8");
    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toMatchObject({ status: "rejected", reasonCode: "artifact_hash_mismatch" });
  });

  it("rejects hash-consistent bytes without a PDF signature", () => {
    const { runRoot, bundle } = createVerifiedRun();
    const pdfPath = path.join(runRoot, "Feature6-Report.pdf");
    const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
    writeFileSync(pdfPath, "not a pdf", "utf8");
    const summary = readJson(summaryPath);
    summary.hashes.finalReportPdfSha256 = fixtureFileSha256(pdfPath);
    writeJson(summaryPath, summary);

    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toEqual({
      status: "rejected",
      reasonCode: "pdf_artifact_invalid",
    });
  });

  it("rejects a workbook disposition that is not the worst worksheet disposition", () => {
    const { runRoot, bundle } = createVerifiedRun({ worksheetNames: ["Analysis-A", "Analysis-B"] });
    const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
    const summary = readJson(summaryPath);
    summary.reportSummary = {
      workbookDisposition: "PASS",
      worksheetDispositions: [
        { worksheetName: "Analysis-A", disposition: "PASS" },
        { worksheetName: "Analysis-B", disposition: "FAIL" },
      ],
    };
    writeJson(summaryPath, summary);
    expect(validateExistingF6Artifact(runRoot, { publishRoot: bundle.publishRoot })).toMatchObject({ status: "rejected", reasonCode: "report_summary_invalid" });
  });
});
