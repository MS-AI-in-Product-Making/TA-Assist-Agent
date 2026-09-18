import {
  evaluateFactorMeasurementWarnings,
  type FactorMeasurementDisposition,
} from "@ai-assist/f7-statistics";

interface MeasurementWarningFactor {
  readonly evidence?: {
    readonly lowerSpecLimit: number;
    readonly upperSpecLimit: number;
  } | undefined;
  readonly measurementPasteResult?: {
    readonly dataset?: {
      readonly observations: ReadonlyArray<{
        readonly value: number;
        readonly disposition: FactorMeasurementDisposition;
      }>;
    } | undefined;
  } | undefined;
}

export function measurementWorkspaceWarnings(factor: MeasurementWarningFactor): readonly string[] {
  const evidence = factor.evidence;
  const dataset = factor.measurementPasteResult?.dataset;
  if (!evidence || !dataset) return [];

  const warningEvidence = evaluateFactorMeasurementWarnings({
    lowerSpecLimit: evidence.lowerSpecLimit,
    upperSpecLimit: evidence.upperSpecLimit,
    observations: dataset.observations,
  });
  const warnings: string[] = [];
  if (warningEvidence.crossesZero) {
    warnings.push("Factor specification crosses zero; physical LSL is 0.");
  }

  const outOfSpecCount = warningEvidence.outOfSpecCount;
  if (outOfSpecCount > 0) {
    warnings.push(`${outOfSpecCount} included measurement${outOfSpecCount === 1 ? " is" : "s are"} outside the Factor specification.`);
  }

  const outlierCount = warningEvidence.candidateOutlierCount;
  if (outlierCount > 0) {
    warnings.push(
      `${outlierCount} measurement${outlierCount === 1 ? " is" : "s are"} a candidate outlier${outlierCount === 1 ? "" : "s"}. Review the highlighted measurement row${outlierCount === 1 ? "" : "s"} in Data Quality.`,
    );
  }

  return warnings;
}
