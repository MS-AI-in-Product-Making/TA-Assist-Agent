import path from "node:path";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";
import { createF6OptimizationV4 } from "@ai-assist/workbook-catalog";

import { validateExistingF6 } from "./index.js";
import {
  createF6ArtifactBundleFixture,
  fixtureFileSha256,
  installRequiredMultimodalV3,
} from "../../../scripts/f6-artifact-test-fixture.mjs";
import { runF6FullValidation } from "../../../scripts/run-f6-full-validation.mjs";

const cleanup: string[] = [];
const interactionLanguage = { languageTag: "en-US", uiCatalogLanguage: "en", lockedAtTurnId: "turn-1", source: "workflow_start", fallbackUsed: false } as const;
const PDF = Buffer.from("%PDF-1.7\nvalidated report\n");

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- artifact mutation tests intentionally exercise untyped external JSON.
function readJson(filePath: string): any {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function recomputeOptimizationHash(runRoot: string): void {
  const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
  const summary = readJson(summaryPath);
  summary.hashes.optimizationJsonSha256 = fixtureFileSha256(path.join(runRoot, "Feature6-Optimization.json"));
  writeJson(summaryPath, summary);
}

function syncSummaryCounts(runRoot: string, optimization: any): void {
  const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
  const summary = readJson(summaryPath);
  summary.counts = optimization.summary;
  writeJson(summaryPath, summary);
}

function createV4FinalReportStub() {
  return {
    markdown: "# F6 final report\n",
    reportSummary: {
      workbookDisposition: "CONDITIONAL_PASS",
      worksheetDispositions: [{ worksheetName: "Analysis-A", disposition: "CONDITIONAL_PASS" }],
    },
    projection: {
      schemaVersion: "ta-engineering-report-projection-v1",
      title: "F6 final report",
      workbookDisposition: "CONDITIONAL_PASS",
      worksheetDispositions: [{ worksheetName: "Analysis-A", disposition: "CONDITIONAL_PASS" }],
      workbook: { fileName: "Demo.xlsx", contentHash: "a".repeat(64) },
      worksheets: [{
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "Loop A",
        disposition: "CONDITIONAL_PASS",
        requiredAction: "Review",
        findings: ["Stub report content for v4 validation tests."],
        assumptions: [],
        clarifications: [],
        gatingEvidenceReferences: ["F4:Analysis-A", "F5-multimodal:Analysis-A"],
      }],
    },
  };
}

function rewriteAsHistoricalV2(runRoot: string): void {
  const optimizationPath = path.join(runRoot, "Feature6-Optimization.json");
  const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
  const manifestPath = path.join(runRoot, "manifest.json");
  const optimizationMarkdownPath = path.join(runRoot, "Feature6-Optimization.md");
  rmSync(path.join(runRoot, "Feature6-Report.pdf"));
  const current = readJson(optimizationPath);
  const baselineIdentity = current.worksheets[0].baselineIdentity;
  const metrics = { mean: 0, rssSigma: 0.05, worstCaseLower: -0.2, worstCaseUpper: 0.2, cp: 1, cpk: 0.9, yield: 0.99, dpm: 10000 };
  const notProvided = { outcome: "NOT_PROVIDED" };
  const optimization = {
    contractVersion: "v1", outputClassification: "confidential", featureId: "F6", optimizationVersion: "f6-optimization-v2", runStatus: "COMPLETED",
    workbook: current.workbook,
    provenance: {
      f2Reference: current.provenance.f2Reference, f3Reference: current.provenance.f3Reference,
      f4Reference: current.provenance.f4Reference, f5Reference: current.provenance.f5Reference,
      reportScope: { worksheetNames: [baselineIdentity.worksheetName], blockedWorksheetNames: [] },
      supplierCapabilityDecision: notProvided, datumStrategyDecision: notProvided, costDecision: notProvided,
      analysisContextDecision: notProvided, optimizationTargetsDecision: notProvided,
    },
    worksheets: [{
      worksheetName: baselineIdentity.worksheetName, tableId: baselineIdentity.tableId, runStatus: "COMPLETED", baselineIdentity,
      baselineMetrics: metrics, targetCapability: { targetCpk: 1, targetSigmaLevel: 3, source: "WORKSHEET" },
      options: [{ optionId: `${baselineIdentity.worksheetName}:candidate`, status: "candidate", reasonCode: "target_not_provided", candidateFactors: [{ worksheetName: baselineIdentity.worksheetName, tableId: baselineIdentity.tableId, sourceRow: 14, factorName: "Factor A", unit: "mm" }], requiredInputs: ["optimization_target"], calculationMethod: "Provide a governed target and rerun through F4.", baselineMetrics: metrics, impactRank: null }],
      highestImpactAction: null, findings: [], risks: [], recommendations: [], clarifications: [],
    }],
    summary: { worksheetCount: 1, completedWorksheetCount: 1, partiallyCompletedWorksheetCount: 0, inputRejectedWorksheetCount: 0, candidateOptionCount: 1, completedOptionCount: 0, insufficientEvidenceOptionCount: 0, calculationFailedOptionCount: 0 },
  };
  writeJson(optimizationPath, optimization);
  const inputDecisions = { analysisContext: notProvided, optimizationTargets: notProvided };
  const summary = readJson(summaryPath);
  summary.status = "completed";
  summary.counts = optimization.summary;
  summary.sources = Object.fromEntries(["f2", "f3", "f4", "f5"].map((key) => [key, optimization.provenance[`${key}Reference` as keyof typeof optimization.provenance]]));
  summary.inputDecisions = inputDecisions;
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

afterEach(() => {
  for (const target of cleanup.splice(0)) rmSync(target, { recursive: true, force: true });
});

describe("validateExistingF6", () => {
  it("accepts a valid current v4 bundle with unchanged five-file publication", () => {
    const bundle = createF6ArtifactBundleFixture();
    installRequiredMultimodalV3(bundle);
    cleanup.push(bundle.root);
    const runId = "2026-09-14T09-00-00-000Z";
    const runRoot = path.join(bundle.publishRoot, "f6-runs", runId);
    const result = runF6FullValidation({}, {
      parseArgs: () => ({ ...bundle, interactionLanguage, modelInterpretationArtifact: path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact) }),
      resolveLayout: () => ({ artifactSetVersion: "f6-artifact-set-v3", runId, runRoot, publishRoot: bundle.publishRoot, optimizationJsonName: "Feature6-Optimization.json", finalReportMdName: "Feature6-Report.md", finalReportPdfName: "Feature6-Report.pdf", runSummaryJsonName: "Feature6-Run-Summary.json", manifestName: "manifest.json" }),
      createOptimization: createF6OptimizationV4,
      createFinalReport: () => createV4FinalReportStub(),
      renderFinalReportPdf: () => PDF,
    });

    expect(result.status).toBe("completed");
    const optimization = readJson(path.join(runRoot, "Feature6-Optimization.json"));
    const manifest = readJson(path.join(runRoot, "manifest.json"));
    expect(optimization.optimizationVersion).toBe("f6-optimization-v4");
    expect(optimization.sequentialPolicyId).toBe("f6-sequential-optimization-policy-v2");
    expect(manifest.artifactSetVersion).toBe("f6-artifact-set-v3");
    expect(validateExistingF6(runRoot, { publishRoot: bundle.publishRoot })).toMatchObject({ status: "accepted" });
  });

  it("rejects v4 selected-result tampering even when optimization hash is recomputed", () => {
    const bundle = createF6ArtifactBundleFixture();
    installRequiredMultimodalV3(bundle);
    cleanup.push(bundle.root);
    const runId = "2026-09-14T09-05-00-000Z";
    const runRoot = path.join(bundle.publishRoot, "f6-runs", runId);
    const result = runF6FullValidation({}, {
      parseArgs: () => ({ ...bundle, interactionLanguage, modelInterpretationArtifact: path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact) }),
      resolveLayout: () => ({ artifactSetVersion: "f6-artifact-set-v3", runId, runRoot, publishRoot: bundle.publishRoot, optimizationJsonName: "Feature6-Optimization.json", finalReportMdName: "Feature6-Report.md", finalReportPdfName: "Feature6-Report.pdf", runSummaryJsonName: "Feature6-Run-Summary.json", manifestName: "manifest.json" }),
      createOptimization: createF6OptimizationV4,
      createFinalReport: () => createV4FinalReportStub(),
      renderFinalReportPdf: () => PDF,
    });
    expect(result.status).toBe("completed");

    const optimizationPath = path.join(runRoot, "Feature6-Optimization.json");
    const optimization = readJson(optimizationPath);
    optimization.worksheets[0].selectedResult.snapshot.scenarioId = "tampered:selected-result";
    writeJson(optimizationPath, optimization);
    recomputeOptimizationHash(runRoot);

    expect(validateExistingF6(runRoot, { publishRoot: bundle.publishRoot })).toEqual({
      status: "rejected",
      reasonCode: "artifact_validation_failed",
    });
  });

  it("rejects v4 met-status mismatches and step3 pending from FAIL even when optimization hash is recomputed", () => {
    const bundle = createF6ArtifactBundleFixture();
    installRequiredMultimodalV3(bundle);
    cleanup.push(bundle.root);
    const runId = "2026-09-14T09-06-00-000Z";
    const runRoot = path.join(bundle.publishRoot, "f6-runs", runId);
    const result = runF6FullValidation({}, {
      parseArgs: () => ({ ...bundle, interactionLanguage, modelInterpretationArtifact: path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact) }),
      resolveLayout: () => ({ artifactSetVersion: "f6-artifact-set-v3", runId, runRoot, publishRoot: bundle.publishRoot, optimizationJsonName: "Feature6-Optimization.json", finalReportMdName: "Feature6-Report.md", finalReportPdfName: "Feature6-Report.pdf", runSummaryJsonName: "Feature6-Run-Summary.json", manifestName: "manifest.json" }),
      createOptimization: createF6OptimizationV4,
      createFinalReport: () => createV4FinalReportStub(),
      renderFinalReportPdf: () => PDF,
    });
    expect(result.status).toBe("completed");

    const optimizationPath = path.join(runRoot, "Feature6-Optimization.json");
    const optimization = readJson(optimizationPath);
    const worksheet = optimization.worksheets[0];

    worksheet.baselineResult.capability.status = "FAIL";
    worksheet.steps[0] = {
      step: "meanResponseCentering",
      status: "COMPLETED_TARGET_MET",
      result: {
        ...worksheet.baselineResult,
        scenarioId: `${worksheet.baselineResult.scenarioId}:step1`,
        sourceStep: "meanResponseCentering",
        inputScenarioId: worksheet.baselineResult.scenarioId,
        capability: { ...worksheet.baselineResult.capability, status: "FAIL" },
      },
    };
    worksheet.steps[1] = {
      step: "toleranceReverseSolve",
      status: "NOT_RUN_EARLIER_STEP_MET_TARGET",
    };
    worksheet.steps[2] = {
      step: "specificationRelaxation",
      status: "NOT_RUN_EARLIER_STEP_MET_TARGET",
    };
    worksheet.selectedResult = {
      status: "step1_centered",
      snapshot: worksheet.steps[0].result,
    };
    optimization.summary = {
      ...optimization.summary,
      baselineMeetsTargetWorksheetCount: 0,
      optimizedWorksheetCount: 1,
      noValidatedResultWorksheetCount: 0,
      clarificationRequiredWorksheetCount: 0,
    };
    writeJson(optimizationPath, optimization);
    syncSummaryCounts(runRoot, optimization);
    recomputeOptimizationHash(runRoot);
    expect(validateExistingF6(runRoot, { publishRoot: bundle.publishRoot })).toEqual({
      status: "rejected",
      reasonCode: "artifact_validation_failed",
    });

    worksheet.steps[0] = {
      step: "meanResponseCentering",
      status: "COMPLETED_TARGET_NOT_MET",
      result: {
        ...worksheet.steps[0].result,
        capability: { ...worksheet.steps[0].result.capability, status: "PASS" },
      },
    };
    worksheet.steps[1] = {
      step: "toleranceReverseSolve",
      status: "COMPLETED_TARGET_NOT_MET",
      result: {
        ...worksheet.steps[0].result,
        scenarioId: `${worksheet.steps[0].result.scenarioId}:step2`,
        sourceStep: "toleranceReverseSolve",
        inputScenarioId: worksheet.steps[0].result.scenarioId,
        capability: { ...worksheet.steps[0].result.capability, status: "FAIL" },
      },
    };
    worksheet.steps[2] = {
      step: "specificationRelaxation",
      status: "NOT_RUN_EARLIER_STEP_MET_TARGET",
    };
    worksheet.selectedResult = {
      status: "step2_tolerance_optimized",
      snapshot: worksheet.steps[1].result,
    };
    writeJson(optimizationPath, optimization);
    syncSummaryCounts(runRoot, optimization);
    recomputeOptimizationHash(runRoot);
    expect(validateExistingF6(runRoot, { publishRoot: bundle.publishRoot })).toEqual({
      status: "rejected",
      reasonCode: "artifact_validation_failed",
    });

    worksheet.steps[2] = {
      step: "specificationRelaxation",
      status: "COMPLETED_TARGET_NOT_MET",
      changeClass: "requirement_change",
      approvalRequired: true,
      capabilityImprovementClaim: false,
      result: {
        ...worksheet.steps[1].result,
        scenarioId: `${worksheet.steps[1].result.scenarioId}:step3`,
        sourceStep: "specificationRelaxation",
        inputScenarioId: worksheet.steps[1].result.scenarioId,
        capability: { ...worksheet.steps[1].result.capability, status: "FAIL" },
      },
    };
    worksheet.selectedResult = {
      status: "step3_specification_relaxed_pending_approval",
      snapshot: worksheet.steps[2].result,
    };
    optimization.summary = {
      ...optimization.summary,
      baselineMeetsTargetWorksheetCount: 0,
      optimizedWorksheetCount: 1,
      noValidatedResultWorksheetCount: 0,
      clarificationRequiredWorksheetCount: 0,
    };
    writeJson(optimizationPath, optimization);
    syncSummaryCounts(runRoot, optimization);
    recomputeOptimizationHash(runRoot);
    expect(validateExistingF6(runRoot, { publishRoot: bundle.publishRoot })).toEqual({
      status: "rejected",
      reasonCode: "artifact_validation_failed",
    });
  });

  it("reads an untouched historical v2 bundle without requiring model interpretation or rewriting files", () => {
    const bundle = createF6ArtifactBundleFixture();
    installRequiredMultimodalV3(bundle);
    cleanup.push(bundle.root);
    const runId = "2026-08-24T05-00-00-000Z";
    const runRoot = path.join(bundle.publishRoot, "f6-runs", runId);
    const result = runF6FullValidation({}, {
      parseArgs: () => ({
        ...bundle,
        interactionLanguage,
        modelInterpretationArtifact: path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact),
      }),
      resolveLayout: () => ({ artifactSetVersion: "f6-artifact-set-v3", runId, runRoot, publishRoot: bundle.publishRoot, optimizationJsonName: "Feature6-Optimization.json", finalReportMdName: "Feature6-Report.md", finalReportPdfName: "Feature6-Report.pdf", runSummaryJsonName: "Feature6-Run-Summary.json", manifestName: "manifest.json" }),
      createOptimization: createF6OptimizationV4,
      createFinalReport: () => createV4FinalReportStub(),
      renderFinalReportPdf: () => PDF,
    });
    expect(result.status).toBe("completed");
    rewriteAsHistoricalV2(runRoot);
    const before = readFileSync(path.join(runRoot, "Feature6-Optimization.json"));

    expect(validateExistingF6(runRoot, { publishRoot: bundle.publishRoot })).toMatchObject({ status: "accepted" });
    expect(readFileSync(path.join(runRoot, "Feature6-Optimization.json"))).toEqual(before);
  });

  it("accepts a valid published F6 run without parsing Markdown disposition", () => {
    const bundle = createF6ArtifactBundleFixture();
    installRequiredMultimodalV3(bundle);
    cleanup.push(bundle.root);
    const runId = "2026-08-24T06-00-00-000Z";
    const runRoot = path.join(bundle.publishRoot, "f6-runs", runId);
    const result = runF6FullValidation({}, {
      parseArgs: () => ({ ...bundle, interactionLanguage, modelInterpretationArtifact: path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact) }),
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
      createOptimization: createF6OptimizationV4,
      createFinalReport: () => createV4FinalReportStub(),
      renderFinalReportPdf: () => PDF,
    });

    expect(result.status).toBe("completed");
    expect(validateExistingF6(runRoot, { publishRoot: bundle.publishRoot })).toMatchObject({
      status: "accepted",
      outputDirectory: runRoot,
      finalReportMarkdownPath: path.join(runRoot, "Feature6-Report.md"),
      finalReportPdfPath: path.join(runRoot, "Feature6-Report.pdf"),
    });
  });

  it("accepts a published F6 run with an authorized model interpretation source", () => {
    const bundle = createF6ArtifactBundleFixture();
    installRequiredMultimodalV3(bundle);
    cleanup.push(bundle.root);
    const runId = "2026-09-04T12-30-00-000Z";
    const runRoot = path.join(bundle.publishRoot, "f6-runs", runId);
    const result = runF6FullValidation({}, {
      parseArgs: () => ({ ...bundle, interactionLanguage, modelInterpretationArtifact: path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact) }),
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
      createOptimization: createF6OptimizationV4,
      createFinalReport: () => createV4FinalReportStub(),
      renderFinalReportPdf: () => PDF,
    });

    expect(result.status).toBe("completed");
    expect(validateExistingF6(runRoot, { publishRoot: bundle.publishRoot })).toMatchObject({
      status: "accepted",
      outputDirectory: runRoot,
    });
  });

  it("rejects an unproven extra imageObservation source on current v4 run summaries", () => {
    const bundle = createF6ArtifactBundleFixture();
    installRequiredMultimodalV3(bundle);
    cleanup.push(bundle.root);
    const runId = "2026-09-04T12-45-00-000Z";
    const runRoot = path.join(bundle.publishRoot, "f6-runs", runId);
    const result = runF6FullValidation({}, {
      parseArgs: () => ({ ...bundle, interactionLanguage, modelInterpretationArtifact: path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact) }),
      resolveLayout: () => ({ artifactSetVersion: "f6-artifact-set-v3", runId, runRoot, publishRoot: bundle.publishRoot, optimizationJsonName: "Feature6-Optimization.json", finalReportMdName: "Feature6-Report.md", finalReportPdfName: "Feature6-Report.pdf", runSummaryJsonName: "Feature6-Run-Summary.json", manifestName: "manifest.json" }),
      createOptimization: createF6OptimizationV4,
      createFinalReport: () => createV4FinalReportStub(),
      renderFinalReportPdf: () => PDF,
    });

    expect(result.status).toBe("completed");
    const summaryPath = path.join(runRoot, "Feature6-Run-Summary.json");
    const summary = readJson(summaryPath);
    summary.sources.imageObservation = {
      artifact: "Feature5-Image-Observations.json",
      contentHash: "b".repeat(64),
    };
    writeJson(summaryPath, summary);
    expect(validateExistingF6(runRoot, { publishRoot: bundle.publishRoot })).toMatchObject({ status: "rejected", reasonCode: "run_summary_invalid" });
  });
});