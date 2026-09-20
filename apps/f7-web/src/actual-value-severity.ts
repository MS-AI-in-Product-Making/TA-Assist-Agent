export type ActualValueSeverity = "normal" | "attention" | "critical";

export type ActualValueMetric = "mean" | "tolerance" | "oneSigma" | "cp" | "cpk" | "contribution";

export interface ActualValueSeverityResult {
  readonly severity: ActualValueSeverity;
  readonly adversePercentage: number | undefined;
}

interface ActualValueSeverityInput {
  readonly metric: ActualValueMetric;
  readonly setup: number;
  readonly actual: number | undefined;
  readonly normalizationFallback?: number;
}

function severityForPercentage(adversePercentage: number): ActualValueSeverity {
  if (adversePercentage <= 5) return "normal";
  if (adversePercentage <= 15) return "attention";
  return "critical";
}

function adverseDifference(metric: ActualValueMetric, setup: number, actual: number): number {
  switch (metric) {
    case "mean":
      return Math.abs(Math.abs(actual) - Math.abs(setup));
    case "cp":
    case "cpk":
      return Math.max(0, setup - actual);
    case "tolerance":
    case "oneSigma":
    case "contribution":
      return Math.max(0, actual - setup);
  }
}

export function classifyActualValueSeverity(
  input: ActualValueSeverityInput,
): ActualValueSeverityResult | undefined {
  if (input.actual === undefined || !Number.isFinite(input.actual) || !Number.isFinite(input.setup)) return undefined;

  const difference = adverseDifference(input.metric, input.setup, input.actual);
  const setupMagnitude = Math.abs(input.setup);
  const fallbackMagnitude = Math.abs(input.normalizationFallback ?? 0);
  const denominator = setupMagnitude > 0 && Number.isFinite(setupMagnitude)
    ? setupMagnitude
    : fallbackMagnitude > 0 && Number.isFinite(fallbackMagnitude)
      ? fallbackMagnitude
      : undefined;

  if (difference === 0) return { severity: "normal", adversePercentage: 0 };
  if (denominator === undefined) return { severity: "critical", adversePercentage: undefined };

  const adversePercentage = difference / denominator * 100;
  return {
    severity: severityForPercentage(adversePercentage),
    adversePercentage,
  };
}

export function classifyDistributionSeverity(
  setupFamily: string | undefined,
  actualFamily: string | undefined,
): ActualValueSeverityResult | undefined {
  if (!setupFamily || !actualFamily) return undefined;
  const matches = setupFamily.toLowerCase() === actualFamily.toLowerCase();
  return {
    severity: matches ? "normal" : "critical",
    adversePercentage: matches ? 0 : undefined,
  };
}
