import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { f2UserReportSchema, f4HandoffReadySchema } from "../packages/contracts/dist/contracts.js";
import { createF4Handoff } from "../packages/workbook-catalog/dist/f4-handoff.js";

const ARTIFACT_REFERENCE = "Feature2-Report.json";
const MAX_F2_REPORT_BYTES = 5 * 1024 * 1024;

function rejected(reasonCode) {
  return {
    status: "inputRejected",
    reasonCode,
    artifactReference: ARTIFACT_REFERENCE,
  };
}

function loadAndParseJson(resolvedReportPath) {
  try {
    const stat = statSync(resolvedReportPath);
    if (!stat.isFile()) return { ok: false, rejection: rejected("f2_report_invalid") };
    if (stat.size > MAX_F2_REPORT_BYTES) return { ok: false, rejection: rejected("f2_report_invalid") };
    return { ok: true, value: JSON.parse(readFileSync(resolvedReportPath, "utf8")) };
  } catch (error) {
    if (error instanceof SyntaxError) return { ok: false, rejection: rejected("f2_report_invalid") };
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { ok: false, rejection: rejected("f2_report_missing") };
    }
    return { ok: false, rejection: rejected("f2_report_invalid") };
  }
}

function validateEvidenceBindings(report) {
  const readyWorksheets = report.worksheets.filter((worksheet) => worksheet.status === "ready");
  const handoffs = report.f4Handoffs;

  if (readyWorksheets.length === 0 || handoffs.length === 0) return rejected("no_ready_handoff");
  if (readyWorksheets.length !== handoffs.length) return rejected("evidence_mismatch");

  const readyWorksheetByName = new Map(readyWorksheets.map((worksheet) => [worksheet.worksheetName, worksheet]));
  const seenWorksheetNames = new Set();

  for (const handoff of handoffs) {
    if (seenWorksheetNames.has(handoff.worksheetName)) return rejected("evidence_mismatch");
    seenWorksheetNames.add(handoff.worksheetName);

    const worksheet = readyWorksheetByName.get(handoff.worksheetName);
    if (!worksheet) return rejected("no_ready_handoff");

    let expectedHandoff;
    try {
      expectedHandoff = createF4Handoff({
        workbookContentHash: report.workbook.contentHash,
        worksheet,
      });
    } catch {
      return rejected("f2_report_invalid");
    }

    let actualCanonical;
    let expectedCanonical;
    try {
      actualCanonical = f4HandoffReadySchema.parse(handoff);
      expectedCanonical = f4HandoffReadySchema.parse(expectedHandoff);
    } catch {
      return rejected("f2_report_invalid");
    }

    if (!isDeepStrictEqual(actualCanonical, expectedCanonical)) return rejected("evidence_mismatch");
  }

  if (seenWorksheetNames.size !== readyWorksheetByName.size) return rejected("evidence_mismatch");
  return undefined;
}

export function loadF4Handoffs(reportPath) {
  if (typeof reportPath !== "string" || reportPath.trim().length === 0) return rejected("f2_report_invalid");

  const resolvedReportPath = path.resolve(reportPath);
  if (path.basename(resolvedReportPath) !== ARTIFACT_REFERENCE || path.extname(resolvedReportPath).toLowerCase() !== ".json") {
    return rejected("f2_report_invalid");
  }

  const loaded = loadAndParseJson(resolvedReportPath);
  if (!loaded.ok) return loaded.rejection;

  let parsed;
  try {
    parsed = f2UserReportSchema.safeParse(loaded.value);
  } catch {
    return rejected("f2_report_invalid");
  }
  if (!parsed.success || parsed.data.status === "inputRejected") {
    return rejected("f2_report_invalid");
  }

  const evidenceValidation = validateEvidenceBindings(parsed.data);
  if (evidenceValidation !== undefined) return evidenceValidation;

  return {
    status: "accepted",
    reportPath: ARTIFACT_REFERENCE,
    workbook: parsed.data.workbook,
    handoffs: parsed.data.f4Handoffs,
  };
}
