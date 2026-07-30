import { describe, expect, it } from "vitest";
import * as packageRoot from "./index.js";
import {
  CALCULATION_VERSION,
  CalculationKernelError,
  calculateToleranceAnalysis,
  isCalculationKernelError,
  recommendCalculationMethod,
  type NormalizedCalculationInput,
  type NormalizedFactor,
} from "./calculation-kernel.js";

const EPS = 1e-12;

function expectClose(actual: number, expected: number, epsilon = EPS): void {
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(epsilon * scale);
}

function expectErrorTextNotLeaking(error: CalculationKernelError, forbidden: readonly string[]): void {
  for (const token of forbidden) {
    expect(error.summary).not.toContain(token);
    expect(error.message).not.toContain(token);
  }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested, seen);
    }
    Object.freeze(value);
  }
  return value;
}

function buildFactor(index: number, distribution: NormalizedFactor["input"]["distribution"] = "normal"): NormalizedFactor {
  return {
    name: `F${index + 1}`,
    unit: "mm",
    source: {
      worksheetName: "Sheet1",
      tableId: "table-1",
      sourceRow: index + 2,
    },
    input: {
      nominalValue: 0,
      upperTolerance: 2,
      lowerTolerance: 0,
      longTermSafetyFactor: 1,
      sigmaLevel: 1,
      distribution,
    },
  };
}

function buildInput(factors: readonly NormalizedFactor[]): NormalizedCalculationInput {
  return {
    factors,
    system: {
      designNominal: 0,
      lowerSpecLimit: -3,
      upperSpecLimit: 3,
      targetSigmaLevel: 3,
      targetCpk: 1,
      shift: -1,
    },
  };
}

describe("calculation kernel", () => {
  it("is internal-only and not exported from package root", () => {
    expect(packageRoot).not.toHaveProperty("CALCULATION_VERSION");
    expect(packageRoot).not.toHaveProperty("calculateToleranceAnalysis");
    expect(packageRoot).not.toHaveProperty("recommendCalculationMethod");
  });

  it("exports version constant", () => {
    expect(CALCULATION_VERSION).toBe("excel-ta-v1");
  });

  it("recommends method by factor-count boundaries", () => {
    expect(recommendCalculationMethod(1)).toBe("worst_case");
    expect(recommendCalculationMethod(3)).toBe("worst_case");
    expect(recommendCalculationMethod(4)).toBe("rss_1d");
    expect(recommendCalculationMethod(10)).toBe("rss_1d");
    expect(recommendCalculationMethod(11)).toBe("refer_3d_variation_analysis");
  });

  it("throws deterministic kernel error object for invalid factor count", () => {
    let first: unknown;
    let second: unknown;

    try {
      recommendCalculationMethod(0);
    } catch (error) {
      first = error;
    }

    try {
      recommendCalculationMethod(0);
    } catch (error) {
      second = error;
    }

    expect(first).toBeInstanceOf(CalculationKernelError);
    expect(second).toBeInstanceOf(CalculationKernelError);
    expect(isCalculationKernelError(first)).toBe(true);
    expect(isCalculationKernelError(second)).toBe(true);
    expect(first).toMatchObject({
      code: "calculation_not_possible",
      summary: "factorCount must be a positive integer",
    });
    expect(second).toMatchObject({
      code: "calculation_not_possible",
      summary: "factorCount must be a positive integer",
    });
    expect((first as CalculationKernelError).summary).toBe((second as CalculationKernelError).summary);
  });

  it("matches approved Example_TA seven-factor reference values", () => {
    const nominals = [-0.57, -1.94, 0.22, 0.75, 0.44, 0.05, 1];
    const uppers = [0.05, 0.1, 0.05, 0.1, 0.05, 0.05, 0.05];
    const lowers = [-0.05, -0.1, -0.05, -0.1, -0.05, -0.05, -0.05];

    const factors: NormalizedFactor[] = nominals.map((nominalValue, index) => ({
      name: `factor-${index + 1}`,
      unit: "mm",
      source: {
        worksheetName: "Example_TA",
        tableId: "dm-table",
        sourceRow: index + 1,
      },
      input: {
        nominalValue,
        upperTolerance: uppers[index],
        lowerTolerance: lowers[index],
        longTermSafetyFactor: 1,
        sigmaLevel: 4,
        distribution: "normal",
      },
    }));

    const result = calculateToleranceAnalysis({
      factors,
      system: {
        designNominal: -0.05,
        lowerSpecLimit: -0.15,
        upperSpecLimit: 0.05,
        targetSigmaLevel: 3,
        targetCpk: 1,
        shift: 0,
      },
    });

    expect(result.recommendation.method).toBe("rss_1d");
    expectClose(result.system.mean, -0.05);
    expectClose(result.system.worstCaseUpper, 0.45);
    expectClose(result.system.worstCaseLower, -0.45);
    expectClose(result.system.rssSigma, 0.0450693909432999);
    expectClose(result.capability.cp, 0.739600261633636);
    expectClose(result.capability.cpk, 0.739600261633636);
    expectClose(result.capability.z, 2.2188007849009);

    expectClose(result.capability.lowerDpm, 13250.1403012456);
    expectClose(result.capability.upperDpm, 13250.1403012463);
    expectClose(result.capability.totalDpm, 26500.2806024919);
    expectClose(result.capability.yield, 0.973499719397508);
    expect(result.capability.status).toBe("FAIL");
  });

  it("matches Excel cached one-sided DPM constant at Z=1", () => {
    const result = calculateToleranceAnalysis({
      factors: [
        {
          name: "z-one",
          unit: "mm",
          source: {
            worksheetName: "Example_TA",
            tableId: "dm-table",
            sourceRow: 1,
          },
          input: {
            nominalValue: 0,
            upperTolerance: 1,
            lowerTolerance: -1,
            longTermSafetyFactor: 1,
            sigmaLevel: 1,
            distribution: "normal",
          },
        },
      ],
      system: {
        designNominal: 0,
        lowerSpecLimit: -1,
        upperSpecLimit: 1,
        targetSigmaLevel: 3,
        targetCpk: 1,
        shift: 0,
      },
    });

    expectClose(result.capability.z, 1);
    expectClose(result.capability.lowerDpm, 158655.253931457);
    expectClose(result.capability.upperDpm, 158655.253931457);
  });

  it("computes sigma by all six distributions", () => {
    const distributions: NormalizedFactor["input"]["distribution"][] = [
      "normal",
      "uniform",
      "triangular",
      "trapezoidal",
      "elliptical",
      "beta",
    ];
    const expected = [1, 1.732, 1.225, 1.369, 1.5, 2.023];

    const result = calculateToleranceAnalysis(
      buildInput(distributions.map((distribution, index) => buildFactor(index, distribution))),
    );

    for (const [index, factor] of result.factors.entries()) {
      expectClose(factor.sigma, expected[index]);
    }
  });

  it("handles negative nominal with asymmetric tolerance using Excel sign rule", () => {
    const result = calculateToleranceAnalysis({
      factors: [
        {
          name: "neg-asym",
          unit: "mm",
          source: {
            worksheetName: "Sheet1",
            tableId: "table-1",
            sourceRow: 2,
          },
          input: {
            nominalValue: -10,
            upperTolerance: 0.4,
            lowerTolerance: -0.2,
            longTermSafetyFactor: 1,
            sigmaLevel: 2,
            distribution: "normal",
          },
        },
      ],
      system: {
        designNominal: -10.1,
        lowerSpecLimit: -11,
        upperSpecLimit: -9,
        targetSigmaLevel: 3,
        targetCpk: 1,
        shift: 0,
      },
    });

    expectClose(result.factors[0].mean, -10.1);
    expectClose(result.factors[0].halfTolerance, 0.30000000000000004);
    expectClose(result.factors[0].sigma, 0.15000000000000002);
  });

  it("applies positive nominal asymmetric formula for single-sided tolerance with explicit 3-sigma factor", () => {
    const result = calculateToleranceAnalysis({
      factors: [
        {
          name: "pos-one-sided",
          unit: "mm",
          source: {
            worksheetName: "Sheet1",
            tableId: "table-1",
            sourceRow: 2,
          },
          input: {
            nominalValue: 10,
            upperTolerance: 0.1,
            lowerTolerance: 0,
            longTermSafetyFactor: 1,
            sigmaLevel: 3,
            distribution: "normal",
          },
        },
      ],
      system: {
        designNominal: 10,
        lowerSpecLimit: 9,
        upperSpecLimit: 11,
        targetSigmaLevel: 3,
        targetCpk: 1,
        shift: 0,
      },
    });

    expectClose(result.factors[0].halfTolerance, 0.05);
    expectClose(result.factors[0].mean, 10.05);
    expectClose(result.factors[0].sigma, 0.05 / 3);
    expect(result.factors[0].contribution).toBe(1);
  });

  it("supports twenty factors with mixed normal/uniform and keeps contribution sum near one", () => {
    const factors = Array.from({ length: 20 }, (_, index) => ({
      ...buildFactor(index, index % 2 === 0 ? "normal" : "uniform"),
      input: {
        ...buildFactor(index, index % 2 === 0 ? "normal" : "uniform").input,
        sigmaLevel: 4,
        upperTolerance: 0.12,
        lowerTolerance: -0.08,
      },
    }));

    const result = calculateToleranceAnalysis({
      factors,
      system: {
        designNominal: 0,
        lowerSpecLimit: -5,
        upperSpecLimit: 5,
        targetSigmaLevel: 3,
        targetCpk: 1,
        shift: 0,
      },
    });

    expect(result.recommendation.method).toBe("refer_3d_variation_analysis");
    const contributionSum = result.factors.reduce((sum, factor) => sum + factor.contribution, 0);
    expectClose(contributionSum, 1);
  });

  it("keeps RSS and capability finite for large-scale sigma around 1e200", () => {
    const result = calculateToleranceAnalysis({
      factors: [
        {
          name: "large-scale",
          unit: "mm",
          source: {
            worksheetName: "Sheet1",
            tableId: "table-1",
            sourceRow: 2,
          },
          input: {
            nominalValue: 1e200,
            upperTolerance: 1e200,
            lowerTolerance: -1e200,
            longTermSafetyFactor: 1,
            sigmaLevel: 1,
            distribution: "normal",
          },
        },
      ],
      system: {
        designNominal: 1e200,
        lowerSpecLimit: -2e200,
        upperSpecLimit: 4e200,
        targetSigmaLevel: 3,
        targetCpk: 1,
        shift: 0,
      },
    });

    expect(Number.isFinite(result.system.rssSigma)).toBe(true);
    expectClose(result.system.rssSigma, 1e200);
    expect(Number.isFinite(result.capability.cp)).toBe(true);
    expectClose(result.capability.cp, 1);
    expectClose(result.capability.lowerCpk, 1);
    expectClose(result.capability.upperCpk, 1);
  });

  it("keeps RSS and capability finite for small-scale sigma around 1e-200", () => {
    const result = calculateToleranceAnalysis({
      factors: [
        {
          name: "small-scale",
          unit: "mm",
          source: {
            worksheetName: "Sheet1",
            tableId: "table-1",
            sourceRow: 2,
          },
          input: {
            nominalValue: 0,
            upperTolerance: 1e-200,
            lowerTolerance: -1e-200,
            longTermSafetyFactor: 1,
            sigmaLevel: 1,
            distribution: "normal",
          },
        },
      ],
      system: {
        designNominal: 0,
        lowerSpecLimit: -3e-200,
        upperSpecLimit: 3e-200,
        targetSigmaLevel: 3,
        targetCpk: 1,
        shift: 0,
      },
    });

    expect(Number.isFinite(result.system.rssSigma)).toBe(true);
    expectClose(result.system.rssSigma, 1e-200);
    expect(Number.isFinite(result.capability.cp)).toBe(true);
    expectClose(result.capability.cp, 1);
    expectClose(result.capability.lowerCpk, 1);
    expectClose(result.capability.upperCpk, 1);
  });

  it("can produce negative Cpk when mean is outside specification", () => {
    const result = calculateToleranceAnalysis({
      factors: [
        {
          ...buildFactor(0),
          input: {
            ...buildFactor(0).input,
            upperTolerance: 1,
            lowerTolerance: -1,
            sigmaLevel: 2,
          },
        },
      ],
      system: {
        designNominal: 0,
        lowerSpecLimit: -0.5,
        upperSpecLimit: 0.5,
        targetSigmaLevel: 3,
        targetCpk: 1,
        shift: 2,
      },
    });

    expect(result.capability.cpk).toBeLessThan(0);
    expect(result.capability.status).toBe("FAIL");
  });

  it("does not mutate input object graph", () => {
    const frozenInput = deepFreeze(buildInput([buildFactor(0), buildFactor(1, "uniform")]));
    const before = structuredClone(frozenInput);

    const result = calculateToleranceAnalysis(frozenInput);

    expect(frozenInput).toEqual(before);
    expect(result).not.toBe(frozenInput);
    expect(result.factors[0]).not.toBe(frozenInput.factors[0]);
  });

  it("rejects zero RSS, invalid specs, unknown distribution, and non-finite values", () => {
    expect(() => calculateToleranceAnalysis({
      factors: [
        {
          name: "tiny",
          unit: "mm",
          source: {
            worksheetName: "Sheet1",
            tableId: "table-1",
            sourceRow: 2,
          },
          input: {
            nominalValue: 0,
            upperTolerance: Number.MIN_VALUE,
            lowerTolerance: 0,
            longTermSafetyFactor: 1,
            sigmaLevel: 1,
            distribution: "normal",
          },
        },
      ],
      system: {
        designNominal: 0,
        lowerSpecLimit: -1,
        upperSpecLimit: 1,
        targetSigmaLevel: 3,
        targetCpk: 1,
        shift: 0,
      },
    })).toThrowError(/rss|calculation_not_possible/i);

    expect(() => calculateToleranceAnalysis({
      factors: [buildFactor(0)],
      system: {
        designNominal: 0,
        lowerSpecLimit: 1,
        upperSpecLimit: 1,
        targetSigmaLevel: 3,
        targetCpk: 1,
        shift: 0,
      },
    })).toThrowError(/spec|calculation_not_possible/i);

    expect(() => calculateToleranceAnalysis({
      factors: [
        {
          ...buildFactor(0),
          input: {
            ...buildFactor(0).input,
            distribution: "gaussian" as unknown as NormalizedFactor["input"]["distribution"],
          },
        },
      ],
      system: {
        designNominal: 0,
        lowerSpecLimit: -1,
        upperSpecLimit: 1,
        targetSigmaLevel: 3,
        targetCpk: 1,
        shift: 0,
      },
    })).toThrowError(/distribution|calculation_not_possible/i);

    expect(() => calculateToleranceAnalysis({
      factors: [
        {
          ...buildFactor(0),
          input: {
            ...buildFactor(0).input,
            nominalValue: Number.POSITIVE_INFINITY,
          },
        },
      ],
      system: {
        designNominal: 0,
        lowerSpecLimit: -1,
        upperSpecLimit: 1,
        targetSigmaLevel: 3,
        targetCpk: 1,
        shift: 0,
      },
    })).toThrowError(/finite|calculation_not_possible/i);
  });

  it("uses index-based finite error labels and never leaks sensitive factor names", () => {
    const sensitiveName = "TOPSECRET worksheet table source 123456";

    let captured: unknown;
    try {
      calculateToleranceAnalysis({
        factors: [
          {
            name: sensitiveName,
            unit: "mm",
            source: {
              worksheetName: "SensitiveWorksheet",
              tableId: "sensitive-table",
              sourceRow: 2,
            },
            input: {
              nominalValue: Number.POSITIVE_INFINITY,
              upperTolerance: 1,
              lowerTolerance: -1,
              longTermSafetyFactor: 1,
              sigmaLevel: 1,
              distribution: "normal",
            },
          },
        ],
        system: {
          designNominal: 0,
          lowerSpecLimit: -3,
          upperSpecLimit: 3,
          targetSigmaLevel: 3,
          targetCpk: 1,
          shift: 0,
        },
      });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(CalculationKernelError);
    const kernelError = captured as CalculationKernelError;
    expect(kernelError.summary).toBe("factor[0].nominalValue must be finite");
    expectErrorTextNotLeaking(kernelError, [
      sensitiveName,
      "SensitiveWorksheet",
      "sensitive-table",
      "worksheet",
      "table",
      "source",
      "123456",
    ]);
  });

  it("marks cp as FAIL when cp equals target", () => {
    const result = calculateToleranceAnalysis({
      factors: [buildFactor(0)],
      system: {
        designNominal: 0,
        lowerSpecLimit: -3,
        upperSpecLimit: 3,
        targetSigmaLevel: 3,
        targetCpk: 1,
        shift: 0,
      },
    });

    expectClose(result.capability.cp, 1);
    expect(result.capability.cpStatus).toBe("FAIL");
  });

  it("marks lowerCpk as FAIL when lowerCpk equals target", () => {
    const result = calculateToleranceAnalysis({
      factors: [buildFactor(0)],
      system: {
        designNominal: 0,
        lowerSpecLimit: -2,
        upperSpecLimit: 8,
        targetSigmaLevel: 3,
        targetCpk: 1,
        shift: 0,
      },
    });

    expectClose(result.capability.lowerCpk, 1);
    expect(result.capability.lowerCpkStatus).toBe("FAIL");
  });

  it("keeps upperCpk equals target as PASS and final cpk equals target as FAIL", () => {
    const result = calculateToleranceAnalysis({
      factors: [buildFactor(0)],
      system: {
        designNominal: 0,
        lowerSpecLimit: -2,
        upperSpecLimit: 4,
        targetSigmaLevel: 3,
        targetCpk: 1,
        shift: 0,
      },
    });

    expectClose(result.capability.lowerCpk, 1);
    expectClose(result.capability.upperCpk, 1);
    expect(result.capability.upperCpkStatus).toBe("PASS");
    expect(result.capability.status).toBe("FAIL");
  });
});
