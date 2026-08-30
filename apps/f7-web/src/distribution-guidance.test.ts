import { describe, expect, it } from "vitest";
import { distributionInterpretationRules } from "@ai-assist/knowledge-base/public-distribution-rules";
import type { F7DistributionFitResult } from "./api/f7-client";
import {
  buildMeasuredDistributionInterpretation,
  resolveSelectedDistribution,
} from "./distribution-guidance";

function candidate(family: "normal" | "lognormal", status: "acceptable" | "weak" | "rejected") {
  return {
    family,
    modelSpecification: family === "normal" ? "normal_location_scale" : "lognormal_location_zero",
    parameterCount: 2,
    parameters: family === "normal"
      ? { mean: 10.2, standardDeviation: 1.4 }
      : { logMean: 2.3, logStandardDeviation: 0.14 },
    aicc: family === "normal" ? 20 : 19,
    bootstrap: { status, pValue: status === "acceptable" ? 0.4 : status === "weak" ? 0.08 : 0.02 },
  } as unknown as F7DistributionFitResult["candidates"][number];
}

function fitResult(overrides: Partial<F7DistributionFitResult["selectionDecision"]> = {}): F7DistributionFitResult {
  return {
    factorId: "a".repeat(64),
    sampleSize: 24,
    candidates: [candidate("normal", "acceptable"), candidate("lognormal", "weak")],
    selectionDecision: {
      methodId: "F7_MODEL_SELECTION_V1",
      status: "no_unique_preference",
      numericBestFamily: "lognormal",
      competitiveFamilies: ["lognormal", "normal"],
      proposedFinalFamily: "lognormal",
      confidence: "moderate",
      reasonCodes: ["MULTIPLE_COMPETITIVE_MODELS", "SMALL_SAMPLE_UNCERTAINTY"],
      ...overrides,
    },
  } as F7DistributionFitResult;
}

describe("selected distribution guidance", () => {
  it("resolves an approved family before the proposed family", () => {
    const result = fitResult();
    const resolved = resolveSelectedDistribution(result, {
      factorId: result.factorId,
      family: "normal",
      confirmed: true,
      approvedAt: "2026-08-29T08:00:00.000Z",
    });
    expect(resolved).toMatchObject({ source: "approved", candidate: { family: "normal" } });
  });

  it("uses the proposed family before approval", () => {
    expect(resolveSelectedDistribution(fitResult(), undefined)).toMatchObject({
      source: "proposed",
      candidate: { family: "lognormal" },
    });
  });

  it.each(["no_acceptable_model", "withheld_candidate_failures"] as const)(
    "does not fall back when selection status is %s",
    (status) => {
      const result = fitResult({ status, proposedFinalFamily: undefined });
      expect(resolveSelectedDistribution(result, undefined)).toEqual({
        available: false,
        reason: "selection-unavailable",
      });
    },
  );

  it("builds controlled F0 statements and separate Setup/Sample facts", () => {
    const result = buildMeasuredDistributionInterpretation({
      fitResult: fitResult(),
      setup: { mean: 10, standardDeviation: 1.2 },
      sample: { mean: 10.2, standardDeviation: 1.4 },
    });
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.ruleIds).toEqual([
      "f0:distribution:bootstrap:weak",
      "f0:distribution:confidence:moderate",
      "f0:distribution:uncertainty:small-sample",
      "f0:distribution:compatibility:not-proof",
    ]);
    expect(result.controlledStatements).toEqual([
      "Bootstrap fit evidence is weak; treat the selected distribution cautiously.",
      "Selection confidence is moderate; retain the stated uncertainty in downstream decisions.",
      "The small sample increases uncertainty in the selected distribution.",
      "Distribution compatibility is not proof that the measured and assumed distributions are equivalent.",
    ]);
    expect(result.factualComparisons).toEqual([
      "Sample mean increased from the Factor Setup value of 10.0000 to 10.2000 (+0.2000).",
      "Sample standard deviation increased from the Factor Setup value of 1.2000 to 1.4000 (+16.7%).",
    ]);
    expect(result.provenanceLabel).toBe("F0 distribution-interpretation-v1");
  });

  it.each([
    ["acceptable", "f0:distribution:bootstrap:acceptable"],
    ["rejected", "f0:distribution:bootstrap:rejected"],
  ] as const)("maps %s bootstrap evidence", (status, ruleId) => {
    const result = fitResult();
    result.candidates[1] = candidate("lognormal", status);
    const interpretation = buildMeasuredDistributionInterpretation({
      fitResult: result,
      setup: { mean: 10.2, standardDeviation: 1.4 },
      sample: { mean: 10.2, standardDeviation: 1.4 },
    });
    expect(interpretation.available && interpretation.ruleIds).toContain(ruleId);
  });

  it("maps low selection confidence to its controlled rule", () => {
    const interpretation = buildMeasuredDistributionInterpretation({
      fitResult: fitResult({ confidence: "low" }),
      setup: { mean: 10, standardDeviation: 1 },
      sample: { mean: 10.2, standardDeviation: 1.4 },
    });
    expect(interpretation.available && interpretation.ruleIds).toContain(
      "f0:distribution:confidence:low",
    );
  });

  it("returns unavailable when governed rules or the selected candidate are unavailable", () => {
    const withoutCandidate = fitResult({ proposedFinalFamily: "uniform" });
    expect(buildMeasuredDistributionInterpretation({
      fitResult: withoutCandidate,
      setup: { mean: 10, standardDeviation: 1 },
      sample: { mean: 10, standardDeviation: 1 },
    })).toEqual({ available: false, status: "unavailable", reason: "selected-candidate-unavailable" });
    expect(buildMeasuredDistributionInterpretation({
      fitResult: fitResult(),
      setup: { mean: 10, standardDeviation: 1 },
      sample: { mean: 10, standardDeviation: 1 },
      rules: null,
    })).toEqual({ available: false, status: "unavailable", reason: "rules-unavailable" });
  });

  it("fails closed for invalid runtime rules and comparison values", () => {
    const baseInput = {
      fitResult: fitResult(),
      setup: { mean: 10, standardDeviation: 1 },
      sample: { mean: 10, standardDeviation: 1 },
    };
    expect(buildMeasuredDistributionInterpretation({
      ...baseInput,
      rules: distributionInterpretationRules.map((rule) => rule.ruleId === "f0:distribution:bootstrap:weak"
        ? { ...rule, statement: "Runtime replacement" }
        : rule) as never,
    })).toEqual({ available: false, status: "unavailable", reason: "rules-unavailable" });
    expect(buildMeasuredDistributionInterpretation({
      ...baseInput,
      sample: { mean: 10, standardDeviation: -1 },
    })).toEqual({ available: false, status: "unavailable", reason: "comparison-unavailable" });
  });
});
