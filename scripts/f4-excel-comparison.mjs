import { spawnSync as nodeSpawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const MAPPING_VERSION = "excel-ta-v1";
const ALLOWED_ROOT_STATUS = new Set(["passed", "mismatch", "excel_unavailable", "mapping_error"]);
const ALLOWED_WORKSHEET_STATUS = new Set(["passed", "mismatch", "excel_unavailable", "mapping_error"]);

function controlledError(message) {
  const error = new Error(message);
  error.name = "F4ExcelComparisonError";
  return error;
}

function sha256Upper(filePath) {
  let content;
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) throw new Error("not-file");
    content = readFileSync(filePath);
  } catch {
    throw controlledError("Workbook is unavailable.");
  }
  return createHash("sha256").update(content).digest("hex").toUpperCase();
}

function parseHarnessJson(stdout) {
  const lines = String(stdout ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) throw controlledError("Excel harness output is invalid.");
  try {
    return JSON.parse(lines.at(-1));
  } catch {
    throw controlledError("Excel harness output is invalid.");
  }
}

function normalizeMappingsInput(mappings) {
  if (Array.isArray(mappings)) {
    return new Map(mappings.map((entry) => [entry?.worksheetName, entry?.mapping]));
  }
  if (mappings && typeof mappings === "object") {
    return new Map(Object.entries(mappings));
  }
  throw controlledError("Mappings are malformed.");
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isControlledString(value, max = 1024, allowEmpty = false) {
  if (typeof value !== "string") return false;
  if (value.length > max) return false;
  if (!allowEmpty && value.trim().length === 0) return false;
  for (const codePoint of value) {
    if (codePoint === "\r" || codePoint === "\n" || codePoint.charCodeAt(0) === 0) {
      return false;
    }
  }
  return true;
}

function validateMapping(mapping) {
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) return false;
  const keys = Object.keys(mapping);
  if (keys.some((key) => !["version", "inputs", "outputs"].includes(key))) return false;
  if (mapping.version !== MAPPING_VERSION) return false;
  if (!Array.isArray(mapping.inputs) || !Array.isArray(mapping.outputs) || mapping.outputs.length === 0) return false;

  for (const input of mapping.inputs) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return false;
    const inputKeys = Object.keys(input);
    if (inputKeys.some((key) => !["cell", "value"].includes(key))) return false;
  }

  for (const output of mapping.outputs) {
    if (!output || typeof output !== "object" || Array.isArray(output)) return false;
    const outputKeys = Object.keys(output);
    if (outputKeys.some((key) => !["name", "cell", "expected", "tolerance", "formulaId"].includes(key))) return false;
    if (!isControlledString(output.name, 128) || !isControlledString(output.cell, 16) || !isControlledString(output.formulaId, 128)) return false;
    if (!(typeof output.expected === "string" || isFiniteNumber(output.expected))) return false;
    if (output.tolerance !== undefined && (!isFiniteNumber(output.tolerance) || output.tolerance < 0 || output.tolerance > 1e-12)) return false;
  }
  return true;
}

function validateMetric(metric) {
  if (!metric || typeof metric !== "object" || Array.isArray(metric)) return false;
  const keys = Object.keys(metric);
  const allowed = [
    "name", "cell", "expected", "actual", "displayText", "absoluteDifference", "relativeDifference", "tolerance", "formula", "formulaId", "pass",
  ];
  if (keys.some((key) => !allowed.includes(key))) return false;
  if (!isControlledString(metric.name, 128)) return false;
  if (!isControlledString(metric.cell, 16)) return false;
  if (!(typeof metric.expected === "string" || isFiniteNumber(metric.expected))) return false;
  if (!(typeof metric.actual === "string" || isFiniteNumber(metric.actual))) return false;
  if (!isControlledString(metric.displayText, 1024, true)) return false;
  if (!(metric.absoluteDifference === null || isFiniteNumber(metric.absoluteDifference))) return false;
  if (!(metric.relativeDifference === null || isFiniteNumber(metric.relativeDifference))) return false;
  if (!(metric.tolerance === null || isFiniteNumber(metric.tolerance))) return false;
  if (!isControlledString(metric.formula, 4096)) return false;
  if (!isControlledString(metric.formulaId, 128)) return false;
  if (typeof metric.pass !== "boolean") return false;
  return true;
}

function normalizeWorksheetResult(worksheetName, harnessPayload, exitStatus) {
  const status = String(harnessPayload?.status ?? "");
  if (status === "regression_passed") {
    return { worksheetName, status: "passed", metrics: Array.isArray(harnessPayload.outputs) ? harnessPayload.outputs : [] };
  }
  if (status === "regression_mismatch") {
    return { worksheetName, status: "mismatch", metrics: Array.isArray(harnessPayload.outputs) ? harnessPayload.outputs : [] };
  }
  if (status === "invalid_mapping") {
    return { worksheetName, status: "mapping_error", metrics: [] };
  }
  if (status === "excel_error") {
    return { worksheetName, status: "excel_unavailable", metrics: [] };
  }
  if (status === "hash_mismatch") {
    throw controlledError("Workbook hash mismatch.");
  }
  if (exitStatus === 0) {
    throw controlledError("Excel harness output is invalid.");
  }
  return { worksheetName, status: "excel_unavailable", metrics: [] };
}

function deriveOverallStatus(worksheets) {
  if (worksheets.some((worksheet) => worksheet.status === "mismatch")) return "mismatch";
  if (worksheets.some((worksheet) => worksheet.status === "mapping_error")) return "mapping_error";
  if (worksheets.some((worksheet) => worksheet.status === "excel_unavailable")) return "excel_unavailable";
  return "passed";
}

function createSummary(worksheets) {
  const metrics = worksheets.flatMap((worksheet) => worksheet.metrics);
  return {
    worksheetCount: worksheets.length,
    passedWorksheetCount: worksheets.filter((worksheet) => worksheet.status === "passed").length,
    mismatchWorksheetCount: worksheets.filter((worksheet) => worksheet.status === "mismatch").length,
    excelUnavailableWorksheetCount: worksheets.filter((worksheet) => worksheet.status === "excel_unavailable").length,
    mappingErrorWorksheetCount: worksheets.filter((worksheet) => worksheet.status === "mapping_error").length,
    metricCount: metrics.length,
    passedMetricCount: metrics.filter((metric) => metric.pass === true).length,
    mismatchedMetricCount: metrics.filter((metric) => metric.pass === false).length,
  };
}

export const f4ExcelComparisonResultSchema = {
  parse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw controlledError("F4 Excel comparison payload is invalid.");
    const keys = Object.keys(value);
    const allowedKeys = ["runId", "workbookContentHash", "status", "worksheets", "summary"];
    if (keys.some((key) => !allowedKeys.includes(key))) throw controlledError("F4 Excel comparison payload is invalid.");
    if (!isControlledString(value.runId, 128)) throw controlledError("F4 Excel comparison payload is invalid.");
    if (!/^[0-9A-F]{64}$/u.test(String(value.workbookContentHash ?? ""))) throw controlledError("F4 Excel comparison payload is invalid.");
    if (!ALLOWED_ROOT_STATUS.has(value.status)) throw controlledError("F4 Excel comparison payload is invalid.");
    if (!Array.isArray(value.worksheets) || value.worksheets.length === 0) throw controlledError("F4 Excel comparison payload is invalid.");
    for (const worksheet of value.worksheets) {
      if (!worksheet || typeof worksheet !== "object" || Array.isArray(worksheet)) throw controlledError("F4 Excel comparison payload is invalid.");
      const worksheetKeys = Object.keys(worksheet);
      if (worksheetKeys.some((key) => !["worksheetName", "status", "metrics"].includes(key))) throw controlledError("F4 Excel comparison payload is invalid.");
      if (!isControlledString(worksheet.worksheetName, 128)) throw controlledError("F4 Excel comparison payload is invalid.");
      if (!ALLOWED_WORKSHEET_STATUS.has(worksheet.status)) throw controlledError("F4 Excel comparison payload is invalid.");
      if (!Array.isArray(worksheet.metrics)) throw controlledError("F4 Excel comparison payload is invalid.");
      for (const metric of worksheet.metrics) {
        if (!validateMetric(metric)) throw controlledError("F4 Excel comparison payload is invalid.");
      }
    }
    const computedStatus = deriveOverallStatus(value.worksheets);
    if (computedStatus !== value.status) throw controlledError("F4 Excel comparison payload is invalid.");
    const expectedSummary = createSummary(value.worksheets);
    const summary = value.summary;
    if (!summary || typeof summary !== "object" || Array.isArray(summary)) throw controlledError("F4 Excel comparison payload is invalid.");
    for (const [field, expected] of Object.entries(expectedSummary)) {
      if (summary[field] !== expected) throw controlledError("F4 Excel comparison payload is invalid.");
    }
    return value;
  },
};

export function compareF4WithExcel({ workbookPath, calculationResult, mappings }, deps = {}) {
  const spawnSync = deps.spawnSync ?? nodeSpawnSync;
  const scriptPath = deps.scriptPath ?? path.resolve(import.meta.dirname, "verify-f4-excel-regression.ps1");
  const workingDirectory = deps.workingDirectory ?? path.resolve(import.meta.dirname, "..");

  if (!workbookPath || typeof workbookPath !== "string") throw controlledError("Workbook path is required.");
  if (!calculationResult || typeof calculationResult !== "object") throw controlledError("Calculation result is invalid.");
  if (!Array.isArray(calculationResult.calculations) || calculationResult.calculations.length === 0) {
    throw controlledError("Calculation result is invalid.");
  }

  const workbookContentHash = String(calculationResult.source?.workbookContentHash ?? calculationResult.calculations[0]?.workbookContentHash ?? "").toUpperCase();
  if (!/^[0-9A-F]{64}$/u.test(workbookContentHash)) throw controlledError("Calculation workbook hash is invalid.");
  const runId = String(calculationResult.runId ?? "");
  if (!isControlledString(runId, 128)) throw controlledError("Calculation runId is invalid.");

  const currentWorkbookHash = sha256Upper(workbookPath);
  if (currentWorkbookHash !== workbookContentHash) throw controlledError("Workbook hash mismatch.");

  const mappingLookup = normalizeMappingsInput(mappings);
  const worksheets = [];

  for (const calculation of calculationResult.calculations) {
    const worksheetName = String(calculation?.worksheetSelection?.worksheetName ?? "");
    if (!isControlledString(worksheetName, 128)) throw controlledError("Calculation worksheet is invalid.");

    const mapping = mappingLookup.get(worksheetName);
    if (!validateMapping(mapping)) {
      worksheets.push({ worksheetName, status: "mapping_error", metrics: [] });
      continue;
    }

    const tempMappingPath = path.join(tmpdir(), `f4-excel-comparison-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
    try {
      writeFileSync(tempMappingPath, JSON.stringify(mapping), "utf8");
      const run = spawnSync("pwsh", [
        "-NoProfile",
        "-File",
        scriptPath,
        "-WorkbookPath",
        workbookPath,
        "-ExpectedSha256",
        workbookContentHash,
        "-WorksheetName",
        worksheetName,
        "-MappingPath",
        tempMappingPath,
      ], {
        cwd: workingDirectory,
        encoding: "utf8",
        env: { ...process.env },
      });
      if (run.error) throw controlledError("Excel harness invocation failed.");
      const payload = parseHarnessJson(run.stdout);
      const normalized = normalizeWorksheetResult(worksheetName, payload, run.status ?? 1);
      if (normalized.metrics.some((metric) => !validateMetric(metric))) {
        throw controlledError("Excel harness output is invalid.");
      }
      worksheets.push(normalized);
    } finally {
      rmSync(tempMappingPath, { force: true });
    }
  }

  const result = {
    runId,
    workbookContentHash,
    status: deriveOverallStatus(worksheets),
    worksheets,
    summary: createSummary(worksheets),
  };
  return f4ExcelComparisonResultSchema.parse(result);
}
