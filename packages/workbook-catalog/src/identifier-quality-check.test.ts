import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createIdentifierQualityCheck, scanIdentifierQuality } from "./identifier-quality-check.js";
import { createRequiredFieldCheck } from "./required-field-check.js";

const CONTENT_HASH = "a".repeat(64);
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

function available(field: string, column: string, sourceRow: number, rawText?: string, numericValue?: number) {
  const numeric = NUMERIC_FIELDS.has(field);
  return {
    status: "available" as const,
    rawText: rawText ?? (numeric ? "1" : `anonymous-${field}`),
    sourceCell: `Analysis-A!${column}${sourceRow}`,
    ...(numeric ? { numericValue: numericValue ?? 1 } : {}),
  };
}

function unavailable(sourceCell?: string) {
  return { status: "unavailable" as const, reasonCode: "missing" as const, ...(sourceCell === undefined ? {} : { sourceCell }) };
}

function fieldsFor(sourceRow: number, overrides: Record<string, unknown> = {}) {
  return {
    ...Object.fromEntries(REQUIRED_FIELDS.map((field, index) => [field, available(field, String.fromCharCode(65 + index), sourceRow)])),
    factorName: available("factorName", "A", sourceRow, "anonymous-factor"),
    partName: available("partName", "B", sourceRow, "anonymous-part"),
    partCategory: available("partCategory", "C", sourceRow, "demo-bracket"),
    nominalValue: available("nominalValue", "D", sourceRow, "1", 1),
    upperTolerance: available("upperTolerance", "E", sourceRow, "0.1", 0.1),
    lowerTolerance: available("lowerTolerance", "F", sourceRow, "-0.05", -0.05),
    longTermSafetyFactor: available("longTermSafetyFactor", "G", sourceRow, "1", 1),
    standardDeviation: available("standardDeviation", "H", sourceRow, "1", 1),
    distribution: available("distribution", "I", sourceRow, "normal"),
    unit: available("unit", "J", sourceRow, "mm"),
    drawingNumber: available("drawingNumber", "K", sourceRow, "DRAW-01"),
    dimCharacteristicId: available("dimCharacteristicId", "L", sourceRow, `DIM-${sourceRow}`),
    ...overrides,
  };
}

function assetsFor(rows: readonly { readonly sourceRow: number; readonly fields: Record<string, unknown> }[]) {
  return {
    contractVersion: "v1" as const,
    workbook: { classification: "confidential" as const, contentHash: CONTENT_HASH, catalogContractVersion: "v1" as const },
    worksheets: [{
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "anonymous",
      factorTables: [{
        tableId: "table-a",
        headerRow: 1,
        dataRange: { startRow: 2, endRow: 7 },
        columns: [{ semanticField: "factorName" as const, headerText: "Factor", sourceColumn: "A" }],
        rows,
      }],
      formulaCells: [],
      imageAssets: [],
    }],
  };
}

function qualityCheckFor(rows: readonly { readonly sourceRow: number; readonly fields: Record<string, unknown> }[]) {
  const worksheetAnalysisAssets = assetsFor(rows);
  const requiredFieldCheck = createRequiredFieldCheck({
    contractVersion: "v1",
    inputClassification: "confidential",
    worksheetAnalysisAssets,
  });
  return createIdentifierQualityCheck({
    contractVersion: "v1",
    inputClassification: "confidential",
    worksheetAnalysisAssets,
    requiredFieldCheck,
  });
}

describe("identifier quality check", () => {
  it("scans identifiers independently when required fields are blocked", () => {
    const { drawingNumber: _drawingNumber, ...missingDrawingFields } = fieldsFor(15, {
      partCategory: unavailable("Analysis-A!C15"),
      dimCharacteristicId: available("dimCharacteristicId", "L", 15, "DIM-DUP"),
    });
    const blockedWorksheetAssets = assetsFor([
      {
        sourceRow: 13,
        fields: fieldsFor(13, {
        partCategory: unavailable("Analysis-A!C13"),
        drawingNumber: unavailable("Analysis-A!K13"),
        dimCharacteristicId: available("dimCharacteristicId", "L", 13, "   "),
        }),
      },
      {
        sourceRow: 14,
        fields: fieldsFor(14, {
          partCategory: unavailable("Analysis-A!C14"),
          drawingNumber: available("drawingNumber", "K", 14, "DRAW\u0000-01"),
          dimCharacteristicId: available("dimCharacteristicId", "L", 14, "DIM-DUP"),
        }),
      },
      { sourceRow: 15, fields: missingDrawingFields },
    ]);
    const signals = scanIdentifierQuality(blockedWorksheetAssets);

    expect(signals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        signalKind: "identifier_evidence_unavailable",
        field: "drawingNumber",
        sources: [{ sourceRow: 13, sourceCell: "Analysis-A!K13" }],
      }),
      expect.objectContaining({
        signalKind: "identifier_missing",
        field: "dimCharacteristicId",
        sources: [{ sourceRow: 13, sourceCell: "Analysis-A!L13" }],
      }),
      expect.objectContaining({ signalKind: "identifier_text_invalid", field: "drawingNumber", sources: [{ sourceRow: 14, sourceCell: "Analysis-A!K14" }] }),
      expect.objectContaining({ signalKind: "identifier_missing", field: "drawingNumber", sources: [{ sourceRow: 15 }] }),
      expect.objectContaining({
        signalKind: "dim_id_duplicate",
        field: "dimCharacteristicId",
        sources: [
          { sourceRow: 14, sourceCell: "Analysis-A!L14" },
          { sourceRow: 15, sourceCell: "Analysis-A!L15" },
        ],
      }),
    ]));
    expect(Object.isFrozen(signals)).toBe(true);
    expect(Object.isFrozen(signals[0]!.sources)).toBe(true);
  });

  it("aggregates missing, unavailable, invalid, and duplicate identifier evidence", () => {
    const result = qualityCheckFor([
      { sourceRow: 2, fields: Object.fromEntries(Object.entries(fieldsFor(2)).filter(([field]) => field !== "drawingNumber")) },
      { sourceRow: 3, fields: fieldsFor(3, { dimCharacteristicId: available("dimCharacteristicId", "L", 3, "   ") }) },
      { sourceRow: 4, fields: fieldsFor(4, { dimCharacteristicId: unavailable() }) },
      { sourceRow: 5, fields: fieldsFor(5, { drawingNumber: available("drawingNumber", "K", 5, "DRAW\u0000-01") }) },
      { sourceRow: 6, fields: fieldsFor(6, { dimCharacteristicId: available("dimCharacteristicId", "L", 6, " DIM-01 ") }) },
      { sourceRow: 7, fields: fieldsFor(7, { dimCharacteristicId: available("dimCharacteristicId", "L", 7, "DIM-01") }) },
    ]);

    expect(result).toMatchObject({
      status: "completed",
      summary: {
        factorRowsChecked: 6,
        actionableSignalCount: 5,
        identifierMissingCount: 2,
        identifierEvidenceUnavailableCount: 1,
        identifierTextInvalidCount: 1,
        dimIdDuplicateCount: 1,
      },
    });
    expect(result.signals).toEqual(expect.arrayContaining([
      expect.objectContaining({ signalKind: "identifier_missing", field: "drawingNumber", sourceRows: [2] }),
      expect.objectContaining({ signalKind: "identifier_missing", field: "dimCharacteristicId", sourceRows: [3] }),
      expect.objectContaining({ signalKind: "identifier_evidence_unavailable", field: "dimCharacteristicId", reasonCode: "missing", sourceRows: [4] }),
      expect.objectContaining({ signalKind: "identifier_text_invalid", field: "drawingNumber", sourceRows: [5] }),
      expect.objectContaining({ signalKind: "dim_id_duplicate", field: "dimCharacteristicId", sourceRows: [6, 7] }),
    ]));
  });

  it("returns a zero-signal gate and preserves case-sensitive DIM ID comparison", () => {
    const worksheetAnalysisAssets = assetsFor([
      { sourceRow: 2, fields: fieldsFor(2, { nominalValue: unavailable() }) },
    ]);
    const blockedRequiredFieldCheck = createRequiredFieldCheck({
      contractVersion: "v1",
      inputClassification: "confidential",
      worksheetAnalysisAssets,
    });
    const blocked = createIdentifierQualityCheck({
      contractVersion: "v1",
      inputClassification: "confidential",
      worksheetAnalysisAssets,
      requiredFieldCheck: blockedRequiredFieldCheck,
    });
    const caseDistinct = qualityCheckFor([
      { sourceRow: 2, fields: fieldsFor(2, { dimCharacteristicId: available("dimCharacteristicId", "L", 2, "dim-01") }) },
      { sourceRow: 3, fields: fieldsFor(3, { dimCharacteristicId: available("dimCharacteristicId", "L", 3, "DIM-01") }) },
    ]);

    expect(blocked).toMatchObject({
      status: "required_fields_not_ready",
      signals: [],
      summary: { factorRowsChecked: 0, actionableSignalCount: 0 },
    });
    expect(caseDistinct.signals.some((signal) => signal.signalKind === "dim_id_duplicate")).toBe(false);
  });

  it("denies non-confidential input and returns deeply frozen cloned output", () => {
    const fields = fieldsFor(2);
    const result = qualityCheckFor([{ sourceRow: 2, fields }]);

    expect(() => createIdentifierQualityCheck({
      contractVersion: "v1",
      inputClassification: "public",
      worksheetAnalysisAssets: assetsFor([{ sourceRow: 2, fields }]),
      requiredFieldCheck: createRequiredFieldCheck({
        contractVersion: "v1",
        inputClassification: "confidential",
        worksheetAnalysisAssets: assetsFor([{ sourceRow: 2, fields }]),
      }),
    })).toThrow("Identifier quality check input is not permitted.");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.signals)).toBe(true);
    expect(() => { (result.signals as unknown as unknown[]).push({}); }).toThrow();
    fields.drawingNumber = available("drawingNumber", "K", 2, "changed-after-check");
    expect(result.signals).toEqual([]);
  });

  it("exports createIdentifierQualityCheck through the built ESM package entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", "import { createIdentifierQualityCheck } from '@ai-assist/workbook-catalog'; console.log(typeof createIdentifierQualityCheck);"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output.trim()).toBe("function");
  });
});
