import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createF5DataInterpretation } from "../packages/workbook-catalog/dist/f5-data-interpretation.js";
import { createF4Handoff } from "../packages/workbook-catalog/dist/f4-handoff.js";
import { calculateF4Workflow } from "./f4-calculation-workflow.mjs";

export const F6_FIXTURE_WORKBOOK_HASH = "a".repeat(64);
export const F6_FIXTURE_RUN_ID = "f4-run-1";
const IMAGE_HASH = "b".repeat(64);
const CORE_SCOPES = [
  "tolerance_loop_closure",
  "datum_chain",
  "assembly_datum_face",
  "stack_start",
  "direction",
];

function sourceCells(worksheetName, sourceRow) {
  return {
    factorName: `${worksheetName}!A${sourceRow}`,
    partName: `${worksheetName}!B${sourceRow}`,
    partCategory: `${worksheetName}!C${sourceRow}`,
    nominalValue: `${worksheetName}!D${sourceRow}`,
    upperTolerance: `${worksheetName}!E${sourceRow}`,
    lowerTolerance: `${worksheetName}!F${sourceRow}`,
    longTermSafetyFactor: `${worksheetName}!G${sourceRow}`,
    standardDeviation: `${worksheetName}!H${sourceRow}`,
    distribution: `${worksheetName}!I${sourceRow}`,
  };
}

function actualFields(worksheetName, overrides = {}) {
  return {
    factorName: `Factor ${worksheetName}`,
    partName: `Part ${worksheetName}`,
    drawingNumber: "DRAW-100",
    dimCharacteristicId: "DIM-100",
    partCategory: "CNC",
    nominalValue: 0,
    upperTolerance: 0.2,
    lowerTolerance: -0.2,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "normal",
    mean: 0,
    tolerance: 0.2,
    oneSigma: 0.05,
    percentContributionToSigma: 1,
    notes: null,
    ...overrides,
  };
}

function systemSpecification(worksheetName, overrides = {}) {
  return {
    status: "available",
    designNominal: {
      status: "available", actualValue: -0.05, displayValue: "-0.05",
      sourceLabel: "Design Nominal", sourceCell: `${worksheetName}!P53`, valueOrigin: "numeric_literal",
    },
    lowerSpecLimit: {
      status: "available", actualValue: -1, displayValue: "-1",
      sourceLabel: "Lower", sourceCell: `${worksheetName}!P54`, valueOrigin: "numeric_literal",
    },
    upperSpecLimit: {
      status: "available", actualValue: 1, displayValue: "1",
      sourceLabel: "Upper", sourceCell: `${worksheetName}!P55`, valueOrigin: "numeric_literal",
    },
    targetSigmaLevel: {
      status: "available", actualValue: 4, displayValue: "4",
      sourceLabel: "Target sigma", sourceCell: `${worksheetName}!P56`, valueOrigin: "numeric_literal",
    },
    additionalMeanShift: {
      status: "available", actualValue: 0, displayValue: "0",
      sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted",
    },
    ...overrides,
  };
}

function readyWorksheet(worksheetName, tableId, sourceRow, options = {}) {
  return {
    worksheetName,
    toleranceLoopDescription: `Loop ${worksheetName}`,
    status: "ready",
    tolerancePathImageStatus: "available",
    systemSpecification: systemSpecification(worksheetName, options.systemSpecificationOverrides),
    systemSpecificationIssues: [],
    rows: [{
      worksheetName,
      tableId,
      sourceRow,
      actualFields: actualFields(worksheetName, options.actualFieldOverrides),
      sourceCells: sourceCells(worksheetName, sourceRow),
      missingRequiredFields: [],
      missingIdentifiers: [],
      capabilityStatus: "non_f0_process_category",
      adoReminderRequested: false,
    }],
    missingFieldSummary: [],
    f4CalculabilityIssues: [],
  };
}

function governanceRows(worksheetName, calculation) {
  const imageReference = {
    artifact: "f1",
    worksheetName,
    relativePath: `images/${worksheetName}.png`,
    contentHash: IMAGE_HASH,
  };
  return calculation.factors.map((factor, index) => ({
    factorInstanceId: String(index + 1).padStart(64, "0"),
    drawingDimensionKey: String(index + 11).padStart(64, "0"),
    deviceLevelDim: `device-${index + 1}`,
    dimensionDescription: `Loop ${worksheetName}`,
    partCategory: "CNC",
    partSubsystem: `Part ${worksheetName}`,
    drawingNumber: "DRAW-100",
    dimId: "DIM-100",
    factorDescription: factor.factorName,
    nominal: factor.input.nominalValue,
    upperTolerance: factor.input.upperTolerance,
    lowerTolerance: factor.input.lowerTolerance,
    sigmaLevel: factor.input.sigmaLevel,
    dimIdStatus: "valid",
    qualitySignals: [],
    governanceStatus: "complete",
    imageReference,
    source: { ...factor.source, sourceCells: sourceCells(worksheetName, factor.source.sourceRow) },
  }));
}

export function writeFixtureJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function readFixtureJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function rewriteFixtureJson(filePath, mutate) {
  const value = readFixtureJson(filePath);
  mutate(value);
  writeFixtureJson(filePath, value);
}

export function fixtureFileSha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function createF6ArtifactBundleFixture({ worksheetNames = ["Analysis-A"], blockedWorksheetNames = [], actualFieldOverrides = {}, systemSpecificationOverrides = {} } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "f6-artifact-fixture-"));
  const publishRoot = path.join(root, "publish");
  const inputRoot = path.join(publishRoot, "inputs");
  const f2ArtifactRoot = path.join(inputRoot, "f2");
  const f3ArtifactRoot = path.join(inputRoot, "f3");
  const f4ArtifactRoot = path.join(inputRoot, "f4");
  const f5ArtifactRoot = path.join(inputRoot, "f5");
  mkdirSync(publishRoot, { recursive: true });
  const worksheets = worksheetNames.map((worksheetName, index) =>
    readyWorksheet(worksheetName, `table-${index + 1}`, index + 2, { actualFieldOverrides, systemSpecificationOverrides }));
  const blockedWorksheets = blockedWorksheetNames.map((worksheetName, index) => ({
    ...readyWorksheet(worksheetName, `blocked-table-${index + 1}`, index + 20, { actualFieldOverrides, systemSpecificationOverrides }),
    status: "blocked",
    tolerancePathImageStatus: "unavailable",
  }));
  const handoffs = worksheets.map((worksheet) => createF4Handoff({
    workbookContentHash: F6_FIXTURE_WORKBOOK_HASH,
    worksheet,
  }));
  const f4 = calculateF4Workflow({
    status: "accepted",
    reportPath: "Feature2-Report.json",
    workbook: {
      fileName: "Anonymous.xlsx",
      contentHash: F6_FIXTURE_WORKBOOK_HASH,
      f1GeneratedAt: "2026-08-17T00:00:00.000Z",
    },
    handoffs,
  }, {
    runId: F6_FIXTURE_RUN_ID,
    generatedAt: "2026-08-17T00:01:00.000Z",
  });
  const calculations = f4.calculations;
  if (calculations.some(({ status }) => status !== "completed")) throw new Error("fixture calculation failed");

  const f2 = {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: blockedWorksheets.length === 0 ? "completed" : "partiallyBlocked",
    workbook: {
      fileName: "Anonymous.xlsx",
      contentHash: F6_FIXTURE_WORKBOOK_HASH,
      f1GeneratedAt: "2026-08-17T00:00:00.000Z",
    },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot: "controlled/f1",
    worksheets: [...worksheets, ...blockedWorksheets],
    f4Handoffs: handoffs,
    adoEvents: [],
    summary: {
      worksheetsChecked: worksheets.length + blockedWorksheets.length,
      blockedWorksheetCount: blockedWorksheets.length,
      readyWorksheetCount: worksheets.length,
      factorRowCount: worksheets.length + blockedWorksheets.length,
      rowsWithRequiredMissing: 0,
      requiredMissingFieldCount: 0,
      missingImageWorksheetCount: blockedWorksheets.length,
      internalWithinGuidanceCount: 0,
      internalGuidanceExceededCount: 0,
      f0InformationInsufficientCount: 0,
      publicLibraryMatchCount: 0,
      nonF0ProcessCategoryCount: worksheets.length + blockedWorksheets.length,
      unableToCheckCount: 0,
      publicToleranceDifferenceCount: 0,
      publicDistributionDifferenceCount: 0,
      missingDimIdCount: 0,
      missingPartNumberCount: 0,
    },
  };
  const f3Worksheets = calculations.map((calculation) => ({
    worksheetName: calculation.worksheetSelection.worksheetName,
    toleranceLoopDescription: `Loop ${calculation.worksheetSelection.worksheetName}`,
    rows: governanceRows(calculation.worksheetSelection.worksheetName, calculation),
  }));
  const f3 = {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: "completed",
    artifactRoot: "controlled/f1",
    workbook: { fileName: "Anonymous.xlsx", contentHash: F6_FIXTURE_WORKBOOK_HASH },
    worksheets: f3Worksheets,
    ado: { status: "not_requested" },
    summary: {
      worksheetCount: f3Worksheets.length,
      factorCount: f3Worksheets.length,
      completeCount: f3Worksheets.length,
      governanceRequiredCount: 0,
      duplicateConflictCount: 0,
    },
  };
  const f5Request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: F6_FIXTURE_WORKBOOK_HASH },
    knowledgeBaseVersion: "interpretation-rules-v1",
    worksheets: calculations.map((calculation, index) => ({
      worksheetName: calculation.worksheetSelection.worksheetName,
      imageReference: f3Worksheets[index].rows[0].imageReference,
      governanceRows: f3Worksheets[index].rows,
      calculationResult: calculation,
      imageObservations: [],
    })),
  };
  const f5 = createF5DataInterpretation(f5Request);
  const paths = {
    f2: path.join(f2ArtifactRoot, "Feature2-Report.json"),
    f3: path.join(f3ArtifactRoot, "Feature3-Report.json"),
    f4: path.join(f4ArtifactRoot, "Feature4-Calculation.json"),
    f5: path.join(f5ArtifactRoot, "Feature5-Report.json"),
  };
  writeFixtureJson(paths.f2, f2);
  writeFixtureJson(paths.f3, f3);
  writeFixtureJson(paths.f4, f4);
  writeFixtureJson(paths.f5, f5);

  return {
    root,
    publishRoot,
    f2ArtifactRoot,
    f3ArtifactRoot,
    f4ArtifactRoot,
    f5ArtifactRoot,
    selectedWorksheetNames: worksheetNames,
    paths,
    calculations,
    f3Worksheets,
  };
}

export function createF6V2ObservationArtifact(bundle) {
  const f2 = readFixtureJson(bundle.paths.f2);
  const f3 = readFixtureJson(bundle.paths.f3);
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    observationVersion: "f5-image-observation-v2",
    workbookContentHash: F6_FIXTURE_WORKBOOK_HASH,
    worksheets: bundle.selectedWorksheetNames.map((worksheetName) => {
      const f2Worksheet = f2.worksheets.find((worksheet) => worksheet.worksheetName === worksheetName);
      const f3Worksheet = f3.worksheets.find((worksheet) => worksheet.worksheetName === worksheetName);
      return {
        worksheetName,
        imageReference: f3Worksheet.rows[0].imageReference,
        contextSnapshot: {
          dimensionDescription: f3Worksheet.toleranceLoopDescription,
          rows: f3Worksheet.rows.map((row) => {
            const f2Row = f2Worksheet.rows.find(({ tableId, sourceRow }) =>
              tableId === row.source.tableId && sourceRow === row.source.sourceRow);
            return {
              tableId: row.source.tableId,
              sourceRow: row.source.sourceRow,
              partName: f2Row.actualFields.partName,
              partSubsystem: row.partSubsystem,
              partCategory: row.partCategory,
              factorName: f2Row.actualFields.factorName,
              factorDescription: row.factorDescription,
              nominal: row.nominal,
              upperTolerance: row.upperTolerance,
              lowerTolerance: row.lowerTolerance,
              sigmaLevel: row.sigmaLevel,
              sourceCells: row.source.sourceCells,
            };
          }),
        },
        observations: CORE_SCOPES.map((scope) => ({
          scope,
          visualObservation: {
            observedValue: "ambiguous",
            confidence: "low",
            visibleBasis: `Visible basis for ${scope}.`,
            visibleLabels: [],
            reviewStatus: "unreviewed",
          },
          contextualSignal: {
            signalValue: "insufficient_evidence",
            textBasis: `Context basis for ${scope}.`,
            linkedSourceRows: [],
            linkedVisualLabels: [],
            requiresEngineeringReview: true,
          },
        })),
      };
    }),
  };
}

export function installF6V2Evidence(bundle) {
  const evidenceParent = path.join(bundle.publishRoot, "inputs");
  mkdirSync(evidenceParent, { recursive: true });
  const evidenceArtifactRoot = mkdtempSync(path.join(evidenceParent, "evidence-"));
  const imageObservationArtifact = "observations.json";
  const artifact = createF6V2ObservationArtifact(bundle);
  writeFixtureJson(path.join(evidenceArtifactRoot, imageObservationArtifact), artifact);
  const f5 = createF5DataInterpretation({
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
  });
  writeFixtureJson(bundle.paths.f5, f5);
  Object.assign(bundle, { evidenceArtifactRoot, imageObservationArtifact });
  return { artifact, evidenceArtifactRoot, imageObservationArtifact };
}