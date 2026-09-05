import path from "node:path";
import { rmSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { validateExistingF6 } from "./index.js";
import {
  createF6ArtifactBundleFixture,
  installF6ModelInterpretation,
} from "../../../scripts/f6-artifact-test-fixture.mjs";
import { runF6FullValidation } from "../../../scripts/run-f6-full-validation.mjs";

const cleanup: string[] = [];

afterEach(() => {
  for (const target of cleanup.splice(0)) rmSync(target, { recursive: true, force: true });
});

describe("validateExistingF6", () => {
  it("accepts a valid published F6 run without parsing Markdown disposition", () => {
    const bundle = createF6ArtifactBundleFixture();
    cleanup.push(bundle.root);
    const runId = "2026-08-24T06-00-00-000Z";
    const runRoot = path.join(bundle.publishRoot, "f6-runs", runId);
    const result = runF6FullValidation({}, {
      parseArgs: () => ({ ...bundle }),
      resolveLayout: () => ({
        runId,
        runRoot,
        publishRoot: bundle.publishRoot,
        optimizationJsonName: "Feature6-Optimization.json",
        optimizationMdName: "Feature6-Optimization.md",
        finalReportMdName: "Feature6-Report.md",
        runSummaryJsonName: "Feature6-Run-Summary.json",
        manifestName: "manifest.json",
      }),
    });

    expect(result.status).toBe("completed");
    expect(validateExistingF6(runRoot, { publishRoot: bundle.publishRoot })).toMatchObject({
      status: "accepted",
      outputDirectory: runRoot,
      finalReportMarkdownPath: path.join(runRoot, "Feature6-Report.md"),
    });
  });

  it("accepts a published F6 run with an authorized model interpretation source", () => {
    const bundle = createF6ArtifactBundleFixture();
    cleanup.push(bundle.root);
    const modelInterpretation = installF6ModelInterpretation(bundle);
    const runId = "2026-09-04T12-30-00-000Z";
    const runRoot = path.join(bundle.publishRoot, "f6-runs", runId);
    const result = runF6FullValidation({}, {
      parseArgs: () => ({ ...bundle, modelInterpretationArtifact: modelInterpretation.filePath }),
      resolveLayout: () => ({
        runId,
        runRoot,
        publishRoot: bundle.publishRoot,
        optimizationJsonName: "Feature6-Optimization.json",
        optimizationMdName: "Feature6-Optimization.md",
        finalReportMdName: "Feature6-Report.md",
        runSummaryJsonName: "Feature6-Run-Summary.json",
        manifestName: "manifest.json",
      }),
    });

    expect(result.status).toBe("completed");
    expect(validateExistingF6(runRoot, { publishRoot: bundle.publishRoot })).toMatchObject({
      status: "accepted",
      outputDirectory: runRoot,
    });
  });
});