import { describe, expect, it } from "vitest";
import { createF2UserReport } from "./f2-user-report.js";

const contentHash = "a".repeat(64);

function available(sourceCell: string, displayValue: string, numericValue?: number) {
  return {
    status: "available" as const,
    sourceCell,
    displayValue,
    actualValue: numericValue ?? displayValue,
    valueOrigin: numericValue === undefined ? "text_literal" as const : "numeric_literal" as const,
    ...(numericValue === undefined ? {} : { numericValue }),
  };
}

function unavailable(sourceCell: string) {
  return { status: "unavailable" as const, reasonCode: "missing" as const, sourceCell, displayValue: "" as const, actualValue: "" as const, valueOrigin: "missing" as const };
}

function input(fields: Record<string, unknown>, imageStatus: "available" | "unavailable" = "available") {
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    artifactRoot: "test/demo-output/feature1-output/anonymous",
    workbook: { fileName: "anonymous.xlsx", contentHash, f1GeneratedAt: "2026-08-03T00:00:00.000Z" },
    worksheets: [{
      worksheetName: "Analysis-A",
      worksheetJsonPath: "sheets/anonymous.xlsx/json/Analysis-A.json",
      worksheetMdPath: "sheets/anonymous.xlsx/md/Analysis-A.md",
      tolerancePathImage: imageStatus === "available"
        ? { status: "available", imagePath: "sheets/anonymous.xlsx/images/a.png", contentHash: "b".repeat(64) }
        : { status: "unavailable", reasonCode: "image_missing" },
      factorTables: [{
        tableId: "table-a",
        headerRow: 1,
        dataRange: { startRow: 2, endRow: 2 },
        columns: [],
        rows: [{ sourceRow: 2, fields }],
      }],
    }],
    knowledgeBaseVersion: "v1",
    mappingRuleVersion: "v1",
  };
}

function completeFields() {
  return {
    factorName: available("Analysis-A!A2", "bracket arm"),
    partName: available("Analysis-A!B2", "component"),
    partNumber: unavailable("Analysis-A!C2"),
    dimCharacteristicId: unavailable("Analysis-A!D2"),
    partCategory: available("Analysis-A!E2", "demo-bracket"),
    nominalValue: available("Analysis-A!F2", "1", 1),
    upperTolerance: available("Analysis-A!G2", "0.4", 0.4),
    lowerTolerance: available("Analysis-A!H2", "0", 0),
    longTermSafetyFactor: available("Analysis-A!I2", "1", 1),
    standardDeviation: available("Analysis-A!J2", "0.01", 0.01),
    distribution: available("Analysis-A!K2", "Uniform"),
  };
}

describe("createF2UserReport", () => {
  it("keeps capability differences and identifier reminders non-blocking", () => {
    const result = createF2UserReport(input(completeFields()));

    expect(result.status).toBe("completed");
    expect(result.worksheets[0]?.rows).toHaveLength(1);
    expect(result.worksheets[0]?.rows[0]).toEqual(expect.objectContaining({
      displayedFields: expect.objectContaining({ partNumber: "（缺失）", dimCharacteristicId: "（缺失）" }),
      missingRequiredFields: [],
      capabilityStatus: "in_library_tolerance_and_distribution_differ",
      recommendation: { toleranceMin: 0.1, toleranceMax: 0.3, unit: "mm", distribution: "normal" },
      adoReminderRequested: true,
    }));
    expect(result.adoEvents).toEqual([expect.objectContaining({
      eventType: "adoReminderRequested",
      category: "demo-bracket",
      missingFields: ["dimCharacteristicId", "partNumber"],
      factorRows: [2],
    })]);
  });

  it("blocks once per row while summarizing every required field and image gap", () => {
    const fields = completeFields();
    fields.partName = unavailable("Analysis-A!B2");
    fields.nominalValue = unavailable("Analysis-A!F2");
    fields.upperTolerance = unavailable("Analysis-A!G2");

    const result = createF2UserReport(input(fields, "unavailable"));

    expect(result.status).toBe("blocked");
    expect(result.worksheets[0]?.rows).toHaveLength(1);
    expect(result.worksheets[0]?.rows[0]?.missingRequiredFields).toEqual(["partName", "nominalValue", "upperTolerance"]);
    expect(result.worksheets[0]?.rows[0]?.capabilityStatus).toBe("unable_to_check");
    expect(result.worksheets[0]?.missingFieldSummary).toEqual(expect.arrayContaining([
      { field: "partName", factorCount: 1, sourceRows: [2] },
      { field: "nominalValue", factorCount: 1, sourceRows: [2] },
      { field: "upperTolerance", factorCount: 1, sourceRows: [2] },
      { field: "tolerancePathImage", factorCount: 0, sourceRows: [] },
    ]));
  });
});