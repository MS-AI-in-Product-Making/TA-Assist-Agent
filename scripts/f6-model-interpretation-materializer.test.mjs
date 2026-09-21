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
  const responsePath = bundle.analysisRoot === undefined
    ? path.join(bundle.publishRoot, "f6-model-responses", F6_FIXTURE_WORKBOOK_HASH, "11111111-1111-4111-8111-111111111111", "Feature6-Model-Response.json")
    : path.join(bundle.analysisRoot, "06 - F6 Design Optimization", "evidence", "model-response", "Feature6-Model-Response.json");
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

function createAnalysisWorkspaceRoot(bundle) {
  const analysisRoot = path.join(bundle.root, "20260921 - Anonymous");
  const stagePaths = {
    f1: path.join(analysisRoot, "01 - F1 Data Parsing"),
    f2: path.join(analysisRoot, "02 - F2 Data Cleaning"),
    f3: path.join(analysisRoot, "03 - F3 Drawing Governance"),
    f4: path.join(analysisRoot, "04 - F4 Calculation Engine"),
    f5: path.join(analysisRoot, "05 - F5 Result Interpretation"),
    f6: path.join(analysisRoot, "06 - F6 Design Optimization"),
  };
  Object.values(stagePaths).forEach((stagePath) => mkdirSync(stagePath, { recursive: true }));
  writeFileSync(path.join(stagePaths.f2, "Feature2-Report.json"), readFileSync(bundle.paths.f2));
  writeFileSync(path.join(stagePaths.f3, "Feature3-Report.json"), readFileSync(bundle.paths.f3));
  writeFileSync(path.join(stagePaths.f4, "Feature4-Calculation.json"), readFileSync(bundle.paths.f4));
  writeFileSync(path.join(stagePaths.f5, "Feature5-Report.json"), readFileSync(bundle.paths.f5));
  writeFileSync(path.join(analysisRoot, "analysis-run-summary.json"), `${JSON.stringify({
    contractVersion: "analysis-workspace-v1",
    analysisRoot,
    summaryPath: path.join(analysisRoot, "analysis-run-summary.json"),
    workbook: { fileName: "Anonymous.xlsx", contentHash: F6_FIXTURE_WORKBOOK_HASH },
    allocationDate: "20260921",
    currentStage: "f1",
    stageDirectories: {
      f1: "01 - F1 Data Parsing",
      f2: "02 - F2 Data Cleaning",
      f3: "03 - F3 Drawing Governance",
      f4: "04 - F4 Calculation Engine",
      f5: "05 - F5 Result Interpretation",
      f6: "06 - F6 Design Optimization",
    },
    stages: {
      f1: { status: "pending", artifacts: {} },
      f2: { status: "pending", artifacts: {} },
      f3: { status: "pending", artifacts: {} },
      f4: { status: "pending", artifacts: {} },
      f5: { status: "pending", artifacts: {} },
      f6: { status: "pending", artifacts: {} },
    },
    overallStatus: "in_progress",
  }, null, 2)}\n`, "utf8");
  Object.assign(bundle, {
    analysisRoot,
    f2ArtifactRoot: stagePaths.f2,
    f3ArtifactRoot: stagePaths.f3,
    f4ArtifactRoot: stagePaths.f4,
    f5ArtifactRoot: stagePaths.f5,
    workspaceStagePaths: stagePaths,
  });
  return { analysisRoot, stagePaths };
}

it("materializes one current v3 artifact from a terminal drawing-governance-v3 receipt", () => {
  const worksheetNames = ["Analysis-E", "Analysis-C", "Analysis-A", "Analysis-D", "Analysis-B"];
  const bundle = createF6ArtifactBundleFixture({ worksheetNames });
  cleanup.push(bundle.root);
  const { analysisRoot, stagePaths } = createAnalysisWorkspaceRoot(bundle);
  rewriteFixtureJson(bundle.paths.f3, (value) => {
    value.modelVersion = "drawing-governance-v3";
    value.ado = {
      status: "updated",
      operation: "updated",
      organization: "1ES4Devices",
      project: "MechanicalEngineering",
      workItemId: 1119364,
    };
  });
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
    "--analysis-root", analysisRoot,
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
  expect(output.artifactPath).toBe(path.join(stagePaths.f6, "evidence", "model-interpretation", "Feature6-Model-Interpretation.json"));
  expect(existsSync(path.join(bundle.publishRoot, "f6-model-interpretations"))).toBe(false);
  expect(existsSync(path.join(bundle.publishRoot, "f6-model-responses"))).toBe(false);
  const loaded = loadF6ArtifactBundle({
    ...bundle,
    analysisRoot,
    analysisRequestContext: { requestedAt: "2026-09-16T08:30:12.000Z", utcOffsetMinutes: 0, source: "cli" },
    publishRoot: analysisRoot,
    modelInterpretationArtifactRoot: path.dirname(output.artifactPath),
    modelInterpretationArtifact: path.basename(output.artifactPath),
    expectedModelInterpretationContentHash: output.contentHash,
    requireMultimodalV3: true,
  });
  expect(loaded.status).toBe("accepted");
  expect(loaded.modelInterpretation.worksheets).toHaveLength(5);
});

it("accepts equivalent numeric and string DIM ID representations", () => {
  const worksheetNames = ["Analysis-A"];
  const bundle = createF6ArtifactBundleFixture({ worksheetNames });
  cleanup.push(bundle.root);
  createAnalysisWorkspaceRoot(bundle);
  rewriteFixtureJson(bundle.paths.f2, (value) => {
    value.worksheets[0].rows[0].actualFields.dimCharacteristicId = 1;
  });
  rewriteFixtureJson(bundle.paths.f3, (value) => {
    value.worksheets[0].rows[0].dimId = "1";
  });
  const responsePath = writeResponse(bundle, worksheetNames);

  expect(() => materializeF6ModelInterpretation({
    ...bundle,
    responsePath,
    outputRoot: bundle.publishRoot,
    analysisRoot: bundle.analysisRoot,
  })).not.toThrow();
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
    analysisRoot: bundle.analysisRoot,
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
    analysisRoot: bundle.analysisRoot,
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
    analysisRoot: bundle.analysisRoot,
  })).toThrow(/missing source row/i);
  expect(existsSync(path.join(bundle.publishRoot, "f6-model-interpretations"))).toBe(false);
});

it("accepts equivalent numeric and string DIM IDs across current evidence", () => {
  const worksheetNames = ["Analysis-A"];
  const bundle = createF6ArtifactBundleFixture({ worksheetNames });
  cleanup.push(bundle.root);
  const responsePath = writeResponse(bundle, worksheetNames);
  rewriteFixtureJson(bundle.paths.f2, (value) => {
    value.worksheets[0].rows[0].actualFields.dimCharacteristicId = 1;
    return value;
  });
  rewriteFixtureJson(bundle.paths.f3, (value) => {
    value.worksheets[0].rows[0].dimId = "1";
    return value;
  });

  const result = materializeF6ModelInterpretation({
    ...bundle,
    responsePath,
    outputRoot: bundle.publishRoot,
    analysisRoot: bundle.analysisRoot,
  });

  expect(result.status).toBe("completed");
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

it("fails closed when the validated stage6 destination is swapped before response read", () => {
  const worksheetNames = ["Analysis-A"];
  const bundle = createF6ArtifactBundleFixture({ worksheetNames });
  cleanup.push(bundle.root);
  const { stagePaths } = createAnalysisWorkspaceRoot(bundle);
  const responsePath = writeResponse(bundle, worksheetNames);
  const attackerStage = path.join(bundle.root, "attacker-stage");
  const attackerResponsePath = path.join(attackerStage, "evidence", "model-response", "Feature6-Model-Response.json");
  mkdirSync(path.dirname(attackerResponsePath), { recursive: true });
  writeFileSync(attackerResponsePath, readFileSync(responsePath));

  expect(() => materializeF6ModelInterpretation({
    ...bundle,
    responsePath,
    outputRoot: bundle.publishRoot,
    analysisRoot: bundle.analysisRoot,
  }, {
    beforeReadResponse: () => {
      rmSync(stagePaths.f6, { recursive: true, force: true });
      mkdirSync(path.dirname(responsePath), { recursive: true });
      writeFileSync(responsePath, readFileSync(attackerResponsePath));
    },
  })).toThrow(/workspace root changed|validated f6 stage path changed|identity/i);
  expect(existsSync(path.join(attackerStage, "evidence", "model-interpretation", "Feature6-Model-Interpretation.json"))).toBe(false);
});

it("fails closed when the validated stage6 destination is swapped before output write", () => {
  const worksheetNames = ["Analysis-A"];
  const bundle = createF6ArtifactBundleFixture({ worksheetNames });
  cleanup.push(bundle.root);
  const { stagePaths } = createAnalysisWorkspaceRoot(bundle);
  const responsePath = writeResponse(bundle, worksheetNames);
  const attackerStage = path.join(bundle.root, "attacker-stage");

  expect(() => materializeF6ModelInterpretation({
    ...bundle,
    responsePath,
    outputRoot: bundle.publishRoot,
    analysisRoot: bundle.analysisRoot,
  }, {
    beforeOpenOwnedFile: () => {
      rmSync(stagePaths.f6, { recursive: true, force: true });
      mkdirSync(path.join(attackerStage, "evidence", "model-interpretation"), { recursive: true });
      mkdirSync(path.join(stagePaths.f6, "evidence", "model-interpretation"), { recursive: true });
    },
  })).toThrow(/workspace root changed|validated f6 stage path changed|identity/i);
  expect(existsSync(path.join(attackerStage, "evidence", "model-interpretation", "Feature6-Model-Interpretation.json"))).toBe(false);
});

it("fails closed when the validated stage6 destination is swapped at the rename boundary", () => {
  const worksheetNames = ["Analysis-A"];
  const bundle = createF6ArtifactBundleFixture({ worksheetNames });
  cleanup.push(bundle.root);
  const { stagePaths } = createAnalysisWorkspaceRoot(bundle);
  const responsePath = writeResponse(bundle, worksheetNames);
  const attackerStage = path.join(bundle.root, "attacker-stage");

  expect(() => materializeF6ModelInterpretation({
    ...bundle,
    responsePath,
    outputRoot: bundle.publishRoot,
    analysisRoot: bundle.analysisRoot,
  }, {
    beforeRenameOwnedFile: () => {
      rmSync(stagePaths.f6, { recursive: true, force: true });
      mkdirSync(path.join(attackerStage, "evidence", "model-interpretation"), { recursive: true });
      mkdirSync(path.join(stagePaths.f6, "evidence", "model-interpretation"), { recursive: true });
    },
  })).toThrow(/workspace root changed|validated f6 stage path changed|identity/i);
  expect(existsSync(path.join(attackerStage, "evidence", "model-interpretation", "Feature6-Model-Interpretation.json"))).toBe(false);
});