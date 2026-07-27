import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createCalculationPlaceholder } from "./calculation-placeholder.js";

const request = {
  contractVersion: "v1" as const,
  inputClassification: "confidential" as const,
  projectReference: "controlled-project-reference",
  runReference: "controlled-run-reference",
  worksheetReferences: ["controlled-worksheet-reference"],
};

describe("calculation placeholder", () => {
  it("returns a deeply frozen unavailable result while preserving controlled references", () => {
    const result = createCalculationPlaceholder(request);

    expect(result).toEqual({
      contractVersion: "v1",
      outputClassification: "confidential",
      featureId: "F4",
      status: "feature_not_available",
      projectReference: "controlled-project-reference",
      runReference: "controlled-run-reference",
      worksheetReferences: ["controlled-worksheet-reference"],
      requiredPrerequisites: ["approved-template-regression", "approved-windows-excel-worker"],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.worksheetReferences)).toBe(true);
    expect(Object.isFrozen(result.requiredPrerequisites)).toBe(true);
    expect(() => { (result.worksheetReferences as string[]).push("changed"); }).toThrow();
  });

  it("denies a non-confidential request with a policy error", () => {
    let error: unknown;
    try {
      createCalculationPlaceholder({ ...request, inputClassification: "public" });
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({ code: "policy_denied" });
  });

  it("exports createCalculationPlaceholder through the built ESM package entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", "import { createCalculationPlaceholder } from '@ai-assist/workbook-catalog'; console.log(typeof createCalculationPlaceholder);"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output.trim()).toBe("function");
  });
});