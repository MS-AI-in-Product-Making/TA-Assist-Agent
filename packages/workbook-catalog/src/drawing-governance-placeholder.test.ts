import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createDrawingGovernancePlaceholder } from "./drawing-governance-placeholder.js";

const request = {
  contractVersion: "v1" as const,
  inputClassification: "confidential" as const,
  projectReference: "controlled-project-reference",
  runReference: "controlled-run-reference",
  worksheetReferences: ["controlled-worksheet-reference"],
};

describe("drawing governance placeholder", () => {
  it("returns a deeply frozen unavailable result while preserving controlled references", () => {
    const result = createDrawingGovernancePlaceholder(request);

    expect(result).toEqual({
      contractVersion: "v1",
      outputClassification: "confidential",
      featureId: "F3",
      status: "feature_not_available",
      projectReference: "controlled-project-reference",
      runReference: "controlled-run-reference",
      worksheetReferences: ["controlled-worksheet-reference"],
      requiredPrerequisites: ["approved-ado-access", "canonical-dim-id-policy"],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.worksheetReferences)).toBe(true);
    expect(Object.isFrozen(result.requiredPrerequisites)).toBe(true);
    expect(() => { (result.worksheetReferences as string[]).push("changed"); }).toThrow();
  });

  it("denies a non-confidential request with a policy error", () => {
    let error: unknown;
    try {
      createDrawingGovernancePlaceholder({ ...request, inputClassification: "public" });
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({ code: "policy_denied" });
  });

  it("exports createDrawingGovernancePlaceholder through the built ESM package entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", "import { createDrawingGovernancePlaceholder } from '@ai-assist/workbook-catalog'; console.log(typeof createDrawingGovernancePlaceholder);"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output.trim()).toBe("function");
  });
});