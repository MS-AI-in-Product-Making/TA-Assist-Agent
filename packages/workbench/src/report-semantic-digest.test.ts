import { describe, expect, it } from "vitest";

import { computeTaReportSemanticDigest } from "./report-semantic-digest.js";

function baseProjection() {
  return {
    schemaVersion: "ta-engineering-report-projection-v1",
    title: "TA 工程分析报告",
    workbookDisposition: "CONDITIONAL_PASS",
    worksheetDispositions: [
      { worksheetName: "Analysis-A", disposition: "PASS" },
      { worksheetName: "Analysis-B", disposition: "CONDITIONAL_PASS" },
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
        metrics: { mean: 12.3, cp: 1.4, cpk: 1.3, yield: 99.2, dpm: 8000 },
        findings: ["Numeric and governance checks passed"],
        assumptions: ["Assembly baseline unchanged"],
        clarifications: [],
        gatingEvidenceReferences: ["F3:Analysis-A", "F5:Analysis-A"],
      },
      {
        worksheetName: "Analysis-B",
        toleranceLoopDescription: "Loop B",
        disposition: "CONDITIONAL_PASS",
        requiredAction: "Close F3/F5 engineering review items",
        metrics: { mean: 13.1, cp: 1.2, cpk: 1.0, yield: 98.5, dpm: 15000 },
        findings: ["Open review items remain"],
        assumptions: [],
        clarifications: ["Need DIM ID confirmation"],
        gatingEvidenceReferences: ["F3:Analysis-B"],
      },
    ],
  };
}

describe("computeTaReportSemanticDigest", () => {
  it("permits display labels but rejects engineering semantic changes", () => {
    const base = baseProjection();

    expect(computeTaReportSemanticDigest(base)).toBe(
      computeTaReportSemanticDigest({ ...base, title: "TA Engineering Analysis Report" }),
    );
    expect(computeTaReportSemanticDigest(base)).not.toBe(
      computeTaReportSemanticDigest({ ...base, workbookDisposition: "PASS" }),
    );
  });

  it("detects worksheet order, metrics, findings, assumptions, clarifications, gates, and evidence drift", () => {
    const base = baseProjection();

    expect(computeTaReportSemanticDigest(base)).not.toBe(
      computeTaReportSemanticDigest({
        ...base,
        worksheetDispositions: [...base.worksheetDispositions].reverse(),
      }),
    );

    expect(computeTaReportSemanticDigest(base)).not.toBe(
      computeTaReportSemanticDigest({
        ...base,
        worksheets: base.worksheets.map((worksheet) =>
          worksheet.worksheetName === "Analysis-A"
            ? { ...worksheet, metrics: { ...worksheet.metrics, cp: 1.1 } }
            : worksheet,
        ),
      }),
    );

    expect(computeTaReportSemanticDigest(base)).not.toBe(
      computeTaReportSemanticDigest({
        ...base,
        worksheets: base.worksheets.map((worksheet) =>
          worksheet.worksheetName === "Analysis-A"
            ? { ...worksheet, findings: ["Numeric checks failed"] }
            : worksheet,
        ),
      }),
    );

    expect(computeTaReportSemanticDigest(base)).not.toBe(
      computeTaReportSemanticDigest({
        ...base,
        worksheets: base.worksheets.map((worksheet) =>
          worksheet.worksheetName === "Analysis-B"
            ? { ...worksheet, assumptions: ["Fixture changed"] }
            : worksheet,
        ),
      }),
    );

    expect(computeTaReportSemanticDigest(base)).not.toBe(
      computeTaReportSemanticDigest({
        ...base,
        worksheets: base.worksheets.map((worksheet) =>
          worksheet.worksheetName === "Analysis-B"
            ? { ...worksheet, clarifications: ["Need new evidence"] }
            : worksheet,
        ),
      }),
    );

    expect(computeTaReportSemanticDigest(base)).not.toBe(
      computeTaReportSemanticDigest({
        ...base,
        worksheets: base.worksheets.map((worksheet) =>
          worksheet.worksheetName === "Analysis-A"
            ? { ...worksheet, gatingEvidenceReferences: ["F3:Analysis-A"] }
            : worksheet,
        ),
      }),
    );
  });
});
