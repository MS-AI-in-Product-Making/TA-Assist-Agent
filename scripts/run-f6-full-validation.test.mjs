import { readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createF6ArtifactBundleFixture } from "./f6-artifact-test-fixture.mjs";
import { runF6FullValidation } from "./run-f6-full-validation.mjs";

const cleanup = [];

afterEach(() => {
  for (const target of cleanup.splice(0)) rmSync(target, { recursive: true, force: true });
});

function layoutFor(bundle, runId = "2026-08-24T07-00-00-000Z") {
  return {
    runId,
    runRoot: path.join(bundle.publishRoot, "f6-runs", runId),
    publishRoot: bundle.publishRoot,
    optimizationJsonName: "Feature6-Optimization.json",
    optimizationMdName: "Feature6-Optimization.md",
    finalReportMdName: "Feature6-Report.md",
    runSummaryJsonName: "Feature6-Run-Summary.json",
    manifestName: "manifest.json",
  };
}

describe("runF6FullValidation", () => {
  it("uses one resolved output layout for bundle loading and runner output", () => {
    const bundle = createF6ArtifactBundleFixture();
    cleanup.push(bundle.root);
    const layout = layoutFor(bundle);
    const resolveLayout = vi.fn(() => layout);
    const loadBundle = vi.fn((request) => ({
      status: "rejected",
      reasonCode: request.publishRoot === layout.publishRoot ? "test_rejection" : "wrong_publish_root",
    }));

    const result = runF6FullValidation({}, {
      parseArgs: () => ({ ...bundle }),
      resolveLayout,
      loadBundle,
    });

    expect(result).toMatchObject({ status: "failed", reasonCode: "input_rejected" });
    expect(resolveLayout).toHaveBeenCalledTimes(1);
    expect(loadBundle).toHaveBeenCalledWith(expect.objectContaining({ publishRoot: layout.publishRoot }));
  });

  it("does not rewrite a failure manifest produced by the governed runner", () => {
    const bundle = createF6ArtifactBundleFixture();
    cleanup.push(bundle.root);
    const layout = layoutFor(bundle);
    const result = runF6FullValidation({}, {
      parseArgs: () => ({ ...bundle }),
      resolveLayout: () => layout,
      createFinalReport: () => {
        throw new Error("report rendering failed");
      },
    });

    expect(result).toMatchObject({ status: "failed", reasonCode: "report_failed" });
    const manifest = JSON.parse(readFileSync(path.join(layout.runRoot, "manifest.json"), "utf8"));
    expect(manifest).toMatchObject({ status: "failed", reasonCode: "report_failed" });
  });
});