import { describe, expect, it } from "vitest";
import { renderF2Report } from "./f2-report.mjs";

function actualFields(overrides = {}) {
  return {
    factorName: "left|right",
    partName: null,
    drawingNumber: "DWG-1",
    dimCharacteristicId: null,
    partCategory: "demo",
    nominalValue: null,
    upperTolerance: 0.2,
    lowerTolerance: -0.2,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "Normal",
    mean: 3.145,
    tolerance: 0.2,
    oneSigma: 0.05,
    percentContributionToSigma: 12.5,
    notes: null,
    ...overrides,
  };
}

describe("renderF2Report", () => {
  it("renders one readable enhanced row without internal issue terminology", () => {
    const markdown = renderF2Report({
      status: "blocked",
      workbook: { fileName: "Demo|Book.xlsx", contentHash: "a".repeat(64), f1GeneratedAt: "2026-08-03T00:00:00.000Z" },
      knowledgeBaseVersions: ["v1", "internal-v1"],
      mappingRuleVersion: "v1",
      artifactRoot: "test/demo-output/feature1-output/Demo",
      summary: { worksheetsChecked: 1, blockedWorksheetCount: 1, readyWorksheetCount: 0, factorRowCount: 1, rowsWithRequiredMissing: 1, requiredMissingFieldCount: 2, missingImageWorksheetCount: 0, internalWithinGuidanceCount: 0, internalGuidanceExceededCount: 0, f0InformationInsufficientCount: 0, publicLibraryMatchCount: 0, nonF0ProcessCategoryCount: 0, unableToCheckCount: 1, publicToleranceDifferenceCount: 0, publicDistributionDifferenceCount: 0, missingDimIdCount: 1, missingPartNumberCount: 1 },
      worksheets: [{
        worksheetName: "A|B",
        status: "blocked",
        tolerancePathImageStatus: "available",
        missingFieldSummary: [
          { field: "partName", factorCount: 1, sourceRows: [2] },
          { field: "nominalValue", factorCount: 1, sourceRows: [2] },
        ],
        rows: [{
          sourceRow: 2,
          actualFields: actualFields(),
          imageTarget: { relativePath: `images/${"b".repeat(64)}.png`, contentHash: "b".repeat(64) },
          capabilityStatus: "unable_to_check",
        }],
      }],
      adoEvents: [{ eventType: "adoReminderRequested", category: "demo", worksheetName: "A|B", missingFields: ["dimCharacteristicId", "partNumber"], factorRows: [2] }],
    });

    for (const heading of ["执行摘要", "缺失字段统计", "增强 Raw Data", "能力库结果", "知识库推荐", "标识符提醒清单", "待触发"]) {
      expect(markdown).toContain(heading);
    }
    expect(markdown).toContain("请修正 TA Excel 源文件并重新运行 F1");
    expect(markdown).toContain("Demo\\|Book.xlsx");
    expect(markdown).toContain(`[left\\|right](images/${"b".repeat(64)}.png)`);
    expect(markdown).toContain(`[—](images/${"b".repeat(64)}.png)`);
    expect(markdown).toContain("| — | 0.2 | -0.2 | 1 | 4 | Normal | 3.145 | 0.2 | 0.05 | 12.5 | — |");
    expect(markdown.split("\n").filter((line) => line.includes("left\\|right"))).toHaveLength(1);
    expect(markdown).not.toContain("displayedFields");
    for (const internalTerm of ["required_field_unavailable", "tableId", "reasonCode", "governanceSignals"]) {
      expect(markdown).not.toContain(internalTerm);
    }
  });

  it("renders internal F0 guidance without leaking source metadata", () => {
    const report = {
      status: "completed",
      workbook: { fileName: "Demo.xlsx", contentHash: "a".repeat(64), f1GeneratedAt: "2026-08-03T00:00:00.000Z" },
      knowledgeBaseVersions: ["v1", "internal-v1"], mappingRuleVersion: "v1", artifactRoot: "artifacts/Demo",
      summary: { worksheetsChecked: 1, blockedWorksheetCount: 0, readyWorksheetCount: 1, factorRowCount: 1, rowsWithRequiredMissing: 0, requiredMissingFieldCount: 0, missingImageWorksheetCount: 0, internalWithinGuidanceCount: 1, internalGuidanceExceededCount: 0, f0InformationInsufficientCount: 0, publicLibraryMatchCount: 0, nonF0ProcessCategoryCount: 0, unableToCheckCount: 0, publicToleranceDifferenceCount: 0, publicDistributionDifferenceCount: 0, missingDimIdCount: 0, missingPartNumberCount: 0 },
      worksheets: [{ worksheetName: "Analysis-A", status: "ready", tolerancePathImageStatus: "available", missingFieldSummary: [], rows: [{ sourceRow: 2, actualFields: actualFields({ factorName: "boss height", partName: "bucket", dimCharacteristicId: "DIM", partCategory: "CNC", nominalValue: 3.145, upperTolerance: 0.1, lowerTolerance: -0.1 }), capabilityStatus: "internal_within_guidance", recommendation: { kind: "internal-guidance", assessedTotalBand: 0.2, maximumRecommendedTotalBand: 0.2, unit: "mm", matchedEntryId: "cnc-linear-6", fallbackApplied: false, evidence: { sourceFileHash: "c".repeat(64), sheetName: "ISO 2768-1 Class m", sourceRange: "A6:F6" } } }] }],
      adoEvents: [],
    };
    const markdown = renderF2Report(report);
    expect(markdown).toContain("F0 内部指导-符合");
    expect(markdown).toContain("最大总公差带 0.2 mm · internal-v1 · cnc-linear-6");
    expect(markdown).not.toContain("controlled-cnc.xlsx");
    expect(markdown).not.toContain("c".repeat(64));
  });

  it("renders artifact rejection as an actionable input report", () => {
    const markdown = renderF2Report({
      status: "inputRejected",
      artifactRoot: "test/demo-output/feature1-output/Demo",
      artifactIssues: [{ reasonCode: "root_md_missing", artifactPath: "Feature1-Report.md" }],
    });

    expect(markdown).toContain("F1 输出不完整");
    expect(markdown).toContain("Feature1-Report.md");
  });
});