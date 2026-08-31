import { expect, it } from "vitest";
import type { F2UserReport } from "@ai-assist/contracts";
import { projectWorkbookHealth } from "./workbook-health.js";

it("projects workbook summary and linked missing evidence", () => {
  const report = { status: "partiallyBlocked", summary: { worksheetsChecked: 7, readyWorksheetCount: 5, blockedWorksheetCount: 2, requiredMissingFieldCount: 1, missingImageWorksheetCount: 1, missingDimIdCount: 50, missingPartNumberCount: 50, f0InformationInsufficientCount: 33, nonF0ProcessCategoryCount: 10 }, worksheets: [{ worksheetName: "gap w foam_static", tolerancePathImageStatus: "missing", missingFieldSummary: [] }, { worksheetName: "gap w foam_TPoverload500g", tolerancePathImageStatus: "available", missingFieldSummary: [{ fieldName: "Factor Description", affectedFactorCount: 1, sourceRows: [16] }] }] } as unknown as F2UserReport;
  const model = projectWorkbookHealth(report)!;
  expect(model.summary.map(({ value }) => value)).toEqual([7, 5, 2, 1, 1]);
  expect(model.findings).toEqual(expect.arrayContaining([expect.objectContaining({ worksheetName: "gap w foam_static", kind: "image" }), expect.objectContaining({ worksheetName: "gap w foam_TPoverload500g", sourceRows: [16] }), expect.objectContaining({ message: expect.stringContaining("DIM ID missing 50") })]));
});
