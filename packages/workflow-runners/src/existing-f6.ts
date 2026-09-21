/* eslint-disable @typescript-eslint/no-explicit-any -- existing artifact validation consumes external JSON and validates it structurally. */
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import path from "node:path";

import { createF6ReportFileNames, F6_CANDIDATE_RECEIPT_FILE_NAME, f6ReadableOptimizationResultSchema, modelResponseMatchesInterpretation } from "@ai-assist/contracts";
import { worstDisposition } from "@ai-assist/workbook-catalog";

import type { ExistingF6ValidationRequest, ExistingF6ValidationResult } from "./types.js";
import { hasF6CandidateMarker, validateF6CandidateReceipt } from "./f6-candidate-receipt.js";

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

function artifactContract(manifest: any, optimization: any) {
  if (manifest?.artifactSetVersion === "f6-artifact-set-v4") {
    const { finalReportMdName, finalReportPdfName } = createF6ReportFileNames(optimization?.workbook?.fileName);
    return {
      files: ["Feature6-Optimization.json", finalReportMdName, finalReportPdfName, "Feature6-Run-Summary.json", "manifest.json"],
      artifacts: {
        optimizationJson: "Feature6-Optimization.json",
        finalReportMarkdown: finalReportMdName,
        finalReportPdf: finalReportPdfName,
        runSummary: "Feature6-Run-Summary.json",
      },
      hashes: [
        ["optimizationJsonSha256", "Feature6-Optimization.json"],
        ["finalReportMarkdownSha256", finalReportMdName],
        ["finalReportPdfSha256", finalReportPdfName],
      ],
      optimizationMarkdown: false,
      pdf: true,
      finalReportMdName,
      finalReportPdfName,
    };
  }
  if (manifest?.artifactSetVersion === "f6-artifact-set-v3") return { files: V3_FILES, artifacts: V3_ARTIFACTS, hashes: V3_HASHED_ARTIFACTS, optimizationMarkdown: false, pdf: true, finalReportMdName: "Feature6-Report.md", finalReportPdfName: "Feature6-Report.pdf" };
  if (manifest?.artifactSetVersion === "f6-artifact-set-v2") return { files: V2_FILES, artifacts: V2_ARTIFACTS, hashes: V2_HASHED_ARTIFACTS, optimizationMarkdown: false, pdf: false, finalReportMdName: "Feature6-Report.md" };
  if (manifest?.artifactSetVersion === undefined) return { files: LEGACY_FILES, artifacts: LEGACY_ARTIFACTS, hashes: LEGACY_HASHED_ARTIFACTS, optimizationMarkdown: true, pdf: false, finalReportMdName: "Feature6-Report.md" };
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

function rejected(reasonCode: string): ExistingF6ValidationResult {
  return { status: "rejected", reasonCode };
}

function jsonFile(filePath: string): any {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function hasPdfSignature(filePath: string): boolean {
  const bytes = readFileSync(filePath);
  return bytes.length >= 8 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
}

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  const rightSet = new Set(right);
  return left.length === right.length && new Set(left).size === left.length && left.every((value) => rightSet.has(value));
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function inspectPhysicalPath(root: string, candidate: string): boolean {
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

function resolveRunRoot(entryPath: string): string | undefined {
  if (typeof entryPath !== "string" || entryPath.trim() === "") return undefined;
  const resolved = path.resolve(entryPath);
  if (!existsSync(resolved)) return undefined;
  const stats = lstatSync(resolved);
  if (stats.isSymbolicLink()) return undefined;
  if (stats.isDirectory()) return resolved;
  if (stats.isFile() && path.basename(resolved) === "Feature6-Optimization.json") return path.dirname(resolved);
  return undefined;
}

function validateBoundary(runRoot: string, publishRoot: string): boolean {
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

function validateExactFiles(runRoot: string, expectedFiles: readonly string[], workspaceEvidence = false, candidateReceipt = false): boolean {
  const entries = readdirSync(runRoot, { withFileTypes: true });
  if (!sameStrings(entries.map((entry) => entry.name).sort(), [...expectedFiles, ...(workspaceEvidence ? ["evidence"] : []), ...(candidateReceipt ? [F6_CANDIDATE_RECEIPT_FILE_NAME] : [])].sort())) return false;
  return expectedFiles.every((fileName) => {
    const filePath = path.join(runRoot, fileName);
    const stats = lstatSync(filePath);
    return stats.isFile() && !stats.isSymbolicLink();
  });
}

export function validateF6WorkspaceEvidence(runRoot: string, modelPath: string, optimization: any, allowCandidate = false): boolean {
  const evidenceRoot = path.join(runRoot, "evidence");
  const modelRoot = path.join(evidenceRoot, "model-interpretation");
  const expectedPath = path.join(modelRoot, "Feature6-Model-Interpretation.json");
  if (modelPath !== expectedPath || !inspectPhysicalPath(runRoot, expectedPath)) return false;
  const evidenceEntries = readdirSync(evidenceRoot).sort();
  const hasResponse = evidenceEntries.includes("model-response");
  const hasCandidate = evidenceEntries.includes("candidate");
  const expectedEntries = ["model-interpretation", ...(hasResponse ? ["model-response"] : []), ...(allowCandidate || hasCandidate ? ["candidate"] : [])].sort();
  if (!sameStrings(evidenceEntries, expectedEntries)) return false;
  if (hasCandidate && !allowCandidate && !validateF6CandidateReceipt(path.join(evidenceRoot, "candidate", "publication"), {
    analysisRoot: path.dirname(runRoot),
    workbookFileName: optimization.workbook.fileName,
    workbookContentHash: optimization.workbook.contentHash,
  })) return false;
  if (!validateExactFiles(modelRoot, ["Feature6-Model-Interpretation.json"])) return false;
  if (hasResponse) {
    const responseRoot = path.join(evidenceRoot, "model-response");
    const responsePath = path.join(responseRoot, "Feature6-Model-Response.json");
    if (!inspectPhysicalPath(runRoot, responsePath)
      || !validateExactFiles(responseRoot, ["Feature6-Model-Response.json"])
      || !modelResponseMatchesInterpretation(jsonFile(responsePath), jsonFile(expectedPath), optimization.workbook)) return false;
  }
  const stats = lstatSync(expectedPath);
  return stats.isFile() && !stats.isSymbolicLink()
    && sha256File(expectedPath) === optimization?.provenance?.multimodalReference?.contentHash;
}

function workflowStatus(optimization: any): string {
  return optimization.runStatus === undefined ? optimization.status : optimization.runStatus.toLowerCase();
}

function validateManifest(manifest: any, expectedStatus: string, contract: ReturnType<typeof artifactContract>): boolean {
  if (contract === undefined) return false;
  const artifacts = manifest?.artifacts;
  const artifactKeys = artifacts === undefined || artifacts === null ? [] : Object.keys(artifacts).sort();
  const expectedKeys = Object.keys(contract.artifacts).sort();
  return manifest?.contractVersion === "v1"
    && manifest?.featureId === "F6"
    && manifest?.status === expectedStatus
    && sameStrings(artifactKeys, expectedKeys)
    && expectedKeys.every((key) => artifacts[key] === (contract.artifacts as any)[key]);
}

function safeArtifactReference(reference: any): { artifact: string; contentHash: string } | undefined {
  if (reference === undefined || reference === null || typeof reference !== "object") return undefined;
  if (typeof reference.artifact !== "string" || typeof reference.contentHash !== "string") return undefined;
  return { artifact: path.basename(reference.artifact), contentHash: reference.contentHash };
}

function expectedSources(optimization: any) {
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
          const reference = decision?.outcome === "CALLER_AUTHORIZED" ? safeArtifactReference(decision.artifactReference) : undefined;
          return [sourceKey, reference];
        })
        .filter(([, reference]) => reference !== undefined);
      return Object.fromEntries([...directSources, ...decisionSources]);
    }
  }
}

function validateHashes(runRoot: string, summary: any, hashedArtifacts: readonly (readonly string[])[]): boolean {
  const hashes = summary?.hashes;
  if (hashes === undefined || typeof hashes !== "object" || hashes === null) return false;
  const hashKeys = Object.keys(hashes).sort();
  const expectedKeys = hashedArtifacts.map(([key]) => String(key)).sort();
  if (!sameStrings(hashKeys, expectedKeys)) return false;
  return hashedArtifacts.every(([hashKey, fileName]) => typeof hashKey === "string"
    && typeof fileName === "string"
    && (hashes as any)[hashKey] === sha256File(path.join(runRoot, fileName)));
}

function validateReportSummary(summary: any, optimization: any): boolean {
  const reportSummary = summary?.reportSummary;
  const worksheetDispositions = reportSummary?.worksheetDispositions;
  if (!ALLOWED_DISPOSITIONS.has(reportSummary?.workbookDisposition) || !Array.isArray(worksheetDispositions)) return false;
  const reportScope = optimization.provenance?.reportScope;
  if (!Array.isArray(reportScope?.worksheetNames)) return false;
  if (!Array.isArray(reportScope.blockedWorksheetNames)) return false;

  const worksheetNames = worksheetDispositions.map(({ worksheetName }: any) => worksheetName);
  if (worksheetNames.some((worksheetName: any) => typeof worksheetName !== "string" || worksheetName.length === 0)) return false;
  if (new Set(worksheetNames).size !== worksheetNames.length) return false;
  if (worksheetDispositions.some(({ disposition }: any) => !ALLOWED_DISPOSITIONS.has(disposition))) return false;
  if (!sameStrings(worksheetNames, reportScope.worksheetNames)) return false;

  const optimizationWorksheetNames = optimization.worksheets.map(({ worksheetName }: any) => worksheetName);
  if (optimizationWorksheetNames.some((worksheetName: any) => typeof worksheetName !== "string" || worksheetName.length === 0)) return false;
  if (new Set(optimizationWorksheetNames).size !== optimizationWorksheetNames.length) return false;
  const blockedNames = reportScope.blockedWorksheetNames;
  const blockedNameSet = new Set(blockedNames);
  const expectedOptimizationNames = reportScope.worksheetNames.filter((worksheetName: string) => !blockedNameSet.has(worksheetName));
  if (!sameStringSet(optimizationWorksheetNames, expectedOptimizationNames)) return false;
  if (!sameStrings(worksheetNames.filter((worksheetName: string) => !optimizationWorksheetNames.includes(worksheetName)), blockedNames)) return false;
  if (worksheetDispositions.some(({ worksheetName, disposition }: any) => blockedNameSet.has(worksheetName) && disposition !== "FAIL")) return false;

  const expected = worstDisposition(worksheetDispositions.map(({ disposition }: any) => disposition));
  return reportSummary.workbookDisposition === expected;
}

function validateInputDecisions(summary: any, manifest: any, optimization: any): boolean {
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

function validateRunSummary(summary: any, optimization: any): boolean {
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
  return sameJson(summary?.counts, optimization.summary) && sameJson(summary?.sources, expected);
}

function resultSnapshot(step: any): any | undefined {
  return step?.status === "COMPLETED_TARGET_MET" || step?.status === "COMPLETED_TARGET_NOT_MET"
    ? step.result
    : undefined;
}

function completedStepCapabilityMatches(step: any): boolean {
  if (step?.status === "COMPLETED_TARGET_MET") return step?.result?.capability?.status === "PASS";
  if (step?.status === "COMPLETED_TARGET_NOT_MET") return step?.result?.capability?.status === "FAIL";
  return true;
}

function validateV4WorksheetLineage(worksheet: any, f4Reference: any): boolean {
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

function validateV4SourcesAndLineage(optimization: any, summary: any): boolean {
  if (safeArtifactReference(optimization?.provenance?.multimodalReference) === undefined) return false;
  if (!Array.isArray(optimization?.worksheets) || optimization.worksheets.length === 0) return false;
  if (!sameJson(summary?.counts, optimization.summary)) return false;
  return optimization.worksheets.every((worksheet: any) => validateV4WorksheetLineage(worksheet, optimization.provenance?.f4Reference));
}

export function validateExistingF6(entryPath: string, request: ExistingF6ValidationRequest): ExistingF6ValidationResult {
  return inspectF6Publication(entryPath, request, false);
}

// Internal inspection is not exported through the package's public entrypoint.
// It supports sealing the marker last; public readers always reject markers.
export function inspectInternalF6Candidate(entryPath: string, request: ExistingF6ValidationRequest): ExistingF6ValidationResult & { internalOnly: true } {
  return { ...inspectF6Publication(entryPath, request, true), internalOnly: true };
}

function inspectF6Publication(entryPath: string, request: ExistingF6ValidationRequest, internalCandidate: boolean): ExistingF6ValidationResult {
  if (request.publishRoot === undefined) return rejected("artifact_publish_root_required");
  try {
    const runRoot = resolveRunRoot(entryPath);
    if (runRoot === undefined) return rejected("invalid_artifact_entry");
    if (!internalCandidate && hasF6CandidateMarker(runRoot)) return rejected("internal_candidate_not_final");
    if (!validateBoundary(runRoot, request.publishRoot)) return rejected("artifact_outside_publish_root");
    const manifest = jsonFile(path.join(runRoot, "manifest.json"));
    if (!internalCandidate && Object.hasOwn(manifest, "internalOnly")) return rejected("internal_candidate_not_final");
    if (internalCandidate && manifest.internalOnly !== true) return rejected("candidate_receipt_invalid");
    const optimizationRaw = jsonFile(path.join(runRoot, "Feature6-Optimization.json"));
    const optimization = f6ReadableOptimizationResultSchema.parse(optimizationRaw);
    const contract = artifactContract(manifest, optimization);
    const workspaceEvidence = request.workspaceModelInterpretationPath !== undefined;
    const candidateReceipt = internalCandidate && readdirSync(runRoot).includes(F6_CANDIDATE_RECEIPT_FILE_NAME);
    if (contract === undefined || !validateExactFiles(runRoot, contract.files, workspaceEvidence, candidateReceipt)) return rejected("artifact_file_set_invalid");
    if (candidateReceipt && !validateF6CandidateReceipt(runRoot)) return rejected("candidate_receipt_invalid");
    if (workspaceEvidence && !validateF6WorkspaceEvidence(runRoot, request.workspaceModelInterpretationPath!, optimization)) return rejected("artifact_workspace_evidence_invalid");
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
    if (contract.pdf && !hasPdfSignature(path.join(runRoot, contract.finalReportPdfName!))) return rejected("artifact_validation_failed");
    if (!validateReportSummary(summary, optimization)) return rejected("report_summary_invalid");
    if (!validateInputDecisions(summary, manifest, optimization)) return rejected("input_decisions_invalid");

    const finalReportMarkdownPath = path.join(runRoot, contract.finalReportMdName);
    return {
      status: "accepted",
      outputDirectory: runRoot,
      optimizationJsonPath: path.join(runRoot, "Feature6-Optimization.json"),
      ...(contract.optimizationMarkdown ? { optimizationMarkdownPath: path.join(runRoot, "Feature6-Optimization.md") } : {}),
      finalReportMarkdownPath,
      ...(contract.pdf ? { finalReportPdfPath: path.join(runRoot, contract.finalReportPdfName!) } : {}),
      runSummaryPath: path.join(runRoot, "Feature6-Run-Summary.json"),
      manifestPath: path.join(runRoot, "manifest.json"),
      reportSummary: summary.reportSummary,
      finalReportMarkdown: readFileSync(finalReportMarkdownPath, "utf8"),
    };
  } catch {
    return rejected("artifact_validation_failed");
  }
}