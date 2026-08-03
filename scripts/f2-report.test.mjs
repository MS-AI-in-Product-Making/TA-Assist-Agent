import { describe, expect, it } from "vitest";
import { renderF2Report } from "./f2-report.mjs";

describe("renderF2Report", () => {
  it("renders statuses, evidence, mapping, governance and escaped sources", () => {
    const markdown = renderF2Report({
      status: "partiallyBlocked",
      knowledgeBaseVersion: "v1",
      mappingRuleVersion: "v1",
      workbookContentHash: "a".repeat(64),
      toleranceUnitAssumption: "mm",
      summary: { worksheetsChecked: 1, readyForNextFeatureCount: 0, blockedWorksheetCount: 1, blockingIssueCount: 1, mappingRecordCount: 1, capabilityCheckCount: 1, governanceSignalCount: 1 },
      worksheets: [{
        worksheetName: "A|B\nC",
        status: "blocked",
        blockingIssues: [{ issueCode: "tolerance_out_of_range", tableId: "table-1", sourceRow: 2, sourceCell: "A!E2" }],
        capabilityChecks: [{ itemId: "item-1", capabilityEntryId: "cap-1", status: "tolerance_out_of_range", totalTolerance: 0.4, unit: "mm", actualDistribution: "uniform", recommendedDistribution: "normal", tableId: "table-1", sourceRow: 2 }],
        mappingRecords: [{ status: "item_ambiguous", partCategory: "demo", factorName: "left|right", partName: "line\n2", tableId: "table-1", sourceRow: 2, candidates: [{ itemId: "item-1", hitKeywords: ["left"] }] }],
        governanceSignals: [{ signalKind: "dim_id_duplicate", field: "dimCharacteristicId", tableId: "table-1", sourceRow: 2, sourceCell: "A!K2", normalizedDimId: "DIM-1" }],
      }],
    }, "Demo|Book.xlsx");

    expect(markdown).toContain("Overall status: partiallyBlocked");
    expect(markdown).toContain("tolerance_out_of_range");
    expect(markdown).toContain("item-1: left");
    expect(markdown).toContain("dim_id_duplicate");
    expect(markdown).toContain("A!E2");
    expect(markdown).toContain("Demo\\|Book.xlsx");
    expect(markdown).toContain("A\\|B<br>C");
    expect(markdown).toContain("left\\|right; line<br>2");
  });
});