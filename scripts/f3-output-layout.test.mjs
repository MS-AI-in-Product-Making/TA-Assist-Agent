import { describe, expect, it } from "vitest";
import { resolveFeature3OutputLayout } from "./f3-output-layout.mjs";

describe("resolveFeature3OutputLayout", () => {
  it("isolates one sanitized F2 artifact directory in fixed Feature 3 output", () => {
    expect(resolveFeature3OutputLayout(["runs/demo/f2"])).toEqual({
      outRoot: "test/demo-output/feature3-output/f2",
      reportJsonName: "Feature3-Report.json",
      reportMdName: "Feature3-Report.md",
    });
    expect(resolveFeature3OutputLayout(["runs/A:B/f2 output"]).outRoot).toContain("f2-output");
  });

  it("requires one F2 artifact directory and rejects Excel", () => {
    expect(() => resolveFeature3OutputLayout([])).toThrow("exactly one Feature 2 artifact directory");
    expect(() => resolveFeature3OutputLayout(["a", "b"])).toThrow("exactly one Feature 2 artifact directory");
    expect(() => resolveFeature3OutputLayout(["Demo.xlsx"])).toThrow("requires a Feature 2 artifact directory");
  });

  it("accepts a safe explicit output root", () => {
    expect(resolveFeature3OutputLayout(["artifact"], "runs/demo/f3").outRoot).toBe("runs/demo/f3");
  });

  it.each(["", "runs/../shared"])('rejects unsafe output override "%s"', (outputRoot) => {
    expect(() => resolveFeature3OutputLayout(["artifact"], outputRoot)).toThrow(/output root/i);
  });
});