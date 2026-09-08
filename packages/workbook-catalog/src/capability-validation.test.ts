import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createCapabilityValidation } from "./capability-validation.js";
import { createRequiredFieldCheck } from "./required-field-check.js";

const REQUIRED_FIELDS = [
  "factorName",
  "partName",
  "partCategory",
  "nominalValue",
  "upperTolerance",
  "lowerTolerance",
  "longTermSafetyFactor",
  "standardDeviation",
  "distribution",
] as const;
const NUMERIC_FIELDS = new Set(["nominalValue", "upperTolerance", "lowerTolerance", "longTermSafetyFactor", "standardDeviation"]);
const CONTENT_HASH = "a".repeat(64);

function available(field: string, column: string, rawText?: string, numericValue?: number) {
  const numeric = NUMERIC_FIELDS.has(field);
  const value = rawText ?? (numeric ? "1" : `anonymous-${field}`);
  return {
    status: "available" as const,
    rawText: value,
    sourceCell: `Analysis-A!${column}2`,
    ...(numeric ? { numericValue: numericValue ?? 1 } : {}),
  };
}

function unavailable(reasonCode: "missing" | "duplicate_mapping" | "invalid_format" | "ambiguous_mapping" | "missing_cached_value") {
  return { status: "unavailable" as const, reasonCode };
}

function fieldsFor(overrides: Record<string, unknown> = {}) {
  const fields = Object.fromEntries(REQUIRED_FIELDS.map((field, index) => [field, available(field, String.fromCharCode(65 + index))]));
  return {
    ...fields,
    factorName: available("factorName", "A", "anonymous-factor"),
    partName: available("partName", "B", "anonymous-part"),
    partCategory: available("partCategory", "C", "demo-bracket"),
    nominalValue: available("nominalValue", "D", "1", 1),
    upperTolerance: available("upperTolerance", "E", "0.1", 0.1),
    lowerTolerance: available("lowerTolerance", "F", "-0.05", -0.05),
    longTermSafetyFactor: available("longTermSafetyFactor", "G", "1", 1),
    standardDeviation: available("standardDeviation", "H", "1", 1),
    distribution: available("distribution", "I", "normal"),
    unit: available("unit", "J", "mm"),
    ...overrides,
  };
}

function assetsFor(fields = fieldsFor()) {
  return {
    contractVersion: "v1" as const,
    workbook: { classification: "confidential" as const, contentHash: CONTENT_HASH, catalogContractVersion: "v1" as const },
    worksheets: [{
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "anonymous",
      factorTables: [{
        tableId: "table-a",
        headerRow: 1,
        dataRange: { startRow: 2, endRow: 2 },
        columns: [{ semanticField: "factorName" as const, headerText: "Factor", sourceColumn: "A" }],
        rows: [{ sourceRow: 2, factorOrdinal: { value: "F1", rawText: "F1", sourceCell: "Analysis-A!Z2" }, fields }],
      }],
      formulaCells: [],
      imageAssets: [],
    }],
  };
}

function validate(fields = fieldsFor()) {
  const worksheetAnalysisAssets = assetsFor(fields);
  const requiredFieldCheck = createRequiredFieldCheck({
    contractVersion: "v1",
    inputClassification: "confidential",
    worksheetAnalysisAssets,
  });
  return createCapabilityValidation({
    contractVersion: "v1",
    inputClassification: "confidential",
    knowledgeBaseVersion: "v1",
    worksheetAnalysisAssets,
    requiredFieldCheck,
  });
}

describe("capability validation", () => {
  it("exports createCapabilityValidation through the built ESM package entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", "import { createCapabilityValidation } from '@ai-assist/workbook-catalog'; console.log(typeof createCapabilityValidation);"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output.trim()).toBe("function");
  });

  it("returns the F2.1 gate without row conclusions", () => {
    const result = validate(fieldsFor({ nominalValue: unavailable("missing") }));

    expect(result).toMatchObject({ status: "required_fields_not_ready", rows: [] });
  });

  it("matches a category-level F0 entry and its recommended distribution", () => {
    const result = validate();

    expect(result).toMatchObject({
      status: "completed",
      rows: [{
        tolerance: { status: "in_library", capabilityEntryId: "cap-demo-bracket", capabilityTier: "T3" },
        distribution: { status: "matches_recommendation", actual: "normal", recommended: "normal" },
      }],
    });
    expect(result.rows[0]!.tolerance).toMatchObject({ status: "in_library" });
    expect(result.rows[0]!.tolerance.status === "in_library" && result.rows[0]!.tolerance.totalTolerance).toBeCloseTo(0.15);
  });

  it("keeps a matched T0 entry distinct from an out-of-library result", () => {
    const matchedT0 = validate(fieldsFor({
      partCategory: available("partCategory", "C", "demo-t0-clip"),
      upperTolerance: available("upperTolerance", "E", "0.1", 0.1),
      lowerTolerance: available("lowerTolerance", "F", "0", 0),
    }));
    const outOfLibrary = validate(fieldsFor({
      upperTolerance: available("upperTolerance", "E", "1", 1),
      lowerTolerance: available("lowerTolerance", "F", "0", 0),
    }));

    expect(matchedT0.rows[0]!.tolerance).toMatchObject({ status: "in_library", capabilityTier: "T0" });
    expect(outOfLibrary.rows[0]!.tolerance).toMatchObject({ status: "out_of_library", totalTolerance: 1 });
  });

  it("returns non-blocking unable states for unsupported units and distributions", () => {
    const result = validate(fieldsFor({
      unit: available("unit", "J", "in"),
      distribution: available("distribution", "I", "unrecognized"),
    }));

    expect(result.rows[0]).toMatchObject({
      tolerance: { status: "unable_to_validate", reasonCode: "unit_unavailable" },
      distribution: { status: "not_applicable" },
    });
  });

  it("returns an unable tolerance state for a negative total tolerance", () => {
    const result = validate(fieldsFor({
      upperTolerance: available("upperTolerance", "E", "-0.1", -0.1),
      lowerTolerance: available("lowerTolerance", "F", "0", 0),
    }));

    expect(result.rows[0]).toMatchObject({
      tolerance: { status: "unable_to_validate", reasonCode: "invalid_tolerance" },
      distribution: { status: "not_applicable" },
    });
  });

  it("returns an unable distribution state after an in-library tolerance match", () => {
    const result = validate(fieldsFor({ distribution: available("distribution", "I", "unrecognized") }));

    expect(result.rows[0]).toMatchObject({
      tolerance: { status: "in_library", capabilityEntryId: "cap-demo-bracket" },
      distribution: { status: "unable_to_validate", reasonCode: "distribution_unavailable" },
    });
  });

  it("normalizes approved aliases and reports recognized distribution differences", () => {
    const aliasResult = validate(fieldsFor({ distribution: available("distribution", "I", " Gaussian ") }));
    const mismatchResult = validate(fieldsFor({ distribution: available("distribution", "I", "uniform") }));

    expect(aliasResult.rows[0]!.distribution).toEqual({ status: "matches_recommendation", actual: "normal", recommended: "normal" });
    expect(mismatchResult.rows[0]!.distribution).toEqual({ status: "distribution_mismatch", actual: "uniform", recommended: "normal" });
  });

  it("rejects a required-field result bound to another asset set", () => {
    const worksheetAnalysisAssets = assetsFor();
    const requiredFieldCheck = createRequiredFieldCheck({
      contractVersion: "v1",
      inputClassification: "confidential",
      worksheetAnalysisAssets,
    });

    expect(() => createCapabilityValidation({
      contractVersion: "v1",
      inputClassification: "confidential",
      knowledgeBaseVersion: "v1",
      worksheetAnalysisAssets: {
        ...worksheetAnalysisAssets,
        workbook: { ...worksheetAnalysisAssets.workbook, contentHash: "b".repeat(64) },
      },
      requiredFieldCheck,
    })).toThrow("Capability validation request is invalid.");
  });
});