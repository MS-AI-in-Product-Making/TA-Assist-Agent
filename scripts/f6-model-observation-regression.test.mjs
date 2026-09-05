import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  createF6ArtifactBundleFixture,
  installF5CurrentObservationLedger,
  installF6ModelInterpretation,
} from "./f6-artifact-test-fixture.mjs";
import { loadF6ArtifactBundle } from "./f6-artifact-loader.mjs";

const cleanup = [];

afterEach(() => {
  for (const root of cleanup.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("F6 model-observation evidence continuity regression", () => {
  it("auto-inherits current F5 observation copy when model interpretation binds it", () => {
    const bundle = createF6ArtifactBundleFixture();
    cleanup.push(bundle.root);
    installF5CurrentObservationLedger(bundle);
    installF6ModelInterpretation(bundle);

    // Simulate CLI call that does not explicitly pass --image-observations.
    bundle.imageObservationArtifact = undefined;
    bundle.evidenceArtifactRoot = undefined;

    const result = loadF6ArtifactBundle(bundle);

    expect(result.status, JSON.stringify(result)).toBe("accepted");
    expect(result.sourceReferences.imageObservation).toEqual({
      artifact: "Feature5-Image-Observations.json",
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(result.inputDecisions.modelInterpretation).toEqual({
      outcome: "CALLER_AUTHORIZED",
      artifactReference: expect.objectContaining({ artifact: "Feature6-Model-Interpretation.json" }),
    });
    expect(result.modelInterpretation.worksheets[0].sourceReferences.imageObservation).toEqual({
      ...result.sourceReferences.imageObservation,
      observationVersion: "f5-image-observation-v2",
    });
    expect(result.request.imageObservationReference).toEqual(result.sourceReferences.imageObservation);
  });
});
