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

function isWorkspaceStageNotEmpty(error) {
  return error?.code === "prerequisite_not_ready" && error?.reasonCode === "workspace_stage_not_empty";
}

try {
  const cliArgs = process.argv.slice(2);
  const { artifactRoot, analysisRoot, selectedWorksheetNames } = parseF3CliArgs(cliArgs);
  const outputLayout = resolveFeature3OutputLayout([artifactRoot], process.env.AI_TVA_F3_OUTPUT_ROOT, analysisRoot);
  const result = runF3Analysis({ artifactRoot, selectedWorksheetNames, outputRoot: outputLayout.outRoot }, {
    repositoryRoot: process.cwd(),
    managedOutputRoot: process.cwd(),
    attemptId: crypto.randomUUID(),
    signal: new AbortController().signal,
    emit: () => {},
  }, {
    resolveOutputLayout: () => outputLayout,
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
  if (isWorkspaceStageNotEmpty(error)) {
    console.log(JSON.stringify({ status: "failed", reasonCode: "workspace_stage_not_empty" }, null, 2));
    process.exitCode = 1;
  } else {
    console.error(JSON.stringify({ status: "failed", error: safeTypedError(error) }, null, 2));
    process.exitCode = 1;
  }
}