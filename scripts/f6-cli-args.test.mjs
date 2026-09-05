import { describe, expect, it } from "vitest";
import { parseF6CliArgs } from "./f6-cli-args.mjs";

const ROOTS = ["f2 run", "f3 run", "f4 run", "f5 run"];

describe("parseF6CliArgs", () => {
  it("parses four roots, worksheet selection, and governed evidence options", () => {
    expect(parseF6CliArgs([
      ...ROOTS,
      "--worksheet", " Analysis-A ",
      "--worksheet", "Analysis B",
      "--supplier-capability", "evidence/supplier.json",
      "--datum-strategy", "evidence/datum.json",
      "--cost", "evidence/cost.json",
      "--image-observations", "evidence/observations.json",
      "--analysis-context", "evidence/context.json",
      "--optimization-targets", "evidence/targets.json",
      "--model-interpretation", "model/run-id/Feature6-Model-Interpretation.json",
    ])).toEqual({
      f2ArtifactRoot: "f2 run",
      f3ArtifactRoot: "f3 run",
      f4ArtifactRoot: "f4 run",
      f5ArtifactRoot: "f5 run",
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

  it("keeps optional evidence values undefined", () => {
    expect(parseF6CliArgs([...ROOTS, "--worksheet", "Analysis-A"])).toEqual({
      f2ArtifactRoot: ROOTS[0],
      f3ArtifactRoot: ROOTS[1],
      f4ArtifactRoot: ROOTS[2],
      f5ArtifactRoot: ROOTS[3],
      selectedWorksheetNames: ["Analysis-A"],
      supplierCapabilityArtifact: undefined,
      datumStrategyArtifact: undefined,
      costArtifact: undefined,
      imageObservationArtifact: undefined,
      analysisContextArtifact: undefined,
      optimizationTargetsArtifact: undefined,
      modelInterpretationArtifact: undefined,
    });
  });

  it("rejects four roots without an explicit worksheet", () => {
    expect(() => parseF6CliArgs(ROOTS)).toThrow(/at least one --worksheet/i);
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

  it.each(["--worksheet", "--supplier-capability", "--datum-strategy", "--cost", "--image-observations", "--analysis-context", "--optimization-targets", "--model-interpretation"])(
    "rejects a missing value for %s",
    (option) => expect(() => parseF6CliArgs([...ROOTS, option])).toThrow(/requires/i),
  );

  it("rejects duplicate worksheets after trimming", () => {
    expect(() => parseF6CliArgs([...ROOTS, "--worksheet", "A", "--worksheet", " A "]))
      .toThrow(/duplicate/i);
  });

  it.each(["--supplier-capability", "--datum-strategy", "--cost", "--image-observations", "--analysis-context", "--optimization-targets", "--model-interpretation"])(
    "rejects duplicate singleton option %s",
    (option) => expect(() => parseF6CliArgs([...ROOTS, option, "a.json", option, "b.json"]))
      .toThrow(/duplicate/i),
  );

  it("rejects unknown options and empty roots", () => {
    expect(() => parseF6CliArgs([...ROOTS, "--unknown", "value"])).toThrow(/unknown option/i);
    expect(() => parseF6CliArgs(["f2", " ", "f4", "f5"])).toThrow(/artifact root/i);
  });
});