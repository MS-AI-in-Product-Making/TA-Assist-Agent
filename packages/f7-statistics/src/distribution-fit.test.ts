import { describe, expect, it } from "vitest";
import { F7_SELECTION_NORMAL_QQ_CURVATURE_MAX } from "@ai-assist/contracts";
import {
  bootstrapStatus,
  collectCandidateFitResults,
  computeSampleDiagnostics,
  DISTRIBUTION_FIT_METHOD_ID,
  deriveBootstrapStream,
  F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS,
  fitDistribution,
  generatePcg32Sequence,
  parameterCountForModelSpecification,
  runAndersonDarlingParametricBootstrap,
  selectDistributionModels,
} from "./distribution-fit.js";

const FACTOR_ID = "a".repeat(64);
const BOOTSTRAP_SEED = "b".repeat(64);
const ALT_BOOTSTRAP_SEED = "c".repeat(64);
const VECTOR_SEED = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const BOOTSTRAP_REPLICATES = 10_000;
const BOOTSTRAP_Z_95 = 1.959963984540054;

function deterministicStandardNormalSample(size: number): number[] {
  const uint32 = generatePcg32Sequence(0x1234_5678n, 0x9abc_def0n, size * 2);
  return Array.from({ length: size }, (_, index) => {
    const first = (uint32[index * 2]! + 0.5) / 0x1_0000_0000;
    const second = (uint32[index * 2 + 1]! + 0.5) / 0x1_0000_0000;
    return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
  });
}

const ALL_ELIGIBLE = {
  normal: "eligible",
  lognormal: "eligible",
  weibull: "eligible",
  gamma: "eligible",
  uniform: "eligible_with_boundary_warning",
} as const;

const POSITIVE_FIXTURE = [
  0.78, 0.83, 0.86, 0.89, 0.91, 0.94, 0.96, 0.98,
  1.01, 1.03, 1.05, 1.07, 1.09, 1.12, 1.14, 1.16,
  1.19, 1.21, 1.24, 1.27, 1.3, 1.33, 1.37, 1.41,
  1.45, 1.5, 1.55, 1.61, 1.68, 1.76, 1.87, 2.02,
] as const;

function makeBootstrap(status: "acceptable" | "weak" | "rejected") {
  const extremeReplicateCount = status === "acceptable"
    ? 4200
    : status === "weak"
      ? 800
      : 300;
  return {
    statisticId: "anderson_darling" as const,
    observedStatistic: 0.2,
    comparisonDirection: "greater_than_or_equal" as const,
    refitEachReplicate: true as const,
    extremeReplicateCount,
    confidenceInterval: {
      level: 0.95 as const,
      method: "wilson_score" as const,
      ...wilsonScoreInterval(extremeReplicateCount, BOOTSTRAP_REPLICATES),
    },
    pValue: (extremeReplicateCount + 1) / (BOOTSTRAP_REPLICATES + 1),
    replicates: 10000 as const,
    seed: BOOTSTRAP_SEED,
    methodId: "F7_BOOTSTRAP_V2" as const,
    candidateMethodId: "F7_DISTRIBUTION_FIT_V1" as const,
    streamDigest: FACTOR_ID,
    status,
  };
}

function makeCandidate(
  family: "normal" | "lognormal" | "weibull" | "gamma" | "uniform",
  aicc: number,
  status: "acceptable" | "weak" | "rejected" = "acceptable",
) {
  const modelSpecification = family === "normal"
    ? "normal_location_scale"
    : family === "lognormal"
      ? "lognormal_location_zero"
      : family === "weibull"
        ? "weibull_location_zero"
        : family === "gamma"
          ? "gamma_location_zero"
          : "uniform_boundary_mle";
  const parameters = family === "normal"
    ? { mean: 0, standardDeviation: 1 }
    : family === "lognormal"
      ? { logMean: 0, logStandardDeviation: 1 }
      : family === "weibull"
        ? { shape: 2, scale: 1 }
        : family === "gamma"
          ? { shape: 2, scale: 1 }
          : { minimum: -1, maximum: 1 };
  return {
    family,
    modelSpecification,
    parameterCount: 2,
    parameters,
    logLikelihood: -10 - aicc,
    aic: aicc,
    aicc,
    bic: aicc + 0.5,
    deltaAicc: 0,
    deltaBic: 0,
    ks: 0.1,
    ad: 0.2,
    qqPoints: [
      { observed: -1, theoretical: -1 },
      { observed: 1, theoretical: 1 },
    ],
    bootstrap: makeBootstrap(status),
    warnings: family === "uniform"
      ? ["Uniform MLE bounds equal the sample minimum and maximum; boundary estimates are sensitive to additional observations."]
      : [],
  };
}

function wilsonScoreInterval(successes: number, trials: number): { lower: number; upper: number } {
  const zSquared = BOOTSTRAP_Z_95 * BOOTSTRAP_Z_95;
  const proportion = successes / trials;
  const denominator = 1 + zSquared / trials;
  const center = (proportion + zSquared / (2 * trials)) / denominator;
  const margin = (BOOTSTRAP_Z_95 / denominator)
    * Math.sqrt((proportion * (1 - proportion) + zSquared / (4 * trials)) / trials);
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

describe("deriveBootstrapStream", () => {
  it("matches the standard pcg32_srandom_r reference vector", () => {
    expect(generatePcg32Sequence(42n, 54n, 5).map((value) => value.toString(16).padStart(8, "0"))).toEqual([
      "a15c02b7",
      "7b47f409",
      "ba1d3330",
      "83d2f293",
      "bfa4784b",
    ]);
  });

  it("requires exactly 64 lowercase hexadecimal seed characters", () => {
    const request = {
      seed: VECTOR_SEED,
      factorIdentity: "factor",
      methodId: DISTRIBUTION_FIT_METHOD_ID,
      replicateIndex: 0n,
    } as const;
    expect(() => deriveBootstrapStream({ ...request, seed: VECTOR_SEED.toUpperCase() })).toThrow();
    expect(() => deriveBootstrapStream({ ...request, seed: VECTOR_SEED.slice(2) })).toThrow();
  });

  it("matches the absent-candidate golden vector and normalizes text to NFC", () => {
    const precomposed = deriveBootstrapStream({
      seed: VECTOR_SEED,
      factorIdentity: "factor-é",
      methodId: DISTRIBUTION_FIT_METHOD_ID,
      replicateIndex: 0n,
    });
    const decomposed = deriveBootstrapStream({
      seed: VECTOR_SEED,
      factorIdentity: "factor-e\u0301",
      methodId: DISTRIBUTION_FIT_METHOD_ID,
      replicateIndex: 0n,
    });

    expect(precomposed).toEqual({
      streamDigest: "c4dd4b2d7b19f4c614e561f699f9ba1c11026fbdeba6c71c46166b732e359830",
      initialState: 0xc6f4197b2d4bddc4n,
      initialSequence: 0x1cbaf999f661e514n,
    });
    expect(decomposed).toEqual(precomposed);
    expect(deriveBootstrapStream({
      seed: VECTOR_SEED,
      factorIdentity: "factor-é",
      methodId: DISTRIBUTION_FIT_METHOD_ID,
      replicateIndex: 0n,
    })).toEqual(precomposed);
  });

  it("distinguishes an empty candidate from an absent candidate", () => {
    expect(deriveBootstrapStream({
      seed: VECTOR_SEED,
      factorIdentity: "factor-e\u0301",
      methodId: DISTRIBUTION_FIT_METHOD_ID,
      candidateId: "",
      replicateIndex: 0n,
    })).toEqual({
      streamDigest: "fe59fd3d472fadf77abad5d0e1268138515962127f526085a81cbfcab42cbea7",
      initialState: 0xf7ad2f473dfd59fen,
      initialSequence: 0x388126e1d0d5ba7an,
    });
  });

  it("encodes the replicate as uint64 BE and reads PCG inputs as uint64 LE", () => {
    expect(deriveBootstrapStream({
      seed: VECTOR_SEED,
      factorIdentity: "factor-é",
      methodId: DISTRIBUTION_FIT_METHOD_ID,
      candidateId: "gamma",
      replicateIndex: 0x0102030405060708n,
    })).toEqual({
      streamDigest: "284ff7ffe911ae3521e340d7cab6c749c995c02751dff029f55aa1d44c7affff",
      initialState: 0x35ae11e9fff74f28n,
      initialSequence: 0x49c7b6cad740e321n,
    });
  });
});

describe("fitDistribution", () => {
  it("exposes governed model specifications and can express future free-location parameter counts", () => {
    expect(parameterCountForModelSpecification("normal_location_scale")).toBe(2);
    expect(parameterCountForModelSpecification("lognormal_location_zero")).toBe(2);
    expect(parameterCountForModelSpecification("weibull_location_free")).toBe(3);
    expect(parameterCountForModelSpecification("gamma_location_free")).toBe(3);
    expect(parameterCountForModelSpecification("uniform_boundary_mle")).toBe(2);
  });

  it("applies the governed bootstrap status thresholds at exact boundaries", () => {
    expect(bootstrapStatus(0.049999)).toBe("rejected");
    expect(bootstrapStatus(0.05)).toBe("weak");
    expect(bootstrapStatus(0.099999)).toBe("weak");
    expect(bootstrapStatus(0.1)).toBe("acceptable");
  });

  it("fits all five eligible two-parameter families with finite diagnostics", () => {
    const result = fitDistribution({
      factorId: FACTOR_ID,
      observations: POSITIVE_FIXTURE,
      candidateEligibility: ALL_ELIGIBLE,
      bootstrapSeed: BOOTSTRAP_SEED,
    });

    expect(result.factorId).toBe(FACTOR_ID);
    expect(result.sampleSize).toBe(POSITIVE_FIXTURE.length);
    expect(result.candidates.map((candidate) => candidate.family)).toEqual([
      "normal",
      "lognormal",
      "weibull",
      "gamma",
      "uniform",
    ]);

    expect(result.candidates.map((candidate) => candidate.modelSpecification)).toEqual([
      "normal_location_scale",
      "lognormal_location_zero",
      "weibull_location_zero",
      "gamma_location_zero",
      "uniform_boundary_mle",
    ]);

    const minimumAicc = Math.min(...result.candidates.map((candidate) => candidate.aicc));
    const minimumBic = Math.min(...result.candidates.map((candidate) => candidate.bic));

    for (const candidate of result.candidates) {
      expect(candidate.parameterCount).toBe(2);
      expect(Object.keys(candidate.parameters).length).toBe(2);
      expect(Object.values(candidate.parameters).every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(candidate.logLikelihood)).toBe(true);
      expect(Number.isFinite(candidate.aic)).toBe(true);
      expect(Number.isFinite(candidate.aicc)).toBe(true);
      expect(Number.isFinite(candidate.bic)).toBe(true);
      expect(Number.isFinite(candidate.deltaAicc)).toBe(true);
      expect(Number.isFinite(candidate.deltaBic)).toBe(true);
      expect(candidate.aic).toBeCloseTo(2 * candidate.parameterCount - 2 * candidate.logLikelihood, 12);
      expect(candidate.aicc).toBeCloseTo(
        candidate.aic + (2 * candidate.parameterCount * (candidate.parameterCount + 1))
          / (POSITIVE_FIXTURE.length - candidate.parameterCount - 1),
        12,
      );
      expect(candidate.bic).toBeCloseTo(
        candidate.parameterCount * Math.log(POSITIVE_FIXTURE.length) - 2 * candidate.logLikelihood,
        12,
      );
      expect(candidate.deltaAicc).toBeCloseTo(candidate.aicc - minimumAicc, 12);
      expect(candidate.deltaBic).toBeCloseTo(candidate.bic - minimumBic, 12);
      expect(candidate.ks).toBeGreaterThanOrEqual(0);
      expect(candidate.ks).toBeLessThanOrEqual(1);
      expect(candidate.ad).toBeGreaterThanOrEqual(0);
      expect(candidate.qqPoints).toHaveLength(POSITIVE_FIXTURE.length);
      expect(candidate.qqPoints.every((point) => Number.isFinite(point.observed)
        && Number.isFinite(point.theoretical))).toBe(true);
      for (let index = 1; index < candidate.qqPoints.length; index += 1) {
        expect(candidate.qqPoints[index]!.observed).toBeGreaterThanOrEqual(candidate.qqPoints[index - 1]!.observed);
        expect(candidate.qqPoints[index]!.theoretical).toBeGreaterThanOrEqual(candidate.qqPoints[index - 1]!.theoretical);
      }
      expect(candidate.bootstrap.statisticId).toBe("anderson_darling");
      expect(candidate.bootstrap.observedStatistic).toBe(candidate.ad);
      expect(candidate.bootstrap.comparisonDirection).toBe("greater_than_or_equal");
      expect(candidate.bootstrap.refitEachReplicate).toBe(true);
      expect(candidate.bootstrap.replicates).toBe(10000);
      expect(candidate.bootstrap.seed).toBe(BOOTSTRAP_SEED);
      expect(candidate.bootstrap.methodId).toBe("F7_BOOTSTRAP_V2");
      expect(candidate.bootstrap.candidateMethodId).toBe("F7_DISTRIBUTION_FIT_V1");
      expect(candidate.bootstrap.streamDigest).toBe(deriveBootstrapStream({
        seed: BOOTSTRAP_SEED,
        factorIdentity: FACTOR_ID,
        methodId: DISTRIBUTION_FIT_METHOD_ID,
        candidateId: candidate.family,
        replicateIndex: 0n,
      }).streamDigest);
      expect(candidate.bootstrap.extremeReplicateCount).toBeGreaterThanOrEqual(0);
      expect(candidate.bootstrap.extremeReplicateCount).toBeLessThanOrEqual(BOOTSTRAP_REPLICATES);
      expect(candidate.bootstrap.pValue).toBeGreaterThan(0);
      expect(candidate.bootstrap.pValue).toBeLessThanOrEqual(1);
      expect(candidate.bootstrap.pValue * (BOOTSTRAP_REPLICATES + 1)).toBeCloseTo(
        candidate.bootstrap.extremeReplicateCount + 1,
        11,
      );
      expect(candidate.bootstrap.pValue * (BOOTSTRAP_REPLICATES + 1)).toBeCloseTo(
        Math.round(candidate.bootstrap.pValue * (BOOTSTRAP_REPLICATES + 1)),
        11,
      );
      expect(candidate.bootstrap.confidenceInterval.level).toBe(0.95);
      expect(candidate.bootstrap.confidenceInterval.method).toBe("wilson_score");
      const expectedInterval = wilsonScoreInterval(candidate.bootstrap.extremeReplicateCount, BOOTSTRAP_REPLICATES);
      expect(candidate.bootstrap.confidenceInterval.lower).toBeCloseTo(expectedInterval.lower, 12);
      expect(candidate.bootstrap.confidenceInterval.upper).toBeCloseTo(expectedInterval.upper, 12);
      expect(["acceptable", "weak", "rejected"]).toContain(candidate.bootstrap.status);
    }

    expect(result.candidates.some((candidate) => candidate.deltaAicc === 0)).toBe(true);
    expect(result.candidates.some((candidate) => candidate.deltaBic === 0)).toBe(true);

    const mean = POSITIVE_FIXTURE.reduce((sum, value) => sum + value, 0) / POSITIVE_FIXTURE.length;
    const mleVariance = POSITIVE_FIXTURE.reduce((sum, value) => sum + (value - mean) ** 2, 0)
      / POSITIVE_FIXTURE.length;
    const normal = result.candidates.find((candidate) => candidate.family === "normal")!;
    expect(normal.parameters.mean).toBeCloseTo(mean, 12);
    expect(normal.parameters.standardDeviation).toBeCloseTo(Math.sqrt(mleVariance), 12);

    const lognormal = result.candidates.find((candidate) => candidate.family === "lognormal")!;
    expect(lognormal.parameters.logMean).toBeCloseTo(0.182652, 6);
    expect(lognormal.parameters.logStandardDeviation).toBeCloseTo(0.242443, 6);
    expect(lognormal.ks).toBeCloseTo(0.060907, 6);
    expect(lognormal.ad).toBeCloseTo(0.169288, 6);

    const weibull = result.candidates.find((candidate) => candidate.family === "weibull")!;
    expect(weibull.parameters.shape).toBeCloseTo(4.13952, 5);
    expect(weibull.parameters.scale).toBeCloseTo(1.35898, 5);
    expect(weibull.ks).toBeCloseTo(0.101318, 6);
    expect(weibull.ad).toBeCloseTo(0.606272, 6);

    const gamma = result.candidates.find((candidate) => candidate.family === "gamma")!;
    expect(gamma.parameters.shape).toBeCloseTo(16.867205, 5);
    expect(gamma.parameters.scale).toBeCloseTo(0.07333, 5);
    expect(gamma.ks).toBeCloseTo(0.071323, 6);
    expect(gamma.ad).toBeCloseTo(0.248919, 6);

    const uniform = result.candidates.find((candidate) => candidate.family === "uniform")!;
    expect(uniform.parameters.minimum).toBe(Math.min(...POSITIVE_FIXTURE));
    expect(uniform.parameters.maximum).toBe(Math.max(...POSITIVE_FIXTURE));
    expect(uniform.warnings).toContain("Uniform MLE bounds equal the sample minimum and maximum; boundary estimates are sensitive to additional observations.");
  });

  it("is deterministic and records the acceptable numeric best plus competitive set", () => {
    const request = {
      factorId: FACTOR_ID,
      observations: POSITIVE_FIXTURE,
      candidateEligibility: ALL_ELIGIBLE,
      bootstrapSeed: BOOTSTRAP_SEED,
    } as const;
    const first = fitDistribution(request);
    const second = fitDistribution(request);
    expect(second).toEqual(first);

    const third = fitDistribution({
      ...request,
      bootstrapSeed: ALT_BOOTSTRAP_SEED,
    });
    expect(third.candidates.map((candidate) => candidate.bootstrap.streamDigest)).not.toEqual(
      first.candidates.map((candidate) => candidate.bootstrap.streamDigest),
    );
    expect(third.candidates.map((candidate) => candidate.bootstrap.extremeReplicateCount)).not.toEqual(
      first.candidates.map((candidate) => candidate.bootstrap.extremeReplicateCount),
    );

    const acceptable = first.candidates
      .filter((candidate) => candidate.bootstrap.status === "acceptable")
      .sort((left, right) => left.aicc - right.aicc);
    const minimumAcceptableAicc = Math.min(...acceptable.map((candidate) => candidate.aicc));
    expect(first.selectionDecision.numericBestFamily).toBe(acceptable[0]?.family);
    expect(first.selectionDecision.competitiveFamilies).toEqual(
      acceptable
        .filter((candidate) => candidate.aicc - minimumAcceptableAicc <= 2)
        .map((candidate) => candidate.family),
    );
  });

  it("defaults fitDistribution characteristicKind to other and applies the strict AICc competitive boundary", async () => {
    const result = fitDistribution({
      factorId: FACTOR_ID,
      observations: POSITIVE_FIXTURE,
      candidateEligibility: ALL_ELIGIBLE,
      bootstrapSeed: BOOTSTRAP_SEED,
    });

    expect(result.characteristicKind).toBe("other");

    const boundaryCandidates = [
      makeCandidate("normal", 10),
      makeCandidate("gamma", 12),
      makeCandidate("lognormal", 12.0000000005),
    ];

    const decision = (await import("./distribution-fit.js")).selectDistributionModels(
      boundaryCandidates,
      {
        mean: 1,
        median: 1,
        skewness: 0,
        coefficientOfVariation: 0.05,
        meanMedianRelativeDifference: 0,
        normalQqCurvature: 0,
      },
      {
        sampleSize: 64,
        characteristicKind: "other",
        failedCandidates: [],
      },
    );

    expect(decision.competitiveFamilies).toEqual(["normal", "gamma"]);
  });

  it("uses governed family precedence for exact non-Normal AICc ties regardless of input order", () => {
    const diagnostics = {
      mean: 1,
      median: 1,
      skewness: 0,
      coefficientOfVariation: 0.05,
      meanMedianRelativeDifference: 0,
      normalQqCurvature: 0,
    };
    const gamma = makeCandidate("gamma", 10);
    const lognormal = makeCandidate("lognormal", 10);
    const options = { sampleSize: 64, characteristicKind: "other" as const, failedCandidates: [] };

    for (const candidates of [[gamma, lognormal], [lognormal, gamma]]) {
      const decision = selectDistributionModels(candidates, diagnostics, options);
      expect(decision.numericBestFamily).toBe("lognormal");
      expect(decision.proposedFinalFamily).toBe("lognormal");
    }
  });

  it("records deterministic family failures while preserving competitive evidence", async () => {
    const successful = {
      family: "normal" as const,
      modelSpecification: "normal_location_scale" as const,
      parameterCount: 2,
      parameters: { mean: 0, standardDeviation: 1 },
      logLikelihood: -10,
      aic: 24,
      aicc: 24,
      bic: 26,
      deltaAicc: 0,
      deltaBic: 0,
      ks: 0.1,
      ad: 0.2,
      qqPoints: [
        { observed: -1, theoretical: -1.1 },
        { observed: 1, theoretical: 1.1 },
      ],
      bootstrap: {
        statisticId: "anderson_darling" as const,
        observedStatistic: 0.2,
        comparisonDirection: "greater_than_or_equal" as const,
        refitEachReplicate: true as const,
        extremeReplicateCount: 5000,
        confidenceInterval: {
          level: 0.95 as const,
          method: "wilson_score" as const,
          ...wilsonScoreInterval(5000, BOOTSTRAP_REPLICATES),
        },
        pValue: 5001 / 10001,
        replicates: 10000 as const,
        seed: BOOTSTRAP_SEED,
        methodId: "F7_BOOTSTRAP_V2" as const,
        candidateMethodId: "F7_DISTRIBUTION_FIT_V1" as const,
        streamDigest: FACTOR_ID,
        status: "acceptable" as const,
      },
      warnings: [],
    };
    const collected = collectCandidateFitResults(["normal", "gamma"], (family) => {
      if (family === "gamma") throw new Error("deterministic numerical failure");
      return successful;
    });

    expect(collected).toEqual({
      candidates: [successful],
      failedCandidates: [{ family: "gamma", reasonCode: "numerical_fit_failed" }],
    });
    const distributionFitModule = await import("./distribution-fit.js");
    expect(distributionFitModule.selectDistributionModels(
      collected.candidates,
      {
        mean: 1,
        median: 1,
        skewness: 0,
        coefficientOfVariation: 0.1,
        meanMedianRelativeDifference: 0,
        normalQqCurvature: 0,
      },
      {
        sampleSize: 64,
        characteristicKind: "other",
        failedCandidates: collected.failedCandidates,
      },
    )).toMatchObject({
      status: "withheld_candidate_failures",
      numericBestFamily: "normal",
      competitiveFamilies: ["normal"],
      confidence: "low",
    });
  });

  it("rejects candidates whose criterion deltas overflow", () => {
    const candidate = fitDistribution({
      factorId: FACTOR_ID,
      observations: POSITIVE_FIXTURE,
      candidateEligibility: ALL_ELIGIBLE,
      bootstrapSeed: BOOTSTRAP_SEED,
    }).candidates[0]!;
    const collected = collectCandidateFitResults(["normal", "gamma", "uniform"], (family) => ({
      ...candidate,
      family,
      modelSpecification: family === "normal"
        ? "normal_location_scale"
        : family === "gamma"
          ? "gamma_location_zero"
          : "uniform_boundary_mle",
      parameters: family === "normal"
        ? { mean: 0, standardDeviation: 1 }
        : family === "gamma"
          ? { shape: 1, scale: 1 }
          : { minimum: 0, maximum: 1 },
      aicc: family === "normal" ? -Number.MAX_VALUE : family === "gamma" ? Number.MAX_VALUE : 0,
      bic: family === "gamma" ? -Number.MAX_VALUE : family === "normal" ? Number.MAX_VALUE : 0,
    }));

    expect(collected.candidates).toMatchObject([{ family: "uniform", deltaAicc: 0, deltaBic: 0 }]);
    expect(collected.failedCandidates).toEqual([
      { family: "normal", reasonCode: "numerical_fit_failed" },
      { family: "gamma", reasonCode: "numerical_fit_failed" },
    ]);
  });

  it("enforces the governed observation resource bound at 500", () => {
    expect(F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS).toBe(500);
    const request = {
      factorId: FACTOR_ID,
      candidateEligibility: ALL_ELIGIBLE,
      bootstrapSeed: BOOTSTRAP_SEED,
    } as const;
    expect(() => fitDistribution({
      ...request,
      observations: Array.from({ length: F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS }, () => 1),
    })).toThrow("No eligible distribution candidate could be fitted with finite diagnostics.");
    expect(() => fitDistribution({
      ...request,
      observations: Array.from({ length: F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS + 1 }, () => 1),
    })).toThrow(`at most ${F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS}`);
  });

  it("excludes positive-support families when validation marks nonpositive data ineligible", () => {
    const result = fitDistribution({
      factorId: FACTOR_ID,
      observations: [-1.2, -0.7, -0.2, 0, 0.3, 0.8, 1.1, 1.4],
      candidateEligibility: {
        normal: "eligible",
        lognormal: "ineligible_nonpositive",
        weibull: "ineligible_nonpositive",
        gamma: "ineligible_nonpositive",
        uniform: "eligible_with_boundary_warning",
      },
      bootstrapSeed: BOOTSTRAP_SEED,
    });

    expect(result.candidates.map((candidate) => candidate.family)).toEqual(["normal", "uniform"]);
  });

  it("keeps finite normal and uniform fits for a large offset with small spread", () => {
    const observations = Array.from({ length: 20 }, (_, index) => 1e8 + index * 1e-6);
    const result = fitDistribution({
      factorId: FACTOR_ID,
      observations,
      candidateEligibility: {
        normal: "eligible",
        lognormal: "ineligible_nonpositive",
        weibull: "ineligible_nonpositive",
        gamma: "ineligible_nonpositive",
        uniform: "eligible_with_boundary_warning",
      },
      bootstrapSeed: BOOTSTRAP_SEED,
    });

    expect(result.candidates.map((candidate) => candidate.family)).toEqual(["normal", "uniform"]);
    for (const candidate of result.candidates) {
      expect(Object.values(candidate.parameters).every(Number.isFinite)).toBe(true);
      expect([
        candidate.logLikelihood,
        candidate.aicc,
        candidate.bic,
        candidate.ks,
        candidate.ad,
        candidate.bootstrap.pValue,
      ].every(Number.isFinite)).toBe(true);
    }
    expect(result.candidates[0]!.parameters.standardDeviation).toBeGreaterThan(0);
  });

  it("isolates numerical candidate failures for subnormal-scale positive data", () => {
    const observations = Array.from({ length: 20 }, (_, index) => (1 + index / 19) * 1e-300);
    const result = fitDistribution({
      factorId: FACTOR_ID,
      observations,
      candidateEligibility: ALL_ELIGIBLE,
      bootstrapSeed: BOOTSTRAP_SEED,
    });

    expect(result.candidates.map((candidate) => candidate.family)).toEqual(
      expect.arrayContaining(["normal", "uniform"]),
    );
    for (const candidate of result.candidates) {
      expect(Object.values(candidate.parameters).every(Number.isFinite)).toBe(true);
      expect([
        candidate.logLikelihood,
        candidate.aicc,
        candidate.bic,
        candidate.ks,
        candidate.ad,
        candidate.bootstrap.pValue,
      ].every(Number.isFinite)).toBe(true);
    }
  });

  it("throws one controlled error when no eligible candidate can be fitted", () => {
    expect(() => fitDistribution({
      factorId: FACTOR_ID,
      observations: Array.from({ length: 20 }, () => 1),
      candidateEligibility: ALL_ELIGIBLE,
      bootstrapSeed: BOOTSTRAP_SEED,
    })).toThrow("No eligible distribution candidate could be fitted with finite diagnostics.");
  });

  it("exposes a bootstrap helper that refits every replicate and counts AD ties as extreme", async () => {
    const distributionFitModule = await import("./distribution-fit.js");
    expect(typeof distributionFitModule.runAndersonDarlingParametricBootstrap).toBe("function");
    if (typeof distributionFitModule.runAndersonDarlingParametricBootstrap !== "function") {
      return;
    }

    const statisticModels: string[] = [];
    const result = distributionFitModule.runAndersonDarlingParametricBootstrap({
      observedStatistic: 0.5,
      replicateCount: 3,
      seed: BOOTSTRAP_SEED,
      factorId: FACTOR_ID,
      candidateId: "normal",
      candidateMethodId: DISTRIBUTION_FIT_METHOD_ID,
      observedModel: { label: "observed" },
      sampleSize: 2,
      sampleFromModel: (model, random, index) => (model.label === "observed" ? random.next() + index : -1),
      refitModel: (_sample, replicateIndex) => ({ label: `refit-${replicateIndex}` }),
      computeAndersonDarling: (_sample, model) => {
        statisticModels.push(model.label);
        if (model.label === "refit-0") return 0.4;
        if (model.label === "refit-1") return 0.5;
        return 0.8;
      },
    });

    expect(statisticModels).toEqual(["refit-0", "refit-1", "refit-2"]);
    expect(result.statisticId).toBe("anderson_darling");
    expect(result.observedStatistic).toBe(0.5);
    expect(result.comparisonDirection).toBe("greater_than_or_equal");
    expect(result.refitEachReplicate).toBe(true);
    expect(result.extremeReplicateCount).toBe(2);
    expect(result.pValue).toBe(0.75);
  });

  it("uses candidateMethodId for the actual bootstrap random stream", () => {
    const samplesByMethod = new Map<string, number[]>();
    for (const candidateMethodId of [DISTRIBUTION_FIT_METHOD_ID, "F7_DISTRIBUTION_FIT_TEST_V2"]) {
      const samples: number[] = [];
      runAndersonDarlingParametricBootstrap({
        observedStatistic: 0.5,
        replicateCount: 2,
        seed: BOOTSTRAP_SEED,
        factorId: FACTOR_ID,
        candidateId: "normal",
        candidateMethodId,
        observedModel: {},
        sampleSize: 2,
        sampleFromModel: (_model, random) => {
          const value = random.next();
          samples.push(value);
          return value;
        },
        refitModel: () => ({}),
        computeAndersonDarling: () => 0.5,
      });
      samplesByMethod.set(candidateMethodId, samples);
    }

    expect(samplesByMethod.get("F7_DISTRIBUTION_FIT_TEST_V2")).not.toEqual(
      samplesByMethod.get(DISTRIBUTION_FIT_METHOD_ID),
    );
  });

  it("produces structured sample diagnostics and selection decision instead of recommendedFamily", () => {
    const result = fitDistribution({
      factorId: FACTOR_ID,
      observations: POSITIVE_FIXTURE,
      candidateEligibility: ALL_ELIGIBLE,
      bootstrapSeed: BOOTSTRAP_SEED,
    });

    expect(result).not.toHaveProperty("recommendedFamily");
    expect(result.sampleDiagnostics).toEqual({
      mean: expect.any(Number),
      median: expect.any(Number),
      skewness: expect.any(Number),
      coefficientOfVariation: expect.any(Number),
      meanMedianRelativeDifference: expect.any(Number),
      normalQqCurvature: expect.any(Number),
    });
    expect(Object.values(result.sampleDiagnostics).every(Number.isFinite)).toBe(true);
    expect(result.sampleDiagnostics.coefficientOfVariation).toBeGreaterThanOrEqual(0);
    expect(result.sampleDiagnostics.meanMedianRelativeDifference).toBeGreaterThanOrEqual(0);
    expect(result.sampleDiagnostics.normalQqCurvature).toBeGreaterThanOrEqual(0);
    expect(result.selectionDecision.methodId).toBe("F7_MODEL_SELECTION_V1");
    expect(["unique_preference", "no_unique_preference", "no_acceptable_model", "withheld_candidate_failures"])
      .toContain(result.selectionDecision.status);
  });

  it("keeps Normal in the governed competitive decision for known low-CV Normal dimensional data", () => {
    const observations = deterministicStandardNormalSample(64).map((value) => 10 + 0.2 * value);
    const result = fitDistribution({
      factorId: FACTOR_ID,
      observations,
      candidateEligibility: ALL_ELIGIBLE,
      bootstrapSeed: BOOTSTRAP_SEED,
      characteristicKind: "dimensional",
    });

    expect(result.characteristicKind).toBe("dimensional");
    expect(result.selectionDecision.competitiveFamilies).toContain("normal");
    if (result.selectionDecision.competitiveFamilies.length > 1) {
      expect(result.selectionDecision.status).toBe("no_unique_preference");
      expect(result.selectionDecision.engineeringDefaultFamily).toBe("normal");
    } else {
      expect(result.selectionDecision.status).toBe("unique_preference");
      expect(result.selectionDecision.numericBestFamily).toBe("normal");
    }
  });

  it("gives Lognormal relative support for known skewed Lognormal data without a Normal engineering default", () => {
    const observations = deterministicStandardNormalSample(64).map((value) => Math.exp(0.8 * value));
    const result = fitDistribution({
      factorId: FACTOR_ID,
      observations,
      candidateEligibility: ALL_ELIGIBLE,
      bootstrapSeed: BOOTSTRAP_SEED,
      characteristicKind: "dimensional",
    });
    const normal = result.candidates.find((candidate) => candidate.family === "normal")!;
    const lognormal = result.candidates.find((candidate) => candidate.family === "lognormal")!;

    expect(lognormal.aicc).toBeLessThan(normal.aicc);
    expect(result.selectionDecision.competitiveFamilies).toContain("lognormal");
    expect(result.selectionDecision.engineeringDefaultFamily).toBeUndefined();
    expect(result.selectionDecision.reasonCodes).not.toContain("NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT");
  });

  it("exposes a pure selector that preserves no-unique status when engineering defaulting Normal", async () => {
    const distributionFitModule = await import("./distribution-fit.js");
    expect(typeof distributionFitModule.selectDistributionModels).toBe("function");
    if (typeof distributionFitModule.selectDistributionModels !== "function") {
      return;
    }

    const decision = distributionFitModule.selectDistributionModels(
      [makeCandidate("normal", 10), makeCandidate("gamma", 11.2), makeCandidate("lognormal", 15, "weak")],
      {
        mean: 10,
        median: 9.95,
        skewness: 0.5,
        coefficientOfVariation: 0.1,
        meanMedianRelativeDifference: 0.02,
        normalQqCurvature: 0.1,
      },
      {
        sampleSize: 64,
        characteristicKind: "dimensional",
        failedCandidates: [],
      },
    );

    expect(decision).toMatchObject({
      methodId: "F7_MODEL_SELECTION_V1",
      status: "no_unique_preference",
      numericBestFamily: "normal",
      competitiveFamilies: ["normal", "gamma"],
      engineeringDefaultFamily: "normal",
      proposedFinalFamily: "normal",
      confidence: "moderate",
    });
    expect(decision.reasonCodes).toContain("MULTIPLE_COMPETITIVE_MODELS");
    expect(decision.reasonCodes).toContain("NORMAL_DIMENSIONAL_ENGINEERING_DEFAULT");
  });

  it("marks small-sample competitive ties as low confidence and does not infer defaults from positive support", async () => {
    const distributionFitModule = await import("./distribution-fit.js");
    expect(typeof distributionFitModule.selectDistributionModels).toBe("function");
    if (typeof distributionFitModule.selectDistributionModels !== "function") {
      return;
    }

    const decision = distributionFitModule.selectDistributionModels(
      [makeCandidate("lognormal", 10), makeCandidate("gamma", 11.3), makeCandidate("normal", 11.8)],
      {
        mean: 2,
        median: 1.7,
        skewness: 1.1,
        coefficientOfVariation: 0.33,
        meanMedianRelativeDifference: 0.15,
        normalQqCurvature: 0.22,
      },
      {
        sampleSize: 32,
        characteristicKind: "other",
        failedCandidates: [],
      },
    );

    expect(decision.status).toBe("no_unique_preference");
    expect(decision.competitiveFamilies).toEqual(["lognormal", "gamma", "normal"]);
    expect(decision.confidence).toBe("low");
    expect(decision.reasonCodes).toContain("MULTIPLE_COMPETITIVE_MODELS");
    expect(decision.reasonCodes).toContain("SMALL_SAMPLE_UNCERTAINTY");
    expect(decision.engineeringDefaultFamily).toBeUndefined();
    expect(decision.proposedFinalFamily).toBe("normal");
  });

  it("supports unique, no-acceptable, and withheld outcomes from acceptable-only evidence", async () => {
    const distributionFitModule = await import("./distribution-fit.js");
    expect(typeof distributionFitModule.selectDistributionModels).toBe("function");
    if (typeof distributionFitModule.selectDistributionModels !== "function") {
      return;
    }

    const sampleDiagnostics = {
      mean: 1,
      median: 1,
      skewness: 0,
      coefficientOfVariation: 0.05,
      meanMedianRelativeDifference: 0,
      normalQqCurvature: 0,
    };
    expect(distributionFitModule.selectDistributionModels(
      [makeCandidate("gamma", 10), makeCandidate("normal", 12.5), makeCandidate("lognormal", 13.5, "weak")],
      sampleDiagnostics,
      { sampleSize: 64, characteristicKind: "other", failedCandidates: [] },
    )).toMatchObject({
      status: "unique_preference",
      numericBestFamily: "gamma",
      competitiveFamilies: ["gamma"],
      proposedFinalFamily: "gamma",
      confidence: "moderate",
    });

    expect(distributionFitModule.selectDistributionModels(
      [makeCandidate("gamma", 10, "weak"), makeCandidate("normal", 11, "rejected")],
      sampleDiagnostics,
      { sampleSize: 64, characteristicKind: "other", failedCandidates: [] },
    )).toMatchObject({
      status: "no_acceptable_model",
      competitiveFamilies: [],
      confidence: "low",
      reasonCodes: ["NO_ACCEPTABLE_MODEL"],
    });
    expect(distributionFitModule.selectDistributionModels(
      [makeCandidate("gamma", 10, "weak"), makeCandidate("normal", 11, "rejected")],
      sampleDiagnostics,
      { sampleSize: 64, characteristicKind: "other", failedCandidates: [] },
    ).proposedFinalFamily).toBeUndefined();

    const withheld = distributionFitModule.selectDistributionModels(
      [makeCandidate("normal", 10), makeCandidate("gamma", 11.5)],
      sampleDiagnostics,
      {
        sampleSize: 64,
        characteristicKind: "dimensional",
        failedCandidates: [{ family: "lognormal", reasonCode: "numerical_fit_failed" }],
      },
    );
    expect(withheld.status).toBe("withheld_candidate_failures");
    expect(withheld.confidence).toBe("low");
    expect(withheld.competitiveFamilies).toEqual(["normal", "gamma"]);
    expect(withheld.reasonCodes).toContain("CANDIDATE_FIT_FAILURES");
    expect(withheld.engineeringDefaultFamily).toBeUndefined();
    expect(withheld.proposedFinalFamily).toBeUndefined();
  });

  it("proposes numeric best when Normal is acceptable but outside the competitive set", () => {
    const decision = selectDistributionModels(
      [makeCandidate("gamma", 10), makeCandidate("normal", 12.1), makeCandidate("lognormal", 11.5)],
      {
        mean: 1,
        median: 1,
        skewness: 0,
        coefficientOfVariation: 0.05,
        meanMedianRelativeDifference: 0,
        normalQqCurvature: 0,
      },
      { sampleSize: 64, characteristicKind: "dimensional", failedCandidates: [] },
    );

    expect(decision.competitiveFamilies).toEqual(["gamma", "lognormal"]);
    expect(decision.proposedFinalFamily).toBe("gamma");
  });

  it("exposes finite sample diagnostics with auditable zero-mean fallback and scale-invariant Normal curvature", async () => {
    const distributionFitModule = await import("./distribution-fit.js");
    expect(typeof distributionFitModule.computeSampleDiagnostics).toBe("function");
    if (typeof distributionFitModule.computeSampleDiagnostics !== "function") {
      return;
    }

    const zeroMean = distributionFitModule.computeSampleDiagnostics([-2, -1, 1, 2]);
    expect(Object.values(zeroMean).every(Number.isFinite)).toBe(true);
    expect(zeroMean.coefficientOfVariation).toBe(Number.MAX_VALUE);

    const zeroVariance = distributionFitModule.computeSampleDiagnostics([5, 5, 5, 5]);
    expect(zeroVariance.skewness).toBe(0);
    expect(zeroVariance.coefficientOfVariation).toBe(0);
    expect(zeroVariance.normalQqCurvature).toBe(0);

    const base = distributionFitModule.computeSampleDiagnostics([1, 2, 3, 4, 5, 6]);
    const scaled = distributionFitModule.computeSampleDiagnostics([10, 20, 30, 40, 50, 60]);
    expect(base.normalQqCurvature).toBeCloseTo(scaled.normalQqCurvature, 12);
  });

  it("detects symmetric heavy-tail curvature in the Normal Q-Q diagnostic", () => {
    const approximatelyNormal = deterministicStandardNormalSample(500).sort((left, right) => left - right);
    const symmetricHeavyTail = [-12, -7, -3, -2, -1.5, -1, -0.7, -0.4, 0.4, 0.7, 1, 1.5, 2, 3, 7, 12];

    expect(computeSampleDiagnostics(approximatelyNormal).normalQqCurvature).toBeLessThanOrEqual(
      F7_SELECTION_NORMAL_QQ_CURVATURE_MAX,
    );
    expect(computeSampleDiagnostics(symmetricHeavyTail).normalQqCurvature).toBeGreaterThan(
      F7_SELECTION_NORMAL_QQ_CURVATURE_MAX,
    );
  });

  it("keeps extreme-value sample diagnostics finite and stable", async () => {
    const distributionFitModule = await import("./distribution-fit.js");
    expect(typeof distributionFitModule.computeSampleDiagnostics).toBe("function");
    if (typeof distributionFitModule.computeSampleDiagnostics !== "function") {
      return;
    }

    const allMax = distributionFitModule.computeSampleDiagnostics([Number.MAX_VALUE, Number.MAX_VALUE]);
    expect(allMax.mean).toBe(Number.MAX_VALUE);
    expect(allMax.median).toBe(Number.MAX_VALUE);
    expect(Object.values(allMax).every(Number.isFinite)).toBe(true);

    const symmetricMax = distributionFitModule.computeSampleDiagnostics([-Number.MAX_VALUE, Number.MAX_VALUE]);
    expect(Object.values(symmetricMax).every(Number.isFinite)).toBe(true);
  });
});