import { createHash, randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { validateExistingF6, validateF6WorkspaceEvidence } from "../packages/workflow-runners/dist/index.js";

function invalid() { throw new Error("Feature 6 candidate validation failed."); }
function digest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function json(file) { return JSON.parse(readFileSync(file, "utf8")); }
function physical(file, directory = false) {
  const absolute = path.resolve(file);
  let current = path.parse(absolute).root;
  for (const segment of path.relative(current, absolute).split(path.sep)) {
    current = path.join(current, segment);
    if (lstatSync(current).isSymbolicLink()) invalid();
  }
  const stats = lstatSync(absolute);
  if (realpathSync(absolute) !== absolute || (directory ? !stats.isDirectory() : !stats.isFile())) invalid();
  return stats;
}
function hashFile(file) { physical(file); return digest(readFileSync(file)); }
export function f6CandidatePaths(layout) {
  const root = path.join(layout.stagePaths.f6, "evidence", "candidate");
  return { root, publication: path.join(root, "publication"), receipt: path.join(root, "receipt.json") };
}
function snapshot(layout, args) {
  const files = {
    f2: path.join(layout.stagePaths.f2, "Feature2-Report.json"),
    f4: path.join(layout.stagePaths.f4, "Feature4-Calculation.json"),
    f5: path.join(layout.stagePaths.f5, "Feature5-Report.json"),
    model: path.join(layout.stagePaths.f6, "evidence", "model-interpretation", "Feature6-Model-Interpretation.json"),
  };
  for (const flag of ["--supplier-capability", "--datum-strategy", "--cost", "--image-observations", "--analysis-context", "--optimization-targets"]) {
    const index = args.indexOf(flag);
    if (index !== -1) files[flag] = args[index + 1];
  }
  const f3Path = path.join(layout.stagePaths.f3, "Feature3-Report.json");
  physical(f3Path);
  // Only the terminal publishing outcome and its v2 -> v3 representation may
  // change after the report-informed decision. Engineering evidence stays fixed.
  const { ado: _ado, modelVersion: _version, ...f3Analysis } = json(f3Path);
  return {
    analysisRoot: layout.analysisRoot,
    workbookContentHash: layout.workbookContentHash,
    invocationHash: digest(JSON.stringify(args.filter((arg) => arg !== "--candidate"))),
    sources: Object.fromEntries(Object.entries(files).map(([key, file]) => [key, hashFile(file)])),
    f3AnalysisHash: digest(JSON.stringify(f3Analysis)),
  };
}
function atomicReceipt(file, value) {
  const staging = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(staging, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
    renameSync(staging, file);
  } finally { rmSync(staging, { force: true }); }
}
function validatePublication(layout) {
  const paths = f6CandidatePaths(layout);
  physical(paths.publication, true);
  const validated = validateExistingF6(paths.publication, { publishRoot: layout.stagePaths.f6 });
  if (validated.status !== "accepted" || !validated.finalReportPdfPath) invalid();
  const optimization = json(validated.optimizationJsonPath);
  if (optimization.workbook.contentHash !== layout.workbookContentHash
    || optimization.workbook.fileName !== layout.workbookFileName
    || !validateF6WorkspaceEvidence(layout.stagePaths.f6,
      path.join(layout.stagePaths.f6, "evidence", "model-interpretation", "Feature6-Model-Interpretation.json"), optimization, true)) invalid();
  return validated;
}
function assertOwner(paths, receipt) {
  const owner = physical(paths.root, true);
  physical(paths.receipt);
  if (owner.dev !== receipt.owner?.dev || owner.ino !== receipt.owner?.ino) invalid();
}
export function beginF6Candidate(layout, args) {
  const paths = f6CandidatePaths(layout);
  physical(path.dirname(paths.root), true);
  const inputs = snapshot(layout, args);
  mkdirSync(paths.root);
  const owner = physical(paths.root, true);
  atomicReceipt(paths.receipt, { version: "f6-candidate-v1", status: "running", owner: { dev: owner.dev, ino: owner.ino }, inputs });
  return paths.publication;
}
export function sealF6Candidate(layout, args) {
  const paths = f6CandidatePaths(layout);
  const receipt = json(paths.receipt);
  assertOwner(paths, receipt);
  if (receipt.status !== "running" || !isDeepStrictEqual(receipt.inputs, snapshot(layout, args))) invalid();
  const validated = validatePublication(layout);
  const hashes = Object.fromEntries(readdirSync(paths.publication).map((name) => [name, hashFile(path.join(paths.publication, name))]));
  atomicReceipt(paths.receipt, { ...receipt, status: "validated", hashes });
  return {
    status: "candidate_validated",
    candidate: {
      internalOnly: true,
      reportSummary: validated.reportSummary,
      reportMarkdownPath: validated.finalReportMarkdownPath,
      reportPdfPath: validated.finalReportPdfPath,
    },
  };
}
export function validateF6Candidate(layout, args) {
  const paths = f6CandidatePaths(layout);
  physical(paths.receipt);
  const receipt = json(paths.receipt);
  assertOwner(paths, receipt);
  if (receipt.version !== "f6-candidate-v1" || receipt.status !== "validated"
    || !isDeepStrictEqual(readdirSync(paths.root).sort(), ["publication", "receipt.json"])
    || !isDeepStrictEqual(receipt.inputs, snapshot(layout, args))) invalid();
  validatePublication(layout);
  const hashes = Object.fromEntries(readdirSync(paths.publication).map((name) => [name, hashFile(path.join(paths.publication, name))]));
  if (!isDeepStrictEqual(hashes, receipt.hashes)) invalid();
  return paths;
}
export function consumeF6Candidate(layout, args) {
  const paths = validateF6Candidate(layout, args);
  const report = json(path.join(layout.stagePaths.f3, "Feature3-Report.json"));
  if (!["not_requested", "updated", "blocked", "failed"].includes(report.ado?.status)) invalid();
  // This is the exact owned, validated candidate tree, never a final publication.
  rmSync(paths.root, { recursive: true });
}
