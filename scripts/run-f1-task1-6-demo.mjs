import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  createWorkbookCatalog,
  createWorksheetAnalysisAssetsParallel,
  readWorksheetImageAsset,
} from "../packages/workbook-catalog/dist/index.js";

const jobs = [
  {
    workbookPath: "test/Maera_cosmetic_critical_TA - Rev E.xlsx",
    selectedManifestPath: "test/demo-output/maera-selected-worksheets-factor-tables.full.json",
  },
  {
    workbookPath: "test/Meara TP TA_20241030-v0.xlsx",
    selectedManifestPath: "test/demo-output/meara-selected-worksheets-factor-tables.full.json",
  },
];

const outRoot = "test/demo-output/task1.6";
const outJsonDir = path.join(outRoot, "json");
const outMdDir = path.join(outRoot, "md");
const outImagesDir = path.join(outRoot, "images");
const tmpDir = path.join(outRoot, "_tmp");
mkdirSync(outJsonDir, { recursive: true });
mkdirSync(outMdDir, { recursive: true });
mkdirSync(outImagesDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

function safeName(value) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "-");
}

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function mdEscape(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>");
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
  for (const ch of col) {
    index = index * 26 + (ch.charCodeAt(0) - 64);
  }
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

function exportComposedSnapshots(workbookPath, safeWorkbook, captures) {
  const scriptPath = path.resolve("scripts/export-worksheet-composed-snapshots.ps1");
  const workbookComposedDir = path.join(outImagesDir, safeWorkbook, "composed");
  mkdirSync(workbookComposedDir, { recursive: true });
  const planPath = path.join(tmpDir, `${safeWorkbook}.composed.capture-plan.json`);
  const resultPath = path.join(tmpDir, `${safeWorkbook}.composed.capture-result.json`);
  writeFileSync(planPath, JSON.stringify({ captures }, null, 2));
  const command = spawnSync("pwsh", [
    "-NoProfile",
    "-File",
    scriptPath,
    "-WorkbookPath",
    workbookPath,
    "-CapturePlanPath",
    planPath,
    "-OutputDir",
    workbookComposedDir,
    "-ResultPath",
    resultPath,
  ], { encoding: "utf8" });
  if (command.status !== 0) {
    const message = command.stderr?.trim() || command.stdout?.trim() || "unknown powershell failure";
    throw new Error(`Failed to export composed snapshots: ${message}`);
  }
  const payload = JSON.parse(readFileSync(resultPath, "utf8"));
  const byWorksheet = new Map();
  for (const item of payload.captures ?? []) {
    byWorksheet.set(item.worksheetName, item);
  }
  return byWorksheet;
}

function buildWorkbookMd(runRecord) {
  const lines = [];
  lines.push(`# Task 1.6 Demo - ${runRecord.workbook.fileName}`);
  lines.push("");
  lines.push(`- GeneratedAt: ${runRecord.generatedAt}`);
  lines.push(`- Document No: ${runRecord.workbook.documentNo}`);
  lines.push(`- Revision: ${runRecord.workbook.revision}`);
  lines.push(`- Date: ${runRecord.workbook.date}`);
  lines.push(`- Selected Worksheets: ${runRecord.selectedNames.length}`);
  lines.push("");
  lines.push("## Worksheet Image Summary");
  lines.push("");
  lines.push("| worksheet | toleranceLoopDescription | pageStatus | reasonCode | durationMs | imageAssetCount | extractedImageFiles |");
  lines.push("|---|---|---|---|---:|---:|---|");
  for (const row of runRecord.worksheets) {
    const files = row.images.map((item) => item.outputFile ?? "").filter(Boolean).join("<br>");
    lines.push(`| ${mdEscape(row.worksheetName)} | ${mdEscape(row.toleranceLoopDescription)} | ${mdEscape(row.pageStatus)} | ${mdEscape(row.reasonCode)} | ${row.durationMs} | ${row.imageAssetCount} | ${mdEscape(files)} |`);
  }
  lines.push("");
  lines.push("## Worksheet Detail Links");
  lines.push("");
  lines.push("| worksheet | sheetMd | composedSnapshot | traceabilityDetail | clickableFactorRows |");
  lines.push("|---|---|---|---|---:|");
  for (const row of runRecord.worksheets) {
    const sheet = row.sheetMdForMd
      ? `[sheet](${row.sheetMdForMd})`
      : "n/a";
    const composed = row.composedSnapshot?.outputFileForMd
      ? `[composed](${row.composedSnapshot.outputFileForMd})`
      : "n/a";
    const detail = row.traceabilityDetailMdForMd
      ? `[traceability](${row.traceabilityDetailMdForMd})`
      : "n/a";
    lines.push(`| ${mdEscape(row.worksheetName)} | ${sheet} | ${composed} | ${detail} | ${row.traceability?.length ?? 0} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function mdLinkText(text, href) {
  const safeText = String(text ?? "").replace(/\]/g, "\\]");
  return `[${safeText}](${href})`;
}

function injectLinksIntoFactorTableMarkdown(markdown, traceabilityRows) {
  const byRow = new Map(traceabilityRows.map((item) => [Number(item.sourceRow), item]));
  const lines = markdown.split(/\r?\n/);
  let inFactorTable = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("## Factor Table")) {
      inFactorTable = true;
      continue;
    }
    if (inFactorTable && line.startsWith("## ") && !line.startsWith("## Factor Table")) {
      inFactorTable = false;
    }
    if (!inFactorTable) continue;
    if (!line.startsWith("|")) continue;
    if (line.includes("|---")) continue;

    const parts = line.split("|");
    if (parts.length < 5) continue;
    const rowNumber = Number(parts[1]?.trim());
    if (!Number.isFinite(rowNumber)) continue;
    const trace = byRow.get(rowNumber);
    if (!trace) continue;

    if (trace.factorDescription?.text && trace.factorDescription?.imageLinkForMd) {
      parts[2] = ` ${mdLinkText(trace.factorDescription.text, trace.factorDescription.imageLinkForMd)} `;
    }
    if (trace.partName?.text && trace.partName?.imageLinkForMd) {
      parts[3] = ` ${mdLinkText(trace.partName.text, trace.partName.imageLinkForMd)} `;
    }
    lines[i] = parts.join("|");
  }

  return lines.join("\n");
}

function fieldText(fieldValue) {
  return fieldValue?.status === "available" ? fieldValue.rawText : "";
}

function buildWorksheetTraceabilityMd(runRecord, worksheet) {
  const lines = [];
  lines.push(`# Task 1.6 Traceability - ${runRecord.workbook.fileName} - ${worksheet.worksheetName}`);
  lines.push("");
  lines.push(`- Worksheet: ${worksheet.worksheetName}`);
  lines.push(`- Tolerance Loop: ${worksheet.toleranceLoopDescription}`);
  lines.push(`- Composed Snapshot: ${worksheet.composedSnapshot?.outputFileForMd ? `[open](${worksheet.composedSnapshot.outputFileForMd})` : "n/a"}`);
  lines.push("");
  lines.push("| sourceRow | factorDescription | partName | factorSourceCell | partSourceCell | targetImage | targetType |");
  lines.push("|---:|---|---|---|---|---|---|");
  for (const row of worksheet.traceability ?? []) {
    const factorLink = row.factorDescription.imageLinkForMd
      ? `[${mdEscape(row.factorDescription.text)}](${row.factorDescription.imageLinkForMd})`
      : mdEscape(row.factorDescription.text);
    const partLink = row.partName.imageLinkForMd
      ? `[${mdEscape(row.partName.text)}](${row.partName.imageLinkForMd})`
      : mdEscape(row.partName.text);
    const targetLink = row.target.imageLinkForMd
      ? `[open](${row.target.imageLinkForMd})`
      : "n/a";
    lines.push(`| ${row.sourceRow} | ${factorLink} | ${partLink} | ${mdEscape(row.factorDescription.sourceCell ?? "")} | ${mdEscape(row.partName.sourceCell ?? "")} | ${targetLink} | ${mdEscape(row.target.imageRefType)} |`);
  }
  lines.push("");
  return lines.join("\n");
}

const generatedAt = new Date().toISOString();
const index = [];

for (const job of jobs) {
  const workbookBytes = new Uint8Array(readFileSync(job.workbookPath));
  const selectedManifest = JSON.parse(readFileSync(job.selectedManifestPath, "utf8"));
  const selectedNames = Array.isArray(selectedManifest.selectedNames) ? selectedManifest.selectedNames : [];
  if (selectedNames.length === 0) {
    throw new Error(`No selectedNames found in ${job.selectedManifestPath}`);
  }

  const workbookCatalog = createWorkbookCatalog({
    contractVersion: "v1",
    fileName: path.basename(job.workbookPath),
    inputClassification: "confidential",
    workbookBytes,
  });

  const parallelResult = await createWorksheetAnalysisAssetsParallel({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbookBytes,
    workbookCatalog,
    worksheetSelection: { mode: "selected", worksheetNames: selectedNames },
  });

  const safeWorkbook = safeName(workbookCatalog.workbook.fileName);
  const workbookImageDir = path.join(outImagesDir, safeWorkbook);
  mkdirSync(workbookImageDir, { recursive: true });

  const capturePlan = parallelResult.assets.worksheets.map((worksheet) => ({
    worksheetName: worksheet.worksheetName,
    captureRange: buildCaptureRange(worksheet),
    fileName: `${safeName(worksheet.worksheetName)}__composed.png`,
  }));
  const composedByWorksheet = exportComposedSnapshots(job.workbookPath, safeWorkbook, capturePlan);

  const worksheetRows = [];
  for (const worksheet of parallelResult.assets.worksheets) {
    const page = parallelResult.pages.find((p) => p.worksheetName === worksheet.worksheetName);
    const images = [];
    const composed = composedByWorksheet.get(worksheet.worksheetName);
    const composedOutputRel = composed?.status === "ok"
      ? toPosix(path.relative(outRoot, path.join(outImagesDir, safeWorkbook, "composed", composed.outputFile)))
      : undefined;

    for (const image of worksheet.imageAssets) {
      const readResult = readWorksheetImageAsset({
        contractVersion: "v1",
        inputClassification: "confidential",
        workbookBytes,
        workbookContentHash: parallelResult.assets.workbook.contentHash,
        imageContentHash: image.contentHash,
      });

      const ext = extensionFromMediaType(readResult.mediaType);
      const fileName = `${safeName(worksheet.worksheetName)}__${readResult.imageContentHash.slice(0, 16)}${ext}`;
      const outputPath = path.join(workbookImageDir, fileName);
      writeFileSync(outputPath, readResult.bytes);
      const outputFile = toPosix(path.relative(outRoot, outputPath));

      images.push({
        imageContentHash: readResult.imageContentHash,
        mediaType: readResult.mediaType,
        byteLength: readResult.bytes.byteLength,
        sourcePart: image.sourcePart,
        drawingSourcePart: image.drawingSourcePart,
        anchor: image.anchor,
        outputFile,
        outputFileForMd: toPosix(path.relative(outMdDir, outputPath)),
        outputFileForJson: toPosix(path.relative(outJsonDir, outputPath)),
      });
    }

    const defaultImageForMd = composedOutputRel
      ? toPosix(path.relative(outMdDir, path.join(outRoot, composedOutputRel)))
      : images[0]?.outputFileForMd;
    const defaultImageForJson = composedOutputRel
      ? toPosix(path.relative(outJsonDir, path.join(outRoot, composedOutputRel)))
      : images[0]?.outputFileForJson;

    const traceability = [];
    for (const table of worksheet.factorTables) {
      for (const row of table.rows) {
        const factorField = row.fields.factorName;
        const partField = row.fields.partName;
        const factorText = fieldText(factorField);
        const partText = fieldText(partField);
        if (!factorText && !partText) continue;
        traceability.push({
          tableId: table.tableId,
          sourceRow: row.sourceRow,
          factorDescription: {
            text: factorText,
            sourceCell: factorField?.sourceCell,
            imageLinkForMd: defaultImageForMd,
            imageLinkForJson: defaultImageForJson,
          },
          partName: {
            text: partText,
            sourceCell: partField?.sourceCell,
            imageLinkForMd: defaultImageForMd,
            imageLinkForJson: defaultImageForJson,
          },
          target: {
            imageRefType: composedOutputRel ? "composed_snapshot" : "base_image",
            imageLinkForMd: defaultImageForMd,
            imageLinkForJson: defaultImageForJson,
          },
        });
      }
    }

    const detailMdName = `${safeName(worksheet.worksheetName)}.task1.6.traceability.md`;
    const detailMdPath = path.join(outMdDir, detailMdName);
    const detailForMd = toPosix(path.relative(outMdDir, detailMdPath));
    const detailForJson = toPosix(path.relative(outJsonDir, detailMdPath));

    const safeSheet = safeName(worksheet.worksheetName);
    const sourceTask15Md = path.join("test", "demo-output", "task1.5", "md", `${safeWorkbook}__${safeSheet}.task1.5.sheet.md`);
    const sourceAcceptedMd = path.join("test", "demo-output", "full-tables-md-lite", `${safeWorkbook}__${safeSheet}.md`);
    const task16SheetMdPath = path.join(outMdDir, `${safeWorkbook}__${safeSheet}.task1.6.sheet.md`);
    const sheetForMd = toPosix(path.relative(outMdDir, task16SheetMdPath));
    const sheetForJson = toPosix(path.relative(outJsonDir, task16SheetMdPath));

    if (existsSync(sourceTask15Md) || existsSync(sourceAcceptedMd)) {
      const sourceMdPath = existsSync(sourceTask15Md) ? sourceTask15Md : sourceAcceptedMd;
      const linkedSheetMd = injectLinksIntoFactorTableMarkdown(readFileSync(sourceMdPath, "utf8"), traceability);
      writeFileSync(task16SheetMdPath, linkedSheetMd);
    }

    const rowRecord = {
      worksheetName: worksheet.worksheetName,
      toleranceLoopDescription: worksheet.toleranceLoopDescription,
      pageStatus: page?.status ?? "unknown",
      reasonCode: page?.reasonCode ?? "unknown",
      durationMs: page?.durationMs ?? 0,
      imageAssetCount: worksheet.imageAssets.length,
      images,
      composedSnapshot: {
        status: composed?.status === "ok" ? "available" : "failed",
        captureRange: composed?.captureRange ?? capturePlan.find((item) => item.worksheetName === worksheet.worksheetName)?.captureRange,
        outputFile: composedOutputRel,
        outputFileForMd: composedOutputRel ? toPosix(path.relative(outMdDir, path.join(outRoot, composedOutputRel))) : undefined,
        outputFileForJson: composedOutputRel ? toPosix(path.relative(outJsonDir, path.join(outRoot, composedOutputRel))) : undefined,
        includes: ["embedded_image", "inserted_shape", "inserted_text"],
        exportMethod: "excel_com_chart_export_with_copy_picture_fallback",
      },
      traceability,
      traceabilityDetailMd: toPosix(path.relative(outRoot, detailMdPath)),
      traceabilityDetailMdForMd: detailForMd,
      traceabilityDetailMdForJson: detailForJson,
      sheetMd: toPosix(path.relative(outRoot, task16SheetMdPath)),
      sheetMdForMd: sheetForMd,
      sheetMdForJson: sheetForJson,
      imageExtractionNote: page?.reasonCode === "image_extraction_skipped"
        ? "image extraction skipped in parallel parse fallback"
        : undefined,
    };

    writeFileSync(detailMdPath, buildWorksheetTraceabilityMd({ workbook: { fileName: workbookCatalog.workbook.fileName } }, rowRecord));

    worksheetRows.push(rowRecord);
  }

  const runRecord = {
    taskId: "1.6",
    generatedAt,
    workbook: {
      fileName: workbookCatalog.workbook.fileName,
      contentHash: workbookCatalog.workbook.contentHash,
      documentNo: workbookCatalog.workbook.metadata.documentNo,
      revision: workbookCatalog.workbook.metadata.revision,
      date: workbookCatalog.workbook.metadata.date.value,
    },
    selectedNames,
    pages: parallelResult.pages,
    worksheets: worksheetRows,
  };

  const workbookJsonPath = path.join(outJsonDir, `${safeWorkbook}.task1.6.images.full.json`);
  writeFileSync(workbookJsonPath, JSON.stringify(runRecord, null, 2));

  const workbookMdPath = path.join(outMdDir, `${safeWorkbook}.task1.6.images.summary.md`);
  writeFileSync(workbookMdPath, buildWorkbookMd(runRecord));

  index.push({
    workbook: runRecord.workbook.fileName,
    worksheetCount: runRecord.worksheets.length,
    imageCount: runRecord.worksheets.reduce((sum, item) => sum + item.imageAssetCount, 0),
    json: toPosix(path.relative(outRoot, workbookJsonPath)),
    md: toPosix(path.relative(outRoot, workbookMdPath)),
  });
}

const indexLines = [];
indexLines.push("# Task 1.6 Demo Index");
indexLines.push("");
indexLines.push(`GeneratedAt: ${generatedAt}`);
indexLines.push("");
indexLines.push("| Workbook | Worksheets | ImageAssets | Full JSON | Summary MD |");
indexLines.push("|---|---:|---:|---|---|");
for (const item of index) {
  indexLines.push(`| ${item.workbook} | ${item.worksheetCount} | ${item.imageCount} | ${item.json} | ${item.md} |`);
}
indexLines.push("");

const indexPath = path.join(outRoot, "README.md");
writeFileSync(indexPath, indexLines.join("\n"));
console.log(indexPath);
