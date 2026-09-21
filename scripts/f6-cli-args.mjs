import { analysisRequestContextSchema } from "../packages/contracts/dist/analysis-request-context.js";

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

function parseAnalysisRequestContext(value) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Feature 6 --analysis-request-context must be valid JSON.");
  }
  const result = analysisRequestContextSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Feature 6 --analysis-request-context is invalid.");
  }
  return result.data;
}

export function parseF6CliArgs(args = []) {
  if (args.length < 4 || args.slice(0, 4).some((value) => value.startsWith("--"))) {
    throw new Error("Feature 6 requires exactly four artifact roots before any options.");
  }
  const [f2ArtifactRoot, f3ArtifactRoot, f4ArtifactRoot, f5ArtifactRoot] = args;
  if ([f2ArtifactRoot, f3ArtifactRoot, f4ArtifactRoot, f5ArtifactRoot].some((value) => !value.trim())) {
    throw new Error("Feature 6 artifact roots must be nonempty.");
  }

  const selectedWorksheetNames = [];
  let languageTag;
  let analysisRequestContext;
  let analysisRoot;
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
    } else if (option === "--analysis-request-context") {
      if (analysisRequestContext !== undefined) throw new Error("Feature 6 --analysis-request-context option is duplicated.");
      analysisRequestContext = parseAnalysisRequestContext(value);
    } else if (option === "--language") {
      if (languageTag !== undefined) throw new Error("Feature 6 --language option is duplicated.");
      languageTag = value.trim();
    } else if (option === "--analysis-root") {
      if (analysisRoot !== undefined) throw new Error("Feature 6 --analysis-root option is duplicated.");
      analysisRoot = value;
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
  if (languageTag === undefined) {
    throw new Error("Feature 6 requires one locked --language value.");
  }
  if (analysisRequestContext === undefined) {
    throw new Error("Feature 6 requires one governed --analysis-request-context value.");
  }
  if (optionalPaths.modelInterpretationArtifact === undefined) {
    throw new Error("Feature 6 requires one governed --model-interpretation artifact.");
  }

  return {
    f2ArtifactRoot,
    f3ArtifactRoot,
    f4ArtifactRoot,
    f5ArtifactRoot,
    analysisRequestContext,
    analysisRoot,
    selectedWorksheetNames,
    interactionLanguage: {
      languageTag,
      uiCatalogLanguage: languageTag.toLowerCase().startsWith("zh") ? "zh" : "en",
      lockedAtTurnId: "f6-cli",
      source: "workflow_start",
      fallbackUsed: false,
    },
    ...optionalPaths,
  };
}