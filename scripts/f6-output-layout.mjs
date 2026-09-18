import fs from "node:fs";
import path from "node:path";
import { createF6ReportFileNames } from "../packages/contracts/dist/index.js";
import { safeName } from "./f1-output-layout.mjs";

const DEFAULT_PUBLISH_ROOT = path.posix.join("test", "demo-output");
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

function validatePathValue(value, label) {
  if (typeof value !== "string" || !value.trim() || hasControlCharacter(value)) {
    throw new Error(`Feature 6 ${label} is unsafe.`);
  }
  for (const segment of value.replaceAll("\\", "/").split("/")) {
    const stem = segment.replace(/[. ]+$/u, "");
    if ([".", ".."].includes(segment.trim()) || /[. ]$/u.test(segment) || WINDOWS_RESERVED_NAME_PATTERN.test(stem)) {
      throw new Error(`Feature 6 ${label} is unsafe.`);
    }
  }
  if (WINDOWS_DRIVE_RELATIVE_PATTERN.test(value)
    || (process.platform === "win32" && value.startsWith("/") && !WINDOWS_UNC_PATTERN.test(value))
    || (process.platform !== "win32" && (WINDOWS_DRIVE_ABSOLUTE_PATTERN.test(value) || WINDOWS_UNC_PATTERN.test(value) || value.includes("\\")))) {
    throw new Error(`Feature 6 ${label} must use a host-native path style.`);
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

function assertSameRoot(root, candidate) {
  const normalize = (value) => process.platform === "win32" ? value.toLowerCase() : value;
  if (normalize(path.parse(path.resolve(root)).root) !== normalize(path.parse(path.resolve(candidate)).root)) {
    throw new Error("Feature 6 publish, input, and output roots must use the same drive or UNC root.");
  }
}

function runStem(f5ArtifactRoot) {
  validatePathValue(f5ArtifactRoot, "F5 artifact root");
  const sourceStem = path.posix.basename(f5ArtifactRoot.replaceAll("\\", "/").replace(/\/+$/, ""));
  const stem = safeName(sourceStem);
  if (!stem || stem === "." || stem === ".." || WINDOWS_RESERVED_NAME_PATTERN.test(stem)) {
    throw new Error("Feature 6 F5 output name is unsafe.");
  }
  return stem;
}

export function resolveFeature6OutputLayout(parsed, outputRoot, now = () => new Date(), publishRoot, workbookFileName) {
  const roots = [parsed?.f2ArtifactRoot, parsed?.f3ArtifactRoot, parsed?.f4ArtifactRoot, parsed?.f5ArtifactRoot];
  roots.forEach((root, index) => validatePathValue(root, `F${index + 2} artifact root`));
  const reportNames = createF6ReportFileNames(workbookFileName);
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
  if (!fs.existsSync(path.resolve(controlledPublishRoot))) {
    throw new Error("Feature 6 publish root must exist before resolving output layout.");
  }
  if (fs.lstatSync(path.resolve(controlledPublishRoot)).isSymbolicLink()) {
    throw new Error("Feature 6 publish root must not be a link.");
  }
  for (const candidate of [...roots, outputBase]) assertSameRoot(controlledPublishRoot, candidate);
  const realPublishRoot = fs.realpathSync(path.resolve(controlledPublishRoot));
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
  };
}