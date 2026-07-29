import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import XLSX from "xlsx";
import {
  createWorkbookCatalog,
} from "../packages/workbook-catalog/dist/workbook-catalog.js";
import {
  createWorksheetSelectionView,
} from "../packages/workbook-catalog/dist/worksheet-selection.js";
import {
  createWorksheetAnalysisAssetsParallel,
  readWorksheetImageAsset,
} from "../packages/workbook-catalog/dist/worksheet-analysis-assets.js";

const configuredJobs = [
  {
    workbookPath: "test/Maera_gap_TP_brkt_and _battery_20260305V1.xlsx",
  },
  {
    workbookPath: "test/Maera_cosmetic_critical_TA - Rev E.xlsx",
    selectedManifestPath: "test/demo-output/maera-selected-worksheets-factor-tables.full.json",
  },
  {
    workbookPath: "test/Meara TP TA_20241030-v0.xlsx",
    selectedManifestPath: "test/demo-output/meara-selected-worksheets-factor-tables.full.json",
  },
];

const outRoot = "test/demo-output/feature1-validation";
const outSheetsRoot = path.join(outRoot, "sheets");
mkdirSync(outRoot, { recursive: true });
mkdirSync(outSheetsRoot, { recursive: true });
const composedMode = (process.env.F1_COMPOSED_MODE ?? "auto").toLowerCase();

function safeName(value) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
}

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function mdEscape(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>");
}

function mdLinkText(text, href) {
  const safeText = String(text ?? "").replace(/\]/g, "\\]");
  return `[${safeText}](${href})`;
}

function fileContentUtf8(file) {
  if (!file?.content) return "";
  if (typeof file.content === "string") return file.content;
  return Buffer.from(file.content).toString("utf8");
}

function parseRelationships(xml) {
  const rows = [];
  for (const tagMatch of xml.matchAll(/<Relationship\b[^>]*>/gi)) {
    const tag = tagMatch[0];
    const attrs = {};
    for (const attrMatch of tag.matchAll(/([A-Za-z_:][A-Za-z0-9_:.\-]*)="([^"]*)"/g)) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
    rows.push({
      id: attrs.Id,
      target: attrs.Target,
      type: attrs.Type,
    });
  }
  return rows;
}

function parseWorkbookSheetPathMap(dualWorkbook) {
  const workbookXml = fileContentUtf8(dualWorkbook.files?.["xl/workbook.xml"]);
  const workbookRelsXml = fileContentUtf8(dualWorkbook.files?.["xl/_rels/workbook.xml.rels"]);

  const relMap = new Map();
  for (const row of parseRelationships(workbookRelsXml)) {
    if (row.id && row.target) {
      relMap.set(row.id, row.target);
    }
  }

  const bySheetName = new Map();
  for (const match of workbookXml.matchAll(/<sheet\s+[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/gi)) {
    const sheetName = match[1];
    const relId = match[2];
    const target = relMap.get(relId);
    if (!target) continue;
    const normalized = target.replace(/^\/?/, "").replace(/^\.\//, "");
    const sheetPath = normalized.startsWith("xl/") ? normalized : `xl/${normalized}`;
    bySheetName.set(sheetName, sheetPath);
  }

  return bySheetName;
}

function resolveRelationshipTarget(basePartPath, target) {
  if (!target) return undefined;
  if (target.startsWith("/")) return target.replace(/^\//, "");
  const baseDir = basePartPath.split("/").slice(0, -1).join("/");
  const joined = path.posix.normalize(path.posix.join(baseDir, target));
  return joined.replace(/^\/+/, "");
}

function worksheetNeedsComposedSnapshot(dualWorkbook, sheetPath) {
  if (!sheetPath) return false;

  const sheetXml = fileContentUtf8(dualWorkbook.files?.[sheetPath]);
  const drawingRelMatch = sheetXml.match(/<drawing\s+[^>]*r:id="([^"]+)"/i);
  if (!drawingRelMatch) return false;

  const sheetFileName = sheetPath.split("/").pop();
  const relPath = `xl/worksheets/_rels/${sheetFileName}.rels`;
  const relsXml = fileContentUtf8(dualWorkbook.files?.[relPath]);
  const drawingRelationship = parseRelationships(relsXml)
    .find((item) => item.id === drawingRelMatch[1] || (typeof item.type === "string" && item.type.includes("/drawing")));
  if (!drawingRelationship?.target) return false;

  const drawingPart = resolveRelationshipTarget(sheetPath, drawingRelationship.target);
  const drawingXml = fileContentUtf8(dualWorkbook.files?.[drawingPart]);
  if (!drawingXml) return false;

  const picCount = (drawingXml.match(/<xdr:pic\b/gi) ?? []).length;
  const hasOverlayShape = /<xdr:sp\b/i.test(drawingXml)
    || /<xdr:cxnSp\b/i.test(drawingXml)
    || /<xdr:grpSp\b/i.test(drawingXml)
    || /<a:t\b/i.test(drawingXml)
    || /<a:ln\b/i.test(drawingXml);

  return picCount > 1 || (picCount >= 1 && hasOverlayShape);
}

function readJsonIfExists(jsonPath) {
  if (!existsSync(jsonPath)) return undefined;
  return JSON.parse(readFileSync(jsonPath, "utf8"));
}

function worksheetNamesFromManifest(manifestPath, fallback) {
  if (!manifestPath) return fallback;
  const manifest = readJsonIfExists(manifestPath);
  const selected = manifest?.selectedNames;
  return Array.isArray(selected) && selected.length > 0 ? selected : fallback;
}

function extensionFromMediaType(mediaType) {
  const map = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
    "image/webp": ".webp",
    "application/octet-stream": ".bin",
  };
  return map[mediaType.toLowerCase()] ?? ".bin";
}

function colToIndex(col) {
  let index = 0;
  for (const ch of col) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index;
}

function indexToCol(index) {
  let n = index;
  let text = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    text = String.fromCharCode(65 + rem) + text;
    n = Math.floor((n - 1) / 26);
  }
  return text;
}

function parseCellRef(reference) {
  const match = /^([A-Z]+)([1-9]\d*)$/.exec(reference ?? "");
  if (!match) return undefined;
  return { col: colToIndex(match[1]), row: Number(match[2]) };
}

function buildCaptureRange(worksheet) {
  const anchors = worksheet.imageAssets
    .map((asset) => asset.anchor)
    .filter((anchor) => anchor?.status === "available" && anchor.from && anchor.to)
    .map((anchor) => ({ from: parseCellRef(anchor.from), to: parseCellRef(anchor.to) }))
    .filter((anchor) => anchor.from && anchor.to);

  if (anchors.length === 0) return "A45:Z130";

  let minCol = 26;
  let maxCol = 1;
  let minRow = 260;
  let maxRow = 1;
  for (const item of anchors) {
    minCol = Math.min(minCol, item.from.col, item.to.col);
    maxCol = Math.max(maxCol, item.from.col, item.to.col);
    minRow = Math.min(minRow, item.from.row, item.to.row);
    maxRow = Math.max(maxRow, item.from.row, item.to.row);
  }

  const left = Math.max(1, minCol - 4);
  const right = Math.min(26, maxCol + 5);
  const top = Math.max(45, minRow - 8);
  const bottom = Math.min(140, maxRow + 12);
  return `${indexToCol(left)}${top}:${indexToCol(right)}${bottom}`;
}

function exportComposedSnapshots(workbookPath, workbookImageDir, captures) {
  if (!Array.isArray(captures) || captures.length === 0) {
    return new Map();
  }

  const scriptPath = path.resolve("scripts/export-worksheet-composed-snapshots.ps1");
  const composedDir = path.join(workbookImageDir, "composed");
  const tmpDir = path.join(outRoot, "_tmp");
  mkdirSync(composedDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  const planPath = path.join(tmpDir, `${safeName(path.basename(workbookPath))}.capture-plan.json`);
  const resultPath = path.join(tmpDir, `${safeName(path.basename(workbookPath))}.capture-result.json`);
  writeFileSync(planPath, JSON.stringify({ captures }, null, 2));

  const result = spawnSync("pwsh", [
    "-NoProfile",
    "-File",
    scriptPath,
    "-WorkbookPath",
    workbookPath,
    "-CapturePlanPath",
    planPath,
    "-OutputDir",
    composedDir,
    "-ResultPath",
    resultPath,
  ], { encoding: "utf8" });

  if (result.status !== 0 || !existsSync(resultPath)) {
    return new Map();
  }

  const payload = JSON.parse(readFileSync(resultPath, "utf8"));
  const byWorksheet = new Map();
  for (const item of payload.captures ?? []) byWorksheet.set(item.worksheetName, item);
  return byWorksheet;
}

function annotateField(field) {
  if (!field || field.status !== "available") {
    return {
      status: field?.status ?? "unavailable",
      reasonCode: field?.reasonCode,
      sourceCell: field?.sourceCell,
      displayValue: "",
      actualValue: "",
      valueOrigin: "missing",
    };
  }

  const isFormula = typeof field.formula === "string";
  const hasNumeric = typeof field.numericValue === "number";
  return {
    status: "available",
    sourceCell: field.sourceCell,
    displayValue: field.rawText,
    actualValue: hasNumeric ? field.numericValue : (field.cachedValue ?? field.rawText),
    valueOrigin: isFormula ? "formula_cached" : (hasNumeric ? "numeric_literal" : "text_literal"),
    formula: field.formula,
    cachedValue: field.cachedValue,
    numericValue: field.numericValue,
    unit: field.unit,
  };
}

function withDisplayActualFields(worksheet) {
  return worksheet.factorTables.map((table) => ({
    tableId: table.tableId,
    headerRow: table.headerRow,
    dataRange: table.dataRange,
    columns: table.columns,
    rows: table.rows.map((row) => {
      const nextFields = {};
      for (const [name, value] of Object.entries(row.fields)) {
        nextFields[name] = annotateField(value);
      }
      return { sourceRow: row.sourceRow, fields: nextFields };
    }),
  }));
}

function availableFieldText(field) {
  return field?.status === "available" ? String(field.displayValue ?? "") : "";
}

function cellAddress(row, col) {
  return `${indexToCol(col)}${row}`;
}

function cellActualText(cell) {
  if (!cell) return "";
  if (cell.t === "e") {
    return typeof cell.w === "string" ? cell.w.trim() : "";
  }
  if (cell.v === undefined || cell.v === null) return "";
  return String(cell.v).trim();
}

function cellDisplayText(cell) {
  if (!cell) return "";
  if (typeof cell.w === "string" && cell.w.trim().length > 0) return cell.w.trim();
  return cellActualText(cell);
}

function buildDualGrids(worksheetSheet, maxRow = 260) {
  const actualGrid = Array.from({ length: maxRow + 1 }, () => Array.from({ length: 27 }, () => ""));
  const displayGrid = Array.from({ length: maxRow + 1 }, () => Array.from({ length: 27 }, () => ""));

  for (let row = 1; row <= maxRow; row += 1) {
    for (let col = 1; col <= 26; col += 1) {
      const cell = worksheetSheet[cellAddress(row, col)];
      actualGrid[row][col] = cellActualText(cell);
      displayGrid[row][col] = cellDisplayText(cell);
    }
  }

  return { actualGrid, displayGrid };
}

function findRowContaining(actualGrid, maxRow, keyword) {
  const lowered = keyword.toLowerCase();
  for (let row = 1; row <= maxRow; row += 1) {
    for (let col = 1; col <= 26; col += 1) {
      const text = String(actualGrid[row][col] ?? "").toLowerCase();
      if (text.includes(lowered)) return row;
    }
  }
  return undefined;
}

function getRangeColsByRows(actualGrid, fromRow, toRow) {
  let min = 999;
  let max = -1;
  for (let row = fromRow; row <= toRow; row += 1) {
    for (let col = 1; col <= 26; col += 1) {
      const text = String(actualGrid[row][col] ?? "").trim();
      if (text.length === 0) continue;
      min = Math.min(min, col);
      max = Math.max(max, col);
    }
  }
  if (max < min) return [];
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

function getRangeColsByHeader(actualGrid, headerRow) {
  let min = 999;
  let max = -1;
  for (let col = 1; col <= 26; col += 1) {
    const text = String(actualGrid[headerRow][col] ?? "").trim();
    if (text.length === 0) continue;
    min = Math.min(min, col);
    max = Math.max(max, col);
  }
  if (max < min) return [];
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

function isNumericText(value) {
  return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value);
}

function isZeroPlaceholderRow(actualGrid, row, cols) {
  let hasAny = false;
  let hasText = false;
  let hasNonZero = false;

  for (const col of cols) {
    const value = String(actualGrid[row][col] ?? "").trim();
    if (value.length === 0) continue;
    hasAny = true;
    if (isNumericText(value)) {
      if (Number(value) !== 0) hasNonZero = true;
    } else {
      hasText = true;
    }
  }

  return hasAny && !hasText && !hasNonZero;
}

function chooseRows(actualGrid, fromRow, toRow, cols, filterZeroPlaceholder) {
  const rows = [];
  for (let row = fromRow; row <= toRow; row += 1) {
    const hasAny = cols.some((col) => String(actualGrid[row][col] ?? "").trim().length > 0);
    if (!hasAny) continue;
    if (filterZeroPlaceholder && isZeroPlaceholderRow(actualGrid, row, cols)) continue;
    rows.push(row);
  }
  return rows;
}

function renderDualGrid(lines, title, cols, rows, actualGrid, displayGrid) {
  if (cols.length === 0 || rows.length === 0) return;
  lines.push(`## ${title}`);
  lines.push("");

  const headers = ["row", ...cols.map((col) => indexToCol(col))];
  lines.push(`| ${headers.map((item) => mdEscape(item)).join(" | ")} |`);
  lines.push(`|${headers.map(() => "---").join("|")}|`);

  for (const row of rows) {
    const values = [String(row)];
    for (const col of cols) {
      const actual = String(actualGrid[row][col] ?? "").trim();
      const display = String(displayGrid[row][col] ?? "").trim();
      if (actual.length === 0 && display.length === 0) {
        values.push("");
      } else if (actual === display) {
        values.push(mdEscape(actual));
      } else {
        values.push(mdEscape(`A:${actual}<br>D:${display}`));
      }
    }
    lines.push(`| ${values.join(" | ")} |`);
  }
  lines.push("");
}

function buildDualWorksheetMarkdown(workbookFileName, worksheetName, worksheetSheet, maxRow = 260) {
  const { actualGrid, displayGrid } = buildDualGrids(worksheetSheet, maxRow);
  const factorHeaderRow = findRowContaining(actualGrid, maxRow, "factor description");
  const responseHeaderRow = findRowContaining(actualGrid, maxRow, "response summary");
  const suggestedHeaderRow = findRowContaining(actualGrid, maxRow, "suggested spec");

  const lines = [];
  lines.push(`# ${worksheetName}`);
  lines.push("");
  lines.push(`- Workbook: ${workbookFileName}`);
  lines.push(`- Worksheet: ${worksheetName}`);
  lines.push("- Dual mode: A=Actual(Value2), D=Display(Text).");
  lines.push("- If A and D are the same, cell shows single value.");
  lines.push("");

  if (factorHeaderRow !== undefined) {
    const topCols = getRangeColsByRows(actualGrid, 1, factorHeaderRow - 1);
    const topRows = chooseRows(actualGrid, 1, factorHeaderRow - 1, topCols, false);
    renderDualGrid(lines, "Top Notes (Above Factor Table)", topCols, topRows, actualGrid, displayGrid);

    const factorCols = getRangeColsByHeader(actualGrid, factorHeaderRow);
    const factorEnd = responseHeaderRow !== undefined ? responseHeaderRow - 1 : maxRow;
    const factorRows = chooseRows(actualGrid, factorHeaderRow, factorEnd, factorCols, true);
    renderDualGrid(lines, `Factor Table (Rows ${factorHeaderRow}-${factorEnd})`, factorCols, factorRows, actualGrid, displayGrid);
  }

  if (responseHeaderRow !== undefined) {
    const responseEnd = suggestedHeaderRow !== undefined ? suggestedHeaderRow - 1 : Math.min(responseHeaderRow + 40, maxRow);
    const responseCols = getRangeColsByRows(actualGrid, responseHeaderRow, responseEnd);
    const responseRows = chooseRows(actualGrid, responseHeaderRow, responseEnd, responseCols, false);
    renderDualGrid(lines, `Response Summary (Rows ${responseHeaderRow}-${responseEnd})`, responseCols, responseRows, actualGrid, displayGrid);
  }

  if (suggestedHeaderRow !== undefined) {
    const suggestedEnd = Math.min(suggestedHeaderRow + 40, maxRow);
    const suggestedCols = getRangeColsByRows(actualGrid, suggestedHeaderRow, suggestedEnd);
    const suggestedRows = chooseRows(actualGrid, suggestedHeaderRow, suggestedEnd, suggestedCols, false);
    renderDualGrid(lines, `Suggested Spec (Rows ${suggestedHeaderRow}-${suggestedEnd})`, suggestedCols, suggestedRows, actualGrid, displayGrid);
  }

  return lines.join("\n");
}

function injectLinksIntoFactorTableMarkdown(markdown, traceabilityRows) {
  const byRow = new Map(traceabilityRows.map((item) => [Number(item.sourceRow), item]));
  const lines = markdown.split(/\r?\n/);
  let inFactorTable = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("## Factor Table")) {
      inFactorTable = true;
      continue;
    }
    if (inFactorTable && line.startsWith("## ") && !line.startsWith("## Factor Table")) {
      inFactorTable = false;
    }
    if (!inFactorTable || !line.startsWith("|") || line.includes("|---")) continue;

    const parts = line.split("|");
    if (parts.length < 4) continue;
    const rowNumber = Number(parts[1]?.trim());
    if (!Number.isFinite(rowNumber)) continue;

    const trace = byRow.get(rowNumber);
    if (!trace) continue;

    const link = trace.factorDescription?.imageLinkForMd ?? trace.target?.imageLinkForMd;
    if (trace.factorDescription?.text && link) {
      parts[2] = ` ${mdLinkText(trace.factorDescription.text, link)} `;
    }
    if (trace.partName?.text && link) {
      parts[3] = ` ${mdLinkText(trace.partName.text, link)} `;
    }
    lines[index] = parts.join("|");
  }

  return lines.join("\n");
}

function buildWorksheetMd(record) {
  const lines = [];
  lines.push(`# ${record.worksheetName}`);
  lines.push("");
  lines.push(`- Workbook: ${record.workbook.fileName}`);
  lines.push(`- Tolerance Loop: ${record.toleranceLoopDescription}`);
  lines.push(`- Status: ${record.page.status} (${record.page.reasonCode})`);
  lines.push(`- FactorTableCount: ${record.factorTables.length}`);
  lines.push(`- FormulaCellCount: ${record.formulaCells.length}`);
  lines.push(`- ImageAssetCount: ${record.imageAssets.length}`);
  if (record.composedSnapshot?.outputFileForMd) {
    lines.push(`- Composed Snapshot: [open](${record.composedSnapshot.outputFileForMd})`);
  }
  lines.push("");

  for (const [tableIndex, table] of record.factorTables.entries()) {
    lines.push(`## Factor Table ${tableIndex + 1}`);
    lines.push("");
    lines.push(`- dataRange: ${table.dataRange.startRow}-${table.dataRange.endRow}`);
    lines.push("");
    lines.push("| Row | Factor Description | Part Name | Part Category | Nominal(actual/display) | +Tol(actual/display) | -Tol(actual/display) | Mean(actual/display) | Distribution |");
    lines.push("|---:|---|---|---|---|---|---|---|---|");

    const traceabilityByRow = new Map((record.traceability ?? []).map((item) => [item.sourceRow, item]));
    for (const row of table.rows) {
      const trace = traceabilityByRow.get(row.sourceRow);
      const factorText = availableFieldText(row.fields.factorName);
      const partText = availableFieldText(row.fields.partName);
      const factorCell = trace?.target?.imageLinkForMd
        ? `[${mdEscape(factorText)}](${trace.target.imageLinkForMd})`
        : mdEscape(factorText);
      const partCell = trace?.target?.imageLinkForMd
        ? `[${mdEscape(partText)}](${trace.target.imageLinkForMd})`
        : mdEscape(partText);

      const nominal = row.fields.nominalValue;
      const upper = row.fields.upperTolerance;
      const lower = row.fields.lowerTolerance;
      const mean = row.fields.mean;

      const nominalText = `${mdEscape(nominal.actualValue)} / ${mdEscape(nominal.displayValue)}`;
      const upperText = `${mdEscape(upper.actualValue)} / ${mdEscape(upper.displayValue)}`;
      const lowerText = `${mdEscape(lower.actualValue)} / ${mdEscape(lower.displayValue)}`;
      const meanText = `${mdEscape(mean.actualValue)} / ${mdEscape(mean.displayValue)}`;

      lines.push(`| ${row.sourceRow} | ${factorCell} | ${partCell} | ${mdEscape(availableFieldText(row.fields.partCategory))} | ${nominalText} | ${upperText} | ${lowerText} | ${meanText} | ${mdEscape(availableFieldText(row.fields.distribution))} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function summarizePages(pages) {
  return pages.map((page) => ({
    worksheetName: page.worksheetName,
    status: page.status,
    reasonCode: page.reasonCode,
    durationMs: page.durationMs,
    factorTableCount: page.factorTableCount ?? 0,
    factorRowCount: page.factorRowCount ?? 0,
    formulaCellCount: page.formulaCellCount ?? 0,
    imageAssetCount: page.imageAssetCount ?? 0,
    errorSummary: page.errorSummary,
  }));
}

const jobs = configuredJobs.filter((job) => existsSync(job.workbookPath));
if (jobs.length === 0) {
  throw new Error("No configured workbook exists for Feature 1 workflow.");
}

const generatedAt = new Date().toISOString();
const runId = generatedAt.replace(/[:.]/g, "-");
const report = {
  contractVersion: "v1",
  feature: "F1",
  generatedAt,
  tasks: ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"],
  strictExecution: true,
  workbooks: [],
};

for (const job of jobs) {
  const workbookBytes = new Uint8Array(readFileSync(job.workbookPath));
  const dualWorkbook = XLSX.readFile(job.workbookPath, { cellFormula: true, cellText: true, raw: true });
  const sheetPathByName = parseWorkbookSheetPathMap(dualWorkbook);
  const workbookCatalog = createWorkbookCatalog({
    contractVersion: "v1",
    fileName: path.basename(job.workbookPath),
    inputClassification: "confidential",
    workbookBytes,
  });

  const selectionView = createWorksheetSelectionView({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbookCatalog,
  });

  const detectedWorksheetNames = selectionView.worksheets.map((item) => item.worksheetName);
  const selectedWorksheetNames = worksheetNamesFromManifest(
    job.selectedManifestPath,
    detectedWorksheetNames,
  );

  const parallelAssets = await createWorksheetAnalysisAssetsParallel({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbookBytes,
    workbookCatalog,
    worksheetSelection: { mode: "selected", worksheetNames: selectedWorksheetNames },
  });

  const workbookSafe = safeName(workbookCatalog.workbook.fileName);
  const workbookOutRoot = path.join(outSheetsRoot, workbookSafe);
  const workbookJsonDir = path.join(workbookOutRoot, "json");
  const workbookMdDir = path.join(workbookOutRoot, "md");
  const workbookImageDir = path.join(workbookOutRoot, "images");
  mkdirSync(workbookJsonDir, { recursive: true });
  mkdirSync(workbookMdDir, { recursive: true });
  mkdirSync(workbookImageDir, { recursive: true });

  const composedNeedByWorksheet = new Map(
    parallelAssets.assets.worksheets.map((worksheet) => {
      const sheetPath = sheetPathByName.get(worksheet.worksheetName);
      const autoNeed = worksheetNeedsComposedSnapshot(dualWorkbook, sheetPath);
      const need = composedMode === "always"
        ? true
        : composedMode === "never"
          ? false
          : autoNeed;
      return [worksheet.worksheetName, need];
    }),
  );

  const capturePlan = parallelAssets.assets.worksheets
    .filter((worksheet) => composedNeedByWorksheet.get(worksheet.worksheetName) === true)
    .map((worksheet) => ({
      worksheetName: worksheet.worksheetName,
      captureRange: buildCaptureRange(worksheet),
      fileName: `${safeName(worksheet.worksheetName)}__composed.png`,
    }));
  const composedByWorksheet = exportComposedSnapshots(job.workbookPath, workbookImageDir, capturePlan);

  const worksheetOutputs = [];
  for (const worksheet of parallelAssets.assets.worksheets) {
    const page = parallelAssets.pages.find((item) => item.worksheetName === worksheet.worksheetName) ?? {
      worksheetName: worksheet.worksheetName,
      status: "failed",
      reasonCode: "unknown",
      durationMs: 0,
    };

    const worksheetSafe = safeName(worksheet.worksheetName);
    const imageRecords = [];
    for (const image of worksheet.imageAssets) {
      const readResult = readWorksheetImageAsset({
        contractVersion: "v1",
        inputClassification: "confidential",
        workbookBytes,
        workbookContentHash: parallelAssets.assets.workbook.contentHash,
        imageContentHash: image.contentHash,
      });

      const ext = extensionFromMediaType(readResult.mediaType);
      const fileName = `${worksheetSafe}__${readResult.imageContentHash.slice(0, 16)}${ext}`;
      const outputPath = path.join(workbookImageDir, fileName);
      writeFileSync(outputPath, readResult.bytes);

      imageRecords.push({
        contentHash: readResult.imageContentHash,
        mediaType: readResult.mediaType,
        byteLength: readResult.bytes.byteLength,
        sourcePart: image.sourcePart,
        drawingSourcePart: image.drawingSourcePart,
        anchor: image.anchor,
        outputFile: toPosix(path.relative(outRoot, outputPath)),
      });
    }

    const composed = composedByWorksheet.get(worksheet.worksheetName);
    const composedOutput = composed?.status === "ok"
      ? toPosix(path.relative(outRoot, path.join(workbookImageDir, "composed", composed.outputFile)))
      : undefined;

    const defaultImage = composedOutput ?? imageRecords[0]?.outputFile;

    const traceability = [];
    const factorTablesAnnotated = withDisplayActualFields(worksheet);
    for (const table of factorTablesAnnotated) {
      for (const row of table.rows) {
        const factorText = availableFieldText(row.fields.factorName);
        const partText = availableFieldText(row.fields.partName);
        if (!factorText && !partText) continue;
        traceability.push({
          sourceRow: row.sourceRow,
          factorDescription: {
            text: factorText,
            sourceCell: row.fields.factorName.sourceCell,
          },
          partName: {
            text: partText,
            sourceCell: row.fields.partName.sourceCell,
          },
          target: {
            imageRefType: composedOutput ? "composed_snapshot" : "base_image",
            imageLink: defaultImage,
            imageLinkForMd: defaultImage ? toPosix(path.relative(workbookMdDir, path.join(outRoot, defaultImage))) : undefined,
          },
        });
      }
    }

    const composedRequired = composedNeedByWorksheet.get(worksheet.worksheetName) === true;
    const composedSnapshot = {
      status: composedOutput ? "available" : (composedRequired ? "failed" : "skipped"),
      captureRange: composed?.captureRange ?? capturePlan.find((item) => item.worksheetName === worksheet.worksheetName)?.captureRange,
      outputFile: composedOutput,
      outputFileForMd: composedOutput ? toPosix(path.relative(workbookMdDir, path.join(outRoot, composedOutput))) : undefined,
      includes: ["embedded_image", "inserted_shape", "inserted_text"],
      exportMethod: "excel_com_chart_export_with_copy_picture_fallback",
      required: composedRequired,
      skipReason: composedRequired ? undefined : "base image only; no shape/text/line overlay detected",
    };

    const worksheetRecord = {
      taskId: "1.5-1.6",
      generatedAt,
      workbook: {
        fileName: workbookCatalog.workbook.fileName,
        contentHash: workbookCatalog.workbook.contentHash,
        documentNo: workbookCatalog.workbook.metadata.documentNo,
        revision: workbookCatalog.workbook.metadata.revision,
        date: workbookCatalog.workbook.metadata.date.value,
      },
      worksheetName: worksheet.worksheetName,
      toleranceLoopDescription: worksheet.toleranceLoopDescription,
      page,
      factorTables: factorTablesAnnotated,
      formulaCells: worksheet.formulaCells,
      imageAssets: imageRecords,
      composedSnapshot,
      traceability,
    };

    const worksheetJsonPath = path.join(workbookJsonDir, `${workbookSafe}__${worksheetSafe}.task1.5.sheet.full.json`);
    const worksheetMdPath = path.join(workbookMdDir, `${workbookSafe}__${worksheetSafe}.task1.5.sheet.md`);

    const dualWorksheetSheet = dualWorkbook.Sheets[worksheet.worksheetName];
    const worksheetMarkdown = dualWorksheetSheet
      ? injectLinksIntoFactorTableMarkdown(
        buildDualWorksheetMarkdown(workbookCatalog.workbook.fileName, worksheet.worksheetName, dualWorksheetSheet),
        traceability,
      )
      : buildWorksheetMd(worksheetRecord);

    writeFileSync(worksheetJsonPath, JSON.stringify(worksheetRecord, null, 2));
    writeFileSync(worksheetMdPath, worksheetMarkdown);

    worksheetOutputs.push({
      worksheetName: worksheet.worksheetName,
      jsonPath: toPosix(path.relative(outRoot, worksheetJsonPath)),
      mdPath: toPosix(path.relative(outRoot, worksheetMdPath)),
      imageAssetCount: imageRecords.length,
      composedSnapshot: composedSnapshot.outputFile,
      composedStatus: composedSnapshot.status,
    });
  }

  const workbookSheetReadme = [];
  workbookSheetReadme.push(`# Feature 1 Sheet Outputs - ${workbookCatalog.workbook.fileName}`);
  workbookSheetReadme.push("");
  workbookSheetReadme.push("| worksheet | sheetJson | sheetMd | images | composed |");
  workbookSheetReadme.push("|---|---|---|---:|---|");
  for (const item of worksheetOutputs) {
    const composedText = item.composedSnapshot ? item.composedSnapshot : item.composedStatus;
    workbookSheetReadme.push(`| ${mdEscape(item.worksheetName)} | ${mdEscape(item.jsonPath)} | ${mdEscape(item.mdPath)} | ${item.imageAssetCount} | ${mdEscape(composedText ?? "") } |`);
  }
  workbookSheetReadme.push("");
  const workbookSheetReadmePath = path.join(workbookOutRoot, "README.md");
  writeFileSync(workbookSheetReadmePath, workbookSheetReadme.join("\n"));

  report.workbooks.push({
    workbookPath: toPosix(job.workbookPath),
    workbook: workbookCatalog.workbook,
    task11_scan: {
      detectedWorksheetCount: workbookCatalog.analyses.length,
      detectedWorksheets: workbookCatalog.analyses,
    },
    task12_selection_view: {
      worksheetCount: selectionView.worksheets.length,
      worksheets: selectionView.worksheets,
    },
    task13_pre_analysis_selection: {
      selectedWorksheetCount: selectedWorksheetNames.length,
      selectedWorksheetNames,
      selectedManifestPath: job.selectedManifestPath ? toPosix(job.selectedManifestPath) : undefined,
    },
    task14_parallel_processing: {
      mode: parallelAssets.processingMode,
      pageCount: parallelAssets.pages.length,
      pages: summarizePages(parallelAssets.pages),
    },
    task15_factor_table_and_debug_json: {
      worksheetCount: worksheetOutputs.length,
      sheetOutputRoot: toPosix(path.relative(outRoot, workbookOutRoot)),
      sheets: worksheetOutputs.map((item) => ({
        worksheetName: item.worksheetName,
        jsonPath: item.jsonPath,
      })),
      valueMarking: "Each field includes actualValue/displayValue/valueOrigin.",
    },
    task16_loop_screenshot_and_run_record: {
      worksheetCount: worksheetOutputs.length,
      imageAssetTotal: worksheetOutputs.reduce((sum, item) => sum + item.imageAssetCount, 0),
      composedExportedCount: worksheetOutputs.filter((item) => item.composedStatus === "available").length,
      composedSkippedCount: worksheetOutputs.filter((item) => item.composedStatus === "skipped").length,
      sheets: worksheetOutputs.map((item) => ({
        worksheetName: item.worksheetName,
        mdPath: item.mdPath,
        composedSnapshot: item.composedSnapshot,
        composedStatus: item.composedStatus,
      })),
      hyperlinkMode: "Factor Description and Part Name link to sheet-level composed/base image.",
    },
    sheetReadmePath: toPosix(path.relative(outRoot, workbookSheetReadmePath)),
  });
}

const finalMd = [];
finalMd.push("# Feature 1 Strict Workflow Output");
finalMd.push("");
finalMd.push(`- GeneratedAt: ${generatedAt}`);
finalMd.push("- Scope: Task 1.1 -> 1.6");
finalMd.push("- ExecutionMode: strict sequential by task definition");
finalMd.push("- Guarantees: full worksheet extraction + actual/display marking + image hyperlinks");
finalMd.push(`- ComposedMode: ${composedMode} (auto|always|never)`);
finalMd.push("");

for (const workbook of report.workbooks) {
  finalMd.push(`## Workbook: ${workbook.workbook.fileName}`);
  finalMd.push("");
  finalMd.push(`- Source: ${workbook.workbookPath}`);
  finalMd.push(`- WorksheetDetected: ${workbook.task11_scan.detectedWorksheetCount}`);
  finalMd.push(`- WorksheetSelected: ${workbook.task13_pre_analysis_selection.selectedWorksheetCount}`);
  finalMd.push(`- ParallelPageCount: ${workbook.task14_parallel_processing.pageCount}`);
  finalMd.push(`- FactorTableTotal(Task1.5): ${workbook.task14_parallel_processing.pages.reduce((sum, page) => sum + (page.factorTableCount ?? 0), 0)}`);
  finalMd.push(`- FactorRowTotal(Task1.5): ${workbook.task14_parallel_processing.pages.reduce((sum, page) => sum + (page.factorRowCount ?? 0), 0)}`);
  finalMd.push(`- ImageAssetTotal(Task1.6): ${workbook.task16_loop_screenshot_and_run_record.imageAssetTotal}`);
  finalMd.push(`- ComposedExported(Task1.6): ${workbook.task16_loop_screenshot_and_run_record.composedExportedCount}`);
  finalMd.push(`- ComposedSkipped(Task1.6): ${workbook.task16_loop_screenshot_and_run_record.composedSkippedCount}`);
  finalMd.push(`- Sheet Outputs: ${workbook.sheetReadmePath}`);
  finalMd.push("");

  finalMd.push("### Task 1.4 Pages");
  finalMd.push("");
  finalMd.push("| worksheet | status | reasonCode | durationMs | factorTables | factorRows | formulas | images |");
  finalMd.push("|---|---|---|---:|---:|---:|---:|---:|");
  for (const page of workbook.task14_parallel_processing.pages) {
    finalMd.push(`| ${mdEscape(page.worksheetName)} | ${page.status} | ${page.reasonCode} | ${page.durationMs} | ${page.factorTableCount} | ${page.factorRowCount} | ${page.formulaCellCount} | ${page.imageAssetCount} |`);
  }
  finalMd.push("");
}

const jsonPath = path.join(outRoot, `f1-strict-workflow-${runId}.json`);
const mdPath = path.join(outRoot, `f1-strict-workflow-${runId}.md`);
const latestJsonPath = path.join(outRoot, "latest.json");
const latestMdPath = path.join(outRoot, "latest.md");

writeFileSync(jsonPath, JSON.stringify(report, null, 2));
writeFileSync(mdPath, finalMd.join("\n"));
writeFileSync(latestJsonPath, JSON.stringify(report, null, 2));
writeFileSync(latestMdPath, finalMd.join("\n"));

console.log("Feature 1 strict workflow report generated:");
console.log(toPosix(mdPath));
console.log(toPosix(jsonPath));
console.log("Latest:");
console.log(toPosix(latestMdPath));
console.log(toPosix(latestJsonPath));