import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  drawingGovernanceResultV2Schema,
  f2UserReportSchema,
  f4WorkflowCalculationResultSchema,
  f5DataInterpretationResultSchema,
  f6ModelInterpretationArtifactSchema,
  f6ReadableOptimizationResultSchema,
} from "../packages/contracts/dist/contracts.js";
import {
  createF5MultimodalFactorSetHash,
  createF5MultimodalRequestHash,
} from "../packages/contracts/dist/ta-multimodal-contracts.js";
import { formatEngineering, formatPercent } from "./engineering-format.mjs";
import { marked } from "marked";
import { createF5DataInterpretation } from "../packages/workbook-catalog/dist/f5-data-interpretation.js";
import { createF4Handoff } from "../packages/workbook-catalog/dist/f4-handoff.js";
import { createF6OptimizationV3, createF6ReportProjection } from "../packages/workbook-catalog/dist/index.js";
import {
  createF6ArtifactBundleFixture,
  createF6V2ObservationArtifact,
  F6_FIXTURE_WORKBOOK_HASH,
  installF6ModelInterpretation,
  installRequiredMultimodalV3,
} from "./f6-artifact-test-fixture.mjs";
import { createF6FinalReportProjection, worstDisposition } from "./f6-final-report.mjs";
import { runF6FullValidation } from "./run-f6-full-validation.mjs";
import { loadF6ArtifactBundle } from "./f6-artifact-loader.mjs";

const deprecatedF6ReportArtifactName = ["Feature6", "Composed", "Report"].join("-");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function row(values) {
  return `| ${values.join(" | ")} |`;
}

const expectedFactorHeaders = [
  "Factor Description",
  "Part Name",
  "Part Category",
  "Drawing Number",
  "DIM ID",
  "Design Nominal",
  "+ Tolerance",
  "- Tolerance",
  "Long Term / Safety Factor",
  "Sigma Level",
  "Mean",
  "Tolerance",
  "One Sigma",
  "Capability / Knowledge Guidance",
];

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

function createMixedMultimodalV4(inputs, { completedWorksheetName = "Analysis-A", failedWorksheetName = "Analysis-B", reasonCode = "evaluation_failed", summary = "worksheet image evaluation failed" } = {}) {
  const completedWorksheet = inputs.f2Report.worksheets.find((worksheet) => worksheet.worksheetName === completedWorksheetName);
  const failedWorksheet = inputs.f2Report.worksheets.find((worksheet) => worksheet.worksheetName === failedWorksheetName);
  const completedCalculation = inputs.f4Report.calculations.find((calculation) => calculation.worksheetSelection.worksheetName === completedWorksheetName);
  const failedCalculation = inputs.f4Report.calculations.find((calculation) => calculation.worksheetSelection.worksheetName === failedWorksheetName);
  const completedF5Worksheet = inputs.f5Report.worksheets.find((worksheet) => worksheet.worksheetName === completedWorksheetName);
  const failedF5Worksheet = inputs.f5Report.worksheets.find((worksheet) => worksheet.worksheetName === failedWorksheetName);
  if (!completedWorksheet || !failedWorksheet || !completedCalculation || !failedCalculation || !completedF5Worksheet || !failedF5Worksheet) {
    throw new Error("Expected mixed multimodal fixture worksheets.");
  }
  const requestFor = (worksheet, calculation, f5Worksheet) => {
    const f2Row = worksheet.rows[0];
    const factor = calculation.factors[0];
    const factorRows = [{
      worksheetName: worksheet.worksheetName,
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
      worksheetName: worksheet.worksheetName,
      tableId: f2Row.tableId,
      activeFactorCount: factorRows.length,
      factorSetHash: createF5MultimodalFactorSetHash(factorRows),
      image: { mediaType: "image/png", contentHash: f5Worksheet.imageReference.contentHash, byteLength: 100, artifactPath: f5Worksheet.imageReference.relativePath },
      factorRows,
    };
    request.requestHash = createF5MultimodalRequestHash(request);
    return request;
  };
  const completedRequest = requestFor(completedWorksheet, completedCalculation, completedF5Worksheet);
  const failedRequest = requestFor(failedWorksheet, failedCalculation, failedF5Worksheet);
  return {
    contractVersion: "f5-multimodal-artifact-v4",
    outputClassification: "confidential",
    sessionId: completedRequest.sessionId,
    revision: completedRequest.revision,
    inputRevision: completedRequest.inputRevision,
    workbookContentHash: completedRequest.workbook.contentHash,
    selectedWorksheetNames: [completedWorksheetName, failedWorksheetName],
    worksheets: [{
      status: "completed",
      request: completedRequest,
      scopeEvaluations: requiredScopeEvaluations(),
      result: {
        contractVersion: "f5-multimodal-result-v3",
        outputClassification: "confidential",
        requestHash: completedRequest.requestHash,
        sessionId: completedRequest.sessionId,
        revision: completedRequest.revision,
        inputRevision: completedRequest.inputRevision,
        workbookContentHash: completedRequest.workbook.contentHash,
        worksheetName: completedRequest.worksheetName,
        tableId: completedRequest.tableId,
        imageContentHash: completedRequest.image.contentHash,
        model: { modelId: "vision-model", supportsImage: true },
        imageTableInterpretation: "Image and complete Factor table jointly support the tolerance path interpretation.",
        rowMappings: completedRequest.factorRows.map((factorRow) => ({
          worksheetName: factorRow.worksheetName,
          tableId: factorRow.tableId,
          sourceRow: factorRow.sourceRow,
          factorOrdinal: structuredClone(factorRow.factorOrdinal),
          mappingStatus: "matched",
          visibleStatus: "visible",
          interpretation: "Factor A is visible and mapped to the table row.",
        })),
      },
    }, {
      status: "failed",
      request: failedRequest,
      reasonCode,
      summary,
    }],
  };
}

function requiredScopeEvaluations() {
  return ["tolerance_loop_closure", "datum_chain", "assembly_datum_face", "stack_start", "direction"].map((scope) => ({
    scope, status: "insufficient_evidence", observedValue: "ambiguous", confidence: "low",
    visibleBasis: "The supplied image does not establish this geometry.",
  }));
}

function keepCompletedWorksheetOnly(inputs, { completedWorksheetName = "Analysis-A", failedWorksheetName = "Analysis-B" } = {}) {
  inputs.f5Report.worksheets = inputs.f5Report.worksheets.filter((worksheet) => worksheet.worksheetName === completedWorksheetName);
  inputs.f5Report.status = "completed";
  inputs.f5Report.summary.worksheetCount = inputs.f5Report.worksheets.length;
  inputs.f5Report.summary.completedWorksheetCount = inputs.f5Report.worksheets.length;
  inputs.f5Report.summary.inputRejectedWorksheetCount = 0;
  inputs.f5Report.summary.statementCount = inputs.f5Report.worksheets.reduce((count, worksheet) => count + worksheet.statements.length, 0);
  inputs.f5Report.summary.clarificationCount = inputs.f5Report.worksheets.reduce((count, worksheet) => count + worksheet.clarifications.length, 0);
  inputs.f5Report.summary.assumptionCount = inputs.f5Report.worksheets.reduce((count, worksheet) => count + worksheet.assumptions.length, 0);

  inputs.f6Optimization.worksheets = inputs.f6Optimization.worksheets.filter((worksheet) => worksheet.worksheetName === completedWorksheetName);
  const completedWorksheet = inputs.f6Optimization.worksheets[0];
  const options = completedWorksheet.steps[3].options;
  inputs.f6Optimization.provenance.reportScope = {
    worksheetNames: [completedWorksheetName, failedWorksheetName],
    blockedWorksheetNames: [failedWorksheetName],
  };
  inputs.f6Optimization.summary.worksheetCount = 1;
  inputs.f6Optimization.summary.completedWorksheetCount = completedWorksheet.runStatus === "COMPLETED" ? 1 : 0;
  inputs.f6Optimization.summary.clarificationRequiredWorksheetCount = completedWorksheet.runStatus === "COMPLETED" ? 0 : 1;
  inputs.f6Optimization.summary.completedOptionCount = options.filter((option) => option.status === "completed").length;
  inputs.f6Optimization.summary.calculationFailedOptionCount = options.filter((option) => option.status === "calculation_failed").length;
  inputs.f6Optimization.runStatus = completedWorksheet.runStatus === "COMPLETED" ? "COMPLETED" : "CLARIFICATION_REQUIRED";
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
    knowledgeBaseVersion: "interpretation-rules-v2",
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
    knowledgeBaseVersion: "interpretation-rules-v2",
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

function loadRealF6Inputs({ worksheetNames = ["Analysis-A"], blockedWorksheetNames = [], f5Variant = "default", actualFieldOverrides = {}, systemSpecificationOverrides = {}, modelInterpretationVersion, optimizationVersion = "v4" } = {}) {
  const bundle = createF6ArtifactBundleFixture({ worksheetNames, blockedWorksheetNames, actualFieldOverrides, systemSpecificationOverrides });
  const modelInterpretation = modelInterpretationVersion === undefined
    ? undefined
    : installF6ModelInterpretation(bundle, { version: modelInterpretationVersion });
  const requiredMultimodal = installRequiredMultimodalV3(bundle);
  const runId = `2026-08-20T00-00-00-000Z-${worksheetNames.join("-")}`;
  const runRoot = path.join(bundle.publishRoot, "f6-runs", runId);
  const interactionLanguage = {
    languageTag: "en-US",
    uiCatalogLanguage: "en",
    lockedAtTurnId: "turn-1",
    source: "workflow_start",
    fallbackUsed: false,
  };

  let optimizationArtifact;
  if (optimizationVersion === "v3") {
    const loaded = loadF6ArtifactBundle({
      ...bundle,
      modelInterpretationArtifactRoot: bundle.modelInterpretationArtifactRoot,
      modelInterpretationArtifact: bundle.modelInterpretationArtifact,
      expectedModelInterpretationContentHash: bundle.expectedModelInterpretationContentHash,
      requireMultimodalV3: true,
    });
    expect(loaded.status, JSON.stringify(loaded, null, 2)).toBe("accepted");
    optimizationArtifact = createF6OptimizationV3(loaded.request, {
      interactionLanguage,
      multimodalInterpretation: loaded.modelInterpretation,
      multimodalReference: loaded.inputDecisions.modelInterpretation.artifactReference,
      optimizationTargets: loaded.optimizationTargets,
      optimizationTargetsDecision: loaded.inputDecisions.optimizationTargets,
    });
  } else {
    const result = runF6FullValidation({}, {
      parseArgs: () => ({
        ...bundle,
        interactionLanguage,
        modelInterpretationArtifact: path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact),
      }),
      resolveLayout: () => ({
        artifactSetVersion: "f6-artifact-set-v3",
        runId,
        runRoot,
        publishRoot: bundle.publishRoot,
        optimizationJsonName: "Feature6-Optimization.json",
        optimizationMdName: "Feature6-Optimization.md",
        finalReportMdName: "Feature6-Report.md",
        finalReportPdfName: "Feature6-Report.pdf",
        runSummaryJsonName: "Feature6-Run-Summary.json",
        manifestName: "manifest.json",
      }),
      renderFinalReportPdf: () => Buffer.from("%PDF-1.7\nvalidated report\n"),
    });

    expect(result.status, JSON.stringify(result, null, 2)).toBe("completed");
    optimizationArtifact = readJson(path.join(runRoot, "Feature6-Optimization.json"));
  }

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
    f6Optimization: f6ReadableOptimizationResultSchema.parse(optimizationArtifact),
    modelInterpretation: requiredMultimodal,
    ...(modelInterpretation === undefined ? {} : { legacyModelInterpretation: f6ModelInterpretationArtifactSchema.parse(modelInterpretation.artifact) }),
  };
}

const loadRealF6InputsBase = loadRealF6Inputs;

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

function withCapability(snapshot, status) {
  const withStoredMidpoint = (value) => {
    const specificationMidpoint = value.capability.lowerSpecLimit / 2 + value.capability.upperSpecLimit / 2;
    return {
      ...value,
      system: {
        ...value.system,
        specificationMidpoint,
        meanOffset: value.system.mean - specificationMidpoint,
      },
    };
  };

  const targetCpk = snapshot.capability.targetCpk;
  if (status === "PASS") {
    return withStoredMidpoint({
      ...snapshot,
      capability: {
        ...snapshot.capability,
        lowerCpk: targetCpk + 0.05,
        upperCpk: targetCpk + 0.05,
        cpk: targetCpk + 0.05,
        yield: 0.999,
        totalDpm: 100,
        status: "PASS",
      },
    });
  }
  return withStoredMidpoint({
    ...snapshot,
    capability: {
      ...snapshot.capability,
      lowerCpk: targetCpk - 0.2,
      upperCpk: targetCpk + 0.02,
      cpk: targetCpk - 0.2,
      yield: 0.95,
      totalDpm: 50_000,
      status: "FAIL",
    },
  });
}

function expandFactorRows(baseFactors, totalRows, changedRows) {
  const template = baseFactors[0];
  const rows = Array.from({ length: Math.max(1, totalRows) }, (_unused, index) => ({
    factor: {
      ...template.factor,
      sourceRow: template.factor.sourceRow + index,
      factorName: `Factor-${index + 1}`,
    },
    nominalValue: template.nominalValue + index * 0.01,
    lowerTolerance: template.lowerTolerance,
    upperTolerance: template.upperTolerance,
    mean: template.mean,
    sigma: template.sigma,
    contribution: Math.max(0.001, template.contribution - index * 0.01),
  }));
  const selectedRows = rows.map((row, index) => {
    if (index >= changedRows) return row;
    return {
      ...row,
      nominalValue: row.nominalValue + 0.005,
      upperTolerance: row.upperTolerance + 0.01,
      lowerTolerance: row.lowerTolerance - 0.01,
    };
  });
  const factorOverrides = selectedRows
    .filter((_row, index) => index < changedRows)
    .map((row) => ({
      factor: structuredClone(row.factor),
      nominalValue: row.nominalValue,
      lowerTolerance: row.lowerTolerance,
      upperTolerance: row.upperTolerance,
    }));
  return { rows, selectedRows, factorOverrides };
}

function createDerivedSnapshot(base, {
  scenarioId,
  sourceStep,
  inputScenarioId,
  capabilityStatus,
  factors,
  factorOverrides,
  systemSpecificationOverride,
}) {
  const updated = withCapability({
    ...structuredClone(base),
    scenarioId,
    sourceStep,
    inputScenarioId,
    factors,
    factorOverrides,
    ...(systemSpecificationOverride === undefined ? {} : { systemSpecificationOverride }),
    system: {
      ...base.system,
      mean: base.system.mean + (capabilityStatus === "PASS" ? 0.01 : 0.02),
      additionalMeanShift: base.system.additionalMeanShift + (capabilityStatus === "PASS" ? 0.01 : 0.02),
    },
  }, capabilityStatus);
  return updated;
}

function recomputeV4Summary(optimization) {
  const statuses = optimization.worksheets.map((worksheet) => worksheet.selectedResult.status);
  optimization.summary = {
    worksheetCount: optimization.worksheets.length,
    baselineMeetsTargetWorksheetCount: statuses.filter((status) => status === "baseline_meets_target").length,
    optimizedWorksheetCount: statuses.filter((status) => (
      status === "step1_centered"
      || status === "step2_tolerance_optimized"
      || status === "step3_specification_relaxed_pending_approval"
    )).length,
    noValidatedResultWorksheetCount: statuses.filter((status) => status === "no_validated_optimized_result").length,
    clarificationRequiredWorksheetCount: optimization.worksheets.filter(({ runStatus }) => runStatus === "CLARIFICATION_REQUIRED").length,
  };
  optimization.runStatus = optimization.summary.clarificationRequiredWorksheetCount > 0 ? "CLARIFICATION_REQUIRED" : "COMPLETED";
}

function configureV4Outcome(inputs, outcome, { totalFactorRows = 3, changedFactorRows = 1 } = {}) {
  const worksheet = inputs.f6Optimization.worksheets[0];
  const baselineResult = structuredClone(worksheet.baselineResult);
  const { rows: baselineFactors, selectedRows, factorOverrides } = expandFactorRows(
    baselineResult.factors,
    totalFactorRows,
    Math.min(changedFactorRows, totalFactorRows),
  );

  const preparedBaseline = withCapability({ ...baselineResult, factors: baselineFactors, factorOverrides: [] }, outcome === "baseline_meets_target" ? "PASS" : "FAIL");
  worksheet.baselineResult = preparedBaseline;
  worksheet.trigger = {
    lowerCpk: preparedBaseline.capability.lowerCpk,
    upperCpk: preparedBaseline.capability.upperCpk,
    targetCpk: preparedBaseline.capability.targetCpk,
    failedSides: [
      ...(preparedBaseline.capability.lowerCpk < preparedBaseline.capability.targetCpk ? ["lowerCpk"] : []),
      ...(preparedBaseline.capability.upperCpk < preparedBaseline.capability.targetCpk ? ["upperCpk"] : []),
    ],
  };

  const step1Snapshot = createDerivedSnapshot(preparedBaseline, {
    scenarioId: `${worksheet.worksheetName}:step1:centered`,
    sourceStep: "meanResponseCentering",
    inputScenarioId: preparedBaseline.scenarioId,
    capabilityStatus: "PASS",
    factors: selectedRows,
    factorOverrides,
  });
  const step2SnapshotPass = createDerivedSnapshot(preparedBaseline, {
    scenarioId: `${worksheet.worksheetName}:step2:optimized-pass`,
    sourceStep: "toleranceReverseSolve",
    inputScenarioId: preparedBaseline.scenarioId,
    capabilityStatus: "PASS",
    factors: selectedRows,
    factorOverrides,
  });
  const step2SnapshotFail = createDerivedSnapshot(preparedBaseline, {
    scenarioId: `${worksheet.worksheetName}:step2:optimized-fail`,
    sourceStep: "toleranceReverseSolve",
    inputScenarioId: preparedBaseline.scenarioId,
    capabilityStatus: "FAIL",
    factors: selectedRows,
    factorOverrides,
  });
  const step3Snapshot = createDerivedSnapshot(step2SnapshotFail, {
    scenarioId: `${worksheet.worksheetName}:step3:spec-relax`,
    sourceStep: "specificationRelaxation",
    inputScenarioId: step2SnapshotFail.scenarioId,
    capabilityStatus: "PASS",
    factors: selectedRows,
    factorOverrides,
    systemSpecificationOverride: {
      lowerSpecLimit: step2SnapshotFail.capability.lowerSpecLimit - 0.2,
      upperSpecLimit: step2SnapshotFail.capability.upperSpecLimit + 0.2,
    },
  });

  if (outcome === "baseline_meets_target") {
    worksheet.steps = [
      { step: "meanResponseCentering", status: "NOT_NEEDED" },
      { step: "toleranceReverseSolve", status: "NOT_NEEDED" },
      { step: "specificationRelaxation", status: "NOT_NEEDED" },
    ];
    worksheet.selectedResult = { status: "baseline_meets_target", snapshot: preparedBaseline };
    worksheet.runStatus = "COMPLETED";
  } else if (outcome === "step1_centered") {
    worksheet.steps = [
      { step: "meanResponseCentering", status: "COMPLETED_TARGET_MET", result: step1Snapshot },
      { step: "toleranceReverseSolve", status: "NOT_RUN_EARLIER_STEP_MET_TARGET" },
      { step: "specificationRelaxation", status: "NOT_RUN_EARLIER_STEP_MET_TARGET" },
    ];
    worksheet.selectedResult = { status: "step1_centered", snapshot: step1Snapshot };
    worksheet.runStatus = "COMPLETED";
  } else if (outcome === "step2_tolerance_optimized") {
    worksheet.steps = [
      { step: "meanResponseCentering", status: "NOT_NEEDED" },
      { step: "toleranceReverseSolve", status: "COMPLETED_TARGET_MET", result: step2SnapshotPass },
      { step: "specificationRelaxation", status: "NOT_RUN_EARLIER_STEP_MET_TARGET" },
    ];
    worksheet.selectedResult = { status: "step2_tolerance_optimized", snapshot: step2SnapshotPass };
    worksheet.runStatus = "COMPLETED";
  } else if (outcome === "step3_specification_relaxed_pending_approval") {
    worksheet.steps = [
      { step: "meanResponseCentering", status: "NOT_NEEDED" },
      { step: "toleranceReverseSolve", status: "COMPLETED_TARGET_NOT_MET", result: step2SnapshotFail },
      {
        step: "specificationRelaxation",
        status: "COMPLETED_TARGET_MET",
        changeClass: "requirement_change",
        approvalRequired: true,
        capabilityImprovementClaim: false,
        result: step3Snapshot,
      },
    ];
    worksheet.selectedResult = { status: "step3_specification_relaxed_pending_approval", snapshot: step3Snapshot };
    worksheet.runStatus = "COMPLETED";
  } else {
    worksheet.steps = [
      { step: "meanResponseCentering", status: "NOT_NEEDED" },
      { step: "toleranceReverseSolve", status: "COMPLETED_TARGET_NOT_MET", result: step2SnapshotFail },
      { step: "specificationRelaxation", status: "NOT_FEASIBLE", reasonCode: "no_validated_path" },
    ];
    worksheet.selectedResult = { status: "no_validated_optimized_result", snapshot: step2SnapshotFail };
    worksheet.runStatus = "COMPLETED";
  }

  recomputeV4Summary(inputs.f6Optimization);
}

describe.skip("legacy v2 createF6FinalReportProjection policy", () => {
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

describe.skip("legacy v2 createF6FinalReportProjection final report template", () => {
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

  it("renders a complete 14-column factor table for ready worksheets", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      f5Variant: "supported",
    });
    const { markdown } = createF6FinalReportProjection(inputs);
    const readyCalculation = inputs.f4Report.calculations[0];
    const readySection = markdown.slice(
      markdown.indexOf("# 3-1 Worksheet: Analysis-A"),
      markdown.indexOf("## Tolerance Path Image"),
    );

    expect(readySection).toContain(row(expectedFactorHeaders));
    expect(readySection).not.toContain("Source Row");
    expect(readySection).not.toContain("Notes");
    expect(readySection).not.toContain("Validation Status");
    expect(readySection).not.toContain("Missing Fields");
    expect(readySection).not.toContain("Ordinal");
    expect(readySection).not.toContain("Distribution");
    expect(readySection).not.toContain("Variance Contribution");
    expect((readySection.match(/^\| Factor /gm) ?? [])).toHaveLength(readyCalculation.factorCount);
  });

  it("renders the governed ready14 list as a single non-legacy report slice", () => {
    const worksheetNames = Array.from({ length: 14 }, (_, index) => `Analysis-${index + 1}`);
    const inputs = loadRealF6Inputs({
      worksheetNames,
      f5Variant: "supported",
    });

    const { markdown, projection } = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });

    expect(projection.worksheets).toHaveLength(14);
    expect(markdown.match(/^# 3-\d+ Worksheet: Analysis-/gm) ?? []).toHaveLength(14);
    for (const worksheetName of worksheetNames) {
      expect(markdown).toContain(`Worksheet: ${worksheetName}`);
    }
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

describe("createF6FinalReportProjection v3", () => {
  const loadRealF6Inputs = (options = {}) => loadRealF6InputsBase({
    optimizationVersion: "v3",
    ...options,
  });

  it("marks ready identifier gaps as MISSING with the printable row marker", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"] });
    const sourceRow = inputs.f2Report.worksheets[0].rows[0];
    sourceRow.actualFields.drawingNumber = null;
    sourceRow.actualFields.dimCharacteristicId = null;
    sourceRow.missingIdentifiers = ["drawingNumber", "dimCharacteristicId"];
    inputs.f2Report.summary.missingPartNumberCount = 1;
    inputs.f2Report.summary.missingDimIdCount = 1;
    inputs.f2Report.f4Handoffs[0] = createF4Handoff({ workbookContentHash: inputs.f2Report.workbook.contentHash, worksheet: inputs.f2Report.worksheets[0] });
    inputs.modelInterpretation = createMultimodalV3(inputs);
    const { markdown } = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });
    const tableRow = markdown.split("\n").find((line) => line.startsWith("| Factor Analysis-A"));
    expect(tableRow).toContain("| MISSING | MISSING |");
    expect(tableRow).toContain(`data-f6-marker="required-missing" data-source-row="${sourceRow.sourceRow}"`);
  });

  it("shows exact row and image blockers for evidence-only worksheets", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      blockedWorksheetNames: ["Blocked-A"],
    });
    const blockedWorksheet = inputs.f2Report.worksheets.find(({ worksheetName }) => worksheetName === "Blocked-A");
    const missingRow = structuredClone(blockedWorksheet.rows[0]);
    missingRow.sourceRow = 16;
    missingRow.factorOrdinal = { value: "B", rawText: "B", sourceCell: "Blocked-A!Z16" };
    missingRow.missingRequiredFields = ["factorName"];
    missingRow.missingIdentifiers = ["drawingNumber"];
    missingRow.sourceCells = {
      ...missingRow.sourceCells,
      factorName: "Blocked-A!A16",
      partName: "Blocked-A!B16",
      partCategory: "Blocked-A!C16",
      nominalValue: "Blocked-A!D16",
      upperTolerance: "Blocked-A!E16",
      lowerTolerance: "Blocked-A!F16",
      longTermSafetyFactor: "Blocked-A!G16",
      standardDeviation: "Blocked-A!H16",
      distribution: "Blocked-A!I16",
    };
    const secondMissingRow = structuredClone(missingRow);
    secondMissingRow.sourceRow = 17;
    secondMissingRow.factorOrdinal = { value: "C", rawText: "C", sourceCell: "Blocked-A!Z17" };
    secondMissingRow.missingRequiredFields = [];
    secondMissingRow.missingIdentifiers = ["dimCharacteristicId"];
    secondMissingRow.sourceCells = {
      ...secondMissingRow.sourceCells,
      factorName: "Blocked-A!A17",
      partName: "Blocked-A!B17",
      partCategory: "Blocked-A!C17",
      nominalValue: "Blocked-A!D17",
      upperTolerance: "Blocked-A!E17",
      lowerTolerance: "Blocked-A!F17",
      longTermSafetyFactor: "Blocked-A!G17",
      standardDeviation: "Blocked-A!H17",
      distribution: "Blocked-A!I17",
    };
    blockedWorksheet.rows.push(missingRow, secondMissingRow);
    blockedWorksheet.missingFieldSummary = [{ field: "factorName", factorCount: 1, sourceRows: [16] }];
    inputs.f2Report.summary = {
      ...inputs.f2Report.summary,
      factorRowCount: inputs.f2Report.worksheets.reduce((count, worksheet) => count + worksheet.rows.length, 0),
      rowsWithRequiredMissing: inputs.f2Report.worksheets.reduce((count, worksheet) => count + worksheet.rows.filter((row) => row.missingRequiredFields.length > 0).length, 0),
      requiredMissingFieldCount: inputs.f2Report.worksheets.reduce((count, worksheet) => count + worksheet.rows.reduce((rowCount, row) => rowCount + row.missingRequiredFields.length, 0), 0),
      missingDimIdCount: inputs.f2Report.worksheets.reduce((count, worksheet) => count + worksheet.rows.filter((row) => row.missingIdentifiers.includes("dimCharacteristicId")).length, 0),
      missingPartNumberCount: inputs.f2Report.worksheets.reduce((count, worksheet) => count + worksheet.rows.filter((row) => row.missingIdentifiers.includes("drawingNumber") || row.missingIdentifiers.includes("partNumber")).length, 0),
      nonF0ProcessCategoryCount: inputs.f2Report.worksheets.reduce((count, worksheet) => count + worksheet.rows.filter((row) => row.capabilityStatus === "non_f0_process_category").length, 0),
    };

    const { markdown, reportSummary } = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });
    const blockedSectionStart = markdown.indexOf("# 3-2 Worksheet: Blocked-A");
    const blockedSection = markdown.slice(blockedSectionStart, markdown.indexOf("## Tolerance Path Image", blockedSectionStart));

    expect(reportSummary.worksheetDispositions).toEqual([
      { worksheetName: "Analysis-A", disposition: "CONDITIONAL_PASS" },
      { worksheetName: "Blocked-A", disposition: "FAIL" },
    ]);
    expect(reportSummary.workbookDisposition).toBe("FAIL");
    expect(blockedSection).toContain(row(expectedFactorHeaders));
    expect(blockedSection).toContain(`| MISSING <span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="16" hidden aria-hidden="true"></span> | Part Blocked-A | CNC | MISSING | DIM-100 | 0 mm | 0.200000 mm | -0.200000 mm | 1 | 4 | N/A | N/A | N/A | N/A |`);
    expect(blockedSection).toContain(`| Factor Blocked-A <span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="17" hidden aria-hidden="true"></span> | Part Blocked-A | CNC | DRAW-100 | MISSING | 0 mm | 0.200000 mm | -0.200000 mm | 1 | 4 | N/A | N/A | N/A | N/A |`);
    expect(blockedSection).toContain(`<span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="16" hidden aria-hidden="true"></span>`);
    expect(blockedSection).toContain(`<span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="17" hidden aria-hidden="true"></span>`);
    expect(blockedSection).not.toContain("<!-- factor-row-state=required-missing source-row=16 -->");
    expect(blockedSection).not.toContain("<!-- factor-row-state=required-missing source-row=17 -->");
    const html = marked.parse(markdown, { async: false });
    expect(html).toContain(`<span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="16" hidden aria-hidden="true"></span>`);
    expect(html).toContain(`<span class="f6-inline-marker" data-f6-marker="required-missing" data-source-row="17" hidden aria-hidden="true"></span>`);
    expect(blockedSection.match(/\| Factor Description \| Part Name \| Part Category \| Drawing Number \| DIM ID \| Design Nominal \| \+ Tolerance \| - Tolerance \| Long Term \/ Safety Factor \| Sigma Level \| Mean \| Tolerance \| One Sigma \| Capability \/ Knowledge Guidance \|/g) ?? []).toHaveLength(1);
    expect(blockedSection).not.toContain("Source Row");
    expect(blockedSection).not.toContain("Notes");
    expect(blockedSection).not.toContain("Validation Status");
    expect(blockedSection).not.toContain("Missing Fields");
    expect(blockedSection).not.toContain("Ordinal");
    expect(blockedSection).not.toContain("Distribution");
    expect(blockedSection).not.toContain("Variance Contribution");
  });

  it("accepts equivalent numeric F2 and textual multimodal DIM IDs", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"] });
    inputs.modelInterpretation.worksheets[0].request.factorRows[0].dimId = "101";
    inputs.modelInterpretation.worksheets[0].request.factorSetHash = createF5MultimodalFactorSetHash(
      inputs.modelInterpretation.worksheets[0].request.factorRows,
    );
    inputs.modelInterpretation.worksheets[0].request.requestHash = createF5MultimodalRequestHash(
      inputs.modelInterpretation.worksheets[0].request,
    );
    inputs.modelInterpretation.worksheets[0].result.requestHash = inputs.modelInterpretation.worksheets[0].request.requestHash;
    inputs.f2Report = JSON.parse(JSON.stringify(inputs.f2Report).replaceAll('"DIM-100"', "101"));

    expect(() => createF6FinalReportProjection(inputs, { requireMultimodalV3: true })).not.toThrow();
  });

  it.each([1, 2, 3])("renders %i worksheets in governed ordinal order", (worksheetCount) => {
    const worksheetNames = Array.from({ length: worksheetCount }, (_, index) => `Analysis-${String.fromCharCode(65 + index)}`);
    const inputs = loadRealF6Inputs({ worksheetNames });
    const report = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });

    worksheetNames.forEach((worksheetName, index) => {
      expect(report.markdown).toContain(`# 3-${index + 1} Worksheet: ${worksheetName}`);
      expect(report.markdown).not.toMatch(new RegExp(`^## 3-${index + 1}-\\d+ `, "mu"));
      const worksheetStart = report.markdown.indexOf(`# 3-${index + 1} Worksheet: ${worksheetName}`);
      const factorStart = report.markdown.indexOf("## Complete Factor Table", worksheetStart);
      const imageStart = report.markdown.indexOf("## Tolerance Path Image", worksheetStart);
      expect(factorStart).toBeGreaterThan(worksheetStart);
      expect(imageStart).toBeGreaterThan(factorStart);
      expect(report.markdown).toContain("## Requirements and Statistical Results");
      expect(report.markdown).toContain("## Adjusted Mean to Spec Center Shift");
      expect(report.markdown).toContain("## Contributor Priorities");
      expect(report.markdown).toContain("## Specification Changes");
      expect(report.markdown).not.toContain("Tolerance Optimization Options");
    });
    expect(report.projection.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(worksheetNames);
  });

  it("keeps the interaction language metadata while rendering the final report in English", () => {
    const inputs = loadRealF6Inputs();
    inputs.f6Optimization.interactionLanguage = {
      languageTag: "zh-CN", uiCatalogLanguage: "zh", lockedAtTurnId: "turn-zh", source: "workflow_start", fallbackUsed: false,
    };
    const report = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });

    expect(inputs.f6Optimization.interactionLanguage.uiCatalogLanguage).toBe("zh");
    expect(report.markdown).toContain("# TA Engineering Analysis Report");
    expect(report.markdown).toContain("## Tolerance Path Image");
    expect(report.markdown).toContain("## Complete Factor Table");
    expect(report.markdown).toContain("Image and complete Factor table interpreted for Analysis-A.");
    expect(report.markdown).toContain("*Model interpretation may contain hallucinations, label mismatches, or omissions and must be reviewed by ME.*");
    expect(report.markdown).not.toContain("- Factor Analysis-A: A is visible.");
    expect(report.markdown).not.toContain("TA 工程分析报告");
    expect(report.markdown).not.toMatch(/\p{Script=Han}/u);
  });

  it("renders timezone-aware worksheet navigation with a review comment", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A", "Analysis-B"] });
    const report = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });

    expect(report.markdown).toMatch(/\| Report Generated At \| 2026-08-\d{2} \d{2}:\d{2}:\d{2} \(UTC [+-]\d{1,2}(?::\d{2})?\) \|/u);
    expect(report.markdown).toContain("| Worksheet | Tolerance Loop Description | Key Finding | Comment |");
    expect(report.markdown).toContain("| [Analysis-A](#worksheet-1) | Loop Analysis-A |");
    expect(report.markdown).toContain("| Need Review |");
    expect(report.markdown).toContain("[Analysis-A](#worksheet-1)");
    expect(report.markdown).toContain("[Analysis-B](#worksheet-2)");
    expect(report.markdown).toContain('<a id="worksheet-1"></a>');
    expect(report.markdown).toContain('<a id="worksheet-2"></a>');
  });

  it("uses governed side capability statuses in the Key Finding at equality boundaries", () => {
    const inputs = loadRealF6Inputs({
      systemSpecificationOverrides: {
        targetSigmaLevel: {
          status: "available", actualValue: 20, displayValue: "20",
          sourceLabel: "Target sigma", sourceCell: "Analysis-A!P56", valueOrigin: "numeric_literal",
        },
      },
    });
    const calculation = inputs.f4Report.calculations[0];
    const report = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });

    expect(calculation.capability.lowerCpk).toBeCloseTo(calculation.capability.targetCpk);
    expect(calculation.capability.lowerCpkStatus).toBe("FAIL");
    expect(calculation.capability.upperCpkStatus).toBe("FAIL");
    expect(report.markdown).toContain(`CpkL ${numberText(calculation.capability.lowerCpk)} and CpkU ${numberText(calculation.capability.upperCpk)} do not meet Target Cpk ${numberText(calculation.capability.targetCpk)}.`);
    expect(report.markdown).not.toContain("ME review of the TA result is required");
    expect(report.markdown).toContain("| Fail |");
  });

  it("preserves the engineering Key Finding in the structured v3 projection", () => {
    const inputs = loadRealF6Inputs();
    const report = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });
    const expectedFinding = "Capability meets Target Cpk 1.333333, but drawing dimension definition or engineering review remains incomplete; analysis closure is not complete.";

    expect(report.markdown).toContain(expectedFinding);
    expect(report.projection.worksheets[0].findings).toEqual([expectedFinding]);
  });

  it("renders the complete governed report contract without provenance columns", () => {
    const inputs = loadRealF6Inputs({
      actualFieldOverrides: { nominalValue: 0.2, mean: 0.2, notes: "Review assembly stack." },
    });
    const report = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });
    const markdown = report.markdown;
    const factorSectionStart = markdown.indexOf("## Complete Factor Table");
    const factorSection = markdown.slice(factorSectionStart, markdown.indexOf("## Tolerance Path Image", factorSectionStart));

    expect(markdown).toContain("## 1. Document Overview");
    expect(markdown).toContain("## 2. Workbook Summary");
    expect(factorSection).toContain(row(expectedFactorHeaders));
    expect(factorSection).toContain("| Factor Analysis-A | Part Analysis-A | CNC | DRAW-100 | DIM-100 |");
    expect(factorSection).toContain(String.raw`Capability: non\_f0\_process\_category`);
    expect(factorSection).not.toContain("Ordinal");
    expect(factorSection).not.toContain("Row");
    expect(factorSection).not.toContain("Distribution");
    expect(factorSection).not.toContain("Notes");
    expect(factorSection).not.toContain("Variance Contribution");
    expect(markdown).not.toContain("Review assembly stack.");

    expect(markdown).toContain("## Requirements and Statistical Results");
    for (const label of [
      "Design Nominal", "LSL", "USL", "Target Cpk", "Evaluation Level",
      "Statistical Range", "Worst-Case Range", "Predictive Cp", "Predictive CpkL",
      "Predictive CpkU", "Predictive Cpk", "Predicted Yield", "Predicted DPM",
      "Mean Response", "Mean Shift", "RSS One Sigma",
    ]) expect(markdown).toContain(label);

    expect(markdown).not.toContain("F0 Capability and Knowledge Guidance");
    expect(markdown).toContain(String.raw`non\_f0\_process\_category`);

    expect(markdown).toContain("## Adjusted Mean to Spec Center Shift");
    expect(markdown).toContain("Adjusted Mean: 0.200 mm");
    expect(markdown).toContain("Specification Center: 0.000 mm");
    expect(markdown).toContain("Offset: 0.200 mm");
    expect(markdown).toContain("optimize Factor nominal values");

    expect(markdown).toContain("## Contributor Priorities");
    expect(markdown).toContain("| Rank | Factor | One Sigma | Variance Contribution | Priority | Guidance |");
    expect(markdown).toContain("Focus tolerance-range review on the first three priorities.");
    expect(markdown).toContain("## Specification Changes");
    expect(markdown).not.toContain("Tolerance Optimization Options");
    expect(markdown).not.toMatch(/^## 3-1-\d+ /gmu);
    expect(markdown.match(/\| Rank \| Factor \| One Sigma \| Variance Contribution/gmu)).toHaveLength(1);
    expect(markdown).not.toMatch(/^\|[^\n]*\|\s*(?:Source|Evidence|来源|证据)\s*\|[^\n]*$/imu);
  });

  it("omits specification changes for a passing worksheet and labels it Pass", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const report = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });

    expect(report.reportSummary.worksheetDispositions).toEqual([
      expect.objectContaining({ worksheetName: "Analysis-A", disposition: "PASS" }),
    ]);
    expect(report.markdown).toContain("| Pass |");
    expect(report.markdown).not.toContain("## Specification Changes");
  });

  it("renders qualitative priorities and suppresses an aligned-center warning", () => {
    const inputs = loadRealF6Inputs();
    const report = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });

    expect(report.markdown).toContain("| 1 | Factor Analysis-A | 0.050000 mm | 100.0% | High | tighten\\_tolerance |");
    expect(report.markdown).toContain("- Status: aligned");
    expect(report.markdown).not.toMatch(/center warning/iu);
  });

  it("marks deterministic specification proposals as approval-required", () => {
    const inputs = loadRealF6Inputs({
      systemSpecificationOverrides: {
        targetSigmaLevel: {
          status: "available", actualValue: 20, displayValue: "20",
          sourceLabel: "Target sigma", sourceCell: "Analysis-A!P56", valueOrigin: "numeric_literal",
        },
      },
    });
    const report = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });
    const proposals = inputs.f6Optimization.worksheets[0].steps[2].proposals;

    expect(proposals.length).toBeGreaterThan(0);
    expect(report.markdown).toContain("Engineering approval required");
    expect(report.markdown).not.toContain("capability improvement");
  });

  it("omits internal tolerance optimization options", () => {
    const inputs = loadRealF6Inputs({
      systemSpecificationOverrides: {
        targetSigmaLevel: {
          status: "available", actualValue: 20, displayValue: "20",
          sourceLabel: "Target sigma", sourceCell: "Analysis-A!P56", valueOrigin: "numeric_literal",
        },
      },
    });
    const report = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });

    expect(report.markdown).not.toContain("Tolerance Optimization Options");
    expect(report.markdown).not.toContain("f6-top3-tolerance-policy-v1");
    expect(report.markdown).not.toContain("Result Cpk");
  });

  it("rejects Chinese model interpretation text from the English report", () => {
    const inputs = loadRealF6Inputs();
    inputs.modelInterpretation.worksheets[0].result.imageTableInterpretation = "模型生成的中文解读。";

    expect(() => createF6FinalReportProjection(inputs, { requireMultimodalV3: true }))
      .toThrow(/English-only report/i);
  });

  it("rejects contributor Factor identity drift against F4 evidence", () => {
    const inputs = loadRealF6Inputs({
      systemSpecificationOverrides: {
        targetSigmaLevel: {
          status: "available", actualValue: 20, displayValue: "20",
          sourceLabel: "Target sigma", sourceCell: "Analysis-A!P56", valueOrigin: "numeric_literal",
        },
      },
    });
    const priority = inputs.f6Optimization.worksheets[0].steps[1].priorities[0];
    priority.factor.factorName = "Drifted Factor";
    for (const option of inputs.f6Optimization.worksheets[0].steps[3].options) {
      option.reductions[0].factor.factorName = "Drifted Factor";
      if (option.status === "completed") option.scenarioEvidence.factorOverrides[0].factor.factorName = "Drifted Factor";
    }

    expect(() => createF6FinalReportProjection(inputs, { requireMultimodalV3: true })).toThrow(/contributor Factor identity/i);
  });

  it("does not expose provenance columns while preserving governed input provenance", () => {
    const inputs = loadRealF6Inputs();
    const provenance = structuredClone(inputs.f6Optimization.provenance);
    const report = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });

    expect(report.markdown).not.toMatch(/^\|[^\n]*\|\s*(?:Source|Evidence|来源|证据)\s*\|[^\n]*$/imu);
    expect(JSON.stringify(report.projection)).not.toMatch(/"(?:source|evidence|来源|证据)"\s*:/iu);
    expect(inputs.f6Optimization.provenance).toEqual(provenance);
    expect(report.projection.worksheets[0].gatingEvidenceReferences).toHaveLength(2);
  });
});

describe("createF6FinalReportProjection v4 mixed outcomes", () => {
  it("accepts mixed multimodal v4 outcomes in the required multimodal path and renders failed worksheets as FAIL", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A", "Analysis-B"],
      f5Variant: "supported",
      modelInterpretationVersion: "v2",
    });
    inputs.modelInterpretation = createMixedMultimodalV4(inputs);

    const report = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });

    expect(report.reportSummary.worksheetDispositions).toEqual([
      { worksheetName: "Analysis-A", disposition: "PASS" },
      { worksheetName: "Analysis-B", disposition: "FAIL" },
    ]);
    expect(report.markdown).toContain("# TA Engineering Analysis Report");
    expect(report.markdown).not.toContain("## Optimization Comparison");
    expect(report.markdown).not.toContain("<!-- f6-optimization-comparison -->");
    expect(report.markdown).toContain("| [Analysis-B](#worksheet-2) | Loop Analysis-B | Multimodal blocker (evaluation\\_failed): worksheet image evaluation failed. | Fail |");
  });

  it("omits the optimization comparison block for baseline PASS worksheets", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    configureV4Outcome(inputs, "baseline_meets_target");

    const report = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });

    expect(report.markdown).not.toContain("## Optimization Comparison");
    expect(report.markdown).not.toContain("<!-- f6-optimization-comparison -->");
  });

  it("fails schema validation when a V4 snapshot misses midpoint or mean-offset fields", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    configureV4Outcome(inputs, "step2_tolerance_optimized");

    delete inputs.f6Optimization.worksheets[0].baselineResult.system.specificationMidpoint;
    delete inputs.f6Optimization.worksheets[0].selectedResult.snapshot.system.meanOffset;

    expect(() => createF6FinalReportProjection(inputs, { requireMultimodalV3: true })).toThrow(/f6Optimization/i);
  });

  it.each([
    ["step1_centered"],
    ["step2_tolerance_optimized"],
    ["step3_specification_relaxed_pending_approval"],
    ["no_validated_optimized_result"],
  ])("renders stable V4 comparison tables for %s", (selectedStatus) => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    configureV4Outcome(inputs, selectedStatus);

    const report = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });
    const markdown = report.markdown;

    expect(markdown).toContain("## Optimization Comparison");
    expect(markdown).toContain("<!-- f6-optimization-comparison -->");
    expect(markdown).toContain("| Metric | Raw Data | Optimized Data |");
    expect(markdown).toContain("| Step | Status | Action | Result |");
    expect(markdown).toContain("| Factor | Table / Row | Nominal Raw -> Optimized | Tolerance Raw -> Optimized | Sigma Raw -> Optimized | Contribution Raw -> Optimized | Changed By |");
    expect(markdown).toContain("toleranceReverseSolve");

    const step1Index = markdown.indexOf("| meanResponseCentering |");
    const step2Index = markdown.indexOf("| toleranceReverseSolve |");
    const step3Index = markdown.indexOf("| specificationRelaxation |");
    expect(step1Index).toBeGreaterThan(-1);
    expect(step2Index).toBeGreaterThan(step1Index);
    expect(step3Index).toBeGreaterThan(step2Index);

    if (selectedStatus === "step3_specification_relaxed_pending_approval") {
      expect(markdown).toContain("Requirement change - engineering approval required");
    }
    if (selectedStatus === "no_validated_optimized_result") {
      expect(markdown).toContain("No validated optimized result");
      expect(markdown).toContain("| Predictive Cpk | 1.133333 | N/A |");
      expect(markdown).not.toMatch(/\| Predictive Cpk \| 1\.133333 \| 1\./u);
    }
  });

  it("renders only changed factors and deterministic continuation markers", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    configureV4Outcome(inputs, "step2_tolerance_optimized", { totalFactorRows: 20, changedFactorRows: 14 });

    const report = createF6FinalReportProjection(inputs, { requireMultimodalV3: true });
    const markdown = report.markdown;

    expect(markdown).toContain("| Factor-1 | table-1 / 2 |");
    expect(markdown).not.toContain("| Factor-20 | table-1 / 21 |");
    expect(markdown).toContain("Unchanged factors: 6");
    expect(markdown).toContain("<!-- f6-optimization-comparison continuation=\"1\" -->");
    expect(markdown).toContain("## Optimization Comparison (Continued)");
  });
});

describe("worstDisposition", () => {
  it("returns the worst ranked disposition", () => {
    expect(worstDisposition(["PASS", "INCOMPLETE", "FAIL"])).toBe("FAIL");
  });
});