import { describe, expect, it } from "vitest";
import { parseF6CliArgs } from "./f6-cli-args.mjs";

const ROOTS = ["f2 run", "f3 run", "f4 run", "f5 run"];
const LANGUAGE_ARGS = ["--language", "en-US"];
const MODEL_ARGS = ["--model-interpretation", "model/run-id/Feature6-Model-Interpretation.json"];
const REQUEST_CONTEXT = {
  requestedAt: "2026-09-16T08:30:12.000Z",
  utcOffsetMinutes: -420,
  source: "cli",
};
const REQUEST_CONTEXT_ARGS = ["--analysis-request-context", JSON.stringify(REQUEST_CONTEXT)];
const INTERACTION_LANGUAGE = {
  languageTag: "en-US",
  uiCatalogLanguage: "en",
  lockedAtTurnId: "f6-cli",
  source: "workflow_start",
  fallbackUsed: false,
};

describe("parseF6CliArgs", () => {
  it("parses four roots, worksheet selection, and governed evidence options", () => {
    expect(parseF6CliArgs([
      ...ROOTS,
      ...LANGUAGE_ARGS,
      "--worksheet", " Analysis-A ",
      "--worksheet", "Analysis B",
      "--supplier-capability", "evidence/supplier.json",
      "--datum-strategy", "evidence/datum.json",
      "--cost", "evidence/cost.json",
      "--image-observations", "evidence/observations.json",
      "--analysis-context", "evidence/context.json",
      "--optimization-targets", "evidence/targets.json",
      "--model-interpretation", "model/run-id/Feature6-Model-Interpretation.json",
      ...REQUEST_CONTEXT_ARGS,
    ])).toEqual({
      f2ArtifactRoot: "f2 run",
      f3ArtifactRoot: "f3 run",
      f4ArtifactRoot: "f4 run",
      f5ArtifactRoot: "f5 run",
      analysisRequestContext: REQUEST_CONTEXT,
      interactionLanguage: INTERACTION_LANGUAGE,
      selectedWorksheetNames: ["Analysis-A", "Analysis B"],
      supplierCapabilityArtifact: "evidence/supplier.json",
      datumStrategyArtifact: "evidence/datum.json",
      costArtifact: "evidence/cost.json",
      imageObservationArtifact: "evidence/observations.json",
      analysisContextArtifact: "evidence/context.json",
      optimizationTargetsArtifact: "evidence/targets.json",
      modelInterpretationArtifact: "model/run-id/Feature6-Model-Interpretation.json",
    });
  });

  it("keeps optional supporting evidence values undefined", () => {
    expect(parseF6CliArgs([...ROOTS, ...LANGUAGE_ARGS, ...MODEL_ARGS, ...REQUEST_CONTEXT_ARGS, "--worksheet", "Analysis-A"])).toEqual({
      f2ArtifactRoot: ROOTS[0],
      f3ArtifactRoot: ROOTS[1],
      f4ArtifactRoot: ROOTS[2],
      f5ArtifactRoot: ROOTS[3],
      analysisRequestContext: REQUEST_CONTEXT,
      interactionLanguage: INTERACTION_LANGUAGE,
      selectedWorksheetNames: ["Analysis-A"],
      supplierCapabilityArtifact: undefined,
      datumStrategyArtifact: undefined,
      costArtifact: undefined,
      imageObservationArtifact: undefined,
      analysisContextArtifact: undefined,
      optimizationTargetsArtifact: undefined,
      modelInterpretationArtifact: MODEL_ARGS[1],
    });
  });

  it("rejects four roots without an explicit worksheet", () => {
    expect(() => parseF6CliArgs([...ROOTS, ...LANGUAGE_ARGS])).toThrow(/at least one --worksheet/i);
  });

  it("rejects a worksheet selection without a locked language", () => {
    expect(() => parseF6CliArgs([...ROOTS, ...MODEL_ARGS, "--worksheet", "Analysis-A"])).toThrow(/--language/i);
  });

  it("rejects a worksheet selection without governed model interpretation", () => {
    expect(() => parseF6CliArgs([...ROOTS, ...LANGUAGE_ARGS, ...REQUEST_CONTEXT_ARGS, "--worksheet", "Analysis-A"])).toThrow(/--model-interpretation/i);
  });

  it("rejects a worksheet selection without governed request context", () => {
    expect(() => parseF6CliArgs([...ROOTS, ...LANGUAGE_ARGS, ...MODEL_ARGS, "--worksheet", "Analysis-A"])).toThrow(/--analysis-request-context/i);
  });

  it.each([[], ["f2"], ["f2", "f3"], ["f2", "f3", "f4"]])(
    "rejects missing roots: %j",
    (args) => expect(() => parseF6CliArgs(args)).toThrow(/four.*artifact roots/i),
  );

  it("rejects options before all roots and extra positional arguments", () => {
    expect(() => parseF6CliArgs(["f2", "f3", "--worksheet", "A", "f4", "f5"]))
      .toThrow(/four.*artifact roots/i);
    expect(() => parseF6CliArgs([...ROOTS, "extra"])).toThrow(/unexpected argument/i);
  });

  it.each(["--worksheet", "--language", "--analysis-request-context", "--supplier-capability", "--datum-strategy", "--cost", "--image-observations", "--analysis-context", "--optimization-targets", "--model-interpretation"])(
    "rejects a missing value for %s",
    (option) => expect(() => parseF6CliArgs([...ROOTS, ...LANGUAGE_ARGS, option])).toThrow(/requires|duplicate/i),
  );

  it("rejects duplicate worksheets after trimming", () => {
    expect(() => parseF6CliArgs([...ROOTS, ...LANGUAGE_ARGS, "--worksheet", "A", "--worksheet", " A "]))
      .toThrow(/duplicate/i);
  });

  it.each(["--language", "--supplier-capability", "--datum-strategy", "--cost", "--image-observations", "--analysis-context", "--optimization-targets", "--model-interpretation"])(
    "rejects duplicate singleton option %s",
    (option) => expect(() => parseF6CliArgs([...ROOTS, ...LANGUAGE_ARGS, option, "a.json", option, "b.json"]))
      .toThrow(/duplicate/i),
  );

  it("rejects duplicate request context options after parsing the first strict JSON value", () => {
    expect(() => parseF6CliArgs([
      ...ROOTS,
      ...LANGUAGE_ARGS,
      ...MODEL_ARGS,
      "--worksheet", "Analysis-A",
      ...REQUEST_CONTEXT_ARGS,
      "--analysis-request-context", JSON.stringify({ ...REQUEST_CONTEXT, requestedAt: "2026-09-16T08:31:12.000Z" }),
    ])).toThrow(/duplicate/i);
  });

  it("rejects unknown options and empty roots", () => {
    expect(() => parseF6CliArgs([...ROOTS, ...LANGUAGE_ARGS, "--unknown", "value"])).toThrow(/unknown option/i);
    expect(() => parseF6CliArgs(["f2", " ", "f4", "f5"])).toThrow(/artifact root/i);
  });

  it("parses request context as strict JSON and preserves the original request instant", () => {
    expect(parseF6CliArgs([
      ...ROOTS,
      ...LANGUAGE_ARGS,
      ...MODEL_ARGS,
      "--worksheet", "Analysis-A",
      "--analysis-request-context", JSON.stringify(REQUEST_CONTEXT),
    ])).toMatchObject({
      selectedWorksheetNames: ["Analysis-A"],
      analysisRequestContext: REQUEST_CONTEXT,
    });
  });

  it("rejects malformed request context JSON", () => {
    expect(() => parseF6CliArgs([
      ...ROOTS,
      ...LANGUAGE_ARGS,
      ...MODEL_ARGS,
      "--worksheet", "Analysis-A",
      "--analysis-request-context", "{not-json",
    ])).toThrow(/valid JSON/i);
  });

  it.each([
    ["schema invalid", { ...REQUEST_CONTEXT, utcOffsetMinutes: 900 }],
    ["unknown field", { ...REQUEST_CONTEXT, generatedAt: "2026-09-16T08:30:12.000Z" }],
  ])("rejects %s request context", (_caseName, requestContext) => {
    expect(() => parseF6CliArgs([
      ...ROOTS,
      ...LANGUAGE_ARGS,
      ...MODEL_ARGS,
      "--worksheet", "Analysis-A",
      "--analysis-request-context", JSON.stringify(requestContext),
    ])).toThrow(/--analysis-request-context is invalid/i);
  });
});