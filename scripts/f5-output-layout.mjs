import fs from "node:fs";
import path from "node:path";
import {
  ANALYSIS_WORKSPACE_SUMMARY_FILE_NAME,
  resolveAnalysisWorkspaceStagePaths,
  validateAnalysisWorkspaceLayout,
  validateAnalysisWorkspaceSummary,
} from "../packages/workflow-runners/dist/index.js";
import { safeName } from "./f1-output-layout.mjs";

const DEFAULT_PUBLISH_ROOT = path.posix.join("test", "demo-output");
const DEFAULT_OUTPUT_BASE = path.posix.join(DEFAULT_PUBLISH_ROOT, "f5-runs");
const WINDOWS_RESERVED_NAME_PATTERN = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;
const WINDOWS_DRIVE_RELATIVE_PATTERN = /^[A-Za-z]:(?![\\/])/;
const WINDOWS_DRIVE_ABSOLUTE_PATTERN = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC_PATTERN = /^[\\/]{2}[^\\/]/;

function hasControlCharacter(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 31 || (codePoint >= 127 && codePoint <= 159);
  });
}

function segments(value) {
  return value.replaceAll("\\", "/").split("/");
}

function hasUnsafeSegment(value) {
  return segments(value).some((segment) => {
    if (!segment) return false;
    const trimmed = segment.trim();
    const withoutTrailingDotsOrSpaces = segment.replace(/[. ]+$/u, "");
    return trimmed === "."
      || trimmed === ".."
      || /[. ]$/u.test(segment)
      || WINDOWS_RESERVED_NAME_PATTERN.test(withoutTrailingDotsOrSpaces);
  });
}

function hasNonNativePathStyle(value) {
  if (WINDOWS_DRIVE_RELATIVE_PATTERN.test(value)) return true;
  if (process.platform === "win32") {
    return value.startsWith("/") && !WINDOWS_UNC_PATTERN.test(value);
  }
  return WINDOWS_DRIVE_ABSOLUTE_PATTERN.test(value)
    || WINDOWS_UNC_PATTERN.test(value)
    || value.includes("\\");
}

function validatePathValue(value, label) {
  if (typeof value !== "string" || !value.trim() || hasControlCharacter(value) || hasUnsafeSegment(value)) {
    throw new Error(`Feature 5 ${label} is unsafe.`);
  }
  if (hasNonNativePathStyle(value)) {
    throw new Error(`Feature 5 ${label} must use a host-native path style and cannot be drive-relative.`);
  }
  return value;
}

function isNativeAbsolute(value) {
  return path.isAbsolute(value);
}

function normalizedResultPath(value) {
  if (isNativeAbsolute(value)) return path.normalize(value);
  return value.replaceAll("\\", "/").replace(/\/+$/, "");
}

function pathRoot(value) {
  const root = path.parse(path.resolve(value)).root;
  return process.platform === "win32" ? root.toLowerCase() : root;
}

function assertSameRoot(root, candidate) {
  if (pathRoot(root) !== pathRoot(candidate)) {
    throw new Error("Feature 5 publish and run roots must use the same drive or UNC root.");
  }
}

function resolveThroughNearestExistingAncestor(value) {
  const remainder = [];
  let ancestor = path.resolve(value);

  while (!fs.existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    remainder.unshift(path.basename(ancestor));
    ancestor = parent;
  }

  return path.join(fs.realpathSync(ancestor), ...remainder);
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function runStem(f4ArtifactRoot) {
  const validated = validatePathValue(f4ArtifactRoot, "F4 artifact root");
  const normalized = validated.replaceAll("\\", "/").replace(/\/+$/, "");
  const sourceStem = path.posix.basename(normalized);
  if (!sourceStem || sourceStem === "." || sourceStem === ".." || WINDOWS_RESERVED_NAME_PATTERN.test(sourceStem)) {
    throw new Error("Feature 5 F4 output name is unsafe.");
  }

  const stem = safeName(sourceStem);
  if (!stem || stem === "." || stem === ".." || hasControlCharacter(stem)
    || WINDOWS_RESERVED_NAME_PATTERN.test(stem)) {
    throw new Error("Feature 5 F4 output name is unsafe.");
  }
  return stem;
}

function appendRunId(outputBase, runId) {
  return isNativeAbsolute(outputBase)
    ? path.join(path.normalize(outputBase), runId)
    : path.posix.join(normalizedResultPath(outputBase), runId);
}

function outputRootOverride(value) {
  if (value === undefined) return undefined;
  return validatePathValue(value, "output root override");
}

function resolveAnalysisWorkspace(analysisRoot) {
  const resolvedRoot = path.resolve(analysisRoot);
  const summaryPath = path.join(resolvedRoot, ANALYSIS_WORKSPACE_SUMMARY_FILE_NAME);
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  validateAnalysisWorkspaceSummary(summary);
  const layout = {
    contractVersion: summary.contractVersion,
    analysisRoot: summary.analysisRoot,
    summaryPath: summary.summaryPath,
    workbookFileName: summary.workbook.fileName,
    workbookContentHash: summary.workbook.contentHash,
    allocationDate: summary.allocationDate,
    stagePaths: resolveAnalysisWorkspaceStagePaths(summary.analysisRoot),
  };
  validateAnalysisWorkspaceLayout(layout);
  if (path.resolve(layout.analysisRoot) !== resolvedRoot) {
    throw new Error("Feature 5 analysis workspace root does not match the validated summary.");
  }
  return layout;
}

export function resolveFeature5OutputLayout(parsed, outputRoot, now = () => new Date(), publishRoot) {
  const override = outputRootOverride(outputRoot);
  validatePathValue(parsed?.f1ArtifactRoot, "F1 artifact root");
  validatePathValue(parsed?.f3ArtifactRoot, "F3 artifact root");
  validatePathValue(parsed?.f4ArtifactRoot, "F4 artifact root");

  if (parsed?.analysisRoot !== undefined && override !== undefined) {
    throw new Error("Feature 5 analysis workspace root cannot be combined with an explicit output root.");
  }

  if (parsed?.analysisRoot !== undefined) {
    const layout = resolveAnalysisWorkspace(parsed.analysisRoot);
    if (path.resolve(parsed.f1ArtifactRoot) !== path.resolve(layout.stagePaths.f1)) {
      throw new Error("Feature 5 current workspace flow requires the exact validated F1 stage path.");
    }
    if (path.resolve(parsed.f3ArtifactRoot) !== path.resolve(layout.stagePaths.f3)) {
      throw new Error("Feature 5 current workspace flow requires the exact validated F3 stage path.");
    }
    if (path.resolve(parsed.f4ArtifactRoot) !== path.resolve(layout.stagePaths.f4)) {
      throw new Error("Feature 5 current workspace flow requires the exact validated F4 stage path.");
    }
    return {
      runId: now().toISOString().replace(/[:.]/g, "-"),
      runRoot: layout.stagePaths.f5,
      publishRoot: layout.analysisRoot,
      reportJsonName: "Feature5-Report.json",
      reportMdName: "Feature5-Report.md",
      runSummaryJsonName: "Feature5-Run-Summary.json",
      imageObservationsJsonName: "Feature5-Image-Observations.json",
      manifestName: "manifest.json",
      allowExistingRunRoot: true,
    };
  }

  const stem = runStem(parsed?.f4ArtifactRoot);

  let controlledPublishRoot;
  let outputBase;
  if (override === undefined) {
    controlledPublishRoot = DEFAULT_PUBLISH_ROOT;
    outputBase = path.posix.join(DEFAULT_OUTPUT_BASE, stem);
  } else {
    if (publishRoot === undefined) {
      throw new Error("Feature 5 output root override requires an explicit publish root.");
    }
    outputBase = override;
    controlledPublishRoot = validatePathValue(publishRoot, "publish root");
  }

  assertSameRoot(controlledPublishRoot, parsed.f1ArtifactRoot);
  assertSameRoot(controlledPublishRoot, outputBase);
  if (!fs.existsSync(path.resolve(controlledPublishRoot))) {
    throw new Error("Feature 5 publish root must exist before resolving output layout.");
  }

  const realPublishRoot = fs.realpathSync(path.resolve(controlledPublishRoot));
  const realF1ArtifactRoot = resolveThroughNearestExistingAncestor(parsed.f1ArtifactRoot);
  const realOutputBase = resolveThroughNearestExistingAncestor(outputBase);

  if (!isContained(realPublishRoot, realF1ArtifactRoot)
    || !isContained(realPublishRoot, realOutputBase)) {
    throw new Error("Feature 5 F1 and output roots must remain inside the publish root.");
  }

  const runId = now().toISOString().replace(/[:.]/g, "-");
  return {
    runId,
    runRoot: appendRunId(outputBase, runId),
    publishRoot: normalizedResultPath(controlledPublishRoot),
    reportJsonName: "Feature5-Report.json",
    reportMdName: "Feature5-Report.md",
    runSummaryJsonName: "Feature5-Run-Summary.json",
    imageObservationsJsonName: "Feature5-Image-Observations.json",
    manifestName: "manifest.json",
    allowExistingRunRoot: false,
  };
}