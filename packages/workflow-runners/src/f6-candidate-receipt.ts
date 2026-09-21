import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { createF6ReportFileNames, F6_CANDIDATE_RECEIPT_FILE_NAME, f6CandidateIntentSchema, f6CandidateReceiptSchema } from "@ai-assist/contracts";
import { ANALYSIS_STAGE_DIRS } from "./analysis-workspace.js";

// Reject markers without parsing: malformed/dangling markers are still a
// declaration that this directory is not publicly presentable final output.
export function hasF6CandidateMarker(directory: string): boolean {
  let current = path.resolve(directory);
  for (;;) {
    try {
      lstatSync(path.join(current, F6_CANDIDATE_RECEIPT_FILE_NAME));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return true;
    }
    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

function physical(target: string, directory = false) {
  const absolute = path.resolve(target);
  let current = path.parse(absolute).root;
  for (const segment of path.relative(current, absolute).split(path.sep)) {
    current = path.join(current, segment);
    if (lstatSync(current).isSymbolicLink()) throw new Error("Candidate evidence must be physical.");
  }
  const stats = lstatSync(absolute);
  if (realpathSync(absolute) !== absolute || (directory ? !stats.isDirectory() : !stats.isFile())) {
    throw new Error("Candidate evidence identity is invalid.");
  }
  return stats;
}
function hash(file: string) { return createHash("sha256").update(readFileSync(file)).digest("hex"); }
function sameIdentity(stats: { dev: number; ino: number }, expected: { dev: number; ino: number }) {
  return stats.dev === expected.dev && stats.ino === expected.ino;
}

export function validateF6CandidateReceipt(publicationRoot: string, expected?: { analysisRoot: string; workbookFileName: string; workbookContentHash: string }): boolean {
  try {
    const marker = path.join(publicationRoot, F6_CANDIDATE_RECEIPT_FILE_NAME);
    physical(marker);
    const receipt = f6CandidateReceiptSchema.parse(JSON.parse(readFileSync(marker, "utf8")));
    const root = path.dirname(publicationRoot);
    const expectedRoot = path.join(receipt.inputs.analysisRoot, ANALYSIS_STAGE_DIRS.f6, "evidence", "candidate");
    if (root !== expectedRoot || publicationRoot !== path.join(root, "publication")) return false;
    if (expected && (receipt.inputs.analysisRoot !== expected.analysisRoot
      || receipt.inputs.workbookFileName !== expected.workbookFileName
      || receipt.inputs.workbookContentHash !== expected.workbookContentHash)) return false;
    if (!sameIdentity(physical(root, true), receipt.owner)
      || !sameIdentity(physical(publicationRoot, true), receipt.publicationOwner)) return false;
    const intentPath = path.join(root, F6_CANDIDATE_RECEIPT_FILE_NAME);
    physical(intentPath);
    const intent = f6CandidateIntentSchema.parse(JSON.parse(readFileSync(intentPath, "utf8")));
    if (hash(intentPath) !== receipt.intentSha256 || !isDeepStrictEqual(intent.inputs, receipt.inputs)
      || !isDeepStrictEqual(intent.owner, receipt.owner)) return false;
    const { finalReportMdName, finalReportPdfName } = createF6ReportFileNames(receipt.inputs.workbookFileName);
    const names = ["Feature6-Optimization.json", finalReportMdName, finalReportPdfName, "Feature6-Run-Summary.json", "manifest.json"].sort();
    if (!isDeepStrictEqual(Object.keys(receipt.files).sort(), names)
      || !isDeepStrictEqual(readdirSync(root).sort(), [F6_CANDIDATE_RECEIPT_FILE_NAME, "publication"].sort())
      || !isDeepStrictEqual(readdirSync(publicationRoot).sort(), [...names, F6_CANDIDATE_RECEIPT_FILE_NAME].sort())) return false;
    if (JSON.parse(readFileSync(path.join(publicationRoot, "manifest.json"), "utf8")).internalOnly !== true) return false;
    return names.every((name) => {
      const file = path.join(publicationRoot, name);
      const expectedFile = receipt.files[name]!;
      return sameIdentity(physical(file), expectedFile) && hash(file) === expectedFile.sha256;
    });
  } catch { return false; }
}
