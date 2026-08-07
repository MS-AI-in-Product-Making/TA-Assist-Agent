import { readFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { calculationCompletedResultSchema } from "../packages/contracts/dist/contracts.js";

const SAFE_ERROR_MESSAGE = "F4 excel mapping failed.";
const TRUSTED_ERRORS = new WeakMap();
const MAX_WORKBOOK_BYTES = 50 * 1024 * 1024;
const TOLERANCE = 1e-12;

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
  contribution: ["% contribution to sigma", "percent contribution to sigma", "contribution to sigma"],
};

const SYSTEM_LABEL_ALIASES = {
  designNominal: ["design nominal"],
  additionalMeanShift: ["additional mean shift"],
  mean: ["adjusted mean"],
  worstCaseUpper: ["+ tolerance total", "positive tolerance total", "upper tolerance total", "plus tolerance total"],
  worstCaseLower: ["- tolerance total", "negative tolerance total", "lower tolerance total", "minus tolerance total"],
  rssSigma: ["rss total", "rss"],
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

function createCellEntries(worksheet) {
  const rangeText = typeof worksheet["!ref"] === "string" ? worksheet["!ref"] : undefined;
  if (!rangeText) return [];

  const range = XLSX.utils.decode_range(rangeText);
  const entries = [];

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const a1 = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = worksheet[a1];
      if (!cell) continue;

      const rawValue = cell.w ?? cell.v;
      const text = rawValue === undefined || rawValue === null ? "" : String(rawValue).trim();
      if (text.length === 0 && typeof cell.f !== "string") continue;

      entries.push({
        a1,
        row: row + 1,
        column: column + 1,
        normalized: normalizeText(text),
        text,
        formula: typeof cell.f === "string" && cell.f.trim().length > 0 ? cell.f.trim() : undefined,
      });
    }
  }

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
    if (source.workbookBytes.length > MAX_WORKBOOK_BYTES) throw mappingError("invalid_arguments");
    return source.workbookBytes;
  }

  const workbookPath = ensureSafeWorkbookPath(source.workbookPath);
  let bytes;
  try {
    bytes = readFileSync(workbookPath);
  } catch {
    throw mappingError("invalid_arguments");
  }
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > MAX_WORKBOOK_BYTES) {
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

function findAdjacentValue(entries, labelCell) {
  const sameRowToRight = entries
    .filter((entry) => entry.row === labelCell.row && entry.column > labelCell.column && entry.text.length > 0)
    .filter((entry) => !RESERVED_LABELS.has(entry.normalized))
    .sort((left, right) => left.column - right.column);
  if (sameRowToRight.length > 0) return sameRowToRight[0];

  const belowSameColumn = entries
    .filter((entry) => entry.column === labelCell.column && entry.row > labelCell.row && entry.text.length > 0)
    .filter((entry) => !RESERVED_LABELS.has(entry.normalized))
    .sort((left, right) => left.row - right.row);
  if (belowSameColumn.length > 0) return belowSameColumn[0];

  throw mappingError("mapping_error");
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

    const factorCells = [];
    for (const sourceRow of factorRows) {
      for (const field of Object.keys(FACTOR_HEADER_ALIASES)) {
        const a1 = toA1(sourceRow, headerColumns[field]);
        const cell = entries.find((entry) => entry.a1 === a1);
        if (!cell) {
          valid = false;
          break;
        }
        requireFormula(`factors[0].${field}`, cell);
        factorCells.push(cell);
      }
      if (!valid) break;
    }
    if (!valid) continue;

    candidates.push({ headerRow: row, headerColumns, factorCells });
  }

  if (candidates.length !== 1) throw mappingError("mapping_error");
  return candidates[0];
}

function formulaIdForMetric(calculation, metricName) {
  if (metricName in NON_TRACE_FORMULA_IDS) return NON_TRACE_FORMULA_IDS[metricName];
  const traceRecord = calculation.traceRecords.find((record) => record.outputField === metricName);
  if (!traceRecord) throw mappingError("formula_evidence_missing");
  return traceRecord.formulaId;
}

function createOutput(name, cell, expected, formulaId) {
  const parsedCell = parseCellReference(cell);
  if (!parsedCell) throw mappingError("mapping_error");
  if (typeof expected !== "number" || !Number.isFinite(expected)) throw mappingError("mapping_error");

  return {
    name,
    cell,
    expected,
    tolerance: TOLERANCE,
    formulaId,
  };
}

function buildSystemAndCapabilityLookup(entries, anchorRow, sectionEndRow) {
  const windowStart = Math.max(1, anchorRow - 20);
  const beforeSuggestedWindow = (entry) => entry.row >= windowStart && entry.row < sectionEndRow;
  const responseSummarySection = (entry) => entry.row > anchorRow && entry.row < sectionEndRow;

  const metricCells = new Map();

  for (const [field, aliases] of Object.entries(SYSTEM_LABEL_ALIASES)) {
    const labelCell = findUniqueLabel(entries, aliases, beforeSuggestedWindow);
    const valueCell = findAdjacentValue(entries, labelCell);
    metricCells.set(`system.${field}`, valueCell);
  }

  for (const [field, aliases] of Object.entries(CAPABILITY_LABEL_ALIASES)) {
    const labelCell = findUniqueLabel(entries, aliases, responseSummarySection);
    const valueCell = findAdjacentValue(entries, labelCell);
    metricCells.set(`capability.${field}`, valueCell);
  }

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

    const outputs = [];

    for (const [index, factor] of calculation.factors.entries()) {
      for (const field of ["mean", "halfTolerance", "sigma", "contribution"]) {
        const metricName = `factors[${index}].${field}`;
        const column = cluster.headerColumns[field];
        const sourceRow = factor.source.sourceRow;
        const cellAddress = toA1(sourceRow, column);
        const entry = entries.find((item) => item.a1 === cellAddress);
        if (!entry) throw mappingError("mapping_error");
        requireFormula(metricName, entry);

        const requiredFormulaId = FACTOR_FORMULA_IDS[field];
        if (!factor.trace.formulaIds.includes(requiredFormulaId)) throw mappingError("formula_evidence_missing");

        outputs.push(createOutput(metricName, cellAddress, factor[field], requiredFormulaId));
      }
    }

    const metricCells = buildSystemAndCapabilityLookup(entries, anchor.row, sectionEndRow);

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
    ];

    for (const metricName of scalarMetrics) {
      const entry = metricCells.get(metricName);
      if (!entry || entry.row >= sectionEndRow) throw mappingError("mapping_error");
      requireFormula(metricName, entry);

      const [scope, field] = metricName.split(".");
      const scopeValue = calculation[scope];
      const value = scopeValue?.[field];
      const formulaId = formulaIdForMetric(calculation, metricName);
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
