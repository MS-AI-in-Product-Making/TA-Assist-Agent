export interface MonteCarloSetupSummaryInput {
  readonly factors: readonly {
    readonly setup?: { readonly confirmed?: boolean } | undefined;
    readonly evidence?: {
      readonly calculatedMean: number;
      readonly oneSigma: number;
    } | undefined;
  }[];
  readonly systemSpecification?: {
    readonly additionalMeanShift?:
      | {
        readonly status: "available";
        readonly actualValue: number;
        readonly valueOrigin: "numeric_literal" | "formula_cached" | "defaulted";
      }
      | { readonly status: "unavailable" }
      | undefined;
  } | undefined;
}

export type MonteCarloSetupSummary =
  | { readonly available: false }
  | {
    readonly available: true;
    readonly mean: number;
    readonly standardDeviation: number;
  };

export type MonteCarloSetupComparison =
  | { readonly available: false }
  | {
    readonly available: true;
    readonly mean: {
      readonly setup: number;
      readonly monteCarlo: number;
      readonly delta: number;
      readonly direction: "left" | "right" | "same";
    };
    readonly standardDeviation: {
      readonly setup: number;
      readonly monteCarlo: number;
      readonly relativeChange: number;
      readonly direction: "wider" | "narrower" | "same";
    };
  };

export function deriveMonteCarloSetupSummary(
  input: MonteCarloSetupSummaryInput,
): MonteCarloSetupSummary {
  if (input.factors.length === 0) return { available: false };

  let mean = 0;
  let standardDeviation = 0;
  for (const factor of input.factors) {
    const evidence = factor.evidence;
    if (factor.setup?.confirmed !== true
      || evidence === undefined
      || !Number.isFinite(evidence.calculatedMean)
      || !Number.isFinite(evidence.oneSigma)
      || evidence.oneSigma < 0) {
      return { available: false };
    }
    mean += evidence.calculatedMean;
    standardDeviation = Math.hypot(standardDeviation, evidence.oneSigma);
  }

  const shiftEvidence = input.systemSpecification?.additionalMeanShift;
  if (shiftEvidence?.status !== "available") return { available: false };
  const shift = shiftEvidence.valueOrigin === "defaulted" ? 0 : shiftEvidence.actualValue;
  mean += shift;
  if (!Number.isFinite(mean)
    || !Number.isFinite(shift)
    || !Number.isFinite(standardDeviation)
    || standardDeviation <= 0) {
    return { available: false };
  }

  return { available: true, mean, standardDeviation };
}

export function buildMonteCarloSetupComparison(input: {
  readonly setup: MonteCarloSetupSummary;
  readonly monteCarlo: { readonly mean: number; readonly standardDeviation: number };
}): MonteCarloSetupComparison {
  if (!input.setup.available
    || !Number.isFinite(input.monteCarlo.mean)
    || !Number.isFinite(input.monteCarlo.standardDeviation)) {
    return { available: false };
  }

  const meanDelta = input.monteCarlo.mean - input.setup.mean;
  const standardDeviationRelativeChange = (
    input.monteCarlo.standardDeviation - input.setup.standardDeviation
  ) / input.setup.standardDeviation;
  if (!Number.isFinite(meanDelta) || !Number.isFinite(standardDeviationRelativeChange)) {
    return { available: false };
  }
  const meanChanged = Math.abs(meanDelta) >= 0.5e-4;
  const standardDeviationChanged = Math.abs(standardDeviationRelativeChange) >= 0.5e-3;

  return {
    available: true,
    mean: {
      setup: input.setup.mean,
      monteCarlo: input.monteCarlo.mean,
      delta: meanDelta,
      direction: !meanChanged ? "same" : meanDelta < 0 ? "left" : "right",
    },
    standardDeviation: {
      setup: input.setup.standardDeviation,
      monteCarlo: input.monteCarlo.standardDeviation,
      relativeChange: standardDeviationRelativeChange,
      direction: !standardDeviationChanged
        ? "same"
        : standardDeviationRelativeChange < 0
        ? "narrower"
        : "wider",
    },
  };
}