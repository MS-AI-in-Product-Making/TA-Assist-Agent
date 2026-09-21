export function parseF3CliArgs(args) {
  if (args.length === 0 || args[0].startsWith("--")) {
    throw new Error("Feature 3 workflow requires exactly one Feature 2 artifact directory.");
  }

  const artifactRoot = args[0];
  const selectedWorksheetNames = [];
  let analysisRoot;
  for (let index = 1; index < args.length; index += 1) {
    const option = args[index];
    if (option === "--analysis-root") {
      const value = args[index + 1];
      if (analysisRoot !== undefined || value === undefined || value.startsWith("--") || value.length === 0) {
        throw new Error("--analysis-root requires one analysis workspace root.");
      }
      analysisRoot = value;
      index += 1;
      continue;
    }
    if (option !== "--worksheet") {
      if (option.startsWith("--")) throw new Error(`Unknown option: ${option}`);
      throw new Error(`Unexpected argument: ${option}`);
    }
    const worksheetName = args[index + 1];
    if (worksheetName === undefined || worksheetName.startsWith("--") || worksheetName.length === 0) {
      throw new Error("--worksheet requires a worksheet name.");
    }
    selectedWorksheetNames.push(worksheetName);
    index += 1;
  }

  return {
    artifactRoot,
    analysisRoot,
    selectedWorksheetNames: selectedWorksheetNames.length > 0 ? selectedWorksheetNames : undefined,
  };
}