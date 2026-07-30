import path from "node:path";

export function safeName(value) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
}

export function resolveFeature1OutputLayout(args, runId) {
  if (args.length === 0) {
    return {
      mode: "batch",
      outRoot: "test/demo-output/feature1-validation",
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
    outRoot: path.posix.join("test", "demo-output", "feature1-output", workbookName),
    reportMdName: "Feature1-Report.md",
    reportJsonName: "Feature1-Report.json",
    resetOutputRoot: true,
  };
}