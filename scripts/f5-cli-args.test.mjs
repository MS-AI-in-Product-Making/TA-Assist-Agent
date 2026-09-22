import { describe, expect, it } from "vitest";
import { parseF5CliArgs } from "./f5-cli-args.mjs";

describe("parseF5CliArgs", () => {
  it("parses three artifact roots and supported options", () => {
    expect(parseF5CliArgs([
      "f1 artifact/run",
      "f3 artifact/run",
      "f4 artifact/run",
      "--worksheet", " Analysis-A ",
      "--worksheet", "Analysis B",
      "--image-observations", "observations/image notes.json",
      "--analysis-root", "test/20260921 - Demo",
    ])).toEqual({
      f1ArtifactRoot: "f1 artifact/run",
      f3ArtifactRoot: "f3 artifact/run",
      f4ArtifactRoot: "f4 artifact/run",
      selectedWorksheetNames: ["Analysis-A", "Analysis B"],
      imageObservationsPath: "observations/image notes.json",
      analysisRoot: "test/20260921 - Demo",
    });
  });

  it("keeps optional selections undefined when flags are omitted", () => {
    expect(parseF5CliArgs(["f1-run", "f3-run", "f4-run"])).toEqual({
      f1ArtifactRoot: "f1-run",
      f3ArtifactRoot: "f3-run",
      f4ArtifactRoot: "f4-run",
      selectedWorksheetNames: undefined,
      imageObservationsPath: undefined,
      analysisRoot: undefined,
    });
  });

  it.each([
    { args: [] },
    { args: ["f1-run"] },
    { args: ["f1-run", "f3-run"] },
    { args: ["f1-run", "f3-run", "--worksheet", "Analysis-A"] },
    { args: ["--worksheet", "Analysis-A", "f1-run", "f3-run", "f4-run"] },
  ])("rejects missing roots or flags before all roots: $args", ({ args }) => {
    expect(() => parseF5CliArgs(args)).toThrow(/three.*artifact roots|exactly three/i);
  });

  it.each([
    { args: ["", "f3-run", "f4-run"] },
    { args: ["f1-run", " ", "f4-run"] },
    { args: ["f1-run", "f3-run", ""] },
  ])("rejects empty artifact roots: $args", ({ args }) => {
    expect(() => parseF5CliArgs(args)).toThrow(/artifact root/i);
  });

  it.each([
    { args: ["f1-run", "f3-run", "f4-run", "extra"] },
    { args: ["f1-run", "f3-run", "f4-run", "extra", "--worksheet", "Analysis-A"] },
  ])("rejects extra positional arguments: $args", ({ args }) => {
    expect(() => parseF5CliArgs(args)).toThrow(/unexpected argument|exactly three/i);
  });

  it.each([
    { suffix: ["--worksheet"] },
    { suffix: ["--worksheet", ""] },
    { suffix: ["--worksheet", " "] },
    { suffix: ["--worksheet", "--image-observations", "notes.json"] },
    { suffix: ["--image-observations"] },
    { suffix: ["--image-observations", ""] },
    { suffix: ["--image-observations", " "] },
    { suffix: ["--image-observations", "--worksheet", "Analysis-A"] },
    { suffix: ["--analysis-root"] },
    { suffix: ["--analysis-root", ""] },
    { suffix: ["--analysis-root", " "] },
    { suffix: ["--analysis-root", "--worksheet", "Analysis-A"] },
  ])("rejects missing or empty option values: $suffix", ({ suffix }) => {
    expect(() => parseF5CliArgs(["f1-run", "f3-run", "f4-run", ...suffix])).toThrow(/requires/i);
  });

  it("rejects duplicate worksheet names", () => {
    expect(() => parseF5CliArgs([
      "f1-run", "f3-run", "f4-run",
      "--worksheet", "Analysis-A",
      "--worksheet", " Analysis-A ",
    ])).toThrow(/worksheet.*duplicate|duplicate.*worksheet/i);
  });

  it("rejects a duplicate image observations option", () => {
    expect(() => parseF5CliArgs([
      "f1-run", "f3-run", "f4-run",
      "--image-observations", "first.json",
      "--image-observations", "second.json",
    ])).toThrow(/image-observations.*duplicate|duplicate.*image-observations/i);
  });

  it("rejects a duplicate analysis root option", () => {
    expect(() => parseF5CliArgs([
      "f1-run", "f3-run", "f4-run",
      "--analysis-root", "root-a",
      "--analysis-root", "root-b",
    ])).toThrow(/analysis-root.*duplicate|duplicate.*analysis-root/i);
  });

  it.each(["--unknown", "--Worksheet"])("rejects unknown option %s", (option) => {
    expect(() => parseF5CliArgs([
      "f1-run", "f3-run", "f4-run", option, "value",
    ])).toThrow(/unknown option/i);
  });
});