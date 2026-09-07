/* global structuredClone */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  drawingGovernanceResultV2Schema,
  f2UserReportSchema,
  f4WorkflowCalculationResultSchema,
  f5DataInterpretationResultSchema,
  f6ModelInterpretationArtifactSchema,
  f6OptimizationResultSchema,
} from "../packages/contracts/dist/contracts.js";
import {
  createF5MultimodalFactorSetHash,
  createF5MultimodalRequestHash,
} from "../packages/contracts/dist/ta-multimodal-contracts.js";
import { formatEngineering, formatPercent } from "./engineering-format.mjs";
import { createF5DataInterpretation } from "../packages/workbook-catalog/dist/f5-data-interpretation.js";
import { createF6ReportProjection } from "../packages/workbook-catalog/dist/index.js";
import {
  createF6ArtifactBundleFixture,
  createF6V2ObservationArtifact,
  F6_FIXTURE_WORKBOOK_HASH,
  installF6ModelInterpretation,
  installRequiredMultimodalV3,
} from "./f6-artifact-test-fixture.mjs";
import { createF6FinalReportProjection, worstDisposition } from "./f6-final-report.mjs";
import { runF6FullValidation } from "./run-f6-full-validation.mjs";

const deprecatedF6ReportArtifactName = ["Feature6", "Composed", "Report"].join("-");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function row(values) {
  return `| ${values.join(" | ")} |`;
}

function createMultimodalV3(inputs) {
  const f2Worksheet = inputs.f2Report.worksheets[0];
  const f2Row = f2Worksheet.rows[0];
  const calculation = inputs.f4Report.calculations[0];
  const factor = calculation.factors[0];
  const image = inputs.f5Report.worksheets[0].imageReference;
  const factorRows = [{
    worksheetName: f2Worksheet.worksheetName,
    tableId: f2Row.tableId,
    sourceRow: f2Row.sourceRow,
    factorOrdinal: structuredClone(f2Row.factorOrdinal),
    factorName: factor.factorName,
    partName: f2Row.actualFields.partName,
    partCategory: f2Row.actualFields.partCategory,
    drawingNumber: f2Row.actualFields.drawingNumber,
    dimId: f2Row.actualFields.dimCharacteristicId,
    nominal: factor.input.nominalValue,
    upperTolerance: factor.input.upperTolerance,
    lowerTolerance: factor.input.lowerTolerance,
    longTermSafetyFactor: factor.input.longTermSafetyFactor,
    sigmaLevel: factor.input.sigmaLevel,
    distribution: factor.input.distribution,
    sourceCells: structuredClone(f2Row.sourceCells),
  }];
  const request = {
    contractVersion: "f5-multimodal-request-v3",
    inputClassification: "confidential",
    requestHash: "",
    sessionId: "11111111-1111-4111-8111-111111111111",
    revision: 7,
    inputRevision: 3,
    workbook: {
      fileName: inputs.f2Report.workbook.fileName,
      contentHash: inputs.f2Report.workbook.contentHash,
    },
    worksheetName: f2Worksheet.worksheetName,
    tableId: f2Row.tableId,
    activeFactorCount: factorRows.length,
    factorSetHash: createF5MultimodalFactorSetHash(factorRows),
    image: { mediaType: "image/png", contentHash: image.contentHash, byteLength: 100, artifactPath: image.relativePath },
    factorRows,
  };
  request.requestHash = createF5MultimodalRequestHash(request);
  return {
    contractVersion: "f5-multimodal-artifact-v3",
    outputClassification: "confidential",
    sessionId: request.sessionId,
    revision: request.revision,
    inputRevision: request.inputRevision,
    workbookContentHash: request.workbook.contentHash,
    selectedWorksheetNames: [request.worksheetName],
    worksheets: [{
      request,
      result: {
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
        model: { modelId: "vision-model", supportsImage: true },
        imageTableInterpretation: "Image and complete Factor table jointly support the tolerance path interpretation.",
        rowMappings: factorRows.map((factorRow) => ({
          worksheetName: factorRow.worksheetName,
          tableId: factorRow.tableId,
          sourceRow: factorRow.sourceRow,
          factorOrdinal: structuredClone(factorRow.factorOrdinal),
          mappingStatus: "matched",
          visibleStatus: "visible",
          interpretation: "Factor A is visible and mapped to the table row.",
        })),
      },
    }],
  };
}

function numberText(value, fallback = "N/A") {
  if (!Number.isFinite(value)) return fallback;
  return Number(value.toFixed(6)).toString();
}

function engineeringText(value, unit, fallback = "N/A") {
  if (!Number.isFinite(value)) return fallback;
  return formatEngineering(value, unit, 6).replace(/\.0+(?=\s)/, "");
}

function percentText(value, fallback = "N/A") {
  if (!Number.isFinite(value)) return fallback;
  return formatPercent((Math.abs(value) <= 1 ? value * 100 : value), 1);
}

function buildSupportedF5Report(bundle) {
  const f3Report = drawingGovernanceResultV2Schema.parse(readJson(bundle.paths.f3));
  const f4Report = f4WorkflowCalculationResultSchema.parse(readJson(bundle.paths.f4));

  const confirmedBy = "controlled-reviewer";
  const confirmedAt = "2026-08-20T00:00:00.000Z";
  const scopes = [
    "tolerance_loop_closure",
    "datum_chain",
    "assembly_datum_face",
    "stack_start",
    "direction",
    "cross_subsystem",
    "non_geometric_variable",
    "long_dimension_chain",
  ];

  return f5DataInterpretationResultSchema.parse(createF5DataInterpretation({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: F6_FIXTURE_WORKBOOK_HASH },
    knowledgeBaseVersion: "interpretation-rules-v1",
    worksheets: f3Report.worksheets.map((worksheet) => {
      const calculationResult = f4Report.calculations.find((calculation) => calculation.worksheetSelection.worksheetName === worksheet.worksheetName);
      if (calculationResult === undefined) throw new Error("expected fixture F4 calculation");

      return {
        worksheetName: worksheet.worksheetName,
        imageReference: worksheet.rows[0].imageReference,
        governanceRows: worksheet.rows,
        calculationResult,
        imageObservations: scopes.map((scope) => ({
          scope,
          observedValue: "visible",
          confidence: "high",
          visibleBasis: `Visible basis for ${scope}.`,
          reviewStatus: "confirmed",
          confirmedBy,
          confirmedAt,
        })),
      };
    }),
  }));
}

function buildOpenF5Report(bundle, { directionConflict = false } = {}) {
  const artifact = createF6V2ObservationArtifact(bundle);
  if (directionConflict) {
    const direction = artifact.worksheets[0].observations.find((observation) => observation.scope === "direction");
    const linkedRow = artifact.worksheets[0].contextSnapshot.rows[0];
    direction.visualObservation.observedValue = "visible";
    direction.visualObservation.confidence = "high";
    direction.visualObservation.visibleLabels = ["D"];
    direction.contextualSignal.signalValue = "indicated_conflict";
    direction.contextualSignal.textBasis = "Label D arrow points upward while the linked table factor has a negative nominal sign.";
    direction.contextualSignal.linkedSourceRows = [{ tableId: linkedRow.tableId, sourceRow: linkedRow.sourceRow }];
    direction.contextualSignal.linkedVisualLabels = [{ label: "D", tableId: linkedRow.tableId, sourceRow: linkedRow.sourceRow }];
  }
  return f5DataInterpretationResultSchema.parse(createF5DataInterpretation({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: F6_FIXTURE_WORKBOOK_HASH },
    knowledgeBaseVersion: "interpretation-rules-v1",
    worksheets: artifact.worksheets.map((worksheet, index) => ({
      worksheetName: worksheet.worksheetName,
      imageReference: worksheet.imageReference,
      governanceRows: bundle.f3Worksheets[index].rows,
      calculationResult: bundle.calculations[index],
      observationVersion: artifact.observationVersion,
      contextSnapshot: worksheet.contextSnapshot,
      imageObservations: worksheet.observations,
    })),
  }));
}

function loadRealF6Inputs({ worksheetNames = ["Analysis-A"], blockedWorksheetNames = [], f5Variant = "default", actualFieldOverrides = {}, systemSpecificationOverrides = {}, modelInterpretationVersion } = {}) {
  const bundle = createF6ArtifactBundleFixture({ worksheetNames, blockedWorksheetNames, actualFieldOverrides, systemSpecificationOverrides });
  const modelInterpretation = modelInterpretationVersion === undefined
    ? undefined
    : installF6ModelInterpretation(bundle, { version: modelInterpretationVersion });
  installRequiredMultimodalV3(bundle);
  const runId = `2026-08-20T00-00-00-000Z-${worksheetNames.join("-")}`;
  const runRoot = path.join(bundle.publishRoot, "f6-runs", runId);

  const result = runF6FullValidation({}, {
    parseArgs: () => ({
      ...bundle,
      modelInterpretationArtifact: path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact),
    }),
    resolveLayout: () => ({
      runId,
      runRoot,
      publishRoot: bundle.publishRoot,
      optimizationJsonName: "Feature6-Optimization.json",
      optimizationMdName: "Feature6-Optimization.md",
      finalReportMdName: "Feature6-Report.md",
      runSummaryJsonName: "Feature6-Run-Summary.json",
      manifestName: "manifest.json",
    }),
  });

  expect(result.status, JSON.stringify(result, null, 2)).toBe("completed");

  return {
    generatedAt: "2026-08-20T00:00:00.000Z",
    f2Report: f2UserReportSchema.parse(readJson(bundle.paths.f2)),
    f3Report: drawingGovernanceResultV2Schema.parse(readJson(bundle.paths.f3)),
    f4Report: f4WorkflowCalculationResultSchema.parse(readJson(bundle.paths.f4)),
    f5Report: f5Variant === "supported"
      ? buildSupportedF5Report(bundle)
      : f5Variant === "open" || f5Variant === "open-conflict"
        ? buildOpenF5Report(bundle, { directionConflict: f5Variant === "open-conflict" })
      : f5DataInterpretationResultSchema.parse(readJson(bundle.paths.f5)),
    f6Optimization: f6OptimizationResultSchema.parse(readJson(path.join(runRoot, "Feature6-Optimization.json"))),
    ...(modelInterpretation === undefined ? {} : { modelInterpretation: f6ModelInterpretationArtifactSchema.parse(modelInterpretation.artifact) }),
  };
}

function cloneF3WorksheetWithName(worksheetName, sourceWorksheet) {
  const worksheet = structuredClone(sourceWorksheet);
  worksheet.worksheetName = worksheetName;
  worksheet.rows.forEach((row) => {
    row.imageReference.worksheetName = worksheetName;
  });
  return worksheet;
}

function cloneF4CalculationWithName(worksheetName, sourceCalculation, runReference) {
  const calculation = structuredClone(sourceCalculation);
  calculation.worksheetSelection.worksheetName = worksheetName;
  calculation.runReference = runReference;
  return calculation;
}

function cloneF6OptimizationWorksheetWithName(worksheetName, sourceWorksheet) {
  const worksheet = structuredClone(sourceWorksheet);
  worksheet.worksheetName = worksheetName;
  worksheet.baselineIdentity.worksheetName = worksheetName;
  return worksheet;
}

function recountF3Summary(worksheets) {
  return {
    worksheetCount: worksheets.length,
    factorCount: worksheets.length,
    completeCount: worksheets.length,
    governanceRequiredCount: 0,
    duplicateConflictCount: 0,
  };
}

function recountF6Summary(worksheets) {
  const options = worksheets.flatMap((worksheet) => worksheet.options);
  return {
    worksheetCount: worksheets.length,
    completedWorksheetCount: worksheets.filter((worksheet) => worksheet.runStatus === "COMPLETED").length,
    partiallyCompletedWorksheetCount: worksheets.filter((worksheet) => worksheet.runStatus === "PARTIALLY_COMPLETED").length,
    inputRejectedWorksheetCount: worksheets.filter((worksheet) => worksheet.runStatus === "INPUT_REJECTED").length,
    candidateOptionCount: options.filter((option) => option.status === "candidate").length,
    completedOptionCount: options.filter((option) => option.status === "completed").length,
    insufficientEvidenceOptionCount: options.filter((option) => option.status === "insufficient_evidence").length,
    calculationFailedOptionCount: options.filter((option) => option.status === "calculation_failed").length,
  };
}

function addModelInterpretation(inputs, narrativeForWorksheet) {
  const artifactHash = "9".repeat(64);
  const modelInterpretation = f6ModelInterpretationArtifactSchema.parse({
    contractVersion: "v1",
    inputClassification: "confidential",
    interpretationVersion: "f6-model-interpretation-v1",
    workbookContentHash: inputs.f2Report.workbook.contentHash,
    generatedAt: inputs.generatedAt,
    worksheets: inputs.f6Optimization.worksheets.map((optimizationWorksheet, index) => {
      const calculation = inputs.f4Report.calculations.find(({ worksheetSelection }) => (
        worksheetSelection.worksheetName === optimizationWorksheet.worksheetName
      ));
      if (calculation === undefined) throw new Error("expected fixture F4 calculation");
      const claimId = `cpk-${index + 1}`;
      return {
        worksheetName: optimizationWorksheet.worksheetName,
        tableId: optimizationWorksheet.tableId,
        baselineIdentity: optimizationWorksheet.baselineIdentity,
        sourceReferences: {
          f2: { artifact: "Feature2-Report.json", contentHash: "2".repeat(64) },
          f4: { artifact: "Feature4-Calculation.json", contentHash: "4".repeat(64), runId: inputs.f4Report.runId, calculationVersion: calculation.calculationVersion },
          f5: { artifact: "Feature5-Report.json", contentHash: "5".repeat(64), interpretationVersion: "f5-data-interpretation-v1" },
          image: { artifact: `${optimizationWorksheet.worksheetName}.png`, contentHash: "8".repeat(64), worksheetName: optimizationWorksheet.worksheetName },
        },
        narrativeMarkdown: narrativeForWorksheet(optimizationWorksheet.worksheetName, claimId),
        calculationClaims: [{
          claimId,
          outputField: "capability.cpk",
          rawValue: calculation.capability.cpk,
          displayFormat: "number",
          unit: null,
        }],
        reviewStatus: "ME_REVIEW_REQUIRED",
      };
    }),
  });
  inputs.f6Optimization.provenance.modelInterpretationDecision = {
    outcome: "CALLER_AUTHORIZED",
    artifactReference: { artifact: "Feature6-Model-Interpretation.json", contentHash: artifactHash },
  };
  return { ...inputs, modelInterpretation };
}

describe("createF6FinalReportProjection policy", () => {
  it("keeps blocked F2 worksheets in the report summary and fails the workbook", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      blockedWorksheetNames: ["Blocked-A"],
      f5Variant: "supported",
    });
    const projection = createF6FinalReportProjection(inputs);

    expect(projection.reportSummary.worksheetDispositions.map(({ worksheetName }) => worksheetName)).toEqual([
      "Analysis-A",
      "Blocked-A",
    ]);
    expect(projection.reportSummary.worksheetDispositions.map(({ disposition }) => disposition)).toEqual([
      "PASS",
      "FAIL",
    ]);
    expect(projection.reportSummary.workbookDisposition).toBe("FAIL");
    expect(projection.markdown).toContain("| Analysis-A | Loop Analysis-A | 数值、输入和工程复核均已通过。 | PASS |");
    expect(projection.markdown).toContain("| Blocked-A | Loop Blocked-A | 缺少必填输入、图片或有效计算，当前 worksheet 无法完成分析。 | FAIL |");
  });

  it("maps explicit open F5 evidence to conditional pass", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      f5Variant: "open",
    });
    const projection = createF6FinalReportProjection(inputs);

    expect(projection.reportSummary.workbookDisposition).toBe("CONDITIONAL_PASS");
    expect(projection.reportSummary.worksheetDispositions).toEqual([
      expect.objectContaining({ worksheetName: "Analysis-A", disposition: "CONDITIONAL_PASS" }),
    ]);
    expect(projection.markdown).toContain("| Analysis-A | Loop Analysis-A | 数值达到要求，但仍需补齐 Drawing Number、DIM ID 或完成图像与工程复核。 | CONDITIONAL_PASS |");
  });

  it("renders governed freeform model prose and calculation claims instead of the seven-part template", () => {
    const baseInputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      f5Variant: "open",
    });
    const calculation = baseInputs.f4Report.calculations[0];
    const inputs = addModelInterpretation(baseInputs, (_worksheetName, claimId) => [
      "### 模型生成的自由段落标题",
      "",
      `当前 Predictive Cpk 为 {{calc:${claimId}}}，结论需要 ME 复核。`,
    ].join("\n"));

    const { markdown } = createF6FinalReportProjection(inputs);

    expect(markdown).toContain("# 4. TA 总结性分析");
    expect(markdown).toContain("## 4.1 Worksheet：Analysis-A");
    expect(markdown).toContain("### 模型生成的自由段落标题");
    expect(markdown).toContain(`当前 Predictive Cpk 为 ${numberText(calculation.capability.cpk)}，结论需要 ME 复核。`);
    expect(markdown).not.toContain("### 4.1.1 输出边界");
    expect(markdown).not.toContain("### 4.1.7 初步工程判断");
    expect(markdown).not.toContain("### F5 模型图文联合参考解读");
    expect(markdown).not.toContain("# 4. Appendix: Reference Traceability");
  });

  it("keeps model prose isolated by worksheet", () => {
    const baseInputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A", "Analysis-B"], f5Variant: "supported" });
    const inputs = addModelInterpretation(baseInputs, (worksheetName, claimId) => (
      `### ${worksheetName} 专属判断\n\nCpk {{calc:${claimId}}}，需要 ME 复核。`
    ));

    const { markdown } = createF6FinalReportProjection(inputs);
    const first = markdown.slice(markdown.indexOf("## 4.1 Worksheet：Analysis-A"), markdown.indexOf("## 4.2 Worksheet：Analysis-B"));
    const second = markdown.slice(markdown.indexOf("## 4.2 Worksheet：Analysis-B"));

    expect(first).toContain("Analysis-A 专属判断");
    expect(first).not.toContain("Analysis-B 专属判断");
    expect(second).toContain("Analysis-B 专属判断");
    expect(second).not.toContain("Analysis-A 专属判断");
  });

  it.each(["NOT_PROVIDED", "REJECTED"])("renders model interpretation unavailable for %s", (outcome) => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"] });
    inputs.f6Optimization.provenance.modelInterpretationDecision = outcome === "REJECTED"
      ? { outcome, inputReferenceHash: "7".repeat(64), reasonCode: "schema_invalid" }
      : { outcome };

    const { markdown } = createF6FinalReportProjection(inputs);

    expect(markdown).toContain("# 4. TA 总结性分析");
    expect(markdown).toContain("模型解读 unavailable");
    expect(markdown).toContain("# 1. 文档控制 Document Control");
    expect(markdown).toContain("# 3. Worksheet：Analysis-A");
  });

  it("rejects a new-workflow final report when multimodal v3 is missing", () => {
    expect(() => createF6FinalReportProjection({}, { requireMultimodalV3: true })).toThrow(/multimodal v3/i);
  });

  it("renders image-plus-table context and every Factor mapping from multimodal v3", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], modelInterpretationVersion: "v2" });
    inputs.modelInterpretation = createMultimodalV3(inputs);

    const { markdown } = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });

    expect(markdown).toContain("图片 + Factor Table 模型解读");
    expect(markdown).toContain("Image and complete Factor table jointly support");
    expect(markdown).toContain("| A | 2 | Factor A is visible and mapped to the table row. |");
  });

  it("rejects multimodal v3 whose governed workbook scope drifts", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], modelInterpretationVersion: "v2" });
    inputs.modelInterpretation = createMultimodalV3(inputs);
    const pair = inputs.modelInterpretation.worksheets[0];
    inputs.modelInterpretation.workbookContentHash = "f".repeat(64);
    pair.request.workbook.contentHash = inputs.modelInterpretation.workbookContentHash;
    pair.request.requestHash = createF5MultimodalRequestHash(pair.request);
    pair.result.requestHash = pair.request.requestHash;
    pair.result.workbookContentHash = inputs.modelInterpretation.workbookContentHash;

    expect(() => createF6FinalReportProjection(inputs, { requireMultimodalV3: true })).toThrow(/multimodal v3 scope/i);
  });

  it("rejects schema-valid multimodal v3 Factor identity drift", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], modelInterpretationVersion: "v2" });
    inputs.modelInterpretation = createMultimodalV3(inputs);
    const pair = inputs.modelInterpretation.worksheets[0];
    pair.request.factorRows[0].factorName = "Drifted Factor";
    pair.request.factorSetHash = createF5MultimodalFactorSetHash(pair.request.factorRows);
    pair.request.requestHash = createF5MultimodalRequestHash(pair.request);
    pair.result.requestHash = pair.request.requestHash;

    expect(() => createF6FinalReportProjection(inputs, { requireMultimodalV3: true })).toThrow(/multimodal v3 Factor authority/i);
  });

  it("renders model interpretation unavailable for a blocked worksheet", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], blockedWorksheetNames: ["Blocked-A"] });

    const { markdown } = createF6FinalReportProjection(inputs);
    const blocked = markdown.slice(markdown.indexOf("## 4.2 Worksheet：Blocked-A"));

    expect(blocked).toContain("模型解读 unavailable");
  });

  it("renders structured recommendation basis for v2 model assessments without trusting model numeric prose", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      modelInterpretationVersion: "v2",
    });
    inputs.f6Optimization.worksheets[0].clarifications.push({
      clarificationId: "Analysis-A:system-specification-target",
      reasonCode: "system_specification_target_required",
      requiredInputs: ["system_specification_target"],
      questionForReviewer: "Provide governed system specification target before approving requirement changes.",
      evidenceReferences: [structuredClone(inputs.f6Optimization.provenance.f4Reference)],
    });
    inputs.modelInterpretation.worksheets[0].optimizationAssessment = [
      {
        adjustmentClass: "factor_nominal",
        factor: structuredClone(inputs.modelInterpretation.worksheets[0].optimizationAssessment.find((item) => item.adjustmentClass === "factor_nominal").factor),
        disposition: "CONSIDER",
        priority: 1,
        rationale: "Use governed centering target only; do not trust freeform numbers.",
        evidenceReferences: structuredClone(inputs.modelInterpretation.worksheets[0].optimizationAssessment[0].evidenceReferences),
      },
      {
        adjustmentClass: "system_mean_shift",
        disposition: "INSUFFICIENT_EVIDENCE",
        priority: 2,
        rationale: "Need additional measured evidence before shifting mean.",
        evidenceReferences: structuredClone(inputs.modelInterpretation.worksheets[0].optimizationAssessment[1].evidenceReferences),
      },
      {
        adjustmentClass: "system_specification",
        disposition: "CONSIDER",
        priority: 3,
        rationale: "This class is a requirement change and requires authority.",
        evidenceReferences: structuredClone(inputs.modelInterpretation.worksheets[0].optimizationAssessment[2].evidenceReferences),
      },
      {
        adjustmentClass: "factor_tolerance",
        factor: structuredClone(inputs.modelInterpretation.worksheets[0].optimizationAssessment.find((item) => item.adjustmentClass === "factor_tolerance").factor),
        disposition: "RECOMMENDED",
        priority: 4,
        rationale: "Variance concentration supports tolerance action.",
        evidenceReferences: structuredClone(inputs.modelInterpretation.worksheets[0].optimizationAssessment[3].evidenceReferences),
      },
    ];
    inputs.modelInterpretation.worksheets[0].narrativeMarkdown = [
      "### 模型段落（仅用于文本）",
      "",
      "模型文本写入 9.99 不应成为受控数值依据。",
      "受控占位符 {{calc:rss-sigma}} 仍可替换。",
    ].join("\n");

    const { markdown } = createF6FinalReportProjection(inputs);

    expect(markdown).toContain("### 4.1.1 模型建议依据");
    expect(markdown).toContain(String.raw`factor\_nominal`);
    expect(markdown).toContain(String.raw`system\_mean\_shift`);
    expect(markdown).toContain(String.raw`system\_specification`);
    expect(markdown).toContain(String.raw`factor\_tolerance`);
    expect(markdown).toContain("Requirement Change");
    expect(markdown).toContain("ME review required");
    expect(markdown).toContain(String.raw`system\_specification\_target\_required`);
    expect(markdown).not.toContain("9.99");
  });

  it("maps generic optimization target clarification only to system specification basis row", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      modelInterpretationVersion: "v2",
    });
    const worksheet = inputs.f6Optimization.worksheets[0];
    worksheet.clarifications.push(
      {
        clarificationId: "Analysis-A:generic-target",
        reasonCode: "optimization_target_required",
        requiredInputs: ["optimization_target"],
        questionForReviewer: "Provide governed optimization target.",
        evidenceReferences: [structuredClone(inputs.f6Optimization.provenance.f4Reference)],
      },
      {
        clarificationId: "Analysis-A:tolerance-target",
        reasonCode: "factor_tolerance_target_required",
        requiredInputs: ["factor_tolerance_target"],
        questionForReviewer: "Provide tolerance target for factor class.",
        evidenceReferences: [structuredClone(inputs.f6Optimization.provenance.f4Reference)],
      },
    );

    const { markdown } = createF6FinalReportProjection(inputs);
    const rows = markdown.split("\n");
    const systemRow = rows.find((line) => line.includes("| system\\_specification |"));
    const toleranceRow = rows.find((line) => line.includes("| factor\\_tolerance |"));

    expect(systemRow).toBeDefined();
    expect(toleranceRow).toBeDefined();
    expect(systemRow).toContain(String.raw`system\_specification\_target\_required`);
    expect(toleranceRow).toContain(String.raw`factor\_tolerance\_target\_required`);
    expect(toleranceRow).not.toContain(String.raw`optimization\_target\_required`);
    expect(toleranceRow).not.toContain(String.raw`system\_specification\_target\_required`);
  });

  it("keeps supported structural SIGNALs on pass", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A", "Analysis-B"],
      f5Variant: "supported",
    });
    const projection = createF6FinalReportProjection(inputs);

    expect(projection.reportSummary.workbookDisposition).toBe("PASS");
    expect(projection.reportSummary.worksheetDispositions.map(({ disposition }) => disposition)).toEqual([
      "PASS",
      "PASS",
    ]);
    expect(projection.markdown).toContain("| Analysis-A | Loop Analysis-A | 数值、输入和工程复核均已通过。 | PASS |");
    expect(projection.markdown).toContain("| Analysis-B | Loop Analysis-B | 数值、输入和工程复核均已通过。 | PASS |");
  });

  it("fails closed when F5 completed worksheets drift from readyNames", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const mismatchedInputs = loadRealF6Inputs({ worksheetNames: ["Analysis-X"], f5Variant: "supported" });

    expect(() => createF6FinalReportProjection({
      ...inputs,
      f5Report: mismatchedInputs.f5Report,
    })).toThrow(/Invalid F6 final report input: f5Report\./);
  });

  it("fails closed when F3 contains an extra worksheet outside readyNames", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const worksheets = [
      ...structuredClone(inputs.f3Report.worksheets),
      cloneF3WorksheetWithName("Analysis-Extra", inputs.f3Report.worksheets[0]),
    ];
    const projectionInput = {
      ...inputs,
      f3Report: {
        ...structuredClone(inputs.f3Report),
        worksheets,
        summary: recountF3Summary(worksheets),
      },
    };

    expect(() => createF6FinalReportProjection(projectionInput)).toThrow(/Invalid F6 final report input: f3Report\./);
  });

  it("fails closed when F6 Optimization contains an extra worksheet outside readyNames", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const worksheets = [
      ...structuredClone(inputs.f6Optimization.worksheets),
      cloneF6OptimizationWorksheetWithName("Analysis-Extra", inputs.f6Optimization.worksheets[0]),
    ];
    const projectionInput = {
      ...inputs,
      f6Optimization: {
        ...structuredClone(inputs.f6Optimization),
        worksheets,
        summary: recountF6Summary(worksheets),
      },
    };

    expect(() => createF6FinalReportProjection(projectionInput)).toThrow(/Invalid F6 final report input: f6Optimization\./);
  });

  it("accepts extra F4 calculations when every ready worksheet still has exactly one match", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const calculations = [
      ...structuredClone(inputs.f4Report.calculations),
      cloneF4CalculationWithName("Analysis-Extra", inputs.f4Report.calculations[0], "f4-run-1-2"),
    ];
    const projectionInput = {
      ...inputs,
      f4Report: {
        ...structuredClone(inputs.f4Report),
        calculations,
        summary: {
          selectedWorksheetCount: calculations.length,
          completedWorksheetCount: calculations.length,
        },
      },
    };

    const projection = createF6FinalReportProjection(projectionInput);

    expect(projection.reportSummary.workbookDisposition).toBe("PASS");
    expect(projection.reportSummary.worksheetDispositions).toEqual([
      expect.objectContaining({ worksheetName: "Analysis-A", disposition: "PASS" }),
    ]);
  });

  it("rejects duplicate selected F4 calculations as invalid input before rendering", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const duplicate = structuredClone(inputs.f4Report.calculations[0]);
    duplicate.runReference = "f4-run-1-2";
    const calculations = [...structuredClone(inputs.f4Report.calculations), duplicate];

    expect(() => createF6FinalReportProjection({
      ...inputs,
      f4Report: {
        ...structuredClone(inputs.f4Report),
        calculations,
        summary: {
          selectedWorksheetCount: calculations.length,
          completedWorksheetCount: calculations.length,
        },
      },
    })).toThrow(/Invalid F6 final report input: f4Report\./);
  });

  it("requires F6 Optimization provenance reportScope to match F2 worksheet order and blocked names", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      blockedWorksheetNames: ["Blocked-A"],
      f5Variant: "supported",
    });
    const f6Optimization = structuredClone(inputs.f6Optimization);
    f6Optimization.provenance.reportScope = {
      worksheetNames: ["Blocked-A", "Analysis-A"],
      blockedWorksheetNames: ["Blocked-A"],
    };

    expect(() => createF6FinalReportProjection({
      ...inputs,
      f6Optimization,
    })).toThrow(/Invalid F6 final report input: report scope\./);
  });

  it("rejects an empty selected scope as invalid input", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });

    expect(() => createF6FinalReportProjection({
      ...inputs,
      f6Optimization: {
        ...structuredClone(inputs.f6Optimization),
        worksheets: [],
      },
    })).toThrow();
  });

  it("fails closed when root workbook hash drifts before rendering", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const f3Report = structuredClone(inputs.f3Report);
    f3Report.workbook.contentHash = "c".repeat(64);

    expect(() => createF6FinalReportProjection({
      ...inputs,
      f3Report,
    })).toThrow(/Invalid F6 final report input/);
  });

  it("fails closed when F3 table source identity drifts before rendering", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const f3Report = structuredClone(inputs.f3Report);
    f3Report.worksheets[0].rows[0].source.tableId = "drifted-table";

    expect(() => createF6FinalReportProjection({
      ...inputs,
      f3Report,
    })).toThrow(/Invalid F6 final report input/);
  });

  it("fails closed when F6 baseline metrics drift from the calculation before rendering", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const f4Report = structuredClone(inputs.f4Report);
    f4Report.calculations[0].system.mean += 0.01;

    expect(() => createF6FinalReportProjection({
      ...inputs,
      f4Report,
    })).toThrow(/Invalid F6 final report input/);
  });
});

describe("createF6FinalReportProjection final report template", () => {
  it("returns a structured projection without parsing markdown", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const projection = createF6FinalReportProjection(inputs);

    expect(projection.projection).toBeDefined();
    expect(projection.projection.workbookDisposition).toBe(projection.reportSummary.workbookDisposition);
    expect(projection.projection.worksheetDispositions).toEqual(projection.reportSummary.worksheetDispositions);
    expect(projection.projection.worksheets.map((worksheet) => worksheet.worksheetName)).toEqual([
      "Analysis-A",
    ]);
  });

  it("renders the revised document control and continuous worksheet structure", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    inputs.f2Report.workbook.revision = "D";
    const { markdown } = createF6FinalReportProjection({ ...inputs, generatedAt: "2026-08-20T11:25:45.098Z" });

    expect(markdown).toContain("# 1. 文档控制 Document Control");
    expect(markdown).toContain("| Workbook Revision | D | F1 workbook metadata |");
    expect(markdown).toContain("| Report Generated At | 2026-08-20 11:25:45 | Report runtime |");
    expect(markdown).not.toContain("| Project |");
    expect(markdown).not.toContain("| Workbook Hash |");
    expect(markdown).not.toContain("| Controlled Versions |");
    expect(markdown).toContain("# 2. Workbook 决策总览");
    expect(markdown).toContain("CONDITIONAL_PASS：数值达到要求，但仍需补齐标识或完成工程复核。");
    expect(markdown).toContain("# 3. Worksheet：Analysis-A");
    expect(markdown).toContain("## 3.1 执行摘要");
    expect(markdown).toContain("| Tolerance Loop Description |");
    expect(markdown).not.toContain("| Primary Finding |");
    expect(markdown).toContain("## 3.2 分析目标与要求");
    expect(markdown).toContain("| Design Nominal |");
    expect(markdown).toContain("## 3.3 Tolerance Path Image");
    expect(markdown).toContain("[Open tolerance path image](<");
    expect(markdown.indexOf("## 3.4 输入数据")).toBeGreaterThan(markdown.indexOf("[Open tolerance path image](<"));
    expect(markdown.slice(markdown.indexOf("## 3.3 Tolerance Path Image"), markdown.indexOf("## 3.4 输入数据"))).not.toContain("F5 模型图文联合参考解读");
    expect(markdown).not.toContain("Image Evaluation");
    expect(markdown).toContain("## 3.4 输入数据");
    expect(markdown).toContain("Design Nominal | Mean");
    expect(markdown).not.toContain("F3 Governance");
    expect(markdown).not.toContain("模型假设与计算方法");
    expect(markdown).toContain("## 3.5 结果与规格符合性");
    expect(markdown).toContain("## 3.6 贡献与敏感度");
    expect(markdown).not.toContain("## 3.7 Optimize");
    expect(markdown).toContain("# 4. TA 总结性分析");
    expect(markdown).not.toContain("# 4. Appendix: Reference Traceability");
    expect(markdown).not.toContain(deprecatedF6ReportArtifactName);
    expect(markdown.match(/Predictive Cpk \|/g)).toHaveLength(1);
    expect(markdown.match(/RSS 1σ/g)).toHaveLength(1);
  });

  it("renders Optimize only when built-in policy options exist", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const worksheet = inputs.f6Optimization.worksheets[0];
    const calculation = inputs.f4Report.calculations[0];
    const factor = calculation.factors[0];
    worksheet.options = ["OP1", "OP2", "OP3"].map((optionCode, index) => ({
      optionId: `Analysis-A:builtin-top3:${optionCode}`,
      status: "completed",
      optionSource: "BUILT_IN_POLICY",
      targetId: `f6-top3-tolerance-policy-v1:${optionCode}`,
      policyContext: {
        policyId: "f6-top3-tolerance-policy-v1",
        optionCode,
        trigger: { lowerCpk: 0.9, upperCpk: 2, targetCpk: 1.33, failedSides: ["lowerCpk"] },
        selectedFactorCount: 1,
        reductions: [{ factor: { worksheetName: "Analysis-A", tableId: factor.source.tableId, sourceRow: factor.source.sourceRow, factorName: factor.factorName, unit: factor.unit }, rank: 1, reductionRatio: [0.25, 0.2, 0.4][index], scale: [0.75, 0.8, 0.6][index] }],
      },
      baselineMetrics: { ...worksheet.baselineMetrics, lowerCpk: 0.9, upperCpk: 2, capabilityStatus: "FAIL" },
      resultMetrics: { ...worksheet.baselineMetrics, cpk: 1 + index / 10, lowerCpk: 1 + index / 10, upperCpk: 2.1, capabilityStatus: index === 2 ? "PASS" : "FAIL" },
      scenarioEvidence: { targetId: `f6-top3-tolerance-policy-v1:${optionCode}`, baselineIdentity: worksheet.baselineIdentity, factorOverrides: [{ factor: { worksheetName: "Analysis-A", tableId: factor.source.tableId, sourceRow: factor.source.sourceRow, factorName: factor.factorName, unit: factor.unit }, lowerTolerance: factor.input.lowerTolerance, upperTolerance: factor.input.upperTolerance }], calculationReference: inputs.f6Optimization.provenance.f4Reference, formulaReferences: [] },
      feasibility: { status: "supported", reasonCodes: ["built_in_policy"], evidenceReferences: [] }, evidenceReferences: [], impactRank: index + 1,
    }));
    worksheet.baselineMetrics = worksheet.options[0].baselineMetrics;
    worksheet.highestImpactAction = { optionId: worksheet.options[0].optionId, impactRank: 1 };
    inputs.f6Optimization.summary = recountF6Summary(inputs.f6Optimization.worksheets);

    const { markdown } = createF6FinalReportProjection(inputs);

    expect(markdown).toContain("## 3.7 Optimize");
    expect(markdown).toContain("| Scenario | CpkL | CpkU | Cpk | RSS 1σ | Worst-Case Range | Capability |");
    expect(markdown).toContain("f6-top3-tolerance-policy-v1");
  });

  it("renders all factor rows in the worksheet body and keeps blocked worksheets evidence-only", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      blockedWorksheetNames: ["Blocked-A"],
      f5Variant: "supported",
    });
    const { markdown } = createF6FinalReportProjection(inputs);
    const readyCalculation = inputs.f4Report.calculations[0];
    const blockedMarkdown = markdown.split("# 3. Worksheet：Blocked-A")[1] ?? "";

    expect(markdown.match(/^\| \d+ \| Factor /gm) ?? []).toHaveLength(readyCalculation.factorCount);
    expect(markdown).toContain("| Blocked-A |");
    expect(blockedMarkdown).toContain("输入或计算链被阻断");
    expect(blockedMarkdown).not.toContain("## 3.7 结果与规格符合性");
  });

  it("uses approved explicit missing states when optional context, image, and reviewer are absent", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"] });

    const { markdown } = createF6FinalReportProjection(inputs);

    expect(markdown).toContain("| Workbook Revision | N/A |");
    expect(markdown).toContain("PENDING");
    expect(markdown).toContain("不等于已确认的物理根因");
  });

  it("sanitizes unsafe evidence text before rendering markdown", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const unsafeDescription = "Loop | injected\n<script>";
    inputs.f2Report.worksheets[0].toleranceLoopDescription = unsafeDescription;
    inputs.f2Report.f4Handoffs[0].toleranceLoopDescription = unsafeDescription;
    inputs.f3Report.worksheets[0].toleranceLoopDescription = unsafeDescription;

    const { markdown } = createF6FinalReportProjection(inputs);

    expect(markdown).toContain("Loop \\| injected");
    expect(markdown).not.toContain("<script>");
  });

  it("uses governed F6 projection ranges and margins but renders range results as N/A", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      f5Variant: "supported",
      actualFieldOverrides: { nominalValue: 0.12, mean: 0.12 },
    });
    const calculation = inputs.f4Report.calculations[0];
    const projection = createF6ReportProjection({ calculation, inputResolution: 1e-12 });

    const { markdown } = createF6FinalReportProjection(inputs);

    expect(calculation.system.mean).not.toBe(0);
    expect(projection.margins.worstCase.lowerBound).toBeCloseTo(calculation.system.mean + calculation.system.worstCaseLower);
    expect(projection.margins.worstCase.upperBound).toBeCloseTo(calculation.system.mean + calculation.system.worstCaseUpper);
    expect(markdown).toContain(row([
      "Worst-Case Range",
      engineeringText(projection.margins.worstCase.lowerBound, "mm"),
      engineeringText(projection.margins.worstCase.upperBound, "mm"),
      engineeringText(projection.margins.worstCase.minimumMargin, "mm"),
      "N/A",
      "F6 governed projection",
    ]));
    expect(markdown).toContain(row([
      "4σ Statistical Range",
      engineeringText(projection.margins.statistical.lowerBound, "mm"),
      engineeringText(projection.margins.statistical.upperBound, "mm"),
      engineeringText(projection.margins.statistical.minimumMargin, "mm"),
      "N/A",
      "F6 governed projection",
    ]));
  });

  it("displays F4 capability statuses unchanged at equality boundaries", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      f5Variant: "supported",
      systemSpecificationOverrides: {
        targetSigmaLevel: {
          status: "available", actualValue: 20, displayValue: "20",
          sourceLabel: "Target sigma", sourceCell: "Analysis-A!P56", valueOrigin: "numeric_literal",
        },
      },
    });
    const calculation = inputs.f4Report.calculations[0];
    const projection = createF6FinalReportProjection(inputs);

    const { markdown } = projection;

    expect(calculation.capability.cp).toBeCloseTo(calculation.capability.targetCpk);
    expect(calculation.capability.lowerCpk).toBeCloseTo(calculation.capability.targetCpk);
    expect(calculation.capability.upperCpk).toBeCloseTo(calculation.capability.targetCpk);
    expect([calculation.capability.cpStatus, calculation.capability.lowerCpkStatus, calculation.capability.upperCpkStatus, calculation.capability.status])
      .toEqual(expect.arrayContaining(["FAIL"]));
    expect(markdown).toContain(row(["Predictive Cp", numberText(calculation.capability.cp), calculation.capability.cpStatus, "F4 capability.cpStatus"]));
    expect(markdown).toContain(row(["Predictive CpkL", numberText(calculation.capability.lowerCpk), calculation.capability.lowerCpkStatus, "F4 capability.lowerCpkStatus"]));
    expect(markdown).toContain(row(["Predictive CpkU", numberText(calculation.capability.upperCpk), calculation.capability.upperCpkStatus, "F4 capability.upperCpkStatus"]));
    expect(markdown).toContain(row(["Predictive Cpk", numberText(calculation.capability.cpk), calculation.capability.status, "F4 capability.status"]));
    expect(markdown).toContain(row(["Predicted Yield", percentText(calculation.capability.yield), "N/A", "F4 calculation"]));
    expect(markdown).toContain(row(["Predicted DPM", numberText(calculation.capability.totalDpm), "N/A", "F4 calculation"]));
    expect(projection.reportSummary.worksheetDispositions).toEqual([
      expect.objectContaining({ worksheetName: "Analysis-A", disposition: "INCOMPLETE" }),
    ]);
    expect(projection.reportSummary.workbookDisposition).toBe("INCOMPLETE");
  });
});

describe("worstDisposition", () => {
  it("returns the worst ranked disposition", () => {
    expect(worstDisposition(["PASS", "INCOMPLETE", "FAIL"])).toBe("FAIL");
  });
});