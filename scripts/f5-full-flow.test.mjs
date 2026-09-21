import { Buffer } from "node:buffer";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  f5DataInterpretationResultSchema,
  f5ImageObservationArtifactSchema,
} from "../packages/contracts/dist/contracts.js";
import { createF5DataInterpretation } from "../packages/workbook-catalog/dist/index.js";
import { runF5Cli, runF5FullValidation } from "./run-f5-full-validation.mjs";
import { prepareWorkspaceStage } from "./analysis-workspace-test-support.mjs";
import { validateAnalysisStageArtifacts } from "./analysis-stage-validation.mjs";

const cleanup = [];
const WORKBOOK_HASH = "a".repeat(64);
const IMAGE_HASH = "b".repeat(64);

afterEach(() => {
  for (const target of cleanup.splice(0)) rmSync(target, { recursive: true, force: true });
});

function calculation(worksheetName = "Analysis-A") {
  const source = { worksheetName, tableId: "table-a", sourceRow: 2 };
  return {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    calculationVersion: "excel-ta-v1",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    workbookContentHash: WORKBOOK_HASH,
    worksheetSelection: { worksheetName, tableId: "table-a" },
    factorCount: 1,
    recommendation: {
      method: "worst_case",
      reason: "factor_count_1_to_3",
      refer3d: false,
      criticality: "none",
      criticalityRisk: false,
    },
    factors: [{
      factorName: "Factor A",
      unit: "mm",
      source,
      input: {
        nominalValue: 0,
        upperTolerance: 0.1,
        lowerTolerance: -0.1,
        longTermSafetyFactor: 1,
        sigmaLevel: 4,
        distribution: "normal",
      },
      mean: 0,
      halfTolerance: 0.1,
      sigma: 0.025,
      contribution: 1,
      trace: { formulaIds: ["factor-mean-v1"], sourceCells: [`${worksheetName}!A2`] },
    }],
    system: {
      designNominal: 0,
      mean: 0,
      additionalMeanShift: 0,
      worstCaseUpper: 0.1,
      worstCaseLower: -0.1,
      rssSigma: 0.025,
    },
    capability: {
      lowerSpecLimit: -1,
      upperSpecLimit: 1,
      targetSigmaLevel: 4,
      targetCpk: 1.33,
      cp: 13.333333333333334,
      lowerCpk: 13.333333333333334,
      upperCpk: 13.333333333333334,
      cpk: 13.333333333333334,
      lowerZ: 40,
      upperZ: 40,
      lowerDpm: 0,
      upperDpm: 0,
      totalDpm: 0,
      outOfSpecRatio: 0,
      yield: 1,
      status: "PASS",
    },
    traceRecords: [
      ["capability.cpk", "cpk-v1"],
      ["capability.cp", "cp-v1"],
      ["system.rssSigma", "rss-v1"],
      ["capability.totalDpm", "dpm-total-v1"],
      ["capability.yield", "yield-v1"],
      ["capability.lowerZ", "z-lower-v1"],
      ["capability.upperZ", "z-upper-v1"],
      ["factors[0].contribution", "contribution-v1"],
    ].map(([outputField, formulaId]) => ({
      outputField,
      formulaVersion: "excel-ta-v1",
      formulaId,
      sourceCells: [`${worksheetName}!A2`],
    })),
    scenarios: [],
  };
}

function request() {
  const calculationResult = calculation();
  const imageReference = {
    artifact: "f1",
    worksheetName: "Analysis-A",
    relativePath: "images/analysis-a.png",
    contentHash: IMAGE_HASH,
  };
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: WORKBOOK_HASH },
    knowledgeBaseVersion: "interpretation-rules-v2",
    worksheets: [{
      worksheetName: "Analysis-A",
      imageReference,
      governanceRows: [{
        factorInstanceId: "1".padStart(64, "0"),
        factorOrdinal: { value: "A", rawText: "A", sourceCell: "Analysis-A!Z2" },
        drawingDimensionKey: "2".padStart(64, "0"),
        deviceLevelDim: "device-dim-1",
        dimensionDescription: "dimension-1",
        partCategory: "controlled-category",
        partSubsystem: "controlled-subsystem",
        drawingNumber: "DRAW-1",
        dimId: "DIM-1",
        factorDescription: "Factor A",
        nominal: 0,
        upperTolerance: 0.1,
        lowerTolerance: -0.1,
        sigmaLevel: 4,
        dimIdStatus: "valid",
        qualitySignals: [],
        governanceStatus: "complete",
        imageReference,
        source: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, sourceCells: {} },
      }],
      calculationResult,
      imageObservations: [],
    }],
  };
}

function observations() {
  return f5ImageObservationArtifactSchema.parse({
    contractVersion: "v1",
    inputClassification: "confidential",
    observationVersion: "f5-image-observation-v1",
    workbookContentHash: WORKBOOK_HASH,
    worksheets: [{
      worksheetName: "Analysis-A",
      imageReference: request().worksheets[0].imageReference,
      observations: [],
    }],
  });
}

const CORE_SCOPES = [
  "tolerance_loop_closure",
  "datum_chain",
  "assembly_datum_face",
  "stack_start",
  "direction",
];

function contextualObservationBundle() {
  const baselineRequest = request();
  const worksheet = baselineRequest.worksheets[0];
  const governanceRow = worksheet.governanceRows[0];
  const contextSnapshot = {
    dimensionDescription: governanceRow.dimensionDescription,
    rows: [{
      tableId: governanceRow.source.tableId,
      sourceRow: governanceRow.source.sourceRow,
      factorOrdinal: governanceRow.factorOrdinal,
      partName: governanceRow.partSubsystem,
      partSubsystem: governanceRow.partSubsystem,
      partCategory: governanceRow.partCategory,
      factorName: worksheet.calculationResult.factors[0].factorName,
      factorDescription: governanceRow.factorDescription,
      nominal: governanceRow.nominal,
      upperTolerance: governanceRow.upperTolerance,
      lowerTolerance: governanceRow.lowerTolerance,
      sigmaLevel: governanceRow.sigmaLevel,
      sourceCells: governanceRow.source.sourceCells,
    }],
  };
  const imageObservations = CORE_SCOPES.map((scope) => ({
    scope,
    visualObservation: {
      observedValue: "visible",
      confidence: "high",
      visibleBasis: `Visible controlled marker for ${scope}.`,
      visibleLabels: [],
      reviewStatus: "unreviewed",
    },
    contextualSignal: {
      signalValue: "insufficient_evidence",
      textBasis: `Worksheet context requires engineering review for ${scope}.`,
      linkedSourceRows: [],
      linkedVisualLabels: [],
      requiresEngineeringReview: true,
    },
  }));
  const enrichedRequest = {
    ...baselineRequest,
    worksheets: [{
      ...worksheet,
      observationVersion: "f5-image-observation-v2",
      contextSnapshot,
      imageObservations,
    }],
  };
  const observationArtifact = f5ImageObservationArtifactSchema.parse({
    contractVersion: "v1",
    inputClassification: "confidential",
    observationVersion: "f5-image-observation-v2",
    workbookContentHash: WORKBOOK_HASH,
    worksheets: [{
      worksheetName: worksheet.worksheetName,
      imageReference: worksheet.imageReference,
      contextSnapshot,
      observations: imageObservations,
    }],
  });
  return { baselineRequest, enrichedRequest, observationArtifact };
}

function contextualDirectionBundle(confidence, reviewStatus) {
  const bundle = contextualObservationBundle();
  for (const observations of [
    bundle.enrichedRequest.worksheets[0].imageObservations,
    bundle.observationArtifact.worksheets[0].observations,
  ]) {
    const direction = observations.find(({ scope }) => scope === "direction");
    direction.visualObservation.confidence = confidence;
    direction.visualObservation.reviewStatus = reviewStatus;
    direction.visualObservation.visibleLabels = ["Factor A"];
    direction.contextualSignal.signalValue = "indicated_consistent";
    direction.contextualSignal.linkedSourceRows = [{ tableId: "table-a", sourceRow: 2 }];
    direction.contextualSignal.linkedVisualLabels = [{
      label: "Factor A",
      tableId: "table-a",
      sourceRow: 2,
    }];
  }
  return bundle;
}

function requestForWorksheets(worksheetNames) {
  const baseline = request();
  return {
    ...baseline,
    worksheets: worksheetNames.map((worksheetName, index) => {
      const worksheet = cloneJson(baseline.worksheets[0]);
      worksheet.worksheetName = worksheetName;
      worksheet.imageReference = {
        ...worksheet.imageReference,
        worksheetName,
        relativePath: `images/analysis-${index + 1}.png`,
      };
      worksheet.calculationResult = calculation(worksheetName);
      worksheet.governanceRows[0].source.worksheetName = worksheetName;
      worksheet.governanceRows[0].imageReference = cloneJson(worksheet.imageReference);
      return worksheet;
    }),
  };
}

function setup({ rejectedWorksheets = [], observationArtifact } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "f5-full-flow-"));
  cleanup.push(root);
  const publishRoot = path.join(root, "publish");
  const runRoot = path.join(publishRoot, "f5-runs", "run-1");
  mkdirSync(publishRoot);
  const renameCalls = [];
  const completed = createF5DataInterpretation(request());
  const deps = {
    parseArgs: vi.fn(() => ({
      f1ArtifactRoot: path.join(publishRoot, "f1"),
      f3ArtifactRoot: path.join(publishRoot, "f3"),
      f4ArtifactRoot: path.join(publishRoot, "f4"),
      selectedWorksheetNames: ["Analysis-A"],
      imageObservationsPath: observationArtifact ? path.join(publishRoot, "observations.json") : undefined,
    })),
    resolveLayout: vi.fn(() => ({
      runId: "2026-08-11T12-00-00-000Z",
      runRoot,
      publishRoot,
      reportJsonName: "Feature5-Report.json",
      reportMdName: "Feature5-Report.md",
      runSummaryJsonName: "Feature5-Run-Summary.json",
      imageObservationsJsonName: "Feature5-Image-Observations.json",
      manifestName: "manifest.json",
    })),
    loadBundle: vi.fn(() => ({
      status: "accepted",
      request: request(),
      rejectedWorksheets,
      worksheetOrder: ["Analysis-A", ...rejectedWorksheets.map(({ worksheetName }) => worksheetName)],
      sourceReferences: {
        f1: "Feature1-Report.json",
        f3: "Feature3-Report.json",
        f4: "Feature4-Calculation.json",
        ...(observationArtifact ? { observation: "observations.json" } : {}),
      },
      ...(observationArtifact ? { observationArtifact } : {}),
    })),
    createInterpretation: vi.fn(() => completed),
    renderReport: vi.fn(() => "# Feature 5\n"),
    rename: (from, to) => {
      renameCalls.push({ from, to });
      renameSync(from, to);
    },
  };
  return { root, publishRoot, runRoot, completed, deps, renameCalls };
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function directoryIdentity(targetPath) {
  const requestedPath = path.resolve(targetPath);
  const requestedStats = lstatSync(requestedPath);
  const canonicalPath = realpathSync(requestedPath);
  const canonicalStats = statSync(canonicalPath);
  return {
    requestedPath,
    canonicalPath,
    requestedDev: requestedStats.dev,
    requestedIno: requestedStats.ino,
    canonicalDev: canonicalStats.dev,
    canonicalIno: canonicalStats.ino,
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value), "utf8");
}

function createRealArtifactBundle() {
  const root = mkdtempSync(path.join(tmpdir(), "f5-full-flow-process-"));
  cleanup.push(root);
  const publishRoot = path.join(root, "publish");
  const outputRoot = path.join(publishRoot, "f5-runs");
  const f1ArtifactRoot = path.join(publishRoot, "f1");
  const f3ArtifactRoot = path.join(publishRoot, "f3");
  const f4ArtifactRoot = path.join(publishRoot, "f4");
  const worksheetName = "Analysis-A";
  const tableId = "table-a";
  const imageBytes = Buffer.from("controlled-f5-process-image");
  const imageHash = createHash("sha256").update(imageBytes).digest("hex");
  const worksheetRelative = "sheets/anonymous.xlsx/json/Analysis-A.json";
  const markdownRelative = "sheets/anonymous.xlsx/md/Analysis-A.md";
  const imageRelative = "sheets/anonymous.xlsx/images/Analysis-A.png";
  const imageReference = {
    artifact: "f1",
    worksheetName,
    relativePath: imageRelative,
    contentHash: imageHash,
  };

  mkdirSync(publishRoot, { recursive: true });
  mkdirSync(path.dirname(path.join(f1ArtifactRoot, imageRelative)), { recursive: true });
  mkdirSync(path.dirname(path.join(f1ArtifactRoot, markdownRelative)), { recursive: true });
  writeFileSync(path.join(f1ArtifactRoot, imageRelative), imageBytes);
  writeFileSync(path.join(f1ArtifactRoot, markdownRelative), "# Analysis-A\n", "utf8");
  writeJson(path.join(f1ArtifactRoot, worksheetRelative), {
    taskId: "1.5-1.6",
    generatedAt: "2026-08-11T00:00:00.000Z",
    workbook: { fileName: "anonymous.xlsx", contentHash: WORKBOOK_HASH },
    worksheetName,
    toleranceLoopDescription: "Tolerance loop Analysis-A",
    factorTables: [{
      tableId,
      headerRow: 1,
      dataRange: { startRow: 2, endRow: 2 },
      columns: [],
      rows: [{
        sourceRow: 2,
        factorOrdinal: { value: "A", rawText: "A", sourceCell: "Analysis-A!Z2" },
        fields: {},
        actualFields: {
          factorName: "Factor A",
          partName: "controlled-part",
          drawingNumber: "DRAW-1",
          dimCharacteristicId: "DIM-1",
          partCategory: "controlled-category",
          nominalValue: 0,
          upperTolerance: 0.1,
          lowerTolerance: -0.1,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
          mean: 0,
          tolerance: 0.1,
          oneSigma: 0.025,
          percentContributionToSigma: 1,
          notes: null,
        },
      }],
    }],
    imageAssets: [{
      contentHash: imageHash,
      mediaType: "image/png",
      byteLength: imageBytes.length,
      outputFile: imageRelative,
    }],
    tolerancePathImage: {
      status: "available",
      labelSourceCell: "Analysis-A!A55",
      imageContentHash: imageHash,
      imageAnchor: { from: "A56", to: "K71" },
    },
  });
  writeJson(path.join(f1ArtifactRoot, "Feature1-Report.json"), {
    contractVersion: "v1",
    feature: "F1",
    generatedAt: "2026-08-11T00:00:00.000Z",
    workbooks: [{
      workbook: { fileName: "anonymous.xlsx", contentHash: WORKBOOK_HASH },
      task15_factor_table_and_debug_json: {
        sheets: [{ worksheetName, jsonPath: worksheetRelative }],
      },
      task16_loop_screenshot_and_run_record: {
        sheets: [{ worksheetName, mdPath: markdownRelative }],
      },
      sheetReadmePath: "sheets/anonymous.xlsx/README.md",
    }],
  });

  const governance = request().worksheets[0].governanceRows[0];
  writeJson(path.join(f3ArtifactRoot, "Feature3-Report.json"), {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: "completed",
    artifactRoot: "controlled/f1",
    workbook: { fileName: "anonymous.xlsx", contentHash: WORKBOOK_HASH },
    worksheets: [{
      worksheetName,
      toleranceLoopDescription: "Tolerance loop Analysis-A",
      rows: [{ ...governance, imageReference }],
    }],
    ado: { status: "not_requested" },
    summary: {
      worksheetCount: 1,
      factorCount: 1,
      completeCount: 1,
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
    calculations: [calculation()],
    summary: { selectedWorksheetCount: 1, completedWorksheetCount: 1 },
  });

  return { root, publishRoot, outputRoot, f1ArtifactRoot, f3ArtifactRoot, f4ArtifactRoot };
}

function createAnalysisWorkspaceRoot(root) {
  const analysisRoot = path.join(root, "20260921 - Anonymous");
  const stagePaths = {
    f1: path.join(analysisRoot, "01 - F1 Data Parsing"),
    f2: path.join(analysisRoot, "02 - F2 Data Cleaning"),
    f3: path.join(analysisRoot, "03 - F3 Drawing Governance"),
    f4: path.join(analysisRoot, "04 - F4 Calculation Engine"),
    f5: path.join(analysisRoot, "05 - F5 Result Interpretation"),
    f6: path.join(analysisRoot, "06 - F6 Design Optimization"),
  };
  for (const stagePath of Object.values(stagePaths)) mkdirSync(stagePath, { recursive: true });
  writeFileSync(path.join(analysisRoot, "analysis-run-summary.json"), JSON.stringify({
    contractVersion: "analysis-workspace-v1",
    analysisRoot,
    summaryPath: path.join(analysisRoot, "analysis-run-summary.json"),
    workbook: { fileName: "Anonymous.xlsx", contentHash: WORKBOOK_HASH },
    allocationDate: "20260921",
    currentStage: "f1",
    stageDirectories: {
      f1: "01 - F1 Data Parsing",
      f2: "02 - F2 Data Cleaning",
      f3: "03 - F3 Drawing Governance",
      f4: "04 - F4 Calculation Engine",
      f5: "05 - F5 Result Interpretation",
      f6: "06 - F6 Design Optimization",
    },
    stages: {
      f1: { status: "pending", artifacts: {} },
      f2: { status: "pending", artifacts: {} },
      f3: { status: "pending", artifacts: {} },
      f4: { status: "pending", artifacts: {} },
      f5: { status: "pending", artifacts: {} },
      f6: { status: "pending", artifacts: {} },
    },
    overallStatus: "in_progress",
  }, null, 2));
  return { analysisRoot, stagePaths };
}

function runDirectProcess(bundle, imageObservationsPath) {
  return spawnSync(process.execPath, [
    "scripts/run-f5-full-validation.mjs",
    bundle.f1ArtifactRoot,
    bundle.f3ArtifactRoot,
    bundle.f4ArtifactRoot,
    ...(imageObservationsPath === undefined ? [] : ["--image-observations", imageObservationsPath]),
  ], {
    cwd: path.resolve("."),
    encoding: "utf8",
    env: {
      ...process.env,
      AI_TVA_F5_OUTPUT_ROOT: bundle.outputRoot,
      AI_TVA_F5_PUBLISH_ROOT: bundle.publishRoot,
    },
  });
}

function runWorkspaceDirectProcess(workspace, imageObservationsPath) {
  return spawnSync(process.execPath, [
    "scripts/run-f5-full-validation.mjs",
    workspace.stagePaths.f1,
    workspace.stagePaths.f3,
    workspace.stagePaths.f4,
    ...(imageObservationsPath === undefined ? [] : ["--image-observations", imageObservationsPath]),
    "--analysis-root",
    workspace.analysisRoot,
  ], {
    cwd: path.resolve("."),
    encoding: "utf8",
    env: process.env,
  });
}

describe("runF5FullValidation", () => {
  it("writes completed artifacts atomically in the locked order", () => {
    const context = setup();
    const result = runF5FullValidation({ args: ["f1", "f3", "f4"] }, context.deps);
    const report = readJson(result.reportJsonPath);

    expect(result).toMatchObject({ status: "completed", outputDirectory: context.runRoot });
    expect(context.renameCalls.map(({ to }) => path.basename(to))).toEqual([
      "Feature5-Report.json",
      "Feature5-Report.md",
      "Feature5-Run-Summary.json",
      "manifest.json",
    ]);
    expect(readdirSync(context.runRoot).sort()).toEqual([
      "Feature5-Report.json",
      "Feature5-Report.md",
      "Feature5-Run-Summary.json",
      "manifest.json",
    ].sort());
    expect(context.deps.renderReport).toHaveBeenCalledWith(expect.any(Object), {
      outputRoot: context.runRoot,
      f1ArtifactRoot: path.join(context.publishRoot, "f1"),
      publishRoot: context.publishRoot,
    });
    expect(readJson(result.manifestPath)).toEqual({
      contractVersion: "v1",
      featureId: "F5",
      status: "completed",
      runId: "2026-08-11T12-00-00-000Z",
      artifacts: {
        reportJson: "Feature5-Report.json",
        reportMarkdown: "Feature5-Report.md",
        runSummary: "Feature5-Run-Summary.json",
      },
    });
    expect(report.worksheets[0].sections.toleranceChainValidity.status).toBe("not_evaluated");
    expect(report.worksheets[0].clarifications).toEqual(expect.arrayContaining([
      expect.objectContaining({ reasonCode: "drawing_evidence_not_evaluated" }),
    ]));
    expect(result).not.toHaveProperty("imageObservationsPath");
  });

  it("exclusively opens, writes through, and closes a fresh temp fd for every atomic write", () => {
    const context = setup();
    const tokens = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
    ];
    const openCalls = [];
    const writeCalls = [];
    const closeCalls = [];
    context.deps.randomUUID = vi.fn(() => tokens.shift());
    context.deps.open = (target, flags) => {
      const fd = openSync(target, flags);
      openCalls.push({ target, flags, fd });
      return fd;
    };
    context.deps.writeFd = (fd, content) => {
      writeCalls.push({ fd, content });
      writeFileSync(fd, content, "utf8");
    };
    context.deps.close = (fd) => {
      closeCalls.push(fd);
      closeSync(fd);
    };

    runF5FullValidation({ args: [] }, context.deps);

    expect(context.deps.randomUUID).toHaveBeenCalledTimes(4);
    expect(openCalls.map(({ target }) => path.basename(target))).toEqual([
      "Feature5-Report.json.11111111-1111-4111-8111-111111111111.tmp",
      "Feature5-Report.md.22222222-2222-4222-8222-222222222222.tmp",
      "Feature5-Run-Summary.json.33333333-3333-4333-8333-333333333333.tmp",
      "manifest.json.44444444-4444-4444-8444-444444444444.tmp",
    ]);
    expect(openCalls.map(({ flags }) => flags)).toEqual(Array(4).fill("wx"));
    expect(writeCalls.map(({ fd }) => fd)).toEqual(openCalls.map(({ fd }) => fd));
    expect(closeCalls).toEqual(openCalls.map(({ fd }) => fd));
  });

  it("does not delete a temp file that exclusive creation did not create", () => {
    const context = setup();
    const collisionToken = "11111111-1111-4111-8111-111111111111";
    const collisionPath = path.join(
      context.runRoot,
      `Feature5-Report.json.${collisionToken}.tmp`,
    );
    context.deps.randomUUID = vi.fn()
      .mockReturnValueOnce(collisionToken)
      .mockReturnValue("22222222-2222-4222-8222-222222222222");
    context.deps.open = (target, flags) => {
      if (target === collisionPath) {
        writeFileSync(target, "pre-existing", "utf8");
      }
      return openSync(target, flags);
    };

    const result = runF5FullValidation({ args: [] }, context.deps);

    expect(result.reasonCode).toBe("workflow_output_failed");
    expect(readFileSync(collisionPath, "utf8")).toBe("pre-existing");
  });

  it("removes an owned partial temp file when fd writing throws", () => {
    const context = setup();
    context.deps.writeFd = (fd) => {
      writeSync(fd, "partial-secret-token", undefined, "utf8");
      throw new Error("C:\\secret\\partial.txt token=abc");
    };

    const result = runF5FullValidation({ args: [] }, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(readdirSync(context.runRoot)).toEqual([]);
    expect(JSON.stringify({ status: result.status, reasonCode: result.reasonCode }))
      .not.toMatch(/secret|token|partial\.txt|[A-Z]:\\/i);
  });

  it("writes a schema-validated observation artifact before the summary", () => {
    const context = setup({ observationArtifact: observations() });
    const result = runF5FullValidation({ args: [] }, context.deps);

    expect(result.status).toBe("completed");
    expect(f5ImageObservationArtifactSchema.parse(
      readJson(path.join(context.runRoot, "Feature5-Image-Observations.json")),
    )).toEqual(observations());
    expect(context.renameCalls.map(({ to }) => path.basename(to))).toEqual([
      "Feature5-Report.json",
      "Feature5-Report.md",
      "Feature5-Image-Observations.json",
      "Feature5-Run-Summary.json",
      "manifest.json",
    ]);
    expect(readJson(result.manifestPath)).toEqual({
      contractVersion: "v1",
      featureId: "F5",
      status: "completed",
      runId: "2026-08-11T12-00-00-000Z",
      artifacts: {
        reportJson: "Feature5-Report.json",
        reportMarkdown: "Feature5-Report.md",
        imageObservations: "Feature5-Image-Observations.json",
        runSummary: "Feature5-Run-Summary.json",
      },
    });
  });

  it("accepts a historical v1 artifact without snapshot enrichment or v2 reserialization", () => {
    const context = setup();
    const observationArtifact = f5ImageObservationArtifactSchema.parse({
      ...observations(),
      worksheets: [{
        ...observations().worksheets[0],
        observations: [{
          scope: "stack_start",
          observedValue: "visible",
          confidence: "high",
          visibleBasis: "A controlled stack-start marker is visible.",
          reviewStatus: "unreviewed",
        }],
      }],
    });
    const enrichedRequest = request();
    enrichedRequest.worksheets[0].imageObservations = observationArtifact.worksheets[0].observations;
    context.deps.loadBundle.mockReturnValue({
      status: "accepted",
      request: enrichedRequest,
      rejectedWorksheets: [],
      worksheetOrder: ["Analysis-A"],
      sourceReferences: {
        f1: "Feature1-Report.json",
        f3: "Feature3-Report.json",
        f4: "Feature4-Calculation.json",
        observation: "observations.json",
      },
      observationArtifact,
    });
    context.deps.createInterpretation.mockImplementation(createF5DataInterpretation);

    const result = runF5FullValidation({ args: [] }, context.deps);
    const report = readJson(result.reportJsonPath);
    const copiedArtifact = readJson(result.imageObservationsPath);
    const summary = readJson(result.runSummaryPath);

    expect(result.status).toBe("completed");
    expect(report.worksheets[0].sections.toleranceChainValidity.items.find(
      ({ scope }) => scope === "stack_start",
    ).status).toBe("needs_review");
    expect(report.worksheets[0]).not.toHaveProperty("observationVersion");
    expect(report.worksheets[0]).not.toHaveProperty("contextSnapshot");
    expect(copiedArtifact).toEqual(observationArtifact);
    expect(copiedArtifact.observationVersion).toBe("f5-image-observation-v1");
    expect(summary.hashes.imageObservationsSha256).toBe(
      createHash("sha256").update(readFileSync(result.imageObservationsPath)).digest("hex"),
    );
  });

  it("accepts valid v2 context and copies the supplied artifact with its observation hash", () => {
    const context = setup();
    const { enrichedRequest, observationArtifact } = contextualObservationBundle();
    context.deps.loadBundle.mockReturnValue({
      status: "accepted",
      request: enrichedRequest,
      rejectedWorksheets: [],
      worksheetOrder: ["Analysis-A"],
      sourceReferences: {
        f1: "Feature1-Report.json",
        f3: "Feature3-Report.json",
        f4: "Feature4-Calculation.json",
        observation: "observations.json",
      },
      observationArtifact,
    });
    context.deps.createInterpretation.mockImplementation(createF5DataInterpretation);

    const result = runF5FullValidation({ args: [] }, context.deps);
    const report = readJson(result.reportJsonPath);
    const worksheet = report.worksheets[0];
    const summary = readJson(result.runSummaryPath);

    expect(result.status).toBe("completed");
    expect(worksheet).toMatchObject({
      observationVersion: "f5-image-observation-v2",
      contextSnapshot: observationArtifact.worksheets[0].contextSnapshot,
    });
    expect(worksheet.sections.toleranceChainValidity.items.find(
      ({ scope }) => scope === "stack_start",
    ).status).not.toBe("not_evaluated");
    expect(worksheet.statements.filter(({ type, content }) => (
      type === "SIGNAL" && content.signalKind === "image_text_context_review"
    ))).toHaveLength(CORE_SCOPES.length);
    expect(readJson(result.imageObservationsPath)).toEqual(observationArtifact);
    expect(summary.hashes.imageObservationsSha256).toBe(
      createHash("sha256").update(readFileSync(result.imageObservationsPath)).digest("hex"),
    );
  });

  it.each([
    ["medium", "unreviewed"],
    ["high", "rejected"],
  ])("completes valid v2 direction context with %s confidence and %s review without fallback", (confidence, reviewStatus) => {
    const context = setup();
    const { enrichedRequest, observationArtifact } = contextualDirectionBundle(confidence, reviewStatus);
    context.deps.loadBundle.mockReturnValue({
      status: "accepted",
      request: enrichedRequest,
      rejectedWorksheets: [],
      worksheetOrder: ["Analysis-A"],
      sourceReferences: {
        f1: "Feature1-Report.json",
        f3: "Feature3-Report.json",
        f4: "Feature4-Calculation.json",
        observation: "observations.json",
      },
      observationArtifact,
    });
    context.deps.createInterpretation.mockImplementation(createF5DataInterpretation);

    const result = runF5FullValidation({ args: [] }, context.deps);
    const report = readJson(result.reportJsonPath);
    const worksheet = report.worksheets[0];
    const directionSignal = worksheet.statements.find(({ type, content }) => (
      type === "SIGNAL" && content.signalKind === "image_text_context_review"
        && content.scope === "direction"
    ));

    expect(result).toMatchObject({ status: "completed" });
    expect(result).not.toHaveProperty("reasonCode");
    expect(worksheet).not.toHaveProperty("observationFallback");
    expect(directionSignal.content).toMatchObject({
      linkedVisualLabels: [{ label: "Factor A", tableId: "table-a", sourceRow: 2 }],
      visualEvidence: {
        observedValue: "visible",
        confidence,
        visibleLabels: ["Factor A"],
        reviewStatus,
        imageReference: worksheet.imageReference,
      },
      requiresEngineeringReview: true,
    });
    expect(worksheet.statements.some(({ type, content }) => (
      type === "FACT" && content.provenanceKind === "image_observation"
        && content.scope === "direction"
    ))).toBe(false);
  });

  it.each([
    ["invalid v2 snapshot", "artifact_contract_invalid", undefined],
    ["selected worksheet missing from v2", "artifact_identity_mismatch", "worksheets"],
    ["missing optional observation", "artifact_missing", undefined],
    ["malformed optional observation", "artifact_contract_invalid", undefined],
  ])("completes deterministic F5 when %s", (_case, fallbackReasonCode, mismatchPath) => {
    const context = setup();
    context.deps.loadBundle.mockReturnValue({
      status: "accepted",
      request: request(),
      rejectedWorksheets: [],
      worksheetOrder: ["Analysis-A"],
      sourceReferences: {
        f1: "Feature1-Report.json",
        f3: "Feature3-Report.json",
        f4: "Feature4-Calculation.json",
      },
      observationFallback: {
        reasonCode: fallbackReasonCode,
        artifactReference: "observations.json",
        ...(mismatchPath === undefined ? {} : { mismatchPath }),
      },
    });
    context.deps.createInterpretation.mockImplementation(createF5DataInterpretation);

    const result = runF5FullValidation({ args: [] }, context.deps);
    const report = readJson(result.reportJsonPath);
    const summary = readJson(result.runSummaryPath);

    expect(result.status).toBe("completed");
    expect(context.deps.loadBundle).toHaveBeenCalledTimes(1);
    expect(context.deps.createInterpretation).toHaveBeenCalledWith({
      ...request(),
      observationFallback: { reasonCode: "enhanced_observation_rejected" },
    });
    expect(report.worksheets[0].sections.toleranceChainValidity.status).toBe("not_evaluated");
    expect(report.worksheets[0].clarifications).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reasonCode: "enhanced_observation_rejected",
        missingEvidence: expect.arrayContaining(["validated enhanced image observations"]),
      }),
    ]));
    expect(report.worksheets[0]).not.toHaveProperty("observationVersion");
    expect(report.worksheets[0]).not.toHaveProperty("contextSnapshot");
    expect(report.worksheets[0].statements).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "SIGNAL",
        content: expect.objectContaining({ signalKind: "image_text_context_review" }),
      }),
    ]));
    expect(summary.sources).not.toHaveProperty("observation");
    expect(summary.hashes).not.toHaveProperty("imageObservationsSha256");
    expect(result).not.toHaveProperty("imageObservationsPath");
    expect(result.observationFallback).toEqual({
      reasonCode: fallbackReasonCode,
      artifactReference: "observations.json",
      ...(mismatchPath === undefined ? {} : { mismatchPath }),
    });
    expect(existsSync(path.join(context.runRoot, "Feature5-Image-Observations.json"))).toBe(false);
  });

  it("applies enhanced-observation fallback to every worksheet without partial context", () => {
    const context = setup();
    const baselineRequest = requestForWorksheets(["Analysis-A", "Analysis-B"]);
    context.deps.loadBundle.mockReturnValue({
      status: "accepted",
      request: baselineRequest,
      rejectedWorksheets: [],
      worksheetOrder: ["Analysis-A", "Analysis-B"],
      sourceReferences: {
        f1: "Feature1-Report.json",
        f3: "Feature3-Report.json",
        f4: "Feature4-Calculation.json",
      },
      observationFallback: {
        reasonCode: "artifact_identity_mismatch",
        artifactReference: "observations.json",
      },
    });
    context.deps.createInterpretation.mockImplementation(createF5DataInterpretation);

    const result = runF5FullValidation({ args: [] }, context.deps);
    const report = readJson(result.reportJsonPath);

    expect(result.status).toBe("completed");
    expect(report.worksheets).toHaveLength(2);
    for (const worksheet of report.worksheets) {
      expect(worksheet.sections.toleranceChainValidity.status).toBe("not_evaluated");
      expect(worksheet).not.toHaveProperty("observationVersion");
      expect(worksheet).not.toHaveProperty("contextSnapshot");
      expect(worksheet.statements.some(({ type, content }) => (
        type === "SIGNAL" && content.signalKind === "image_text_context_review"
      ))).toBe(false);
      expect(worksheet.clarifications).toEqual(expect.arrayContaining([
        expect.objectContaining({ reasonCode: "enhanced_observation_rejected" }),
      ]));
    }
    expect(result).not.toHaveProperty("imageObservationsPath");
  });

  it("merges accepted and rejected worksheets and recomputes root status and summary", () => {
    const context = setup({
      rejectedWorksheets: [{
        worksheetName: "Analysis-B",
        reasonCode: "artifact_identity_mismatch",
        artifactReference: "worksheet:Analysis-B",
      }],
    });
    const result = runF5FullValidation({ args: [] }, context.deps);
    const report = readJson(result.reportJsonPath);

    expect(result.status).toBe("partially_completed");
    expect(validateAnalysisStageArtifacts({
      analysisRoot: context.publishRoot, stagePaths: { f5: context.runRoot },
      workbookFileName: report.workbook.fileName, workbookContentHash: report.workbook.contentHash,
    }, "f5")).toHaveProperty("manifest");
    expect(report).toMatchObject({
      status: "partially_completed",
      summary: { worksheetCount: 2, completedWorksheetCount: 1, inputRejectedWorksheetCount: 1 },
      worksheets: expect.arrayContaining([{
        worksheetName: "Analysis-B",
        status: "input_rejected",
        reasonCode: "artifact_identity_mismatch",
        artifactReference: "worksheet:Analysis-B",
      }]),
    });
    expect(readJson(result.manifestPath)).toEqual({
      contractVersion: "v1",
      featureId: "F5",
      status: "partially_completed",
      runId: "2026-08-11T12-00-00-000Z",
      artifacts: {
        reportJson: "Feature5-Report.json",
        reportMarkdown: "Feature5-Report.md",
        runSummary: "Feature5-Run-Summary.json",
      },
    });
  });

  it("merges loader and core rejections in the original selected worksheet order", () => {
    const context = setup({
      rejectedWorksheets: [{
        worksheetName: "Loader-Rejected",
        reasonCode: "artifact_identity_mismatch",
        artifactReference: "worksheet:Loader-Rejected",
      }],
    });
    context.deps.loadBundle.mock.results.length = 0;
    context.deps.loadBundle.mockImplementation(() => ({
      status: "accepted",
      request: request(),
      rejectedWorksheets: [{
        worksheetName: "Loader-Rejected",
        reasonCode: "artifact_identity_mismatch",
        artifactReference: "worksheet:Loader-Rejected",
      }],
      worksheetOrder: ["Loader-Rejected", "Analysis-A", "Core-Rejected"],
      sourceReferences: {
        f1: "Feature1-Report.json",
        f3: "Feature3-Report.json",
        f4: "Feature4-Calculation.json",
      },
    }));
    const coreResult = f5DataInterpretationResultSchema.parse({
      ...cloneJson(context.completed),
      status: "partially_completed",
      worksheets: [
        cloneJson(context.completed.worksheets[0]),
        {
          worksheetName: "Core-Rejected",
          status: "input_rejected",
          reasonCode: "interpretation_failed",
          artifactReference: "worksheet:Core-Rejected",
        },
      ],
      summary: {
        ...context.completed.summary,
        worksheetCount: 2,
        inputRejectedWorksheetCount: 1,
      },
    });
    context.deps.createInterpretation.mockReturnValue(coreResult);

    const result = runF5FullValidation({ args: [] }, context.deps);
    const report = readJson(result.reportJsonPath);

    expect(report.worksheets.map(({ worksheetName }) => worksheetName)).toEqual([
      "Loader-Rejected",
      "Analysis-A",
      "Core-Rejected",
    ]);
    expect(report.worksheets.map(({ status }) => status)).toEqual([
      "input_rejected",
      "completed",
      "input_rejected",
    ]);
    expect(report.summary).toMatchObject({
      worksheetCount: 3,
      completedWorksheetCount: 1,
      inputRejectedWorksheetCount: 2,
    });
  });

  it("writes an input_rejected report and failed manifest when every core worksheet is rejected", () => {
    const context = setup();
    const rejectedReport = f5DataInterpretationResultSchema.parse({
      ...cloneJson(context.completed),
      status: "input_rejected",
      worksheets: [{
        worksheetName: "Analysis-A",
        status: "input_rejected",
        reasonCode: "interpretation_failed",
        artifactReference: "worksheet:Analysis-A",
      }],
      summary: {
        worksheetCount: 1,
        completedWorksheetCount: 0,
        inputRejectedWorksheetCount: 1,
        statementCount: 0,
        clarificationCount: 0,
        assumptionCount: 0,
      },
    });
    context.deps.createInterpretation.mockReturnValue(rejectedReport);

    const result = runF5FullValidation({ args: [] }, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "input_rejected" });
    expect(f5DataInterpretationResultSchema.parse(readJson(result.reportJsonPath))).toEqual(rejectedReport);
    expect(readJson(result.runSummaryPath)).toMatchObject({ status: "input_rejected" });
    expect(readJson(result.manifestPath)).toEqual({
      contractVersion: "v1",
      featureId: "F5",
      status: "failed",
      runId: "2026-08-11T12-00-00-000Z",
      reasonCode: "input_rejected",
      artifacts: {
        reportJson: "Feature5-Report.json",
        reportMarkdown: "Feature5-Report.md",
        runSummary: "Feature5-Run-Summary.json",
      },
    });
  });

  it("returns a nonzero CLI code after publishing an all-core input_rejected report", () => {
    const context = setup();
    const rejectedReport = f5DataInterpretationResultSchema.parse({
      ...cloneJson(context.completed),
      status: "input_rejected",
      worksheets: [{
        worksheetName: "Analysis-A",
        status: "input_rejected",
        reasonCode: "interpretation_failed",
        artifactReference: "worksheet:Analysis-A",
      }],
      summary: {
        worksheetCount: 1,
        completedWorksheetCount: 0,
        inputRejectedWorksheetCount: 1,
        statementCount: 0,
        clarificationCount: 0,
        assumptionCount: 0,
      },
    });
    context.deps.createInterpretation.mockReturnValue(rejectedReport);
    const stdout = [];

    const exitCode = runF5Cli({ args: [] }, context.deps, { log: (value) => stdout.push(value) });

    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout[0])).toEqual({ status: "failed", reasonCode: "input_rejected" });
  });

  it("writes only a failed manifest when the loader rejects all input", () => {
    const context = setup();
    context.deps.loadBundle.mockReturnValue({
      status: "inputRejected",
      reasonCode: "artifact_contract_invalid",
      artifactReference: "Feature1-Report.json",
    });

    const result = runF5FullValidation({ args: [] }, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "input_rejected" });
    expect(readdirSync(context.runRoot)).toEqual(["manifest.json"]);
    expect(readJson(result.manifestPath)).toEqual({
      contractVersion: "v1",
      featureId: "F5",
      status: "failed",
      runId: "2026-08-11T12-00-00-000Z",
      reasonCode: "input_rejected",
      artifacts: {},
    });
    expect(context.deps.createInterpretation).not.toHaveBeenCalled();
  });

  it.each([
    ["core throw", "interpretation_failed", (context) => context.deps.createInterpretation.mockImplementation(() => { throw new Error("C:\\secret\\core.txt token=abc"); })],
    ["invalid core schema", "interpretation_failed", (context) => context.deps.createInterpretation.mockReturnValue({ status: "completed" })],
    ["render throw", "workflow_output_failed", (context) => context.deps.renderReport.mockImplementation(() => { throw new Error("C:\\secret\\render.txt password=abc"); })],
  ])("contains %s without leaking errors", (_label, reasonCode, mutate) => {
    const context = setup();
    mutate(context);
    const result = runF5FullValidation({ args: [] }, context.deps);
    const serialized = JSON.stringify(result) + readFileSync(result.manifestPath, "utf8");

    expect(result).toMatchObject({ status: "failed", reasonCode });
    expect(serialized).not.toMatch(/secret|token|password|core\.txt|render\.txt/i);
  });

  it("preserves written files and lists only committed artifacts after a later write failure", () => {
    const context = setup();
    context.deps.rename = (from, to) => {
      if (path.basename(to) === "Feature5-Run-Summary.json") throw new Error("rename failed");
      renameSync(from, to);
    };

    const result = runF5FullValidation({ args: [] }, context.deps);
    const manifest = readJson(result.manifestPath);

    expect(result).toMatchObject({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(manifest.artifacts).toEqual({
      reportJson: "Feature5-Report.json",
      reportMarkdown: "Feature5-Report.md",
    });
    expect(manifest).toEqual({
      contractVersion: "v1",
      featureId: "F5",
      status: "failed",
      runId: "2026-08-11T12-00-00-000Z",
      reasonCode: "workflow_output_failed",
      artifacts: {
        reportJson: "Feature5-Report.json",
        reportMarkdown: "Feature5-Report.md",
      },
    });
    expect(existsSync(path.join(context.runRoot, "Feature5-Run-Summary.json"))).toBe(false);
    expect(readdirSync(context.runRoot).some((name) => name.endsWith(".tmp"))).toBe(false);
  });

  it("returns workflow_output_failed when every manifest rename fails", () => {
    const context = setup();
    context.deps.rename = (from, to) => {
      if (path.basename(to) === "manifest.json") throw new Error("manifest rename failed");
      renameSync(from, to);
    };

    const result = runF5FullValidation({ args: [] }, context.deps);

    expect(result).toEqual({
      status: "failed",
      reasonCode: "workflow_output_failed",
      outputDirectory: context.runRoot,
    });
    expect(existsSync(path.join(context.runRoot, "manifest.json"))).toBe(false);
    expect(readdirSync(context.runRoot).some((name) => name.endsWith(".tmp"))).toBe(false);
  });

  it("keeps the run summary path-safe and records counts and hashes", () => {
    const context = setup();
    const result = runF5FullValidation({ args: [] }, context.deps);
    const summaryText = readFileSync(result.runSummaryPath, "utf8");
    const summary = JSON.parse(summaryText);

    expect(summaryText).not.toContain(context.root);
    expect(summary).toMatchObject({
      status: "completed",
      sources: {
        f1: "Feature1-Report.json",
        f3: "Feature3-Report.json",
        f4: "Feature4-Calculation.json",
      },
      counts: { worksheetCount: 1, completedWorksheetCount: 1, inputRejectedWorksheetCount: 0 },
      hashes: {
        reportJsonSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        reportMarkdownSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
  });

  it("refuses a pre-existing run root without changing it", () => {
    const context = setup();
    mkdirSync(context.runRoot, { recursive: true });
    const stalePath = path.join(context.runRoot, "Feature5-Report.md");
    writeFileSync(stalePath, "stale\n", "utf8");

    expect(() => runF5FullValidation({ args: [] }, context.deps)).toThrow();
    expect(readFileSync(stalePath, "utf8")).toBe("stale\n");
    expect(context.deps.loadBundle).not.toHaveBeenCalled();
  });

  it("revalidates run root containment after directory creation and before file writes", () => {
    const context = setup();
    const outsideRoot = path.join(context.root, "outside", "run-1");
    context.deps.realpath = vi.fn((target) => (
      path.resolve(target) === path.resolve(context.runRoot)
        ? outsideRoot
        : path.resolve(target)
    ));

    expect(() => runF5FullValidation({ args: [] }, context.deps)).toThrow(/publish root|contain|outside/i);
    expect(context.deps.loadBundle).not.toHaveBeenCalled();
    expect(existsSync(context.runRoot)).toBe(false);
  });

  it("rejects a loader-time run-root junction replacement before the first write", () => {
    const context = setup();
    const outsideRoot = path.join(context.root, "outside-loader");
    mkdirSync(outsideRoot);
    context.deps.loadBundle.mockImplementation(() => {
      rmSync(context.runRoot, { recursive: true, force: true });
      symlinkSync(outsideRoot, context.runRoot, process.platform === "win32" ? "junction" : "dir");
      return {
        status: "accepted",
        request: request(),
        rejectedWorksheets: [],
        sourceReferences: {
          f1: "Feature1-Report.json",
          f3: "Feature3-Report.json",
          f4: "Feature4-Calculation.json",
        },
      };
    });

    const result = runF5FullValidation({ args: [] }, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(readdirSync(outsideRoot)).toEqual([]);
    expect(context.renameCalls).toEqual([]);
  });

  it("rejects run-root replacement after temp writing and before rename without writing outside", () => {
    const context = setup();
    const outsideRoot = path.join(context.root, "outside-rename");
    const displacedRunRoot = path.join(context.root, "displaced-run-root");
    const token = "11111111-1111-4111-8111-111111111111";
    const outsideSentinel = path.join(outsideRoot, `Feature5-Report.json.${token}.tmp`);
    mkdirSync(outsideRoot);
    writeFileSync(outsideSentinel, "outside-sentinel", "utf8");
    context.deps.randomUUID = vi.fn(() => token);
    let replaced = false;
    context.deps.close = (fd) => {
      closeSync(fd);
      if (!replaced) {
        replaced = true;
        renameSync(context.runRoot, displacedRunRoot);
        symlinkSync(outsideRoot, context.runRoot, process.platform === "win32" ? "junction" : "dir");
      }
    };

    const result = runF5FullValidation({ args: [] }, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(readFileSync(outsideSentinel, "utf8")).toBe("outside-sentinel");
    expect(context.renameCalls).toEqual([]);
  });

  it("fails closed in workspace mode when the pinned destination is swapped before the first write", () => {
    const context = setup();
    mkdirSync(context.runRoot, { recursive: true });
    const pinnedRunRootIdentity = directoryIdentity(context.runRoot);
    const pinnedPublishRootIdentity = directoryIdentity(context.publishRoot);
    const outsideRoot = path.join(context.root, "workspace-outside-before-first-write");
    mkdirSync(outsideRoot);
    context.deps.resolveLayout = () => ({
      runId: "2026-08-11T12-00-00-000Z",
      runRoot: context.runRoot,
      publishRoot: context.publishRoot,
      reportJsonName: "Feature5-Report.json",
      reportMdName: "Feature5-Report.md",
      runSummaryJsonName: "Feature5-Run-Summary.json",
      imageObservationsJsonName: "Feature5-Image-Observations.json",
      manifestName: "manifest.json",
      allowExistingRunRoot: true,
      workspaceBoundary: {
        publishRootIdentity: pinnedPublishRootIdentity,
        runRootIdentity: pinnedRunRootIdentity,
      },
    });
    context.deps.loadBundle.mockImplementation(() => {
      rmSync(context.runRoot, { recursive: true, force: true });
      symlinkSync(outsideRoot, context.runRoot, process.platform === "win32" ? "junction" : "dir");
      return {
        status: "accepted",
        request: request(),
        rejectedWorksheets: [],
        sourceReferences: {
          f1: "Feature1-Report.json",
          f3: "Feature3-Report.json",
          f4: "Feature4-Calculation.json",
        },
      };
    });

    const result = runF5FullValidation({ args: [] }, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(readdirSync(outsideRoot)).toEqual([]);
    expect(context.renameCalls).toEqual([]);
    expect(existsSync(path.join(context.runRoot, "manifest.json"))).toBe(false);
  });

  it("fails closed in workspace mode when the pinned destination is swapped between writes and rename", () => {
    const context = setup();
    mkdirSync(context.runRoot, { recursive: true });
    const pinnedRunRootIdentity = directoryIdentity(context.runRoot);
    const pinnedPublishRootIdentity = directoryIdentity(context.publishRoot);
    const outsideRoot = path.join(context.root, "workspace-outside-between-writes");
    const displacedRunRoot = path.join(context.root, "workspace-displaced-run-root");
    const token = "11111111-1111-4111-8111-111111111111";
    const outsideSentinel = path.join(outsideRoot, `Feature5-Report.json.${token}.tmp`);
    mkdirSync(outsideRoot);
    writeFileSync(outsideSentinel, "outside-sentinel", "utf8");
    context.deps.resolveLayout = () => ({
      runId: "2026-08-11T12-00-00-000Z",
      runRoot: context.runRoot,
      publishRoot: context.publishRoot,
      reportJsonName: "Feature5-Report.json",
      reportMdName: "Feature5-Report.md",
      runSummaryJsonName: "Feature5-Run-Summary.json",
      imageObservationsJsonName: "Feature5-Image-Observations.json",
      manifestName: "manifest.json",
      allowExistingRunRoot: true,
      workspaceBoundary: {
        publishRootIdentity: pinnedPublishRootIdentity,
        runRootIdentity: pinnedRunRootIdentity,
      },
    });
    context.deps.randomUUID = vi.fn(() => token);
    let replaced = false;
    context.deps.close = (fd) => {
      closeSync(fd);
      if (!replaced) {
        replaced = true;
        renameSync(context.runRoot, displacedRunRoot);
        symlinkSync(outsideRoot, context.runRoot, process.platform === "win32" ? "junction" : "dir");
      }
    };

    const result = runF5FullValidation({ args: [] }, context.deps);

    expect(result).toMatchObject({ status: "failed", reasonCode: "workflow_output_failed" });
    expect(readFileSync(outsideSentinel, "utf8")).toBe("outside-sentinel");
    expect(context.renameCalls).toEqual([]);
    expect(existsSync(path.join(outsideRoot, "manifest.json"))).toBe(false);
  });

  it("returns controlled invalid-argument JSON and a nonzero exit code from the direct CLI", () => {
    const child = spawnSync(process.execPath, ["scripts/run-f5-full-validation.mjs"], {
      cwd: path.resolve("."),
      encoding: "utf8",
    });

    expect(child.status).toBe(1);
    expect(JSON.parse(child.stdout)).toEqual({
      status: "failed",
      reasonCode: "invalid_arguments_or_output_root",
    });
    expect(child.stdout).not.toMatch(/requires|path|error/i);
    expect(child.stderr).toBe("");
  });

  it("prints workflow_output_failed from the injectable CLI when manifest output cannot commit", async () => {
    const context = setup();
    const stdout = [];
    context.deps.rename = (from, to) => {
      if (path.basename(to) === "manifest.json") throw new Error("manifest rename failed");
      renameSync(from, to);
    };
    const runner = await import("./run-f5-full-validation.mjs");

    expect(runner.runF5Cli).toBeTypeOf("function");
    const exitCode = runner.runF5Cli(
      { args: [] },
      context.deps,
      { log: (value) => stdout.push(value) },
    );

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([JSON.stringify({
      status: "failed",
      reasonCode: "workflow_output_failed",
    }, null, 2)]);
  });

  it("preserves a known controlled workflow output error at the CLI boundary", async () => {
    const context = setup();
    const stdout = [];
    context.deps.mkdir = () => {
      throw Object.assign(new Error("controlled output failure"), {
        reasonCode: "workflow_output_failed",
      });
    };
    const { runF5Cli } = await import("./run-f5-full-validation.mjs");

    const exitCode = runF5Cli(
      { args: [] },
      context.deps,
      { log: (value) => stdout.push(value) },
    );

    expect(exitCode).toBe(1);
    expect(stdout).toEqual([JSON.stringify({
      status: "failed",
      reasonCode: "workflow_output_failed",
    }, null, 2)]);
  });

  it("runs the real Node process with schema-valid F1, F3, and F4 artifact roots", () => {
    const bundle = createRealArtifactBundle();
    const stdout = execFileSync(process.execPath, [
      "scripts/run-f5-full-validation.mjs",
      bundle.f1ArtifactRoot,
      bundle.f3ArtifactRoot,
      bundle.f4ArtifactRoot,
    ], {
      cwd: path.resolve("."),
      encoding: "utf8",
      env: {
        ...process.env,
        AI_TVA_F5_OUTPUT_ROOT: bundle.outputRoot,
        AI_TVA_F5_PUBLISH_ROOT: bundle.publishRoot,
      },
    });
    const result = JSON.parse(stdout);

    expect(result.status).toBe("completed");
    expect(readdirSync(result.outputDirectory).sort()).toEqual([
      "Feature5-Report.json",
      "Feature5-Report.md",
      "Feature5-Run-Summary.json",
      "manifest.json",
    ].sort());
    expect(f5DataInterpretationResultSchema.parse(readJson(result.reportJsonPath))).toMatchObject({
      status: "completed",
      summary: { worksheetCount: 1, completedWorksheetCount: 1, inputRejectedWorksheetCount: 0 },
    });
    expect(readFileSync(result.reportMdPath, "utf8")).toContain("Feature 5");
    expect(readJson(result.runSummaryPath)).toMatchObject({ status: "completed" });
    expect(readJson(result.manifestPath)).toEqual({
      contractVersion: "v1",
      featureId: "F5",
      status: "completed",
      runId: expect.any(String),
      artifacts: {
        reportJson: "Feature5-Report.json",
        reportMarkdown: "Feature5-Report.md",
        runSummary: "Feature5-Run-Summary.json",
      },
    });
  });

  it("routes workspace F5 publication directly into the fixed stage without f5-runs or hash directories", () => {
    const bundle = createRealArtifactBundle();
    const workspace = createAnalysisWorkspaceRoot(bundle.root);
    rmSync(workspace.stagePaths.f1, { recursive: true, force: true });
    rmSync(workspace.stagePaths.f3, { recursive: true, force: true });
    rmSync(workspace.stagePaths.f4, { recursive: true, force: true });
    renameSync(bundle.f1ArtifactRoot, workspace.stagePaths.f1);
    renameSync(bundle.f3ArtifactRoot, workspace.stagePaths.f3);
    renameSync(bundle.f4ArtifactRoot, workspace.stagePaths.f4);

    prepareWorkspaceStage(workspace, "f5");
    const child = runWorkspaceDirectProcess(workspace);

    expect(child.status).toBe(0);
    expect(child.stderr).toBe("");
    const result = JSON.parse(child.stdout);
    expect(result.outputDirectory).toBe(workspace.stagePaths.f5);
    expect(result.reportJsonPath).toBe(path.join(workspace.stagePaths.f5, "Feature5-Report.json"));
    expect(result.runSummaryPath).toBe(path.join(workspace.stagePaths.f5, "Feature5-Run-Summary.json"));
    expect(result.manifestPath).toBe(path.join(workspace.stagePaths.f5, "manifest.json"));
    expect(existsSync(path.join(workspace.analysisRoot, "f5-runs"))).toBe(false);
    expect(existsSync(path.join(workspace.analysisRoot, "f5-observations"))).toBe(false);
  });

  it("fails closed on a dirty workspace stage before loading or rewriting any F5 artifacts", () => {
    const bundle = createRealArtifactBundle();
    const workspace = createAnalysisWorkspaceRoot(bundle.root);
    rmSync(workspace.stagePaths.f1, { recursive: true, force: true });
    rmSync(workspace.stagePaths.f3, { recursive: true, force: true });
    rmSync(workspace.stagePaths.f4, { recursive: true, force: true });
    renameSync(bundle.f1ArtifactRoot, workspace.stagePaths.f1);
    renameSync(bundle.f3ArtifactRoot, workspace.stagePaths.f3);
    renameSync(bundle.f4ArtifactRoot, workspace.stagePaths.f4);
    const staleManifestPath = path.join(workspace.stagePaths.f5, "manifest.json");
    writeFileSync(staleManifestPath, '{"status":"completed"}\n', "utf8");

    prepareWorkspaceStage(workspace, "f5");
    const child = runWorkspaceDirectProcess(workspace);

    expect(child.status).toBe(1);
    expect(JSON.parse(child.stdout)).toEqual({
      status: "failed",
      reasonCode: "workspace_stage_not_empty",
    });
    expect(child.stderr).toBe("");
    expect(readFileSync(staleManifestPath, "utf8")).toBe('{"status":"completed"}\n');
  });

  it("fails closed on unrelated workspace debris without changing bytes or entries", () => {
    const bundle = createRealArtifactBundle();
    const workspace = createAnalysisWorkspaceRoot(bundle.root);
    rmSync(workspace.stagePaths.f1, { recursive: true, force: true });
    rmSync(workspace.stagePaths.f3, { recursive: true, force: true });
    rmSync(workspace.stagePaths.f4, { recursive: true, force: true });
    renameSync(bundle.f1ArtifactRoot, workspace.stagePaths.f1);
    renameSync(bundle.f3ArtifactRoot, workspace.stagePaths.f3);
    renameSync(bundle.f4ArtifactRoot, workspace.stagePaths.f4);
    const debrisFilePath = path.join(workspace.stagePaths.f5, "unrelated-note.txt");
    const debrisDirPath = path.join(workspace.stagePaths.f5, "debris-folder");
    writeFileSync(debrisFilePath, "do not touch\n", "utf8");
    mkdirSync(debrisDirPath);
    const beforeEntries = readdirSync(workspace.stagePaths.f5).sort();
    const beforeBytes = readFileSync(debrisFilePath, "utf8");

    prepareWorkspaceStage(workspace, "f5");
    const child = runWorkspaceDirectProcess(workspace);

    expect(child.status).toBe(1);
    expect(JSON.parse(child.stdout)).toEqual({
      status: "failed",
      reasonCode: "workspace_stage_not_empty",
    });
    expect(child.stderr).toBe("");
    expect(readdirSync(workspace.stagePaths.f5).sort()).toEqual(beforeEntries);
    expect(readFileSync(debrisFilePath, "utf8")).toBe(beforeBytes);
  });

  it.each([
    ["missing", (observationPath) => observationPath],
    ["malformed JSON", (observationPath) => {
      writeFileSync(observationPath, "{malformed observation", "utf8");
      return observationPath;
    }],
  ])("completes the real workflow without partial observation output for a %s optional artifact", (
    _case,
    prepareObservation,
  ) => {
    const bundle = createRealArtifactBundle();
    const observationPath = prepareObservation(path.join(bundle.root, "optional-observations.json"));
    const child = runDirectProcess(bundle, observationPath);

    expect(child.status).toBe(0);
    expect(child.stderr).toBe("");
    const result = JSON.parse(child.stdout);
    const summary = readJson(result.runSummaryPath);
    expect(result.status).toBe("completed");
    expect(result).not.toHaveProperty("imageObservationsPath");
    expect(readdirSync(result.outputDirectory)).not.toContain("Feature5-Image-Observations.json");
    expect(summary.sources).not.toHaveProperty("observation");
    expect(summary.hashes).not.toHaveProperty("imageObservationsSha256");
  });

  it("runs the package workflow:f5 script with an isolated successful fixture", () => {
    const bundle = createRealArtifactBundle();
    const npmExecutable = process.platform === "win32" ? process.execPath : "npm";
    const npmPrefixArgs = process.platform === "win32" ? [process.env.npm_execpath] : [];
    const child = spawnSync(npmExecutable, [
      ...npmPrefixArgs,
      "run",
      "--silent",
      "workflow:f5",
      "--",
      bundle.f1ArtifactRoot,
      bundle.f3ArtifactRoot,
      bundle.f4ArtifactRoot,
    ], {
      cwd: path.resolve("."),
      encoding: "utf8",
      env: {
        ...process.env,
        AI_TVA_F5_OUTPUT_ROOT: bundle.outputRoot,
        AI_TVA_F5_PUBLISH_ROOT: bundle.publishRoot,
        npm_config_update_notifier: "false",
      },
      shell: false,
    });

    expect(child.error).toBeUndefined();
    expect(child.status).toBe(0);
    expect(child.stderr).toBe("");
    const result = JSON.parse(child.stdout);
    expect(result.status).toBe("completed");
    expect(readJson(result.manifestPath)).toEqual({
      contractVersion: "v1",
      featureId: "F5",
      status: "completed",
      runId: expect.any(String),
      artifacts: {
        reportJson: "Feature5-Report.json",
        reportMarkdown: "Feature5-Report.md",
        runSummary: "Feature5-Run-Summary.json",
      },
    });
  });

  it.each([
    ["missing artifact", (bundle) => rmSync(path.join(bundle.f1ArtifactRoot, "Feature1-Report.json"))],
    ["invalid artifact", (bundle) => writeFileSync(
      path.join(bundle.f3ArtifactRoot, "Feature3-Report.json"),
      `{"sensitive":"${bundle.root}"`,
      "utf8",
    )],
  ])("rejects %s through the real Node process without leaking details", (_label, corrupt) => {
    const bundle = createRealArtifactBundle();
    corrupt(bundle);
    const child = runDirectProcess(bundle);

    expect(child.status).not.toBe(0);
    expect(JSON.parse(child.stdout)).toMatchObject({ status: "failed", reasonCode: "input_rejected" });
    expect(child.stdout).not.toContain(bundle.root);
    expect(child.stdout).not.toMatch(/[A-Z]:\\|sensitive|password|token|secret/i);
    expect(child.stderr).toBe("");
  });

  it("can be imported by a real Node process without side effects", () => {
    const stdout = execFileSync(process.execPath, [
      "--input-type=module",
      "-e",
      "import('./scripts/run-f5-full-validation.mjs').then(m => console.log(typeof m.runF5FullValidation))",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    expect(stdout.trim()).toBe("function");
  });

  it("uses SHA-256 for output hashes", () => {
    const context = setup();
    const result = runF5FullValidation({ args: [] }, context.deps);
    const summary = readJson(result.runSummaryPath);
    const reportJson = readFileSync(result.reportJsonPath);

    expect(summary.hashes.reportJsonSha256).toBe(createHash("sha256").update(reportJson).digest("hex"));
  });
});