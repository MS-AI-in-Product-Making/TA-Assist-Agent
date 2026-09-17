import { buildMeasurementDiagnostics } from "./measurement-diagnostics";

interface MeasurementWarningFactor {
  readonly evidence?: {
    readonly lowerSpecLimit: number;
    readonly upperSpecLimit: number;
  } | undefined;
  readonly measurementPasteResult?: {
    readonly dataset?: {
      readonly observations: ReadonlyArray<{
        readonly value: number;
        readonly disposition: string;
      }>;
    } | undefined;
  } | undefined;
}

export function measurementWorkspaceWarnings(factor: MeasurementWarningFactor): readonly string[] {
  const evidence = factor.evidence;
  const dataset = factor.measurementPasteResult?.dataset;
  if (!evidence || !dataset) return [];

  const warnings: string[] = [];
  if (Math.min(evidence.lowerSpecLimit, evidence.upperSpecLimit) <= 0
    && Math.max(evidence.lowerSpecLimit, evidence.upperSpecLimit) >= 0) {
    warnings.push("Factor specification crosses zero; physical LSL is 0.");
  }

  const outOfSpecCount = dataset.observations.filter((observation) => (
    observation.disposition === "included"
    && (observation.value < evidence.lowerSpecLimit || observation.value > evidence.upperSpecLimit)
  )).length;
  if (outOfSpecCount > 0) {
    warnings.push(`${outOfSpecCount} included measurement${outOfSpecCount === 1 ? " is" : "s are"} outside the Factor specification.`);
  }

  const includedValues = dataset.observations
    .filter((observation) => observation.disposition === "included")
    .map((observation) => observation.value);
  const outlierCount = buildMeasurementDiagnostics(includedValues, 0).outlierIndexes.length;
  if (outlierCount > 0) {
    warnings.push(
      `${outlierCount} measurement${outlierCount === 1 ? " is" : "s are"} a candidate outlier${outlierCount === 1 ? "" : "s"}. Review the highlighted measurement row${outlierCount === 1 ? "" : "s"} in Data Quality.`,
    );
  }

  return warnings;
}
