import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { f6OptimizationResultSchema } from "../packages/contracts/dist/contracts.js";
import { worstDisposition } from "./f6-final-report.mjs";

const EXPECTED_FILES = Object.freeze([
  "Feature6-Optimization.json",
  "Feature6-Optimization.md",
  "Feature6-Report.md",
  "Feature6-Run-Summary.json",
  "manifest.json",
]);

const EXPECTED_ARTIFACTS = Object.freeze({
  optimizationJson: "Feature6-Optimization.json",
  optimizationMarkdown: "Feature6-Optimization.md",
  finalReportMarkdown: "Feature6-Report.md",
  runSummary: "Feature6-Run-Summary.json",
});

const HASHED_ARTIFACTS = Object.freeze([
  ["optimizationJsonSha256", "Feature6-Optimization.json"],
  ["optimizationMarkdownSha256", "Feature6-Optimization.md"],
  ["finalReportMarkdownSha256", "Feature6-Report.md"],
]);

const ALLOWED_DISPOSITIONS = new Set(["FAIL", "INCOMPLETE", "CONDITIONAL_PASS", "PASS"]);
const DECISION_PROVENANCE_FIELDS = Object.freeze({
  analysisContext: "analysisContextDecision",
  optimizationTargets: "optimizationTargetsDecision",
});
const SOURCE_PROVENANCE_FIELDS = Object.freeze({
  f2: "f2Reference",
  f3: "f3Reference",
  f4: "f4Reference",
  f5: "f5Reference",
  imageObservation: "imageObservationReference",
  supplierCapability: "supplierCapabilityReference",
  datumStrategy: "datumStrategyReference",
  cost: "costReference",
});
const SOURCE_DECISION_FIELDS = Object.freeze({
  analysisContext: "analysisContextDecision",
  optimizationTargets: "optimizationTargetsDecision",
});

function rejected(reasonCode) {
  return { status: "rejected", reasonCode };
}

function jsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function sameStrings(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameStringSet(left, right) {
  const rightSet = new Set(right);
  return left.length === right.length && new Set(left).size === left.length && left.every((value) => rightSet.has(value));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function inspectPhysicalPath(root, candidate) {
  try {
    const relation = path.relative(root, candidate);
    let current = root;
    if (!lstatSync(current).isDirectory() || lstatSync(current).isSymbolicLink()) return false;
    for (const segment of relation.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      const stats = lstatSync(current);
      if (stats.isSymbolicLink()) return false;
      if (current !== candidate && !stats.isDirectory()) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function resolveRunRoot(entryPath) {
  if (typeof entryPath !== "string" || entryPath.trim() === "") return undefined;
  const resolved = path.resolve(entryPath);
  if (!existsSync(resolved)) return undefined;
  const stats = lstatSync(resolved);
  if (stats.isSymbolicLink()) return undefined;
  if (stats.isDirectory()) return resolved;
  if (stats.isFile() && path.basename(resolved) === "Feature6-Optimization.json") return path.dirname(resolved);
  return undefined;
}

function validateBoundary(runRoot, publishRoot) {
  if (typeof publishRoot !== "string" || publishRoot.trim() === "") return false;
  const requestedPublishRoot = path.resolve(publishRoot);
  if (!existsSync(requestedPublishRoot)) return false;
  const publishStats = lstatSync(requestedPublishRoot);
  if (!publishStats.isDirectory() || publishStats.isSymbolicLink()) return false;
  if (!inspectPhysicalPath(requestedPublishRoot, runRoot)) return false;
  const realPublishRoot = realpathSync(requestedPublishRoot);
  const realRunRoot = realpathSync(runRoot);
  return isContained(realPublishRoot, realRunRoot);
}

function validateExactFiles(runRoot) {
  const entries = readdirSync(runRoot, { withFileTypes: true });
  if (!sameStrings(entries.map((entry) => entry.name).sort(), [...EXPECTED_FILES].sort())) return false;
  return EXPECTED_FILES.every((fileName) => {
    const filePath = path.join(runRoot, fileName);
    const stats = lstatSync(filePath);
    return stats.isFile() && !stats.isSymbolicLink();
  });
}

function workflowStatus(optimization) {
  return optimization.runStatus === undefined
    ? optimization.status
    : optimization.runStatus.toLowerCase();
}

function validateManifest(manifest, expectedStatus) {
  const artifacts = manifest?.artifacts;
  const artifactKeys = artifacts === undefined || artifacts === null ? [] : Object.keys(artifacts).sort();
  const expectedKeys = Object.keys(EXPECTED_ARTIFACTS).sort();
  return manifest?.contractVersion === "v1"
    && manifest?.featureId === "F6"
    && manifest?.status === expectedStatus
    && sameStrings(artifactKeys, expectedKeys)
    && expectedKeys.every((key) => artifacts[key] === EXPECTED_ARTIFACTS[key]);
}

function safeArtifactReference(reference) {
  if (reference === undefined) return undefined;
  if (reference === null || typeof reference !== "object") return undefined;
  if (typeof reference.artifact !== "string" || typeof reference.contentHash !== "string") return undefined;
  return {
    artifact: path.basename(reference.artifact),
    contentHash: reference.contentHash,
  };
}

function expectedSources(optimization) {
  const directSources = Object.entries(SOURCE_PROVENANCE_FIELDS)
    .map(([sourceKey, provenanceKey]) => [sourceKey, safeArtifactReference(optimization.provenance?.[provenanceKey])])
    .filter(([, reference]) => reference !== undefined);
  const decisionSources = Object.entries(SOURCE_DECISION_FIELDS)
    .map(([sourceKey, provenanceKey]) => {
      const decision = optimization.provenance?.[provenanceKey];
      const reference = decision?.outcome === "CALLER_AUTHORIZED"
        ? safeArtifactReference(decision.artifactReference)
        : undefined;
      return [sourceKey, reference];
    })
    .filter(([, reference]) => reference !== undefined);
  return Object.fromEntries([...directSources, ...decisionSources]);
}

function validateHashes(runRoot, summary) {
  const hashes = summary?.hashes;
  if (hashes === undefined || typeof hashes !== "object" || hashes === null) return false;
  const hashKeys = Object.keys(hashes).sort();
  if (!sameStrings(hashKeys, HASHED_ARTIFACTS.map(([key]) => key).sort())) return false;
  return HASHED_ARTIFACTS.every(([hashKey, fileName]) => hashes[hashKey] === sha256File(path.join(runRoot, fileName)));
}

function validateReportSummary(summary, optimization) {
  const reportSummary = summary?.reportSummary;
  const worksheetDispositions = reportSummary?.worksheetDispositions;
  if (!ALLOWED_DISPOSITIONS.has(reportSummary?.workbookDisposition) || !Array.isArray(worksheetDispositions)) return false;
  const reportScope = optimization.provenance?.reportScope;
  if (!Array.isArray(reportScope?.worksheetNames) || !Array.isArray(reportScope?.blockedWorksheetNames)) return false;

  const worksheetNames = worksheetDispositions.map(({ worksheetName }) => worksheetName);
  if (worksheetNames.some((worksheetName) => typeof worksheetName !== "string" || worksheetName.length === 0)) return false;
  if (new Set(worksheetNames).size !== worksheetNames.length) return false;
  if (worksheetDispositions.some(({ disposition }) => !ALLOWED_DISPOSITIONS.has(disposition))) return false;
  if (!sameStrings(worksheetNames, reportScope.worksheetNames)) return false;

  const optimizationWorksheetNames = optimization.worksheets.map(({ worksheetName }) => worksheetName);
  if (optimizationWorksheetNames.some((worksheetName) => typeof worksheetName !== "string" || worksheetName.length === 0)) return false;
  if (new Set(optimizationWorksheetNames).size !== optimizationWorksheetNames.length) return false;
  const blockedNames = reportScope.blockedWorksheetNames;
  const blockedNameSet = new Set(blockedNames);
  const expectedOptimizationNames = reportScope.worksheetNames.filter((worksheetName) => !blockedNameSet.has(worksheetName));
  if (!sameStringSet(optimizationWorksheetNames, expectedOptimizationNames)) return false;
  if (!sameStrings(worksheetNames.filter((worksheetName) => !optimizationWorksheetNames.includes(worksheetName)), blockedNames)) return false;
  if (worksheetDispositions.some(({ worksheetName, disposition }) => blockedNameSet.has(worksheetName) && disposition !== "FAIL")) return false;

  const expected = worstDisposition(worksheetDispositions.map(({ disposition }) => disposition));
  return reportSummary.workbookDisposition === expected;
}

function validateInputDecisions(summary, manifest, optimization) {
  const decisions = summary?.inputDecisions;
  if (decisions === undefined || manifest?.inputDecisions === undefined) return false;
  if (!sameJson(manifest.inputDecisions, decisions)) return false;
  for (const [decisionKey, provenanceKey] of Object.entries(DECISION_PROVENANCE_FIELDS)) {
    if (!sameJson(decisions?.[decisionKey], optimization.provenance?.[provenanceKey])) return false;
  }
  return true;
}

function validateRunSummary(summary, optimization) {
  return sameJson(summary?.counts, optimization.summary)
    && sameJson(summary?.sources, expectedSources(optimization));
}

export function validateExistingF6Artifact(entryPath, options = {}) {
  if (options.publishRoot === undefined) return rejected("artifact_publish_root_required");
  try {
    const runRoot = resolveRunRoot(entryPath);
    if (runRoot === undefined) return rejected("invalid_artifact_entry");
    if (!validateBoundary(runRoot, options.publishRoot)) return rejected("artifact_outside_publish_root");
    if (!validateExactFiles(runRoot)) return rejected("artifact_file_set_invalid");

    const manifest = jsonFile(path.join(runRoot, "manifest.json"));
    const optimizationRaw = jsonFile(path.join(runRoot, "Feature6-Optimization.json"));
    const optimization = f6OptimizationResultSchema.parse(optimizationRaw);
    const summary = jsonFile(path.join(runRoot, "Feature6-Run-Summary.json"));
    const expectedStatus = workflowStatus(optimization);
    if (!validateManifest(manifest, expectedStatus)) return rejected("manifest_invalid");
    if (summary?.status !== expectedStatus || !validateRunSummary(summary, optimization)) return rejected("run_summary_invalid");

    if (!validateHashes(runRoot, summary)) return rejected("artifact_hash_mismatch");
    if (!validateReportSummary(summary, optimization)) return rejected("report_summary_invalid");
    if (!validateInputDecisions(summary, manifest, optimization)) return rejected("input_decisions_invalid");

    const finalReportMarkdownPath = path.join(runRoot, "Feature6-Report.md");
    return {
      status: "accepted",
      outputDirectory: runRoot,
      optimizationJsonPath: path.join(runRoot, "Feature6-Optimization.json"),
      optimizationMarkdownPath: path.join(runRoot, "Feature6-Optimization.md"),
      finalReportMarkdownPath,
      runSummaryPath: path.join(runRoot, "Feature6-Run-Summary.json"),
      manifestPath: path.join(runRoot, "manifest.json"),
      reportSummary: summary.reportSummary,
      finalReportMarkdown: readFileSync(finalReportMarkdownPath, "utf8"),
    };
  } catch {
    return rejected("artifact_validation_failed");
  }
}

function findLatestRunRoot(publishRoot = path.join("test", "demo-output")) {
  const start = path.resolve(publishRoot, "f6-runs");
  if (!existsSync(start)) return undefined;
  const candidates = [];
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    if (entries.some((entry) => entry.isFile() && entry.name === "Feature6-Optimization.json")) {
      candidates.push({ runRoot: current, mtimeMs: statSync(current).mtimeMs });
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) stack.push(path.join(current, entry.name));
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return candidates[0]?.runRoot;
}

function isDirectExecution() {
  return process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  const publishRoot = process.env.AI_TVA_F6_PUBLISH_ROOT ?? path.join("test", "demo-output");
  const entryPath = process.argv[2] ?? findLatestRunRoot(publishRoot);
  const result = validateExistingF6Artifact(entryPath, { publishRoot });
  console.log(JSON.stringify(result.status === "accepted" ? {
    status: result.status,
    outputDirectory: result.outputDirectory,
    finalReportMarkdownPath: result.finalReportMarkdownPath,
    reportSummary: result.reportSummary,
  } : result, null, 2));
  process.exitCode = result.status === "accepted" ? 0 : 1;
}