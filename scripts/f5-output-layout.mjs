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

function normalizedDependencies(overrides = {}) {
  return {
    existsSync: overrides.existsSync ?? fs.existsSync,
    readFileSync: overrides.readFileSync ?? fs.readFileSync,
    lstatSync: overrides.lstatSync ?? fs.lstatSync,
    statSync: overrides.statSync ?? fs.statSync,
    realpathSync: overrides.realpathSync ?? fs.realpathSync,
  };
}

function isIdentityEqual(expected, actual) {
  return expected.requestedDev === actual.requestedDev
    && expected.requestedIno === actual.requestedIno
    && expected.canonicalDev === actual.canonicalDev
    && expected.canonicalIno === actual.canonicalIno
    && expected.canonicalPath === actual.canonicalPath;
}

function serializeIdentity(identity) {
  return {
    requestedPath: identity.requestedPath,
    canonicalPath: identity.canonicalPath,
    requestedDev: identity.requestedDev,
    requestedIno: identity.requestedIno,
    canonicalDev: identity.canonicalDev,
    canonicalIno: identity.canonicalIno,
  };
}

function captureDirectoryIdentity(targetPath, label, dependencies) {
  const requestedPath = path.resolve(targetPath);
  if (!dependencies.existsSync(requestedPath)) {
    throw new Error(`${label} is missing.`);
  }
  const requestedStats = dependencies.lstatSync(requestedPath);
  if (!requestedStats.isDirectory()) {
    throw new Error(`${label} is invalid.`);
  }
  const canonicalPath = dependencies.realpathSync(requestedPath);
  const canonicalStats = dependencies.statSync(canonicalPath);
  if (!canonicalStats.isDirectory()) {
    throw new Error(`${label} is invalid.`);
  }
  return {
    requestedPath,
    canonicalPath,
    requestedDev: requestedStats.dev,
    requestedIno: requestedStats.ino,
    canonicalDev: canonicalStats.dev,
    canonicalIno: canonicalStats.ino,
  };
}

function captureFileIdentity(targetPath, label, dependencies) {
  const requestedPath = path.resolve(targetPath);
  if (!dependencies.existsSync(requestedPath)) {
    throw new Error(`${label} is missing.`);
  }
  const requestedStats = dependencies.lstatSync(requestedPath);
  if (!requestedStats.isFile()) {
    throw new Error(`${label} is invalid.`);
  }
  const canonicalPath = dependencies.realpathSync(requestedPath);
  const canonicalStats = dependencies.statSync(canonicalPath);
  if (!canonicalStats.isFile()) {
    throw new Error(`${label} is invalid.`);
  }
  return {
    requestedPath,
    canonicalPath,
    requestedDev: requestedStats.dev,
    requestedIno: requestedStats.ino,
    canonicalDev: canonicalStats.dev,
    canonicalIno: canonicalStats.ino,
  };
}

function assertIdentityUnchanged(expected, label, capture) {
  const current = capture(expected.requestedPath, label);
  if (!isIdentityEqual(expected, current)) {
    throw new Error(`${label} changed during validation.`);
  }
  return current;
}

function outputRootOverride(value) {
  if (value === undefined) return undefined;
  return validatePathValue(value, "output root override");
}

function resolveAnalysisWorkspace(analysisRoot, dependencies) {
  const resolvedRoot = path.resolve(analysisRoot);
  const summaryPath = path.join(resolvedRoot, ANALYSIS_WORKSPACE_SUMMARY_FILE_NAME);
  const summary = JSON.parse(dependencies.readFileSync(summaryPath, "utf8"));
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
  const analysisRootIdentity = captureDirectoryIdentity(resolvedRoot, "Feature 5 analysis workspace root", dependencies);
  if (analysisRootIdentity.canonicalPath !== path.resolve(layout.analysisRoot)) {
    throw new Error("Feature 5 analysis workspace root does not match the validated summary.");
  }
  const stageIdentities = {
    f1: captureDirectoryIdentity(layout.stagePaths.f1, "Feature 5 validated F1 stage path", dependencies),
    f2: captureDirectoryIdentity(layout.stagePaths.f2, "Feature 5 validated F2 stage path", dependencies),
    f3: captureDirectoryIdentity(layout.stagePaths.f3, "Feature 5 validated F3 stage path", dependencies),
    f4: captureDirectoryIdentity(layout.stagePaths.f4, "Feature 5 validated F4 stage path", dependencies),
    f5: captureDirectoryIdentity(layout.stagePaths.f5, "Feature 5 validated F5 stage path", dependencies),
    f6: captureDirectoryIdentity(layout.stagePaths.f6, "Feature 5 validated F6 stage path", dependencies),
  };
  return { layout, analysisRootIdentity, stageIdentities };
}

function assertExpectedWorkspaceArtifact(stageIdentity, artifactFileName, label, dependencies) {
  const currentStageIdentity = assertIdentityUnchanged(
    stageIdentity,
    label,
    (targetPath, identityLabel) => captureDirectoryIdentity(targetPath, identityLabel, dependencies),
  );
  if (currentStageIdentity.canonicalPath !== stageIdentity.canonicalPath) {
    throw new Error(`${label} changed during validation.`);
  }
  const artifactIdentity = captureFileIdentity(path.join(stageIdentity.requestedPath, artifactFileName), `${label} artifact`, dependencies);
  if (!isContained(stageIdentity.canonicalPath, artifactIdentity.canonicalPath)) {
    throw new Error(`${label} artifact escaped the validated stage.`);
  }
  const expectedArtifactPath = path.join(stageIdentity.canonicalPath, artifactFileName);
  if (artifactIdentity.canonicalPath !== expectedArtifactPath) {
    throw new Error(`${label} artifact is invalid.`);
  }
}

function assertExactWorkspaceStage(requestedStagePath, stageIdentity, artifactFileName, label, workspaceRootIdentity, dependencies) {
  assertIdentityUnchanged(
    workspaceRootIdentity,
    "Feature 5 analysis workspace root",
    (targetPath, identityLabel) => captureDirectoryIdentity(targetPath, identityLabel, dependencies),
  );
  const requestedIdentity = captureDirectoryIdentity(requestedStagePath, label, dependencies);
  if (!isContained(workspaceRootIdentity.canonicalPath, requestedIdentity.canonicalPath)
    || requestedIdentity.canonicalPath !== stageIdentity.canonicalPath
    || requestedIdentity.requestedDev !== stageIdentity.requestedDev
    || requestedIdentity.requestedIno !== stageIdentity.requestedIno
    || requestedIdentity.canonicalDev !== stageIdentity.canonicalDev
    || requestedIdentity.canonicalIno !== stageIdentity.canonicalIno) {
    throw new Error(`Feature 5 current workspace flow requires the exact validated ${label.match(/F\d/)?.[0] ?? "workspace"} stage path.`);
  }
  assertExpectedWorkspaceArtifact(stageIdentity, artifactFileName, label, dependencies);
}

export function resolveFeature5OutputLayout(parsed, outputRoot, now = () => new Date(), publishRoot, dependencyOverrides = {}) {
  const dependencies = normalizedDependencies(dependencyOverrides);
  const override = outputRootOverride(outputRoot);
  validatePathValue(parsed?.f1ArtifactRoot, "F1 artifact root");
  validatePathValue(parsed?.f3ArtifactRoot, "F3 artifact root");
  validatePathValue(parsed?.f4ArtifactRoot, "F4 artifact root");

  if (parsed?.analysisRoot !== undefined && override !== undefined) {
    throw new Error("Feature 5 analysis workspace root cannot be combined with an explicit output root.");
  }

  if (parsed?.analysisRoot !== undefined) {
    const workspace = resolveAnalysisWorkspace(parsed.analysisRoot, dependencies);
    assertExactWorkspaceStage(parsed.f1ArtifactRoot, workspace.stageIdentities.f1, "Feature1-Report.json", "Feature 5 validated F1 stage path", workspace.analysisRootIdentity, dependencies);
    assertExactWorkspaceStage(parsed.f3ArtifactRoot, workspace.stageIdentities.f3, "Feature3-Report.json", "Feature 5 validated F3 stage path", workspace.analysisRootIdentity, dependencies);
    assertExactWorkspaceStage(parsed.f4ArtifactRoot, workspace.stageIdentities.f4, "Feature4-Calculation.json", "Feature 5 validated F4 stage path", workspace.analysisRootIdentity, dependencies);
    return {
      runId: now().toISOString().replace(/[:.]/g, "-"),
      runRoot: workspace.layout.stagePaths.f5,
      publishRoot: workspace.layout.analysisRoot,
      reportJsonName: "Feature5-Report.json",
      reportMdName: "Feature5-Report.md",
      runSummaryJsonName: "Feature5-Run-Summary.json",
      imageObservationsJsonName: "Feature5-Image-Observations.json",
      manifestName: "manifest.json",
      allowExistingRunRoot: true,
      workspaceBoundary: {
        publishRootIdentity: serializeIdentity(workspace.analysisRootIdentity),
        runRootIdentity: serializeIdentity(workspace.stageIdentities.f5),
      },
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
  if (!dependencies.existsSync(path.resolve(controlledPublishRoot))) {
    throw new Error("Feature 5 publish root must exist before resolving output layout.");
  }

  const realPublishRoot = dependencies.realpathSync(path.resolve(controlledPublishRoot));
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