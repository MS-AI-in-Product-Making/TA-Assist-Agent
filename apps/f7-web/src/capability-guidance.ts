import { getPublicEngineeringRule } from '@ai-assist/knowledge-base/public-engineering-rules';

export const defaultCpkRule = getPublicEngineeringRule({ ruleId: 'default-cpk-target' });

export type PublicEngineeringRuleResult = ReturnType<typeof getPublicEngineeringRule>;

export type CapabilityGuidanceUnavailable = {
  available: false;
  status: 'unavailable';
  targetAssessment?: string | null;
  interpretations: string[];
  recommendations: string[];
};

export type CapabilityGuidanceAvailable = {
  available: true;
  status: 'meets-target' | 'below-target';
  target: number;
  targetAssessment: string;
  provenanceLabel: string;
  interpretations: string[];
  recommendations: string[];
  applicability?: string | null;
};

export type CapabilityGuidance = CapabilityGuidanceUnavailable | CapabilityGuidanceAvailable;

export function buildCapabilityGuidance(input: {
  mean: { setup: number; measured: number; delta: number };
  standardDeviation: { setup: number; measured: number; relativeChange: number };
  cp: { setup: number; measured: number; delta: number };
  cpk: { setup: number; measured: number; delta: number };
  ruleResult: PublicEngineeringRuleResult | null | undefined;
}): CapabilityGuidance {
  const { mean, standardDeviation, cp, cpk, ruleResult } = input;
  const values = [
    mean.setup,
    mean.measured,
    mean.delta,
    standardDeviation.setup,
    standardDeviation.measured,
    standardDeviation.relativeChange,
    cp.setup,
    cp.measured,
    cp.delta,
    cpk.setup,
    cpk.measured,
    cpk.delta,
  ];

  if (
    values.some((value) => !Number.isFinite(value))
    ||
    ruleResult?.status !== 'matched'
    || ruleResult.entry.ruleType !== 'cpk'
    || !Number.isFinite(ruleResult.entry.threshold)
    || ruleResult.entry.threshold <= 0
  ) {
    return {
      available: false,
      status: 'unavailable',
      targetAssessment: 'Rule unavailable or not applicable.',
      interpretations: [],
      recommendations: [],
    };
  }

  const entry = ruleResult.entry;
  const target = entry.threshold;

  const status = cpk.measured >= target ? 'meets-target' : 'below-target';
  const meanChanged = isDisplayedChange(mean.delta, 4);
  const variationChanged = isDisplayedChange(standardDeviation.relativeChange * 100, 1);
  const cpChanged = isDisplayedChange(cp.delta, 3);
  const cpkChanged = isDisplayedChange(cpk.delta, 3);

  const targetAssessment =
    status === 'meets-target'
      ? `Measured Cpk ${formatAgainstTarget(cpk.measured, target)} meets the F0 default target of ${target}.`
      : `Measured Cpk ${formatAgainstTarget(cpk.measured, target)} is below the F0 default target of ${target}.`;
  const meanInterpretation = !meanChanged
    ? `Mean matched the Factor Setup value at ${mean.measured.toFixed(4)}.`
    : `Mean shifted ${mean.delta > 0 ? 'higher' : 'lower'} from ${mean.setup.toFixed(4)} to ${mean.measured.toFixed(4)} (${formatSignedAdaptive(mean.delta, 4)}).`;
  const variationInterpretation = !variationChanged
    ? `Standard deviation matched the Factor Setup value at ${standardDeviation.measured.toFixed(4)}.`
    : `Standard deviation ${standardDeviation.relativeChange > 0 ? 'increased' : 'decreased'} from ${standardDeviation.setup.toFixed(4)} to ${standardDeviation.measured.toFixed(4)} (${formatSignedAdaptive(standardDeviation.relativeChange * 100, 1)}%).`;
  const cpInterpretation = !cpChanged
    ? `Cp matched the Factor Setup value at ${cp.measured.toFixed(3)}.`
    : `Cp ${cp.delta > 0 ? 'increased' : 'decreased'} from ${cp.setup.toFixed(3)} to ${cp.measured.toFixed(3)} (${formatSignedAdaptive(cp.delta, 3)})${cp.delta < 0 && standardDeviation.relativeChange > 0 ? ', indicating lower potential capability as variation increased' : ''}.`;
  const cpkInterpretation = !cpkChanged
    ? `Cpk matched the Factor Setup value at ${formatAgainstTarget(cpk.measured, target)} and ${targetResultText(status, target)}.`
    : `Cpk ${cpk.delta > 0 ? 'increased' : 'decreased'} from ${cpk.setup.toFixed(3)} to ${formatAgainstTarget(cpk.measured, target)} (${formatSignedAdaptive(cpk.delta, 3)}) and ${targetResultText(status, target)}.`;
  const recommendations: string[] = [];

  if (meanChanged) {
    recommendations.push('Review process centering against the Factor Setup mean before accepting the measured distribution.');
  } else if (cp.measured - cpk.measured >= 0.0005) {
    recommendations.push('Review sample centering relative to the specification limits because measured Cpk is lower than measured Cp.');
  }

  if (variationChanged) {
    if (standardDeviation.relativeChange > 0) {
      recommendations.push('Prioritize reducing and stabilizing within-factor variation, then confirm the improvement with a new representative sample.');
    } else {
      recommendations.push('Confirm the observed reduction in within-factor variation is repeatable with a new representative sample.');
    }
  }

  if ((cpChanged && cp.delta < 0) || (cpkChanged && cpk.delta < 0) || status === 'below-target') {
    recommendations.push('Recalculate Cp and Cpk after corrective action and compare measured Cpk with the F0 target.');
  }

  return {
    available: true,
    status,
    target,
    targetAssessment,
    provenanceLabel: `F0 ${ruleResult.knowledgeBaseVersion} / ${entry.ruleId}`,
    interpretations: [meanInterpretation, variationInterpretation, cpInterpretation, cpkInterpretation],
    recommendations,
    applicability: entry.applicability,
  };
}

function isDisplayedChange(value: number, digits: number): boolean {
  return Math.abs(value) >= 0.5 * 10 ** -digits;
}

function formatSignedAdaptive(value: number, minimumDigits: number): string {
  const absolute = Math.abs(value);
  let digits = minimumDigits;
  while (digits < 8 && Number(absolute.toFixed(digits)) === 0) digits += 1;
  return `${value >= 0 ? '+' : '-'}${absolute.toFixed(digits)}`;
}

function formatAgainstTarget(value: number, target: number): string {
  if (value === target) return value.toFixed(3);
  let digits = 3;
  while (digits < 8 && Number(value.toFixed(digits)) === target) digits += 1;
  if (Number(value.toFixed(digits)) === target) return `${value < target ? '<' : '>'} ${target}`;
  return value.toFixed(digits);
}

function targetResultText(status: CapabilityGuidanceAvailable['status'], target: number): string {
  return status === 'meets-target'
    ? `meets the F0 default target of ${target}`
    : `is below the F0 default target of ${target}`;
}

export default buildCapabilityGuidance;
