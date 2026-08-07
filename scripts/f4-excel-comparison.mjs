import { spawnSync as nodeSpawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  f4ExcelComparisonResultSchema,
  f4WorkflowCalculationResultSchema,
} from "../packages/contracts/dist/contracts.js";

const MAPPING_VERSION = "excel-ta-v1";
const DEFAULT_TOLERANCE = 1e-12;
const HARNESS_ENV_PREFIX = "F4_EXCEL_REGRESSION_";
const HARNESS_METRIC_KEYS = new Set([
  "name", "cell", "expected", "actual", "displayText", "absoluteDifference", "relativeDifference", "tolerance", "formula", "formulaId", "pass",
]);
const FACTOR_FORMULA_IDS = {
  mean: "factor-mean-v1",
  halfTolerance: "factor-half-tolerance-v1",
  sigma: "factor-sigma-v1",
  contribution: "contribution-v1",
};
const NON_TRACE_FORMULA_IDS = {
  "system.designNominal": "input-design-nominal-v1",
  "system.additionalMeanShift": "input-additional-mean-shift-v1",
};

function controlledError(message) {
  const error = new Error(message);
  error.name = "F4ExcelComparisonError";
  return error;
}

function sha256(filePath) {
  let content;
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) throw new Error("not-file");
    content = readFileSync(filePath);
  } catch {
    throw controlledError("Workbook is unavailable.");
  }
  return createHash("sha256").update(content).digest("hex");
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isControlledString(value, max = 1024, allowEmpty = false) {
  return typeof value === "string"
    && value.length <= max
    && (allowEmpty || value.trim().length > 0)
    && !/[\0\r\n]/u.test(value);
}

function hasExactKeys(value, allowedKeys) {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function parseHarnessJson(stdout) {
  const lines = String(stdout ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) throw controlledError("Excel harness output is invalid.");
  try {
    const value = JSON.parse(lines.at(-1));
    if (!isPlainObject(value)) throw new Error("not-object");
    return value;
  } catch {
    throw controlledError("Excel harness output is invalid.");
  }
}

function nearEqual(left, right) {
  const delta = Math.abs(left - right);
  return delta <= Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * 8;
}

function normalizeMappingsInput(mappings) {
  if (Array.isArray(mappings)) {
    const entries = mappings.map((entry) => [entry?.worksheetName, entry?.mapping]);
    if (entries.some(([name]) => !isControlledString(name, 128))) throw controlledError("Mappings are malformed.");
    if (new Set(entries.map(([name]) => name)).size !== entries.length) throw controlledError("Mappings are malformed.");
    return new Map(entries);
  }
  if (isPlainObject(mappings)) return new Map(Object.entries(mappings));
  throw controlledError("Mappings are malformed.");
}

function parseExcelCell(cell) {
  const match = /^([A-Z]{1,3})([1-9]\d{0,6})$/u.exec(cell ?? "");
  if (!match) return undefined;
  let column = 0;
  for (const character of match[1]) column = (column * 26) + character.charCodeAt(0) - 64;
  const row = Number(match[2]);
  return column <= 16_384 && row <= 1_048_576 ? { column, row } : undefined;
}

function validateMapping(mapping) {
  if (!isPlainObject(mapping) || !hasExactKeys(mapping, new Set(["version", "inputs", "outputs"]))) return false;
  if (mapping.version !== MAPPING_VERSION || !Array.isArray(mapping.inputs) || !Array.isArray(mapping.outputs) || mapping.outputs.length === 0) return false;
  if (mapping.inputs.length > 100 || mapping.outputs.length > 100) return false;

  const cells = new Set();
  for (const input of mapping.inputs) {
    if (!isPlainObject(input) || !hasExactKeys(input, new Set(["cell", "value"]))) return false;
    if (!parseExcelCell(input.cell) || cells.has(input.cell.toUpperCase())) return false;
    cells.add(input.cell.toUpperCase());
  }
  const names = new Set();
  for (const output of mapping.outputs) {
    if (!isPlainObject(output) || !hasExactKeys(output, new Set(["name", "cell", "expected", "tolerance", "formulaId"]))) return false;
    if (!isControlledString(output.name, 128) || !parseExcelCell(output.cell)) return false;
    const normalizedName = output.name.toLowerCase();
    const normalizedCell = output.cell.toUpperCase();
    if (names.has(normalizedName) || cells.has(normalizedCell)) return false;
    names.add(normalizedName);
    cells.add(normalizedCell);
    const isNumericExpected = isFiniteNumber(output.expected);
    const isSupportedTextExpected = output.name === "capability.status" && (output.expected === "PASS" || output.expected === "FAIL");
    if (!isControlledString(output.formulaId, 128) || (!isNumericExpected && !isSupportedTextExpected)) return false;
    if (output.tolerance !== undefined && (!isFiniteNumber(output.tolerance) || output.tolerance < 0 || output.tolerance > DEFAULT_TOLERANCE)) return false;
  }
  return true;
}

function resolveCalculationMetric(calculation, metric) {
  const factorMatch = /^factors\[(\d+)\]\.(mean|halfTolerance|sigma|contribution)$/u.exec(metric);
  if (factorMatch) return calculation.factors?.[Number(factorMatch[1])]?.[factorMatch[2]];
  if (/^(system|capability)\.[A-Za-z][A-Za-z0-9]*$/u.test(metric)) {
    const [section, field] = metric.split(".");
    return calculation[section]?.[field];
  }
  return undefined;
}

function mappingMatchesCalculation(mapping, calculation) {
  return mapping.outputs.every((output) => {
    const calculationValue = resolveCalculationMetric(calculation, output.name);
    return (isFiniteNumber(calculationValue) || isControlledString(calculationValue, 1024))
      && Object.is(calculationValue, output.expected);
  });
}

function numericComparisonMapping(mapping) {
  return {
    ...mapping,
    outputs: mapping.outputs.filter((output) => isFiniteNumber(output.expected)),
  };
}

function mappingFormulaEvidenceMatchesCalculation(mapping, calculation) {
  return mapping.outputs.every((output) => {
    const factorMatch = /^factors\[(\d+)\]\.(mean|halfTolerance|sigma|contribution)$/u.exec(output.name);
    if (factorMatch) {
      const factor = calculation.factors[Number(factorMatch[1])];
      return FACTOR_FORMULA_IDS[factorMatch[2]] === output.formulaId
        && factor?.trace?.formulaIds?.includes(output.formulaId);
    }

    if (NON_TRACE_FORMULA_IDS[output.name]) {
      return NON_TRACE_FORMULA_IDS[output.name] === output.formulaId;
    }

    const records = calculation.traceRecords.filter((record) => record.outputField === output.name);
    return records.length === 1 && records[0].formulaId === output.formulaId;
  });
}

function sanitizeEnvironment(environment) {
  return Object.fromEntries(Object.entries(environment).filter(([key]) => !key.toUpperCase().startsWith(HARNESS_ENV_PREFIX)));
}

function validateFormulaEvidence(formula) {
  if (!isControlledString(formula, 4096)) return false;
  return !/(?:[A-Za-z]:[\\/]|\\\\|\.\.[\\/]|(?:https?|file):\/\/|["'](?!(?:Note):)[A-Za-z][A-Za-z0-9+.-]*:|\[[^\]]+\][^!]*!|\b(?:WEBSERVICE|RTD)\s*\(|\|[^!]*!|(?:password|secret|token|api[_ -]?key)\s*[=:])/iu.test(formula);
}

function transformMetrics(worksheetName, mapping, payload) {
  if (!Array.isArray(payload.outputs) || payload.outputs.length !== mapping.outputs.length) {
    throw controlledError("Excel harness output is invalid.");
  }

  const seen = new Set();
  return mapping.outputs.map((output, index) => {
    const metric = payload.outputs[index];
    if (!isPlainObject(metric) || !hasExactKeys(metric, HARNESS_METRIC_KEYS)) throw controlledError("Excel harness output is invalid.");
    const identity = `${metric.name}::${metric.cell}`;
    if (seen.has(identity)) throw controlledError("Excel harness output is invalid.");
    seen.add(identity);

    const tolerance = output.tolerance ?? DEFAULT_TOLERANCE;
    if (metric.name !== output.name || metric.cell !== output.cell || metric.formulaId !== output.formulaId) {
      throw controlledError("Excel harness output is invalid.");
    }
    if (!Object.is(metric.expected, output.expected) || !Object.is(metric.tolerance, tolerance)) {
      throw controlledError("Excel harness output is invalid.");
    }
    if (!isFiniteNumber(metric.actual) || !isControlledString(metric.displayText, 1024) || !validateFormulaEvidence(metric.formula)) {
      throw controlledError("Excel harness output is invalid.");
    }

    const absoluteDifference = Math.abs(output.expected - metric.actual);
    const denominator = Math.max(1, Math.abs(output.expected), Math.abs(metric.actual));
    const relativeDifference = absoluteDifference / denominator;
    const passed = absoluteDifference <= tolerance * denominator;
    if (!isFiniteNumber(metric.absoluteDifference) || !isFiniteNumber(metric.relativeDifference)
      || !nearEqual(metric.absoluteDifference, absoluteDifference) || !nearEqual(metric.relativeDifference, relativeDifference)
      || metric.pass !== passed) {
      throw controlledError("Excel harness output is invalid.");
    }

    return {
      metric: output.name,
      f4Value: output.expected,
      excelValue: metric.actual,
      excelDisplayText: metric.displayText,
      absoluteDifference,
      relativeDifference,
      tolerance,
      passed,
      sourceCell: `${worksheetName}!${output.cell}`,
      excelFormula: metric.formula,
      f4FormulaId: output.formulaId,
    };
  });
}

function validateHarnessOutcome(payload, exitStatus, workbookContentHash, worksheetName, mapping) {
  const status = payload.status;
  if (!Number.isInteger(exitStatus)) throw controlledError("Excel harness output is invalid.");
  if (status === "hash_mismatch") throw controlledError("Workbook hash mismatch.");

  if (status === "invalid_mapping") {
    if (exitStatus === 0) throw controlledError("Excel harness output is invalid.");
    return { type: "mapping_error", reasonCode: "metric_mapping_missing" };
  }
  if (status === "source_modified") throw controlledError("Workbook hash mismatch.");
  if (status === "excel_error") {
    if (exitStatus === 0) throw controlledError("Excel harness output is invalid.");
    return { type: "excel_unavailable", reasonCode: "excel_execution_failed" };
  }
  if (status !== "regression_passed" && status !== "regression_mismatch") {
    throw controlledError("Excel harness output is invalid.");
  }
  if ((status === "regression_passed") !== (exitStatus === 0)) throw controlledError("Excel harness output is invalid.");
  if (String(payload.sourceSha256 ?? "").toLowerCase() !== workbookContentHash) throw controlledError("Workbook hash mismatch.");
  if (!hasExactKeys(payload, new Set(["status", "sourceSha256", "outputs"]))) throw controlledError("Excel harness output is invalid.");

  const metrics = transformMetrics(worksheetName, mapping, payload);
  const hasMismatch = metrics.some((metric) => !metric.passed);
  if ((status === "regression_mismatch") !== hasMismatch) throw controlledError("Excel harness output is invalid.");
  return { type: status === "regression_passed" ? "passed" : "mismatch", metrics };
}

function parseFormalResult(result) {
  const parsed = f4ExcelComparisonResultSchema.safeParse(result);
  if (!parsed.success) throw controlledError("F4 Excel comparison payload is invalid.");
  return parsed.data;
}

function baseResult(runId, generatedAt) {
  return {
    contractVersion: "v1",
    comparisonVersion: "f4-excel-comparison-v1",
    outputClassification: "confidential",
    featureId: "F4",
    runId,
    generatedAt,
  };
}

function terminalResult(base, status, reasonCode) {
  return parseFormalResult({ ...base, status, reasonCode });
}

export function compareF4WithExcel({ workbookPath, calculationResult, mappings }, deps = {}) {
  const spawnSync = deps.spawnSync ?? nodeSpawnSync;
  const now = deps.now ?? (() => new Date());
  const scriptPath = deps.scriptPath ?? path.resolve(import.meta.dirname, "verify-f4-excel-regression.ps1");
  const workingDirectory = deps.workingDirectory ?? path.resolve(import.meta.dirname, "..");

  if (!isControlledString(workbookPath, 1024)) throw controlledError("Workbook path is required.");
  const parsedCalculation = f4WorkflowCalculationResultSchema.safeParse(calculationResult);
  if (!parsedCalculation.success) {
    throw controlledError("Calculation result is invalid.");
  }
  const approvedCalculation = parsedCalculation.data;
  const workbookContentHash = approvedCalculation.source.workbookContentHash;
  const runId = approvedCalculation.runId;
  const base = baseResult(runId, now().toISOString());

  if (sha256(workbookPath) !== workbookContentHash) throw controlledError("Workbook hash mismatch.");
  const mappingLookup = normalizeMappingsInput(mappings);
  const approved = [];
  for (const calculation of approvedCalculation.calculations) {
    const worksheetName = calculation?.worksheetSelection?.worksheetName;
    if (!isControlledString(worksheetName, 128)) throw controlledError("Calculation worksheet is invalid.");
    const mapping = mappingLookup.get(worksheetName);
    if (!validateMapping(mapping)) return terminalResult(base, "mapping_error", "worksheet_mapping_missing");
    if (!mappingMatchesCalculation(mapping, calculation)) return terminalResult(base, "mapping_error", "metric_mapping_missing");
    if (!mappingFormulaEvidenceMatchesCalculation(mapping, calculation)) {
      return terminalResult(base, "mapping_error", "formula_evidence_missing");
    }
    const comparisonMapping = numericComparisonMapping(mapping);
    if (comparisonMapping.outputs.length === 0) return terminalResult(base, "mapping_error", "metric_mapping_missing");
    approved.push({ worksheetName, mapping: comparisonMapping });
  }

  const worksheets = [];
  for (const { worksheetName, mapping } of approved) {
    const tempMappingPath = path.join(tmpdir(), `f4-excel-comparison-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
    try {
      writeFileSync(tempMappingPath, JSON.stringify(mapping), "utf8");
      const run = spawnSync("pwsh", [
        "-NoProfile", "-File", scriptPath,
        "-WorkbookPath", workbookPath,
        "-ExpectedSha256", workbookContentHash,
        "-WorksheetName", worksheetName,
        "-MappingPath", tempMappingPath,
      ], {
        cwd: workingDirectory,
        encoding: "utf8",
        env: sanitizeEnvironment(process.env),
        timeout: 300_000,
      });
      if (run.error || run.status === null || run.signal) {
        return terminalResult(base, "excel_unavailable", "excel_runtime_unavailable");
      }
      const outcome = validateHarnessOutcome(parseHarnessJson(run.stdout), run.status, workbookContentHash, worksheetName, mapping);
      if (outcome.type === "mapping_error" || outcome.type === "excel_unavailable") {
        return terminalResult(base, outcome.type, outcome.reasonCode);
      }
      worksheets.push({ worksheetName, metrics: outcome.metrics });
    } finally {
      rmSync(tempMappingPath, { force: true });
    }
  }

  const metrics = worksheets.flatMap((worksheet) => worksheet.metrics);
  const mismatchMetricCount = metrics.filter((metric) => !metric.passed).length;
  return parseFormalResult({
    ...base,
    status: mismatchMetricCount === 0 ? "passed" : "mismatch",
    source: { workbookContentHash },
    worksheets,
    summary: {
      worksheetCount: worksheets.length,
      metricCount: metrics.length,
      passedMetricCount: metrics.length - mismatchMetricCount,
      mismatchMetricCount,
    },
  });
}
