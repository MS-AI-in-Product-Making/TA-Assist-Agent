import { describe, expect, it, vi } from "vitest";
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
    knowledgeBaseVersions: ["v1", "internal-v1"],
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
      f0KnowledgeBaseVersion: "v1",
      recommendation: { kind: "public", toleranceMin: 0.1, toleranceMax: 0.3, unit: "mm", distribution: "normal", capabilityEntryId: "cap-demo-bracket" },
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

    const capabilityRouter = { assess: vi.fn() };
    const result = createF2UserReport(input(fields, "unavailable"), { capabilityRouter });

    expect(result.status).toBe("blocked");
    expect(result.worksheets[0]?.rows).toHaveLength(1);
    expect(result.worksheets[0]?.rows[0]?.missingRequiredFields).toEqual(["partName", "nominalValue", "upperTolerance"]);
    expect(result.worksheets[0]?.rows[0]?.capabilityStatus).toBe("unable_to_check");
    expect(capabilityRouter.assess).not.toHaveBeenCalled();
    expect(result.worksheets[0]?.missingFieldSummary).toEqual(expect.arrayContaining([
      { field: "partName", factorCount: 1, sourceRows: [2] },
      { field: "nominalValue", factorCount: 1, sourceRows: [2] },
      { field: "upperTolerance", factorCount: 1, sourceRows: [2] },
      { field: "tolerancePathImage", factorCount: 0, sourceRows: [] },
    ]));
  });

  it("uses the injected F0 router for complete CNC rows", () => {
    const fields = completeFields();
    fields.partCategory = available("Analysis-A!E2", "CNC");
    fields.nominalValue = available("Analysis-A!F2", "3.145", 3.145);
    fields.upperTolerance = available("Analysis-A!G2", "0.100", 0.1);
    fields.lowerTolerance = available("Analysis-A!H2", "-0.100", -0.1);
    const capabilityRouter = { assess: vi.fn(() => ({
      capabilityStatus: "internal_within_guidance" as const,
      f0KnowledgeBaseVersion: "internal-v1" as const,
      recommendation: {
        kind: "internal-guidance" as const,
        assessedTotalBand: 0.2,
        maximumRecommendedTotalBand: 0.2,
        unit: "mm" as const,
        matchedEntryId: "cnc-linear-6",
        fallbackApplied: false,
        evidence: { sourceFileHash: "c".repeat(64), sheetName: "ISO 2768-1 Class m", sourceRange: "A6:F6" },
      },
    })) };

    const result = createF2UserReport(input(fields), { capabilityRouter });

    expect(capabilityRouter.assess).toHaveBeenCalledExactlyOnceWith({
      partCategory: "CNC",
      factorName: "bracket arm",
      partName: "component",
      nominalValue: 3.145,
      upperTolerance: 0.1,
      lowerTolerance: -0.1,
      distribution: "Uniform",
    });
    expect(result.worksheets[0]?.rows[0]).toMatchObject({ capabilityStatus: "internal_within_guidance", f0KnowledgeBaseVersion: "internal-v1" });
    expect(result.summary).toMatchObject({ internalWithinGuidanceCount: 1, unableToCheckCount: 0 });
  });
});