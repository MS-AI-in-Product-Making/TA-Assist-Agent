import { afterEach, describe, expect, it } from "vitest";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  fstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createF5MultimodalFactorSetHash, createF5MultimodalRequestHash, f5MultimodalArtifactV3Schema } from "../packages/contracts/dist/ta-multimodal-contracts.js";
import { createCalculation } from "../packages/workbook-catalog/dist/calculation.js";
import { createF5DataInterpretation } from "../packages/workbook-catalog/dist/f5-data-interpretation.js";
import {
  createF6ArtifactBundleFixture,
  F6_FIXTURE_RUN_ID,
  F6_FIXTURE_WORKBOOK_HASH,
  installF5CurrentObservationLedger,
  installF6ModelInterpretation,
  installF6V2Evidence,
  installF6VersionedContextAndTargets,
  readFixtureJson as readJson,
  rewriteFixtureJson as rewriteJson,
  writeFixtureJson as writeJson,
} from "./f6-artifact-test-fixture.mjs";
import { loadF6ArtifactBundle } from "./f6-artifact-loader.mjs";

const roots = [];
const WORKBOOK_HASH = F6_FIXTURE_WORKBOOK_HASH;
const RUN_ID = F6_FIXTURE_RUN_ID;
const MAX_JSON_BYTES = 10 * 1024 * 1024;

function fileSymlinksAvailable() {
  const probeRoot = mkdtempSync(path.join(tmpdir(), "f6-symlink-probe-"));
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

const FILE_SYMLINKS_AVAILABLE = fileSymlinksAvailable();

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function setupBundle({ worksheetNames = ["Analysis-A"], blockedWorksheetNames = [] } = {}) {
  const bundle = createF6ArtifactBundleFixture({ worksheetNames, blockedWorksheetNames });
  roots.push(bundle.root);
  return bundle;
}

function installRequiredMultimodalV3(bundle) {
  const f2 = readJson(bundle.paths.f2);
  const f5 = readJson(bundle.paths.f5);
  const worksheets = bundle.selectedWorksheetNames.map((worksheetName, index) => {
    const calculation = bundle.calculations[index];
    const factor = calculation.factors[0];
    const sourceRow = factor.source.sourceRow;
    const f2Row = f2.worksheets.find((worksheet) => worksheet.worksheetName === worksheetName).rows[0];
    const image = f5.worksheets.find((worksheet) => worksheet.worksheetName === worksheetName).imageReference;
    const factorRows = [{
      worksheetName,
      tableId: calculation.worksheetSelection.tableId,
      sourceRow,
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
      sourceCells: f2Row.sourceCells,
    }];
    const request = {
      contractVersion: "f5-multimodal-request-v3",
      inputClassification: "confidential",
      requestHash: "",
      sessionId: "11111111-1111-4111-8111-111111111111",
      revision: 7,
      inputRevision: 3,
      workbook: { fileName: f2.workbook.fileName, contentHash: f2.workbook.contentHash },
      worksheetName,
      tableId: calculation.worksheetSelection.tableId,
      activeFactorCount: factorRows.length,
      factorSetHash: createF5MultimodalFactorSetHash(factorRows),
      image: { mediaType: "image/png", contentHash: image.contentHash, byteLength: 100, artifactPath: image.relativePath },
      factorRows,
    };
    request.requestHash = createF5MultimodalRequestHash(request);
    return {
      request,
      result: {
        contractVersion: "f5-multimodal-result-v3",
        outputClassification: "confidential",
        requestHash: request.requestHash,
        sessionId: request.sessionId,
        revision: request.revision,
        inputRevision: request.inputRevision,
        workbookContentHash: request.workbook.contentHash,
        worksheetName,
        tableId: request.tableId,
        imageContentHash: request.image.contentHash,
        model: { modelId: "vision-model", supportsImage: true },
        imageTableInterpretation: `Image and complete Factor table interpreted for ${worksheetName}.`,
        rowMappings: factorRows.map((row) => ({ worksheetName, tableId: row.tableId, sourceRow: row.sourceRow, factorOrdinal: row.factorOrdinal, mappingStatus: "matched", visibleStatus: "visible", interpretation: `${row.factorOrdinal.value} is visible.` })),
      },
    };
  });
  const artifact = { contractVersion: "f5-multimodal-artifact-v3", outputClassification: "confidential", sessionId: worksheets[0].request.sessionId, revision: 7, inputRevision: 3, workbookContentHash: WORKBOOK_HASH, selectedWorksheetNames: [...bundle.selectedWorksheetNames], worksheets };
  f5MultimodalArtifactV3Schema.parse(artifact);
  const modelInterpretationArtifactRoot = path.join(bundle.publishRoot, "multimodal");
  const modelInterpretationArtifact = "interpretation-v3.json";
  const filePath = path.join(modelInterpretationArtifactRoot, modelInterpretationArtifact);
  writeJson(filePath, artifact);
  Object.assign(bundle, { requireMultimodalV3: true, modelInterpretationArtifactRoot, modelInterpretationArtifact, expectedModelInterpretationContentHash: sha256(filePath) });
  return artifact;
}

function installRequiredMixedMultimodalV4(bundle, { failedWorksheetName = "Analysis-B", reasonCode = "evaluation_failed", summary = "worksheet image evaluation failed" } = {}) {
  const f2 = readJson(bundle.paths.f2);
  const f5 = readJson(bundle.paths.f5);
  const worksheets = bundle.selectedWorksheetNames.map((worksheetName, index) => {
    const calculation = bundle.calculations[index];
    const factor = calculation.factors[0];
    const sourceRow = factor.source.sourceRow;
    const f2Row = f2.worksheets.find((worksheet) => worksheet.worksheetName === worksheetName).rows[0];
    const image = f5.worksheets.find((worksheet) => worksheet.worksheetName === worksheetName).imageReference;
    const factorRows = [{
      worksheetName,
      tableId: calculation.worksheetSelection.tableId,
      sourceRow,
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
      sourceCells: f2Row.sourceCells,
    }];
    const request = {
      contractVersion: "f5-multimodal-request-v3",
      inputClassification: "confidential",
      requestHash: "",
      sessionId: "11111111-1111-4111-8111-111111111111",
      revision: 7,
      inputRevision: 3,
      workbook: { fileName: f2.workbook.fileName, contentHash: f2.workbook.contentHash },
      worksheetName,
      tableId: calculation.worksheetSelection.tableId,
      activeFactorCount: factorRows.length,
      factorSetHash: createF5MultimodalFactorSetHash(factorRows),
      image: { mediaType: "image/png", contentHash: image.contentHash, byteLength: 100, artifactPath: image.relativePath },
      factorRows,
    };
    request.requestHash = createF5MultimodalRequestHash(request);
    if (worksheetName === failedWorksheetName) {
      return { status: "failed", request, reasonCode, summary };
    }
    return {
      status: "completed",
      request,
      scopeEvaluations: requiredScopeEvaluations(),
      result: {
        contractVersion: "f5-multimodal-result-v3",
        outputClassification: "confidential",
        requestHash: request.requestHash,
        sessionId: request.sessionId,
        revision: request.revision,
        inputRevision: request.inputRevision,
        workbookContentHash: request.workbook.contentHash,
        worksheetName,
        tableId: request.tableId,
        imageContentHash: request.image.contentHash,
        model: { modelId: "vision-model", supportsImage: true },
        imageTableInterpretation: `Image and complete Factor table interpreted for ${worksheetName}.`,
        rowMappings: factorRows.map((row) => ({ worksheetName, tableId: row.tableId, sourceRow: row.sourceRow, factorOrdinal: row.factorOrdinal, mappingStatus: "matched", visibleStatus: "visible", interpretation: `${row.factorOrdinal.value} is visible.` })),
      },
    };
  });
  const artifact = {
    contractVersion: "f5-multimodal-artifact-v4",
    outputClassification: "confidential",
    sessionId: "11111111-1111-4111-8111-111111111111",
    revision: 7,
    inputRevision: 3,
    workbookContentHash: WORKBOOK_HASH,
    selectedWorksheetNames: [...bundle.selectedWorksheetNames],
    worksheets,
  };
  const modelInterpretationArtifactRoot = path.join(bundle.publishRoot, "multimodal");
  const modelInterpretationArtifact = "interpretation-v4.json";
  const filePath = path.join(modelInterpretationArtifactRoot, modelInterpretationArtifact);
  writeJson(filePath, artifact);
  Object.assign(bundle, { requireMultimodalV3: true, modelInterpretationArtifactRoot, modelInterpretationArtifact, expectedModelInterpretationContentHash: sha256(filePath) });
  return artifact;
}

function requiredScopeEvaluations() {
  return ["tolerance_loop_closure", "datum_chain", "assembly_datum_face", "stack_start", "direction"].map((scope) => ({
    scope, status: "insufficient_evidence", observedValue: "ambiguous", confidence: "low",
    visibleBasis: "The supplied image does not establish this geometry.",
  }));
}

function keepCompletedF5WorksheetOnly(bundle, completedWorksheetName) {
  rewriteJson(bundle.paths.f5, (report) => {
    report.worksheets = report.worksheets.filter((worksheet) => worksheet.worksheetName === completedWorksheetName);
    report.status = "completed";
    report.summary.worksheetCount = report.worksheets.length;
    report.summary.completedWorksheetCount = report.worksheets.length;
    report.summary.inputRejectedWorksheetCount = 0;
    report.summary.statementCount = report.worksheets.reduce((count, worksheet) => count + worksheet.statements.length, 0);
    report.summary.clarificationCount = report.worksheets.reduce((count, worksheet) => count + worksheet.clarifications.length, 0);
    report.summary.assumptionCount = report.worksheets.reduce((count, worksheet) => count + worksheet.assumptions.length, 0);
  });
}

describe("loadF6ArtifactBundle", () => {
  it("accepts an all-ready governed bundle and preserves the validated F4 baseline request", () => {
    const bundle = setupBundle();

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.blockedWorksheets).toEqual([]);
    expect(result.request.selectedWorksheetNames).toEqual(["Analysis-A"]);
    expect(result.request.reportScope).toEqual({
      worksheetNames: ["Analysis-A"],
      blockedWorksheetNames: [],
    });
    expect(result.request.f0Versions).toEqual({
      knowledgeBaseVersion: "v1",
      capabilityVersion: "internal-v1",
      interpretationVersion: "interpretation-rules-v2",
    });
    expect(result.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(result.request.worksheets[0].f4CalculationIndex).toBe(1);
    expect(result.request.worksheets[0].baselineCalculationRequest.runReference).toBe(`${RUN_ID}-1`);
    expect(result.f2Report.worksheets[0].systemSpecification.designNominal).toMatchObject({
      status: "available",
      actualValue: -0.05,
      displayValue: "-0.05",
    });
    expect(result.request.worksheets[0].baselineCalculationRequest.systemSpecification.designNominal).toBe(
      result.f2Report.worksheets[0].systemSpecification.designNominal.actualValue,
    );
    expect(createCalculation(result.request.worksheets[0].baselineCalculationRequest)).toEqual(
      result.request.worksheets[0].baselineCalculation,
    );
    expect(result.f2Report).toEqual(JSON.parse(readFileSync(bundle.paths.f2, "utf8")));
    expect(result.f5Report).toEqual(JSON.parse(readFileSync(bundle.paths.f5, "utf8")));
    expect(result.f3Report).toEqual(readJson(bundle.paths.f3));
    expect(result.f4Report).toEqual(readJson(bundle.paths.f4));
    expect(result.f3Report.workbook.contentHash).toBe(result.request.workbook.contentHash);
    expect(result.sourceReferences).toEqual({
      f2: { artifact: "Feature2-Report.json", contentHash: sha256(bundle.paths.f2) },
      f3: { artifact: "Feature3-Report.json", contentHash: sha256(bundle.paths.f3) },
      f4: { artifact: "Feature4-Calculation.json", contentHash: sha256(bundle.paths.f4), runId: RUN_ID, calculationVersion: "excel-ta-v1" },
      f5: { artifact: "Feature5-Report.json", contentHash: sha256(bundle.paths.f5), interpretationVersion: "f5-data-interpretation-v1" },
    });
    expect(JSON.stringify(result)).not.toContain(rootPath(bundle));
  });

  it("accepts an F5 manifest with a run summary and no image observations", () => {
    const bundle = setupBundle();
    writeJson(path.join(bundle.f5ArtifactRoot, "manifest.json"), {
      contractVersion: "v1",
      featureId: "F5",
      status: "completed",
      runId: "2026-09-07T02-53-42-698Z",
      artifacts: {
        reportJson: "Feature5-Report.json",
        reportMarkdown: "Feature5-Report.md",
        runSummary: "Feature5-Run-Summary.json",
      },
    });

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
  });

  it("loads identity-bound Analysis Context and Optimization Targets with caller-authorized decisions", () => {
    const bundle = setupBundle();
    const baseline = loadF6ArtifactBundle(bundle);
    expect(baseline.status).toBe("accepted");
    const worksheet = baseline.request.worksheets[0];
    const calculation = worksheet.baselineCalculation;
    const factor = calculation.factors[0];
    const factorIdentity = {
      worksheetName: factor.source.worksheetName,
      tableId: factor.source.tableId,
      sourceRow: factor.source.sourceRow,
      factorName: factor.factorName,
      unit: factor.unit,
    };
    const baselineIdentity = {
      calculationVersion: calculation.calculationVersion,
      projectReference: calculation.projectReference,
      runReference: calculation.runReference,
      workbookContentHash: calculation.workbookContentHash,
      worksheetName: calculation.worksheetSelection.worksheetName,
      tableId: calculation.worksheetSelection.tableId,
    };
    const evidenceArtifactRoot = setupEvidenceRoot(bundle);
    bundle.analysisContextArtifact = "context.json";
    bundle.optimizationTargetsArtifact = "targets.json";
    const evidence = {
      artifactReference: { artifact: "Feature4-Calculation.json", contentHash: sha256(bundle.paths.f4) },
      worksheetName: worksheet.worksheetName,
      sourceRows: [{ worksheetName: worksheet.worksheetName, tableId: factor.source.tableId, sourceRow: factor.source.sourceRow }],
    };
    writeJson(path.join(evidenceArtifactRoot, bundle.analysisContextArtifact), {
      contractVersion: "v1",
      inputClassification: "confidential",
      contextVersion: "f6-analysis-context-v1",
      workbookContentHash: WORKBOOK_HASH,
      worksheets: [{
        worksheetName: worksheet.worksheetName,
        tableId: calculation.worksheetSelection.tableId,
        baselineIdentity,
        analysisObject: { kind: "GAP", name: "Gap A", physicalMeaning: "Controlled clearance.", measurementDirection: "Z", positiveDirectionDefinition: "Increasing clearance.", negativeDirectionDefinition: "Increasing interference.", evidence },
        operatingConditions: [],
        correlationRequirement: { mode: "NOT_PROVIDED" },
      }],
    });
    writeJson(path.join(evidenceArtifactRoot, bundle.optimizationTargetsArtifact), {
      contractVersion: "v1",
      inputClassification: "confidential",
      targetVersion: "f6-optimization-targets-v1",
      workbookContentHash: WORKBOOK_HASH,
      worksheets: [{ worksheetName: worksheet.worksheetName, tableId: calculation.worksheetSelection.tableId, baselineIdentity, targets: [{ targetId: "target-a", targetType: "improvement_ratio", factor: factorIdentity, ratio: 0.2, appliesTo: "tolerance_band" }] }],
    });

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.analysisContext.contextVersion).toBe("f6-analysis-context-v1");
    expect(result.optimizationTargets.targetVersion).toBe("f6-optimization-targets-v1");
    expect(result.inputDecisions.analysisContext.outcome).toBe("CALLER_AUTHORIZED");
    expect(result.inputDecisions.optimizationTargets.outcome).toBe("CALLER_AUTHORIZED");
    expect(result.sourceReferences.analysisContext.contentHash).toBe(sha256(path.join(evidenceArtifactRoot, bundle.analysisContextArtifact)));
    expect(result.sourceReferences.optimizationTargets.contentHash).toBe(sha256(path.join(evidenceArtifactRoot, bundle.optimizationTargetsArtifact)));
  });

  it("accepts v2 Analysis Context and v2 Optimization Targets including system-only target identities", () => {
    const bundle = setupBundle();
    const installed = installF6VersionedContextAndTargets(bundle, {
      contextVersion: "v2",
      targetVersion: "v2",
    });

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.analysisContext.contextVersion).toBe("f6-analysis-context-v2");
    expect(result.optimizationTargets.targetVersion).toBe("f6-optimization-targets-v2");
    expect(result.inputDecisions.analysisContext.outcome).toBe("CALLER_AUTHORIZED");
    expect(result.inputDecisions.optimizationTargets.outcome).toBe("CALLER_AUTHORIZED");
    expect(result.optimizationTargets.worksheets[0].targets.map(({ targetType }) => targetType)).toEqual([
      "system_mean_shift",
      "system_specification",
      "factor_nominal",
    ]);
    expect(result.sourceReferences.analysisContext.contentHash).toBe(
      sha256(path.join(installed.evidenceArtifactRoot, installed.analysisContextArtifact)),
    );
    expect(result.sourceReferences.optimizationTargets.contentHash).toBe(
      sha256(path.join(installed.evidenceArtifactRoot, installed.optimizationTargetsArtifact)),
    );
  });

  it.each([
    "system_mean_shift",
    "system_specification",
  ])("soft-rejects v2 %s target when systemIdentity baseline drifts", (targetType) => {
    const bundle = setupBundle();
    const installed = installF6VersionedContextAndTargets(bundle, {
      contextVersion: "v2",
      targetVersion: "v2",
    });
    rewriteJson(
      path.join(installed.evidenceArtifactRoot, installed.optimizationTargetsArtifact),
      (artifact) => {
        const target = artifact.worksheets[0].targets.find((item) => item.targetType === targetType);
        target.systemIdentity.baselineIdentity.tableId = "other-table";
      },
    );

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.optimizationTargets).toBeUndefined();
    expect(result.inputDecisions.optimizationTargets).toMatchObject({
      outcome: "REJECTED",
      reasonCode: "identity_mismatch",
      artifactReference: {
        artifact: "targets.json",
      },
    });
    expect(result.inputDecisions.analysisContext.outcome).toBe("CALLER_AUTHORIZED");
  });

  it("soft-rejects a v2 Optimization Targets artifact when target unit is schema-invalid", () => {
    const bundle = setupBundle();
    const installed = installF6VersionedContextAndTargets(bundle, {
      contextVersion: "v2",
      targetVersion: "v2",
    });
    rewriteJson(
      path.join(installed.evidenceArtifactRoot, installed.optimizationTargetsArtifact),
      (artifact) => {
        const nominal = artifact.worksheets[0].targets.find((target) => target.targetType === "factor_nominal");
        nominal.factor.unit = "inch";
      },
    );

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.optimizationTargets).toBeUndefined();
    expect(result.inputDecisions.optimizationTargets).toMatchObject({
      outcome: "REJECTED",
      reasonCode: "unit_mismatch",
      artifactReference: {
        artifact: "targets.json",
      },
    });
  });

  it("keeps v1 Optimization Targets unit drift as hard inputRejected", () => {
    const bundle = setupBundle();
    const installed = installF6VersionedContextAndTargets(bundle, {
      contextVersion: "v1",
      targetVersion: "v1",
    });
    rewriteJson(
      path.join(installed.evidenceArtifactRoot, installed.optimizationTargetsArtifact),
      (artifact) => {
        artifact.worksheets[0].targets[0].factor.unit = "inch";
      },
    );

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_contract_invalid", "targets.json");
  });

  it("keeps v2 Optimization Targets traversal/path violations as hard inputRejected", () => {
    const bundle = setupBundle();
    installF6VersionedContextAndTargets(bundle, {
      contextVersion: "v2",
      targetVersion: "v2",
    });
    bundle.optimizationTargetsArtifact = `..${path.sep}targets.json`;

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", "targets.json");
  });

  it("closes each descriptor exactly once after a normal bounded read", () => {
    const bundle = setupBundle();
    let closeCalls = 0;

    const result = loadF6ArtifactBundle(bundle, {
      closeSync(descriptor) {
        closeCalls += 1;
        return closeSync(descriptor);
      },
    });

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(closeCalls).toBe(4);
  });

  it("rejects an artifact appended past the byte limit without reading past the limit plus one", () => {
    const bundle = setupBundle();
    const initialSize = statSync(bundle.paths.f2).size;
    let bytesRead = 0;
    let closeCalls = 0;

    const result = loadF6ArtifactBundle(bundle, {
      afterArtifactHandleVerified({ artifactReference, filePath }) {
        if (artifactReference === "Feature2-Report.json") {
          appendFileSync(filePath, Buffer.alloc(MAX_JSON_BYTES - initialSize + 1, 0x20));
        }
      },
      readSync(descriptor, buffer, offset, length, position) {
        const count = readSync(descriptor, buffer, offset, length, position);
        bytesRead += count;
        return count;
      },
      closeSync(descriptor) {
        closeCalls += 1;
        return closeSync(descriptor);
      },
    });

    expectRejected(result, "artifact_contract_invalid", "Feature2-Report.json");
    expect(bytesRead).toBe(MAX_JSON_BYTES + 1);
    expect(closeCalls).toBe(1);
  });

  it("rejects same-size content mutation when post-read metadata changes", () => {
    const bundle = setupBundle();
    let fstatCalls = 0;
    let closeCalls = 0;

    const result = loadF6ArtifactBundle(bundle, {
      afterArtifactHandleVerified({ artifactReference, filePath }) {
        if (artifactReference !== "Feature2-Report.json") return;
        const content = readFileSync(filePath, "utf8");
        writeFileSync(filePath, content.replace("2026-08-17", "2027-08-17"), "utf8");
      },
      fstatSync(descriptor) {
        fstatCalls += 1;
        const stat = fstatSync(descriptor);
        return fstatCalls === 2
          ? { ...stat, mtimeMs: stat.mtimeMs + 1, isFile: () => stat.isFile() }
          : stat;
      },
      closeSync(descriptor) {
        closeCalls += 1;
        return closeSync(descriptor);
      },
    });

    expectRejected(result, "artifact_contract_invalid", "Feature2-Report.json");
    expect(fstatCalls).toBe(2);
    expect(closeCalls).toBe(1);
  });

  it("rejects truncation when post size differs from the pre-read size", () => {
    const bundle = setupBundle();
    let closeCalls = 0;

    const result = loadF6ArtifactBundle(bundle, {
      afterArtifactHandleVerified({ artifactReference, filePath }) {
        if (artifactReference === "Feature2-Report.json") {
          truncateSync(filePath, readFileSync(filePath).length - 1);
        }
      },
      closeSync(descriptor) {
        closeCalls += 1;
        return closeSync(descriptor);
      },
    });

    expectRejected(result, "artifact_contract_invalid", "Feature2-Report.json");
    expect(closeCalls).toBe(1);
  });

  it("sanitizes read errors and closes the descriptor exactly once", () => {
    const bundle = setupBundle();
    let closeCalls = 0;

    const result = loadF6ArtifactBundle(bundle, {
      readSync() {
        throw new Error(`sensitive read failure at ${rootPath(bundle)}`);
      },
      closeSync(descriptor) {
        closeCalls += 1;
        return closeSync(descriptor);
      },
    });

    expectRejected(result, "artifact_contract_invalid", "Feature2-Report.json");
    expect(JSON.stringify(result)).not.toContain("sensitive read failure");
    expect(closeCalls).toBe(1);
  });

  it("reads a core artifact from its verified handle when the path is replaced", () => {
    const bundle = setupBundle();
    const originalHash = sha256(bundle.paths.f2);

    const result = loadF6ArtifactBundle(bundle, {
      afterArtifactHandleVerified({ artifactReference, filePath }) {
        if (artifactReference !== "Feature2-Report.json") return;
        renameSync(filePath, `${filePath}.verified`);
        writeFileSync(filePath, "{", "utf8");
      },
    });

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.sourceReferences.f2.contentHash).toBe(originalHash);
    expect(readFileSync(bundle.paths.f2, "utf8")).toBe("{");
  });
});

function rootPath(bundle) {
  return path.dirname(bundle.f2ArtifactRoot);
}

function expectRejected(result, reasonCode, artifactReference) {
  expect(result).toEqual({ status: "inputRejected", reasonCode, artifactReference });
  expect(JSON.stringify(result)).not.toMatch(/[A-Za-z]:[\\/]/);
}

describe("F6 governed bundle validation", () => {
  it.each([
    ["f2ArtifactRoot", "Feature2-Report.json"],
    ["f3ArtifactRoot", "Feature3-Report.json"],
    ["f4ArtifactRoot", "Feature4-Calculation.json"],
    ["f5ArtifactRoot", "Feature5-Report.json"],
  ])("rejects %s outside the governed publish root", (rootField, artifactReference) => {
    const bundle = setupBundle();
    const outsideRoot = path.join(bundle.root, "outside", rootField);
    mkdirSync(path.dirname(outsideRoot), { recursive: true });
    renameSync(bundle[rootField], outsideRoot);
    bundle[rootField] = outsideRoot;

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", artifactReference);
  });

  it("returns F2 blocked worksheets only as validation records", () => {
    const bundle = setupBundle({ blockedWorksheetNames: ["Blocked-A"] });
    rewriteJson(bundle.paths.f2, (f2) => {
      const blocked = f2.worksheets.find(({ worksheetName }) => worksheetName === "Blocked-A");
      blocked.rows[0].missingIdentifiers = ["partNumber"];
      blocked.rows[0].actualFields.drawingNumber = null;
      blocked.systemSpecificationIssues = [{
        field: "lowerSpecLimit",
        reasonCode: "legacy_artifact_missing_system_specification",
      }];
      f2.summary.missingPartNumberCount = 1;
    });

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.request.selectedWorksheetNames).toEqual(["Analysis-A"]);
    expect(result.request.reportScope).toEqual({
      worksheetNames: ["Analysis-A", "Blocked-A"],
      blockedWorksheetNames: ["Blocked-A"],
    });
    expect(result.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A"]);
    expect(result.blockedWorksheets[0].findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ findingKind: "validation_abnormality", findingCode: "tolerance_path_image_unavailable" }),
      expect.objectContaining({ findingKind: "governance_gap", findingCode: "missing_identifier:partNumber" }),
      expect.objectContaining({ findingKind: "validation_abnormality", findingCode: expect.stringMatching(/^system_specification:/) }),
    ]));
    expect(new Set(result.blockedWorksheets[0].findings.map(({ findingKind }) => findingKind))).toEqual(
      new Set(["validation_abnormality", "governance_gap"]),
    );
    expect(result.blockedWorksheets[0].findings.some(({ findingKind }) =>
      findingKind === "confirmed_requirement_violation")).toBe(false);
  });

  it("accepts a required mixed multimodal v4 artifact and carries the failed worksheet as an F6 blocker", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A", "Analysis-B"] });
    installRequiredMixedMultimodalV4(bundle);
    keepCompletedF5WorksheetOnly(bundle, "Analysis-A");

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.request.selectedWorksheetNames).toEqual(["Analysis-A"]);
    expect(result.request.reportScope).toEqual({
      worksheetNames: ["Analysis-A", "Analysis-B"],
      blockedWorksheetNames: ["Analysis-B"],
    });
    expect(result.blockedWorksheets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        worksheetName: "Analysis-B",
        findings: expect.arrayContaining([
          expect.objectContaining({
            findingCode: "multimodal_blocker:evaluation_failed",
            findingKind: "validation_abnormality",
          }),
        ]),
      }),
    ]));
  });

  it("preserves requested worksheet order while retaining original F4 calculation indices", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A", "Analysis-B"] });
    bundle.selectedWorksheetNames = ["Analysis-B", "Analysis-A"];

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.request.selectedWorksheetNames).toEqual(bundle.selectedWorksheetNames);
    expect(result.request.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(bundle.selectedWorksheetNames);
    expect(result.request.worksheets.map(({ f4CalculationIndex }) => f4CalculationIndex)).toEqual([2, 1]);
    expect(result.request.worksheets.map(({ baselineCalculation }) => baselineCalculation.runReference)).toEqual([
      `${RUN_ID}-2`,
      `${RUN_ID}-1`,
    ]);
  });

  it.each([
    [undefined, "undefined"],
    ["Analysis-A", "non-array"],
    [[], "empty"],
    [["Analysis-A", "Analysis-A"], "duplicate"],
    [["Unknown"], "unknown"],
  ])("rejects %s worksheet selection (%s)", (selectedWorksheetNames) => {
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

  it.each([
    ["projectReference", "f4-bbbbbbbbbbbbbbbb", "artifact_identity_mismatch", "worksheet:Analysis-A"],
    ["runReference", "tampered-run-1", "artifact_identity_mismatch", "worksheet:Analysis-A"],
    ["criticality", "safety_critical", "artifact_contract_invalid", "Feature4-Calculation.json"],
  ])("rejects synchronized F4/F5 %s tampering before replay", (field, tamperedValue, reasonCode, artifactReference) => {
    const bundle = setupBundle();
    for (const artifactPath of [bundle.paths.f4, bundle.paths.f5]) {
      rewriteJson(artifactPath, (report) => {
        const calculation = artifactPath === bundle.paths.f4
          ? report.calculations[0]
          : report.worksheets[0].calculationResult;
        if (field === "criticality") {
          calculation.recommendation.criticality = tamperedValue;
          calculation.recommendation.criticalityRisk = true;
        } else {
          calculation[field] = tamperedValue;
        }
      });
    }

    expectRejected(loadF6ArtifactBundle(bundle), reasonCode, artifactReference);
  });

  it("sanitizes replay exceptions as an artifact identity rejection", () => {
    const bundle = setupBundle();

    const result = loadF6ArtifactBundle(bundle, {
      replayCalculation() {
        throw new Error(`sensitive replay failure at ${rootPath(bundle)}`);
      },
    });

    expectRejected(result, "artifact_identity_mismatch", "worksheet:Analysis-A");
    expect(JSON.stringify(result)).not.toContain("sensitive replay failure");
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
              factorOrdinal: row.factorOrdinal,
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
  const evidenceArtifactRoot = setupEvidenceRoot(bundle);
  const imageObservationArtifact = "observations.json";
  writeJson(path.join(evidenceArtifactRoot, imageObservationArtifact), artifact);
  const f5 = createF5DataInterpretation({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: WORKBOOK_HASH },
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
  });
  writeJson(bundle.paths.f5, f5);
  bundle.imageObservationArtifact = imageObservationArtifact;
  return artifact;
}

function setupEvidenceRoot(bundle) {
  if (bundle.evidenceArtifactRoot) return bundle.evidenceArtifactRoot;
  const evidenceParent = path.join(bundle.publishRoot, "inputs");
  mkdirSync(evidenceParent, { recursive: true });
  const evidenceArtifactRoot = mkdtempSync(path.join(evidenceParent, "evidence-"));
  bundle.evidenceArtifactRoot = evidenceArtifactRoot;
  return evidenceArtifactRoot;
}

function writeOptional(bundle, fileName, value) {
  const filePath = path.join(setupEvidenceRoot(bundle), fileName);
  writeJson(filePath, value);
  return fileName;
}

describe("F6 optional governed evidence", () => {
  it("hard-rejects a new run when multimodal interpretation is missing", () => {
    const bundle = setupBundle();
    bundle.requireMultimodalV3 = true;
    const result = loadF6ArtifactBundle(bundle);

    expectRejected(result, "model_interpretation_required", "modelInterpretationArtifact");
  });

  it("hard-rejects legacy model interpretation on a new run", () => {
    const bundle = setupBundle();
    bundle.requireMultimodalV3 = true;
    const installed = installF6ModelInterpretation(bundle, { version: "v2" });
    bundle.expectedModelInterpretationContentHash = sha256(installed.filePath);

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_contract_invalid", "Feature6-Model-Interpretation.json");
  });

  it("accepts the required exact-set multimodal v3 artifact", () => {
    const bundle = setupBundle({ worksheetNames: ["Analysis-A", "Analysis-B"] });
    const artifact = installRequiredMultimodalV3(bundle);
    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.modelInterpretation).toEqual(artifact);
    expect(result.inputDecisions.modelInterpretation).toMatchObject({ outcome: "CALLER_AUTHORIZED" });
  });

  it("accepts equivalent numeric F2 and textual multimodal DIM IDs", () => {
    const bundle = setupBundle();
    installRequiredMultimodalV3(bundle);
    writeJson(bundle.paths.f2, JSON.parse(JSON.stringify(readJson(bundle.paths.f2)).replaceAll('"DIM-100"', "101")));
    writeJson(bundle.paths.f3, JSON.parse(JSON.stringify(readJson(bundle.paths.f3)).replaceAll('"DIM-100"', '"101"')));
    writeJson(bundle.paths.f5, JSON.parse(JSON.stringify(readJson(bundle.paths.f5)).replaceAll('"DIM-100"', '"101"')));
    const filePath = path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact);
    rewriteJson(filePath, (artifact) => {
      const pair = artifact.worksheets[0];
      pair.request.factorRows[0].dimId = "101";
      pair.request.factorSetHash = createF5MultimodalFactorSetHash(pair.request.factorRows);
      pair.request.requestHash = createF5MultimodalRequestHash(pair.request);
      pair.result.requestHash = pair.request.requestHash;
    });
    bundle.expectedModelInterpretationContentHash = sha256(filePath);

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
  });

  it("rejects multimodal v3 request workbook filename drift", () => {
    const bundle = setupBundle();
    installRequiredMultimodalV3(bundle);
    const filePath = path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact);
    rewriteJson(filePath, (artifact) => {
      artifact.worksheets[0].request.workbook.fileName = "Other.xlsx";
      artifact.worksheets[0].request.requestHash = createF5MultimodalRequestHash(artifact.worksheets[0].request);
      artifact.worksheets[0].result.requestHash = artifact.worksheets[0].request.requestHash;
    });
    bundle.expectedModelInterpretationContentHash = sha256(filePath);

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", bundle.modelInterpretationArtifact);
  });

  it("auto-inherits current F5 observation copy without explicit compatibility input", () => {
    const bundle = setupBundle();
    installF5CurrentObservationLedger(bundle);
    installF6ModelInterpretation(bundle);
    bundle.imageObservationArtifact = undefined;
    bundle.evidenceArtifactRoot = undefined;

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.sourceReferences.imageObservation).toEqual({
      artifact: "Feature5-Image-Observations.json",
      contentHash: sha256(path.join(bundle.f5ArtifactRoot, "Feature5-Image-Observations.json")),
    });
    expect(result.request.imageObservationReference).toEqual(result.sourceReferences.imageObservation);
    expect(result.inputDecisions.modelInterpretation).toMatchObject({ outcome: "CALLER_AUTHORIZED" });
  });

  it("rejects when current F5 manifest declares observation but copied artifact is missing", () => {
    const bundle = setupBundle();
    const installed = installF5CurrentObservationLedger(bundle);
    rmSync(installed.observationPath);

    expectRejected(loadF6ArtifactBundle(bundle), "observation_evidence_missing", "Feature5-Image-Observations.json");
  });

  it("rejects when current F5 summary hash mismatches copied observation bytes", () => {
    const bundle = setupBundle();
    const installed = installF5CurrentObservationLedger(bundle);
    rewriteJson(installed.runSummaryPath, (summary) => {
      summary.hashes.imageObservationsSha256 = "f".repeat(64);
    });

    expectRejected(loadF6ArtifactBundle(bundle), "observation_hash_mismatch", "Feature5-Image-Observations.json");
  });

  it("rejects explicit compatibility input when source identity differs from current F5 copy", () => {
    const bundle = setupBundle();
    installF5CurrentObservationLedger(bundle);
    bundle.evidenceArtifactRoot = setupEvidenceRoot(bundle);
    bundle.imageObservationArtifact = "observations.json";
    writeJson(
      path.join(bundle.evidenceArtifactRoot, bundle.imageObservationArtifact),
      readJson(path.join(bundle.f5ArtifactRoot, "Feature5-Image-Observations.json")),
    );

    expectRejected(loadF6ArtifactBundle(bundle), "observation_identity_mismatch", "observations.json");
  });

  it("loads an identity-bound model interpretation from its independent root", () => {
    const bundle = setupBundle();
    const installed = installF6ModelInterpretation(bundle);

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.modelInterpretation).toEqual(installed.artifact);
    expect(result.inputDecisions.modelInterpretation).toEqual({
      outcome: "CALLER_AUTHORIZED",
      artifactReference: {
        artifact: installed.modelInterpretationArtifact,
        contentHash: sha256(installed.filePath),
      },
    });
    expect(result.sourceReferences.modelInterpretation).toEqual(
      result.inputDecisions.modelInterpretation.artifactReference,
    );
  });

  it("loads a v2 model interpretation with strict four-class optimization assessment", () => {
    const bundle = setupBundle();
    const installed = installF6ModelInterpretation(bundle, { version: "v2" });

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.modelInterpretation).toEqual(installed.artifact);
    expect(result.modelInterpretation.interpretationVersion).toBe("f6-model-interpretation-v2");
    expect(result.modelInterpretation.worksheets[0].optimizationAssessment.map(({ adjustmentClass }) =>
      adjustmentClass)).toEqual([
      "factor_nominal",
      "system_mean_shift",
      "system_specification",
      "factor_tolerance",
    ]);
  });

  it.each([
    ["disposition", (artifact) => {
      artifact.worksheets[0].optimizationAssessment[0].disposition = "MAYBE";
    }],
    ["adjustment class", (artifact) => {
      artifact.worksheets[0].optimizationAssessment[0].adjustmentClass = "factor_shift";
    }],
  ])("soft-rejects a v2 model interpretation with invalid optimization assessment %s", (_label, mutate) => {
    const bundle = setupBundle();
    const installed = installF6ModelInterpretation(bundle, { version: "v2" });
    rewriteJson(installed.filePath, mutate);

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.modelInterpretation).toBeUndefined();
    expect(result.inputDecisions.modelInterpretation).toMatchObject({
      outcome: "REJECTED",
      reasonCode: "schema_invalid",
    });
  });

  it("loads model interpretation bound to accepted v2 image observations", () => {
    const bundle = setupBundle();
    installF6V2Evidence(bundle);
    const installed = installF6ModelInterpretation(bundle);

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.modelInterpretation).toEqual(installed.artifact);
    expect(result.modelInterpretation.worksheets[0].sourceReferences.imageObservation).toEqual({
      ...result.sourceReferences.imageObservation,
      observationVersion: "f5-image-observation-v2",
    });
  });

  it("soft-rejects model interpretation with mismatched observation ledger reference", () => {
    const bundle = setupBundle();
    installF5CurrentObservationLedger(bundle);
    const installed = installF6ModelInterpretation(bundle);
    rewriteJson(installed.filePath, (artifact) => {
      artifact.worksheets[0].sourceReferences.imageObservation.contentHash = "f".repeat(64);
    });
    bundle.imageObservationArtifact = undefined;
    bundle.evidenceArtifactRoot = undefined;

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status).toBe("accepted");
    expect(result.modelInterpretation).toBeUndefined();
    expect(result.inputDecisions.modelInterpretation).toMatchObject({
      outcome: "REJECTED",
      reasonCode: "model_interpretation_evidence_mismatch",
    });
  });

  it("soft-rejects a model interpretation whose F4 claim value drifts", () => {
    const bundle = setupBundle();
    const installed = installF6ModelInterpretation(bundle);
    rewriteJson(installed.filePath, (artifact) => {
      artifact.worksheets[0].calculationClaims[0].rawValue += 0.01;
    });

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.modelInterpretation).toBeUndefined();
    expect(result.inputDecisions.modelInterpretation.outcome).toBe("REJECTED");
  });

  it("soft-rejects malformed and traversal model interpretation inputs", () => {
    const malformedBundle = setupBundle();
    const malformed = installF6ModelInterpretation(malformedBundle);
    writeFileSync(malformed.filePath, "{", "utf8");
    const malformedResult = loadF6ArtifactBundle(malformedBundle);
    expect(malformedResult.status).toBe("accepted");
    expect(malformedResult.inputDecisions.modelInterpretation).toMatchObject({
      outcome: "REJECTED",
      reasonCode: "schema_invalid",
    });

    const traversalBundle = setupBundle();
    installF6ModelInterpretation(traversalBundle);
    traversalBundle.modelInterpretationArtifact = `..${path.sep}Feature6-Model-Interpretation.json`;
    const traversalResult = loadF6ArtifactBundle(traversalBundle);
    expect(traversalResult.status).toBe("accepted");
    expect(traversalResult.inputDecisions.modelInterpretation).toMatchObject({
      outcome: "REJECTED",
      reasonCode: "identity_mismatch",
    });
  });

  it("soft-rejects a model interpretation root outside the governed publish root", () => {
    const bundle = setupBundle();
    installF6ModelInterpretation(bundle);
    bundle.modelInterpretationArtifactRoot = path.join(bundle.root, "outside-model-root");
    mkdirSync(bundle.modelInterpretationArtifactRoot);

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status).toBe("accepted");
    expect(result.inputDecisions.modelInterpretation).toMatchObject({
      outcome: "REJECTED",
      reasonCode: "identity_mismatch",
    });
  });

  it.each([
    ["F4 source hash", (artifact) => { artifact.worksheets[0].sourceReferences.f4.contentHash = "f".repeat(64); }, "identity_mismatch"],
    ["image hash", (artifact) => { artifact.worksheets[0].sourceReferences.image.contentHash = "f".repeat(64); }, "identity_mismatch"],
    ["worksheet identity", (artifact) => { artifact.worksheets[0].baselineIdentity.tableId = "other-table"; }, "schema_invalid"],
    ["claim unit", (artifact) => { artifact.worksheets[0].calculationClaims[0].unit = "inch"; }, "unit_mismatch"],
    ["claim display format", (artifact) => { artifact.worksheets[0].calculationClaims[0].displayFormat = "percent"; }, "identity_mismatch"],
  ])("soft-rejects model interpretation %s drift", (_label, mutate, reasonCode) => {
    const bundle = setupBundle();
    const installed = installF6ModelInterpretation(bundle);
    rewriteJson(installed.filePath, mutate);

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status).toBe("accepted");
    expect(result.modelInterpretation).toBeUndefined();
    expect(result.inputDecisions.modelInterpretation).toMatchObject({ outcome: "REJECTED", reasonCode });
  });

  it("soft-rejects a v2 model interpretation when optimization assessment classes are incomplete", () => {
    const bundle = setupBundle();
    const installed = installF6ModelInterpretation(bundle, { version: "v2" });
    rewriteJson(installed.filePath, (artifact) => {
      artifact.worksheets[0].optimizationAssessment = artifact.worksheets[0].optimizationAssessment
        .filter(({ adjustmentClass }) => adjustmentClass !== "system_specification");
    });

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.modelInterpretation).toBeUndefined();
    expect(result.inputDecisions.modelInterpretation).toMatchObject({
      outcome: "REJECTED",
      reasonCode: "schema_invalid",
    });
  });

  it("validates a supplied evidence root even when optional evidence is absent", () => {
    const bundle = setupBundle();
    setupEvidenceRoot(bundle);

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
  });

  it("accepts exact F5 v2 evidence without promoting ambiguous unreviewed observations", () => {
    const bundle = setupBundle();
    const artifact = installV2Evidence(bundle);

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.request.imageObservationReference).toEqual({
      artifact: "observations.json",
      contentHash: sha256(path.join(bundle.evidenceArtifactRoot, bundle.imageObservationArtifact)),
    });
    expect(path.isAbsolute(result.sourceReferences.imageObservation.artifact)).toBe(false);
    expect(result.request.worksheets[0].f5Worksheet.observationVersion).toBe("f5-image-observation-v2");
    expect(artifact.worksheets[0].observations.every(({ visualObservation }) =>
      visualObservation.reviewStatus === "unreviewed")).toBe(true);
  });

  it("rejects supplied F5 v2 evidence that does not exactly match the F5 report", () => {
    const bundle = setupBundle();
    installV2Evidence(bundle);
    rewriteJson(path.join(bundle.evidenceArtifactRoot, bundle.imageObservationArtifact), (artifact) => {
      artifact.worksheets[0].contextSnapshot.dimensionDescription = "Other loop";
    });

    expectRejected(loadF6ArtifactBundle(bundle), "observation_identity_mismatch", "observations.json");
  });

  it.each([
    ["imageObservationArtifact", "observation_evidence_missing"],
    ["supplierCapabilityArtifact", "artifact_missing"],
    ["datumStrategyArtifact", "artifact_missing"],
    ["costArtifact", "artifact_missing"],
  ])("rejects an explicitly supplied missing %s", (field, reasonCode) => {
    const bundle = setupBundle();
    setupEvidenceRoot(bundle);
    bundle[field] = `${field}.json`;

    expectRejected(loadF6ArtifactBundle(bundle), reasonCode, `${field}.json`);
  });

  it.each([
    ["imageObservationArtifact", "observation_identity_mismatch"],
    ["supplierCapabilityArtifact", "artifact_contract_invalid"],
    ["datumStrategyArtifact", "artifact_contract_invalid"],
    ["costArtifact", "artifact_contract_invalid"],
  ])("rejects malformed supplied %s", (field, reasonCode) => {
    const bundle = setupBundle();
    setupEvidenceRoot(bundle);
    bundle[field] = `${field}.json`;
    writeFileSync(path.join(bundle.evidenceArtifactRoot, bundle[field]), "{", "utf8");

    expectRejected(loadF6ArtifactBundle(bundle), reasonCode, `${field}.json`);
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
    expect(path.isAbsolute(result.sourceReferences.supplierCapability.artifact)).toBe(false);
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
    expect(path.isAbsolute(result.sourceReferences.datumStrategy.artifact)).toBe(false);
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
    expect(path.isAbsolute(result.sourceReferences.cost.artifact)).toBe(false);
  });

  it("reads optional evidence from its verified handle when the path is replaced", () => {
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
    const costPath = path.join(bundle.evidenceArtifactRoot, bundle.costArtifact);
    const originalHash = sha256(costPath);

    const result = loadF6ArtifactBundle(bundle, {
      afterArtifactHandleVerified({ artifactReference, filePath }) {
        if (artifactReference !== "cost.json") return;
        renameSync(filePath, `${filePath}.verified`);
        writeFileSync(filePath, "{", "utf8");
      },
    });

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.sourceReferences.cost.contentHash).toBe(originalHash);
    expect(readFileSync(costPath, "utf8")).toBe("{");
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

  it("requires an evidence root when optional evidence is supplied", () => {
    const bundle = setupBundle();
    bundle.costArtifact = "cost.json";

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_contract_invalid", "evidenceArtifactRoot");
  });

  it("rejects an empty optional evidence path", () => {
    const bundle = setupBundle();
    setupEvidenceRoot(bundle);
    bundle.costArtifact = "";

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_contract_invalid", "artifact.json");
  });

  it("rejects absolute and traversal optional evidence paths", () => {
    const absoluteBundle = setupBundle();
    setupEvidenceRoot(absoluteBundle);
    absoluteBundle.costArtifact = path.join(absoluteBundle.evidenceArtifactRoot, "cost.json");
    expectRejected(loadF6ArtifactBundle(absoluteBundle), "artifact_identity_mismatch", "cost.json");

    const traversalBundle = setupBundle();
    setupEvidenceRoot(traversalBundle);
    traversalBundle.costArtifact = `nested${path.sep}..${path.sep}cost.json`;
    expectRejected(loadF6ArtifactBundle(traversalBundle), "artifact_identity_mismatch", "cost.json");
  });

  it("rejects an evidence root outside the publish root", () => {
    const bundle = setupBundle();
    bundle.evidenceArtifactRoot = path.join(bundle.root, "outside-evidence");
    mkdirSync(bundle.evidenceArtifactRoot);

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", "evidenceArtifactRoot");
  });

  it("rejects a junction in an optional evidence parent path", () => {
    const bundle = setupBundle();
    const evidenceRoot = setupEvidenceRoot(bundle);
    const outside = path.join(rootPath(bundle), "outside-evidence");
    mkdirSync(outside);
    writeFileSync(path.join(outside, "cost.json"), "{}", "utf8");
    symlinkSync(outside, path.join(evidenceRoot, "linked"), "junction");
    bundle.costArtifact = path.join("linked", "cost.json");

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", "cost.json");
  });

  it.runIf(FILE_SYMLINKS_AVAILABLE)("rejects a final optional evidence file symlink", () => {
    const bundle = setupBundle();
    const evidenceRoot = setupEvidenceRoot(bundle);
    const outside = path.join(rootPath(bundle), "outside-cost.json");
    writeFileSync(outside, "{}", "utf8");
    symlinkSync(outside, path.join(evidenceRoot, "cost.json"), "file");
    bundle.costArtifact = "cost.json";

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", "cost.json");
  });

  it("rejects an evidence root that is itself a junction", () => {
    const bundle = setupBundle();
    const outside = path.join(bundle.root, "outside-evidence");
    mkdirSync(outside);
    const rootLink = path.join(bundle.publishRoot, "evidence-link");
    symlinkSync(outside, rootLink, "junction");
    bundle.evidenceArtifactRoot = rootLink;

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", "evidenceArtifactRoot");
  });

  it("rejects a junction between the publish root and the evidence root", () => {
    const bundle = setupBundle();
    const outside = path.join(bundle.root, "outside-parent");
    const nested = path.join(outside, "evidence");
    mkdirSync(nested, { recursive: true });
    const parentLink = path.join(bundle.publishRoot, "evidence-parent-link");
    symlinkSync(outside, parentLink, "junction");
    bundle.evidenceArtifactRoot = path.join(parentLink, "evidence");

    expectRejected(loadF6ArtifactBundle(bundle), "artifact_identity_mismatch", "evidenceArtifactRoot");
  });

  it("rejects a root artifact symlink outside its root", () => {

    const symlinkBundle = setupBundle();
    const outside = path.join(rootPath(symlinkBundle), "outside-f2");
    mkdirSync(outside);
    writeFileSync(path.join(outside, "Feature2-Report.json"), readFileSync(symlinkBundle.paths.f2));
    rmSync(symlinkBundle.f2ArtifactRoot, { recursive: true });
    symlinkSync(outside, symlinkBundle.f2ArtifactRoot, "junction");
    expectRejected(loadF6ArtifactBundle(symlinkBundle), "artifact_identity_mismatch", "Feature2-Report.json");
  });
});
