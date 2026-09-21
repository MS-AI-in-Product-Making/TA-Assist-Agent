function requiredValue(args, index, option) {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--") || !value.trim()) {
    throw new Error(`${option} requires a nonempty value.`);
  }
  return value;
}

export function parseF5CliArgs(args) {
  if (args.length < 3 || args.slice(0, 3).some((value) => value.startsWith("--"))) {
    throw new Error("Feature 5 requires exactly three artifact roots before any options.");
  }

  const [f1ArtifactRoot, f3ArtifactRoot, f4ArtifactRoot] = args;
  if ([f1ArtifactRoot, f3ArtifactRoot, f4ArtifactRoot].some((value) => !value.trim())) {
    throw new Error("Feature 5 artifact roots must be nonempty.");
  }

  const selectedWorksheetNames = [];
  let imageObservationsPath;
  let analysisRoot;
  for (let index = 3; index < args.length; index += 1) {
    const option = args[index];
    if (!option.startsWith("--")) throw new Error(`Unexpected argument: ${option}`);

    if (option === "--worksheet") {
      const worksheetName = requiredValue(args, index, option).trim();
      if (selectedWorksheetNames.includes(worksheetName)) {
        throw new Error(`Feature 5 worksheet is duplicated: ${worksheetName}`);
      }
      selectedWorksheetNames.push(worksheetName);
      index += 1;
      continue;
    }

    if (option === "--image-observations") {
      if (imageObservationsPath !== undefined) {
        throw new Error("Feature 5 --image-observations option is duplicated.");
      }
      imageObservationsPath = requiredValue(args, index, option);
      index += 1;
      continue;
    }

    if (option === "--analysis-root") {
      if (analysisRoot !== undefined) {
        throw new Error("Feature 5 --analysis-root option is duplicated.");
      }
      analysisRoot = requiredValue(args, index, option);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${option}`);
  }

  return {
    f1ArtifactRoot,
    f3ArtifactRoot,
    f4ArtifactRoot,
    selectedWorksheetNames: selectedWorksheetNames.length > 0 ? selectedWorksheetNames : undefined,
    imageObservationsPath,
    analysisRoot,
  };
}