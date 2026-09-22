import { createHash, randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { validateAnalysisWorkspaceSummary, validateExistingF6, validateF6CandidateReceipt, validateF6WorkspaceEvidence } from "../packages/workflow-runners/dist/index.js";
import { inspectInternalF6Candidate } from "../packages/workflow-runners/dist/existing-f6.js";
import { F6_CANDIDATE_RECEIPT_FILE_NAME, f6CandidateIntentSchema, f6CandidateReceiptSchema } from "../packages/contracts/dist/index.js";

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
  const publication = path.join(root, "publication");
  return { root, publication, intent: path.join(root, F6_CANDIDATE_RECEIPT_FILE_NAME), receipt: path.join(publication, F6_CANDIDATE_RECEIPT_FILE_NAME) };
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
    workbookFileName: layout.workbookFileName,
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
  const validated = inspectInternalF6Candidate(paths.publication, { publishRoot: layout.stagePaths.f6 });
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
  physical(paths.intent);
  if (owner.dev !== receipt.owner?.dev || owner.ino !== receipt.owner?.ino) invalid();
}
export function beginF6Candidate(layout, args) {
  const paths = f6CandidatePaths(layout);
  physical(path.dirname(paths.root), true);
  const inputs = snapshot(layout, args);
  mkdirSync(paths.root);
  const owner = physical(paths.root, true);
  atomicReceipt(paths.intent, {
    version: "f6-candidate-intent-v1", internalOnly: true, status: "running",
    owner: { dev: owner.dev, ino: owner.ino }, inputs,
  });
  return paths.publication;
}
export function sealF6Candidate(layout, args) {
  const paths = f6CandidatePaths(layout);
  const intent = f6CandidateIntentSchema.parse(json(paths.intent));
  assertOwner(paths, intent);
  if (!isDeepStrictEqual(intent.inputs, snapshot(layout, args))) invalid();
  const validated = validatePublication(layout);
  const publicationOwner = physical(paths.publication, true);
  const files = Object.fromEntries(readdirSync(paths.publication).map((name) => {
    const file = path.join(paths.publication, name);
    const stats = physical(file);
    return [name, { dev: stats.dev, ino: stats.ino, sha256: hashFile(file) }];
  }));
  atomicReceipt(paths.receipt, f6CandidateReceiptSchema.parse({
    version: "f6-candidate-receipt-v1", internalOnly: true, status: "validated",
    owner: intent.owner, publicationOwner: { dev: publicationOwner.dev, ino: publicationOwner.ino },
    inputs: intent.inputs, intentSha256: hashFile(paths.intent), files,
  }));
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
  const receipt = f6CandidateReceiptSchema.parse(json(paths.receipt));
  assertOwner(paths, receipt);
  if (!validateF6CandidateReceipt(paths.publication, {
    analysisRoot: layout.analysisRoot, workbookFileName: layout.workbookFileName, workbookContentHash: layout.workbookContentHash,
  })
    || !isDeepStrictEqual(receipt.inputs, snapshot(layout, args))) invalid();
  validatePublication(layout);
  return paths;
}
function pin(target, directory = false) {
  const stats = physical(target, directory);
  return Object.freeze({ path: target, directory, dev: stats.dev, ino: stats.ino, ...(directory ? {} : { sha256: hashFile(target) }) });
}
function checkPin(pinned) {
  const stats = physical(pinned.path, pinned.directory);
  if (stats.dev !== pinned.dev || stats.ino !== pinned.ino
    || (!pinned.directory && hashFile(pinned.path) !== pinned.sha256)) invalid();
}
export function prepareF6Final(layout, args) {
  const paths = validateF6Candidate(layout, args);
  const report = json(path.join(layout.stagePaths.f3, "Feature3-Report.json"));
  if (!["not_requested", "updated", "blocked", "failed"].includes(report.ado?.status)) invalid();
  const receipt = f6CandidateReceiptSchema.parse(json(paths.receipt));
  return Object.freeze({
    paths: Object.freeze(paths),
    args: Object.freeze([...args]),
    directories: Object.freeze([layout.analysisRoot, layout.stagePaths.f6, path.dirname(paths.root), paths.root, paths.publication].map((target) => pin(target, true))),
    files: Object.freeze([...Object.keys(receipt.files).map((name) => path.join(paths.publication, name)), paths.receipt, paths.intent].map((target) => pin(target))),
  });
}

export function cleanupF6Candidate(layout, plan) {
  const summary = json(layout.summaryPath);
  validateAnalysisWorkspaceSummary(summary);
  if (summary.overallStatus !== "completed" || summary.analysisRoot !== layout.analysisRoot) invalid();
  const paths = validateF6Candidate(layout, plan.args);
  const receipt = f6CandidateReceiptSchema.parse(json(paths.receipt));
  if (!isDeepStrictEqual(plan.paths, paths)
    || !isDeepStrictEqual(plan.directories.map((entry) => entry.path),
      [layout.analysisRoot, layout.stagePaths.f6, path.dirname(paths.root), paths.root, paths.publication])
    || !isDeepStrictEqual(plan.files.map((entry) => entry.path),
      [...Object.keys(receipt.files).map((name) => path.join(paths.publication, name)), paths.receipt, paths.intent])) invalid();
  for (const pinned of [...plan.directories, ...plan.files]) checkPin(pinned);
  const final = validateExistingF6(layout.stagePaths.f6, {
    publishRoot: layout.analysisRoot,
    workspaceModelInterpretationPath: path.join(layout.stagePaths.f6, "evidence", "model-interpretation", "Feature6-Model-Interpretation.json"),
  });
  if (final.status !== "accepted") invalid();
  for (const key of ["optimizationJsonPath", "finalReportMarkdownPath", "finalReportPdfPath", "runSummaryPath", "manifestPath"]) {
    if (path.resolve(layout.analysisRoot, summary.stages.f6.artifacts[key]) !== final[key]) invalid();
  }
  function checkParents(target) {
    for (const pinned of plan.directories) {
      const relation = path.relative(pinned.path, target);
      if (!path.isAbsolute(relation) && !relation.split(path.sep).includes("..")) checkPin(pinned);
    }
  }
  // No recursive deletion: every exact file and each empty directory retains
  // its pre-publication identity. Unexpected entries or replacements stop cleanup.
  for (const pinned of plan.files.filter((file) => file.path !== plan.paths.intent)) {
    checkParents(pinned.path);
    checkPin(pinned);
    unlinkSync(pinned.path);
  }
  checkParents(plan.paths.publication);
  rmdirSync(plan.paths.publication);
  const intent = plan.files.find((file) => file.path === plan.paths.intent);
  checkParents(intent.path);
  checkPin(intent);
  unlinkSync(intent.path);
  checkParents(plan.paths.root);
  rmdirSync(plan.paths.root);
}
