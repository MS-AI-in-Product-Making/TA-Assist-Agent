import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { f5MultimodalArtifactV3Schema } from "../packages/contracts/dist/ta-multimodal-contracts.js";
import { afterEach, expect, it } from "vitest";

import { createF6ArtifactBundleFixture, F6_FIXTURE_WORKBOOK_HASH, rewriteFixtureJson } from "./f6-artifact-test-fixture.mjs";
import { loadF6ArtifactBundle } from "./f6-artifact-loader.mjs";
import { materializeF6ModelInterpretation } from "./f6-model-interpretation-materializer.mjs";

const cleanup = [];

afterEach(() => {
  for (const target of cleanup.splice(0)) rmSync(target, { recursive: true, force: true });
});

function writeResponse(bundle, worksheetNames, mutate = (value) => value) {
  const responsePath = path.join(bundle.publishRoot, "f6-model-responses", F6_FIXTURE_WORKBOOK_HASH, "11111111-1111-4111-8111-111111111111", "Feature6-Model-Response.json");
  mkdirSync(path.dirname(responsePath), { recursive: true });
  const value = mutate({
    contractVersion: "f6-model-interpretation-response-v1",
    model: { modelId: "test-image-model", supportsImage: true },
    worksheets: worksheetNames.map((worksheetName, index) => ({
      worksheetName,
      imageTableInterpretation: `Visible geometry and the complete Factor table were interpreted independently for ${worksheetName}. Model interpretation may contain hallucinations, label mismatches, or omissions and must be reviewed by ME.`,
      rows: [{ sourceRow: index + 2, visibleStatus: "visible", interpretation: `Factor A is visibly represented for ${worksheetName}; ME review is required.` }],
    })),
  });
  writeFileSync(responsePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return responsePath;
}

it("materializes one current v3 artifact for five selected worksheets", () => {
  const worksheetNames = ["Analysis-E", "Analysis-C", "Analysis-A", "Analysis-D", "Analysis-B"];
  const bundle = createF6ArtifactBundleFixture({ worksheetNames });
  cleanup.push(bundle.root);
  const responsePath = writeResponse(bundle, worksheetNames);

  const npmExecutable = process.platform === "win32" ? process.execPath : "npm";
  const npmPrefixArgs = process.platform === "win32" ? [process.env.npm_execpath] : [];
  const result = spawnSync(npmExecutable, [
    ...npmPrefixArgs,
    "run",
    "--silent",
    "workflow:f6:model-interpretation",
    "--",
    bundle.f2ArtifactRoot,
    bundle.f3ArtifactRoot,
    bundle.f4ArtifactRoot,
    bundle.f5ArtifactRoot,
    ...worksheetNames.flatMap((worksheetName) => ["--worksheet", worksheetName]),
    "--response", responsePath,
  ], {
    cwd: path.resolve("."),
    encoding: "utf8",
    env: {
      ...process.env,
      AI_TVA_F6_PUBLISH_ROOT: bundle.publishRoot,
      npm_config_update_notifier: "false",
    },
    shell: false,
  });

  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr || result.stdout).toBe(0);
  const output = JSON.parse(result.stdout);
  expect(output).toMatchObject({ status: "completed", worksheetCount: 5 });
  const artifact = f5MultimodalArtifactV3Schema.parse(JSON.parse(readFileSync(output.artifactPath, "utf8")));
  expect(artifact.selectedWorksheetNames).toEqual(worksheetNames);
  expect(artifact.worksheets).toHaveLength(5);
  expect(artifact.worksheets.every(({ request, result: modelResult }) => (
    request.factorRows.length === 1 && modelResult.rowMappings.length === 1
  ))).toBe(true);
  expect(path.relative(bundle.publishRoot, output.artifactPath)).toMatch(
    /^f6-model-interpretations[/\\][a-f0-9]{64}[/\\][0-9a-f-]{36}[/\\]Feature6-Model-Interpretation\.json$/,
  );
  const loaded = loadF6ArtifactBundle({
    ...bundle,
    publishRoot: bundle.publishRoot,
    modelInterpretationArtifactRoot: path.dirname(output.artifactPath),
    modelInterpretationArtifact: path.basename(output.artifactPath),
    expectedModelInterpretationContentHash: output.contentHash,
    requireMultimodalV3: true,
  });
  expect(loaded.status).toBe("accepted");
  expect(loaded.modelInterpretation.worksheets).toHaveLength(5);
});

it("accepts a numeric F2 DIM ID matching the normalized F3 string identity", () => {
  const worksheetNames = ["Analysis-A"];
  const bundle = createF6ArtifactBundleFixture({
    worksheetNames,
    actualFieldOverrides: { dimCharacteristicId: 101 },
  });
  cleanup.push(bundle.root);
  rewriteFixtureJson(bundle.paths.f3, (value) => {
    value.worksheets[0].rows[0].dimId = "101";
  });
  const responsePath = writeResponse(bundle, worksheetNames);

  expect(materializeF6ModelInterpretation({
    ...bundle,
    responsePath,
    outputRoot: bundle.publishRoot,
  })).toMatchObject({ status: "completed", worksheetCount: 1 });
});

it("rejects a model response outside the governed response root", () => {
  const worksheetNames = ["Analysis-A"];
  const bundle = createF6ArtifactBundleFixture({ worksheetNames });
  cleanup.push(bundle.root);
  const governedResponse = writeResponse(bundle, worksheetNames);
  const outsideResponse = path.join(bundle.root, "outside-response.json");
  writeFileSync(outsideResponse, readFileSync(governedResponse));

  expect(() => materializeF6ModelInterpretation({
    ...bundle,
    responsePath: outsideResponse,
    outputRoot: bundle.publishRoot,
  })).toThrow(/governed response root/i);
  expect(existsSync(path.join(bundle.publishRoot, "f6-model-interpretations"))).toBe(false);
});

it("rejects model response worksheet order drift before writing an artifact", () => {
  const worksheetNames = ["Analysis-A", "Analysis-B"];
  const bundle = createF6ArtifactBundleFixture({ worksheetNames });
  cleanup.push(bundle.root);
  const responsePath = writeResponse(bundle, [...worksheetNames].reverse());

  expect(() => materializeF6ModelInterpretation({
    ...bundle,
    selectedWorksheetNames: worksheetNames,
    responsePath,
    outputRoot: bundle.publishRoot,
  })).toThrow(/worksheet order/i);
  expect(existsSync(path.join(bundle.publishRoot, "f6-model-interpretations"))).toBe(false);
});

it("rejects a model response that does not map the current Factor source row", () => {
  const worksheetNames = ["Analysis-A"];
  const bundle = createF6ArtifactBundleFixture({ worksheetNames });
  cleanup.push(bundle.root);
  const responsePath = writeResponse(bundle, worksheetNames, (value) => {
    value.worksheets[0].rows[0].sourceRow = 999;
    return value;
  });

  expect(() => materializeF6ModelInterpretation({
    ...bundle,
    responsePath,
    outputRoot: bundle.publishRoot,
  })).toThrow(/missing source row/i);
  expect(existsSync(path.join(bundle.publishRoot, "f6-model-interpretations"))).toBe(false);
});

it("rejects a physical image hash mismatch before writing an artifact", () => {
  const worksheetNames = ["Analysis-A"];
  const bundle = createF6ArtifactBundleFixture({ worksheetNames });
  cleanup.push(bundle.root);
  const responsePath = writeResponse(bundle, worksheetNames);
  rewriteFixtureJson(bundle.paths.f5, (value) => {
    value.worksheets[0].imageReference.contentHash = "f".repeat(64);
    return value;
  });

  expect(() => materializeF6ModelInterpretation({
    ...bundle,
    responsePath,
    outputRoot: bundle.publishRoot,
  })).toThrow(/image.*(?:contentHash|hash)/i);
  expect(existsSync(path.join(bundle.publishRoot, "f6-model-interpretations"))).toBe(false);
});