import { describe, expect, it } from "vitest";
import type { F7FactorState } from "./api/f7-client";
import { measurementWorkspaceWarnings } from "./measurement-workspace-warnings";

function factorWithMeasurements(input: {
  lowerSpecLimit: number;
  upperSpecLimit: number;
  observations: ReadonlyArray<{ value: number; disposition: "included" | "excluded" }>;
}): F7FactorState {
  return {
    evidence: {
      lowerSpecLimit: input.lowerSpecLimit,
      upperSpecLimit: input.upperSpecLimit,
    },
    measurementPasteResult: {
      dataset: {
        observations: input.observations,
      },
    },
  } as F7FactorState;
}

describe("measurementWorkspaceWarnings", () => {
  it("rebuilds committed cross-zero and out-of-spec import warnings", () => {
    const warnings = measurementWorkspaceWarnings(factorWithMeasurements({
      lowerSpecLimit: -0.2,
      upperSpecLimit: 0.8,
      observations: [
        { value: -0.3, disposition: "included" },
        { value: 0.4, disposition: "included" },
        { value: 1.2, disposition: "excluded" },
      ],
    }));

    expect(warnings).toEqual([
      "Factor LSL is below 0. Review Factor Setup.",
      "1 included measurement is outside the Factor specification.",
    ]);
  });

  it("does not warn when the LSL is exactly zero", () => {
    expect(measurementWorkspaceWarnings(factorWithMeasurements({
      lowerSpecLimit: 0,
      upperSpecLimit: 0.8,
      observations: [{ value: 0.4, disposition: "included" }],
    }))).toEqual([]);
  });

  it("returns no warning when all included measurements are within a positive specification", () => {
    expect(measurementWorkspaceWarnings(factorWithMeasurements({
      lowerSpecLimit: 0.1,
      upperSpecLimit: 0.8,
      observations: [
        { value: 0.1, disposition: "included" },
        { value: 0.8, disposition: "included" },
      ],
    }))).toEqual([]);
  });

  it("warns when measurement diagnostics identify a candidate outlier", () => {
    const values = [...Array.from({ length: 30 }, (_, index) => 10 + (index % 5) * 0.1), 100];

    expect(measurementWorkspaceWarnings(factorWithMeasurements({
      lowerSpecLimit: 1,
      upperSpecLimit: 200,
      observations: values.map((value) => ({ value, disposition: "included" })),
    }))).toContain("1 measurement is a candidate outlier. Review the highlighted measurement row in Data Quality.");
  });
});
