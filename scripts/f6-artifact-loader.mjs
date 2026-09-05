import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { closeSync, fstatSync, lstatSync, openSync, readSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  drawingGovernanceResultV2Schema,
  f2UserReportSchema,
  f4WorkflowCalculationResultSchema,
  f5DataInterpretationResultSchema,
  f5ImageObservationArtifactSchema,
  f6AnalysisContextSchema,
  f6CostEvidenceSchema,
  f6DatumEvidenceSchema,
  f6ModelInterpretationArtifactSchema,
  f6OptimizationRequestSchema,
  f6OptimizationTargetsSchema,
  f6SupplierCapabilityEvidenceSchema,
} from "../packages/contracts/dist/contracts.js";
import { createCalculation } from "../packages/workbook-catalog/dist/calculation.js";
import { createF5DataInterpretation } from "../packages/workbook-catalog/dist/f5-data-interpretation.js";
import {
  createCalculationRequestFromF4Handoff,
  createF4Handoff,
} from "../packages/workbook-catalog/dist/f4-handoff.js";

const ARTIFACTS = Object.freeze({
  f2: "Feature2-Report.json",
  f3: "Feature3-Report.json",
  f4: "Feature4-Calculation.json",
  f5: "Feature5-Report.json",
});
const MAX_JSON_BYTES = 10 * 1024 * 1024;
const REPOSITORY_ROOT = path.resolve(process.cwd());
const CONTROLLED_OUTPUT_ROOT = path.join(REPOSITORY_ROOT, "test", "demo-output");

function inputRejected(reasonCode, artifactReference) {
  return { status: "inputRejected", reasonCode, artifactReference };
}

function modelInputReferenceHash(artifactRoot, artifactReference) {
  return createHash("sha256")
    .update(`${String(artifactRoot ?? "")}\0${String(artifactReference ?? "")}`)
    .digest("hex");
}

function rejectedModelDecision(artifactRoot, artifactReference, rejection, reference, reasonCode) {
  const mappedReason = reasonCode ?? (rejection?.reasonCode === "artifact_contract_invalid"
    ? "schema_invalid"
    : rejection?.reasonCode === "artifact_identity_mismatch"
      ? "identity_mismatch"
      : "path_invalid");
  return {
    outcome: "REJECTED",
    ...(reference === undefined ? {} : { artifactReference: reference }),
    inputReferenceHash: modelInputReferenceHash(artifactRoot, artifactReference),
    reasonCode: mappedReason,
  };
}

function ioReason(error) {
  return new Set(["ENOENT", "ENOTDIR"]).has(error?.code)
    ? "artifact_missing"
    : "artifact_contract_invalid";
}

function canonicalChild(root, artifactReference) {
  try {
    const rootPath = path.resolve(root);
    if (lstatSync(rootPath).isSymbolicLink()) return { reasonCode: "artifact_identity_mismatch" };
    const resolvedRoot = realpathSync(rootPath);
    const candidate = path.resolve(resolvedRoot, artifactReference);
    const relation = path.relative(resolvedRoot, candidate);
    if (!relation || relation.split(path.sep)[0] === ".." || path.isAbsolute(relation)) {
      return { reasonCode: "artifact_identity_mismatch" };
    }
    if (lstatSync(candidate).isSymbolicLink()) return { reasonCode: "artifact_identity_mismatch" };
    const resolvedChild = realpathSync(candidate);
    const realRelation = path.relative(resolvedRoot, resolvedChild);
    if (!realRelation || realRelation.split(path.sep)[0] === ".." || path.isAbsolute(realRelation)) {
      return { reasonCode: "artifact_identity_mismatch" };
    }
    return { filePath: resolvedChild };
  } catch (error) {
    return { reasonCode: ioReason(error) };
  }
}

function readBoundedBytes(descriptor, readDescriptor) {
  const chunks = [];
  let totalBytes = 0;
  while (totalBytes <= MAX_JSON_BYTES) {
    const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, MAX_JSON_BYTES + 1 - totalBytes));
    const bytesRead = readDescriptor(descriptor, chunk, 0, chunk.length, totalBytes);
    if (!Number.isInteger(bytesRead) || bytesRead < 0 || bytesRead > chunk.length) {
      throw new Error("invalid descriptor read result");
    }
    if (bytesRead === 0) break;
    totalBytes += bytesRead;
    if (totalBytes > MAX_JSON_BYTES) return { oversized: true };
    chunks.push(chunk.subarray(0, bytesRead));
  }
  return { bytes: Buffer.concat(chunks, totalBytes) };
}

function stableHandleMetadata(before, after, actualBytes, pathStillReferencesHandle) {
  const birthtimeStable = !Number.isFinite(before.birthtimeMs)
    || !Number.isFinite(after.birthtimeMs)
    || before.birthtimeMs === 0
    || after.birthtimeMs === 0
    || before.birthtimeMs === after.birthtimeMs;
  // Same-size writes that preserve timestamps within platform granularity require stronger OS primitives to detect.
  return after.isFile()
    && before.dev === after.dev
    && before.ino === after.ino
    && before.size <= MAX_JSON_BYTES
    && before.size === after.size
    && after.size === actualBytes
    && before.mtimeMs === after.mtimeMs
    && (before.ctimeMs === after.ctimeMs || !pathStillReferencesHandle)
    && birthtimeStable;
}

function readVerifiedBytes(filePath, artifactReference, hooks) {
  let descriptor;
  let result;
  const readDescriptor = hooks?.readSync ?? readSync;
  const statDescriptor = hooks?.fstatSync ?? fstatSync;
  const closeDescriptor = hooks?.closeSync ?? closeSync;
  try {
    descriptor = openSync(filePath, "r");
    const handleStat = statDescriptor(descriptor);
    const pathStat = lstatSync(filePath);
    if (pathStat.isSymbolicLink()
      || handleStat.dev !== pathStat.dev
      || handleStat.ino !== pathStat.ino) {
      result = { rejection: inputRejected("artifact_identity_mismatch", artifactReference) };
    } else if (!handleStat.isFile() || handleStat.size > MAX_JSON_BYTES) {
      result = { rejection: inputRejected("artifact_contract_invalid", artifactReference) };
    } else {
      hooks?.afterArtifactHandleVerified?.({ artifactReference, filePath });
      const loaded = readBoundedBytes(descriptor, readDescriptor);
      if (loaded.oversized) {
        result = { rejection: inputRejected("artifact_contract_invalid", artifactReference) };
      } else {
        const postReadStat = statDescriptor(descriptor);
        const postReadPathStat = lstatSync(filePath);
        const pathStillReferencesHandle = postReadPathStat.dev === postReadStat.dev
          && postReadPathStat.ino === postReadStat.ino;
        result = stableHandleMetadata(handleStat, postReadStat, loaded.bytes.length, pathStillReferencesHandle)
          ? loaded
          : { rejection: inputRejected("artifact_contract_invalid", artifactReference) };
      }
    }
  } catch (error) {
    result = { rejection: inputRejected(ioReason(error), artifactReference) };
  } finally {
    if (descriptor !== undefined) {
      try {
        closeDescriptor(descriptor);
      } catch (error) {
        result = { rejection: inputRejected(ioReason(error), artifactReference) };
      }
    }
  }
  return result;
}

function readArtifact(root, artifactReference, schema, hooks) {
  const child = canonicalChild(root, artifactReference);
  if (!child.filePath) return { rejection: inputRejected(child.reasonCode, artifactReference) };
  const loaded = readVerifiedBytes(child.filePath, artifactReference, hooks);
  if (loaded.rejection) return loaded;
  try {
    const parsed = schema.safeParse(JSON.parse(loaded.bytes.toString("utf8")));
    if (!parsed.success) return { rejection: inputRejected("artifact_contract_invalid", artifactReference) };
    return {
      value: parsed.data,
      reference: {
        artifact: artifactReference,
        contentHash: createHash("sha256").update(loaded.bytes).digest("hex"),
      },
    };
  } catch (error) {
    return { rejection: inputRejected(error instanceof SyntaxError ? "artifact_contract_invalid" : ioReason(error), artifactReference) };
  }
}

function containedChild(root, candidate) {
  const relation = path.relative(root, candidate);
  return relation.length > 0
    && relation.split(path.sep)[0] !== ".."
    && !path.isAbsolute(relation);
}

function inspectPathWithoutLinks(root, candidate) {
  try {
    if (lstatSync(root).isSymbolicLink()) return { reasonCode: "artifact_identity_mismatch" };
    const relation = path.relative(root, candidate);
    let current = root;
    for (const segment of relation.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      if (lstatSync(current).isSymbolicLink()) return { reasonCode: "artifact_identity_mismatch" };
    }
    return {};
  } catch (error) {
    return { reasonCode: ioReason(error) };
  }
}

function validatedGovernedRoot(artifactRoot, artifactReference, publishRoot = CONTROLLED_OUTPUT_ROOT) {
  if (typeof artifactRoot !== "string" || artifactRoot.trim().length === 0) {
    return { rejection: inputRejected("artifact_contract_invalid", artifactReference) };
  }
  try {
    const requestedPublishRoot = path.resolve(publishRoot);
    const requestedRoot = path.resolve(artifactRoot);
    if (lstatSync(requestedPublishRoot).isSymbolicLink()
      || !containedChild(requestedPublishRoot, requestedRoot)) {
      return { rejection: inputRejected("artifact_identity_mismatch", artifactReference) };
    }
    const inspected = inspectPathWithoutLinks(requestedPublishRoot, requestedRoot);
    if (inspected.reasonCode) {
      return { rejection: inputRejected(inspected.reasonCode, artifactReference) };
    }
    const controlledRoot = realpathSync(requestedPublishRoot);
    const resolvedRoot = realpathSync(requestedRoot);
    if (!containedChild(controlledRoot, resolvedRoot) || !statSync(resolvedRoot).isDirectory()) {
      return { rejection: inputRejected("artifact_identity_mismatch", artifactReference) };
    }
    return { filePath: resolvedRoot };
  } catch (error) {
    return { rejection: inputRejected(ioReason(error), artifactReference) };
  }
}

function readOptionalArtifact(evidenceRoot, relativePath, schema, hooks) {
  const artifactReference = path.basename(String(relativePath)) || "artifact.json";
  if (typeof relativePath !== "string" || relativePath.trim().length === 0) {
    return { rejection: inputRejected("artifact_contract_invalid", artifactReference) };
  }
  if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes("..")) {
    return { rejection: inputRejected("artifact_identity_mismatch", artifactReference) };
  }
  try {
    const candidate = path.resolve(evidenceRoot, relativePath);
    if (!containedChild(evidenceRoot, candidate)) {
      return { rejection: inputRejected("artifact_identity_mismatch", artifactReference) };
    }
    const inspected = inspectPathWithoutLinks(evidenceRoot, candidate);
    if (inspected.reasonCode) return { rejection: inputRejected(inspected.reasonCode, artifactReference) };
    const realPath = realpathSync(candidate);
    if (!containedChild(evidenceRoot, realPath)) {
      return { rejection: inputRejected("artifact_identity_mismatch", artifactReference) };
    }
    const loaded = readVerifiedBytes(realPath, artifactReference, hooks);
    if (loaded.rejection) return loaded;
    const parsed = schema.safeParse(JSON.parse(loaded.bytes.toString("utf8")));
    if (!parsed.success) return { rejection: inputRejected("artifact_contract_invalid", artifactReference) };
    return {
      value: parsed.data,
      reference: { artifact: artifactReference, contentHash: createHash("sha256").update(loaded.bytes).digest("hex") },
    };
  } catch (error) {
    return { rejection: inputRejected(error instanceof SyntaxError ? "artifact_contract_invalid" : ioReason(error), artifactReference) };
  }
}

function exactUniqueSelection(selectedWorksheetNames, readyNames) {
  if (!Array.isArray(selectedWorksheetNames)
    || selectedWorksheetNames.length === 0
    || selectedWorksheetNames.some((name) => typeof name !== "string" || name.length === 0)
    || new Set(selectedWorksheetNames).size !== selectedWorksheetNames.length
    || selectedWorksheetNames.some((name) => !readyNames.includes(name))) return undefined;
  return selectedWorksheetNames;
}

function indexExactlyOnce(records, selection) {
  const result = new Map();
  for (const worksheetName of selection) {
    const matches = records.filter((record) => record.worksheetName === worksheetName);
    if (matches.length !== 1) return undefined;
    result.set(worksheetName, matches[0]);
  }
  return result;
}

function indexCalculationsExactlyOnce(calculations, selection) {
  const result = new Map();
  for (const worksheetName of selection) {
    const matches = calculations
      .map((calculation, index) => ({ calculation, calculationIndex: index + 1 }))
      .filter(({ calculation }) => calculation.worksheetSelection.worksheetName === worksheetName);
    if (matches.length !== 1) return undefined;
    result.set(worksheetName, matches[0]);
  }
  return result;
}

function f2Findings(worksheet, f2Reference) {
  // F2 validation codes remain ordinary abnormalities or governance gaps. A
  // confirmed requirement violation must arrive as an explicit governed finding.
  return worksheet.rows.flatMap((row) => [
    ...row.missingRequiredFields.map((field) => ({
      findingCode: `missing_required_field:${field}`,
      findingKind: "validation_abnormality",
      severity: "Critical",
      message: `Required field ${field} is unavailable.`,
      affectsCapabilityData: true,
      evidenceReferences: [f2Reference],
    })),
    ...row.missingIdentifiers.map((field) => ({
      findingCode: `missing_identifier:${field}`,
      findingKind: "governance_gap",
      severity: "Major",
      message: `Governed identifier ${field} is unavailable.`,
      affectsCapabilityData: false,
      evidenceReferences: [f2Reference],
    })),
  ]);
}

function blockedValidation(worksheet, f2Reference) {
  const findings = f2Findings(worksheet, f2Reference);
  if (worksheet.tolerancePathImageStatus === "unavailable") {
    findings.push({
      findingCode: "tolerance_path_image_unavailable",
      findingKind: "validation_abnormality",
      severity: "Critical",
      message: "Tolerance-path image evidence is unavailable.",
      affectsCapabilityData: false,
      evidenceReferences: [f2Reference],
    });
  }
  for (const issue of worksheet.systemSpecificationIssues) {
    findings.push({
      findingCode: `system_specification:${issue.field}:${issue.reasonCode}`,
      findingKind: "validation_abnormality",
      severity: "Critical",
      message: `System specification ${issue.field} is unavailable.`,
      affectsCapabilityData: true,
      evidenceReferences: [f2Reference],
    });
  }
  if (findings.length === 0) {
    findings.push({
      findingCode: "f2_worksheet_blocked",
      findingKind: "validation_abnormality",
      severity: "Critical",
      message: "F2 validation blocked this worksheet.",
      affectsCapabilityData: true,
      evidenceReferences: [f2Reference],
    });
  }
  return { worksheetName: worksheet.worksheetName, findings };
}

function f2WorksheetMatchesHandoff(worksheet, handoff, workbookContentHash) {
  try {
    return isDeepStrictEqual(createF4Handoff({ workbookContentHash, worksheet }), handoff);
  } catch {
    return false;
  }
}

export function loadF6ArtifactBundle({
  f2ArtifactRoot,
  f3ArtifactRoot,
  f4ArtifactRoot,
  f5ArtifactRoot,
  publishRoot,
  selectedWorksheetNames,
  evidenceArtifactRoot,
  imageObservationArtifact,
  supplierCapabilityArtifact,
  datumStrategyArtifact,
  costArtifact,
  analysisContextArtifact,
  optimizationTargetsArtifact,
  modelInterpretationArtifactRoot,
  modelInterpretationArtifact,
}, hooks) {
  const governedRoots = [
    [f2ArtifactRoot, ARTIFACTS.f2],
    [f3ArtifactRoot, ARTIFACTS.f3],
    [f4ArtifactRoot, ARTIFACTS.f4],
    [f5ArtifactRoot, ARTIFACTS.f5],
  ].map(([artifactRoot, artifactReference]) => validatedGovernedRoot(
    artifactRoot,
    artifactReference,
    publishRoot,
  ));
  const rejectedRoot = governedRoots.find(({ rejection }) => rejection);
  if (rejectedRoot) return rejectedRoot.rejection;
  const [f2Root, f3Root, f4Root, f5Root] = governedRoots.map(({ filePath }) => filePath);

  const f2Loaded = readArtifact(f2Root, ARTIFACTS.f2, f2UserReportSchema, hooks);
  if (f2Loaded.rejection) return f2Loaded.rejection;
  const f3Loaded = readArtifact(f3Root, ARTIFACTS.f3, drawingGovernanceResultV2Schema, hooks);
  if (f3Loaded.rejection) return f3Loaded.rejection;
  const f4Loaded = readArtifact(f4Root, ARTIFACTS.f4, f4WorkflowCalculationResultSchema, hooks);
  if (f4Loaded.rejection) return f4Loaded.rejection;
  const f5Loaded = readArtifact(f5Root, ARTIFACTS.f5, f5DataInterpretationResultSchema, hooks);
  if (f5Loaded.rejection) return f5Loaded.rejection;

  const f2 = f2Loaded.value;
  const f3 = f3Loaded.value;
  const f4 = f4Loaded.value;
  const f5 = f5Loaded.value;
  if (f2.status === "inputRejected") return inputRejected("artifact_contract_invalid", ARTIFACTS.f2);
  if (f3.status === "input_rejected") return inputRejected("artifact_contract_invalid", ARTIFACTS.f3);
  if (f5.status !== "completed") return inputRejected("artifact_contract_invalid", ARTIFACTS.f5);
  const workbook = f2.workbook;
  if (f3.workbook.fileName !== workbook.fileName
    || f3.workbook.contentHash !== workbook.contentHash
    || f4.source.workbookFileName !== workbook.fileName
    || f4.source.workbookContentHash !== workbook.contentHash
    || f5.workbook.fileName !== workbook.fileName
    || f5.workbook.contentHash !== workbook.contentHash) {
    return inputRejected("artifact_identity_mismatch", ARTIFACTS.f2);
  }

  const readyWorksheets = f2.worksheets.filter(({ status }) => status === "ready");
  const reportScope = {
    worksheetNames: f2.worksheets.map(({ worksheetName }) => worksheetName),
    blockedWorksheetNames: f2.worksheets
      .filter(({ status }) => status === "blocked")
      .map(({ worksheetName }) => worksheetName),
  };
  const selection = exactUniqueSelection(selectedWorksheetNames, readyWorksheets.map(({ worksheetName }) => worksheetName));
  if (!selection) return inputRejected("worksheet_selection_invalid", "selectedWorksheetNames");
  const f2ByName = indexExactlyOnce(readyWorksheets, selection);
  const handoffByName = indexExactlyOnce(f2.f4Handoffs, selection);
  const f3ByName = indexExactlyOnce(f3.worksheets, selection);
  const f4ByName = indexCalculationsExactlyOnce(f4.calculations, selection);
  const f5ByName = indexExactlyOnce(f5.worksheets.filter(({ status }) => status === "completed"), selection);
  if (!f2ByName || !handoffByName || !f3ByName || !f4ByName || !f5ByName) {
    return inputRejected("artifact_identity_mismatch", "selectedWorksheetNames");
  }

  const sourceReferences = {
    f2: f2Loaded.reference,
    f3: f3Loaded.reference,
    f4: { ...f4Loaded.reference, runId: f4.runId, calculationVersion: "excel-ta-v1" },
    f5: { ...f5Loaded.reference, interpretationVersion: f5.interpretationVersion },
  };
  const requestWorksheets = [];
  for (const worksheetName of selection) {
    const f2Worksheet = f2ByName.get(worksheetName);
    const handoff = handoffByName.get(worksheetName);
    const f3Worksheet = f3ByName.get(worksheetName);
    const { calculation: baselineCalculation, calculationIndex: f4CalculationIndex } = f4ByName.get(worksheetName);
    const f5Worksheet = f5ByName.get(worksheetName);
    if (!f2WorksheetMatchesHandoff(f2Worksheet, handoff, workbook.contentHash)) {
      return inputRejected("artifact_identity_mismatch", `worksheet:${worksheetName}`);
    }
    const expectedProjectReference = `f4-${workbook.contentHash.slice(0, 16)}`;
    const expectedRunReference = `${f4.runId}-${f4CalculationIndex}`;
    if (baselineCalculation.projectReference !== expectedProjectReference
      || baselineCalculation.runReference !== expectedRunReference
      || baselineCalculation.recommendation.criticality !== "none") {
      return inputRejected("artifact_identity_mismatch", `worksheet:${worksheetName}`);
    }
    let baselineCalculationRequest;
    try {
      baselineCalculationRequest = createCalculationRequestFromF4Handoff({
        handoff,
        projectReference: expectedProjectReference,
        runReference: expectedRunReference,
        criticality: "none",
      });
    } catch {
      return inputRejected("artifact_identity_mismatch", ARTIFACTS.f2);
    }
    let replay;
    try {
      replay = (hooks?.replayCalculation ?? createCalculation)(baselineCalculationRequest);
    } catch {
      return inputRejected("artifact_identity_mismatch", `worksheet:${worksheetName}`);
    }
    if (!isDeepStrictEqual(replay, baselineCalculation)
      || !isDeepStrictEqual(f3Worksheet.rows, f5Worksheet.governanceRows)
      || !isDeepStrictEqual(baselineCalculation, f5Worksheet.calculationResult)) {
      return inputRejected("artifact_identity_mismatch", `worksheet:${worksheetName}`);
    }
    requestWorksheets.push({
      worksheetName,
      f4CalculationIndex,
      baselineCalculationRequest,
      baselineCalculation,
      f5Worksheet,
      f3GovernanceRows: f3Worksheet.rows,
      f2Findings: f2Findings(f2Worksheet, sourceReferences.f2),
      supplierBindings: [],
    });
  }

  const optionalRequestFields = {};
  const hasOptionalEvidence = [
    imageObservationArtifact,
    supplierCapabilityArtifact,
    datumStrategyArtifact,
    costArtifact,
    analysisContextArtifact,
    optimizationTargetsArtifact,
  ].some((artifact) => artifact !== undefined);
  let evidenceRoot;
  if (evidenceArtifactRoot !== undefined || hasOptionalEvidence) {
    const validatedRoot = validatedGovernedRoot(evidenceArtifactRoot, "evidenceArtifactRoot", publishRoot);
    if (validatedRoot.rejection) return validatedRoot.rejection;
    evidenceRoot = validatedRoot.filePath;
  }
  if (imageObservationArtifact !== undefined) {
    const loaded = readOptionalArtifact(evidenceRoot, imageObservationArtifact, f5ImageObservationArtifactSchema, hooks);
    if (loaded.rejection) return loaded.rejection;
    const observation = loaded.value;
    const observationByName = indexExactlyOnce(observation.worksheets, selection);
    if (observation.workbookContentHash !== workbook.contentHash
      || observation.worksheets.length !== selection.length
      || !observationByName) {
      return inputRejected("artifact_identity_mismatch", loaded.reference.artifact);
    }
    const expectedWorksheets = [];
    for (const worksheetName of selection) {
      const observed = observationByName.get(worksheetName);
      const f3Worksheet = f3ByName.get(worksheetName);
      const baselineCalculation = f4ByName.get(worksheetName).calculation;
      if (!isDeepStrictEqual(observed.imageReference, f5ByName.get(worksheetName).imageReference)) {
        return inputRejected("artifact_identity_mismatch", loaded.reference.artifact);
      }
      expectedWorksheets.push({
        worksheetName,
        imageReference: observed.imageReference,
        governanceRows: f3Worksheet.rows,
        calculationResult: baselineCalculation,
        ...(observation.observationVersion === "f5-image-observation-v2"
          ? {
            observationVersion: observation.observationVersion,
            contextSnapshot: observed.contextSnapshot,
            imageObservations: observed.observations,
          }
          : { imageObservations: observed.observations }),
      });
    }
    let expectedF5;
    try {
      expectedF5 = createF5DataInterpretation({
        contractVersion: "v1",
        inputClassification: "confidential",
        workbook: { fileName: workbook.fileName, contentHash: workbook.contentHash },
        knowledgeBaseVersion: f5.knowledgeBaseVersion,
        worksheets: expectedWorksheets,
      });
    } catch {
      return inputRejected("artifact_identity_mismatch", loaded.reference.artifact);
    }
    if (expectedF5.status === "input_rejected"
      || expectedF5.worksheets.some((worksheet) =>
        !isDeepStrictEqual(worksheet, f5ByName.get(worksheet.worksheetName)))) {
      return inputRejected("artifact_identity_mismatch", loaded.reference.artifact);
    }
    optionalRequestFields.imageObservationReference = loaded.reference;
    sourceReferences.imageObservation = loaded.reference;
  }

  if (supplierCapabilityArtifact !== undefined) {
    const loaded = readOptionalArtifact(evidenceRoot, supplierCapabilityArtifact, f6SupplierCapabilityEvidenceSchema, hooks);
    if (loaded.rejection) return loaded.rejection;
    if (loaded.value.source !== loaded.reference.artifact) {
      return inputRejected("artifact_identity_mismatch", loaded.reference.artifact);
    }
    optionalRequestFields.supplierCapabilityEvidence = [loaded.value];
    optionalRequestFields.supplierCapabilityReference = loaded.reference;
    sourceReferences.supplierCapability = loaded.reference;
  }

  if (datumStrategyArtifact !== undefined) {
    const loaded = readOptionalArtifact(evidenceRoot, datumStrategyArtifact, f6DatumEvidenceSchema, hooks);
    if (loaded.rejection) return loaded.rejection;
    const requestWorksheet = requestWorksheets.find(({ worksheetName }) => worksheetName === loaded.value.worksheetName);
    const sourceKeys = new Set(requestWorksheet?.baselineCalculation.factors.map(
      ({ source }) => `${source.tableId}\u0000${source.sourceRow}`,
    ));
    if (loaded.value.source !== loaded.reference.artifact
      || !requestWorksheet
      || loaded.value.factorDirections.some(({ tableId, sourceRow }) => !sourceKeys.has(`${tableId}\u0000${sourceRow}`))) {
      return inputRejected("artifact_identity_mismatch", loaded.reference.artifact);
    }
    optionalRequestFields.datumEvidence = [loaded.value];
    optionalRequestFields.datumStrategyReference = loaded.reference;
    sourceReferences.datumStrategy = loaded.reference;
  }

  if (costArtifact !== undefined) {
    const loaded = readOptionalArtifact(evidenceRoot, costArtifact, f6CostEvidenceSchema, hooks);
    if (loaded.rejection) return loaded.rejection;
    if (loaded.value.source !== loaded.reference.artifact
      || !isDeepStrictEqual(loaded.value.roiCalculationReference, f4Loaded.reference)) {
      return inputRejected("artifact_identity_mismatch", loaded.reference.artifact);
    }
    optionalRequestFields.costEvidence = loaded.value;
    optionalRequestFields.costReference = loaded.reference;
    sourceReferences.cost = loaded.reference;
  }

  let analysisContext;
  let optimizationTargets;
  let modelInterpretation;
  const inputDecisions = {
    analysisContext: { outcome: "NOT_PROVIDED" },
    optimizationTargets: { outcome: "NOT_PROVIDED" },
    modelInterpretation: { outcome: "NOT_PROVIDED" },
  };
  const baselineIdentityFor = (requestWorksheet) => ({
    calculationVersion: requestWorksheet.baselineCalculation.calculationVersion,
    projectReference: requestWorksheet.baselineCalculation.projectReference,
    runReference: requestWorksheet.baselineCalculation.runReference,
    workbookContentHash: requestWorksheet.baselineCalculation.workbookContentHash,
    worksheetName: requestWorksheet.baselineCalculation.worksheetSelection.worksheetName,
    tableId: requestWorksheet.baselineCalculation.worksheetSelection.tableId,
  });
  const factorIdentityFor = (factor) => ({
    worksheetName: factor.source.worksheetName,
    tableId: factor.source.tableId,
    sourceRow: factor.source.sourceRow,
    factorName: factor.factorName,
    unit: factor.unit,
  });
  const exactBaseline = (records) => records.length === requestWorksheets.length && records.every((record) => {
    const requestWorksheet = requestWorksheets.find(({ worksheetName }) => worksheetName === record.worksheetName);
    return requestWorksheet !== undefined
      && record.tableId === requestWorksheet.baselineCalculation.worksheetSelection.tableId
      && isDeepStrictEqual(record.baselineIdentity, baselineIdentityFor(requestWorksheet));
  });
  if (analysisContextArtifact !== undefined) {
    const loaded = readOptionalArtifact(evidenceRoot, analysisContextArtifact, f6AnalysisContextSchema, hooks);
    if (loaded.rejection) return loaded.rejection;
    if (loaded.value.workbookContentHash !== workbook.contentHash || !exactBaseline(loaded.value.worksheets)) {
      return inputRejected("artifact_identity_mismatch", loaded.reference.artifact);
    }
    for (const worksheet of loaded.value.worksheets) {
      const requestWorksheet = requestWorksheets.find(({ worksheetName }) => worksheetName === worksheet.worksheetName);
      const factors = requestWorksheet.baselineCalculation.factors.map(factorIdentityFor);
      if ((worksheet.loopDefinition?.factors ?? []).some(({ factor }) => !factors.some((candidate) => isDeepStrictEqual(candidate, factor)))) {
        return inputRejected("artifact_identity_mismatch", loaded.reference.artifact);
      }
    }
    analysisContext = loaded.value;
    inputDecisions.analysisContext = { outcome: "CALLER_AUTHORIZED", artifactReference: loaded.reference };
    sourceReferences.analysisContext = loaded.reference;
  }
  if (optimizationTargetsArtifact !== undefined) {
    const loaded = readOptionalArtifact(evidenceRoot, optimizationTargetsArtifact, f6OptimizationTargetsSchema, hooks);
    if (loaded.rejection) return loaded.rejection;
    if (loaded.value.workbookContentHash !== workbook.contentHash || !exactBaseline(loaded.value.worksheets)) {
      return inputRejected("artifact_identity_mismatch", loaded.reference.artifact);
    }
    for (const worksheet of loaded.value.worksheets) {
      const requestWorksheet = requestWorksheets.find(({ worksheetName }) => worksheetName === worksheet.worksheetName);
      const factors = requestWorksheet.baselineCalculation.factors.map(factorIdentityFor);
      for (const target of worksheet.targets) {
        const identities = target.targetType === "system_target" ? target.apportionment.selectedFactors : [target.factor];
        if (identities.some((identity) => !factors.some((candidate) => isDeepStrictEqual(candidate, identity)))) {
          return inputRejected("artifact_identity_mismatch", loaded.reference.artifact);
        }
      }
    }
    optimizationTargets = loaded.value;
    inputDecisions.optimizationTargets = { outcome: "CALLER_AUTHORIZED", artifactReference: loaded.reference };
    sourceReferences.optimizationTargets = loaded.reference;
  }

  if (modelInterpretationArtifactRoot !== undefined || modelInterpretationArtifact !== undefined) {
    const validatedRoot = validatedGovernedRoot(
      modelInterpretationArtifactRoot,
      "modelInterpretationArtifactRoot",
      publishRoot,
    );
    if (validatedRoot.rejection || typeof modelInterpretationArtifact !== "string" || modelInterpretationArtifact.trim() === "") {
      inputDecisions.modelInterpretation = rejectedModelDecision(
        modelInterpretationArtifactRoot,
        modelInterpretationArtifact,
        validatedRoot.rejection,
      );
    } else {
      const loaded = readOptionalArtifact(
        validatedRoot.filePath,
        modelInterpretationArtifact,
        f6ModelInterpretationArtifactSchema,
        hooks,
      );
      if (loaded.rejection) {
        inputDecisions.modelInterpretation = rejectedModelDecision(
          modelInterpretationArtifactRoot,
          modelInterpretationArtifact,
          loaded.rejection,
        );
      } else {
        let rejectionReason;
        if (loaded.value.workbookContentHash !== workbook.contentHash
          || !exactBaseline(loaded.value.worksheets)
          || !isDeepStrictEqual(loaded.value.worksheets.map(({ worksheetName }) => worksheetName), selection)) {
          rejectionReason = "identity_mismatch";
        }
        for (const worksheet of loaded.value.worksheets) {
          if (rejectionReason !== undefined) break;
          const requestWorksheet = requestWorksheets.find(({ worksheetName }) => worksheetName === worksheet.worksheetName);
          const f5Worksheet = f5ByName.get(worksheet.worksheetName);
          const expectedImageReference = {
            artifact: f5Worksheet.imageReference.relativePath,
            contentHash: f5Worksheet.imageReference.contentHash,
            worksheetName: worksheet.worksheetName,
          };
          const expectedObservationReference = sourceReferences.imageObservation === undefined
            ? undefined
            : { ...sourceReferences.imageObservation, observationVersion: "f5-image-observation-v2" };
          if (!requestWorksheet
            || !isDeepStrictEqual(worksheet.sourceReferences.f2, sourceReferences.f2)
            || !isDeepStrictEqual(worksheet.sourceReferences.f4, sourceReferences.f4)
            || !isDeepStrictEqual(worksheet.sourceReferences.f5, sourceReferences.f5)
            || !isDeepStrictEqual(worksheet.sourceReferences.image, expectedImageReference)
            || !isDeepStrictEqual(worksheet.sourceReferences.imageObservation, expectedObservationReference)) {
            rejectionReason = "identity_mismatch";
            break;
          }
          for (const claim of worksheet.calculationClaims) {
            const factorMatch = /^factors\[(\d+)\]\.(mean|halfTolerance|sigma|contribution)$/.exec(claim.outputField);
            let expectedValue;
            let expectedUnit = null;
            let expectedDisplayFormat;
            if (factorMatch !== null) {
              const factor = requestWorksheet.baselineCalculation.factors[Number(factorMatch[1])];
              expectedValue = factor?.[factorMatch[2]];
              expectedUnit = factorMatch[2] === "contribution" ? null : factor?.unit ?? null;
              expectedDisplayFormat = factorMatch[2] === "contribution" ? "percent" : "engineering";
            } else {
              const [group, field] = claim.outputField.split(".");
              expectedValue = requestWorksheet.baselineCalculation[group]?.[field];
              const dimensionalCapability = group === "capability" && new Set(["lowerSpecLimit", "upperSpecLimit"]).has(field);
              expectedUnit = group === "system" || dimensionalCapability
                ? requestWorksheet.baselineCalculation.factors[0]?.unit ?? null
                : null;
              expectedDisplayFormat = group === "system" || dimensionalCapability
                ? "engineering"
                : new Set(["outOfSpecRatio", "yield"]).has(field)
                  ? "percent"
                  : "number";
            }
            if (!Object.is(claim.rawValue, expectedValue)) {
              rejectionReason = "identity_mismatch";
              break;
            }
            if (claim.unit !== expectedUnit) {
              rejectionReason = "unit_mismatch";
              break;
            }
            if (claim.displayFormat !== expectedDisplayFormat) {
              rejectionReason = "identity_mismatch";
              break;
            }
          }
        }
        if (rejectionReason !== undefined) {
          inputDecisions.modelInterpretation = rejectedModelDecision(
            modelInterpretationArtifactRoot,
            modelInterpretationArtifact,
            undefined,
            loaded.reference,
            rejectionReason,
          );
        } else {
          modelInterpretation = loaded.value;
          inputDecisions.modelInterpretation = { outcome: "CALLER_AUTHORIZED", artifactReference: loaded.reference };
          sourceReferences.modelInterpretation = loaded.reference;
        }
      }
    }
  }

  const request = f6OptimizationRequestSchema.safeParse({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: workbook.fileName, contentHash: workbook.contentHash },
    selectedWorksheetNames: selection,
    reportScope,
    f2Reference: sourceReferences.f2,
    f3Reference: sourceReferences.f3,
    f4Reference: sourceReferences.f4,
    f5Reference: sourceReferences.f5,
    f0Versions: {
      knowledgeBaseVersion: f2.knowledgeBaseVersions[0],
      capabilityVersion: f2.knowledgeBaseVersions[1],
      interpretationVersion: f5.knowledgeBaseVersion,
    },
    scenarioPolicyVersion: "f6-scenario-policy-v1",
    ...optionalRequestFields,
    worksheets: requestWorksheets,
  });
  if (!request.success) return inputRejected("artifact_contract_invalid", "F6-request");
  return {
    status: "accepted",
    request: request.data,
    f2Report: f2,
    f3Report: f3,
    f4Report: f4,
    f5Report: f5,
    blockedWorksheets: f2.worksheets
      .filter(({ status }) => status === "blocked")
      .map((worksheet) => blockedValidation(worksheet, sourceReferences.f2)),
    sourceReferences,
    analysisContext,
    optimizationTargets,
    modelInterpretation,
    inputDecisions,
  };
}