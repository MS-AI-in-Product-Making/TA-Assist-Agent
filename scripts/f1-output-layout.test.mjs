import { describe, expect, it } from "vitest";
import { resolveFeature1OutputLayout } from "./f1-output-layout.mjs";

describe("resolveFeature1OutputLayout", () => {
  it("keeps timestamped validation outputs for batch mode", () => {
    expect(resolveFeature1OutputLayout([], "2026-07-30T06-11-28-928Z")).toEqual({
      mode: "batch",
      outRoot: "test/demo-output/feature1-validation",
      reportMdName: "f1-strict-workflow-2026-07-30T06-11-28-928Z.md",
      reportJsonName: "f1-strict-workflow-2026-07-30T06-11-28-928Z.json",
      latestMdName: "latest.md",
      latestJsonName: "latest.json",
      resetOutputRoot: false,
    });
  });

  it("isolates a single workbook under a fixed workbook directory", () => {
    expect(resolveFeature1OutputLayout(
      ["test/Mauna_Loa_TP_Step_20260611.xlsx"],
      "ignored",
    )).toEqual({
      mode: "single",
      outRoot: "test/demo-output/feature1-output/Mauna_Loa_TP_Step_20260611",
      reportMdName: "Feature1-Report.md",
      reportJsonName: "Feature1-Report.json",
      resetOutputRoot: true,
    });
  });

  it("removes the extension and sanitizes an unsafe workbook name", () => {
    const layout = resolveFeature1OutputLayout(["test/A:B report.xlsx"], "ignored");
    expect(layout.outRoot).toBe("test/demo-output/feature1-output/A-B-report");
  });

  it("uses an explicit isolated output root", () => {
    expect(resolveFeature1OutputLayout(["a.xlsx"], "run-id", "runs/x/f1").outRoot).toBe("runs/x/f1");
  });

  it.each(["", "runs/../shared"])("rejects unsafe output override %j", (outputRoot) => {
    expect(() => resolveFeature1OutputLayout(["a.xlsx"], "run-id", outputRoot)).toThrow(/output root/i);
  });

  it("rejects more than one workbook path", () => {
    expect(() => resolveFeature1OutputLayout(["test/a.xlsx", "test/b.xlsx"], "ignored"))
      .toThrow("Feature 1 output layout accepts at most one workbook path.");
  });
});