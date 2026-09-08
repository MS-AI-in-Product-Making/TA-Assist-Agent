import type { F2FindingsDecisionProjection, F2UserReport } from "@ai-assist/contracts";

export interface WorkbookHealthFinding {
  readonly worksheetName?: string;
  readonly sourceRows: readonly number[];
  readonly message: string;
  readonly kind: "field" | "image" | "identifier" | "capability";
  readonly tone: "warning" | "critical";
}

export interface WorkbookHealthModel {
  readonly summary: readonly { readonly label: string; readonly value: number; readonly tone: "neutral" | "warning" | "critical" }[];
  readonly findings: readonly WorkbookHealthFinding[];
}

export function projectWorkbookHealth(report: F2UserReport | undefined): WorkbookHealthModel | undefined {
  if (report === undefined || report.status === "inputRejected") return undefined;
  const summary = report.summary;
  const findings: WorkbookHealthModel["findings"][number][] = [];
  for (const worksheet of report.worksheets) {
    const missingFields = new Map<string, number[]>();
    for (const row of worksheet.rows) {
      for (const field of row.missingRequiredFields) {
        const sourceRows = missingFields.get(field) ?? [];
        sourceRows.push(row.sourceRow);
        missingFields.set(field, sourceRows);
      }
    }
    for (const [field, sourceRows] of missingFields) {
      const uniqueSourceRows = [...new Set(sourceRows)].sort((left, right) => left - right);
      findings.push({ worksheetName: worksheet.worksheetName, sourceRows: uniqueSourceRows, message: `${fieldLabel(field)} is missing and affects ${uniqueSourceRows.length} factors`, kind: "field", tone: "critical" });
    }
    if (worksheet.tolerancePathImageStatus === "unavailable") {
      findings.push({ worksheetName: worksheet.worksheetName, sourceRows: [], message: "Tolerance loop stack-up image is missing", kind: "image", tone: "critical" });
    }
  }
  if (summary.missingDimIdCount > 0 || summary.missingPartNumberCount > 0) findings.push({ sourceRows: [], message: `DIM ID missing ${summary.missingDimIdCount}; Drawing Number missing ${summary.missingPartNumberCount}`, kind: "identifier", tone: "warning" });
  if (summary.f0InformationInsufficientCount > 0 || summary.nonF0ProcessCategoryCount > 0) findings.push({ sourceRows: [], message: `Knowledge Library information insufficient ${summary.f0InformationInsufficientCount}; Unrecognized process category ${summary.nonF0ProcessCategoryCount}`, kind: "capability", tone: "warning" });
  return {
    summary: [
      { label: "Worksheets", value: summary.worksheetsChecked, tone: "neutral" },
      { label: "Ready", value: summary.readyWorksheetCount, tone: "neutral" },
      { label: "Blocked", value: summary.blockedWorksheetCount, tone: summary.blockedWorksheetCount > 0 ? "critical" : "neutral" },
      { label: "Missing fields", value: summary.requiredMissingFieldCount, tone: summary.requiredMissingFieldCount > 0 ? "warning" : "neutral" },
      { label: "Missing images", value: summary.missingImageWorksheetCount, tone: summary.missingImageWorksheetCount > 0 ? "warning" : "neutral" },
    ],
    findings,
  };
}

export function projectWorkbookHealthFindings(
  projection: F2FindingsDecisionProjection,
): readonly WorkbookHealthFinding[] {
  return projection.worksheetFindings.flatMap((worksheet) => {
    const findings: WorkbookHealthFinding[] = [];
    if (worksheet.identifierWarnings.length > 0) {
      findings.push({
        worksheetName: worksheet.worksheetName,
        sourceRows: worksheet.sourceRows,
        message: worksheet.identifierWarnings.map(identifierWarningLabel).join("; "),
        kind: "identifier",
        tone: "warning",
      });
    }
    for (const blocker of worksheet.blockers) {
      findings.push({
        worksheetName: worksheet.worksheetName,
        sourceRows: worksheet.sourceRows,
        message: blockerLabel(blocker),
        kind: blocker === "tolerance_path_image_missing" ? "image" : "field",
        tone: "critical",
      });
    }
    return findings;
  });
}

function identifierWarningLabel(warning: string): string {
  return warning === "drawing_number_missing" ? "Drawing Number is missing" : "DIM ID is missing";
}

function blockerLabel(blocker: string): string {
  if (blocker === "tolerance_path_image_missing") return "Tolerance loop stack-up image is missing";
  if (blocker.startsWith("required_field_missing:")) return `${fieldLabel(blocker.slice("required_field_missing:".length))} is missing`;
  return blocker;
}

function fieldLabel(field: string): string {
  return ({ factorName: "Factor Description", tolerancePathImage: "Tolerance loop stack-up image" } as Record<string, string>)[field] ?? field;
}
