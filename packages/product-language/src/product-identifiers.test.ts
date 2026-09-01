import { describe, expect, it } from "vitest";
import {
  assertNoProhibitedProductIdentifiers,
  productSafeNameV1,
  TA_INTERNAL_REVIEW_ARTIFACT_KINDS,
} from "./product-identifiers.js";
import { TA_INTERNAL_WORKFLOW_STATES } from "./ta-workbook-language.js";

function toDeterministicMixedCase(value: string): string {
  return [...value]
    .map((char, index) => (/[a-z]/iu.test(char) ? (index % 2 === 0 ? char.toUpperCase() : char.toLowerCase()) : char))
    .join("");
}

describe("productSafeNameV1", () => {
  it("creates stable Windows-safe names", () => {
    expect(productSafeNameV1("Gearbox TA.xlsx")).toBe("Gearbox-TA");
    expect(productSafeNameV1("CON.xlsx")).toBe("workbook-CON");
  });

  it("produces identical output for NFC-equivalent inputs", () => {
    const nfd = "Cafe\u0301 report.xlsx";
    const nfc = "Caf\u00e9 report.xlsx";
    expect(productSafeNameV1(nfd)).toBe(productSafeNameV1(nfc));
  });

  it("removes trailing spaces and dots", () => {
    expect(productSafeNameV1("Quarterly report...   ")).toBe("Quarterly-report");
  });

  it("returns workbook for empty or stemless input", () => {
    expect(productSafeNameV1("   ")).toBe("workbook");
    expect(productSafeNameV1(".xlsx")).toBe("workbook");
  });

  it("caps output length at 96 characters", () => {
    const name = productSafeNameV1(`${"Alpha ".repeat(30)}.xlsx`);
    expect(name.length).toBeLessThanOrEqual(96);
  });

  it("is deterministic for long names and appends stable hash suffix", () => {
    const input = `${"Long Name Segment ".repeat(30)}.xlsx`;
    const left = productSafeNameV1(input);
    const right = productSafeNameV1(input);

    expect(left).toBe(right);
    expect(left.length).toBeLessThanOrEqual(96);
    expect(left).toMatch(/-[a-f0-9]{8}$/);
  });

  it("keeps reserved Windows names prefixed", () => {
    expect(productSafeNameV1("COM1")).toBe("workbook-COM1");
  });
});

describe("assertNoProhibitedProductIdentifiers", () => {
  it("rejects feature identifiers", () => {
    expect(() => assertNoProhibitedProductIdentifiers("F6 running")).toThrow();
    expect(() => assertNoProhibitedProductIdentifiers("Feature6-Report.md")).toThrow();
  });

  it.each(TA_INTERNAL_WORKFLOW_STATES)("rejects internal workflow state: %s", (state) => {
    expect(() => assertNoProhibitedProductIdentifiers(`status: ${state}`)).toThrow();
  });

  it.each(TA_INTERNAL_REVIEW_ARTIFACT_KINDS)("rejects internal artifact kind: %s", (kind) => {
    expect(() => assertNoProhibitedProductIdentifiers(`kind=${kind}`)).toThrow();
  });

  it.each(TA_INTERNAL_REVIEW_ARTIFACT_KINDS)("rejects uppercase internal artifact kind: %s", (kind) => {
    expect(() => assertNoProhibitedProductIdentifiers(`kind=${kind.toUpperCase()}`)).toThrow();
  });

  it.each(TA_INTERNAL_REVIEW_ARTIFACT_KINDS)("rejects mixed-case internal artifact kind: %s", (kind) => {
    expect(() => assertNoProhibitedProductIdentifiers(`kind=${toDeterministicMixedCase(kind)}`)).toThrow();
  });

  it("does not reject ordinary product language", () => {
    expect(() => assertNoProhibitedProductIdentifiers("Completed report")).not.toThrow();
    expect(() => assertNoProhibitedProductIdentifiers("Cancelled order")).not.toThrow();
    expect(() => assertNoProhibitedProductIdentifiers("Feature highlights")).not.toThrow();
    expect(() => assertNoProhibitedProductIdentifiers("Analysis failed and needs attention")).not.toThrow();
  });
});
