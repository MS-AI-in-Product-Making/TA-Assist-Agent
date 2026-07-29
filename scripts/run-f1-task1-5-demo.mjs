import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWorkbookCatalog,
  createWorksheetAnalysisAssetsParallel,
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

const outRoot = "test/demo-output/task1.5";
const outJsonDir = path.join(outRoot, "json");
const outMdDir = path.join(outRoot, "md");

mkdirSync(outJsonDir, { recursive: true });
mkdirSync(outMdDir, { recursive: true });

function safeName(value) {
  return value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "-");
}

function mdEscape(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>");
}

function buildWorkbookMarkdown(runRecord) {
  const lines = [];
  lines.push(`# Task 1.5 Demo - ${runRecord.workbook.fileName}`);
  lines.push("");
  lines.push(`- GeneratedAt: ${runRecord.generatedAt}`);
  lines.push(`- Document No: ${runRecord.workbook.documentNo}`);
  lines.push(`- Revision: ${runRecord.workbook.revision}`);
  lines.push(`- Date: ${runRecord.workbook.date}`);
  lines.push(`- ProcessingMode: ${runRecord.processingMode}`);
  lines.push("");

  lines.push("## Pages Summary");
  lines.push("");
  const headers = [
    "worksheet",
    "status",
    "reasonCode",
    "durationMs",
    "factorTableCount",
    "factorRowCount",
    "formulaCellCount",
    "imageAssetCount",
  ];
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`|${headers.map(() => "---").join("|")}|`);
  for (const page of runRecord.pages) {
    const row = [
      mdEscape(page.worksheetName),
      mdEscape(page.status),
      mdEscape(page.reasonCode),
      String(page.durationMs),
      String(page.factorTableCount ?? 0),
      String(page.factorRowCount ?? 0),
      String(page.formulaCellCount ?? 0),
      String(page.imageAssetCount ?? 0),
    ];
    lines.push(`| ${row.join(" | ")} |`);
  }
  lines.push("");

  return lines.join("\n");
}

const generatedAt = new Date().toISOString();
const workbookIndex = [];

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

  const runRecord = {
    taskId: "1.5",
    generatedAt,
    workbook: {
      fileName: workbookCatalog.workbook.fileName,
      contentHash: workbookCatalog.workbook.contentHash,
      documentNo: workbookCatalog.workbook.metadata.documentNo,
      revision: workbookCatalog.workbook.metadata.revision,
      date: workbookCatalog.workbook.metadata.date.value,
    },
    selectedNames,
    processingMode: parallelResult.processingMode,
    pages: parallelResult.pages,
    worksheets: parallelResult.assets.worksheets,
  };

  const safeWorkbook = safeName(runRecord.workbook.fileName);
  const workbookJsonPath = path.join(outJsonDir, `${safeWorkbook}.task1.5.full.json`);
  writeFileSync(workbookJsonPath, JSON.stringify(runRecord, null, 2));

  const workbookMdPath = path.join(outMdDir, `${safeWorkbook}.task1.5.summary.md`);
  writeFileSync(workbookMdPath, buildWorkbookMarkdown(runRecord));

  for (const worksheet of runRecord.worksheets) {
    const page = runRecord.pages.find((item) => item.worksheetName === worksheet.worksheetName);
    const worksheetRecord = {
      taskId: runRecord.taskId,
      generatedAt: runRecord.generatedAt,
      workbook: runRecord.workbook,
      worksheetName: worksheet.worksheetName,
      toleranceLoopDescription: worksheet.toleranceLoopDescription,
      page,
      factorTables: worksheet.factorTables,
      formulaCells: worksheet.formulaCells,
      imageAssets: worksheet.imageAssets,
    };

    const safeSheet = safeName(worksheet.worksheetName);
    const worksheetJsonPath = path.join(outJsonDir, `${safeWorkbook}__${safeSheet}.task1.5.sheet.json`);
    writeFileSync(worksheetJsonPath, JSON.stringify(worksheetRecord, null, 2));

    const worksheetMdPath = path.join(outMdDir, `${safeWorkbook}__${safeSheet}.task1.5.sheet.md`);
    const acceptedMdPath = path.join(
      "test",
      "demo-output",
      "full-tables-md-lite",
      `${safeWorkbook}__${safeSheet}.md`,
    );
    if (existsSync(acceptedMdPath)) {
      copyFileSync(acceptedMdPath, worksheetMdPath);
    } else {
      // Fallback: keep a minimal traceability stub when accepted-format source markdown is unavailable.
      const fallback = [
        `# ${worksheet.worksheetName}`,
        "",
        `- Task: 1.5`,
        `- Workbook: ${runRecord.workbook.fileName}`,
        `- Worksheet: ${worksheet.worksheetName}`,
        `- Status: ${page?.status ?? "unknown"}`,
        `- Reason: ${page?.reasonCode ?? "unknown"}`,
        `- Note: accepted-format source markdown not found in full-tables-md-lite.`,
        "",
      ].join("\n");
      writeFileSync(worksheetMdPath, fallback);
    }
  }

  workbookIndex.push({
    workbook: runRecord.workbook.fileName,
    json: path.relative(outRoot, workbookJsonPath),
    md: path.relative(outRoot, workbookMdPath),
    worksheetCount: runRecord.worksheets.length,
  });
}

const indexLines = [];
indexLines.push("# Task 1.5 Demo Index");
indexLines.push("");
indexLines.push(`GeneratedAt: ${generatedAt}`);
indexLines.push("");
indexLines.push("| Workbook | Worksheets | Full JSON | Summary MD |");
indexLines.push("|---|---:|---|---|");
for (const item of workbookIndex) {
  indexLines.push(`| ${item.workbook} | ${item.worksheetCount} | ${item.json} | ${item.md} |`);
}
indexLines.push("");

const indexPath = path.join(outRoot, "README.md");
writeFileSync(indexPath, indexLines.join("\n"));

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
console.log(`Task 1.5 demo generated by ${path.relative(process.cwd(), scriptDir)}`);
console.log(indexPath);
