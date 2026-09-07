import { describe, expect, it } from "vitest";

import { taEngineeringReportProjectionSchema } from "./ta-report-contracts.js";

describe("taEngineeringReportProjectionSchema", () => {
  it("accepts markdown/reportSummary/structured projection", () => {
    const parsed = taEngineeringReportProjectionSchema.parse({
      markdown: "# TA Engineering Analysis Report\n",
      reportSummary: {
        workbookDisposition: "FAIL",
        worksheetDispositions: [
          { worksheetName: "Analysis-A", disposition: "PASS" },
          { worksheetName: "Analysis-B", disposition: "FAIL" },
        ],
      },
      projection: {
        schemaVersion: "ta-engineering-report-projection-v1",
        title: "TA Engineering Analysis Report",
        workbookDisposition: "FAIL",
        worksheetDispositions: [
          { worksheetName: "Analysis-A", disposition: "PASS" },
          { worksheetName: "Analysis-B", disposition: "FAIL" },
        ],
        workbook: {
          fileName: "Anonymous.xlsx",
          revision: "D",
          contentHash: "a".repeat(64),
        },
        worksheets: [
          {
            worksheetName: "Analysis-A",
            toleranceLoopDescription: "Loop A",
            disposition: "PASS",
            requiredAction: "None",
            findings: ["ok"],
            assumptions: ["as-designed"],
            clarifications: [],
            gatingEvidenceReferences: ["F3:Analysis-A"],
          },
          {
            worksheetName: "Analysis-B",
            toleranceLoopDescription: "Loop B",
            disposition: "FAIL",
            requiredAction: "Engineering review required before release decision",
            findings: ["blocked"],
            assumptions: [],
            clarifications: ["Need image evidence"],
            gatingEvidenceReferences: ["F5:Analysis-B"],
          },
        ],
      },
    });

    expect(parsed.projection.schemaVersion).toBe("ta-engineering-report-projection-v1");
  });

  it("rejects unknown fields and invalid workbook hash", () => {
    const candidate = {
      markdown: "# TA Engineering Analysis Report\n",
      reportSummary: {
        workbookDisposition: "PASS",
        worksheetDispositions: [{ worksheetName: "Analysis-A", disposition: "PASS" }],
      },
      projection: {
        schemaVersion: "ta-engineering-report-projection-v1",
        title: "TA Engineering Analysis Report",
        workbookDisposition: "PASS",
        worksheetDispositions: [{ worksheetName: "Analysis-A", disposition: "PASS" }],
        workbook: {
          fileName: "Anonymous.xlsx",
          revision: "D",
          contentHash: "A".repeat(64),
        },
        worksheets: [
          {
            worksheetName: "Analysis-A",
            toleranceLoopDescription: "Loop A",
            disposition: "PASS",
            requiredAction: "None",
            findings: ["ok"],
            assumptions: [],
            clarifications: [],
            gatingEvidenceReferences: ["F3:Analysis-A"],
            extraField: true,
          },
        ],
      },
    };

    expect(taEngineeringReportProjectionSchema.safeParse(candidate).success).toBe(false);
  });

  it.each(["Source", "Evidence", "Provenance", "来源", "证据"])(
    "rejects a %s Markdown display column",
    (column) => {
      const candidate = {
        markdown: `# Report\n\n| Metric | ${column} |\n|---|---|\n| Cpk | F4 |\n`,
        reportSummary: {
          workbookDisposition: "PASS",
          worksheetDispositions: [{ worksheetName: "Analysis-A", disposition: "PASS" }],
        },
        projection: {
          schemaVersion: "ta-engineering-report-projection-v1",
          title: "Report",
          workbookDisposition: "PASS",
          worksheetDispositions: [{ worksheetName: "Analysis-A", disposition: "PASS" }],
          workbook: { fileName: "Anonymous.xlsx", contentHash: "a".repeat(64) },
          worksheets: [{
            worksheetName: "Analysis-A",
            toleranceLoopDescription: "Loop A",
            disposition: "PASS",
            requiredAction: "None",
            findings: ["ok"],
            assumptions: [],
            clarifications: [],
            gatingEvidenceReferences: ["F4:Analysis-A"],
          }],
        },
      };

      expect(taEngineeringReportProjectionSchema.safeParse(candidate).success).toBe(false);
    },
  );
});
