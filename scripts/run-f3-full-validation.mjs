import { parseF3CliArgs } from "./f3-cli-args.mjs";
import { resolveFeature3OutputLayout } from "./f3-output-layout.mjs";
import { runF3Analysis, normalizeRunnerError } from "../packages/workflow-runners/dist/index.js";
import { typedErrorSchema } from "../packages/contracts/dist/errors.js";

function safeTypedError(error) {
  const parsed = typedErrorSchema.safeParse(error);
  const typed = parsed.success ? parsed.data : normalizeRunnerError(error);
  return {
    code: typed.code,
    runId: typed.runId,
    summary: typed.summary,
    retryable: typed.retryable,
    suggestedAction: typed.suggestedAction,
    affectedInputReferences: [...typed.affectedInputReferences],
  };
}

try {
  const cliArgs = process.argv.slice(2);
  const { artifactRoot, selectedWorksheetNames } = parseF3CliArgs(cliArgs);
  const outputLayout = resolveFeature3OutputLayout([artifactRoot], process.env.AI_TVA_F3_OUTPUT_ROOT);
  const result = runF3Analysis({ artifactRoot, selectedWorksheetNames, outputRoot: outputLayout.outRoot }, {
    repositoryRoot: process.cwd(),
    managedOutputRoot: process.cwd(),
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
} catch (error) {
  console.error(JSON.stringify({ status: "failed", error: safeTypedError(error) }, null, 2));
  process.exitCode = 1;
}