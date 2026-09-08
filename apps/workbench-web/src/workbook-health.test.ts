import { expect, it } from "vitest";
import type { F2FindingsDecisionProjection, F2UserReport } from "@ai-assist/contracts";
import { projectWorkbookHealth, projectWorkbookHealthFindings } from "./workbook-health.js";

it("projects workbook summary and linked missing evidence", () => {
  const report = { status: "partiallyBlocked", summary: { worksheetsChecked: 7, readyWorksheetCount: 5, blockedWorksheetCount: 2, requiredMissingFieldCount: 1, missingImageWorksheetCount: 1, missingDimIdCount: 50, missingPartNumberCount: 50, f0InformationInsufficientCount: 33, nonF0ProcessCategoryCount: 10 }, worksheets: [{ worksheetName: "gap w foam_static", tolerancePathImageStatus: "unavailable", rows: [], missingFieldSummary: [{ field: "tolerancePathImage", factorCount: 0, sourceRows: [] }] }, { worksheetName: "gap w foam_TPoverload500g", tolerancePathImageStatus: "available", rows: [{ sourceRow: 16, missingRequiredFields: ["factorName"] }], missingFieldSummary: [{ field: "factorName", factorCount: 1, sourceRows: [16] }] }] } as unknown as F2UserReport;
  const model = projectWorkbookHealth(report)!;
  expect(model.summary.map(({ value }) => value)).toEqual([7, 5, 2, 1, 1]);
  expect(model.findings).toEqual(expect.arrayContaining([expect.objectContaining({ worksheetName: "gap w foam_static", kind: "image" }), expect.objectContaining({ worksheetName: "gap w foam_TPoverload500g", sourceRows: [16] }), expect.objectContaining({ message: expect.stringContaining("DIM ID missing 50") })]));
  expect(model.findings.filter((finding) => finding.kind === "image")).toHaveLength(1);
  expect(model.findings.map(({ message }) => message).join(" ")).not.toMatch(/\b(?:F|Feature)[0-7]\b/i);
});

it("presents identifier findings as warnings and each image blocker once", () => {
  const decision = {
    contractVersion: "f2-findings-decision-projection-v1",
    workbookHash: "a".repeat(64),
    inputRevision: 3,
    f2ReportArtifactId: "f2-report-3",
    f2ReportContentHash: "b".repeat(64),
    findingDigest: "c".repeat(64),
    worksheetFindings: [
      {
        contractVersion: "f2-worksheet-finding-projection-v1",
        worksheetName: "Identifier Only",
        readiness: "downstream_ready",
        identifierWarnings: ["drawing_number_missing", "dim_id_missing"],
        blockers: [],
        sourceRows: [12],
      },
      {
        contractVersion: "f2-worksheet-finding-projection-v1",
        worksheetName: "Missing Image",
        readiness: "blocked",
        identifierWarnings: [],
        blockers: ["tolerance_path_image_missing"],
        sourceRows: [],
      },
    ],
    downstreamReadyWorksheetNames: ["Identifier Only"],
  } as F2FindingsDecisionProjection;

  const findings = projectWorkbookHealthFindings(decision);

  expect(findings.filter((finding) => finding.worksheetName === "Identifier Only")).toEqual([
    expect.objectContaining({ kind: "identifier", tone: "warning", sourceRows: [12] }),
  ]);
  expect(findings.filter((finding) => finding.worksheetName === "Missing Image")).toEqual([
    expect.objectContaining({ kind: "image", tone: "critical", sourceRows: [] }),
  ]);
});
