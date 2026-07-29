export function resolveFeature1Jobs(args, configuredJobs) {
  if (args.length > 1) {
    throw new Error("Feature 1 workflow accepts at most one workbook path.");
  }

  if (args.length === 1) {
    return [{ workbookPath: args[0] }];
  }

  return configuredJobs;
}