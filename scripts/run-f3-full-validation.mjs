import { parseF3CliArgs } from "./f3-cli-args.mjs";
import { runF3Analysis } from "../packages/workflow-runners/dist/index.js";

const cliArgs = process.argv.slice(2);
const { artifactRoot, selectedWorksheetNames } = parseF3CliArgs(cliArgs);
const result = runF3Analysis({ artifactRoot, selectedWorksheetNames, outputRoot: process.env.AI_TVA_F3_OUTPUT_ROOT }, {
  repositoryRoot: process.cwd(),
  managedOutputRoot: process.env.AI_TVA_F3_OUTPUT_ROOT ?? "test/demo-output/feature3-output",
  attemptId: crypto.randomUUID(),
  signal: new AbortController().signal,
  emit: () => {},
});

console.log(JSON.stringify({
  status: result.status,
  outputDirectory: result.outputDirectory,
  reportJsonPath: result.reportJsonPath,
  reportMdPath: result.reportMdPath,
  ...(result.reminderMdPath ? { reminderMdPath: result.reminderMdPath, historyHtmlPath: result.historyHtmlPath } : {}),
  ...(result.report.status === "input_rejected" ? { artifactIssues: result.report.artifactIssues } : { summary: result.report.summary }),
}, null, 2));