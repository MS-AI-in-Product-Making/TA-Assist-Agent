import { describe, expect, it } from "vitest";
import { parseF3CliArgs } from "./f3-cli-args.mjs";

describe("parseF3CliArgs", () => {
  it("parses an artifact root with repeatable worksheet flags", () => {
    expect(parseF3CliArgs([
      "controlled/f2",
      "--worksheet", "Analysis-A",
      "--worksheet", "Analysis-B,Left",
    ])).toEqual({
      artifactRoot: "controlled/f2",
      selectedWorksheetNames: ["Analysis-A", "Analysis-B,Left"],
    });
  });

  it("keeps worksheet selection undefined when no flags are supplied", () => {
    expect(parseF3CliArgs(["controlled/f2"])).toEqual({
      artifactRoot: "controlled/f2",
      analysisRoot: undefined,
      selectedWorksheetNames: undefined,
    });
  });

  it("parses an explicit analysis workspace root", () => {
    expect(parseF3CliArgs([
      "controlled/f2",
      "--analysis-root", "test/20260921 - Demo",
      "--worksheet", "Analysis-A",
    ])).toEqual({
      artifactRoot: "controlled/f2",
      analysisRoot: "test/20260921 - Demo",
      selectedWorksheetNames: ["Analysis-A"],
    });
  });

  it.each([
    { args: [], message: "exactly one Feature 2 artifact directory" },
    { args: ["controlled/f2", "extra"], message: "Unexpected argument" },
    { args: ["controlled/f2", "--unknown"], message: "Unknown option" },
    { args: ["controlled/f2", "--analysis-root"], message: "--analysis-root requires one analysis workspace root" },
    { args: ["controlled/f2", "--analysis-root", ""], message: "--analysis-root requires one analysis workspace root" },
    { args: ["controlled/f2", "--analysis-root", "--worksheet"], message: "--analysis-root requires one analysis workspace root" },
    { args: ["controlled/f2", "--analysis-root", "root-a", "--analysis-root", "root-b"], message: "--analysis-root requires one analysis workspace root" },
    { args: ["controlled/f2", "--worksheet"], message: "requires a worksheet name" },
    { args: ["controlled/f2", "--worksheet", ""], message: "requires a worksheet name" },
  ])("rejects invalid arguments: $args", ({ args, message }) => {
    expect(() => parseF3CliArgs(args)).toThrow(message);
  });
});