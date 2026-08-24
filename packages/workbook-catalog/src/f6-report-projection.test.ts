import { describe, expect, it } from "vitest";
import type { CalculationCompletedResult } from "@ai-assist/contracts";
import * as packageRoot from "./index.js";
import { createF6ReportProjection } from "./f6-report-projection.js";
import { worstDisposition } from "./f6-report-policy.js";

function calculation(): CalculationCompletedResult {
  const factor = (sourceRow: number, name: string, mean: number, upperTolerance: number, lowerTolerance: number, sigma: number) => ({
    factorName: name,
    unit: "mm",
    source: { worksheetName: "Analysis-A", tableId: "table-a", sourceRow },
    input: { nominalValue: mean, upperTolerance, lowerTolerance, longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "normal" as const },
    mean,
    halfTolerance: (upperTolerance - lowerTolerance) / 2,
    sigma,
    contribution: 0.5,
    trace: { formulaIds: ["factor-mean-v1", "factor-half-tolerance-v1", "factor-sigma-v1", "contribution-v1"], sourceCells: [`Analysis-A!A${sourceRow}`] },
  });
  const factors = [
    factor(14, "Factor A", -0.57, 0.2, -0.2, 0.025),
    factor(15, "Factor B", 0.52, 0.25, -0.25, 0.0375),
  ];
  const trace = (outputField: string, formulaId: CalculationCompletedResult["traceRecords"][number]["formulaId"], sourceCells: string[]) => ({
    outputField,
    formulaVersion: "excel-ta-v1" as const,
    formulaId,
    sourceCells,
  });
  return {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    calculationVersion: "excel-ta-v1",
    projectReference: "project-a",
    runReference: "run-a",
    workbookContentHash: "a".repeat(64),
    worksheetSelection: { worksheetName: "Analysis-A", tableId: "table-a" },
    factorCount: 2,
    recommendation: { method: "rss_1d", reason: "factor_count_4_to_10", refer3d: false, criticality: "none", criticalityRisk: false },
    factors,
    system: { designNominal: -0.05, mean: -0.05, additionalMeanShift: 0, worstCaseUpper: 0.45, worstCaseLower: -0.45, rssSigma: 0.04506939094329987 },
    capability: {
      lowerSpecLimit: -0.15,
      upperSpecLimit: 0.05,
      targetSigmaLevel: 3,
      targetCpk: 1,
      cp: 0.7396002616336388,
      lowerCpk: 0.7396002616336417,
      upperCpk: 0.7396002616336358,
      cpk: 0.7396002616336358,
      lowerZ: 2.218800784900925,
      upperZ: 2.2188007849009073,
      lowerDpm: 13250.140301245605,
      upperDpm: 13250.14030124627,
      totalDpm: 26500.280602491875,
      outOfSpecRatio: 0.026500280602491877,
      yield: 0.9734997193975081,
      status: "FAIL",
    },
    traceRecords: [
      trace("system.mean", "system-mean-v1", ["factors[0].mean", "factors[1].mean"]),
      trace("system.worstCaseUpper", "worst-case-v1", ["factors[0].upperTolerance", "factors[1].upperTolerance"]),
      trace("system.worstCaseLower", "worst-case-v1", ["factors[0].lowerTolerance", "factors[1].lowerTolerance"]),
      trace("system.rssSigma", "rss-v1", ["factors[0].sigma", "factors[1].sigma"]),
      trace("capability.cp", "cp-v1", ["capability.lowerSpecLimit", "capability.upperSpecLimit", "system.rssSigma"]),
      trace("capability.lowerCpk", "cpk-lower-v1", ["system.mean", "capability.lowerSpecLimit", "system.rssSigma"]),
      trace("capability.upperCpk", "cpk-upper-v1", ["system.mean", "capability.upperSpecLimit", "system.rssSigma"]),
      trace("capability.cpk", "cpk-v1", ["capability.lowerCpk", "capability.upperCpk"]),
    ],
    scenarios: [],
  };
}

describe("createF6ReportProjection", () => {
  it("derives auditable statistical ranges and keeps Worst Case separate from RSS", () => {
    const result = createF6ReportProjection({ calculation: calculation(), inputResolution: 0.01 });
    const threeSigma = result.statisticalRanges.find(({ sigmaLevel }) => sigmaLevel === 3);

    expect(threeSigma?.range.lower).toBeCloseTo(-0.1852081728298996);
    expect(threeSigma?.range.upper).toBeCloseTo(0.08520817282989961);
    expect(result.margins.statistical.minimumMargin).toBeCloseTo(-0.03520817282989961);
    expect(result.margins.worstCase.minimumMargin).toBeCloseTo(-0.35);
    expect(result.margins.worstCase.lowerBound).toBeCloseTo(-0.5);
    expect(result.margins.worstCase.upperBound).toBeCloseTo(0.4);
    expect(result.formulaChecks.map(({ formulaId }) => formulaId)).toContain("rss-v1");
    expect(result.formulaChecks.map(({ formulaId }) => formulaId)).toContain("worst-case-v1");
  });

  it("includes a nonstandard target sigma range required by the final report", () => {
    const input = structuredClone(calculation());
    input.capability.targetSigmaLevel = 4.5;

    const result = createF6ReportProjection({ calculation: input, inputResolution: 0.01 });
    const targetRange = result.statisticalRanges.find(({ sigmaLevel }) => sigmaLevel === 4.5);

    expect(targetRange?.range.lower).toBeCloseTo(-0.2528122592448494);
    expect(targetRange?.range.upper).toBeCloseTo(0.1528122592448494);
    expect(result.margins.statistical.sigmaLevel).toBe(4.5);
  });

  it("fails closed when a required F4 trace is missing", () => {
    const baseline = calculation();
    const input = {
      ...baseline,
      traceRecords: baseline.traceRecords.filter(({ outputField }) => outputField !== "system.rssSigma"),
    };

    expect(() => createF6ReportProjection({ calculation: input, inputResolution: 0.01 }))
      .toThrow("required F4 trace is missing: system.rssSigma");
  });

  it("self-checks baseline outputs, rejects invalid resolution, and deep freezes the projection", () => {
    const result = createF6ReportProjection({ calculation: calculation(), inputResolution: 0.01 });

    expect(result.selfChecks.mean.result).toBe("PASS");
    expect(result.selfChecks.rss.result).toBe("PASS");
    expect(result.selfChecks.worstCase.result).toBe("PASS");
    expect(result.selfChecks.worstCaseUpper).toMatchObject({ checkId: "worst-case-upper", result: "PASS" });
    expect(result.selfChecks.worstCaseLower).toMatchObject({ checkId: "worst-case-lower", result: "PASS" });
    expect(result.selfChecks.worstCaseUpper.calculated.value)
      .toBeCloseTo(result.selfChecks.worstCaseUpper.reported.value);
    expect(result.selfChecks.worstCaseLower.calculated.value)
      .toBeCloseTo(result.selfChecks.worstCaseLower.reported.value);
    expect(result.selfChecks.worstCaseUpper.tolerance.value).toBe(0.01);
    expect(result.selfChecks.worstCaseLower.tolerance.value).toBe(0.01);
    expect(result.selfChecks.worstCaseUpper.toleranceBasis).toBe("input resolution");
    expect(result.selfChecks.worstCaseLower.toleranceBasis).toBe("input resolution");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.formulaChecks)).toBe(true);
    expect(() => createF6ReportProjection({ calculation: calculation(), inputResolution: 0 }))
      .toThrow("inputResolution must be a finite positive number");
  });

  it("exports the projection adapter from the package entrypoint", () => {
    expect(packageRoot.createF6ReportProjection).toBe(createF6ReportProjection);
  });
});

describe("worstDisposition", () => {
  it("returns the worst ranked disposition", () => {
    expect(worstDisposition(["PASS", "INCOMPLETE", "FAIL"])).toBe("FAIL");
  });

  it("treats unknown dispositions as failed", () => {
    expect(worstDisposition(["PASS", "UNEXPECTED"])).toBe("UNEXPECTED");
  });
});
