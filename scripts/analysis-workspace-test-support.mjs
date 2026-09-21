import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { recordAnalysisStageCompleted, recordAnalysisStageStarted } from "../packages/workflow-runners/dist/index.js";

// Older stage-level fixtures represent validated upstream runs, not a fresh
// allocation. Supply their source identity and explicit predecessor transitions.
export function prepareWorkspaceStage(workspace, stage) {
  const summaryPath = path.join(workspace.analysisRoot, "analysis-run-summary.json");
  let summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const f1Path = path.join(workspace.stagePaths.f1, "Feature1-Report.json");
  if (existsSync(f1Path)) {
    summary.workbook.fileName = JSON.parse(readFileSync(f1Path, "utf8")).workbooks[0].workbook.fileName;
    writeFileSync(summaryPath, JSON.stringify(summary));
  }
  const workbookPath = path.join(path.dirname(workspace.analysisRoot), summary.workbook.fileName);
  writeFileSync(workbookPath, "controlled workbook fixture");
  const oldHash = summary.workbook.contentHash;
  const contentHash = createHash("sha256").update(readFileSync(workbookPath)).digest("hex");
  function updateJson(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) updateJson(target);
      else if (entry.name.endsWith(".json")) {
        writeFileSync(target, readFileSync(target, "utf8").replaceAll(oldHash, contentHash));
      }
    }
  }
  updateJson(workspace.analysisRoot);
  summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const f1 = existsSync(f1Path) ? JSON.parse(readFileSync(f1Path, "utf8")) : { workbooks: [{ workbook: summary.workbook }] };
  f1.workbooks[0].workbookPath = workbookPath;
  writeFileSync(f1Path, JSON.stringify(f1));
  for (const predecessor of Object.keys(workspace.stagePaths).slice(0, Object.keys(workspace.stagePaths).indexOf(stage))) {
    const evidence = path.join(workspace.stagePaths[predecessor], "upstream-fixture.json");
    writeFileSync(evidence, "{}");
    summary = recordAnalysisStageCompleted(recordAnalysisStageStarted(summary, predecessor), predecessor,
      { fixture: path.relative(workspace.analysisRoot, evidence).split(path.sep).join("/") });
  }
  writeFileSync(summaryPath, JSON.stringify(summary));
}
