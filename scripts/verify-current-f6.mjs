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
import { f6ReadableOptimizationResultSchema } from "../packages/contracts/dist/contracts.js";
import { worstDisposition } from "./f6-final-report.mjs";

const LEGACY_FILES = Object.freeze([
  "Feature6-Optimization.json",
  "Feature6-Optimization.md",
  "Feature6-Report.md",
  "Feature6-Run-Summary.json",
  "manifest.json",
]);

const V2_FILES = Object.freeze(LEGACY_FILES.filter((fileName) => fileName !== "Feature6-Optimization.md"));
const V3_FILES = Object.freeze([...V2_FILES, "Feature6-Report.pdf"]);
const LEGACY_ARTIFACTS = Object.freeze({
  optimizationJson: "Feature6-Optimization.json",
  optimizationMarkdown: "Feature6-Optimization.md",
  finalReportMarkdown: "Feature6-Report.md",
  runSummary: "Feature6-Run-Summary.json",
});

const V2_ARTIFACTS = Object.freeze({
  optimizationJson: "Feature6-Optimization.json",
  finalReportMarkdown: "Feature6-Report.md",
  runSummary: "Feature6-Run-Summary.json",
});
const V3_ARTIFACTS = Object.freeze({
  ...V2_ARTIFACTS,
  finalReportPdf: "Feature6-Report.pdf",
});
const LEGACY_HASHED_ARTIFACTS = Object.freeze([
  ["optimizationJsonSha256", "Feature6-Optimization.json"],
  ["optimizationMarkdownSha256", "Feature6-Optimization.md"],
  ["finalReportMarkdownSha256", "Feature6-Report.md"],
]);
const V2_HASHED_ARTIFACTS = Object.freeze(LEGACY_HASHED_ARTIFACTS.filter(([key]) => key !== "optimizationMarkdownSha256"));
const V3_HASHED_ARTIFACTS = Object.freeze([...V2_HASHED_ARTIFACTS, ["finalReportPdfSha256", "Feature6-Report.pdf"]]);

function artifactContract(manifest) {
  if (manifest?.artifactSetVersion === "f6-artifact-set-v3") return { files: V3_FILES, artifacts: V3_ARTIFACTS, hashes: V3_HASHED_ARTIFACTS, optimizationMarkdown: false, pdf: true };
  if (manifest?.artifactSetVersion === "f6-artifact-set-v2") return { files: V2_FILES, artifacts: V2_ARTIFACTS, hashes: V2_HASHED_ARTIFACTS, optimizationMarkdown: false, pdf: false };
  if (manifest?.artifactSetVersion === undefined) return { files: LEGACY_FILES, artifacts: LEGACY_ARTIFACTS, hashes: LEGACY_HASHED_ARTIFACTS, optimizationMarkdown: true, pdf: false };
  return undefined;
}

const ALLOWED_DISPOSITIONS = new Set(["FAIL", "INCOMPLETE", "CONDITIONAL_PASS", "PASS"]);
const DECISION_PROVENANCE_FIELDS = Object.freeze({
  analysisContext: "analysisContextDecision",
  optimizationTargets: "optimizationTargetsDecision",
  modelInterpretation: "modelInterpretationDecision",
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
  modelInterpretation: "modelInterpretationDecision",
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

function hasPdfSignature(filePath) {
  const bytes = readFileSync(filePath);
  return bytes.length >= 8 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
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

function sameSourceMap(left, right) {
  if (left === null || typeof left !== "object" || right === null || typeof right !== "object") return false;
  const keys = Object.keys(left).sort();
  const expectedKeys = Object.keys(right).sort();
  return sameStrings(keys, expectedKeys) && keys.every((key) => sameJson(left[key], right[key]));
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

function validateExactFiles(runRoot, expectedFiles) {
  const entries = readdirSync(runRoot, { withFileTypes: true });
  if (!sameStrings(entries.map((entry) => entry.name).sort(), [...expectedFiles].sort())) return false;
  return expectedFiles.every((fileName) => {
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

function validateManifest(manifest, expectedStatus, contract) {
  if (contract === undefined) return false;
  const artifacts = manifest?.artifacts;
  const artifactKeys = artifacts === undefined || artifacts === null ? [] : Object.keys(artifacts).sort();
  const expectedKeys = Object.keys(contract.artifacts).sort();
  return manifest?.contractVersion === "v1"
    && manifest?.featureId === "F6"
    && manifest?.status === expectedStatus
    && sameStrings(artifactKeys, expectedKeys)
    && expectedKeys.every((key) => artifacts[key] === contract.artifacts[key]);
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
  switch (optimization.optimizationVersion) {
    case "f6-optimization-v4": {
      const base = {
        f2: safeArtifactReference(optimization.provenance?.f2Reference),
        f3: safeArtifactReference(optimization.provenance?.f3Reference),
        f4: safeArtifactReference(optimization.provenance?.f4Reference),
        f5: safeArtifactReference(optimization.provenance?.f5Reference),
        modelInterpretation: safeArtifactReference(optimization.provenance?.multimodalReference),
      };
      const optional = Object.entries(SOURCE_PROVENANCE_FIELDS)
        .map(([sourceKey, provenanceKey]) => [sourceKey, safeArtifactReference(optimization.provenance?.[provenanceKey])])
        .filter(([, reference]) => reference !== undefined);
      const governedInputs = [
        ["analysisContext", safeArtifactReference(optimization.provenance?.analysisContextReference)],
        ["optimizationTargets", safeArtifactReference(optimization.provenance?.optimizationTargetsReference)],
      ].filter(([, reference]) => reference !== undefined);
      return Object.fromEntries([
        ...Object.entries(base).filter(([, reference]) => reference !== undefined),
        ...optional,
        ...governedInputs,
      ]);
    }
    case "f6-optimization-v3":
      return {
        f2: safeArtifactReference(optimization.provenance?.f2Reference),
        f3: safeArtifactReference(optimization.provenance?.f3Reference),
        f4: safeArtifactReference(optimization.provenance?.f4Reference),
        f5: safeArtifactReference(optimization.provenance?.f5Reference),
        modelInterpretation: safeArtifactReference(optimization.provenance?.multimodalReference),
      };
    default: {
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
  }
}

function validateHashes(runRoot, summary, hashedArtifacts) {
  const hashes = summary?.hashes;
  if (hashes === undefined || typeof hashes !== "object" || hashes === null) return false;
  const hashKeys = Object.keys(hashes).sort();
  if (!sameStrings(hashKeys, hashedArtifacts.map(([key]) => key).sort())) return false;
  return hashedArtifacts.every(([hashKey, fileName]) => hashes[hashKey] === sha256File(path.join(runRoot, fileName)));
}

function validateReportSummary(summary, optimization) {
  const reportSummary = summary?.reportSummary;
  const worksheetDispositions = reportSummary?.worksheetDispositions;
  if (!ALLOWED_DISPOSITIONS.has(reportSummary?.workbookDisposition) || !Array.isArray(worksheetDispositions)) return false;
  const reportScope = optimization.provenance?.reportScope;
  if (!Array.isArray(reportScope?.worksheetNames)) return false;
  if (!Array.isArray(reportScope.blockedWorksheetNames)) return false;

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
  if (optimization.optimizationVersion === "f6-optimization-v4") {
    return decisions.modelInterpretation?.outcome === "CALLER_AUTHORIZED"
      && sameJson(decisions.modelInterpretation.artifactReference, optimization.provenance.multimodalReference);
  }
  if (optimization.optimizationVersion === "f6-optimization-v3") {
    return decisions.modelInterpretation?.outcome === "CALLER_AUTHORIZED"
      && sameJson(decisions.modelInterpretation.artifactReference, optimization.provenance.multimodalReference);
  }
  for (const [decisionKey, provenanceKey] of Object.entries(DECISION_PROVENANCE_FIELDS)) {
    if (!sameJson(decisions?.[decisionKey], optimization.provenance?.[provenanceKey])) return false;
  }
  return true;
}

function validateRunSummary(summary, optimization) {
  const expected = expectedSources(optimization);
  if (optimization.optimizationVersion === "f6-optimization-v3" && summary?.sources?.imageObservation !== undefined) {
    const imageObservation = safeArtifactReference(summary.sources.imageObservation);
    if (imageObservation === undefined
      || imageObservation.artifact !== "Feature5-Image-Observations.json"
      || !/^[a-f0-9]{64}$/.test(imageObservation.contentHash)) {
      return false;
    }
    expected.imageObservation = imageObservation;
  }
  return sameJson(summary?.counts, optimization.summary)
    && sameSourceMap(summary?.sources, expected);
}

function resultSnapshot(step) {
  return step?.status === "COMPLETED_TARGET_MET" || step?.status === "COMPLETED_TARGET_NOT_MET"
    ? step.result
    : undefined;
}

function completedStepCapabilityMatches(step) {
  if (step?.status === "COMPLETED_TARGET_MET") return step?.result?.capability?.status === "PASS";
  if (step?.status === "COMPLETED_TARGET_NOT_MET") return step?.result?.capability?.status === "FAIL";
  return true;
}

function validateV4WorksheetLineage(worksheet, f4Reference) {
  const step1 = worksheet?.steps?.[0];
  const step2 = worksheet?.steps?.[1];
  const step3 = worksheet?.steps?.[2];
  const baseline = worksheet?.baselineResult;
  const selected = worksheet?.selectedResult?.snapshot;
  if (!baseline || !selected || step1 === undefined || step2 === undefined || step3 === undefined) return false;

  const step1Snapshot = resultSnapshot(step1);
  const step2Snapshot = resultSnapshot(step2);
  const step3Snapshot = resultSnapshot(step3);
  if (!completedStepCapabilityMatches(step1)
    || !completedStepCapabilityMatches(step2)
    || !completedStepCapabilityMatches(step3)) {
    return false;
  }
  const snapshots = [baseline, step1Snapshot, step2Snapshot, step3Snapshot, selected].filter((snapshot) => snapshot !== undefined);
  if (snapshots.some((snapshot) => snapshot.calculationReference?.artifact !== f4Reference?.artifact
    || snapshot.calculationReference?.contentHash !== f4Reference?.contentHash)) {
    return false;
  }

  if (step1Snapshot !== undefined && step1Snapshot.inputScenarioId !== baseline.scenarioId) return false;
  const step2ExpectedParent = step1Snapshot?.scenarioId ?? baseline.scenarioId;
  if (step2Snapshot !== undefined && step2Snapshot.inputScenarioId !== step2ExpectedParent) return false;
  const step3ExpectedParent = step2Snapshot?.scenarioId ?? step1Snapshot?.scenarioId ?? baseline.scenarioId;
  if (step3Snapshot !== undefined && step3Snapshot.inputScenarioId !== step3ExpectedParent) return false;

  switch (worksheet?.selectedResult?.status) {
    case "baseline_meets_target":
      return sameJson(selected, baseline);
    case "step1_centered":
      return step1?.status === "COMPLETED_TARGET_MET"
        && step1Snapshot !== undefined
        && step1Snapshot.capability?.status === "PASS"
        && selected.capability?.status === "PASS"
        && sameJson(selected, step1Snapshot);
    case "step2_tolerance_optimized":
      return step2?.status === "COMPLETED_TARGET_MET"
        && step2Snapshot !== undefined
        && step2Snapshot.capability?.status === "PASS"
        && selected.capability?.status === "PASS"
        && sameJson(selected, step2Snapshot);
    case "step3_specification_relaxed_pending_approval":
      return step3?.status === "COMPLETED_TARGET_MET"
        && step3Snapshot !== undefined
        && step3Snapshot.capability?.status === "PASS"
        && selected.capability?.status === "PASS"
        && sameJson(selected, step3Snapshot);
    case "no_validated_optimized_result":
      return [baseline, step1Snapshot, step2Snapshot, step3Snapshot]
        .filter((snapshot) => snapshot !== undefined)
        .some((snapshot) => sameJson(selected, snapshot));
    default:
      return false;
  }
}

function validateV4SourcesAndLineage(optimization, summary) {
  if (safeArtifactReference(optimization?.provenance?.multimodalReference) === undefined) return false;
  if (!Array.isArray(optimization?.worksheets) || optimization.worksheets.length === 0) return false;
  if (!sameJson(summary?.counts, optimization.summary)) return false;
  return optimization.worksheets.every((worksheet) => validateV4WorksheetLineage(worksheet, optimization.provenance?.f4Reference));
}

export function validateExistingF6Artifact(entryPath, options = {}) {
  if (options.publishRoot === undefined) return rejected("artifact_publish_root_required");
  try {
    const runRoot = resolveRunRoot(entryPath);
    if (runRoot === undefined) return rejected("invalid_artifact_entry");
    if (!validateBoundary(runRoot, options.publishRoot)) return rejected("artifact_outside_publish_root");
    const manifest = jsonFile(path.join(runRoot, "manifest.json"));
    const contract = artifactContract(manifest);
    if (contract === undefined || !validateExactFiles(runRoot, contract.files)) return rejected("artifact_file_set_invalid");
    const optimizationRaw = jsonFile(path.join(runRoot, "Feature6-Optimization.json"));
    const optimization = f6ReadableOptimizationResultSchema.parse(optimizationRaw);
    const summary = jsonFile(path.join(runRoot, "Feature6-Run-Summary.json"));
    const expectedStatus = workflowStatus(optimization);
    if (!validateManifest(manifest, expectedStatus, contract)) return rejected("manifest_invalid");
    if (summary?.status !== expectedStatus || !validateRunSummary(summary, optimization)) return rejected("run_summary_invalid");
    switch (optimization.optimizationVersion) {
      case "f6-optimization-v4":
        if (!validateV4SourcesAndLineage(optimization, summary)) return rejected("artifact_validation_failed");
        break;
      case "f6-optimization-v3":
      case "f6-optimization-v2":
        break;
      default:
        return rejected("artifact_validation_failed");
    }

    if (!validateHashes(runRoot, summary, contract.hashes)) return rejected("artifact_hash_mismatch");
    if (contract.pdf && !hasPdfSignature(path.join(runRoot, "Feature6-Report.pdf"))) return rejected("pdf_artifact_invalid");
    if (!validateReportSummary(summary, optimization)) return rejected("report_summary_invalid");
    if (!validateInputDecisions(summary, manifest, optimization)) return rejected("input_decisions_invalid");

    const finalReportMarkdownPath = path.join(runRoot, "Feature6-Report.md");
    return {
      status: "accepted",
      outputDirectory: runRoot,
      optimizationJsonPath: path.join(runRoot, "Feature6-Optimization.json"),
      ...(contract.optimizationMarkdown ? { optimizationMarkdownPath: path.join(runRoot, "Feature6-Optimization.md") } : {}),
      finalReportMarkdownPath,
      ...(contract.pdf ? { finalReportPdfPath: path.join(runRoot, "Feature6-Report.pdf") } : {}),
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