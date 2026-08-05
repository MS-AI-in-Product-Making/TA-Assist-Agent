import { describe, expect, it } from "vitest";
import { resolveFeature2OutputLayout } from "./f2-output-layout.mjs";

describe("resolveFeature2OutputLayout", () => {
  it("isolates one sanitized F1 artifact directory in fixed Feature 2 output", () => {
    expect(resolveFeature2OutputLayout(["test/demo-output/feature1-output/Demo Workbook"])).toEqual({
      outRoot: "test/demo-output/feature2-output/Demo-Workbook",
      reportJsonName: "Feature2-Report.json",
      reportMdName: "Feature2-Report.md",
    });
    expect(resolveFeature2OutputLayout(["test/demo-output/feature1-output/A:B"]).outRoot).toContain("A-B");
  });

  it("requires exactly one F1 artifact directory and rejects Excel", () => {
    expect(() => resolveFeature2OutputLayout([])).toThrow("exactly one Feature 1 artifact directory");
    expect(() => resolveFeature2OutputLayout(["a", "b"])).toThrow("exactly one Feature 1 artifact directory");
    expect(() => resolveFeature2OutputLayout(["test/Demo.xlsx"])).toThrow("requires a Feature 1 artifact directory");
  });

  it("uses an explicit isolated output root", () => {
    expect(resolveFeature2OutputLayout(["artifact"], "runs/x/f2").outRoot).toBe("runs/x/f2");
  });

  it.each(["", "runs/../shared"])("rejects unsafe output override %j", (outputRoot) => {
    expect(() => resolveFeature2OutputLayout(["artifact"], outputRoot)).toThrow(/output root/i);
  });
});