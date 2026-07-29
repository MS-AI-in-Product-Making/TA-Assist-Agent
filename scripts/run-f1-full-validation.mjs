import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  createWorkbookCatalog,
  createWorksheetSelectionView,
  createWorksheetAnalysisAssetsParallel,
  readWorksheetImageAsset,
  createSemanticTableDetection,
} from "../packages/workbook-catalog/dist/index.js";

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
  tasks: ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7"],
  strictExecution: true,
  workbooks: [],
};

for (const job of jobs) {
  const workbookBytes = new Uint8Array(readFileSync(job.workbookPath));
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

  const semanticDetection = createSemanticTableDetection({
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

  const capturePlan = parallelAssets.assets.worksheets.map((worksheet) => ({
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

    const composedSnapshot = {
      status: composedOutput ? "available" : "failed",
      captureRange: composed?.captureRange ?? capturePlan.find((item) => item.worksheetName === worksheet.worksheetName)?.captureRange,
      outputFile: composedOutput,
      outputFileForMd: composedOutput ? toPosix(path.relative(workbookMdDir, path.join(outRoot, composedOutput))) : undefined,
      includes: ["embedded_image", "inserted_shape", "inserted_text"],
      exportMethod: "excel_com_chart_export_with_copy_picture_fallback",
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
    writeFileSync(worksheetJsonPath, JSON.stringify(worksheetRecord, null, 2));
    writeFileSync(worksheetMdPath, buildWorksheetMd(worksheetRecord));

    worksheetOutputs.push({
      worksheetName: worksheet.worksheetName,
      jsonPath: toPosix(path.relative(outRoot, worksheetJsonPath)),
      mdPath: toPosix(path.relative(outRoot, worksheetMdPath)),
      imageAssetCount: imageRecords.length,
      composedSnapshot: composedSnapshot.outputFile,
    });
  }

  const workbookSheetReadme = [];
  workbookSheetReadme.push(`# Feature 1 Sheet Outputs - ${workbookCatalog.workbook.fileName}`);
  workbookSheetReadme.push("");
  workbookSheetReadme.push("| worksheet | sheetJson | sheetMd | images | composed |");
  workbookSheetReadme.push("|---|---|---|---:|---|");
  for (const item of worksheetOutputs) {
    workbookSheetReadme.push(`| ${mdEscape(item.worksheetName)} | ${mdEscape(item.jsonPath)} | ${mdEscape(item.mdPath)} | ${item.imageAssetCount} | ${mdEscape(item.composedSnapshot ?? "") } |`);
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
      sheets: worksheetOutputs.map((item) => ({
        worksheetName: item.worksheetName,
        mdPath: item.mdPath,
        composedSnapshot: item.composedSnapshot,
      })),
      hyperlinkMode: "Factor Description and Part Name link to sheet-level composed/base image.",
    },
    task17_irregular_layout_manual_fallback: {
      summary: semanticDetection.summary,
      worksheetStatuses: semanticDetection.worksheets.map((item) => ({
        worksheetName: item.worksheetName,
        recognitionStatus: item.recognitionStatus,
        requiresUserConfirmation: item.requiresUserConfirmation,
        uncertaintyReasons: item.uncertaintyReasons,
      })),
      outputJsonPath: toPosix(path.relative(outRoot, path.join(workbookJsonDir, `${workbookSafe}.task1.7.semantic.full.json`))),
    },
    sheetReadmePath: toPosix(path.relative(outRoot, workbookSheetReadmePath)),
  });

  const semanticPath = path.join(workbookJsonDir, `${workbookSafe}.task1.7.semantic.full.json`);
  writeFileSync(semanticPath, JSON.stringify(semanticDetection, null, 2));
}

const finalMd = [];
finalMd.push("# Feature 1 Strict Workflow Output");
finalMd.push("");
finalMd.push(`- GeneratedAt: ${generatedAt}`);
finalMd.push("- Scope: Task 1.1 -> 1.7");
finalMd.push("- ExecutionMode: strict sequential by task definition");
finalMd.push("- Guarantees: full worksheet extraction + actual/display marking + image hyperlinks");
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
  finalMd.push(`- Task1.7 Summary: auto=${workbook.task17_irregular_layout_manual_fallback.summary.autoConfirmedCount}, manual=${workbook.task17_irregular_layout_manual_fallback.summary.manualConfirmedCount}, pending=${workbook.task17_irregular_layout_manual_fallback.summary.pendingConfirmationCount}, blocked=${workbook.task17_irregular_layout_manual_fallback.summary.blockedCount}`);
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