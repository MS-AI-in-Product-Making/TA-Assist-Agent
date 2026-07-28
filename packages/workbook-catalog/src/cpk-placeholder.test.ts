import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createCpkPlaceholder } from "./cpk-placeholder.js";

const request = {
  contractVersion: "v1" as const,
  inputClassification: "confidential" as const,
  projectReference: "controlled-project-reference",
  runReference: "controlled-run-reference",
  worksheetReferences: ["controlled-worksheet-reference"],
};

describe("Cpk placeholder", () => {
  it("returns a deeply frozen unavailable result while preserving controlled references", () => {
    const result = createCpkPlaceholder(request);

    expect(result).toEqual({
      contractVersion: "v1",
      outputClassification: "confidential",
      featureId: "F7",
      status: "feature_not_available",
      projectReference: "controlled-project-reference",
      runReference: "controlled-run-reference",
      worksheetReferences: ["controlled-worksheet-reference"],
      requiredPrerequisites: ["approved-measurement-store"],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.worksheetReferences)).toBe(true);
    expect(Object.isFrozen(result.requiredPrerequisites)).toBe(true);
    expect(() => { (result.worksheetReferences as string[]).push("changed"); }).toThrow();
  });

  it("denies a non-confidential request with a policy error", () => {
    let error: unknown;
    try {
      createCpkPlaceholder({ ...request, inputClassification: "public" });
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({ code: "policy_denied" });
  });

  it("exports createCpkPlaceholder through the built ESM package entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", "import { createCpkPlaceholder } from '@ai-assist/workbook-catalog'; console.log(typeof createCpkPlaceholder);"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output.trim()).toBe("function");
  });
});