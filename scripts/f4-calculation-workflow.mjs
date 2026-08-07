import {
  calculationCompletedResultSchema,
  f4HandoffReadySchema,
  f4WorkflowCalculationResultSchema,
} from "../packages/contracts/dist/contracts.js";
import {
  createCalculation,
  createCalculationRequestFromF4Handoff,
} from "../packages/workbook-catalog/dist/index.js";
import { deserialize, serialize } from "node:v8";

const ARTIFACT_REFERENCE = "Feature2-Report.json";
const SAFE_ERROR_MESSAGE = "F4 workflow calculation failed.";
const RUN_ID_MAX_LENGTH = 96;
const RUN_REFERENCE_MAX_LENGTH = 128;
const WORKBOOK_FILE_NAME_MAX_LENGTH = 240;
const CONTROLLED_REFERENCE_PATTERN = /^[A-Za-z0-9._:-]+$/;
const SAFE_WORKBOOK_FILE_NAME_PATTERN = new RegExp(
  `^[^/\\\\${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]+\\.xlsx$`,
  "i",
);

function workflowError(code) {
  const error = new Error(SAFE_ERROR_MESSAGE);
  error.code = code;
  return error;
}

function isWorkflowError(error) {
  return error instanceof Error && error.message === SAFE_ERROR_MESSAGE;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze(value) {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function deepClone(value) {
  return deserialize(serialize(value));
}

function normalizeControlledReference(value, { maxLength }) {
  if (typeof value !== "string") throw workflowError("invalid_arguments");
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) throw workflowError("invalid_arguments");
  if (!CONTROLLED_REFERENCE_PATTERN.test(trimmed)) throw workflowError("invalid_arguments");
  return trimmed;
}

function normalizeGeneratedAt(value) {
  if (value === undefined) return new Date().toISOString();
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw workflowError("invalid_arguments");
  return value;
}

function normalizeWorkbookFileName(value) {
  if (typeof value !== "string") throw workflowError("invalid_input");
  const fileName = value.trim();
  if (fileName.length === 0 || fileName.length > WORKBOOK_FILE_NAME_MAX_LENGTH) {
    throw workflowError("invalid_input");
  }
  if (!SAFE_WORKBOOK_FILE_NAME_PATTERN.test(fileName) || fileName.includes("..")) {
    throw workflowError("invalid_input");
  }
  return fileName;
}

function normalizeDependencies(options) {
  const source = options === undefined ? {} : options;
  if (!isPlainObject(source)) throw workflowError("invalid_arguments");

  const allowedKeys = new Set(["runId", "generatedAt", "createRequest", "calculate"]);
  for (const key of Object.keys(source)) {
    if (!allowedKeys.has(key)) throw workflowError("invalid_arguments");
  }

  const runId = normalizeControlledReference(source.runId, { maxLength: RUN_ID_MAX_LENGTH });
  const generatedAt = normalizeGeneratedAt(source.generatedAt);
  const createRequest = source.createRequest ?? createCalculationRequestFromF4Handoff;
  const calculate = source.calculate ?? createCalculation;

  if (typeof createRequest !== "function" || typeof calculate !== "function") {
    throw workflowError("invalid_arguments");
  }

  return { runId, generatedAt, createRequest, calculate };
}

function parseLoadedInput(loaded) {
  if (!isPlainObject(loaded)) throw workflowError("invalid_input");
  if (loaded.status !== "accepted") throw workflowError("invalid_input");
  if (loaded.reportPath !== ARTIFACT_REFERENCE) throw workflowError("invalid_input");

  if (!isPlainObject(loaded.workbook)) throw workflowError("invalid_input");
  const workbookFileName = normalizeWorkbookFileName(loaded.workbook.fileName);
  const workbookContentHash = typeof loaded.workbook.contentHash === "string" ? loaded.workbook.contentHash : "";
  const f1GeneratedAt = typeof loaded.workbook.f1GeneratedAt === "string" ? loaded.workbook.f1GeneratedAt : "";
  if (!/^[a-f0-9]{64}$/i.test(workbookContentHash)) throw workflowError("invalid_input");
  if (Number.isNaN(Date.parse(f1GeneratedAt))) throw workflowError("invalid_input");

  if (!Array.isArray(loaded.handoffs) || loaded.handoffs.length === 0) throw workflowError("invalid_input");
  if (loaded.handoffs.length > 100) throw workflowError("invalid_input");

  const handoffs = [];
  const worksheetNames = new Set();
  for (const rawHandoff of loaded.handoffs) {
    const parsed = f4HandoffReadySchema.safeParse(rawHandoff);
    if (!parsed.success) throw workflowError("invalid_input");

    const handoff = parsed.data;
    if (worksheetNames.has(handoff.worksheetName)) throw workflowError("invalid_input");
    worksheetNames.add(handoff.worksheetName);

    if (handoff.workbookContentHash !== workbookContentHash) throw workflowError("evidence_mismatch");

    const uniqueTableIds = new Set(handoff.factors.map((factor) => factor.tableId));
    if (uniqueTableIds.size !== 1) throw workflowError("invalid_input");
    const [tableId] = uniqueTableIds;

    handoffs.push({
      handoff,
      tableId,
    });
  }

  return {
    workbook: {
      fileName: workbookFileName,
      contentHash: workbookContentHash,
      f1GeneratedAt,
    },
    handoffs,
  };
}

export function calculateF4Workflow(loaded, options) {
  try {
    const dependencies = normalizeDependencies(options);
    const parsedLoaded = parseLoadedInput(loaded);
    const projectReference = `f4-${parsedLoaded.workbook.contentHash.slice(0, 16)}`;
    const calculations = [];

    for (const [index, handoffItem] of parsedLoaded.handoffs.entries()) {
      const runReference = normalizeControlledReference(
        `${dependencies.runId}-${index + 1}`,
        { maxLength: RUN_REFERENCE_MAX_LENGTH },
      );

      const request = dependencies.createRequest({
        handoff: handoffItem.handoff,
        projectReference,
        runReference,
        criticality: "none",
      });

      const calculation = dependencies.calculate(request);
      const parsedCalculation = calculationCompletedResultSchema.safeParse(calculation);
      if (!parsedCalculation.success) throw workflowError("calculation_failed");

      if (parsedCalculation.data.projectReference !== projectReference) throw workflowError("evidence_mismatch");
      if (parsedCalculation.data.runReference !== runReference) throw workflowError("evidence_mismatch");
      if (parsedCalculation.data.workbookContentHash !== parsedLoaded.workbook.contentHash) {
        throw workflowError("evidence_mismatch");
      }
      if (parsedCalculation.data.worksheetSelection.worksheetName !== handoffItem.handoff.worksheetName) {
        throw workflowError("evidence_mismatch");
      }
      if (parsedCalculation.data.worksheetSelection.tableId !== handoffItem.tableId) {
        throw workflowError("evidence_mismatch");
      }

      calculations.push(parsedCalculation.data);
    }

    const assembled = {
      contractVersion: "v1",
      workflowVersion: "f4-f2-v1",
      outputClassification: "confidential",
      featureId: "F4",
      status: "completed",
      runId: dependencies.runId,
      generatedAt: dependencies.generatedAt,
      source: {
        artifactReference: ARTIFACT_REFERENCE,
        workbookFileName: parsedLoaded.workbook.fileName,
        workbookContentHash: parsedLoaded.workbook.contentHash,
      },
      calculations,
      summary: {
        selectedWorksheetCount: calculations.length,
        completedWorksheetCount: calculations.length,
      },
    };

    const parsedWorkflow = f4WorkflowCalculationResultSchema.safeParse(assembled);
    if (!parsedWorkflow.success) throw workflowError("output_invalid");

    return deepFreeze(deepClone(parsedWorkflow.data));
  } catch (error) {
    if (isWorkflowError(error)) throw error;
    throw workflowError("calculation_failed");
  }
}
