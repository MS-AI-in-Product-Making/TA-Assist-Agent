import { readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createF6ArtifactBundleFixture, installRequiredMultimodalV3 } from "./f6-artifact-test-fixture.mjs";
import { runF6FullValidation } from "./run-f6-full-validation.mjs";

const cleanup = [];
const INTERACTION_LANGUAGE = { languageTag: "en-US", uiCatalogLanguage: "en", lockedAtTurnId: "f6-cli", source: "workflow_start", fallbackUsed: false };

afterEach(() => {
  for (const target of cleanup.splice(0)) rmSync(target, { recursive: true, force: true });
});

function layoutFor(bundle, runId = "2026-08-24T07-00-00-000Z") {
  return {
    artifactSetVersion: "f6-artifact-set-v3",
    runId,
    runRoot: path.join(bundle.publishRoot, "f6-runs", runId),
    publishRoot: bundle.publishRoot,
    optimizationJsonName: "Feature6-Optimization.json",
    optimizationMdName: "Feature6-Optimization.md",
    finalReportMdName: "Feature6-Report.md",
    finalReportPdfName: "Feature6-Report.pdf",
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

  it("loads model interpretation from an independent governed root", () => {
    const bundle = createF6ArtifactBundleFixture();
    cleanup.push(bundle.root);
    const layout = layoutFor(bundle);
    const contextPath = path.join(bundle.root, "shared-evidence", "context.json");
    const modelPath = path.join(bundle.root, "model-evidence", "run-id", "Feature6-Model-Interpretation.json");
    const loadBundle = vi.fn(() => ({ status: "rejected", reasonCode: "test_rejection" }));

    runF6FullValidation({}, {
      parseArgs: () => ({
        ...bundle,
        interactionLanguage: INTERACTION_LANGUAGE,
        expectedModelInterpretationContentHash: "a".repeat(64),
        analysisContextArtifact: contextPath,
        modelInterpretationArtifact: modelPath,
      }),
      resolveLayout: () => layout,
      loadBundle,
    });

    expect(loadBundle).toHaveBeenCalledWith(expect.objectContaining({
      evidenceArtifactRoot: path.dirname(contextPath),
      analysisContextArtifact: path.basename(contextPath),
      modelInterpretationArtifactRoot: path.dirname(modelPath),
      modelInterpretationArtifact: path.basename(modelPath),
    }));
  });

  it("forwards versioned context and target artifacts without changing governed path normalization", () => {
    const bundle = createF6ArtifactBundleFixture();
    cleanup.push(bundle.root);
    const layout = layoutFor(bundle);
    const contextPath = path.join(bundle.root, "shared-evidence", "f6-analysis-context-v2.json");
    const targetsPath = path.join(bundle.root, "shared-evidence", "f6-optimization-targets-v2.json");
    const modelPath = path.join(bundle.root, "model-evidence", "run-id", "Feature6-Model-Interpretation.json");
    const loadBundle = vi.fn(() => ({ status: "rejected", reasonCode: "test_rejection" }));

    runF6FullValidation({}, {
      parseArgs: () => ({
        ...bundle,
        interactionLanguage: INTERACTION_LANGUAGE,
        expectedModelInterpretationContentHash: "a".repeat(64),
        analysisContextArtifact: contextPath,
        optimizationTargetsArtifact: targetsPath,
        modelInterpretationArtifact: modelPath,
      }),
      resolveLayout: () => layout,
      loadBundle,
    });

    expect(loadBundle).toHaveBeenCalledWith(expect.objectContaining({
      evidenceArtifactRoot: path.dirname(contextPath),
      analysisContextArtifact: path.basename(contextPath),
      optimizationTargetsArtifact: path.basename(targetsPath),
      modelInterpretationArtifactRoot: path.dirname(modelPath),
      modelInterpretationArtifact: path.basename(modelPath),
    }));
  });

  it("does not rewrite a failure manifest produced by the governed runner", () => {
    const bundle = createF6ArtifactBundleFixture();
    installRequiredMultimodalV3(bundle);
    cleanup.push(bundle.root);
    const layout = layoutFor(bundle);
    const result = runF6FullValidation({}, {
      parseArgs: () => ({
        ...bundle,
        interactionLanguage: INTERACTION_LANGUAGE,
        modelInterpretationArtifact: path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact),
      }),
      resolveLayout: () => layout,
      renderFinalReportPdf: () => {
        throw Object.assign(new Error("confidential browser output"), {
          code: "pdf_render_unavailable",
          attempts: [
            { browser: "msedge.exe", reason: "execution_failed" },
            { browser: "chrome.exe", reason: "invalid_pdf" },
          ],
        });
      },
    });

    const failureDetail = {
      code: "pdf_render_unavailable",
      attempts: [
        { browser: "msedge.exe", reason: "execution_failed" },
        { browser: "chrome.exe", reason: "invalid_pdf" },
      ],
    };
    expect(result).toMatchObject({ status: "failed", reasonCode: "report_failed", failureDetail });
    const manifest = JSON.parse(readFileSync(path.join(layout.runRoot, "manifest.json"), "utf8"));
    expect(manifest).toMatchObject({ status: "failed", reasonCode: "report_failed", failureDetail });
    expect(JSON.stringify(result)).not.toContain("confidential browser output");
    expect(JSON.stringify(manifest)).not.toContain("confidential browser output");
  });

  it("distinguishes report projection failures without exposing internal content", () => {
    const bundle = createF6ArtifactBundleFixture();
    installRequiredMultimodalV3(bundle);
    cleanup.push(bundle.root);
    const layout = layoutFor(bundle);
    const result = runF6FullValidation({}, {
      parseArgs: () => ({
        ...bundle,
        interactionLanguage: INTERACTION_LANGUAGE,
        modelInterpretationArtifact: path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact),
      }),
      resolveLayout: () => layout,
      createFinalReport: () => {
        throw new Error("confidential report content");
      },
    });

    expect(result).toMatchObject({
      status: "failed",
      reasonCode: "report_failed",
      failureDetail: { code: "report_projection_failed" },
    });
    const manifest = JSON.parse(readFileSync(path.join(layout.runRoot, "manifest.json"), "utf8"));
    expect(manifest).toMatchObject({ failureDetail: { code: "report_projection_failed" } });
    expect(JSON.stringify(result)).not.toContain("confidential report content");
  });
});