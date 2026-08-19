import { describe, expect, it } from "vitest";
import {
  f7MeasurementDatasetSchema,
  f7MeasurementPasteResultSchema,
} from "@ai-assist/contracts";
import { parseF7MeasurementPaste } from "./f7-measurement-parser.js";

const FACTOR_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const IMPORTED_AT = "2026-08-19T08:05:00.000Z";

interface ParserRequest {
  readonly factorId: string;
  readonly unit: string;
  readonly structure: "RATIONAL_SUBGROUP" | "ORDERED_INDIVIDUALS" | "UNORDERED_SAMPLE";
  readonly sourceReference: string;
  readonly importedAt: string;
  readonly msaStatus: "available" | "not_available" | "unknown";
  readonly text: string;
}

function makeRequest(overrides: Partial<ParserRequest> = {}): ParserRequest {
  return {
    factorId: FACTOR_ID,
    unit: "mm",
    structure: "ORDERED_INDIVIDUALS",
    sourceReference: "clipboard",
    importedAt: IMPORTED_AT,
    msaStatus: "unknown",
    text: "value\n0.571\n0.569",
    ...overrides,
  };
}

function collectRejectedRows(result: ReturnType<typeof parseF7MeasurementPaste>): number[] {
  return result.dataset?.rejectionSummaries.map((entry) => entry.rowNumber) ?? [];
}

describe("parseF7MeasurementPaste", () => {
  it("parses header plus one value per line deterministically", () => {
    const request = makeRequest({ text: "value\n0.571\n0.569", msaStatus: "available" });
    const first = parseF7MeasurementPaste(request);
    const second = parseF7MeasurementPaste(request);

    expect(first).toEqual(second);
    expect(first.status).toBe("ready");
    expect(first.factorId).toBe(FACTOR_ID);
    expect(first.dataset?.observations.map((entry) => entry.value)).toEqual([0.571, 0.569]);
    expect(first.dataset?.observations.map((entry) => entry.originalRow)).toEqual([2, 3]);
    expect(first.dataset?.analyzedCount).toBe(2);
    expect(first.dataset?.missingRowCount).toBe(0);
    expect(first.dataset?.rejectionSummaries).toEqual([]);
    expect(first.dataset?.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("parses tab-separated explicit headers and preserves trimmed metadata", () => {
    const text = [
      "value\tsequence\ttimestamp\tsubgroup\tbatch",
      "0.571\t  1  \t 2026-08-19T08:00:00.000Z \t A \t lot-1 ",
      "0.569\t2\t2026-08-19T08:01:00.000Z\tB\tlot-2",
    ].join("\n");
    const result = parseF7MeasurementPaste(makeRequest({ text }));

    expect(result.status).toBe("ready");
    expect(result.dataset?.observations).toMatchObject([
      {
        value: 0.571,
        originalRow: 2,
        sequence: "1",
        timestamp: "2026-08-19T08:00:00.000Z",
        subgroup: "A",
        batch: "lot-1",
        disposition: "included",
      },
      {
        value: 0.569,
        originalRow: 3,
        sequence: "2",
        timestamp: "2026-08-19T08:01:00.000Z",
        subgroup: "B",
        batch: "lot-2",
        disposition: "included",
      },
    ]);
  });

  it("supports comma and semicolon explicit-header variants, CRLF, BOM, and one-value no-header", () => {
    const commaText = "\uFEFFvalue,sequence\r\n0.571,1\r\n0.569,2";
    const semicolonText = "value;batch\n0.571;lot-1\n0.569;lot-2";

    const commaResult = parseF7MeasurementPaste(makeRequest({ text: commaText }));
    const semicolonResult = parseF7MeasurementPaste(makeRequest({ text: semicolonText }));
    const oneValueResult = parseF7MeasurementPaste(makeRequest({ text: "0.571" }));

    expect(commaResult.dataset?.observations.map((entry) => entry.value)).toEqual([0.571, 0.569]);
    expect(semicolonResult.dataset?.observations.map((entry) => entry.batch)).toEqual(["lot-1", "lot-2"]);
    expect(oneValueResult.dataset?.observations).toHaveLength(1);
    expect(oneValueResult.dataset?.observations[0]).toMatchObject({ originalRow: 1, value: 0.571 });
  });

  it("treats nonselected delimiter characters as ordinary metadata content", () => {
    const tabText = "value\tbatch\n0.571\tlot,alpha;pilot";
    const commaText = "value,batch\n0.571,lot;alpha";

    const tabResult = parseF7MeasurementPaste(makeRequest({ text: tabText }));
    const commaResult = parseF7MeasurementPaste(makeRequest({ text: commaText }));

    expect(tabResult.status).toBe("ready");
    expect(tabResult.dataset?.observations).toHaveLength(1);
    expect(tabResult.dataset?.observations[0]).toMatchObject({
      originalRow: 2,
      value: 0.571,
      batch: "lot,alpha;pilot",
    });
    expect(tabResult.dataset?.rejectionSummaries).toEqual([]);

    expect(commaResult.status).toBe("ready");
    expect(commaResult.dataset?.observations).toHaveLength(1);
    expect(commaResult.dataset?.observations[0]).toMatchObject({
      originalRow: 2,
      value: 0.571,
      batch: "lot;alpha",
    });
    expect(commaResult.dataset?.rejectionSummaries).toEqual([]);
  });

  it("rejects only true structural mismatches by selected delimiter column count", () => {
    const text = [
      "value\tbatch",
      "0.571\tlot-1\textra",
      "0.569\tlot-2",
    ].join("\n");

    const result = parseF7MeasurementPaste(makeRequest({ text }));

    expect(result.status).toBe("ready");
    expect(result.dataset?.rejectionSummaries).toEqual([{ rowNumber: 2, reason: "invalid_row" }]);
    expect(result.dataset?.observations).toMatchObject([
      {
        originalRow: 3,
        value: 0.569,
        batch: "lot-2",
      },
    ]);
    expect(result.dataset?.originalRowCount).toBe(2);
    expect(result.dataset?.analyzedCount).toBe(1);
  });

  it("counts blank data rows as missing and preserves source row numbers without extra row from trailing newline", () => {
    const text = [
      "value",
      "0.571",
      "   ",
      "0.569",
      "",
      "oops",
      "0.568",
      "",
    ].join("\n");
    const result = parseF7MeasurementPaste(makeRequest({ text }));

    expect(result.dataset?.observations.map((entry) => entry.originalRow)).toEqual([2, 4, 7]);
    expect(result.dataset?.missingRowCount).toBe(2);
    expect(result.dataset?.originalRowCount).toBe(6);
    expect(result.dataset?.rejectionSummaries).toEqual([{ rowNumber: 6, reason: "invalid_row" }]);
  });

  it("detects delimiter from header only and rejects mixed delimiter headers", () => {
    const mixedHeaderResult = parseF7MeasurementPaste(makeRequest({ text: "value,sequence;timestamp\n0.571,1;2026-08-19T08:00:00.000Z" }));

    expect(mixedHeaderResult.status).toBe("blocked");
    expect(mixedHeaderResult.dataset).toBeUndefined();
    expect(mixedHeaderResult.validation.blockingIssues).toEqual([
      { reason: "invalid_row", factorId: FACTOR_ID, rowNumber: 1 },
    ]);
  });

  it("rejects unknown and duplicate explicit headers", () => {
    const unknownHeader = parseF7MeasurementPaste(makeRequest({ text: "value,operator\n0.571,alice" }));
    const duplicateHeader = parseF7MeasurementPaste(makeRequest({ text: "value,value\n0.571,0.572" }));

    expect(unknownHeader.status).toBe("blocked");
    expect(unknownHeader.validation.blockingIssues).toEqual([
      { reason: "invalid_row", factorId: FACTOR_ID, rowNumber: 1 },
    ]);
    expect(duplicateHeader.status).toBe("blocked");
    expect(duplicateHeader.validation.blockingIssues).toEqual([
      { reason: "invalid_row", factorId: FACTOR_ID, rowNumber: 1 },
    ]);
  });

  it("blocks malformed reserved-header rows that mention reserved tokens without supported delimiter", () => {
    const pipeHeader = parseF7MeasurementPaste(makeRequest({ text: "value|sequence\n0.571|1" }));
    const uppercaseWhitespacePipeHeader = parseF7MeasurementPaste(makeRequest({ text: "  VALUE |  Sequence  \n0.571|1" }));
    const missingRequiredValueSequence = parseF7MeasurementPaste(makeRequest({ text: "sequence\n1\n2" }));
    const missingRequiredValueTimestamp = parseF7MeasurementPaste(makeRequest({ text: " timestamp \n2026-08-19T08:00:00.000Z" }));

    expect(pipeHeader.status).toBe("blocked");
    expect(pipeHeader.dataset).toBeUndefined();
    expect(pipeHeader.validation.blockingIssues).toEqual([
      { reason: "invalid_row", factorId: FACTOR_ID, rowNumber: 1 },
    ]);

    expect(uppercaseWhitespacePipeHeader.status).toBe("blocked");
    expect(uppercaseWhitespacePipeHeader.dataset).toBeUndefined();
    expect(uppercaseWhitespacePipeHeader.validation.blockingIssues).toEqual([
      { reason: "invalid_row", factorId: FACTOR_ID, rowNumber: 1 },
    ]);

    expect(missingRequiredValueSequence.status).toBe("blocked");
    expect(missingRequiredValueSequence.dataset).toBeUndefined();
    expect(missingRequiredValueSequence.validation.blockingIssues).toEqual([
      { reason: "invalid_row", factorId: FACTOR_ID, rowNumber: 1 },
    ]);

    expect(missingRequiredValueTimestamp.status).toBe("blocked");
    expect(missingRequiredValueTimestamp.dataset).toBeUndefined();
    expect(missingRequiredValueTimestamp.validation.blockingIssues).toEqual([
      { reason: "invalid_row", factorId: FACTOR_ID, rowNumber: 1 },
    ]);
  });

  it("keeps ordinary non-header text in one-value no-header parsing mode", () => {
    const result = parseF7MeasurementPaste(makeRequest({ text: "oops\n0.571" }));

    expect(result.status).toBe("ready");
    expect(result.dataset?.observations).toHaveLength(1);
    expect(result.dataset?.observations[0]).toMatchObject({ originalRow: 2, value: 0.571 });
    expect(result.dataset?.rejectionSummaries).toEqual([{ rowNumber: 1, reason: "invalid_row" }]);
    expect(result.dataset?.missingRowCount).toBe(0);
  });

  it("enforces JS invariant numeric syntax and rejects NaN, Infinity, empty, and locale comma decimals", () => {
    const text = [
      "value",
      "1.2e-3",
      "0,571",
      "NaN",
      "Infinity",
      "",
      "-0",
    ].join("\n");
    const result = parseF7MeasurementPaste(makeRequest({ text }));

    expect(result.status).toBe("ready");
    expect(result.dataset?.observations.map((entry) => entry.value)).toEqual([0.0012, 0]);
    expect(result.dataset?.missingRowCount).toBe(1);
    expect(result.dataset?.rejectionSummaries).toEqual([
      { rowNumber: 3, reason: "invalid_row" },
      { rowNumber: 4, reason: "non_finite_value" },
      { rowNumber: 5, reason: "non_finite_value" },
    ]);
  });

  it("runtime-validates request and returns fixed confidential validation error shape", () => {
    const marker = "secret-marker-should-not-leak";
    let error: unknown;

    try {
      parseF7MeasurementPaste(
        {
          factorId: "not-a-sha",
          unit: "",
          structure: "ORDERED_INDIVIDUALS",
          sourceReference: marker,
          importedAt: "nope",
          msaStatus: "unknown",
          text: "value\n0.571",
        } as unknown as ParserRequest,
      );
      expect.unreachable();
    } catch (caught) {
      error = caught;
    }

    const serialized = JSON.stringify(error);
    expect(serialized).not.toContain(marker);
    expect(error).toMatchObject({
      code: "validation_error",
      summary: "F7 measurement paste input is invalid.",
      suggestedAction: "Provide a valid factorId, unit, structure, sourceReference, msaStatus, text, and importedAt.",
      affectedInputReferences: ["f7-measurement-paste-input"],
    });
  });

  it("enforces UTF-8 byte size limit and counts multibyte bytes rather than JS string length", () => {
    const overLimit = "值".repeat(524_289);

    expect(() => parseF7MeasurementPaste(makeRequest({ text: overLimit }))).toThrow(
      "F7 measurement paste input is invalid.",
    );
  });

  it("produces deterministic canonical hash that changes with metadata, row order, and row disposition state", () => {
    const base = parseF7MeasurementPaste(makeRequest({ text: "value\n0.571\n0.569" }));
    const changedMetadata = parseF7MeasurementPaste(makeRequest({ sourceReference: "manual-entry" }));
    const changedOrder = parseF7MeasurementPaste(makeRequest({ text: "value\n0.569\n0.571" }));
    const changedDispositionState = parseF7MeasurementPaste(makeRequest({ text: "value\n0.571\nNaN\n0.569" }));

    expect(base.dataset?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(base.dataset?.contentHash).not.toBe(changedMetadata.dataset?.contentHash);
    expect(base.dataset?.contentHash).not.toBe(changedOrder.dataset?.contentHash);
    expect(base.dataset?.contentHash).not.toBe(changedDispositionState.dataset?.contentHash);
  });

  it("conforms to contracts and reconciles counts with all accepted observations included", () => {
    const result = parseF7MeasurementPaste(makeRequest({ text: "value\n0.571\n \ninvalid\n0.569" }));

    expect(() => f7MeasurementPasteResultSchema.parse(result)).not.toThrow();
    expect(() => f7MeasurementDatasetSchema.parse(result.dataset)).not.toThrow();
    expect(result.dataset?.sourceReference).toBe("clipboard");
    expect(result.dataset?.importedAt).toBe(IMPORTED_AT);
    expect(result.dataset?.msaStatus).toBe("unknown");
    expect(result.dataset?.observations.every((entry) => entry.disposition === "included")).toBe(true);
    expect(result.dataset?.originalRowCount).toBe(
      (result.dataset?.observations.length ?? 0)
      + (result.dataset?.missingRowCount ?? 0)
      + (result.dataset?.rejectionSummaries.length ?? 0),
    );
    expect(result.dataset?.analyzedCount).toBe(result.dataset?.observations.length);
  });

  it("does not expose rejected raw marker values in errors or serialized results", () => {
    const marker = "SENSITIVE-RAW-TEXT-123456";
    const result = parseF7MeasurementPaste(makeRequest({ text: `value\n0.571\n${marker}\n0.569` }));
    const serialized = JSON.stringify(result);

    expect(result.status).toBe("ready");
    expect(collectRejectedRows(result)).toEqual([3]);
    expect(serialized).not.toContain(marker);
  });

  it("rejects invalid timestamp rows at parse time without throwing and without raw leak", () => {
    const invalidMarker = "not-an-iso-secret-marker";
    const text = [
      "value,timestamp",
      `0.571,${invalidMarker}`,
      "0.569,2026-08-19T08:01:00.000Z",
    ].join("\n");
    const allValid = [
      "value,timestamp",
      "0.571,2026-08-19T08:00:00.000Z",
      "0.569,2026-08-19T08:01:00.000Z",
    ].join("\n");

    const result = parseF7MeasurementPaste(makeRequest({ text }));
    const validResult = parseF7MeasurementPaste(makeRequest({ text: allValid }));
    const serialized = JSON.stringify(result);

    expect(result.status).toBe("ready");
    expect(result.dataset?.rejectionSummaries).toEqual([{ rowNumber: 2, reason: "invalid_row" }]);
    expect(result.dataset?.observations).toMatchObject([
      {
        originalRow: 3,
        value: 0.569,
        timestamp: "2026-08-19T08:01:00.000Z",
      },
    ]);
    expect(result.dataset?.missingRowCount).toBe(0);
    expect(result.dataset?.originalRowCount).toBe(2);
    expect(result.dataset?.analyzedCount).toBe(1);
    expect(result.dataset?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.dataset?.contentHash).not.toBe(validResult.dataset?.contentHash);
    expect(serialized).not.toContain(invalidMarker);
  });

  it("returns a deep-frozen result", () => {
    const result = parseF7MeasurementPaste(makeRequest());

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.validation)).toBe(true);
    expect(Object.isFrozen(result.validation.blockingIssues)).toBe(true);
    expect(Object.isFrozen(result.dataset)).toBe(true);
    expect(Object.isFrozen(result.dataset?.observations)).toBe(true);
    expect(() => {
      (result as { status: string }).status = "blocked";
    }).toThrow();
  });
});
