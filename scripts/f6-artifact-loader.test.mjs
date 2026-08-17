import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createCalculation } from "../packages/workbook-catalog/dist/calculation.js";
import { createF5DataInterpretation } from "../packages/workbook-catalog/dist/f5-data-interpretation.js";
import {
  createCalculationRequestFromF4Handoff,
  createF4Handoff,
} from "../packages/workbook-catalog/dist/f4-handoff.js";
import { loadF6ArtifactBundle } from "./f6-artifact-loader.mjs";

const roots = [];
const WORKBOOK_HASH = "a".repeat(64);
const IMAGE_HASH = "b".repeat(64);
const RUN_ID = "f4-run-1";

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

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

function actualFields(worksheetName) {
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
  };
}

function systemSpecification(worksheetName) {
  return {
    status: "available",
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
  };
}

function readyWorksheet(worksheetName, tableId, sourceRow) {
  return {
    worksheetName,
    toleranceLoopDescription: `Loop ${worksheetName}`,
    status: "ready",
    tolerancePathImageStatus: "available",
    systemSpecification: systemSpecification(worksheetName),
    systemSpecificationIssues: [],
    rows: [{
      worksheetName,
      tableId,
      sourceRow,
      actualFields: actualFields(worksheetName),
      sourceCells: sourceCells(worksheetName, sourceRow),
      missingRequiredFields: [],
      missingIdentifiers: [],
      capabilityStatus: "non_f0_process_category",
      adoReminderRequested: false,
    }],
    missingFieldSummary: [],
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

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function setupBundle({ worksheetNames = ["Analysis-A"], blockedWorksheetNames = [] } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "f6-loader-"));
  roots.push(root);
  const f2ArtifactRoot = path.join(root, "f2");
  const f3ArtifactRoot = path.join(root, "f3");
  const f4ArtifactRoot = path.join(root, "f4");
  const f5ArtifactRoot = path.join(root, "f5");

  const worksheets = worksheetNames.map((worksheetName, index) =>
    readyWorksheet(worksheetName, `table-${index + 1}`, index + 2));
  const blockedWorksheets = blockedWorksheetNames.map((worksheetName, index) => ({
    ...readyWorksheet(worksheetName, `blocked-table-${index + 1}`, index + 20),
    status: "blocked",
    tolerancePathImageStatus: "unavailable",
  }));
  const handoffs = worksheets.map((worksheet) => createF4Handoff({
    workbookContentHash: WORKBOOK_HASH,
    worksheet,
  }));
  const calculations = handoffs.map((handoff) => createCalculation(
    createCalculationRequestFromF4Handoff({
      handoff,
      projectReference: `f4-${WORKBOOK_HASH.slice(0, 16)}`,
      runReference: RUN_ID,
      criticality: "none",
    }),
  ));
  if (calculations.some(({ status }) => status !== "completed")) throw new Error("fixture calculation failed");

  const f2 = {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: blockedWorksheets.length === 0 ? "completed" : "partiallyBlocked",
    workbook: { fileName: "Anonymous.xlsx", contentHash: WORKBOOK_HASH, f1GeneratedAt: "2026-08-17T00:00:00.000Z" },
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
    workbook: { fileName: "Anonymous.xlsx", contentHash: WORKBOOK_HASH },
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
  const f4 = {
    contractVersion: "v1",
    workflowVersion: "f4-f2-v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    runId: RUN_ID,
    generatedAt: "2026-08-17T00:01:00.000Z",
    source: { artifactReference: "Feature2-Report.json", workbookFileName: "Anonymous.xlsx", workbookContentHash: WORKBOOK_HASH },
    calculations,
    summary: { selectedWorksheetCount: calculations.length, completedWorksheetCount: calculations.length },
  };
  const f5Request = {
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: WORKBOOK_HASH },
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
  writeJson(paths.f2, f2);
  writeJson(paths.f3, f3);
  writeJson(paths.f4, f4);
  writeJson(paths.f5, f5);

  return {
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

describe("loadF6ArtifactBundle", () => {
  it("accepts an all-ready governed bundle and preserves the validated F4 baseline request", () => {
    const bundle = setupBundle();

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.blockedWorksheets).toEqual([]);
    expect(result.request.selectedWorksheetNames).toEqual(["Analysis-A"]);
    expect(result.request.f0Versions).toEqual({
      knowledgeBaseVersion: "v1",
      capabilityVersion: "internal-v1",
      interpretationVersion: "interpretation-rules-v1",
    });
    expect(result.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(result.request.worksheets[0].baselineCalculationRequest.runReference).toBe(RUN_ID);
    expect(createCalculation(result.request.worksheets[0].baselineCalculationRequest)).toEqual(
      result.request.worksheets[0].baselineCalculation,
    );
    expect(result.sourceReferences).toEqual({
      f2: { artifact: "Feature2-Report.json", contentHash: sha256(bundle.paths.f2) },
      f3: { artifact: "Feature3-Report.json", contentHash: sha256(bundle.paths.f3) },
      f4: { artifact: "Feature4-Calculation.json", contentHash: sha256(bundle.paths.f4), runId: RUN_ID, calculationVersion: "excel-ta-v1" },
      f5: { artifact: "Feature5-Report.json", contentHash: sha256(bundle.paths.f5), interpretationVersion: "f5-data-interpretation-v1" },
    });
    expect(JSON.stringify(result)).not.toContain(rootPath(bundle));
  });
});

function rootPath(bundle) {
  return path.dirname(bundle.f2ArtifactRoot);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function rewriteJson(filePath, mutate) {
  const value = readJson(filePath);
  mutate(value);
  writeJson(filePath, value);
}

function expectRejected(result, reasonCode, artifactReference) {
  expect(result).toEqual({ status: "inputRejected", reasonCode, artifactReference });
  expect(JSON.stringify(result)).not.toMatch(/[A-Za-z]:[\\/]/);
}

describe("F6 governed bundle validation", () => {
  it("returns F2 blocked worksheets only as validation records", () => {
    const bundle = setupBundle({ blockedWorksheetNames: ["Blocked-A"] });

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.request.selectedWorksheetNames).toEqual(["Analysis-A"]);
    expect(result.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(result.blockedWorksheets).toEqual([{
      worksheetName: "Blocked-A",
      findings: expect.arrayContaining([expect.objectContaining({
        severity: "Critical",
        evidenceReferences: [result.sourceReferences.f2],
      })]),
    }]);
  });

  it("preserves explicit selected worksheet order", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A", "Analysis-B"] });
    bundle.selectedWorksheetNames = ["Analysis-B", "Analysis-A"];

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.request.selectedWorksheetNames).toEqual(bundle.selectedWorksheetNames);
    expect(result.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(bundle.selectedWorksheetNames);
  });

  it.each([
    [[], "empty"],
    [["Analysis-A", "Analysis-A"], "duplicate"],
    [["Unknown"], "unknown"],
  ])("rejects %s worksheet selection", (selectedWorksheetNames) => {
    const bundle = setupBundle();
    bundle.selectedWorksheetNames = selectedWorksheetNames;

    expectRejected(loadF6ArtifactBundle(bundle), "worksheet_selection_invalid", "selectedWorksheetNames");
  });

  it("rejects selecting an F2 blocked worksheet", () => {
    const bundle = setupBundle({ blockedWorksheetNames: ["Blocked-A"] });
    bundle.selectedWorksheetNames = ["Blocked-A"];

    expectRejected(loadF6ArtifactBundle(bundle), "worksheet_selection_invalid", "selectedWorksheetNames");
  });

  it.each([
    ["f2ArtifactRoot", "f2", "Feature2-Report.json"],
    ["f3ArtifactRoot", "f3", "Feature3-Report.json"],
    ["f4ArtifactRoot", "f4", "Feature4-Calculation.json"],
    ["f5ArtifactRoot", "f5", "Feature5-Report.json"],
  ])("rejects missing %s artifact", (rootField, pathKey, artifactReference) => {
    const bundle = setupBundle();
    rmSync(bundle.paths[pathKey]);

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_missing", artifactReference);
  });

  it.each([
    ["f2", "Feature2-Report.json"],
    ["f3", "Feature3-Report.json"],
    ["f4", "Feature4-Calculation.json"],
    ["f5", "Feature5-Report.json"],
  ])("rejects malformed %s JSON", (pathKey, artifactReference) => {
    const bundle = setupBundle();
    writeFileSync(bundle.paths[pathKey], "{", "utf8");

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_contract_invalid", artifactReference);
  });

  it("rejects workbook identity drift across roots", () => {
    const bundle = setupBundle();
    rewriteJson(bundle.paths.f3, (report) => { report.workbook.contentHash = "c".repeat(64); });

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", "Feature2-Report.json");
  });

  it("rejects a partial or other F4 run", () => {
    const bundle = setupBundle();
    rewriteJson(bundle.paths.f4, (report) => { report.runId = "other-run"; });

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", "worksheet:Analysis-A");
  });

  it("rejects F3 governance rows that differ from F5", () => {
    const bundle = setupBundle();
    rewriteJson(bundle.paths.f3, (report) => { report.worksheets[0].rows[0].drawingNumber = "DRAW-OTHER"; });

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", "worksheet:Analysis-A");
  });

  it("rejects F2 handoff table identity drift", () => {
    const bundle = setupBundle();
    rewriteJson(bundle.paths.f2, (report) => { report.f4Handoffs[0].factors[0].tableId = "other-table"; });

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", "worksheet:Analysis-A");
  });

  it("rejects F2 worksheet row sets that differ from the governed handoff", () => {
    const bundle = setupBundle();
    rewriteJson(bundle.paths.f2, (report) => { report.worksheets[0].rows[0].sourceRow = 99; });

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", "worksheet:Analysis-A");
  });

  it("rejects an F2 tolerance-loop description that differs from the governed handoff", () => {
    const bundle = setupBundle();
    rewriteJson(bundle.paths.f2, (report) => { report.worksheets[0].toleranceLoopDescription = "Other loop"; });

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", "worksheet:Analysis-A");
  });

  it("rejects an F2 system specification that differs from the governed handoff", () => {
    const bundle = setupBundle();
    rewriteJson(bundle.paths.f2, (report) => {
      report.worksheets[0].systemSpecification.lowerSpecLimit.actualValue = -2;
    });

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", "worksheet:Analysis-A");
  });

  it("rejects an F5 calculation result that differs from F4", () => {
    const bundle = setupBundle();
    rewriteJson(bundle.paths.f5, (report) => {
      report.worksheets[0].calculationResult.projectReference = "other-project";
    });

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", "worksheet:Analysis-A");
  });

  it("rejects a partially completed F5 artifact", () => {
    const bundle = setupBundle();
    rewriteJson(bundle.paths.f5, (report) => {
      report.status = "partially_completed";
      report.worksheets.push({
        worksheetName: "Analysis-B",
        status: "input_rejected",
        reasonCode: "artifact_identity_mismatch",
        artifactReference: "worksheet:Analysis-B",
      });
      report.summary.worksheetCount += 1;
      report.summary.inputRejectedWorksheetCount += 1;
    });

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_contract_invalid", "Feature5-Report.json");
  });
});

const CORE_SCOPES = [
  "tolerance_loop_closure",
  "datum_chain",
  "assembly_datum_face",
  "stack_start",
  "direction",
];

function createV2ObservationArtifact(bundle) {
  const f2 = readJson(bundle.paths.f2);
  const f3 = readJson(bundle.paths.f3);
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    observationVersion: "f5-image-observation-v2",
    workbookContentHash: WORKBOOK_HASH,
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

function installV2Evidence(bundle) {
  const artifact = createV2ObservationArtifact(bundle);
  const imageObservationArtifact = path.join(rootPath(bundle), "evidence", "observations.json");
  writeJson(imageObservationArtifact, artifact);
  const f5 = createF5DataInterpretation({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: WORKBOOK_HASH },
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
  writeJson(bundle.paths.f5, f5);
  bundle.imageObservationArtifact = imageObservationArtifact;
  return artifact;
}

function writeOptional(bundle, fileName, value) {
  const filePath = path.join(rootPath(bundle), "evidence", fileName);
  writeJson(filePath, value);
  return filePath;
}

describe("F6 optional governed evidence", () => {
  it("accepts missing optional evidence as absent", () => {
    const result = loadF6ArtifactBundle(setupBundle());

    expect(result.status).toBe("accepted");
    expect(result.request).not.toHaveProperty("imageObservationReference");
    expect(result.request).not.toHaveProperty("supplierCapabilityEvidence");
    expect(result.request).not.toHaveProperty("datumEvidence");
    expect(result.request).not.toHaveProperty("costEvidence");
  });

  it("accepts exact F5 v2 evidence without promoting ambiguous unreviewed observations", () => {
    const bundle = setupBundle();
    const artifact = installV2Evidence(bundle);

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.request.imageObservationReference).toEqual({
      artifact: "observations.json",
      contentHash: sha256(bundle.imageObservationArtifact),
    });
    expect(result.request.worksheets[0].f5Worksheet.observationVersion).toBe("f5-image-observation-v2");
    expect(artifact.worksheets[0].observations.every(({ visualObservation }) =>
      visualObservation.reviewStatus === "unreviewed")).toBe(true);
  });

  it("rejects supplied F5 v2 evidence that does not exactly match the F5 report", () => {
    const bundle = setupBundle();
    installV2Evidence(bundle);
    rewriteJson(bundle.imageObservationArtifact, (artifact) => {
      artifact.worksheets[0].contextSnapshot.dimensionDescription = "Other loop";
    });

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", "observations.json");
  });

  it.each([
    ["imageObservationArtifact"],
    ["supplierCapabilityArtifact"],
    ["datumStrategyArtifact"],
    ["costArtifact"],
  ])("rejects an explicitly supplied missing %s", (field) => {
    const bundle = setupBundle();
    bundle[field] = path.join(rootPath(bundle), "evidence", `${field}.json`);

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_missing", `${field}.json`);
  });

  it.each([
    ["imageObservationArtifact"],
    ["supplierCapabilityArtifact"],
    ["datumStrategyArtifact"],
    ["costArtifact"],
  ])("rejects malformed supplied %s", (field) => {
    const bundle = setupBundle();
    bundle[field] = path.join(rootPath(bundle), "evidence", `${field}.json`);
    mkdirSync(path.dirname(bundle[field]), { recursive: true });
    writeFileSync(bundle[field], "{", "utf8");

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_contract_invalid", `${field}.json`);
  });

  it("loads strict supplier evidence but does not guess row bindings", () => {
    const bundle = setupBundle();
    const evidence = {
      evidenceVersion: "supplier-capability-v1",
      supplierReference: "supplier-a",
      processFamily: "cnc",
      partCategory: "CNC",
      capabilityTier: "T1",
      achievableToleranceBand: 0.3,
      distribution: "normal",
      source: "supplier.json",
      effectiveVersion: "2026-Q3",
      contentHash: "c".repeat(64),
    };
    bundle.supplierCapabilityArtifact = writeOptional(bundle, evidence.source, evidence);

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.request.supplierCapabilityEvidence).toEqual([evidence]);
    expect(result.request.worksheets[0].supplierBindings).toEqual([]);
  });

  it("loads strict datum evidence bound to existing selected source rows", () => {
    const bundle = setupBundle();
    const evidence = {
      evidenceVersion: "datum-strategy-v1",
      worksheetName: "Analysis-A",
      datumFace: "A",
      stackStart: "A",
      factorDirections: [{ tableId: "table-1", sourceRow: 2, direction: 1 }],
      datumChainEdges: [{ from: "A", to: "B" }],
      crossSubsystemRelations: [],
      drawingEvidence: ["drawing-a.pdf"],
      reviewStatus: "confirmed",
      source: "datum.json",
      effectiveVersion: "v1",
      contentHash: "d".repeat(64),
    };
    bundle.datumStrategyArtifact = writeOptional(bundle, evidence.source, evidence);

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.request.datumEvidence).toEqual([evidence]);
  });

  it("loads cost evidence only when its ROI reference matches F4", () => {
    const bundle = setupBundle();
    const evidence = {
      evidenceVersion: "cost-model-v1",
      model: "relative-cost",
      unit: "index",
      optionCosts: [{ optionKind: "reduce_top_contributor_20", cost: 1 }],
      roiPolicyVersion: "f6-delta-cpk-per-cost-v1",
      roiCalculationReference: { artifact: "Feature4-Calculation.json", contentHash: sha256(bundle.paths.f4) },
      source: "cost.json",
      effectiveVersion: "v1",
      contentHash: "e".repeat(64),
    };
    bundle.costArtifact = writeOptional(bundle, evidence.source, evidence);

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.request.costEvidence).toEqual(evidence);
  });

  it("rejects governed evidence whose source basename or ROI reference drifts", () => {
    const supplierBundle = setupBundle();
    supplierBundle.supplierCapabilityArtifact = writeOptional(supplierBundle, "supplier-file.json", {
      evidenceVersion: "supplier-capability-v1", supplierReference: "supplier-a", processFamily: "cnc",
      partCategory: "CNC", capabilityTier: "T1", achievableToleranceBand: 0.3, distribution: "normal",
      source: "other.json", effectiveVersion: "v1", contentHash: "c".repeat(64),
    });
    expectRejected(loadF6ArtifactBundle(supplierBundle), "artifact_identity_mismatch", "supplier-file.json");

    const costBundle = setupBundle();
    costBundle.costArtifact = writeOptional(costBundle, "cost.json", {
      evidenceVersion: "cost-model-v1", model: "relative", unit: "index",
      optionCosts: [{ optionKind: "reduce_top_contributor_20", cost: 1 }],
      roiPolicyVersion: "f6-delta-cpk-per-cost-v1",
      roiCalculationReference: { artifact: "Feature4-Calculation.json", contentHash: "f".repeat(64) },
      source: "cost.json", effectiveVersion: "v1", contentHash: "e".repeat(64),
    });
    expectRejected(loadF6ArtifactBundle(costBundle), "artifact_identity_mismatch", "cost.json");
  });

  it.each([
    ["supplierCapabilityArtifact", { evidenceVersion: "wrong" }],
    ["datumStrategyArtifact", { evidenceVersion: "wrong" }],
    ["costArtifact", { evidenceVersion: "wrong" }],
  ])("rejects schema-invalid %s", (field, evidence) => {
    const bundle = setupBundle();
    bundle[field] = writeOptional(bundle, `${field}.json`, evidence);

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_contract_invalid", `${field}.json`);
  });

  it("rejects datum evidence bound to an unknown worksheet source", () => {
    const bundle = setupBundle();
    const evidence = {
      evidenceVersion: "datum-strategy-v1", worksheetName: "Analysis-A", datumFace: "A", stackStart: "A",
      factorDirections: [{ tableId: "table-1", sourceRow: 99, direction: 1 }],
      datumChainEdges: [{ from: "A", to: "B" }], crossSubsystemRelations: [], drawingEvidence: ["drawing-a.pdf"],
      reviewStatus: "confirmed", source: "datum.json", effectiveVersion: "v1", contentHash: "d".repeat(64),
    };
    bundle.datumStrategyArtifact = writeOptional(bundle, evidence.source, evidence);

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", "datum.json");
  });

  it("rejects optional path traversal and a root artifact symlink outside its root", () => {
    const traversalBundle = setupBundle();
    traversalBundle.costArtifact = `${rootPath(traversalBundle)}${path.sep}evidence${path.sep}..${path.sep}cost.json`;
    expectRejected(loadF6ArtifactBundle(traversalBundle), "artifact_identity_mismatch", "cost.json");

    const symlinkBundle = setupBundle();
    const outside = path.join(rootPath(symlinkBundle), "outside-f2");
    mkdirSync(outside);
    writeFileSync(path.join(outside, "Feature2-Report.json"), readFileSync(symlinkBundle.paths.f2));
    rmSync(symlinkBundle.f2ArtifactRoot, { recursive: true });
    symlinkSync(outside, symlinkBundle.f2ArtifactRoot, "junction");
    expectRejected(loadF6ArtifactBundle(symlinkBundle), "artifact_identity_mismatch", "Feature2-Report.json");
  });
});