import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { f2UserReportSchema } from "../packages/contracts/dist/contracts.js";

const ARTIFACT_REFERENCE = "Feature2-Report.json";

function rejected(reasonCode) {
  return {
    status: "inputRejected",
    reasonCode,
    artifactReference: ARTIFACT_REFERENCE,
  };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    return left.every((item, index) => deepEqual(item, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!Object.hasOwn(right, key) || !deepEqual(left[key], right[key])) return false;
  }
  return true;
}

function preflightEvidenceCheck(report) {
  if (!isRecord(report)) return rejected("f2_report_invalid");

  const workbookHash = isRecord(report.workbook) && typeof report.workbook.contentHash === "string"
    ? report.workbook.contentHash
    : undefined;
  const worksheets = Array.isArray(report.worksheets) ? report.worksheets : [];
  const readyWorksheets = worksheets.filter((worksheet) => isRecord(worksheet)
    && worksheet.status === "ready"
    && typeof worksheet.worksheetName === "string");
  const handoffs = Array.isArray(report.f4Handoffs) ? report.f4Handoffs : [];

  if (handoffs.length === 0 || readyWorksheets.length === 0) return rejected("no_ready_handoff");

  const seenWorksheetNames = new Set();
  for (const handoff of handoffs) {
    if (!isRecord(handoff) || typeof handoff.worksheetName !== "string") return rejected("f2_report_invalid");
    if (seenWorksheetNames.has(handoff.worksheetName)) return rejected("evidence_mismatch");
    seenWorksheetNames.add(handoff.worksheetName);

    if (workbookHash !== undefined && handoff.workbookContentHash !== workbookHash) {
      return rejected("evidence_mismatch");
    }

    const worksheet = readyWorksheets.find((entry) => entry.worksheetName === handoff.worksheetName);
    if (!worksheet) return rejected("no_ready_handoff");

    if (typeof handoff.toleranceLoopDescription === "string"
      && typeof worksheet.toleranceLoopDescription === "string"
      && handoff.toleranceLoopDescription !== worksheet.toleranceLoopDescription) {
      return rejected("evidence_mismatch");
    }

    if (!Array.isArray(handoff.factors) || !Array.isArray(worksheet.rows)) return rejected("f2_report_invalid");

    for (const factor of handoff.factors) {
      if (!isRecord(factor)
        || typeof factor.tableId !== "string"
        || typeof factor.sourceRow !== "number"
        || !Number.isInteger(factor.sourceRow)) {
        return rejected("f2_report_invalid");
      }
      const matchedRow = worksheet.rows.find((row) => isRecord(row)
        && row.tableId === factor.tableId
        && row.sourceRow === factor.sourceRow);
      if (!matchedRow) return rejected("evidence_mismatch");
      if (!deepEqual(factor.actualFields, matchedRow.actualFields)
        || !deepEqual(factor.sourceCells, matchedRow.sourceCells)) {
        return rejected("evidence_mismatch");
      }
    }
  }

  return undefined;
}

export function loadF4Handoffs(reportPath) {
  if (typeof reportPath !== "string" || reportPath.trim().length === 0) return rejected("f2_report_invalid");

  const resolvedReportPath = path.resolve(reportPath);
  if (path.basename(resolvedReportPath) !== ARTIFACT_REFERENCE || path.extname(resolvedReportPath).toLowerCase() !== ".json") {
    return rejected("f2_report_invalid");
  }

  if (!existsSync(resolvedReportPath)) return rejected("f2_report_missing");
  if (!statSync(resolvedReportPath).isFile()) return rejected("f2_report_invalid");

  let value;
  try {
    value = JSON.parse(readFileSync(resolvedReportPath, "utf8"));
  } catch {
    return rejected("f2_report_invalid");
  }

  if (isRecord(value) && value.status === "inputRejected") {
    return rejected("f2_report_invalid");
  }

  const preflightResult = preflightEvidenceCheck(value);
  if (preflightResult !== undefined) return preflightResult;

  const parsed = f2UserReportSchema.safeParse(value);
  if (!parsed.success || parsed.data.status === "inputRejected") {
    return rejected("f2_report_invalid");
  }

  return {
    status: "accepted",
    reportPath: resolvedReportPath,
    workbook: parsed.data.workbook,
    handoffs: parsed.data.f4Handoffs,
  };
}
