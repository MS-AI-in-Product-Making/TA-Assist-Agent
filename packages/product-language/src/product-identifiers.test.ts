import { describe, expect, it } from "vitest";
import { assertNoProhibitedProductIdentifiers, productSafeNameV1 } from "./product-identifiers.js";

describe("productSafeNameV1", () => {
  it("creates stable Windows-safe names and rejects internal identifiers", () => {
    expect(productSafeNameV1("Gearbox TA.xlsx")).toBe("Gearbox-TA");
    expect(productSafeNameV1("CON.xlsx")).toBe("workbook-CON");
    expect(() => assertNoProhibitedProductIdentifiers("F6 running")).toThrow();
    expect(() => assertNoProhibitedProductIdentifiers("Feature6-Report.md")).toThrow();
  });
});
