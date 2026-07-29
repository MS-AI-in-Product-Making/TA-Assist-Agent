import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  createWorkbookCatalog,
  createSemanticTableDetection,
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

const outRoot = "test/demo-output/task1.7";
const outJsonDir = path.join(outRoot, "json");
const outMdDir = path.join(outRoot, "md");
mkdirSync(outJsonDir, { recursive: true });
mkdirSync(outMdDir, { recursive: true });

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

function buildWorksheetMd(workbookFileName, detection) {
  const lines = [];
  lines.push(`# Task 1.7 Semantic Detection - ${workbookFileName}`);
  lines.push("");
  lines.push("| worksheet | status | confidence | requiresUserConfirmation | reasons | candidate | action | dataRange |");
  lines.push("|---|---|---:|---|---|---|---|---|");

  for (const row of detection.worksheets) {
    const payload = row.confirmationPayload;
    const dataRange = payload ? `${payload.dataRange.startRow}-${payload.dataRange.endRow}` : "n/a";
    lines.push(
      `| ${mdEscape(row.worksheetName)} | ${row.recognitionStatus} | ${row.confidenceScore} | ${row.requiresUserConfirmation} | ${mdEscape(row.uncertaintyReasons.join(", "))} | ${mdEscape(payload?.candidateId ?? "n/a")} | ${mdEscape(payload?.recommendedAction ?? "n/a")} | ${mdEscape(dataRange)} |`,
    );
  }

  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- worksheetCount: ${detection.summary.worksheetCount}`);
  lines.push(`- autoConfirmedCount: ${detection.summary.autoConfirmedCount}`);
  lines.push(`- manualConfirmedCount: ${detection.summary.manualConfirmedCount}`);
  lines.push(`- pendingConfirmationCount: ${detection.summary.pendingConfirmationCount}`);
  lines.push(`- blockedCount: ${detection.summary.blockedCount}`);
  lines.push("");

  return lines.join("\n");
}

const indexRows = [];

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

  const detection = createSemanticTableDetection({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbookBytes,
    workbookCatalog,
    worksheetSelection: { mode: "selected", worksheetNames: selectedNames },
  });

  const safeWorkbook = safeName(workbookCatalog.workbook.fileName);
  const jsonPath = path.join(outJsonDir, `${safeWorkbook}.task1.7.semantic.full.json`);
  const mdPath = path.join(outMdDir, `${safeWorkbook}.task1.7.semantic.summary.md`);

  writeFileSync(jsonPath, JSON.stringify(detection, null, 2));
  writeFileSync(mdPath, buildWorksheetMd(workbookCatalog.workbook.fileName, detection));

  indexRows.push({
    workbook: workbookCatalog.workbook.fileName,
    json: toPosix(path.relative(outRoot, jsonPath)),
    md: toPosix(path.relative(outRoot, mdPath)),
    summary: detection.summary,
  });

  // If there is no pending or blocked worksheet, synthesize one manual-check hint.
  if (detection.summary.pendingConfirmationCount + detection.summary.blockedCount === 0) {
    const firstWorksheet = detection.worksheets[0];
    if (firstWorksheet) {
      const warningPath = path.join(outMdDir, `${safeWorkbook}.task1.7.semantic.warning.md`);
      writeFileSync(
        warningPath,
        [
          `# Task 1.7 Warning - ${workbookCatalog.workbook.fileName}`,
          "",
          "This run has no pending or blocked worksheets.",
          "To validate human-in-the-loop behavior, rerun with a workbook version that contains irregular headers or duplicated required fields.",
          "",
          `- firstWorksheet: ${firstWorksheet.worksheetName}`,
          `- firstStatus: ${firstWorksheet.recognitionStatus}`,
        ].join("\n"),
      );
    }
  }
}

const indexMd = [
  "# Task 1.7 Demo Index",
  "",
  "| workbook | json | summary |",
  "|---|---|---|",
  ...indexRows.map((row) => `| ${mdEscape(row.workbook)} | [json](${mdEscape(row.json)}) / [md](${mdEscape(row.md)}) | auto=${row.summary.autoConfirmedCount}, manual=${row.summary.manualConfirmedCount}, pending=${row.summary.pendingConfirmationCount}, blocked=${row.summary.blockedCount} |`),
  "",
].join("\n");

writeFileSync(path.join(outRoot, "README.md"), indexMd);
console.log(`Task 1.7 demo completed. Outputs: ${outRoot}`);
