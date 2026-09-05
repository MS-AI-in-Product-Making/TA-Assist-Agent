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

import { f6OptimizationResultSchema } from "@ai-assist/contracts";
import { worstDisposition } from "@ai-assist/workbook-catalog";

import type { ExistingF6ValidationRequest, ExistingF6ValidationResult } from "./types.js";

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

function validateExactFiles(runRoot: string): boolean {
  const entries = readdirSync(runRoot, { withFileTypes: true });
  if (!sameStrings(entries.map((entry) => entry.name).sort(), [...EXPECTED_FILES].sort())) return false;
  return EXPECTED_FILES.every((fileName) => {
    const filePath = path.join(runRoot, fileName);
    const stats = lstatSync(filePath);
    return stats.isFile() && !stats.isSymbolicLink();
  });
}

function workflowStatus(optimization: any): string {
  return optimization.runStatus === undefined ? optimization.status : optimization.runStatus.toLowerCase();
}

function validateManifest(manifest: any, expectedStatus: string): boolean {
  const artifacts = manifest?.artifacts;
  const artifactKeys = artifacts === undefined || artifacts === null ? [] : Object.keys(artifacts).sort();
  const expectedKeys = Object.keys(EXPECTED_ARTIFACTS).sort();
  return manifest?.contractVersion === "v1"
    && manifest?.featureId === "F6"
    && manifest?.status === expectedStatus
    && sameStrings(artifactKeys, expectedKeys)
    && expectedKeys.every((key) => artifacts[key] === (EXPECTED_ARTIFACTS as any)[key]);
}

function safeArtifactReference(reference: any): { artifact: string; contentHash: string } | undefined {
  if (reference === undefined || reference === null || typeof reference !== "object") return undefined;
  if (typeof reference.artifact !== "string" || typeof reference.contentHash !== "string") return undefined;
  return { artifact: path.basename(reference.artifact), contentHash: reference.contentHash };
}

function expectedSources(optimization: any) {
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

function validateHashes(runRoot: string, summary: any): boolean {
  const hashes = summary?.hashes;
  if (hashes === undefined || typeof hashes !== "object" || hashes === null) return false;
  const hashKeys = Object.keys(hashes).sort();
  const expectedKeys = HASHED_ARTIFACTS.map(([key]) => String(key)).sort();
  if (!sameStrings(hashKeys, expectedKeys)) return false;
  return HASHED_ARTIFACTS.every(([hashKey, fileName]) => typeof hashKey === "string"
    && typeof fileName === "string"
    && (hashes as any)[hashKey] === sha256File(path.join(runRoot, fileName)));
}

function validateReportSummary(summary: any, optimization: any): boolean {
  const reportSummary = summary?.reportSummary;
  const worksheetDispositions = reportSummary?.worksheetDispositions;
  if (!ALLOWED_DISPOSITIONS.has(reportSummary?.workbookDisposition) || !Array.isArray(worksheetDispositions)) return false;
  const reportScope = optimization.provenance?.reportScope;
  if (!Array.isArray(reportScope?.worksheetNames) || !Array.isArray(reportScope?.blockedWorksheetNames)) return false;

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
  for (const [decisionKey, provenanceKey] of Object.entries(DECISION_PROVENANCE_FIELDS)) {
    if (!sameJson(decisions?.[decisionKey], optimization.provenance?.[provenanceKey])) return false;
  }
  return true;
}

function validateRunSummary(summary: any, optimization: any): boolean {
  return sameJson(summary?.counts, optimization.summary) && sameJson(summary?.sources, expectedSources(optimization));
}

export function validateExistingF6(entryPath: string, request: ExistingF6ValidationRequest): ExistingF6ValidationResult {
  if (request.publishRoot === undefined) return rejected("artifact_publish_root_required");
  try {
    const runRoot = resolveRunRoot(entryPath);
    if (runRoot === undefined) return rejected("invalid_artifact_entry");
    if (!validateBoundary(runRoot, request.publishRoot)) return rejected("artifact_outside_publish_root");
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