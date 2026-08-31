export type CapabilityChangeAssessment = "better" | "worse" | "unchanged";

interface CapabilityComparisonInput {
  readonly measured: {
    readonly mean: number;
    readonly standardDeviation: number;
    readonly cp: number;
    readonly cpk: number;
  };
  readonly setup: {
    readonly signedMean: number;
    readonly standardDeviation: number;
  };
  readonly lowerSpecLimit: number;
  readonly upperSpecLimit: number;
}

function difference(measured: number, setup: number): number {
  return Number((measured - setup).toPrecision(12));
}

function assessment(delta: number, higherIsBetter: boolean): CapabilityChangeAssessment {
  if (Math.abs(delta) <= Number.EPSILON) return "unchanged";
  return (delta > 0) === higherIsBetter ? "better" : "worse";
}

export function buildCapabilityComparison(input: CapabilityComparisonInput) {
  const setupMean = Math.abs(input.setup.signedMean);
  const setupStandardDeviation = input.setup.standardDeviation;
  const setupCp = (input.upperSpecLimit - input.lowerSpecLimit) / (6 * setupStandardDeviation);
  const setupCpu = (input.upperSpecLimit - setupMean) / (3 * setupStandardDeviation);
  const setupCpl = (setupMean - input.lowerSpecLimit) / (3 * setupStandardDeviation);
  const setupCpk = Math.min(setupCpu, setupCpl);
  const meanDelta = difference(input.measured.mean, setupMean);
  const standardDeviationDelta = difference(input.measured.standardDeviation, setupStandardDeviation);
  const cpDelta = difference(input.measured.cp, setupCp);
  const cpkDelta = difference(input.measured.cpk, setupCpk);

  return {
    mean: {
      setup: setupMean,
      measured: input.measured.mean,
      delta: meanDelta,
      relativeChange: meanDelta / setupMean,
    },
    standardDeviation: {
      setup: setupStandardDeviation,
      measured: input.measured.standardDeviation,
      delta: standardDeviationDelta,
      ratio: input.measured.standardDeviation / setupStandardDeviation,
      relativeChange: standardDeviationDelta / setupStandardDeviation,
      assessment: assessment(standardDeviationDelta, false),
    },
    cp: {
      setup: setupCp,
      measured: input.measured.cp,
      delta: cpDelta,
      relativeChange: cpDelta / setupCp,
      assessment: assessment(cpDelta, true),
    },
    cpk: {
      setup: setupCpk,
      measured: input.measured.cpk,
      delta: cpkDelta,
      relativeChange: cpkDelta / Math.abs(setupCpk),
      assessment: assessment(cpkDelta, true),
    },
  } as const;
}