import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  drawingGovernanceResultV2Schema,
  f2UserReportSchema,
  f4WorkflowCalculationResultSchema,
  f5DataInterpretationResultSchema,
  f5ImageObservationArtifactSchema,
  f6CostEvidenceSchema,
  f6DatumEvidenceSchema,
  f6OptimizationRequestSchema,
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

function inputRejected(reasonCode, artifactReference) {
  return { status: "inputRejected", reasonCode, artifactReference };
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

function readArtifact(root, artifactReference, schema) {
  const child = canonicalChild(root, artifactReference);
  if (!child.filePath) return { rejection: inputRejected(child.reasonCode, artifactReference) };
  try {
    const stat = statSync(child.filePath);
    if (!stat.isFile() || stat.size > MAX_JSON_BYTES) {
      return { rejection: inputRejected("artifact_contract_invalid", artifactReference) };
    }
    const bytes = readFileSync(child.filePath);
    const parsed = schema.safeParse(JSON.parse(bytes.toString("utf8")));
    if (!parsed.success) return { rejection: inputRejected("artifact_contract_invalid", artifactReference) };
    return {
      value: parsed.data,
      reference: {
        artifact: artifactReference,
        contentHash: createHash("sha256").update(bytes).digest("hex"),
      },
    };
  } catch (error) {
    return { rejection: inputRejected(error instanceof SyntaxError ? "artifact_contract_invalid" : ioReason(error), artifactReference) };
  }
}

function readOptionalArtifact(filePath, schema) {
  const artifactReference = path.basename(String(filePath)) || "artifact.json";
  if (typeof filePath !== "string" || filePath.length === 0) {
    return { rejection: inputRejected("artifact_contract_invalid", artifactReference) };
  }
  if (filePath.split(/[\\/]/).includes("..")) {
    return { rejection: inputRejected("artifact_identity_mismatch", artifactReference) };
  }
  try {
    const resolved = path.resolve(filePath);
    if (lstatSync(resolved).isSymbolicLink()) {
      return { rejection: inputRejected("artifact_identity_mismatch", artifactReference) };
    }
    const realPath = realpathSync(resolved);
    const stat = statSync(realPath);
    if (!stat.isFile() || stat.size > MAX_JSON_BYTES) {
      return { rejection: inputRejected("artifact_contract_invalid", artifactReference) };
    }
    const bytes = readFileSync(realPath);
    const parsed = schema.safeParse(JSON.parse(bytes.toString("utf8")));
    if (!parsed.success) return { rejection: inputRejected("artifact_contract_invalid", artifactReference) };
    return {
      value: parsed.data,
      reference: { artifact: artifactReference, contentHash: createHash("sha256").update(bytes).digest("hex") },
    };
  } catch (error) {
    return { rejection: inputRejected(error instanceof SyntaxError ? "artifact_contract_invalid" : ioReason(error), artifactReference) };
  }
}

function exactUniqueSelection(selectedWorksheetNames, readyNames) {
  const selection = selectedWorksheetNames === undefined ? readyNames : selectedWorksheetNames;
  if (!Array.isArray(selection)
    || selection.length === 0
    || selection.some((name) => typeof name !== "string" || name.length === 0)
    || new Set(selection).size !== selection.length
    || selection.some((name) => !readyNames.includes(name))) return undefined;
  return selection;
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
    const matches = calculations.filter(
      (calculation) => calculation.worksheetSelection.worksheetName === worksheetName,
    );
    if (matches.length !== 1) return undefined;
    result.set(worksheetName, matches[0]);
  }
  return result;
}

function f2Findings(worksheet, f2Reference) {
  return worksheet.rows.flatMap((row) => [
    ...row.missingRequiredFields.map((field) => ({
      findingCode: `missing_required_field:${field}`,
      severity: "Critical",
      message: `Required field ${field} is unavailable.`,
      evidenceReferences: [f2Reference],
    })),
    ...row.missingIdentifiers.map((field) => ({
      findingCode: `missing_identifier:${field}`,
      severity: "Major",
      message: `Governed identifier ${field} is unavailable.`,
      evidenceReferences: [f2Reference],
    })),
  ]);
}

function blockedValidation(worksheet, f2Reference) {
  const findings = f2Findings(worksheet, f2Reference);
  if (worksheet.tolerancePathImageStatus === "unavailable") {
    findings.push({
      findingCode: "tolerance_path_image_unavailable",
      severity: "Critical",
      message: "Tolerance-path image evidence is unavailable.",
      evidenceReferences: [f2Reference],
    });
  }
  for (const issue of worksheet.systemSpecificationIssues) {
    findings.push({
      findingCode: `system_specification:${issue.field}:${issue.reasonCode}`,
      severity: "Critical",
      message: `System specification ${issue.field} is unavailable.`,
      evidenceReferences: [f2Reference],
    });
  }
  if (findings.length === 0) {
    findings.push({
      findingCode: "f2_worksheet_blocked",
      severity: "Critical",
      message: "F2 validation blocked this worksheet.",
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
  selectedWorksheetNames,
  imageObservationArtifact,
  supplierCapabilityArtifact,
  datumStrategyArtifact,
  costArtifact,
}) {
  const f2Loaded = readArtifact(f2ArtifactRoot, ARTIFACTS.f2, f2UserReportSchema);
  if (f2Loaded.rejection) return f2Loaded.rejection;
  const f3Loaded = readArtifact(f3ArtifactRoot, ARTIFACTS.f3, drawingGovernanceResultV2Schema);
  if (f3Loaded.rejection) return f3Loaded.rejection;
  const f4Loaded = readArtifact(f4ArtifactRoot, ARTIFACTS.f4, f4WorkflowCalculationResultSchema);
  if (f4Loaded.rejection) return f4Loaded.rejection;
  const f5Loaded = readArtifact(f5ArtifactRoot, ARTIFACTS.f5, f5DataInterpretationResultSchema);
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
    const baselineCalculation = f4ByName.get(worksheetName);
    const f5Worksheet = f5ByName.get(worksheetName);
    if (!f2WorksheetMatchesHandoff(f2Worksheet, handoff, workbook.contentHash)) {
      return inputRejected("artifact_identity_mismatch", `worksheet:${worksheetName}`);
    }
    let baselineCalculationRequest;
    try {
      baselineCalculationRequest = createCalculationRequestFromF4Handoff({
        handoff,
        projectReference: baselineCalculation.projectReference,
        runReference: baselineCalculation.runReference,
        criticality: baselineCalculation.recommendation.criticality,
      });
    } catch {
      return inputRejected("artifact_identity_mismatch", ARTIFACTS.f2);
    }
    const replay = createCalculation(baselineCalculationRequest);
    if (!isDeepStrictEqual(replay, baselineCalculation)
      || baselineCalculation.runReference !== f4.runId
      || !isDeepStrictEqual(f3Worksheet.rows, f5Worksheet.governanceRows)
      || !isDeepStrictEqual(baselineCalculation, f5Worksheet.calculationResult)) {
      return inputRejected("artifact_identity_mismatch", `worksheet:${worksheetName}`);
    }
    requestWorksheets.push({
      worksheetName,
      baselineCalculationRequest,
      baselineCalculation,
      f5Worksheet,
      f3GovernanceRows: f3Worksheet.rows,
      f2Findings: f2Findings(f2Worksheet, sourceReferences.f2),
      supplierBindings: [],
    });
  }

  const optionalRequestFields = {};
  if (imageObservationArtifact !== undefined) {
    const loaded = readOptionalArtifact(imageObservationArtifact, f5ImageObservationArtifactSchema);
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
      const baselineCalculation = f4ByName.get(worksheetName);
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
    const loaded = readOptionalArtifact(supplierCapabilityArtifact, f6SupplierCapabilityEvidenceSchema);
    if (loaded.rejection) return loaded.rejection;
    if (loaded.value.source !== loaded.reference.artifact) {
      return inputRejected("artifact_identity_mismatch", loaded.reference.artifact);
    }
    optionalRequestFields.supplierCapabilityEvidence = [loaded.value];
    sourceReferences.supplierCapability = loaded.reference;
  }

  if (datumStrategyArtifact !== undefined) {
    const loaded = readOptionalArtifact(datumStrategyArtifact, f6DatumEvidenceSchema);
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
    sourceReferences.datumStrategy = loaded.reference;
  }

  if (costArtifact !== undefined) {
    const loaded = readOptionalArtifact(costArtifact, f6CostEvidenceSchema);
    if (loaded.rejection) return loaded.rejection;
    if (loaded.value.source !== loaded.reference.artifact
      || !isDeepStrictEqual(loaded.value.roiCalculationReference, f4Loaded.reference)) {
      return inputRejected("artifact_identity_mismatch", loaded.reference.artifact);
    }
    optionalRequestFields.costEvidence = loaded.value;
    sourceReferences.cost = loaded.reference;
  }

  const request = f6OptimizationRequestSchema.safeParse({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: workbook.fileName, contentHash: workbook.contentHash },
    selectedWorksheetNames: selection,
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
    blockedWorksheets: f2.worksheets
      .filter(({ status }) => status === "blocked")
      .map((worksheet) => blockedValidation(worksheet, sourceReferences.f2)),
    sourceReferences,
  };
}