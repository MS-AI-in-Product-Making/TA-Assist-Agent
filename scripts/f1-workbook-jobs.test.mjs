import { describe, expect, it } from "vitest";
import { configuredFeature1Jobs, resolveFeature1Jobs } from "./f1-workbook-jobs.mjs";

const defaults = [
  { workbookPath: "test/default-a.xlsx", selectedManifestPath: "test/a.json" },
  { workbookPath: "test/default-b.xlsx" },
];

describe("resolveFeature1Jobs", () => {
  it("exports the frozen configured workbook list", () => {
    expect(configuredFeature1Jobs).toHaveLength(3);
    expect(Object.isFrozen(configuredFeature1Jobs)).toBe(true);
    expect(Object.isFrozen(configuredFeature1Jobs[0])).toBe(true);
  });
  it("preserves configured jobs when no workbook argument is provided", () => {
    expect(resolveFeature1Jobs([], defaults)).toEqual(defaults);
  });

  it("selects only the workbook supplied on the command line", () => {
    expect(resolveFeature1Jobs(["test/report.xlsx"], defaults)).toEqual([
      { workbookPath: "test/report.xlsx" },
    ]);
  });

  it("rejects more than one workbook argument", () => {
    expect(() => resolveFeature1Jobs(["test/a.xlsx", "test/b.xlsx"], defaults))
      .toThrow("Feature 1 workflow accepts at most one workbook path.");
  });
});