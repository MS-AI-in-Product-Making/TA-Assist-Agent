import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createComparisonPlaceholder } from "./comparison-placeholder.js";

const request = {
  contractVersion: "v1" as const,
  inputClassification: "confidential" as const,
  projectReference: "controlled-project-reference",
  runReference: "controlled-run-reference",
  worksheetReferences: ["controlled-worksheet-reference"],
};

describe("comparison placeholder", () => {
  it("returns a deeply frozen unavailable result while preserving controlled references", () => {
    const result = createComparisonPlaceholder(request);

    expect(result).toEqual({
      contractVersion: "v1",
      outputClassification: "confidential",
      featureId: "F6",
      status: "feature_not_available",
      projectReference: "controlled-project-reference",
      runReference: "controlled-run-reference",
      worksheetReferences: ["controlled-worksheet-reference"],
      requiredPrerequisites: ["approved-knowledge-base"],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.worksheetReferences)).toBe(true);
    expect(Object.isFrozen(result.requiredPrerequisites)).toBe(true);
    expect(() => { (result.worksheetReferences as string[]).push("changed"); }).toThrow();
  });

  it("denies a non-confidential request with a policy error", () => {
    let error: unknown;
    try {
      createComparisonPlaceholder({ ...request, inputClassification: "public" });
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({ code: "policy_denied" });
  });

  it("exports createComparisonPlaceholder through the built ESM package entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", "import { createComparisonPlaceholder } from '@ai-assist/workbook-catalog'; console.log(typeof createComparisonPlaceholder);"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output.trim()).toBe("function");
  });
});