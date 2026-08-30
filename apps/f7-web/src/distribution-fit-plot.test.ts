import { describe, expect, it } from "vitest";
import type { F7DistributionFitCandidate } from "./api/f7-client";
import {
  buildFactorSetupAssumption,
  buildDistributionFitPlot,
  buildDistributionFitReferences,
  buildReferenceLabelRows,
  distributionFitObservedDomain,
  probabilityDensity,
} from "./distribution-fit-plot";

function candidate(
  family: F7DistributionFitCandidate["family"],
  parameters: Readonly<Record<string, number>>,
): F7DistributionFitCandidate {
  const modelSpecifications: Record<F7DistributionFitCandidate["family"], F7DistributionFitCandidate["modelSpecification"]> = {
    normal: "normal_location_scale",
    lognormal: "lognormal_location_zero",
    weibull: "weibull_location_zero",
    gamma: "gamma_location_zero",
    uniform: "uniform_boundary_mle",
  };
  return {
    family,
    modelSpecification: modelSpecifications[family],
    parameterCount: 2,
    parameters,
    logLikelihood: -10,
    aic: 24,
    aicc: 24,
    bic: 26,
    deltaAicc: 0,
    deltaBic: 0,
    ks: 0.05,
    ad: 0.2,
    qqPoints: Array.from({ length: 32 }, (_, index) => ({
      observed: 0.494 + index * 0.0018,
      theoretical: 0.495 + index * 0.0017,
    })),
    bootstrap: {
      statisticId: "anderson_darling",
      observedStatistic: 0.2,
      comparisonDirection: "greater_than_or_equal",
      refitEachReplicate: true,
      extremeReplicateCount: 10000,
      confidenceInterval: {
        level: 0.95,
        method: "wilson_score",
        lower: 0.9996159983082414,
        upper: 1,
      },
      pValue: 1,
      replicates: 10000,
      seed: "a".repeat(64),
      methodId: "F7_BOOTSTRAP_V2",
      candidateMethodId: "F7_DISTRIBUTION_FIT_V1",
      streamDigest: "b".repeat(64),
      status: "acceptable",
    },
    warnings: [],
  };
}

describe("distribution fit plot", () => {
  it("assigns nearby reference labels to different rows and reuses rows after sufficient separation", () => {
    const lines = [
      { id: "lower-spec-limit" as const, value: 0 },
      { id: "mean" as const, value: 1 },
      { id: "target" as const, value: 2 },
      { id: "upper-spec-limit" as const, value: 8 },
    ];

    expect(buildReferenceLabelRows(lines, 0, 10, 100, 25)).toEqual({
      "lower-spec-limit": 0,
      mean: 1,
      target: 2,
      "upper-spec-limit": 0,
    });
  });

  it("evaluates each governed family PDF from its fitted parameters", () => {
    expect(probabilityDensity("normal", { mean: 0, standardDeviation: 1 }, 0)).toBeCloseTo(0.39894228, 7);
    expect(probabilityDensity("lognormal", { logMean: 0, logStandardDeviation: 1 }, 1)).toBeCloseTo(0.39894228, 7);
    expect(probabilityDensity("weibull", { shape: 2, scale: 1 }, 1)).toBeCloseTo(2 / Math.E, 7);
    expect(probabilityDensity("gamma", { shape: 2, scale: 1 }, 1)).toBeCloseTo(1 / Math.E, 7);
    expect(probabilityDensity("gamma", { shape: 1, scale: 2 }, 0)).toBeCloseTo(0.5, 7);
    expect(probabilityDensity("uniform", { minimum: 0, maximum: 2 }, 1)).toBeCloseTo(0.5, 7);
  });

  it("builds a finite frequency histogram and count-scaled fitted curve", () => {
    const model = buildDistributionFitPlot(candidate("normal", { mean: 0.5224, standardDeviation: 0.0123 }));

    expect(model.bins).toHaveLength(6);
    expect(model.bins.reduce((sum, bin) => sum + bin.frequency, 0)).toBe(32);
    expect(model.bins.every((bin) => Number.isInteger(bin.frequency))).toBe(true);
    expect(model.curve).toHaveLength(96);
    expect(model.maximumFrequency).toBeGreaterThan(0);
    expect(model.frequencyTicks).toHaveLength(5);
    expect(model.frequencyTicks[0]).toBe(0);
    expect(model.frequencyTicks.at(-1)).toBe(model.maximumFrequency);
    expect(model.frequencyTicks.every(Number.isInteger)).toBe(true);
    expect(model.curve.every((point) => Number.isFinite(point.x) && Number.isFinite(point.expectedFrequency)
      && point.expectedFrequency >= 0)).toBe(true);
  });

  it.each(["Normal", "Uniform", "Triangular", "Trapezoidal", "Elliptical", "Beta"] as const)(
    "builds a finite count-scaled %s Factor Setup assumption curve around the absolute mean",
    (distribution) => {
      const assumption = buildFactorSetupAssumption({
        signedMean: -0.5224,
        oneSigma: 0.0123,
        distribution,
        longTermSafetyFactor: 1.5,
        sigmaLevel: 4,
      });
      const normal = candidate("normal", { mean: 0.5224, standardDeviation: 0.0123 });
      const domain = distributionFitObservedDomain([normal], undefined, assumption);
      const model = buildDistributionFitPlot(normal, domain, assumption);

      expect(assumption.mean).toBe(0.5224);
      expect(assumption.standardDeviation).toBe(0.0123);
      expect(model.assumptionCurve).toHaveLength(96);
      expect(model.assumptionCurve.every((point) => Number.isFinite(point.x)
        && Number.isFinite(point.expectedFrequency) && point.expectedFrequency >= 0)).toBe(true);
      expect(model.maximumFrequency).toBeGreaterThanOrEqual(
        Math.max(...model.assumptionCurve.map((point) => point.expectedFrequency)),
      );
    },
  );

  it("builds shared Target, specification, mean, and sample-sigma reference lines", () => {
    const normal = {
      ...candidate("normal", { mean: 3, standardDeviation: Math.sqrt(2) }),
      qqPoints: [1, 2, 3, 4, 5].map((observed) => ({ observed, theoretical: observed })),
    };

    const references = buildDistributionFitReferences([normal], 0, 10);

    expect(references.target).toBe(5);
    expect(references.mean).toBe(3);
    expect(references.sampleStandardDeviation).toBeCloseTo(Math.sqrt(2.5), 12);
    expect(references.specificationDecimalPlaces).toBe(0);
    expect(references.lines.map((line) => line.id)).toEqual([
      "lower-spec-limit",
      "upper-spec-limit",
      "target",
      "mean",
      "minus-3-sigma",
      "plus-3-sigma",
      "minus-4-sigma",
      "plus-4-sigma",
    ]);
    expect(references.lines.find((line) => line.id === "minus-3-sigma")?.value)
      .toBeCloseTo(3 - 3 * Math.sqrt(2.5), 12);
    expect(references.lines.find((line) => line.id === "plus-4-sigma")?.value)
      .toBeCloseTo(3 + 4 * Math.sqrt(2.5), 12);

    const domain = distributionFitObservedDomain([normal], references);
    expect(domain.minimum).toBeLessThanOrEqual(3 - 4 * Math.sqrt(2.5));
    expect(domain.maximum).toBeGreaterThanOrEqual(10);
  });

  it("uses specification precision and keeps histogram bins on the observed range", () => {
    const normal = candidate("normal", { mean: 0.5224, standardDeviation: 0.0123 });
    const references = buildDistributionFitReferences([normal], 0.5199999999999999, 0.6199999999999999);
    const expandedDomain = distributionFitObservedDomain([normal], references);
    const model = buildDistributionFitPlot(normal, expandedDomain);

    expect(references.specificationDecimalPlaces).toBe(2);
    expect(model.bins).toHaveLength(6);
    expect(model.bins[0]?.minimum).toBe(normal.qqPoints[0]?.observed);
    expect(model.bins.at(-1)?.maximum).toBe(normal.qqPoints.at(-1)?.observed);
  });

  it("uses one observed domain across candidate plots", () => {
    const normal = candidate("normal", { mean: 0.5224, standardDeviation: 0.0123 });
    const shifted: F7DistributionFitCandidate = {
      ...candidate("uniform", { minimum: 0.48, maximum: 0.57 }),
      qqPoints: normal.qqPoints.map((point) => ({ observed: point.observed + 0.01, theoretical: point.theoretical })),
    };
    const domain = distributionFitObservedDomain([normal, shifted]);

    const normalPlot = buildDistributionFitPlot(normal, domain);
    const shiftedPlot = buildDistributionFitPlot(shifted, domain);

    expect(normalPlot.domainMinimum).toBe(shiftedPlot.domainMinimum);
    expect(normalPlot.domainMaximum).toBe(shiftedPlot.domainMaximum);
  });

  it("keeps binning independent of candidate count and bounded for extreme samples", () => {
    const normal = candidate("normal", { mean: 0.5224, standardDeviation: 0.0123 });
    const repeatedDomain = distributionFitObservedDomain([normal, normal, normal, normal, normal]);
    expect(repeatedDomain.binCount).toBe(distributionFitObservedDomain([normal]).binCount);

    const extreme: F7DistributionFitCandidate = {
      ...normal,
      qqPoints: [
        ...Array.from({ length: 499 }, (_, index) => ({ observed: index * Number.EPSILON, theoretical: index })),
        { observed: 1e100, theoretical: 499 },
      ],
    };
    const extremeDomain = distributionFitObservedDomain([extreme]);
    expect(extremeDomain.binCount).toBeGreaterThan(0);
    expect(extremeDomain.binCount).toBeLessThanOrEqual(64);
    expect(() => buildDistributionFitPlot(extreme, extremeDomain)).not.toThrow();
  });

  it("keeps every plot value finite for zero-span and overflow-scale observations", () => {
    const normal = candidate("normal", { mean: 1, standardDeviation: 1 });
    const zeroSpan: F7DistributionFitCandidate = {
      ...normal,
      qqPoints: normal.qqPoints.map(() => ({ observed: 1, theoretical: 1 })),
    };
    const overflowSpan: F7DistributionFitCandidate = {
      ...normal,
      qqPoints: normal.qqPoints.map((_, index) => ({
        observed: index % 2 === 0 ? -Number.MAX_VALUE : Number.MAX_VALUE,
        theoretical: index,
      })).sort((left, right) => left.observed - right.observed),
    };

    for (const model of [buildDistributionFitPlot(zeroSpan), buildDistributionFitPlot(overflowSpan)]) {
      const values = [
        model.domainMinimum,
        model.domainMaximum,
        model.maximumFrequency,
        ...model.ticks,
        ...model.frequencyTicks,
        ...model.bins.flatMap((bin) => [bin.minimum, bin.maximum, bin.frequency]),
        ...model.curve.flatMap((point) => [point.x, point.expectedFrequency]),
      ];
      expect(values.every(Number.isFinite)).toBe(true);
      expect(model.bins.reduce((sum, bin) => sum + bin.frequency, 0)).toBe(32);
    }
  });
});