import path from "node:path";

export function safeName(value) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
}

function outputRootOverride(value) {
  if (value === undefined) return undefined;
  if (!value.trim() || value.split(/[\\/]+/).includes("..")) throw new Error("Feature 1 output root override is unsafe.");
  return value;
}

export function resolveFeature1OutputLayout(args, runId, outputRoot) {
  const override = outputRootOverride(outputRoot);
  if (args.length === 0) {
    return {
      mode: "batch",
      outRoot: override ?? "test/demo-output/feature1-validation",
      reportMdName: `f1-strict-workflow-${runId}.md`,
      reportJsonName: `f1-strict-workflow-${runId}.json`,
      latestMdName: "latest.md",
      latestJsonName: "latest.json",
      resetOutputRoot: false,
    };
  }

  if (args.length !== 1) {
    throw new Error("Feature 1 output layout accepts at most one workbook path.");
  }

  const extension = path.extname(args[0]);
  const workbookName = safeName(path.basename(args[0], extension));
  if (!workbookName) {
    throw new Error("Feature 1 workbook output name is empty.");
  }

  return {
    mode: "single",
    outRoot: override ?? path.posix.join("test", "demo-output", "feature1-output", workbookName),
    reportMdName: "Feature1-Report.md",
    reportJsonName: "Feature1-Report.json",
    resetOutputRoot: true,
  };
}