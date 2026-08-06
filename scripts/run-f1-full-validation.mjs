import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import XLSX from "xlsx";
import {
  createWorkbookCatalog,
} from "../packages/workbook-catalog/dist/workbook-catalog.js";
import {
  createWorksheetSelectionPrompt,
  createWorksheetSelectionView,
  validateWorksheetSelectionConfirmation,
} from "../packages/workbook-catalog/dist/worksheet-selection.js";
import {
  createWorksheetAnalysisAssetsParallel,
  readWorksheetImageAsset,
} from "../packages/workbook-catalog/dist/worksheet-analysis-assets.js";
import {
  FEATURE1_WORKBOOK_READ_OPTIONS,
  parseWorkbookSheetPathMap,
  worksheetNeedsComposedSnapshot,
} from "./f1-composed-snapshot-detection.mjs";
import {
  annotateArtifactField,
  cellActualText,
  cellDisplayText,
  filterFeature1WorksheetNames,
  injectLinksIntoFactorTableMarkdown,
  maskBlankFactorTemplateRows,
} from "./f1-dual-grid.mjs";
import { projectFactorActualFields } from "./f1-factor-actuals.mjs";
import { resolveFeature1OutputLayout, safeName } from "./f1-output-layout.mjs";
import { configuredFeature1Jobs, resolveFeature1Jobs } from "./f1-workbook-jobs.mjs";

const composedMode = (process.env.F1_COMPOSED_MODE ?? "auto").toLowerCase();

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function mdEscape(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>");
}

function readJsonIfExists(jsonPath) {
  if (!existsSync(jsonPath)) return undefined;
  return JSON.parse(readFileSync(jsonPath, "utf8"));
}

function worksheetNamesFromManifest(manifestPath) {
  if (!manifestPath) return undefined;
  const manifest = readJsonIfExists(manifestPath);
  const selected = manifest?.selectedNames;
  return Array.isArray(selected) && selected.length > 0 ? selected : undefined;
}

function parseSelectionArgs(args) {
  const workbookArgs = [];
  let selectionOnly = false;
  let confirmed = false;
  let workbookContentHash;
  let selectedWorksheetNames;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--selection-only") {
      selectionOnly = true;
    } else if (value === "--confirm") {
      confirmed = true;
    } else if (value === "--workbook-hash" || value === "--worksheets") {
      const optionValue = args[index + 1];
      if (!optionValue || optionValue.startsWith("--")) throw new Error(`Feature 1 ${value} value is missing.`);
      if (value === "--workbook-hash") workbookContentHash = optionValue;
      else selectedWorksheetNames = optionValue.split(",").map((name) => name.trim()).filter(Boolean);
      index += 1;
    } else if (value.startsWith("--")) {
      throw new Error(`Feature 1 option is unsupported: ${value}`);
    } else {
      workbookArgs.push(value);
    }
  }
  const confirmationCount = Number(confirmed) + Number(workbookContentHash !== undefined) + Number(selectedWorksheetNames !== undefined);
  if (selectionOnly && confirmationCount > 0) throw new Error("Feature 1 selection-only mode cannot include confirmation.");
  if (confirmationCount !== 0 && confirmationCount !== 3) throw new Error("Feature 1 confirmation parameters must be provided together.");
  return {
    workbookArgs,
    selectionOnly,
    confirmation: confirmationCount === 3
      ? { workbookContentHash, selectedWorksheetNames, confirmed: true }
      : undefined,
  };
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

function exportComposedSnapshots(workbookPath, workbookImageDir, captures, outputRoot) {
  if (!Array.isArray(captures) || captures.length === 0) {
    return new Map();
  }

  const scriptPath = path.resolve("scripts/export-worksheet-composed-snapshots.ps1");
  const composedDir = path.join(workbookImageDir, "composed");
  const tmpDir = path.join(outputRoot, "_tmp");
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

function fieldDisplayValue(field, worksheetSheet) {
  if (!worksheetSheet || field?.status !== "available" || typeof field.sourceCell !== "string") return "";
  const separator = field.sourceCell.lastIndexOf("!");
  const reference = separator < 0 ? field.sourceCell : field.sourceCell.slice(separator + 1);
  return cellDisplayText(worksheetSheet[reference]);
}

function withDisplayActualFields(worksheet, worksheetSheet) {
  return worksheet.factorTables.map((table) => ({
    tableId: table.tableId,
    headerRow: table.headerRow,
    dataRange: table.dataRange,
    columns: table.columns,
    rows: table.rows.map((row) => {
      const nextFields = {};
      for (const [name, value] of Object.entries(row.fields)) {
        nextFields[name] = annotateArtifactField(value, fieldDisplayValue(value, worksheetSheet));
      }
      return {
        sourceRow: row.sourceRow,
        fields: nextFields,
        actualFields: projectFactorActualFields(nextFields),
      };
    }),
  }));
}

function availableFieldText(field) {
  return field?.status === "available" ? String(field.displayValue ?? "") : "";
}

function cellAddress(row, col) {
  return `${indexToCol(col)}${row}`;
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

function chooseRows(actualGrid, fromRow, toRow, cols, filterZeroPlaceholder, includedBlankRows = new Set()) {
  const rows = [];
  for (let row = fromRow; row <= toRow; row += 1) {
    const hasAny = cols.some((col) => String(actualGrid[row][col] ?? "").trim().length > 0);
    if (!hasAny && !includedBlankRows.has(row)) continue;
    if (filterZeroPlaceholder && !includedBlankRows.has(row) && isZeroPlaceholderRow(actualGrid, row, cols)) continue;
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
    const blankFactorRows = maskBlankFactorTemplateRows(
      actualGrid,
      displayGrid,
      factorHeaderRow,
      factorEnd,
      factorCols,
    );
    const factorRows = chooseRows(actualGrid, factorHeaderRow, factorEnd, factorCols, true, blankFactorRows);
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

const cliArgs = process.argv.slice(2);
const selectionArgs = parseSelectionArgs(cliArgs);
const jobs = resolveFeature1Jobs(selectionArgs.workbookArgs, configuredFeature1Jobs)
  .filter((job) => existsSync(job.workbookPath));
if (jobs.length === 0) {
  throw new Error("No configured workbook exists for Feature 1 workflow.");
}

const generatedAt = new Date().toISOString();
const runId = generatedAt.replace(/[:.]/g, "-");
const outputLayout = resolveFeature1OutputLayout(selectionArgs.workbookArgs, runId, process.env.AI_TVA_F1_OUTPUT_ROOT);
const outRoot = outputLayout.outRoot;
const outSheetsRoot = path.join(outRoot, "sheets");
if (outputLayout.resetOutputRoot) {
  rmSync(outRoot, { recursive: true, force: true });
}
mkdirSync(outSheetsRoot, { recursive: true });

if (selectionArgs.selectionOnly) {
  if (jobs.length !== 1) throw new Error("Feature 1 selection-only mode requires exactly one workbook.");
  const job = jobs[0];
  const workbookBytes = new Uint8Array(readFileSync(job.workbookPath));
  const workbookCatalog = createWorkbookCatalog({
    contractVersion: "v1",
    fileName: path.basename(job.workbookPath),
    inputClassification: "confidential",
    workbookBytes,
  });
  const prompt = createWorksheetSelectionPrompt({ contractVersion: "v1", inputClassification: "confidential", workbookCatalog });
  writeFileSync(path.join(outRoot, "Feature1-Selection.json"), `${JSON.stringify(prompt, null, 2)}\n`, "utf8");
  process.exit(0);
}
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
  const dualWorkbook = XLSX.readFile(job.workbookPath, FEATURE1_WORKBOOK_READ_OPTIONS);
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

  const prompt = createWorksheetSelectionPrompt({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbookCatalog,
  });
  const manifestWorksheetNames = worksheetNamesFromManifest(job.selectedManifestPath);
  const confirmation = selectionArgs.confirmation ?? (manifestWorksheetNames
    ? { workbookContentHash: prompt.workbook.contentHash, selectedWorksheetNames: manifestWorksheetNames, confirmed: true }
    : undefined);
  if (!confirmation) throw new Error("Feature 1 worksheet confirmation is required.");
  const confirmationResult = validateWorksheetSelectionConfirmation({ prompt, confirmation });
  if (confirmationResult.status !== "confirmed") {
    throw new Error(`Feature 1 worksheet selection was ${confirmationResult.status}: ${confirmationResult.reasonCode}`);
  }
  const selectedWorksheetNames = filterFeature1WorksheetNames(confirmationResult.selectedWorksheetNames);

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
  const composedByWorksheet = exportComposedSnapshots(job.workbookPath, workbookImageDir, capturePlan, outRoot);

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
    const dualWorksheetSheet = dualWorkbook.Sheets[worksheet.worksheetName];
    const factorTablesAnnotated = withDisplayActualFields(worksheet, dualWorksheetSheet);
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
      tolerancePathImage: worksheet.tolerancePathImage,
      composedSnapshot,
      traceability,
    };

    const worksheetJsonPath = path.join(workbookJsonDir, `${workbookSafe}__${worksheetSafe}.task1.5.sheet.full.json`);
    const worksheetMdPath = path.join(workbookMdDir, `${workbookSafe}__${worksheetSafe}.task1.5.sheet.md`);

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

const jsonPath = path.join(outRoot, outputLayout.reportJsonName);
const mdPath = path.join(outRoot, outputLayout.reportMdName);

writeFileSync(jsonPath, JSON.stringify(report, null, 2));
writeFileSync(mdPath, finalMd.join("\n"));

console.log("Feature 1 strict workflow report generated:");
console.log(toPosix(mdPath));
console.log(toPosix(jsonPath));

if (outputLayout.mode === "batch") {
  const latestJsonPath = path.join(outRoot, outputLayout.latestJsonName);
  const latestMdPath = path.join(outRoot, outputLayout.latestMdName);
  writeFileSync(latestJsonPath, JSON.stringify(report, null, 2));
  writeFileSync(latestMdPath, finalMd.join("\n"));
  console.log("Latest:");
  console.log(toPosix(latestMdPath));
  console.log(toPosix(latestJsonPath));
}