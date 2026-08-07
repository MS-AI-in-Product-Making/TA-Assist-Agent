import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { calculationCompletedResultSchema } from "../packages/contracts/dist/contracts.js";
import { MAX_ARCHIVE_BYTES, readSafeZip } from "../packages/workbook-catalog/dist/zip-security.js";

const SAFE_ERROR_MESSAGE = "F4 excel mapping failed.";
const TRUSTED_ERRORS = new WeakMap();
const TOLERANCE = 1e-12;
const MAX_SPARSE_WORKSHEET_CELLS = 10_000;
const MAX_REF_ROWS = 5_000;
const MAX_REF_COLUMNS = 1_024;
const MAX_REF_AREA = 2_000_000;

const SAFE_WORKBOOK_FILE_NAME_PATTERN = new RegExp(
  `^[^/\\${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]+\\.xlsx$`,
  "i",
);
const CONTROL_CHAR_PATTERN = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`,
);
const CELL_REFERENCE = /^([A-Z]+)([1-9]\d*)$/;

const FACTOR_HEADER_ALIASES = {
  mean: ["mean"],
  halfTolerance: ["tolerance", "half tolerance"],
  sigma: ["one sigma", "1 sigma"],
  contribution: ["% contribution to sigma", "percent contribution to sigma", "contribution to sigma", "percent cont to sigma"],
};

const SYSTEM_LABEL_ALIASES = {
  designNominal: ["design nominal"],
  additionalMeanShift: ["additional mean shift"],
  mean: ["adjusted mean"],
};

const CAPABILITY_LABEL_ALIASES = {
  lowerZ: ["lower z sigma level", "lower z"],
  upperZ: ["upper z sigma level", "upper z"],
  lowerDpm: ["dpm lower", "lower dpm"],
  upperDpm: ["dpm upper", "upper dpm"],
  totalDpm: ["total dpm", "dpm total"],
  outOfSpecRatio: ["% out of spec", "percent out of spec"],
  cp: ["cp"],
  yield: ["yield"],
  lowerCpk: ["lower cpk"],
  upperCpk: ["upper cpk"],
  cpk: ["cpk"],
};

const FACTOR_FORMULA_IDS = {
  mean: "factor-mean-v1",
  halfTolerance: "factor-half-tolerance-v1",
  sigma: "factor-sigma-v1",
  contribution: "contribution-v1",
};

const FIXED_TRACE_FORMULA_IDS = {
  "system.mean": "system-mean-v1",
  "system.worstCaseUpper": "worst-case-v1",
  "system.worstCaseLower": "worst-case-v1",
  "system.rssSigma": "rss-v1",
  "capability.cp": "cp-v1",
  "capability.lowerCpk": "cpk-lower-v1",
  "capability.upperCpk": "cpk-upper-v1",
  "capability.cpk": "cpk-v1",
  "capability.lowerZ": "z-lower-v1",
  "capability.upperZ": "z-upper-v1",
  "capability.lowerDpm": "dpm-lower-v1",
  "capability.upperDpm": "dpm-upper-v1",
  "capability.totalDpm": "dpm-total-v1",
  "capability.outOfSpecRatio": "dpm-total-v1",
  "capability.yield": "yield-v1",
  "capability.status": "status-v1",
};

const NON_TRACE_FORMULA_IDS = {
  "system.designNominal": "input-design-nominal-v1",
  "system.additionalMeanShift": "input-additional-mean-shift-v1",
};

const REQUIRED_FORMULA_EXCEPTIONS = new Set(["system.additionalMeanShift"]);
const RESERVED_LABELS = new Set([
  "response summary table",
  "suggested spec",
  "status",
  ...Object.values(FACTOR_HEADER_ALIASES).flat().map((value) => normalizeText(value)),
  ...Object.values(SYSTEM_LABEL_ALIASES).flat().map((value) => normalizeText(value)),
  ...Object.values(CAPABILITY_LABEL_ALIASES).flat().map((value) => normalizeText(value)),
]);

function mappingError(code) {
  const error = new Error(SAFE_ERROR_MESSAGE);
  error.code = code;
  TRUSTED_ERRORS.set(error, code);
  return error;
}

function errorCode(error) {
  if (typeof error !== "object" || error === null) return undefined;
  return TRUSTED_ERRORS.get(error);
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value) {
  return String(value)
    .replace(/[%]/g, " percent ")
    .replace(/[σΣ]/g, " sigma ")
    .replace(/[^a-zA-Z0-9+\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseCellReference(reference) {
  const match = CELL_REFERENCE.exec(reference);
  if (!match) return undefined;

  let column = 0;
  for (const character of match[1]) {
    column = column * 26 + (character.charCodeAt(0) - 64);
  }

  return { row: Number(match[2]), column };
}

function toA1(row, column) {
  return XLSX.utils.encode_cell({ r: row - 1, c: column - 1 });
}

function decodeAndValidateRefRange(worksheet) {
  const rangeText = typeof worksheet["!ref"] === "string" ? worksheet["!ref"] : undefined;
  if (!rangeText) throw mappingError("mapping_error");

  let range;
  try {
    range = XLSX.utils.decode_range(rangeText);
  } catch {
    throw mappingError("mapping_error");
  }

  const rowCount = range.e.r - range.s.r + 1;
  const columnCount = range.e.c - range.s.c + 1;
  const area = rowCount * columnCount;

  if (
    !Number.isInteger(rowCount)
    || !Number.isInteger(columnCount)
    || rowCount <= 0
    || columnCount <= 0
    || rowCount > MAX_REF_ROWS
    || columnCount > MAX_REF_COLUMNS
    || area > MAX_REF_AREA
  ) {
    throw mappingError("mapping_error");
  }

  return range;
}

function createCellEntries(worksheet) {
  const range = decodeAndValidateRefRange(worksheet);

  const keys = Object.keys(worksheet).filter((key) => CELL_REFERENCE.test(key));
  if (keys.length > MAX_SPARSE_WORKSHEET_CELLS) throw mappingError("mapping_error");

  const entries = [];

  for (const a1 of keys) {
    const parsed = parseCellReference(a1);
    if (!parsed) continue;
    const { row, column } = parsed;

    if (
      row < range.s.r + 1
      || row > range.e.r + 1
      || column < range.s.c + 1
      || column > range.e.c + 1
    ) {
      continue;
    }

    const cell = worksheet[a1];
    if (!cell) continue;

    const rawValue = cell.v;
    const displayValue = cell.w ?? rawValue;
    const text = displayValue === undefined || displayValue === null ? "" : String(displayValue).trim();
    const formula = typeof cell.f === "string" && cell.f.trim().length > 0 ? cell.f.trim() : undefined;
    if (text.length === 0 && !formula) continue;

    entries.push({
      a1,
      row,
      column,
      normalized: normalizeText(text),
      text,
      rawValue,
      type: cell.t,
      formula,
    });
  }

  entries.sort((left, right) => (left.row - right.row) || (left.column - right.column));
  return entries;
}

function ensureSafeWorkbookPath(workbookPath) {
  if (typeof workbookPath !== "string") throw mappingError("invalid_arguments");
  if (workbookPath.length === 0 || workbookPath.length > 1024 || CONTROL_CHAR_PATTERN.test(workbookPath)) {
    throw mappingError("invalid_arguments");
  }

  const trimmed = workbookPath.trim();
  if (trimmed.length === 0 || trimmed.includes("..")) throw mappingError("invalid_arguments");

  const fileName = path.basename(trimmed);
  if (!SAFE_WORKBOOK_FILE_NAME_PATTERN.test(fileName)) throw mappingError("invalid_arguments");
  return trimmed;
}

function loadWorkbookBytes(source) {
  if (!isPlainObject(source)) throw mappingError("invalid_arguments");

  const hasPath = source.workbookPath !== undefined;
  const hasBytes = source.workbookBytes !== undefined;
  if ((hasPath && hasBytes) || (!hasPath && !hasBytes)) throw mappingError("invalid_arguments");

  if (hasBytes) {
    if (!(source.workbookBytes instanceof Uint8Array) || source.workbookBytes.length === 0) {
      throw mappingError("invalid_arguments");
    }
    if (source.workbookBytes.length > MAX_ARCHIVE_BYTES) throw mappingError("invalid_arguments");
    return source.workbookBytes;
  }

  const workbookPath = ensureSafeWorkbookPath(source.workbookPath);

  let stats;
  try {
    stats = statSync(workbookPath);
  } catch {
    throw mappingError("invalid_arguments");
  }
  if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_ARCHIVE_BYTES) {
    throw mappingError("invalid_arguments");
  }

  let bytes;
  try {
    bytes = readFileSync(workbookPath);
  } catch {
    throw mappingError("invalid_arguments");
  }
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > MAX_ARCHIVE_BYTES) {
    throw mappingError("invalid_arguments");
  }
  return bytes;
}

function findUniqueAnchor(entries, alias) {
  const matches = entries.filter((entry) => entry.normalized === alias);
  if (matches.length !== 1) throw mappingError("mapping_error");
  return matches[0];
}

function findSectionEndRow(entries, anchorRow) {
  const candidates = entries
    .filter((entry) => entry.row > anchorRow && entry.normalized === "suggested spec")
    .map((entry) => entry.row);
  if (candidates.length === 0) throw mappingError("mapping_error");
  return Math.min(...candidates);
}

function findUniqueLabel(entries, aliases, rowFilter) {
  const normalizedAliases = new Set(aliases.map((item) => normalizeText(item)));
  const matches = entries.filter((entry) => rowFilter(entry) && normalizedAliases.has(entry.normalized));
  if (matches.length !== 1) throw mappingError("mapping_error");
  return matches[0];
}

function findOneCell(entries, row, column) {
  const matches = entries.filter((entry) => entry.row === row && entry.column === column);
  if (matches.length !== 1) return undefined;
  return matches[0];
}

function ensureScalarValueCell(cellEntry, { allowString = false } = {}) {
  if (!cellEntry || cellEntry.text.length === 0) throw mappingError("mapping_error");
  if (RESERVED_LABELS.has(cellEntry.normalized)) throw mappingError("mapping_error");

  const isNumericValue = cellEntry.type === "n"
    && typeof cellEntry.rawValue === "number"
    && Number.isFinite(cellEntry.rawValue);
  if (!isNumericValue && !allowString) throw mappingError("mapping_error");
  if (allowString && !isNumericValue) {
    const normalized = normalizeText(cellEntry.rawValue);
    if (normalized !== "pass" && normalized !== "fail") throw mappingError("mapping_error");
  }
}

function isScalarCandidate(cellEntry, options) {
  try {
    ensureScalarValueCell(cellEntry, options);
    return true;
  } catch {
    return false;
  }
}

function findExactAdjacentValue(entries, labelCell, { allowBelow = false, allowString = false } = {}) {
  const rightRaw = findOneCell(entries, labelCell.row, labelCell.column + 1);
  const belowRaw = allowBelow ? findOneCell(entries, labelCell.row + 1, labelCell.column) : undefined;

  const right = rightRaw && isScalarCandidate(rightRaw, { allowString }) ? rightRaw : undefined;
  const below = belowRaw && isScalarCandidate(belowRaw, { allowString }) ? belowRaw : undefined;

  if (right && below) throw mappingError("mapping_error");
  const candidate = right ?? below;
  if (!candidate) throw mappingError("mapping_error");

  return candidate;
}

function findUniqueLabelWithAdjacentValue(entries, aliases, rowFilter) {
  const normalizedAliases = new Set(aliases.map((item) => normalizeText(item)));
  const candidates = [];
  for (const label of entries.filter((entry) => rowFilter(entry) && normalizedAliases.has(entry.normalized))) {
    try {
      candidates.push({ label, value: findExactAdjacentValue(entries, label) });
    } catch {
      // Labels used as table headers are not metric labels unless they bind an adjacent scalar.
    }
  }
  if (candidates.length !== 1) throw mappingError("mapping_error");
  return candidates[0];
}

function requireFormula(metricName, cellEntry) {
  if (REQUIRED_FORMULA_EXCEPTIONS.has(metricName)) return;
  if (typeof cellEntry.formula !== "string" || cellEntry.formula.length === 0) {
    throw mappingError("formula_evidence_missing");
  }
}

function findFactorHeaderCluster(entries, factorRows) {
  const byRow = new Map();
  for (const entry of entries) {
    if (!byRow.has(entry.row)) byRow.set(entry.row, []);
    byRow.get(entry.row).push(entry);
  }

  const candidates = [];
  for (const [row, rowEntries] of byRow.entries()) {
    const headerColumns = {};
    let valid = true;
    for (const [field, aliases] of Object.entries(FACTOR_HEADER_ALIASES)) {
      const aliasSet = new Set(aliases.map((item) => normalizeText(item)));
      const matches = rowEntries.filter((entry) => aliasSet.has(entry.normalized));
      if (matches.length !== 1) {
        valid = false;
        break;
      }
      headerColumns[field] = matches[0].column;
    }
    if (!valid) continue;

    for (const sourceRow of factorRows) {
      for (const field of Object.keys(FACTOR_HEADER_ALIASES)) {
        const a1 = toA1(sourceRow, headerColumns[field]);
        const cell = entries.find((entry) => entry.a1 === a1);
        if (!cell) {
          valid = false;
          break;
        }
        ensureScalarValueCell(cell);
        requireFormula(`factors[0].${field}`, cell);
      }
      if (!valid) break;
    }
    if (!valid) continue;

    candidates.push({ headerRow: row, headerColumns });
  }

  if (candidates.length !== 1) throw mappingError("mapping_error");
  return candidates[0];
}

function validateFactorTraceFormulaIds(factor) {
  const ids = Array.isArray(factor?.trace?.formulaIds) ? factor.trace.formulaIds : [];
  if (ids.length !== Object.keys(FACTOR_FORMULA_IDS).length) throw mappingError("formula_evidence_missing");

  const counts = new Map();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const required of Object.values(FACTOR_FORMULA_IDS)) {
    if (counts.get(required) !== 1) throw mappingError("formula_evidence_missing");
  }
}

function validateTraceRecords(calculation) {
  const recordsByOutputField = new Map();
  for (const record of calculation.traceRecords) {
    const list = recordsByOutputField.get(record.outputField);
    if (!list) recordsByOutputField.set(record.outputField, [record]);
    else list.push(record);
  }

  for (const [outputField, formulaId] of Object.entries(FIXED_TRACE_FORMULA_IDS)) {
    const records = recordsByOutputField.get(outputField);
    if (!records || records.length !== 1 || records[0].formulaId !== formulaId) {
      throw mappingError("formula_evidence_missing");
    }
  }
}

function formulaIdForMetric(metricName) {
  if (metricName in NON_TRACE_FORMULA_IDS) return NON_TRACE_FORMULA_IDS[metricName];
  const fixed = FIXED_TRACE_FORMULA_IDS[metricName];
  if (!fixed) throw mappingError("formula_evidence_missing");
  return fixed;
}

function createOutput(name, cell, expected, formulaId) {
  const parsedCell = parseCellReference(cell);
  if (!parsedCell) throw mappingError("mapping_error");

  if (typeof expected !== "number" || !Number.isFinite(expected)) {
    if (typeof expected !== "string" || expected.trim().length === 0 || expected.length > 1024) {
      throw mappingError("mapping_error");
    }
  }

  return {
    name,
    cell,
    expected,
    tolerance: TOLERANCE,
    formulaId,
  };
}

function buildMetricCells(entries, anchorRow, sectionEndRow, sigmaColumn) {
  const beforeAnchorSection = (entry) => entry.row < anchorRow;
  const responseSummarySection = (entry) => entry.row > anchorRow && entry.row < sectionEndRow;

  const metricCells = new Map();

  const { value: designValue } = findUniqueLabelWithAdjacentValue(
    entries,
    SYSTEM_LABEL_ALIASES.designNominal,
    beforeAnchorSection,
  );
  metricCells.set("system.designNominal", designValue);

  const summaryRow = designValue.row;
  const upperCell = findOneCell(entries, summaryRow, designValue.column + 1);
  const lowerCell = findOneCell(entries, summaryRow, designValue.column + 2);
  if (!upperCell || !lowerCell) throw mappingError("mapping_error");
  ensureScalarValueCell(upperCell);
  ensureScalarValueCell(lowerCell);
  metricCells.set("system.worstCaseUpper", upperCell);
  metricCells.set("system.worstCaseLower", lowerCell);

  const rssCell = findOneCell(entries, summaryRow, sigmaColumn);
  if (!rssCell) throw mappingError("mapping_error");
  ensureScalarValueCell(rssCell);
  metricCells.set("system.rssSigma", rssCell);

  const shiftLabel = findUniqueLabel(entries, SYSTEM_LABEL_ALIASES.additionalMeanShift, beforeAnchorSection);
  const shiftValue = findExactAdjacentValue(entries, shiftLabel);
  metricCells.set("system.additionalMeanShift", shiftValue);

  const meanLabel = findUniqueLabel(entries, SYSTEM_LABEL_ALIASES.mean, beforeAnchorSection);
  const meanValue = findExactAdjacentValue(entries, meanLabel);
  metricCells.set("system.mean", meanValue);

  for (const [field, aliases] of Object.entries(CAPABILITY_LABEL_ALIASES)) {
    const labelCell = findUniqueLabel(entries, aliases, responseSummarySection);
    const valueCell = findExactAdjacentValue(entries, labelCell, { allowBelow: true });
    metricCells.set(`capability.${field}`, valueCell);
  }

  const cpkCell = metricCells.get("capability.cpk");
  if (!cpkCell) throw mappingError("mapping_error");
  const statusCell = findOneCell(entries, cpkCell.row, cpkCell.column + 1);
  if (!statusCell) throw mappingError("mapping_error");
  ensureScalarValueCell(statusCell, { allowString: true });
  metricCells.set("capability.status", statusCell);

  return metricCells;
}

function ensureNoDuplicateOutputs(outputs) {
  const names = new Set();
  const cells = new Set();
  for (const output of outputs) {
    if (names.has(output.name) || cells.has(output.cell)) throw mappingError("mapping_error");
    names.add(output.name);
    cells.add(output.cell);
  }
}

export function buildF4ExcelMapping(request) {
  try {
    if (!isPlainObject(request)) throw mappingError("invalid_arguments");

    const allowedKeys = new Set(["workbookPath", "workbookBytes", "calculation"]);
    for (const key of Object.keys(request)) {
      if (!allowedKeys.has(key)) throw mappingError("invalid_arguments");
    }

    const calculationParsed = calculationCompletedResultSchema.safeParse(request.calculation);
    if (!calculationParsed.success) throw mappingError("invalid_arguments");
    const calculation = calculationParsed.data;

    const workbookBytes = loadWorkbookBytes(request);

    try {
      readSafeZip(workbookBytes);
    } catch {
      throw mappingError("invalid_arguments");
    }

    let workbook;
    try {
      workbook = XLSX.read(workbookBytes, { type: "buffer", cellFormula: true, cellText: true, dense: false });
    } catch {
      throw mappingError("invalid_arguments");
    }

    const worksheetName = calculation.worksheetSelection.worksheetName;
    const worksheet = workbook.Sheets[worksheetName];
    if (!worksheet) throw mappingError("mapping_error");

    const entries = createCellEntries(worksheet);
    const anchor = findUniqueAnchor(entries, "response summary table");
    const sectionEndRow = findSectionEndRow(entries, anchor.row);

    const factorRows = calculation.factors.map((factor) => factor.source.sourceRow);
    if (new Set(factorRows).size !== factorRows.length) throw mappingError("mapping_error");

    const cluster = findFactorHeaderCluster(entries, factorRows);

    validateTraceRecords(calculation);
    for (const factor of calculation.factors) validateFactorTraceFormulaIds(factor);

    const outputs = [];

    for (const [index, factor] of calculation.factors.entries()) {
      for (const field of ["mean", "halfTolerance", "sigma", "contribution"]) {
        const metricName = `factors[${index}].${field}`;
        const column = cluster.headerColumns[field];
        const sourceRow = factor.source.sourceRow;
        const cellAddress = toA1(sourceRow, column);
        const entry = entries.find((item) => item.a1 === cellAddress);
        if (!entry) throw mappingError("mapping_error");
        ensureScalarValueCell(entry);
        requireFormula(metricName, entry);

        outputs.push(createOutput(metricName, cellAddress, factor[field], FACTOR_FORMULA_IDS[field]));
      }
    }

    const metricCells = buildMetricCells(entries, anchor.row, sectionEndRow, cluster.headerColumns.sigma);

    const scalarMetrics = [
      "system.designNominal",
      "system.additionalMeanShift",
      "system.mean",
      "system.worstCaseUpper",
      "system.worstCaseLower",
      "system.rssSigma",
      "capability.lowerZ",
      "capability.upperZ",
      "capability.lowerDpm",
      "capability.upperDpm",
      "capability.totalDpm",
      "capability.outOfSpecRatio",
      "capability.cp",
      "capability.yield",
      "capability.lowerCpk",
      "capability.upperCpk",
      "capability.cpk",
      "capability.status",
    ];

    for (const metricName of scalarMetrics) {
      const entry = metricCells.get(metricName);
      if (!entry || entry.row >= sectionEndRow) throw mappingError("mapping_error");
      requireFormula(metricName, entry);

      const [scope, field] = metricName.split(".");
      const scopeValue = calculation[scope];
      const value = scopeValue?.[field];
      const formulaId = formulaIdForMetric(metricName);
      outputs.push(createOutput(metricName, entry.a1, value, formulaId));
    }

    ensureNoDuplicateOutputs(outputs);

    return {
      version: "excel-ta-v1",
      inputs: [],
      outputs,
    };
  } catch (error) {
    const trusted = errorCode(error);
    if (typeof trusted === "string") throw mappingError(trusted);
    throw mappingError("mapping_error");
  }
}
