import { buildMeasurementDiagnostics } from "./measurement-diagnostics.js";
import type { FactorMeasurementDisposition } from "./measurement-observation.js";

export interface FactorMeasurementWarningObservation {
  readonly value: number;
  readonly disposition: FactorMeasurementDisposition;
}

export interface FactorMeasurementWarningInput {
  readonly lowerSpecLimit: number;
  readonly upperSpecLimit: number;
  readonly observations: readonly FactorMeasurementWarningObservation[];
}

export interface FactorMeasurementWarningEvidence {
  readonly crossesZero: boolean;
  readonly outOfSpecCount: number;
  readonly candidateOutlierCount: number;
}

export function evaluateFactorMeasurementWarnings(
  input: FactorMeasurementWarningInput,
): FactorMeasurementWarningEvidence {
  const crossesZero = input.lowerSpecLimit < 0;
  const includedObservations = input.observations.filter(
    (observation) => observation.disposition === "included",
  );
  const outOfSpecCount = includedObservations.filter((observation) => (
    observation.value < input.lowerSpecLimit || observation.value > input.upperSpecLimit
  )).length;
  const candidateOutlierCount = buildMeasurementDiagnostics(
    includedObservations.map((observation) => observation.value),
    0,
  ).outlierIndexes.length;

  return { crossesZero, outOfSpecCount, candidateOutlierCount };
}

export function hasFactorMeasurementWarning(evidence: FactorMeasurementWarningEvidence): boolean {
  return evidence.crossesZero
    || evidence.outOfSpecCount > 0
    || evidence.candidateOutlierCount > 0;
}