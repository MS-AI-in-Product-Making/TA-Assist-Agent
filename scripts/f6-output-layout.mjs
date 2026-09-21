import fs from "node:fs";
import path from "node:path";
import { createF6ReportFileNames } from "../packages/contracts/dist/index.js";
import {
  ANALYSIS_WORKSPACE_SUMMARY_FILE_NAME,
  resolveAnalysisWorkspaceStagePaths,
  validateAnalysisWorkspaceLayout,
  validateAnalysisWorkspaceSummary,
} from "../packages/workflow-runners/dist/index.js";
import { safeName } from "./f1-output-layout.mjs";

const DEFAULT_PUBLISH_ROOT = path.posix.join("test", "demo-output");
const LEGACY_DEMO_OUTPUT_ROOT = path.resolve("test", "demo-output");
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
    throw new Error(`Feature 6 ${label} is unsafe.`);
  }
  if (hasNonNativePathStyle(value)) {
    throw new Error(`Feature 6 ${label} must use a host-native path style and cannot be drive-relative.`);
  }
  return value;
}

function normalizedResultPath(value) {
  return path.isAbsolute(value) ? path.normalize(value) : value.replaceAll("\\", "/").replace(/\/+$/, "");
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

function resolvedCanonicalCandidate(value, dependencies) {
  const requested = path.resolve(value);
  if (dependencies.existsSync(requested)) return dependencies.realpathSync(requested);
  return resolveThroughNearestExistingAncestor(value);
}

function assertNotLegacyDemoOutputDestination(candidate, label, dependencies) {
  const requested = path.resolve(candidate);
  const canonicalLegacyRoot = dependencies.existsSync(LEGACY_DEMO_OUTPUT_ROOT)
    ? dependencies.realpathSync(LEGACY_DEMO_OUTPUT_ROOT)
    : LEGACY_DEMO_OUTPUT_ROOT;
  const canonicalCandidate = resolvedCanonicalCandidate(candidate, dependencies);
  if (isContained(LEGACY_DEMO_OUTPUT_ROOT, requested) || isContained(canonicalLegacyRoot, canonicalCandidate)) {
    throw new Error(`Feature 6 ${label} must not target legacy test/demo-output.`);
  }
}

function assertSameRoot(root, candidate) {
  const normalize = (value) => process.platform === "win32" ? value.toLowerCase() : value;
  if (normalize(path.parse(path.resolve(root)).root) !== normalize(path.parse(path.resolve(candidate)).root)) {
    throw new Error("Feature 6 publish, input, and output roots must use the same drive or UNC root.");
  }
}

function runStem(f5ArtifactRoot) {
  const sourceStem = path.posix.basename(validatePathValue(f5ArtifactRoot, "F5 artifact root").replaceAll("\\", "/").replace(/\/+$/, ""));
  const stem = safeName(sourceStem);
  if (!stem || stem === "." || stem === ".." || WINDOWS_RESERVED_NAME_PATTERN.test(stem)) {
    throw new Error("Feature 6 F5 output name is unsafe.");
  }
  return stem;
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
  return expected.requestedPath === actual.requestedPath
    && expected.canonicalPath === actual.canonicalPath
    && expected.requestedDev === actual.requestedDev
    && expected.requestedIno === actual.requestedIno
    && expected.canonicalDev === actual.canonicalDev
    && expected.canonicalIno === actual.canonicalIno;
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
  const analysisRootIdentity = captureDirectoryIdentity(resolvedRoot, "Feature 6 analysis workspace root", dependencies);
  if (analysisRootIdentity.canonicalPath !== path.resolve(layout.analysisRoot)) {
    throw new Error("Feature 6 analysis workspace root does not match the validated summary.");
  }
  const stageIdentities = {
    f2: captureDirectoryIdentity(layout.stagePaths.f2, "Feature 6 validated F2 stage path", dependencies),
    f3: captureDirectoryIdentity(layout.stagePaths.f3, "Feature 6 validated F3 stage path", dependencies),
    f4: captureDirectoryIdentity(layout.stagePaths.f4, "Feature 6 validated F4 stage path", dependencies),
    f5: captureDirectoryIdentity(layout.stagePaths.f5, "Feature 6 validated F5 stage path", dependencies),
    f6: captureDirectoryIdentity(layout.stagePaths.f6, "Feature 6 validated F6 stage path", dependencies),
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
    "Feature 6 analysis workspace root",
    (targetPath, identityLabel) => captureDirectoryIdentity(targetPath, identityLabel, dependencies),
  );
  const requestedIdentity = captureDirectoryIdentity(requestedStagePath, label, dependencies);
  if (!isContained(workspaceRootIdentity.canonicalPath, requestedIdentity.canonicalPath)
    || requestedIdentity.canonicalPath !== stageIdentity.canonicalPath
    || requestedIdentity.requestedDev !== stageIdentity.requestedDev
    || requestedIdentity.requestedIno !== stageIdentity.requestedIno
    || requestedIdentity.canonicalDev !== stageIdentity.canonicalDev
    || requestedIdentity.canonicalIno !== stageIdentity.canonicalIno) {
    throw new Error(`Feature 6 current workspace flow requires the exact validated ${label.match(/F\d/)?.[0] ?? "workspace"} stage path.`);
  }
  assertExpectedWorkspaceArtifact(stageIdentity, artifactFileName, label, dependencies);
}

export function resolveFeature6OutputLayout(parsed, outputRoot, now = () => new Date(), publishRoot, workbookFileName, dependencyOverrides = {}) {
  const dependencies = normalizedDependencies(dependencyOverrides);
  const roots = [parsed?.f2ArtifactRoot, parsed?.f3ArtifactRoot, parsed?.f4ArtifactRoot, parsed?.f5ArtifactRoot];
  roots.forEach((root, index) => validatePathValue(root, `F${index + 2} artifact root`));
  const resolvedWorkbookFileName = typeof workbookFileName === "function" ? workbookFileName() : workbookFileName;
  const reportNames = createF6ReportFileNames(resolvedWorkbookFileName);

  if (parsed?.analysisRoot !== undefined && outputRoot !== undefined) {
    throw new Error("Feature 6 analysis workspace root cannot be combined with an explicit output root.");
  }

  if (parsed?.analysisRoot !== undefined) {
    const workspace = resolveAnalysisWorkspace(parsed.analysisRoot, dependencies);
    assertNotLegacyDemoOutputDestination(workspace.layout.analysisRoot, "analysis workspace root", dependencies);
    assertNotLegacyDemoOutputDestination(workspace.layout.stagePaths.f6, "stage6 write root", dependencies);
    assertExactWorkspaceStage(parsed.f2ArtifactRoot, workspace.stageIdentities.f2, "Feature2-Report.json", "Feature 6 validated F2 stage path", workspace.analysisRootIdentity, dependencies);
    assertExactWorkspaceStage(parsed.f3ArtifactRoot, workspace.stageIdentities.f3, "Feature3-Report.json", "Feature 6 validated F3 stage path", workspace.analysisRootIdentity, dependencies);
    assertExactWorkspaceStage(parsed.f4ArtifactRoot, workspace.stageIdentities.f4, "Feature4-Calculation.json", "Feature 6 validated F4 stage path", workspace.analysisRootIdentity, dependencies);
    assertExactWorkspaceStage(parsed.f5ArtifactRoot, workspace.stageIdentities.f5, "Feature5-Report.json", "Feature 6 validated F5 stage path", workspace.analysisRootIdentity, dependencies);
    return {
      artifactSetVersion: "f6-artifact-set-v4",
      runId: now().toISOString().replace(/[:.]/g, "-"),
      runRoot: workspace.layout.stagePaths.f6,
      publishRoot: workspace.layout.analysisRoot,
      optimizationJsonName: "Feature6-Optimization.json",
      ...reportNames,
      runSummaryJsonName: "Feature6-Run-Summary.json",
      manifestName: "manifest.json",
      allowExistingRunRoot: true,
      workspaceBoundary: {
        publishRootIdentity: serializeIdentity(workspace.analysisRootIdentity),
        runRootIdentity: serializeIdentity(workspace.stageIdentities.f6),
      },
    };
  }

  const stem = runStem(parsed.f5ArtifactRoot);
  const controlledPublishRoot = outputRoot === undefined
    ? DEFAULT_PUBLISH_ROOT
    : validatePathValue(publishRoot, "publish root");
  if (outputRoot !== undefined && publishRoot === undefined) {
    throw new Error("Feature 6 output root override requires an explicit publish root.");
  }
  const outputBase = outputRoot === undefined
    ? path.posix.join(DEFAULT_PUBLISH_ROOT, "f6-runs", stem)
    : validatePathValue(outputRoot, "output root override");
  if (!dependencies.existsSync(path.resolve(controlledPublishRoot))) {
    throw new Error("Feature 6 publish root must exist before resolving output layout.");
  }
  if (dependencies.lstatSync(path.resolve(controlledPublishRoot)).isSymbolicLink()) {
    throw new Error("Feature 6 publish root must not be a link.");
  }
  assertNotLegacyDemoOutputDestination(controlledPublishRoot, "publish root", dependencies);
  assertNotLegacyDemoOutputDestination(outputBase, "output root", dependencies);
  for (const candidate of [...roots, outputBase]) assertSameRoot(controlledPublishRoot, candidate);
  const realPublishRoot = dependencies.realpathSync(path.resolve(controlledPublishRoot));
  const candidates = [...roots, outputBase].map(resolveThroughNearestExistingAncestor);
  if (candidates.some((candidate) => !isContained(realPublishRoot, candidate))) {
    throw new Error("Feature 6 input and output roots must remain inside the publish root.");
  }

  const runId = now().toISOString().replace(/[:.]/g, "-");
  const normalizedBase = normalizedResultPath(outputBase);
  return {
    artifactSetVersion: "f6-artifact-set-v4",
    runId,
    runRoot: path.isAbsolute(normalizedBase) ? path.join(normalizedBase, runId) : path.posix.join(normalizedBase, runId),
    publishRoot: normalizedResultPath(controlledPublishRoot),
    optimizationJsonName: "Feature6-Optimization.json",
    ...reportNames,
    runSummaryJsonName: "Feature6-Run-Summary.json",
    manifestName: "manifest.json",
    allowExistingRunRoot: false,
  };
}
