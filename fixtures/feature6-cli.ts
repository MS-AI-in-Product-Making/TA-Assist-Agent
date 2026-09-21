import { writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  allocateAnalysisWorkspace, createInitialAnalysisWorkspaceSummary,
  recordAnalysisStageCompleted, recordAnalysisStageStarted, writeAnalysisWorkspaceSummary,
} from "@ai-assist/workflow-runners";

// Command-boundary tests supply completed upstream fixtures; the real runner
// integration test separately exercises artifact and candidate validation.
export function createFeature6CliWorkspace(testRoot: string) {
  const layout = allocateAnalysisWorkspace({
    testRoot, workbookFileName: "Anonymous.xlsx", workbookContentHash: "a".repeat(64),
    now: new Date("2026-09-22T12:00:00Z"),
  });
  let summary = createInitialAnalysisWorkspaceSummary(layout);
  for (const [stage, name] of [
    ["f1", "Feature1-Report.json"], ["f2", "Feature2-Report.json"],
    ["f3", "Feature3-Report.json"], ["f4", "Feature4-Calculation.json"], ["f5", "Feature5-Report.json"],
  ] as const) {
    const reportPath = join(layout.stagePaths[stage], name);
    writeFileSync(reportPath, "{}");
    summary = recordAnalysisStageCompleted(recordAnalysisStageStarted(summary, stage), stage, {
      report: relative(layout.analysisRoot, reportPath).split(sep).join("/"),
    });
  }
  writeAnalysisWorkspaceSummary(layout, summary);
  return layout;
}
