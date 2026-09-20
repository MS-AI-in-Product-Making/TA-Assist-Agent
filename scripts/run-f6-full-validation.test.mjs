import { readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createF6ArtifactBundleFixture, installRequiredMultimodalV3 } from "./f6-artifact-test-fixture.mjs";
import { runF6FullValidation } from "./run-f6-full-validation.mjs";

const cleanup = [];
const INTERACTION_LANGUAGE = { languageTag: "en-US", uiCatalogLanguage: "en", lockedAtTurnId: "f6-cli", source: "workflow_start", fallbackUsed: false };
const REQUEST_CONTEXT = { requestedAt: "2026-09-16T08:30:12.000Z", utcOffsetMinutes: -420, source: "cli" };
const WORKBOOK_HASH = "a".repeat(64);

afterEach(() => {
  for (const target of cleanup.splice(0)) rmSync(target, { recursive: true, force: true });
});

function layoutFor(bundle, runId = "2026-08-24T07-00-00-000Z") {
  return {
    artifactSetVersion: "f6-artifact-set-v3",
    runId,
    runRoot: path.join(bundle.publishRoot, "f6-runs", runId),
    publishRoot: bundle.publishRoot,
    optimizationJsonName: "Feature6-Optimization.json",
    optimizationMdName: "Feature6-Optimization.md",
    finalReportMdName: "Feature6-Report.md",
    finalReportPdfName: "Feature6-Report.pdf",
    runSummaryJsonName: "Feature6-Run-Summary.json",
    manifestName: "manifest.json",
  };
}

function artifactReference(artifact) {
  return { artifact, contentHash: WORKBOOK_HASH };
}

function optimizationV4() {
  const baselineIdentity = {
    calculationVersion: "excel-ta-v1",
    projectReference: "project-a",
    runReference: "run-a",
    workbookContentHash: WORKBOOK_HASH,
    worksheetName: "Analysis-A",
    tableId: "table-1",
  };
  const factor = { worksheetName: "Analysis-A", tableId: "table-1", sourceRow: 14, factorName: "Factor A", unit: "mm" };
  const f4Reference = artifactReference("Feature4-Calculation.json");
  const baselineSnapshot = {
    scenarioId: "baseline",
    sourceStep: "baseline",
    inputScenarioId: null,
    calculationVersion: "excel-ta-v1",
    calculationReference: f4Reference,
    baselineIdentity,
    system: {
      designNominal: 0,
      mean: 0,
      specificationMidpoint: 0,
      meanOffset: 0,
      additionalMeanShift: 0,
      rssSigma: 0.1,
      worstCaseLower: -0.3,
      worstCaseUpper: 0.3,
    },
    capability: {
      lowerSpecLimit: -0.3,
      upperSpecLimit: 0.3,
      targetCpk: 1,
      lowerCpk: 1,
      upperCpk: 1,
      cpk: 1,
      yield: 0.99,
      totalDpm: 10000,
      status: "PASS",
    },
    factors: [{ factor, nominalValue: 0, lowerTolerance: -0.1, upperTolerance: 0.1, mean: 0, sigma: 0.1, contribution: 0.7 }],
    factorOverrides: [],
    formulaReferences: [],
  };
  const failedSensitivity = (optionCode, reductionRatios) => ({
    optionCode,
    status: "calculation_failed",
    reductionRatios,
    reductions: reductionRatios.map((reductionRatio, index) => ({ factor, rank: index + 1, reductionRatio, scale: 1 - reductionRatio, baselineLowerTolerance: -0.1, baselineUpperTolerance: 0.1 })),
    reasonCode: "f4_failed",
    baselineMetrics: { mean: 0, rssSigma: 0.1, worstCaseLower: -0.3, worstCaseUpper: 0.3, cp: 1, cpk: 1, yield: 0.99, dpm: 10000 },
    calculationReference: f4Reference,
  });
  return {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F6",
    optimizationVersion: "f6-optimization-v4",
    sequentialPolicyId: "f6-sequential-optimization-policy-v2",
    interactionLanguage: INTERACTION_LANGUAGE,
    runStatus: "COMPLETED",
    workbook: { fileName: "Anonymous.xlsx", contentHash: WORKBOOK_HASH },
    worksheets: [{
      worksheetName: "Analysis-A",
      tableId: "table-1",
      runStatus: "COMPLETED",
      baselineIdentity,
      baselineResult: baselineSnapshot,
      trigger: { lowerCpk: 1, upperCpk: 1, targetCpk: 1, failedSides: [] },
      steps: [
        { step: "meanResponseCentering", status: "NOT_NEEDED" },
        { step: "toleranceReverseSolve", status: "NOT_NEEDED" },
        { step: "specificationRelaxation", status: "NOT_NEEDED" },
      ],
      selectedResult: { status: "baseline_meets_target", snapshot: baselineSnapshot },
      sensitivityScenarios: [failedSensitivity("OP1", [0.25, 0.1, 0.1]), failedSensitivity("OP2", [0.2, 0.15, 0.15]), failedSensitivity("OP3", [0.4, 0.05, 0.05])],
    }],
    summary: {
      worksheetCount: 1,
      baselineMeetsTargetWorksheetCount: 1,
      optimizedWorksheetCount: 0,
      noValidatedResultWorksheetCount: 0,
      clarificationRequiredWorksheetCount: 0,
    },
    provenance: {
      f2Reference: artifactReference("Feature2-Report.json"),
      f3Reference: artifactReference("Feature3-Report.json"),
      f4Reference,
      f5Reference: artifactReference("Feature5-Report.json"),
      multimodalReference: artifactReference("Feature5-Multimodal.json"),
      reportScope: { worksheetNames: ["Analysis-A"], blockedWorksheetNames: [] },
    },
  };
}

function reportProjection() {
  return {
    markdown: "# F6 report\n",
    reportSummary: {
      workbookDisposition: "PASS",
      worksheetDispositions: [{ worksheetName: "Analysis-A", disposition: "PASS" }],
    },
    projection: {
      schemaVersion: "ta-engineering-report-projection-v1",
      title: "F6 report",
      workbookDisposition: "PASS",
      worksheetDispositions: [{ worksheetName: "Analysis-A", disposition: "PASS" }],
      workbook: { fileName: "Anonymous.xlsx", contentHash: WORKBOOK_HASH },
      worksheets: [{
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "Loop Analysis-A",
        disposition: "PASS",
        requiredAction: "Review governed output.",
        findings: ["Report projection fixture."],
        assumptions: [],
        clarifications: [],
        gatingEvidenceReferences: ["Feature4-Calculation.json"],
      }],
    },
  };
}

describe("runF6FullValidation", () => {
  it("derives the default v4 report names from the governed F2 workbook identity", () => {
    const bundle = createF6ArtifactBundleFixture();
    installRequiredMultimodalV3(bundle);
    cleanup.push(bundle.root);
    const previousOutputRoot = process.env.AI_TVA_F6_OUTPUT_ROOT;
    const previousPublishRoot = process.env.AI_TVA_F6_PUBLISH_ROOT;
    process.env.AI_TVA_F6_OUTPUT_ROOT = path.join(bundle.publishRoot, "f6-runs", "default-layout");
    process.env.AI_TVA_F6_PUBLISH_ROOT = bundle.publishRoot;
    try {
      const result = runF6FullValidation({ now: () => new Date("2026-09-18T12:00:00.000Z") }, {
        parseArgs: () => ({
          ...bundle,
          interactionLanguage: INTERACTION_LANGUAGE,
          analysisRequestContext: REQUEST_CONTEXT,
          modelInterpretationArtifact: path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact),
        }),
        createOptimization: optimizationV4,
        createFinalReport: reportProjection,
        renderFinalReportPdf: () => Buffer.from("%PDF-1.7\nvalidated report\n"),
      });

      expect(result.status).toBe("completed");
      expect(path.basename(result.finalReportMdPath)).toBe("Anonymous - TA ENGINEERING ANALYSIS REPORT.md");
      expect(path.basename(result.finalReportPdfPath)).toBe("Anonymous - TA ENGINEERING ANALYSIS REPORT.pdf");
    } finally {
      if (previousOutputRoot === undefined) delete process.env.AI_TVA_F6_OUTPUT_ROOT;
      else process.env.AI_TVA_F6_OUTPUT_ROOT = previousOutputRoot;
      if (previousPublishRoot === undefined) delete process.env.AI_TVA_F6_PUBLISH_ROOT;
      else process.env.AI_TVA_F6_PUBLISH_ROOT = previousPublishRoot;
    }
  });

  it("uses one resolved output layout for bundle loading and runner output", () => {
    const bundle = createF6ArtifactBundleFixture();
    cleanup.push(bundle.root);
    const layout = layoutFor(bundle);
    const resolveLayout = vi.fn(() => layout);
    const loadBundle = vi.fn((request) => ({
      status: "rejected",
      reasonCode: request.publishRoot === layout.publishRoot ? "test_rejection" : "wrong_publish_root",
    }));

    const result = runF6FullValidation({}, {
      parseArgs: () => ({ ...bundle }),
      resolveLayout,
      loadBundle,
    });

    expect(result).toMatchObject({ status: "failed", reasonCode: "input_rejected" });
    expect(resolveLayout).toHaveBeenCalledTimes(1);
    expect(loadBundle).toHaveBeenCalledWith(expect.objectContaining({ publishRoot: layout.publishRoot }));
  });

  it("loads model interpretation from an independent governed root", () => {
    const bundle = createF6ArtifactBundleFixture();
    cleanup.push(bundle.root);
    const layout = layoutFor(bundle);
    const contextPath = path.join(bundle.root, "shared-evidence", "context.json");
    const modelPath = path.join(bundle.root, "model-evidence", "run-id", "Feature6-Model-Interpretation.json");
    const loadBundle = vi.fn(() => ({ status: "rejected", reasonCode: "test_rejection" }));

    runF6FullValidation({}, {
      parseArgs: () => ({
        ...bundle,
        interactionLanguage: INTERACTION_LANGUAGE,
        analysisRequestContext: REQUEST_CONTEXT,
        expectedModelInterpretationContentHash: "a".repeat(64),
        analysisContextArtifact: contextPath,
        modelInterpretationArtifact: modelPath,
      }),
      resolveLayout: () => layout,
      loadBundle,
    });

    expect(loadBundle).toHaveBeenCalledWith(expect.objectContaining({
      evidenceArtifactRoot: path.dirname(contextPath),
      analysisContextArtifact: path.basename(contextPath),
      modelInterpretationArtifactRoot: path.dirname(modelPath),
      modelInterpretationArtifact: path.basename(modelPath),
    }));
  });

  it("forwards versioned context and target artifacts without changing governed path normalization", () => {
    const bundle = createF6ArtifactBundleFixture();
    cleanup.push(bundle.root);
    const layout = layoutFor(bundle);
    const contextPath = path.join(bundle.root, "shared-evidence", "f6-analysis-context-v2.json");
    const targetsPath = path.join(bundle.root, "shared-evidence", "f6-optimization-targets-v2.json");
    const modelPath = path.join(bundle.root, "model-evidence", "run-id", "Feature6-Model-Interpretation.json");
    const loadBundle = vi.fn(() => ({ status: "rejected", reasonCode: "test_rejection" }));

    runF6FullValidation({}, {
      parseArgs: () => ({
        ...bundle,
        interactionLanguage: INTERACTION_LANGUAGE,
        analysisRequestContext: REQUEST_CONTEXT,
        expectedModelInterpretationContentHash: "a".repeat(64),
        analysisContextArtifact: contextPath,
        optimizationTargetsArtifact: targetsPath,
        modelInterpretationArtifact: modelPath,
      }),
      resolveLayout: () => layout,
      loadBundle,
    });

    expect(loadBundle).toHaveBeenCalledWith(expect.objectContaining({
      evidenceArtifactRoot: path.dirname(contextPath),
      analysisContextArtifact: path.basename(contextPath),
      optimizationTargetsArtifact: path.basename(targetsPath),
      modelInterpretationArtifactRoot: path.dirname(modelPath),
      modelInterpretationArtifact: path.basename(modelPath),
    }));
  });

  it("does not rewrite a failure manifest produced by the governed runner", () => {
    const bundle = createF6ArtifactBundleFixture();
    installRequiredMultimodalV3(bundle);
    cleanup.push(bundle.root);
    const layout = layoutFor(bundle);
    const result = runF6FullValidation({}, {
      parseArgs: () => ({
        ...bundle,
        interactionLanguage: INTERACTION_LANGUAGE,
        analysisRequestContext: REQUEST_CONTEXT,
        modelInterpretationArtifact: path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact),
      }),
      resolveLayout: () => layout,
      createOptimization: optimizationV4,
      createFinalReport: reportProjection,
      renderFinalReportPdf: () => {
        throw Object.assign(new Error("confidential browser output"), {
          code: "pdf_render_unavailable",
          attempts: [
            { browser: "msedge.exe", reason: "execution_failed" },
            { browser: "chrome.exe", reason: "invalid_pdf" },
          ],
        });
      },
    });

    const failureDetail = {
      code: "pdf_render_unavailable",
      attempts: [
        { browser: "msedge.exe", reason: "execution_failed" },
        { browser: "chrome.exe", reason: "invalid_pdf" },
      ],
    };
    expect(result).toMatchObject({ status: "failed", reasonCode: "report_failed", failureDetail });
    const manifest = JSON.parse(readFileSync(path.join(layout.runRoot, "manifest.json"), "utf8"));
    expect(manifest).toMatchObject({ status: "failed", reasonCode: "report_failed", failureDetail });
    expect(JSON.stringify(result)).not.toContain("confidential browser output");
    expect(JSON.stringify(manifest)).not.toContain("confidential browser output");
  });

  it("distinguishes report projection failures without exposing internal content", () => {
    const bundle = createF6ArtifactBundleFixture();
    installRequiredMultimodalV3(bundle);
    cleanup.push(bundle.root);
    const layout = layoutFor(bundle);
    const result = runF6FullValidation({}, {
      parseArgs: () => ({
        ...bundle,
        interactionLanguage: INTERACTION_LANGUAGE,
        analysisRequestContext: REQUEST_CONTEXT,
        modelInterpretationArtifact: path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact),
      }),
      resolveLayout: () => layout,
      createOptimization: optimizationV4,
      createFinalReport: () => {
        throw new Error("confidential report content");
      },
    });

    expect(result).toMatchObject({
      status: "failed",
      reasonCode: "report_failed",
      failureDetail: { code: "report_projection_failed" },
    });
    const manifest = JSON.parse(readFileSync(path.join(layout.runRoot, "manifest.json"), "utf8"));
    expect(manifest).toMatchObject({ failureDetail: { code: "report_projection_failed" } });
    expect(JSON.stringify(result)).not.toContain("confidential report content");
  });

  it("forwards request context to the loader without rewriting requestedAt", () => {
    const bundle = createF6ArtifactBundleFixture();
    cleanup.push(bundle.root);
    const layout = layoutFor(bundle);
    const loadBundle = vi.fn(() => ({ status: "rejected", reasonCode: "test_rejection" }));

    runF6FullValidation({}, {
      parseArgs: () => ({
        ...bundle,
        interactionLanguage: INTERACTION_LANGUAGE,
        analysisRequestContext: REQUEST_CONTEXT,
        expectedModelInterpretationContentHash: "a".repeat(64),
        modelInterpretationArtifact: path.join(bundle.root, "model-evidence", "run-id", "Feature6-Model-Interpretation.json"),
      }),
      resolveLayout: () => layout,
      loadBundle,
    });

    expect(loadBundle).toHaveBeenCalledWith(expect.objectContaining({ analysisRequestContext: REQUEST_CONTEXT }));
  });
});