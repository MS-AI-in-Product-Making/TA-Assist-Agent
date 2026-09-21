import path from "node:path";
import { safeName } from "./f1-output-layout.mjs";

const F2_STAGE_DIR = "02 - F2 Data Cleaning";
const F3_STAGE_DIR = "03 - F3 Drawing Governance";

function outputRootOverride(value) {
  if (value === undefined) return undefined;
  if (!value.trim() || value.split(/[\\/]+/).includes("..")) throw new Error("Feature 3 output root override is unsafe.");
  return value;
}

function canonicalWorkspaceStageRoot(artifactRoot) {
  const normalizedArtifactRoot = path.normalize(artifactRoot);
  if (path.basename(normalizedArtifactRoot) !== F2_STAGE_DIR) return undefined;
  return path.join(path.dirname(normalizedArtifactRoot), F3_STAGE_DIR);
}

export function resolveFeature3OutputLayout(args, outputRoot) {
  const override = outputRootOverride(outputRoot);
  if (args.length !== 1) {
    throw new Error("Feature 3 workflow requires exactly one Feature 2 artifact directory.");
  }
  if (/\.xls[xm]?$/i.test(args[0])) throw new Error("Feature 3 requires a Feature 2 artifact directory, not an Excel workbook.");
  const artifactName = safeName(path.basename(path.normalize(args[0])));
  if (!artifactName) throw new Error("Feature 3 artifact output name is empty.");
  const workspaceStageRoot = override === undefined ? canonicalWorkspaceStageRoot(args[0]) : undefined;
  return {
    outRoot: workspaceStageRoot ?? override ?? path.posix.join("test", "demo-output", "feature3-output", artifactName),
    reportJsonName: "Feature3-Report.json",
    reportMdName: "Feature3-Report.md",
  };
}