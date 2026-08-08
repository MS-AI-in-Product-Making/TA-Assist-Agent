import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createF3DrawingGovernance } from "../packages/workbook-catalog/dist/f3-drawing-governance.js";
import { loadF2ArtifactBundle } from "./f3-artifact-loader.mjs";
import { parseF3CliArgs } from "./f3-cli-args.mjs";
import { resolveFeature3OutputLayout } from "./f3-output-layout.mjs";
import { renderF3Report } from "./f3-report.mjs";

function atomicWrite(filePath, content) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, content, "utf8");
  renameSync(temporaryPath, filePath);
}

const cliArgs = process.argv.slice(2);
const { artifactRoot, selectedWorksheetNames } = parseF3CliArgs(cliArgs);
const outputLayout = resolveFeature3OutputLayout([artifactRoot], process.env.AI_TVA_F3_OUTPUT_ROOT);
const loaded = loadF2ArtifactBundle(artifactRoot, { selectedWorksheetNames });
const report = loaded.status === "accepted"
  ? createF3DrawingGovernance(loaded.request)
  : loaded.report;

mkdirSync(outputLayout.outRoot, { recursive: true });
const reportJsonPath = path.join(outputLayout.outRoot, outputLayout.reportJsonName);
const reportMdPath = path.join(outputLayout.outRoot, outputLayout.reportMdName);
atomicWrite(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
atomicWrite(reportMdPath, renderF3Report(report, { outputRoot: outputLayout.outRoot }));

console.log(JSON.stringify({
  status: report.status,
  outputDirectory: outputLayout.outRoot,
  reportJsonPath,
  reportMdPath,
  ...(report.status === "input_rejected" ? { artifactIssues: report.artifactIssues } : { summary: report.summary }),
}, null, 2));