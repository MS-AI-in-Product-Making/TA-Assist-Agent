import { afterEach, describe, expect, it } from "vitest";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { f5DataInterpretationRequestSchema } from "../packages/contracts/dist/contracts.js";
import { loadF5ArtifactBundle } from "./f5-artifact-loader.mjs";

const tempRoots = [];
const WORKBOOK_HASH = "a".repeat(64);

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function calculation(worksheetName, tableId, workbookContentHash = WORKBOOK_HASH) {
  return {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    calculationVersion: "excel-ta-v1",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    workbookContentHash,
    worksheetSelection: { worksheetName, tableId },
    factorCount: 1,
    recommendation: {
      method: "worst_case",
      reason: "factor_count_1_to_3",
      refer3d: false,
      criticality: "none",
      criticalityRisk: false,
    },
    factors: [{
      factorName: `Feature-${worksheetName}`,
      unit: "mm",
      source: { worksheetName, tableId, sourceRow: 2 },
      input: {
        nominalValue: 12.45,
        upperTolerance: 0.2,
        lowerTolerance: -0.2,
        longTermSafetyFactor: 1,
        sigmaLevel: 4,
        distribution: "normal",
      },
      mean: 12.46,
      halfTolerance: 0.2,
      sigma: 0.05,
      contribution: 1,
      trace: {
        formulaIds: ["factor-mean-v1", "factor-sigma-v1"],
        sourceCells: [`${worksheetName}!A2`, `${worksheetName}!B2`],
      },
    }],
    system: {
      designNominal: 12.5,
      mean: 12.46,
      additionalMeanShift: 0,
      worstCaseUpper: 0.2,
      worstCaseLower: -0.2,
      rssSigma: 0.05,
    },
    capability: {
      lowerSpecLimit: 12.1,
      upperSpecLimit: 12.9,
      targetSigmaLevel: 4,
      targetCpk: 1.33,
      cp: 2.6666666666666665,
      lowerCpk: 2.4,
      upperCpk: 2.933333333333333,
      cpk: 2.4,
      lowerZ: 7.2,
      upperZ: 8.8,
      lowerDpm: 0.1,
      upperDpm: 0.2,
      totalDpm: 0.30000000000000004,
      outOfSpecRatio: 3.0000000000000004e-7,
      yield: 0.9999997,
      status: "PASS",
    },
    traceRecords: [{
      outputField: "capability.cpk",
      formulaVersion: "excel-ta-v1",
      formulaId: "cpk-v1",
      sourceCells: ["capability.lowerCpk", "capability.upperCpk"],
    }],
    scenarios: [],
  };
}

function actualFields() {
  return {
    factorName: "Feature-Analysis-A",
    partName: "Anonymous bracket",
    drawingNumber: "DRAW-100",
    dimCharacteristicId: "307",
    partCategory: "CNC",
    nominalValue: 12.45,
    upperTolerance: 0.2,
    lowerTolerance: -0.2,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "Normal",
    mean: 12.46,
    tolerance: 0.2,
    oneSigma: 0.05,
    percentContributionToSigma: 1,
    notes: null,
  };
}

function systemSpecification() {
  return {
    status: "available",
    designNominal: { status: "available", actualValue: 12.5, displayValue: "12.5", sourceLabel: "*Design Nominal ►", sourceCell: "Analysis-A!P53", valueOrigin: "numeric_literal" },
    lowerSpecLimit: { status: "available", actualValue: 12.1, displayValue: "12.1", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Analysis-A!P54", valueOrigin: "numeric_literal" },
    upperSpecLimit: { status: "available", actualValue: 12.9, displayValue: "12.9", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Analysis-A!P55", valueOrigin: "numeric_literal" },
    targetSigmaLevel: { status: "available", actualValue: 4, displayValue: "4", sourceLabel: "*Target σ Level ►", sourceCell: "Analysis-A!P56", valueOrigin: "numeric_literal" },
    additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
  };
}

function governanceRow(worksheetName, tableId, imageReference) {
  return {
    factorInstanceId: createHash("sha256").update(`${worksheetName}-factor`).digest("hex"),
    drawingDimensionKey: createHash("sha256").update(`${worksheetName}-dimension`).digest("hex"),
    deviceLevelDim: worksheetName,
    dimensionDescription: `Tolerance loop ${worksheetName}`,
    partCategory: "CNC",
    partSubsystem: "Anonymous bracket",
    drawingNumber: "DRAW-100",
    dimId: "307",
    factorDescription: `Feature-${worksheetName}`,
    nominal: 12.45,
    upperTolerance: 0.2,
    lowerTolerance: -0.2,
    sigmaLevel: 4,
    dimIdStatus: "valid",
    qualitySignals: [],
    governanceStatus: "complete",
    imageReference,
    source: {
      worksheetName,
      tableId,
      sourceRow: 2,
      sourceCells: {
        factorName: `${worksheetName}!A2`,
        partName: `${worksheetName}!B2`,
      },
    },
  };
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value), "utf8");
}

function setupBundle({ worksheetNames = ["Analysis-A", "Analysis-B"], artifactContractVersion } = {}) {
  const base = mkdtempSync(path.join(tmpdir(), "f5-loader-"));
  tempRoots.push(base);
  const f1ArtifactRoot = path.join(base, "f1");
  const f3ArtifactRoot = path.join(base, "f3");
  const f4ArtifactRoot = path.join(base, "f4");
  mkdirSync(f1ArtifactRoot, { recursive: true });
  mkdirSync(f3ArtifactRoot, { recursive: true });
  mkdirSync(f4ArtifactRoot, { recursive: true });

  const sheetIndexes = [];
  const governanceWorksheets = [];
  const calculations = [];
  const imageReferences = new Map();
  for (const [index, worksheetName] of worksheetNames.entries()) {
    const tableId = `table-${index + 1}`;
    const imageBytes = Buffer.from(`controlled-image-${worksheetName}`);
    const imageHash = createHash("sha256").update(imageBytes).digest("hex");
    const worksheetRelative = `sheets/anonymous.xlsx/json/${worksheetName}.json`;
    const markdownRelative = `sheets/anonymous.xlsx/md/${worksheetName}.md`;
    const imageRelative = `sheets/anonymous.xlsx/images/${worksheetName}.png`;
    const imageReference = { artifact: "f1", relativePath: imageRelative, contentHash: imageHash, worksheetName };
    imageReferences.set(worksheetName, imageReference);
    mkdirSync(path.dirname(path.join(f1ArtifactRoot, imageRelative)), { recursive: true });
    mkdirSync(path.dirname(path.join(f1ArtifactRoot, markdownRelative)), { recursive: true });
    writeFileSync(path.join(f1ArtifactRoot, imageRelative), imageBytes);
    writeFileSync(path.join(f1ArtifactRoot, markdownRelative), `# ${worksheetName}\n`);
    writeJson(path.join(f1ArtifactRoot, worksheetRelative), {
      taskId: "1.5-1.6",
      generatedAt: "2026-08-11T00:00:00.000Z",
      workbook: { fileName: "anonymous.xlsx", contentHash: WORKBOOK_HASH },
      worksheetName,
      toleranceLoopDescription: `Tolerance loop ${worksheetName}`,
      ...(new Set(["f1-semantic-v2", "f1-semantic-v3"]).has(artifactContractVersion)
        ? { systemSpecification: systemSpecification() }
        : {}),
      factorTables: [{
        tableId,
        headerRow: 1,
        dataRange: { startRow: 2, endRow: 2 },
        columns: [],
        rows: [{
          sourceRow: 2,
          fields: {},
          actualFields: {
            ...actualFields(),
            factorName: `Feature-${worksheetName}`,
          },
        }],
      }],
      imageAssets: [{ contentHash: imageHash, mediaType: "image/png", byteLength: imageBytes.length, outputFile: imageRelative }],
      tolerancePathImage: {
        status: "available",
        labelSourceCell: `${worksheetName}!A55`,
        imageContentHash: imageHash,
        imageAnchor: { from: "A56", to: "K71" },
      },
    });
    sheetIndexes.push({ worksheetName, jsonPath: worksheetRelative, mdPath: markdownRelative });
    governanceWorksheets.push({
      worksheetName,
      toleranceLoopDescription: `Tolerance loop ${worksheetName}`,
      rows: [governanceRow(worksheetName, tableId, imageReference)],
    });
    calculations.push(calculation(worksheetName, tableId));
  }

  writeJson(path.join(f1ArtifactRoot, "Feature1-Report.json"), {
    contractVersion: "v1",
    ...(artifactContractVersion ? { artifactContractVersion } : {}),
    feature: "F1",
    generatedAt: "2026-08-11T00:00:00.000Z",
    workbooks: [{
      workbook: { fileName: "anonymous.xlsx", contentHash: WORKBOOK_HASH },
      task15_factor_table_and_debug_json: {
        sheets: sheetIndexes.map(({ worksheetName, jsonPath }) => ({ worksheetName, jsonPath })),
      },
      task16_loop_screenshot_and_run_record: {
        sheets: sheetIndexes.map(({ worksheetName, mdPath }) => ({ worksheetName, mdPath })),
      },
      sheetReadmePath: "sheets/anonymous.xlsx/README.md",
    }],
  });
  writeJson(path.join(f3ArtifactRoot, "Feature3-Report.json"), {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: "completed",
    artifactRoot: "controlled/f1",
    workbook: { fileName: "anonymous.xlsx", contentHash: WORKBOOK_HASH },
    worksheets: governanceWorksheets,
    ado: { status: "not_requested" },
    summary: {
      worksheetCount: worksheetNames.length,
      factorCount: worksheetNames.length,
      completeCount: worksheetNames.length,
      governanceRequiredCount: 0,
      duplicateConflictCount: 0,
    },
  });
  writeJson(path.join(f4ArtifactRoot, "Feature4-Calculation.json"), {
    contractVersion: "v1",
    workflowVersion: "f4-f2-v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    runId: "controlled-run-reference",
    generatedAt: "2026-08-11T00:00:00.000Z",
    source: {
      artifactReference: "Feature2-Report.json",
      workbookFileName: "anonymous.xlsx",
      workbookContentHash: WORKBOOK_HASH,
    },
    calculations,
    summary: { selectedWorksheetCount: calculations.length, completedWorksheetCount: calculations.length },
  });
  return { base, f1ArtifactRoot, f3ArtifactRoot, f4ArtifactRoot, imageReferences };
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function rewriteJson(filePath, mutate) {
  const value = loadJson(filePath);
  mutate(value);
  writeJson(filePath, value);
}

function addSecondMappedRow(bundle, worksheetName) {
  const f1Path = path.join(bundle.f1ArtifactRoot, `sheets/anonymous.xlsx/json/${worksheetName}.json`);
  rewriteJson(f1Path, (worksheet) => {
    const table = worksheet.factorTables[0];
    table.dataRange.endRow = 3;
    table.rows.unshift({
      sourceRow: 3,
      fields: {},
      actualFields: {
        ...actualFields(),
        factorName: `Feature-${worksheetName}-Second`,
        partName: "Anonymous bracket second",
        partCategory: "Sheet Metal",
        nominalValue: 7.5,
        upperTolerance: 0.1,
        lowerTolerance: -0.15,
        sigmaLevel: 3,
      },
    });
  });

  rewriteJson(path.join(bundle.f3ArtifactRoot, "Feature3-Report.json"), (report) => {
    const worksheet = report.worksheets.find((candidate) => candidate.worksheetName === worksheetName);
    const secondRow = cloneJson(worksheet.rows[0]);
    secondRow.factorInstanceId = createHash("sha256").update(`${worksheetName}-factor-second`).digest("hex");
    secondRow.drawingDimensionKey = createHash("sha256").update(`${worksheetName}-dimension-second`).digest("hex");
    secondRow.partCategory = "Sheet Metal";
    secondRow.partSubsystem = "Anonymous bracket second";
    secondRow.factorDescription = `Feature-${worksheetName}-Second`;
    secondRow.nominal = 7.5;
    secondRow.upperTolerance = 0.1;
    secondRow.lowerTolerance = -0.15;
    secondRow.sigmaLevel = 3;
    secondRow.source.sourceRow = 3;
    secondRow.source.sourceCells = {
      factorName: `${worksheetName}!A3`,
      partName: `${worksheetName}!B3`,
    };
    worksheet.rows.unshift(secondRow);
    report.summary.factorCount += 1;
    report.summary.completeCount += 1;
  });

  rewriteJson(path.join(bundle.f4ArtifactRoot, "Feature4-Calculation.json"), (report) => {
    const result = report.calculations.find(
      (candidate) => candidate.worksheetSelection.worksheetName === worksheetName,
    );
    const secondFactor = cloneJson(result.factors[0]);
    secondFactor.factorName = `Feature-${worksheetName}-Second`;
    secondFactor.source.sourceRow = 3;
    secondFactor.input.nominalValue = 7.5;
    secondFactor.input.upperTolerance = 0.1;
    secondFactor.input.lowerTolerance = -0.15;
    secondFactor.input.sigmaLevel = 3;
    secondFactor.trace.sourceCells = [`${worksheetName}!A3`, `${worksheetName}!B3`];
    result.factors.push(secondFactor);
    result.factorCount = 2;
  });
}

function load(bundle, overrides = {}) {
  return loadF5ArtifactBundle({
    f1ArtifactRoot: bundle.f1ArtifactRoot,
    f3ArtifactRoot: bundle.f3ArtifactRoot,
    f4ArtifactRoot: bundle.f4ArtifactRoot,
    ...overrides,
  });
}

const CORE_SCOPES = [
  "tolerance_loop_closure",
  "datum_chain",
  "assembly_datum_face",
  "stack_start",
  "direction",
];

function v2ObservationArtifact(bundle, worksheetNames = [...bundle.imageReferences.keys()]) {
  const f1Report = loadJson(path.join(bundle.f1ArtifactRoot, "Feature1-Report.json"));
  const f3Report = loadJson(path.join(bundle.f3ArtifactRoot, "Feature3-Report.json"));
  const f1Indexes = new Map(
    f1Report.workbooks[0].task15_factor_table_and_debug_json.sheets
      .map((index) => [index.worksheetName, index]),
  );
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    observationVersion: "f5-image-observation-v2",
    workbookContentHash: WORKBOOK_HASH,
    worksheets: worksheetNames.map((worksheetName) => {
      const f1Worksheet = loadJson(path.join(bundle.f1ArtifactRoot, f1Indexes.get(worksheetName).jsonPath));
      const f3Worksheet = f3Report.worksheets.find((worksheet) => worksheet.worksheetName === worksheetName);
      const tableId = f3Worksheet.rows[0].source.tableId;
      const f1Table = f1Worksheet.factorTables.find((table) => table.tableId === tableId);
      const f1BySourceRow = new Map(f1Table.rows.map((row) => [row.sourceRow, row]));
      return {
        worksheetName,
        imageReference: bundle.imageReferences.get(worksheetName),
        contextSnapshot: {
          dimensionDescription: f3Worksheet.toleranceLoopDescription,
          rows: [...f3Worksheet.rows]
            .sort((left, right) => left.source.sourceRow - right.source.sourceRow)
            .map((row) => {
              const f1Row = f1BySourceRow.get(row.source.sourceRow);
              return {
                tableId: row.source.tableId,
                sourceRow: row.source.sourceRow,
                partName: f1Row.actualFields.partName,
                partSubsystem: row.partSubsystem,
                partCategory: row.partCategory,
                factorName: f1Row.actualFields.factorName,
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

function writeObservationArtifact(bundle, artifact) {
  const observationPath = path.join(bundle.base, "observations.json");
  writeJson(observationPath, artifact);
  return observationPath;
}

function expectRejected(result, reasonCode, artifactReference) {
  expect(result).toEqual({ status: "inputRejected", reasonCode, artifactReference });
  expect(JSON.stringify(result)).not.toMatch(/[A-Z]:\\|f5-loader-/i);
}

describe("loadF5ArtifactBundle", () => {
  it("accepts and validates v3 system specification evidence", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"], artifactContractVersion: "f1-semantic-v3" });

    expect(load(bundle).status).toBe("accepted");

    rewriteJson(path.join(bundle.f1ArtifactRoot, "sheets/anonymous.xlsx/json/Analysis-A.json"), (worksheet) => {
      delete worksheet.systemSpecification.lowerSpecLimit.sourceLabel;
    });

    expectRejected(load(bundle), "artifact_contract_invalid", "worksheet:Analysis-A");
  });

  it("projects only controlled workbook identity fields from historical F1 reports", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    rewriteJson(path.join(bundle.f1ArtifactRoot, "Feature1-Report.json"), (report) => {
      report.workbooks[0].workbook.classification = "confidential";
      report.workbooks[0].workbook.metadata = {
        documentNo: "M1160113",
        revision: "Beta",
      };
    });

    const result = load(bundle, { selectedWorksheetNames: ["Analysis-A"] });

    expect(result.status).toBe("accepted");
    expect(result.request.workbook).toEqual({
      fileName: "anonymous.xlsx",
      contentHash: WORKBOOK_HASH,
    });
  });

  it.each([
    ["F1", "C:\\private\\Demo.xlsx"],
    ["F3", "\\\\server\\share\\Demo.xlsx"],
    ["F4", "/home/private/Demo.xlsx"],
  ])("rejects an unsafe %s workbook fileName as contract-invalid", (artifact, fileName) => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    if (artifact === "F1") {
      rewriteJson(path.join(bundle.f1ArtifactRoot, "Feature1-Report.json"), (report) => {
        report.workbooks[0].workbook.fileName = fileName;
      });
      rewriteJson(path.join(bundle.f1ArtifactRoot, "sheets/anonymous.xlsx/json/Analysis-A.json"), (worksheet) => {
        worksheet.workbook.fileName = fileName;
      });
    } else if (artifact === "F3") {
      rewriteJson(path.join(bundle.f3ArtifactRoot, "Feature3-Report.json"), (report) => {
        report.workbook.fileName = fileName;
      });
    } else {
      rewriteJson(path.join(bundle.f4ArtifactRoot, "Feature4-Calculation.json"), (report) => {
        report.source.workbookFileName = fileName;
      });
    }

    expectRejected(
      load(bundle),
      "artifact_contract_invalid",
      artifact === "F1" ? "Feature1-Report.json" : `Feature${artifact.slice(1)}-${artifact === "F3" ? "Report" : "Calculation"}.json`,
    );
  });

  it("loads an accepted request and reports controlled source references", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    const result = load(bundle);

    expect(result).toMatchObject({
      status: "accepted",
      request: {
        contractVersion: "v1",
        inputClassification: "confidential",
        workbook: { fileName: "anonymous.xlsx", contentHash: WORKBOOK_HASH },
        knowledgeBaseVersion: "interpretation-rules-v1",
        worksheets: [{ worksheetName: "Analysis-A", imageObservations: [] }],
      },
      rejectedWorksheets: [],
      worksheetOrder: ["Analysis-A"],
      sourceReferences: {
        f1: "Feature1-Report.json",
        f3: "Feature3-Report.json",
        f4: "Feature4-Calculation.json",
      },
    });
    expect(f5DataInterpretationRequestSchema.parse(result.request)).toEqual(result.request);
  });

  it("accepts an F3 governance_required report", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    const f3Path = path.join(bundle.f3ArtifactRoot, "Feature3-Report.json");
    rewriteJson(f3Path, (report) => {
      const row = report.worksheets[0].rows[0];
      report.status = "governance_required";
      row.dimIdStatus = "needs_confirmation";
      row.qualitySignals = ["dim_id_needs_confirmation"];
      row.governanceStatus = "needs_governance";
      delete row.drawingDimensionKey;
      report.summary.completeCount = 0;
      report.summary.governanceRequiredCount = 1;
    });

    const result = load(bundle);
    expect(result.status).toBe("accepted");
    expect(result.request.worksheets[0].governanceRows[0].governanceStatus).toBe("needs_governance");
  });

  it("uses F4 order by default and preserves explicit selection order", () => {
    const bundle = setupBundle();

    expect(load(bundle).request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A", "Analysis-B"]);
    expect(load(bundle).worksheetOrder).toEqual(["Analysis-A", "Analysis-B"]);
    const explicitlyOrdered = load(bundle, { selectedWorksheetNames: ["Analysis-B", "Analysis-A"] });
    expect(explicitlyOrdered.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-B", "Analysis-A"]);
    expect(explicitlyOrdered.worksheetOrder).toEqual(["Analysis-B", "Analysis-A"]);
  });

  it.each([
    [[], "empty"],
    [["Analysis-A", "Analysis-A"], "duplicate"],
    [["Unknown"], "unknown"],
  ])("rejects %s worksheet selection", (selectedWorksheetNames) => {
    const bundle = setupBundle();
    expectRejected(load(bundle, { selectedWorksheetNames }), "worksheet_selection_invalid", "selectedWorksheetNames");
  });

  it("isolates selected F4 worksheets missing from F1 or F3", () => {
    const bundle = setupBundle();
    const f1Path = path.join(bundle.f1ArtifactRoot, "Feature1-Report.json");
    rewriteJson(f1Path, (report) => report.workbooks[0].task15_factor_table_and_debug_json.sheets.pop());
    const f1Result = load(bundle);
    expect(f1Result.status).toBe("accepted");
    expect(f1Result.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(f1Result.rejectedWorksheets).toEqual([{
      worksheetName: "Analysis-B",
      reasonCode: "artifact_identity_mismatch",
      artifactReference: "worksheet:Analysis-B",
    }]);

    const second = setupBundle();
    const f3Path = path.join(second.f3ArtifactRoot, "Feature3-Report.json");
    rewriteJson(f3Path, (report) => {
      report.worksheets.pop();
      report.summary.worksheetCount = 1;
      report.summary.factorCount = 1;
      report.summary.completeCount = 1;
    });
    const f3Result = load(second);
    expect(f3Result.status).toBe("accepted");
    expect(f3Result.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(f3Result.rejectedWorksheets).toEqual([{
      worksheetName: "Analysis-B",
      reasonCode: "artifact_identity_mismatch",
      artifactReference: "worksheet:Analysis-B",
    }]);
  });

  it("isolates F1 worksheet errors only when the worksheet is selected", () => {
    const bundle = setupBundle();
    const badWorksheetPath = path.join(bundle.f1ArtifactRoot, "sheets/anonymous.xlsx/json/Analysis-B.json");
    writeFileSync(badWorksheetPath, "{malformed confidential worksheet", "utf8");

    const unselectedResult = load(bundle, { selectedWorksheetNames: ["Analysis-A"] });
    expect(unselectedResult.status).toBe("accepted");
    expect(unselectedResult.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(unselectedResult.rejectedWorksheets).toEqual([]);

    const selectedResult = load(bundle);
    expect(selectedResult.status).toBe("accepted");
    expect(selectedResult.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(selectedResult.rejectedWorksheets).toEqual([{
      worksheetName: "Analysis-B",
      reasonCode: "artifact_contract_invalid",
      artifactReference: "worksheet:Analysis-B",
    }]);

    expectRejected(
      load(bundle, { selectedWorksheetNames: ["Analysis-B"] }),
      "artifact_contract_invalid",
      "worksheet:Analysis-B",
    );
  });

  it.each([
    ["missing", (filePath) => rmSync(filePath), "artifact_missing"],
    ["malformed", (filePath) => writeFileSync(filePath, "{malformed", "utf8"), "artifact_contract_invalid"],
    ["identity", (filePath) => rewriteJson(filePath, (worksheet) => { worksheet.worksheetName = "Other"; }), "artifact_identity_mismatch"],
  ])("preserves an F1 worksheet %s reason on its rejected page", (_kind, corrupt, reasonCode) => {
    const bundle = setupBundle();
    corrupt(path.join(bundle.f1ArtifactRoot, "sheets/anonymous.xlsx/json/Analysis-B.json"));

    const result = load(bundle);
    expect(result.status).toBe("accepted");
    expect(result.rejectedWorksheets).toEqual([{
      worksheetName: "Analysis-B",
      reasonCode,
      artifactReference: "worksheet:Analysis-B",
    }]);
    expect(JSON.stringify(result)).not.toContain(bundle.base);
  });

  it("uses a deterministic reason priority when every selected F1 worksheet fails", () => {
    const bundle = setupBundle({ worksheetNames: ["Missing", "Identity", "Contract"] });
    rmSync(path.join(bundle.f1ArtifactRoot, "sheets/anonymous.xlsx/json/Missing.json"));
    rewriteJson(path.join(bundle.f1ArtifactRoot, "sheets/anonymous.xlsx/json/Identity.json"), (worksheet) => {
      worksheet.workbook.contentHash = "b".repeat(64);
    });
    writeFileSync(path.join(bundle.f1ArtifactRoot, "sheets/anonymous.xlsx/json/Contract.json"), "{malformed", "utf8");

    expectRejected(load(bundle), "artifact_contract_invalid", "worksheet:Contract");
  });

  it("rejects worksheet files that escape F1 through a Windows junction", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    const outside = path.join(bundle.base, "outside");
    const junction = path.join(bundle.f1ArtifactRoot, "linked-outside");
    mkdirSync(outside);
    writeJson(path.join(outside, "escaped.json"), loadJson(path.join(bundle.f1ArtifactRoot, "sheets/anonymous.xlsx/json/Analysis-A.json")));
    symlinkSync(outside, junction, "junction");
    rewriteJson(path.join(bundle.f1ArtifactRoot, "Feature1-Report.json"), (report) => {
      report.workbooks[0].task15_factor_table_and_debug_json.sheets[0].jsonPath = "linked-outside/escaped.json";
    });

    expectRejected(load(bundle), "artifact_identity_mismatch", "worksheet:Analysis-A");
  });

  it.each([
    ["missing", (imagePath) => rmSync(imagePath), "artifact_missing"],
    ["directory", (imagePath) => { rmSync(imagePath); mkdirSync(imagePath); }, "artifact_contract_invalid"],
  ])("contains an F1 image %s read failure as a safe page rejection", (_kind, corrupt, reasonCode) => {
    const bundle = setupBundle();
    const imagePath = path.join(bundle.f1ArtifactRoot, bundle.imageReferences.get("Analysis-B").relativePath);
    corrupt(imagePath);

    const result = load(bundle);
    expect(result.status).toBe("accepted");
    expect(result.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(result.rejectedWorksheets).toEqual([{
      worksheetName: "Analysis-B",
      reasonCode,
      artifactReference: "worksheet:Analysis-B",
    }]);
    expect(JSON.stringify(result)).not.toContain(bundle.base);
  });

  it("contains a broken F1 image link as a safe page rejection", ({ skip }) => {
    const bundle = setupBundle();
    const imagePath = path.join(bundle.f1ArtifactRoot, bundle.imageReferences.get("Analysis-B").relativePath);
    rmSync(imagePath);
    try {
      symlinkSync(path.join(path.dirname(imagePath), "absent.png"), imagePath, "file");
    } catch (error) {
      if (error?.code === "EPERM") skip();
      throw error;
    }

    const result = load(bundle);
    expect(result.status).toBe("accepted");
    expect(result.rejectedWorksheets).toEqual([{
      worksheetName: "Analysis-B",
      reasonCode: "artifact_missing",
      artifactReference: "worksheet:Analysis-B",
    }]);
    expect(JSON.stringify(result)).not.toContain(bundle.base);
  });

  it("contains an F1 image permission failure as a safe page rejection", ({ skip }) => {
    if (process.platform === "win32") skip();
    const bundle = setupBundle();
    const imagePath = path.join(bundle.f1ArtifactRoot, bundle.imageReferences.get("Analysis-B").relativePath);
    chmodSync(imagePath, 0o000);

    const result = load(bundle);
    expect(result.status).toBe("accepted");
    expect(result.rejectedWorksheets).toEqual([{
      worksheetName: "Analysis-B",
      reasonCode: "artifact_contract_invalid",
      artifactReference: "worksheet:Analysis-B",
    }]);
    expect(JSON.stringify(result)).not.toContain(bundle.base);
  });

  it.each(["task15_factor_table_and_debug_json", "task16_loop_screenshot_and_run_record"])(
    "fails closed on duplicate %s worksheet indexes",
    (indexName) => {
      const bundle = setupBundle();
      rewriteJson(path.join(bundle.f1ArtifactRoot, "Feature1-Report.json"), (report) => {
        const indexes = report.workbooks[0][indexName].sheets;
        const duplicate = { ...indexes[0] };
        if (indexName.startsWith("task15")) {
          duplicate.jsonPath = "sheets/anonymous.xlsx/json/Analysis-A-copy.json";
          writeJson(
            path.join(bundle.f1ArtifactRoot, duplicate.jsonPath),
            loadJson(path.join(bundle.f1ArtifactRoot, indexes[0].jsonPath)),
          );
        } else {
          duplicate.mdPath = "sheets/anonymous.xlsx/md/Analysis-A-copy.md";
          writeFileSync(path.join(bundle.f1ArtifactRoot, duplicate.mdPath), "# Analysis-A copy\n", "utf8");
        }
        indexes.push(duplicate);
      });

      const result = load(bundle);
      expect(result.status).toBe("accepted");
      expect(result.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-B"]);
      expect(result.rejectedWorksheets).toEqual([{
        worksheetName: "Analysis-A",
        reasonCode: "artifact_contract_invalid",
        artifactReference: "worksheet:Analysis-A",
      }]);
    },
  );

  it.each([
    ["JSON", "task15_factor_table_and_debug_json", null],
    ["JSON", "task15_factor_table_and_debug_json", "scalar"],
    ["JSON", "task15_factor_table_and_debug_json", 42],
    ["JSON", "task15_factor_table_and_debug_json", []],
    ["JSON", "task15_factor_table_and_debug_json", { jsonPath: "sheets/anonymous.xlsx/json/Analysis-A.json" }],
    ["JSON", "task15_factor_table_and_debug_json", { worksheetName: "Analysis-A" }],
    ["Markdown", "task16_loop_screenshot_and_run_record", null],
    ["Markdown", "task16_loop_screenshot_and_run_record", "scalar"],
    ["Markdown", "task16_loop_screenshot_and_run_record", 42],
    ["Markdown", "task16_loop_screenshot_and_run_record", []],
    ["Markdown", "task16_loop_screenshot_and_run_record", { mdPath: "sheets/anonymous.xlsx/md/Analysis-A.md" }],
    ["Markdown", "task16_loop_screenshot_and_run_record", { worksheetName: "Analysis-A" }],
  ])("rejects a malformed F1 %s index element without throwing", (_kind, indexName, invalidIndex) => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    rewriteJson(path.join(bundle.f1ArtifactRoot, "Feature1-Report.json"), (report) => {
      report.workbooks[0][indexName].sheets[0] = invalidIndex;
    });

    expectRejected(load(bundle), "artifact_contract_invalid", "Feature1-Report.json");
  });

  it("rejects an oversized F1 worksheet index before attempting worksheet reads", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    rewriteJson(path.join(bundle.f1ArtifactRoot, "Feature1-Report.json"), (report) => {
      const indexes = report.workbooks[0].task15_factor_table_and_debug_json.sheets;
      for (let index = 0; index < 1000; index += 1) {
        indexes.push({ worksheetName: `Unused-${index}`, jsonPath: `missing/${index}.json` });
      }
    });

    expectRejected(load(bundle), "artifact_contract_invalid", "Feature1-Report.json");
  });

  it("rejects an oversized JSON artifact before reading it", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    const reportPath = path.join(bundle.f1ArtifactRoot, "Feature1-Report.json");
    const paddingSize = (10 * 1024 * 1024) + 1 - readFileSync(reportPath).length;
    appendFileSync(reportPath, " ".repeat(paddingSize));

    expectRejected(load(bundle), "artifact_contract_invalid", "Feature1-Report.json");
  });

  it("rejects an oversized F1 image before reading it", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    const imagePath = path.join(bundle.f1ArtifactRoot, bundle.imageReferences.get("Analysis-A").relativePath);
    truncateSync(imagePath, (50 * 1024 * 1024) + 1);

    expectRejected(load(bundle), "artifact_contract_invalid", "worksheet:Analysis-A");
  });

  it.each([
    ["F3", "Feature3-Report.json", "f3ArtifactRoot", (report) => { report.workbook.contentHash = "b".repeat(64); }],
    ["F4", "Feature4-Calculation.json", "f4ArtifactRoot", (report) => {
      report.source.workbookContentHash = "b".repeat(64);
      report.calculations[0].workbookContentHash = "b".repeat(64);
    }],
  ])("rejects mismatched F1, %s, and remaining workbook hashes", (_kind, artifactReference, rootKey, mutate) => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    rewriteJson(path.join(bundle[rootKey], artifactReference), mutate);

    expectRejected(load(bundle), "artifact_identity_mismatch", artifactReference);
  });

  it.each([
    ["F3", "Feature3-Report.json", "f3ArtifactRoot", (report) => { report.workbook.fileName = "other.xlsx"; }],
    ["F4", "Feature4-Calculation.json", "f4ArtifactRoot", (report) => { report.source.workbookFileName = "other.xlsx"; }],
  ])("rejects mismatched F1, %s, and remaining workbook file names", (_kind, artifactReference, rootKey, mutate) => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    rewriteJson(path.join(bundle[rootKey], artifactReference), mutate);

    expectRejected(load(bundle), "artifact_identity_mismatch", artifactReference);
  });

  it("isolates an F1 report index whose worksheet JSON names a different worksheet", () => {
    const bundle = setupBundle();
    rewriteJson(path.join(bundle.f1ArtifactRoot, "sheets/anonymous.xlsx/json/Analysis-B.json"), (worksheet) => {
      worksheet.worksheetName = "Other-Worksheet";
    });

    const result = load(bundle);
    expect(result.status).toBe("accepted");
    expect(result.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(result.rejectedWorksheets).toEqual([{
      worksheetName: "Analysis-B",
      reasonCode: "artifact_identity_mismatch",
      artifactReference: "worksheet:Analysis-B",
    }]);
  });

  it.each([
    ["image owner", (worksheet) => { worksheet.tolerancePathImage.labelSourceCell = "Analysis-A!A55"; }],
    ["duplicate image candidate", (worksheet) => { worksheet.imageAssets.push(cloneJson(worksheet.imageAssets[0])); }],
  ])("isolates an F1 %s ambiguity without affecting an unselected worksheet", (_kind, mutate) => {
    const bundle = setupBundle();
    rewriteJson(path.join(bundle.f1ArtifactRoot, "sheets/anonymous.xlsx/json/Analysis-B.json"), mutate);

    const unselectedResult = load(bundle, { selectedWorksheetNames: ["Analysis-A"] });
    expect(unselectedResult.status).toBe("accepted");
    expect(unselectedResult.rejectedWorksheets).toEqual([]);

    const selectedResult = load(bundle);
    expect(selectedResult.status).toBe("accepted");
    expect(selectedResult.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(selectedResult.rejectedWorksheets[0]).toMatchObject({
      worksheetName: "Analysis-B",
      reasonCode: "artifact_identity_mismatch",
    });
  });

  it.each([
    ["path", (row) => { row.imageReference.relativePath = "sheets/anonymous.xlsx/images/other.png"; }],
    ["hash", (row) => { row.imageReference.contentHash = "b".repeat(64); }],
  ])("isolates an F3 image %s mismatch", (_kind, mutate) => {
    const bundle = setupBundle();
    const f3Path = path.join(bundle.f3ArtifactRoot, "Feature3-Report.json");
    rewriteJson(f3Path, (report) => mutate(report.worksheets[1].rows[0]));

    const result = load(bundle);
    expect(result.status).toBe("accepted");
    expect(result.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(result.rejectedWorksheets).toEqual([{ worksheetName: "Analysis-B", reasonCode: "artifact_identity_mismatch", artifactReference: "worksheet:Analysis-B" }]);
  });

  it("isolates an F1 image content hash mismatch", () => {
    const bundle = setupBundle();
    writeFileSync(
      path.join(bundle.f1ArtifactRoot, bundle.imageReferences.get("Analysis-B").relativePath),
      Buffer.from("tampered-controlled-image"),
    );

    const result = load(bundle);
    expect(result.status).toBe("accepted");
    expect(result.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(result.rejectedWorksheets).toEqual([{ worksheetName: "Analysis-B", reasonCode: "artifact_identity_mismatch", artifactReference: "worksheet:Analysis-B" }]);
  });

  it.each([
    ["F4 table", (f3, f4) => { f4.calculations[1].worksheetSelection.tableId = "other-table"; f4.calculations[1].factors[0].source.tableId = "other-table"; }],
    ["F4 factor source", (f3, f4) => { f4.calculations[1].factors[0].source.sourceRow = 3; }],
    ["missing governance source", (f3) => { f3.worksheets[1].rows = []; f3.summary.factorCount = 1; f3.summary.completeCount = 1; }],
    ["extra governance source", (f3) => {
      const row = cloneJson(f3.worksheets[1].rows[0]);
      row.factorInstanceId = "f".repeat(64);
      row.source.sourceRow = 3;
      f3.worksheets[1].rows.push(row);
      f3.summary.factorCount = 3;
      f3.summary.completeCount = 3;
    }],
  ])("isolates %s identity mismatch", (_kind, mutate) => {
    const bundle = setupBundle();
    const f3Path = path.join(bundle.f3ArtifactRoot, "Feature3-Report.json");
    const f4Path = path.join(bundle.f4ArtifactRoot, "Feature4-Calculation.json");
    const f3 = loadJson(f3Path);
    const f4 = loadJson(f4Path);
    mutate(f3, f4);
    writeJson(f3Path, f3);
    writeJson(f4Path, f4);

    const result = load(bundle);
    expect(result.status).toBe("accepted");
    expect(result.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(result.rejectedWorksheets[0]).toMatchObject({ worksheetName: "Analysis-B", reasonCode: "artifact_identity_mismatch" });
  });

  it("returns inputRejected when every selected worksheet has an identity mismatch", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    const f3Path = path.join(bundle.f3ArtifactRoot, "Feature3-Report.json");
    rewriteJson(f3Path, (report) => { report.worksheets[0].rows[0].imageReference.contentHash = "b".repeat(64); });

    expectRejected(load(bundle), "artifact_identity_mismatch", "worksheet:Analysis-A");
  });

  it.each([
    ["confirmed", {
      confidence: "high",
      reviewStatus: "confirmed",
      confirmedBy: "controlled-reviewer",
      confirmedAt: "2026-08-11T08:00:00.000Z",
    }],
    ["low", { confidence: "low", reviewStatus: "unreviewed" }],
    ["rejected", { confidence: "medium", reviewStatus: "rejected" }],
  ])("passes through a valid %s observation", (_kind, fields) => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    const observationPath = path.join(bundle.base, "observations.json");
    const imageReference = bundle.imageReferences.get("Analysis-A");
    writeJson(observationPath, {
      contractVersion: "v1",
      inputClassification: "confidential",
      observationVersion: "f5-image-observation-v1",
      workbookContentHash: WORKBOOK_HASH,
      worksheets: [{
        worksheetName: "Analysis-A",
        imageReference,
        observations: [{
          scope: "stack_start",
          observedValue: "ambiguous",
          confidence: fields.confidence,
          visibleBasis: "Controlled observation basis.",
          reviewStatus: fields.reviewStatus,
          ...(fields.confirmedBy ? { confirmedBy: fields.confirmedBy, confirmedAt: fields.confirmedAt } : {}),
        }],
      }],
    });

    const result = load(bundle, { imageObservationArtifact: observationPath });
    expect(result.status).toBe("accepted");
    expect(result.request.worksheets[0].imageObservations[0]).toMatchObject(fields);
    expect(result.observationArtifact).toEqual(loadJson(observationPath));
    expect(result.request.worksheets[0]).not.toHaveProperty("contextSnapshot");
    expect(result.request.worksheets[0]).not.toHaveProperty("observationVersion");
    expect(result.sourceReferences.observation).toBe("observations.json");
  });

  it("accepts a valid v2 artifact with its exact sorted snapshot and contextual observations", () => {
    const bundle = setupBundle();
    addSecondMappedRow(bundle, "Analysis-A");
    const artifact = v2ObservationArtifact(bundle);
    const observationPath = writeObservationArtifact(bundle, artifact);

    const result = load(bundle, { imageObservationArtifact: observationPath });

    expect(result.status).toBe("accepted");
    expect(result.observationArtifact).toEqual(artifact);
    expect(result.observationArtifact.worksheets[0].contextSnapshot).toEqual({
      dimensionDescription: "Tolerance loop Analysis-A",
      rows: [{
        tableId: "table-1",
        sourceRow: 2,
        partName: "Anonymous bracket",
        partSubsystem: "Anonymous bracket",
        partCategory: "CNC",
        factorName: "Feature-Analysis-A",
        factorDescription: "Feature-Analysis-A",
        nominal: 12.45,
        upperTolerance: 0.2,
        lowerTolerance: -0.2,
        sigmaLevel: 4,
        sourceCells: {
          factorName: "Analysis-A!A2",
          partName: "Analysis-A!B2",
        },
      }, {
        tableId: "table-1",
        sourceRow: 3,
        partName: "Anonymous bracket second",
        partSubsystem: "Anonymous bracket second",
        partCategory: "Sheet Metal",
        factorName: "Feature-Analysis-A-Second",
        factorDescription: "Feature-Analysis-A-Second",
        nominal: 7.5,
        upperTolerance: 0.1,
        lowerTolerance: -0.15,
        sigmaLevel: 3,
        sourceCells: {
          factorName: "Analysis-A!A3",
          partName: "Analysis-A!B3",
        },
      }],
    });
    expect(result.observationArtifact.worksheets[0].contextSnapshot.rows.map(({ sourceRow }) => sourceRow))
      .toEqual([2, 3]);
    expect(result.observationArtifact.worksheets[0].observations.map(({ scope }) => scope))
      .toEqual(CORE_SCOPES);
    expect(result.request.worksheets[0]).toMatchObject({
      observationVersion: "f5-image-observation-v2",
      contextSnapshot: artifact.worksheets[0].contextSnapshot,
      imageObservations: artifact.worksheets[0].observations,
    });
    expect(result).not.toHaveProperty("observationFallback");
  });

  it.each([
    ["missing", (observationPath) => observationPath, "artifact_missing"],
    ["unreadable", (observationPath) => {
      mkdirSync(observationPath);
      return observationPath;
    }, "artifact_contract_invalid"],
    ["malformed JSON", (observationPath) => {
      writeFileSync(observationPath, "{malformed observation", "utf8");
      return observationPath;
    }, "artifact_contract_invalid"],
    ["unknown version", (observationPath) => {
      writeJson(observationPath, {
        contractVersion: "v1",
        inputClassification: "confidential",
        observationVersion: "f5-image-observation-unknown",
        workbookContentHash: WORKBOOK_HASH,
        worksheets: [],
      });
      return observationPath;
    }, "artifact_contract_invalid"],
    ["schema-invalid", (observationPath) => {
      writeJson(observationPath, {
        contractVersion: "v1",
        inputClassification: "confidential",
        observationVersion: "f5-image-observation-v2",
        workbookContentHash: WORKBOOK_HASH,
        worksheets: [],
      });
      return observationPath;
    }, "artifact_contract_invalid"],
  ])("falls back to the deterministic request for an optional %s observation artifact", (
    _case,
    prepareObservation,
    reasonCode,
  ) => {
    const bundle = setupBundle();
    const observationPath = prepareObservation(path.join(bundle.base, "optional-observations.json"));

    const result = load(bundle, { imageObservationArtifact: observationPath });

    expect(result.status).toBe("accepted");
    expect(result.request.worksheets.map(({ worksheetName }) => worksheetName))
      .toEqual(["Analysis-A", "Analysis-B"]);
    expect(result.request.worksheets.every((worksheet) => worksheet.imageObservations.length === 0)).toBe(true);
    expect(result.request.worksheets.every((worksheet) => !(
      "observationVersion" in worksheet || "contextSnapshot" in worksheet
    ))).toBe(true);
    expect(result.observationFallback).toEqual({
      reasonCode,
      artifactReference: "optional-observations.json",
    });
    expect(result).not.toHaveProperty("observationArtifact");
    expect(result.sourceReferences).not.toHaveProperty("observation");
  });

  it.each([
    ["dimension description", (artifact) => { artifact.worksheets[0].contextSnapshot.dimensionDescription = "Other loop"; }],
    ["missing row", (artifact) => { artifact.worksheets[0].contextSnapshot.rows = []; }],
    ["extra row", (artifact) => {
      artifact.worksheets[0].contextSnapshot.rows.push({
        ...cloneJson(artifact.worksheets[0].contextSnapshot.rows[0]),
        sourceRow: 3,
      });
    }],
    ["duplicate row", (artifact) => {
      artifact.worksheets[0].contextSnapshot.rows.push(
        cloneJson(artifact.worksheets[0].contextSnapshot.rows[0]),
      );
    }],
    ["tableId", (artifact) => { artifact.worksheets[0].contextSnapshot.rows[0].tableId = "other-table"; }],
    ["sourceRow", (artifact) => { artifact.worksheets[0].contextSnapshot.rows[0].sourceRow = 99; }],
    ["partName", (artifact) => { artifact.worksheets[0].contextSnapshot.rows[0].partName = "Other part"; }],
    ["partSubsystem", (artifact) => { artifact.worksheets[0].contextSnapshot.rows[0].partSubsystem = "Other subsystem"; }],
    ["partCategory", (artifact) => { artifact.worksheets[0].contextSnapshot.rows[0].partCategory = "Other category"; }],
    ["factorName", (artifact) => { artifact.worksheets[0].contextSnapshot.rows[0].factorName = "Other factor"; }],
    ["factorDescription", (artifact) => { artifact.worksheets[0].contextSnapshot.rows[0].factorDescription = "Other description"; }],
    ["nominal", (artifact) => { artifact.worksheets[0].contextSnapshot.rows[0].nominal = 99; }],
    ["upperTolerance", (artifact) => { artifact.worksheets[0].contextSnapshot.rows[0].upperTolerance = 99; }],
    ["lowerTolerance", (artifact) => { artifact.worksheets[0].contextSnapshot.rows[0].lowerTolerance = -99; }],
    ["sigmaLevel", (artifact) => { artifact.worksheets[0].contextSnapshot.rows[0].sigmaLevel = 6; }],
    ["sourceCells", (artifact) => { artifact.worksheets[0].contextSnapshot.rows[0].sourceCells.partName = "Analysis-A!Z99"; }],
    ["image reference", (artifact) => { artifact.worksheets[0].imageReference.contentHash = "b".repeat(64); }],
    ["missing selected worksheet", (artifact) => { artifact.worksheets.pop(); }],
    ["extra worksheet", (artifact) => {
      const extra = cloneJson(artifact.worksheets[0]);
      extra.worksheetName = "Extra";
      extra.imageReference.worksheetName = "Extra";
      artifact.worksheets.push(extra);
    }],
  ])("falls back without partially consuming v2 when %s differs", (_kind, mutate) => {
    const bundle = setupBundle();
    const artifact = v2ObservationArtifact(bundle);
    mutate(artifact);
    const observationPath = writeObservationArtifact(bundle, artifact);

    const result = load(bundle, { imageObservationArtifact: observationPath });

    expect(result.status).toBe("accepted");
    expect(result.request.worksheets.map(({ worksheetName }) => worksheetName))
      .toEqual(["Analysis-A", "Analysis-B"]);
    expect(result.request.worksheets.every((worksheet) => worksheet.imageObservations.length === 0)).toBe(true);
    expect(result.request.worksheets.every((worksheet) => !("contextSnapshot" in worksheet))).toBe(true);
    expect(result).not.toHaveProperty("observationArtifact");
    expect(result.observationFallback).toEqual({
      reasonCode: expect.stringMatching(/^artifact_(contract_invalid|identity_mismatch)$/),
      artifactReference: "observations.json",
    });
    expect(result.sourceReferences).not.toHaveProperty("observation");
  });

  it("keeps baseline identity rejection authoritative when a v2 artifact is present", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    const observationPath = writeObservationArtifact(bundle, v2ObservationArtifact(bundle));
    rewriteJson(path.join(bundle.f3ArtifactRoot, "Feature3-Report.json"), (report) => {
      report.workbook.contentHash = "b".repeat(64);
    });

    expectRejected(
      load(bundle, { imageObservationArtifact: observationPath }),
      "artifact_identity_mismatch",
      "Feature3-Report.json",
    );
  });

  it("isolates an observation workbook or image identity mismatch", () => {
    const bundle = setupBundle();
    const observationPath = path.join(bundle.base, "observations.json");
    writeJson(observationPath, {
      contractVersion: "v1",
      inputClassification: "confidential",
      observationVersion: "f5-image-observation-v1",
      workbookContentHash: WORKBOOK_HASH,
      worksheets: [{
        worksheetName: "Analysis-B",
        imageReference: { ...bundle.imageReferences.get("Analysis-B"), contentHash: "b".repeat(64) },
        observations: [],
      }],
    });

    const result = load(bundle, { imageObservationArtifact: observationPath });
    expect(result.status).toBe("accepted");
    expect(result.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(result.rejectedWorksheets[0]).toMatchObject({ worksheetName: "Analysis-B", reasonCode: "artifact_identity_mismatch" });

    rewriteJson(observationPath, (artifact) => { artifact.workbookContentHash = "c".repeat(64); });
    expectRejected(load(bundle, { imageObservationArtifact: observationPath }), "artifact_identity_mismatch", "observations.json");
  });

  it("keeps an observation for a selected worksheet scoped to that worksheet rejection", () => {
    const bundle = setupBundle();
    const observationPath = path.join(bundle.base, "observations.json");
    writeJson(observationPath, {
      contractVersion: "v1",
      inputClassification: "confidential",
      observationVersion: "f5-image-observation-v1",
      workbookContentHash: WORKBOOK_HASH,
      worksheets: [{
        worksheetName: "Analysis-B",
        imageReference: bundle.imageReferences.get("Analysis-B"),
        observations: [],
      }],
    });
    rmSync(path.join(bundle.f1ArtifactRoot, "sheets/anonymous.xlsx/json/Analysis-B.json"));

    const result = load(bundle, { imageObservationArtifact: observationPath });
    expect(result.status).toBe("accepted");
    expect(result.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(result.rejectedWorksheets).toEqual([{
      worksheetName: "Analysis-B",
      reasonCode: "artifact_missing",
      artifactReference: "worksheet:Analysis-B",
    }]);
  });

  it("fails closed when an observation names a worksheet outside the controlled selection", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    const observationPath = path.join(bundle.base, "private-observations.json");
    writeJson(observationPath, {
      contractVersion: "v1",
      inputClassification: "confidential",
      observationVersion: "f5-image-observation-v1",
      workbookContentHash: WORKBOOK_HASH,
      worksheets: [{
        worksheetName: "Unknown-Worksheet",
        imageReference: {
          ...bundle.imageReferences.get("Analysis-A"),
          worksheetName: "Unknown-Worksheet",
        },
        observations: [],
      }],
    });

    expectRejected(
      load(bundle, { imageObservationArtifact: observationPath }),
      "artifact_identity_mismatch",
      "private-observations.json",
    );
  });

  it.each([
    ["Feature1-Report.json", "f1ArtifactRoot"],
    ["Feature3-Report.json", "f3ArtifactRoot"],
    ["Feature4-Calculation.json", "f4ArtifactRoot"],
  ])("returns a safe missing-artifact rejection for %s", (artifactReference, rootKey) => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    rmSync(path.join(bundle[rootKey], artifactReference));
    expectRejected(load(bundle), "artifact_missing", artifactReference);
  });

  it.each([
    ["malformed JSON", "Feature3-Report.json", "f3ArtifactRoot", (filePath) => writeFileSync(filePath, "{private malformed", "utf8")],
    ["invalid F3 schema", "Feature3-Report.json", "f3ArtifactRoot", (filePath) => rewriteJson(filePath, (value) => { value.status = "input_rejected"; })],
    ["invalid F4 schema", "Feature4-Calculation.json", "f4ArtifactRoot", (filePath) => rewriteJson(filePath, (value) => { value.status = "failed"; })],
  ])("returns a safe contract rejection for %s", (_kind, artifactReference, rootKey, corrupt) => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    corrupt(path.join(bundle[rootKey], artifactReference), bundle);
    expectRejected(load(bundle), "artifact_contract_invalid", artifactReference);
  });

  it.each(["selectedWorksheetCount", "completedWorksheetCount"])(
    "rejects an F4 aggregate summary %s mismatch through the schema",
    (summaryField) => {
      const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
      rewriteJson(path.join(bundle.f4ArtifactRoot, "Feature4-Calculation.json"), (report) => {
        report.summary[summaryField] = 2;
      });

      expectRejected(load(bundle), "artifact_contract_invalid", "Feature4-Calculation.json");
    },
  );

  it("returns a safe worksheet contract rejection when every selected F1 worksheet fails schema validation", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    rewriteJson(path.join(bundle.f1ArtifactRoot, "sheets/anonymous.xlsx/json/Analysis-A.json"), (value) => {
      delete value.factorTables[0].rows[0].actualFields.notes;
    });

    expectRejected(load(bundle), "artifact_contract_invalid", "worksheet:Analysis-A");
  });

  it("never returns malformed JSON content or absolute paths", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A"] });
    writeFileSync(path.join(bundle.f1ArtifactRoot, "Feature1-Report.json"), `{"secret":"${bundle.base}"`, "utf8");

    const result = load(bundle);
    expectRejected(result, "artifact_contract_invalid", "Feature1-Report.json");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain(bundle.base);
  });
});