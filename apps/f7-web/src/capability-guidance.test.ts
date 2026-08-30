import { test, expect } from 'vitest';
import { getPublicEngineeringRule } from '@ai-assist/knowledge-base/public-engineering-rules';
import { buildCapabilityGuidance } from './capability-guidance';

test('below target guidance', () => {
  const rule = getPublicEngineeringRule({ ruleId: 'default-cpk-target' });
  const input = {
    mean: { setup: 0.57, measured: 0.5767, delta: 0.0067 },
    standardDeviation: { setup: 0.0125, measured: 0.0155, relativeChange: 0.239 },
    cp: { setup: 1.333, measured: 1.077, delta: -0.256 },
    cpk: { setup: 1.333, measured: 0.931, delta: -0.402 },
    ruleResult: rule,
  };

  const out = buildCapabilityGuidance(input);

  if (!out.available) throw new Error('expected available guidance');
  expect(out.target).toBe(1.33);
  expect(out.status).toBe('below-target');
  expect(out.interpretations).toEqual([
    'Mean shifted higher from 0.5700 to 0.5767 (+0.0067).',
    'Standard deviation increased from 0.0125 to 0.0155 (+23.9%).',
    'Cp decreased from 1.333 to 1.077 (-0.256), indicating lower potential capability as variation increased.',
    'Cpk decreased from 1.333 to 0.931 (-0.402) and is below the F0 default target of 1.33.',
  ]);
  expect(out.recommendations).toEqual([
    'Review process centering against the Factor Setup mean before accepting the measured distribution.',
    'Prioritize reducing and stabilizing within-factor variation, then confirm the improvement with a new representative sample.',
    'Recalculate Cp and Cpk after corrective action and compare measured Cpk with the F0 target.',
  ]);
  expect(JSON.stringify(out)).not.toContain('Contributor');
});

test('meets target guidance', () => {
  const rule = getPublicEngineeringRule({ ruleId: 'default-cpk-target' });
  const input = {
    mean: { setup: 10, measured: 9.99, delta: -0.01 },
    standardDeviation: { setup: 0.5, measured: 0.49, relativeChange: -0.02 },
    cp: { setup: 1.4, measured: 1.42, delta: 0.02 },
    cpk: { setup: 1.35, measured: 1.33, delta: -0.02 },
    ruleResult: rule,
  };

  const out = buildCapabilityGuidance(input);
  if (!out.available) throw new Error('expected available guidance');
  expect(out.target).toBe(1.33);
  expect(out.status).toBe('meets-target');
  expect(out.interpretations).toHaveLength(4);
  expect(out.recommendations.some((recommendation) => /confirm.*repeatable/i.test(recommendation))).toBe(true);
});

test('unknown rule unavailable', () => {
  const rule = getPublicEngineeringRule({ ruleId: 'no-such-rule' });
  const input = {
    mean: { setup: 0, measured: 0, delta: 0 },
    standardDeviation: { setup: 1, measured: 1, relativeChange: 0 },
    cp: { setup: 1, measured: 1, delta: 0 },
    cpk: { setup: 0.5, measured: 0.5, delta: 0 },
    ruleResult: rule,
  };

  const out = buildCapabilityGuidance(input);
  expect(out.available).toBe(false);
  expect(out.status).toBe('unavailable');
});

test('shows enough precision to distinguish a value just below target', () => {
  const out = buildCapabilityGuidance({
    mean: { setup: 0, measured: 0, delta: 0 },
    standardDeviation: { setup: 1, measured: 1, relativeChange: 0 },
    cp: { setup: 1.4, measured: 1.4, delta: 0 },
    cpk: { setup: 1.33, measured: 1.329, delta: -0.001 },
    ruleResult: getPublicEngineeringRule({ ruleId: 'default-cpk-target' }),
  });

  if (!out.available) throw new Error('expected available guidance');
  expect(out.status).toBe('below-target');
  expect(out.targetAssessment).toBe('Measured Cpk 1.329 is below the F0 default target of 1.33.');
});

test('uses adaptive precision when fixed rounding would make a below-target result look equal', () => {
  const out = buildCapabilityGuidance({
    mean: { setup: 0, measured: 0, delta: 0 },
    standardDeviation: { setup: 1, measured: 1, relativeChange: 0 },
    cp: { setup: 1.4, measured: 1.4, delta: 0 },
    cpk: { setup: 1.33, measured: 1.3299, delta: -0.0001 },
    ruleResult: getPublicEngineeringRule({ ruleId: 'default-cpk-target' }),
  });

  if (!out.available) throw new Error('expected available guidance');
  expect(out.targetAssessment).toBe('Measured Cpk 1.3299 is below the F0 default target of 1.33.');
  expect(out.interpretations[3]).not.toContain('(-0.000)');
});

test('uses a relation fallback when a below-target value cannot be distinguished at display precision', () => {
  const out = buildCapabilityGuidance({
    mean: { setup: 0, measured: 0, delta: 0 },
    standardDeviation: { setup: 1, measured: 1, relativeChange: 0 },
    cp: { setup: 1.4, measured: 1.4, delta: 0 },
    cpk: { setup: 1.33, measured: 1.33 - 1e-10, delta: -1e-10 },
    ruleResult: getPublicEngineeringRule({ ruleId: 'default-cpk-target' }),
  });

  if (!out.available) throw new Error('expected available guidance');
  expect(out.targetAssessment).toBe('Measured Cpk < 1.33 is below the F0 default target of 1.33.');
  expect(out.interpretations[3]).toContain('Cpk matched the Factor Setup value at < 1.33');
});

test('does not recommend centering for display-negligible mean differences', () => {
  const out = buildCapabilityGuidance({
    mean: { setup: 0.57, measured: 0.57001, delta: 0.00001 },
    standardDeviation: { setup: 0.0125, measured: 0.0125, relativeChange: 0 },
    cp: { setup: 1.4, measured: 1.4, delta: 0 },
    cpk: { setup: 1.35, measured: 1.35, delta: 0 },
    ruleResult: getPublicEngineeringRule({ ruleId: 'default-cpk-target' }),
  });

  if (!out.available) throw new Error('expected available guidance');
  expect(out.interpretations[0]).toBe('Mean matched the Factor Setup value at 0.5700.');
  expect(out.recommendations.some((recommendation) => /Factor Setup mean/i.test(recommendation))).toBe(false);
});

test('uses the Cp-Cpk gap to review specification centering without contradicting a matching setup mean', () => {
  const out = buildCapabilityGuidance({
    mean: { setup: 0.57, measured: 0.57, delta: 0 },
    standardDeviation: { setup: 0.0125, measured: 0.0125, relativeChange: 0 },
    cp: { setup: 1.4, measured: 1.4, delta: 0 },
    cpk: { setup: 1.3, measured: 1.2, delta: -0.1 },
    ruleResult: getPublicEngineeringRule({ ruleId: 'default-cpk-target' }),
  });

  if (!out.available) throw new Error('expected available guidance');
  expect(out.recommendations).toContain(
    'Review sample centering relative to the specification limits because measured Cpk is lower than measured Cp.',
  );
  expect(out.recommendations.some((recommendation) => /Factor Setup mean/i.test(recommendation))).toBe(false);
});

test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
  'returns unavailable for non-finite measured Cpk %s',
  (measuredCpk) => {
    const out = buildCapabilityGuidance({
      mean: { setup: 0, measured: 0, delta: 0 },
      standardDeviation: { setup: 1, measured: 1, relativeChange: 0 },
      cp: { setup: 1, measured: 1, delta: 0 },
      cpk: { setup: 1, measured: measuredCpk, delta: 0 },
      ruleResult: getPublicEngineeringRule({ ruleId: 'default-cpk-target' }),
    });

    expect(out.available).toBe(false);
    expect(out.status).toBe('unavailable');
  },
);
