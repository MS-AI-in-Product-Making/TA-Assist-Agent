import type { F2UserReport } from "@ai-assist/contracts";

export interface WorkbookHealthModel {
  readonly summary: readonly { readonly label: string; readonly value: number; readonly tone: "neutral" | "warning" | "critical" }[];
  readonly findings: readonly { readonly worksheetName?: string; readonly sourceRows: readonly number[]; readonly message: string; readonly kind: "field" | "image" | "identifier" | "capability" }[];
}

export function projectWorkbookHealth(report: F2UserReport | undefined): WorkbookHealthModel | undefined {
  if (report === undefined || report.status === "inputRejected") return undefined;
  const summary = report.summary;
  const findings: WorkbookHealthModel["findings"][number][] = [];
  for (const worksheet of report.worksheets) {
    for (const missing of worksheet.missingFieldSummary) findings.push({ worksheetName: worksheet.worksheetName, sourceRows: missing.sourceRows, message: `${fieldLabel(missing.field)} is missing and affects ${missing.factorCount} factors`, kind: missing.field === "tolerancePathImage" ? "image" : "field" });
    if (worksheet.tolerancePathImageStatus !== "available") findings.push({ worksheetName: worksheet.worksheetName, sourceRows: [], message: "Tolerance loop stack-up image is missing", kind: "image" });
  }
  if (summary.missingDimIdCount > 0 || summary.missingPartNumberCount > 0) findings.push({ sourceRows: [], message: `DIM ID missing ${summary.missingDimIdCount}; Drawing / Part Number missing ${summary.missingPartNumberCount}`, kind: "identifier" });
  if (summary.f0InformationInsufficientCount > 0 || summary.nonF0ProcessCategoryCount > 0) findings.push({ sourceRows: [], message: `F0 information insufficient ${summary.f0InformationInsufficientCount}; Non-F0 process category ${summary.nonF0ProcessCategoryCount}`, kind: "capability" });
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

function fieldLabel(field: string): string {
  return ({ factorName: "Factor Description", tolerancePathImage: "Tolerance loop stack-up image" } as Record<string, string>)[field] ?? field;
}
