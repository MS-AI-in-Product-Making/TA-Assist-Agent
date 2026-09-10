import { formatF7NarrativeEvidenceValue } from "@ai-assist/product-language/f7-engineering-narrative";

export type TaResultSummaryKey =
  | "mean"
  | "standard-deviation"
  | "cp"
  | "cpk"
  | "lower-cpk"
  | "upper-cpk";

export interface TaResultSummaryRow {
  readonly key: TaResultSummaryKey;
  readonly kind: "comparison";
  readonly metric: string;
  readonly result: string;
  readonly reference: string;
  readonly referenceDetail?: string;
  readonly difference: string;
  readonly assessment: string;
  readonly performanceContext: string;
  readonly tone?: "pass" | "fail" | "warning";
}

export interface TaResultSummaryInput {
  readonly designNominal: number;
  readonly mean: number;
  readonly standardDeviation: number;
  readonly lowerSpecLimit: number;
  readonly upperSpecLimit: number;
  readonly cp: number;
  readonly cpk: number;
  readonly lowerCpk: number;
  readonly upperCpk: number;
  readonly targetCpk: number;
  readonly governedCpkDisplay: {
    readonly result: string;
    readonly target: string;
    readonly difference: string;
    readonly status: "meets-target" | "below-target";
  };
}

function format(value: number): string {
  return formatF7NarrativeEvidenceValue(value);
}

function formatSigned(value: number): string {
  if (value === 0) return format(value);
  return `${value > 0 ? "+" : "-"}${format(Math.abs(value))}`;
}

function targetAssessment(value: number, target: number): string {
  return value >= target ? "Meets target" : "Below target";
}

function targetPerformanceContext(value: number, target: number): string {
  if (target <= 0) return "Target ratio unavailable";
  const achievementPercent = (value / target) * 100;
  if (value === target) return "100% of target";
  const gapPercent = Math.abs(achievementPercent - 100);
  return `${format(achievementPercent)}% of target · ${format(gapPercent)}% ${value > target ? "surplus" : "shortfall"}`;
}

function maximumStandardDeviation(input: TaResultSummaryInput): number {
  const lowerClearance = input.mean - input.lowerSpecLimit;
  const upperClearance = input.upperSpecLimit - input.mean;
  return Math.min(lowerClearance, upperClearance) / (3 * input.targetCpk);
}

export function buildTaOverallAssessment(input: TaResultSummaryInput): string {
  const conclusion = input.governedCpkDisplay.status === "meets-target" ? "Pass" : "Fail";
  const meanDifference = input.mean - input.designNominal;
  const meanFact = meanDifference === 0
    ? "Mean is centered."
    : `Mean shifted ${meanDifference > 0 ? "high" : "low"}.`;
  const sigmaFact = input.standardDeviation <= maximumStandardDeviation(input)
    ? "Standard deviation is within target."
    : "Standard deviation is too high.";
  const cpkFact = input.governedCpkDisplay.status === "meets-target"
    ? `Cpk ${input.governedCpkDisplay.result} meets target ${input.governedCpkDisplay.target}.`
    : `Cpk ${input.governedCpkDisplay.result} is below target ${input.governedCpkDisplay.target}.`;
  const lowerInsufficient = input.lowerCpk < input.targetCpk;
  const upperInsufficient = input.upperCpk < input.targetCpk;
  let sideFact = "Lower- and upper-side capability meet target.";
  if (lowerInsufficient && upperInsufficient) {
    sideFact = `Lower- and upper-side capabilities are insufficient (Lower Cpk ${format(input.lowerCpk)}; Upper Cpk ${format(input.upperCpk)}).`;
  } else if (lowerInsufficient) {
    sideFact = `Lower-side capability is insufficient (Lower Cpk ${format(input.lowerCpk)}).`;
  } else if (upperInsufficient) {
    sideFact = `Upper-side capability is insufficient (Upper Cpk ${format(input.upperCpk)}).`;
  }

  return `${conclusion}. ${meanFact} ${sigmaFact} ${cpkFact} ${sideFact}`;
}

export function buildTaResultSummary(input: TaResultSummaryInput): readonly TaResultSummaryRow[] {
  const meanDifference = input.mean - input.designNominal;
  const standardDeviationTarget = maximumStandardDeviation(input);
  const standardDeviationDifference = input.standardDeviation - standardDeviationTarget;

  return [
    {
      key: "mean",
      kind: "comparison",
      metric: "Mean",
      result: format(input.mean),
      reference: `Nominal ${format(input.designNominal)}`,
      referenceDetail: "System Design Nominal",
      difference: formatSigned(meanDifference),
      assessment: meanDifference === 0 ? "Centered" : meanDifference > 0 ? "Shifted high" : "Shifted low",
      performanceContext: meanDifference === 0
        ? "Centered on nominal"
        : `${format((Math.abs(meanDifference) / (input.upperSpecLimit - input.lowerSpecLimit)) * 100)}% of specification span · shifted ${meanDifference > 0 ? "high" : "low"}`,
      tone: meanDifference === 0 ? "pass" : "warning",
    },
    {
      key: "standard-deviation",
      kind: "comparison",
      metric: "Standard Deviation",
      result: format(input.standardDeviation),
      reference: `Max ${format(standardDeviationTarget)} at target`,
      referenceDetail: "Derived from nearest specification limit and target Cpk",
      difference: formatSigned(standardDeviationDifference),
      assessment: standardDeviationDifference <= 0 ? "Within target" : "Too high",
      performanceContext: standardDeviationTarget > 0
        ? `${format((input.standardDeviation / standardDeviationTarget) * 100)}% of maximum · ${format(Math.abs(standardDeviationDifference / standardDeviationTarget) * 100)}% ${standardDeviationDifference <= 0 ? "margin" : "over"}`
        : "No positive allowance at target",
      tone: standardDeviationDifference <= 0 ? "pass" : "fail",
    },
    {
      key: "cp",
      kind: "comparison",
      metric: "Cp",
      result: format(input.cp),
      reference: `Target ${format(input.targetCpk)}`,
      difference: formatSigned(input.cp - input.targetCpk),
      assessment: targetAssessment(input.cp, input.targetCpk),
      performanceContext: targetPerformanceContext(input.cp, input.targetCpk),
      tone: input.cp >= input.targetCpk ? "pass" : "fail",
    },
    {
      key: "cpk",
      kind: "comparison",
      metric: "Cpk",
      result: input.governedCpkDisplay.result,
      reference: `Target ${input.governedCpkDisplay.target}`,
      difference: input.governedCpkDisplay.difference,
      assessment: input.governedCpkDisplay.status === "meets-target" ? "Meets target" : "Below target",
      performanceContext: targetPerformanceContext(input.cpk, input.targetCpk),
      tone: input.governedCpkDisplay.status === "meets-target" ? "pass" : "fail",
    },
    {
      key: "lower-cpk",
      kind: "comparison",
      metric: "Lower Cpk",
      result: format(input.lowerCpk),
      reference: `Target ${format(input.targetCpk)}`,
      difference: formatSigned(input.lowerCpk - input.targetCpk),
      assessment: targetAssessment(input.lowerCpk, input.targetCpk),
      performanceContext: targetPerformanceContext(input.lowerCpk, input.targetCpk),
      tone: input.lowerCpk >= input.targetCpk ? "pass" : "fail",
    },
    {
      key: "upper-cpk",
      kind: "comparison",
      metric: "Upper Cpk",
      result: format(input.upperCpk),
      reference: `Target ${format(input.targetCpk)}`,
      difference: formatSigned(input.upperCpk - input.targetCpk),
      assessment: targetAssessment(input.upperCpk, input.targetCpk),
      performanceContext: targetPerformanceContext(input.upperCpk, input.targetCpk),
      tone: input.upperCpk >= input.targetCpk ? "pass" : "fail",
    },
  ];
}