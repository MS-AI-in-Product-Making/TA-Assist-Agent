import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createWorkbookCatalog } from "../packages/workbook-catalog/dist/workbook-catalog.js";
import { createWorksheetSelectionView } from "../packages/workbook-catalog/dist/worksheet-selection.js";
import { createWorksheetAnalysisAssetsParallel } from "../packages/workbook-catalog/dist/worksheet-analysis-assets.js";
import { createF2InitialWorkflow } from "../packages/workbook-catalog/dist/f2-initial-workflow.js";
import { resolveFeature2OutputLayout } from "./f2-output-layout.mjs";
import { renderF2Report } from "./f2-report.mjs";

const cliArgs = process.argv.slice(2);
const outputLayout = resolveFeature2OutputLayout(cliArgs);
const workbookPath = cliArgs[0];
if (!existsSync(workbookPath)) throw new Error(`Feature 2 workbook does not exist: ${workbookPath}`);

const workbookBytes = new Uint8Array(readFileSync(workbookPath));
const workbookCatalog = createWorkbookCatalog({
  contractVersion: "v1",
  fileName: path.basename(workbookPath),
  inputClassification: "confidential",
  workbookBytes,
});
const selectionView = createWorksheetSelectionView({
  contractVersion: "v1",
  inputClassification: "confidential",
  workbookCatalog,
});
const selectedWorksheetNames = selectionView.worksheets.map((worksheet) => worksheet.worksheetName);
const parallelAssets = await createWorksheetAnalysisAssetsParallel({
  contractVersion: "v1",
  inputClassification: "confidential",
  workbookBytes,
  workbookCatalog,
  worksheetSelection: { mode: "selected", worksheetNames: selectedWorksheetNames },
});
const failedPages = parallelAssets.pages.filter((page) => page.status === "failed");
if (failedPages.length > 0) {
  throw new Error(`Feature 1 worksheet extraction failed: ${failedPages.map((page) => page.worksheetName).join(", ")}`);
}

const f2Result = createF2InitialWorkflow({
  contractVersion: "v1",
  inputClassification: "confidential",
  knowledgeBaseVersion: "v1",
  mappingRuleVersion: "v1",
  toleranceUnitAssumption: "mm",
  worksheetAnalysisAssets: parallelAssets.assets,
});

rmSync(outputLayout.outRoot, { recursive: true, force: true });
mkdirSync(outputLayout.outRoot, { recursive: true });
writeFileSync(path.join(outputLayout.outRoot, outputLayout.reportJsonName), `${JSON.stringify(f2Result, null, 2)}\n`, "utf8");
writeFileSync(path.join(outputLayout.outRoot, outputLayout.reportMdName), `${renderF2Report(f2Result, path.basename(workbookPath))}\n`, "utf8");

console.log(JSON.stringify({
  status: f2Result.status,
  outputDirectory: outputLayout.outRoot,
  summary: f2Result.summary,
}, null, 2));