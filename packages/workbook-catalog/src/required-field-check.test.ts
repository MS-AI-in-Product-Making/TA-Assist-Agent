import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
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

function available(field: string, column: string) {
  const value = NUMERIC_FIELDS.has(field) ? "1.5" : `anonymous-${field}`;
  return {
    status: "available" as const,
    rawText: value,
    sourceCell: `Analysis-A!${column}2`,
    ...(NUMERIC_FIELDS.has(field) ? { numericValue: 1.5 } : {}),
  };
}

function unavailable(reasonCode: "missing" | "duplicate_mapping" | "invalid_format" | "ambiguous_mapping" | "missing_cached_value", sourceCell?: string) {
  return { status: "unavailable" as const, reasonCode, ...(sourceCell ? { sourceCell } : {}) };
}

function requestFor(fields: Record<string, unknown>, rows: readonly unknown[] = [{ sourceRow: 2, fields }]) {
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    worksheetAnalysisAssets: {
      contractVersion: "v1",
      workbook: { classification: "confidential", contentHash: "a".repeat(64), catalogContractVersion: "v1" },
      worksheets: [{
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "anonymous",
        factorTables: [{
          tableId: "table-a",
          headerRow: 1,
          dataRange: { startRow: 2, endRow: 2 },
          columns: [{ semanticField: "factorName", headerText: "Factor", sourceColumn: "A" }],
          rows,
        }],
        formulaCells: [],
        imageAssets: [],
      }],
    },
  };
}

function completeFields(): Record<string, unknown> {
  return Object.fromEntries(REQUIRED_FIELDS.map((field, index) => [field, available(field, String.fromCharCode(65 + index))]));
}

describe("required field check", () => {
  it("exports createRequiredFieldCheck through the built ESM package entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", "import { createRequiredFieldCheck } from '@ai-assist/workbook-catalog'; console.log(typeof createRequiredFieldCheck);"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output.trim()).toBe("function");
  });

  it("blocks every unavailable required field without short-circuiting while identifiers remain advisory", () => {
    const fields = completeFields();
    fields.nominalValue = unavailable("missing", "Analysis-A!D2");
    fields.distribution = unavailable("missing_cached_value", "Analysis-A!I2");
    fields.drawingNumber = unavailable("missing");
    fields.dimCharacteristicId = unavailable("duplicate_mapping", "Analysis-A!K2");

    const result = createRequiredFieldCheck(requestFor(fields));

    expect(result).toMatchObject({
      status: "blocked",
      summary: { factorRowsChecked: 1, blockingIssueCount: 2, advisoryIssueCount: 2 },
    });
    expect(result.blockingIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "nominalValue", reasonCode: "missing", sourceCell: "Analysis-A!D2" }),
      expect.objectContaining({ field: "distribution", reasonCode: "missing_cached_value", sourceCell: "Analysis-A!I2" }),
    ]));
    expect(result.advisoryIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "drawingNumber", reasonCode: "missing" }),
      expect.objectContaining({ field: "dimCharacteristicId", reasonCode: "duplicate_mapping", sourceCell: "Analysis-A!K2" }),
    ]));
  });

  it.each(REQUIRED_FIELDS)("blocks when %s is absent from F1.1 evidence", (field) => {
    const fields = completeFields();
    delete fields[field];

    const result = createRequiredFieldCheck(requestFor(fields));

    expect(result).toMatchObject({ status: "blocked", summary: { blockingIssueCount: 1 } });
    expect(result.blockingIssues).toContainEqual(expect.objectContaining({ field, reasonCode: "missing" }));
  });

  it.each(["missing", "duplicate_mapping", "invalid_format", "ambiguous_mapping", "missing_cached_value"] as const)(
    "propagates F1.1 unavailable reason %s as a blocker",
    (reasonCode) => {
      const fields = completeFields();
      fields.upperTolerance = unavailable(reasonCode, "Analysis-A!E2");

      expect(createRequiredFieldCheck(requestFor(fields)).blockingIssues).toContainEqual(
        expect.objectContaining({ field: "upperTolerance", reasonCode, sourceCell: "Analysis-A!E2" }),
      );
    },
  );

  it("blocks non-numeric available values for numeric required fields", () => {
    const fields = completeFields();
    fields.standardDeviation = { status: "available", rawText: "not-a-number", sourceCell: "Analysis-A!H2" };

    expect(createRequiredFieldCheck(requestFor(fields)).blockingIssues).toContainEqual(
      expect.objectContaining({ field: "standardDeviation", reasonCode: "invalid_format", sourceCell: "Analysis-A!H2" }),
    );
  });

  it("blocks available fields with blank raw text", () => {
    const fields = completeFields();
    fields.factorName = { status: "available", rawText: "   ", sourceCell: "Analysis-A!A2" };

    expect(createRequiredFieldCheck(requestFor(fields)).blockingIssues).toContainEqual(
      expect.objectContaining({ field: "factorName", reasonCode: "missing", sourceCell: "Analysis-A!A2" }),
    );
  });

  it("returns readyForNextCheck when required fields are available and identifiers are advisory", () => {
    const fields = completeFields();
    fields.drawingNumber = unavailable("missing");
    fields.dimCharacteristicId = unavailable("missing");

    const result = createRequiredFieldCheck(requestFor(fields));

    expect(result).toMatchObject({
      status: "readyForNextCheck",
      blockingIssues: [],
      summary: { advisoryIssueCount: 2 },
    });
    expect(result.workbookContentHash).toBe("a".repeat(64));
  });

  it("counts every worksheet, factor table, and row", () => {
    const request = requestFor(completeFields());
    const firstWorksheet = request.worksheetAnalysisAssets.worksheets[0]!;
    const firstTable = firstWorksheet.factorTables[0]!;
    request.worksheetAnalysisAssets.worksheets.push({
      ...firstWorksheet,
      worksheetName: "Analysis-B",
      factorTables: [{
        ...firstTable,
        tableId: "table-b",
        rows: [
          ...firstTable.rows,
          { sourceRow: 3, fields: completeFields() },
        ],
      }],
    });

    expect(createRequiredFieldCheck(request)).toMatchObject({
      status: "readyForNextCheck",
      summary: { worksheetsChecked: 2, factorTablesChecked: 2, factorRowsChecked: 3, blockingIssueCount: 0, advisoryIssueCount: 6 },
    });
  });

  it("blocks an empty recognized factor table without inventing row provenance", () => {
    const result = createRequiredFieldCheck(requestFor(completeFields(), []));

    expect(result).toMatchObject({ status: "blocked", summary: { factorRowsChecked: 0, blockingIssueCount: 1 } });
    expect(result.blockingIssues).toContainEqual({ issueCode: "factor_table_has_no_rows", worksheetName: "Analysis-A", tableId: "table-a" });
  });

  it("rejects malformed input, denies non-confidential input, and deeply freezes results", () => {
    expect(() => createRequiredFieldCheck({ inputClassification: "confidential" })).toThrow("Required-field check request is invalid.");
    expect(() => createRequiredFieldCheck({ inputClassification: "secret" })).toThrow("Required-field check input is not permitted.");

    const result = createRequiredFieldCheck(requestFor(completeFields()));
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.blockingIssues)).toBe(true);
    expect(Object.isFrozen(result.summary)).toBe(true);
    expect(() => { (result.summary as { factorRowsChecked: number }).factorRowsChecked = 0; }).toThrow();
  });
});