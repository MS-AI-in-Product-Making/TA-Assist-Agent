import { describe, expect, it, vi } from "vitest";
import { createF2UserReport, validateWorksheetSystemSpecification } from "./f2-user-report.js";

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

function completeActualFields() {
  return {
    factorName: "bracket arm",
    partName: "component",
    drawingNumber: null,
    dimCharacteristicId: null,
    partCategory: "demo-bracket",
    nominalValue: 1,
    upperTolerance: 0.4,
    lowerTolerance: 0,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "Uniform",
    mean: 1,
    tolerance: 0.4,
    oneSigma: 0.1,
    percentContributionToSigma: 1,
    notes: null,
  };
}

function systemSpecification(worksheetName = "Analysis-A") {
  return {
    status: "available" as const,
    lowerSpecLimit: { status: "available" as const, actualValue: -0.15, displayValue: "-0.15", sourceLabel: "*Lower Spec Limit ►", sourceCell: `${worksheetName}!P54`, valueOrigin: "numeric_literal" as const },
    upperSpecLimit: { status: "available" as const, actualValue: 0.05, displayValue: "0.05", sourceLabel: "*Upper Spec Limit ►", sourceCell: `${worksheetName}!P55`, valueOrigin: "numeric_literal" as const },
    targetSigmaLevel: { status: "available" as const, actualValue: 3, displayValue: "3.0σ", sourceLabel: "*Target σ Level ►", sourceCell: `${worksheetName}!P56`, valueOrigin: "numeric_literal" as const },
    additionalMeanShift: { status: "available" as const, actualValue: 0.01, displayValue: "0.01", sourceLabel: "Additional Mean Shift ►", sourceCell: `${worksheetName}!P50`, valueOrigin: "formula_cached" as const },
  };
}

function input(fields: Record<string, unknown>, imageStatus: "available" | "unavailable" = "available", actualFields = completeActualFields()) {
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    artifactRoot: "test/demo-output/feature1-output/anonymous",
    workbook: { fileName: "anonymous.xlsx", contentHash, f1GeneratedAt: "2026-08-03T00:00:00.000Z" },
    worksheets: [{
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "Anonymous device gap",
      systemSpecification: systemSpecification(),
      worksheetJsonPath: "sheets/anonymous.xlsx/json/Analysis-A.json",
      worksheetMdPath: "sheets/anonymous.xlsx/md/Analysis-A.md",
      tolerancePathImage: imageStatus === "available"
        ? { status: "available", imagePath: "sheets/anonymous.xlsx/images/a.png", contentHash: "b".repeat(64), mediaType: "image/png" }
        : { status: "unavailable", reasonCode: "image_missing" },
      factorTables: [{
        tableId: "table-a",
        headerRow: 1,
        dataRange: { startRow: 2, endRow: 2 },
        columns: [],
        rows: [{ sourceRow: 2, fields, actualFields }],
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
  it.each([
    ["lowerSpecLimit", "response_summary_value_missing"],
    ["lowerSpecLimit", "response_summary_value_invalid"],
    ["upperSpecLimit", "response_summary_value_missing"],
    ["upperSpecLimit", "response_summary_value_invalid"],
    ["targetSigmaLevel", "response_summary_value_missing"],
    ["targetSigmaLevel", "response_summary_value_invalid"],
  ] as const)("blocks %s when evidence is %s", (field, reasonCode) => {
    const specification = {
      ...systemSpecification(),
      [field]: { status: "unavailable" as const, reasonCode, sourceCell: "Analysis-A!P56" },
    };

    expect(validateWorksheetSystemSpecification(specification)).toEqual([{
      field,
      reasonCode,
      sourceCell: "Analysis-A!P56",
    }]);
  });

  it("keeps capability differences and identifier reminders non-blocking", () => {
    const result = createF2UserReport(input(completeFields()));

    expect(result.status).toBe("completed");
    expect(result.worksheets[0]?.toleranceLoopDescription).toBe("Anonymous device gap");
    expect(result.worksheets[0]?.rows).toHaveLength(1);
    expect(result.worksheets[0]?.rows[0]).toEqual(expect.objectContaining({
      actualFields: completeActualFields(),
      imageReference: { artifact: "f1", relativePath: "sheets/anonymous.xlsx/images/a.png", contentHash: "b".repeat(64), worksheetName: "Analysis-A" },
      missingIdentifiers: ["dimCharacteristicId", "partNumber"],
      missingRequiredFields: [],
      capabilityStatus: "in_library_tolerance_and_distribution_differ",
      f0KnowledgeBaseVersion: "v1",
      recommendation: { kind: "public", toleranceMin: 0.1, toleranceMax: 0.3, unit: "mm", distribution: "normal", capabilityEntryId: "cap-demo-bracket" },
      adoReminderRequested: true,
    }));
    expect(result.worksheets[0]?.rows[0]).not.toHaveProperty("imageTarget");
    expect(result.adoEvents).toEqual([expect.objectContaining({
      eventType: "adoReminderRequested",
      category: "demo-bracket",
      missingFields: ["dimCharacteristicId", "partNumber"],
      factorRows: [2],
    })]);
    expect(result.worksheets[0]?.rows[0]?.actualFields.drawingNumber).toBeNull();
    expect(result.worksheets[0]?.rows[0]?.missingRequiredFields).not.toContain("drawingNumber");
    expect(result.worksheets[0]?.rows[0]?.adoReminderRequested).toBe(true);
    expect(result.f4Handoffs).toHaveLength(1);
  });

  it("projects Excel display fields while preserving actual numeric values", () => {
    const fields = completeFields();
    fields.mean = available("Analysis-A!L2", "-0.100", -0.10000000000000002);
    fields.oneSigma = available("Analysis-A!N2", "0.0167", 0.016666666666666666);
    fields.percentContributionToSigma = available("Analysis-A!O2", "2.7%", 0.026937809003607087);
    const actualFields = {
      ...completeActualFields(),
      mean: -0.10000000000000002,
      oneSigma: 0.016666666666666666,
      percentContributionToSigma: 0.026937809003607087,
    };

    const result = createF2UserReport(input(fields, "available", actualFields));

    expect(result.worksheets[0]?.rows[0]?.displayFields).toMatchObject({
      mean: "-0.100",
      oneSigma: "0.0167",
      percentContributionToSigma: "2.7%",
    });
    expect(result.worksheets[0]?.rows[0]?.actualFields).toMatchObject({
      mean: -0.10000000000000002,
      oneSigma: 0.016666666666666666,
      percentContributionToSigma: 0.026937809003607087,
    });
  });

  it("blocks only the worksheet with an unavailable system specification and emits one ready handoff", () => {
    const request = input(completeFields());
    request.worksheets.push({
      ...request.worksheets[0],
      worksheetName: "Analysis-B",
      systemSpecification: {
        ...systemSpecification("Analysis-B"),
        targetSigmaLevel: { status: "unavailable", reasonCode: "response_summary_value_missing", sourceCell: "Analysis-B!P56" },
      },
      worksheetJsonPath: "sheets/anonymous.xlsx/json/Analysis-B.json",
      worksheetMdPath: "sheets/anonymous.xlsx/md/Analysis-B.md",
    });

    const result = createF2UserReport(request);

    expect(result.status).toBe("partiallyBlocked");
    expect(result.worksheets[0]?.status).toBe("ready");
    expect(result.worksheets[1]).toMatchObject({
      status: "blocked",
      systemSpecificationIssues: [{ field: "targetSigmaLevel", reasonCode: "response_summary_value_missing" }],
    });
    expect(result.f4Handoffs).toHaveLength(1);
    expect(result.f4Handoffs[0]).toMatchObject({ status: "ready", worksheetName: "Analysis-A" });
  });

  it("blocks once per row while summarizing every required field and image gap", () => {
    const fields = completeFields();
    fields.partName = unavailable("Analysis-A!B2");
    fields.nominalValue = unavailable("Analysis-A!F2");
    fields.upperTolerance = unavailable("Analysis-A!G2");
    const actualFields = { ...completeActualFields(), partName: null, nominalValue: null, upperTolerance: null };

    const capabilityRouter = { assess: vi.fn() };
    const result = createF2UserReport(input(fields, "unavailable", actualFields), { capabilityRouter });

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
    const actualFields = { ...completeActualFields(), partCategory: "CNC", nominalValue: 3.145, upperTolerance: 0.1, lowerTolerance: -0.1 };
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

    const result = createF2UserReport(input(fields, "available", actualFields), { capabilityRouter });

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