function requiredValue(args, index, option) {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--") || !value.trim()) {
    throw new Error(`${option} requires a nonempty value.`);
  }
  return value;
}

const OPTIONAL_PATHS = Object.freeze({
  "--supplier-capability": "supplierCapabilityArtifact",
  "--datum-strategy": "datumStrategyArtifact",
  "--cost": "costArtifact",
  "--image-observations": "imageObservationArtifact",
  "--analysis-context": "analysisContextArtifact",
  "--optimization-targets": "optimizationTargetsArtifact",
  "--model-interpretation": "modelInterpretationArtifact",
});

export function parseF6CliArgs(args = []) {
  if (args.length < 4 || args.slice(0, 4).some((value) => value.startsWith("--"))) {
    throw new Error("Feature 6 requires exactly four artifact roots before any options.");
  }
  const [f2ArtifactRoot, f3ArtifactRoot, f4ArtifactRoot, f5ArtifactRoot] = args;
  if ([f2ArtifactRoot, f3ArtifactRoot, f4ArtifactRoot, f5ArtifactRoot].some((value) => !value.trim())) {
    throw new Error("Feature 6 artifact roots must be nonempty.");
  }

  const selectedWorksheetNames = [];
  const optionalPaths = Object.fromEntries(Object.values(OPTIONAL_PATHS).map((field) => [field, undefined]));
  for (let index = 4; index < args.length; index += 1) {
    const option = args[index];
    if (!option.startsWith("--")) throw new Error(`Unexpected argument: ${option}`);
    const value = requiredValue(args, index, option);
    if (option === "--worksheet") {
      const worksheetName = value.trim();
      if (selectedWorksheetNames.includes(worksheetName)) {
        throw new Error(`Feature 6 worksheet is duplicated: ${worksheetName}`);
      }
      selectedWorksheetNames.push(worksheetName);
    } else if (OPTIONAL_PATHS[option] !== undefined) {
      const field = OPTIONAL_PATHS[option];
      if (optionalPaths[field] !== undefined) throw new Error(`Feature 6 ${option} option is duplicated.`);
      optionalPaths[field] = value;
    } else {
      throw new Error(`Unknown option: ${option}`);
    }
    index += 1;
  }

  if (selectedWorksheetNames.length === 0) {
    throw new Error("Feature 6 requires at least one --worksheet selection.");
  }

  return {
    f2ArtifactRoot,
    f3ArtifactRoot,
    f4ArtifactRoot,
    f5ArtifactRoot,
    selectedWorksheetNames,
    ...optionalPaths,
  };
}