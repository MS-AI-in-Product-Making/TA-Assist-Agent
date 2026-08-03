import { describe, expect, it } from "vitest";
import { renderF2Report } from "./f2-report.mjs";

describe("renderF2Report", () => {
  it("renders one readable enhanced row without internal issue terminology", () => {
    const markdown = renderF2Report({
      status: "blocked",
      workbook: { fileName: "Demo|Book.xlsx", contentHash: "a".repeat(64), f1GeneratedAt: "2026-08-03T00:00:00.000Z" },
      knowledgeBaseVersion: "v1",
      mappingRuleVersion: "v1",
      artifactRoot: "test/demo-output/feature1-output/Demo",
      summary: { worksheetsChecked: 1, blockedWorksheetCount: 1, readyWorksheetCount: 0, factorRowCount: 1, rowsWithRequiredMissing: 1, requiredMissingFieldCount: 2, missingImageWorksheetCount: 0, inLibraryCount: 0, outsideLibraryCount: 0, unableToCheckCount: 1, toleranceDifferenceCount: 0, distributionDifferenceCount: 0, missingDimIdCount: 1, missingPartNumberCount: 1 },
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
          displayedFields: { factorName: "left|right", partName: "（缺失）", partNumber: "（缺失）", dimCharacteristicId: "（缺失）", partCategory: "demo", nominalValue: "（缺失）", upperTolerance: "0.2", lowerTolerance: "-0.2", longTermSafetyFactor: "1", standardDeviation: "0.01", distribution: "Normal" },
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
    expect(markdown).toContain("left\\|right");
    expect(markdown.split("\n").filter((line) => line.includes("left\\|right"))).toHaveLength(1);
    for (const internalTerm of ["required_field_unavailable", "tableId", "reasonCode", "governanceSignals"]) {
      expect(markdown).not.toContain(internalTerm);
    }
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