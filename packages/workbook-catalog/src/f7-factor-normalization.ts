import { createTypedError } from "@ai-assist/contracts";

export interface F7FactorNormalizationInput {
  readonly excelSignedMean: number;
  readonly loopCoefficient: -1 | 1;
  readonly standardDeviation: number;
}

export interface F7FactorNormalizationResult {
  readonly physicalMean: number;
  readonly signedContributionMean: number;
}

const INPUT_SUMMARY = "F7 factor input is invalid.";
const DIRECTION_SUMMARY = "F7 factor direction is inconsistent with the Excel contribution mean.";
const SUGGESTED_ACTION = "Provide finite factor statistics, a positive standard deviation, and a valid loop direction coefficient.";
const INPUT_REFERENCE = "f7-factor-normalization-input";

function invalidInputError(summary: string): Error {
  return createTypedError({
    code: "validation_error",
    summary,
    suggestedAction: SUGGESTED_ACTION,
    affectedInputReferences: [INPUT_REFERENCE],
  });
}

function normalizeNegativeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeF7Factor(input: F7FactorNormalizationInput): F7FactorNormalizationResult {
  const { excelSignedMean, loopCoefficient, standardDeviation } = input;

  if (!isFiniteNumber(excelSignedMean)) throw invalidInputError(INPUT_SUMMARY);
  if (!isFiniteNumber(standardDeviation) || standardDeviation <= 0) throw invalidInputError(INPUT_SUMMARY);
  if (loopCoefficient !== -1 && loopCoefficient !== 1) throw invalidInputError(INPUT_SUMMARY);

  const signedContributionMean = normalizeNegativeZero(excelSignedMean);
  const physicalMean = normalizeNegativeZero(loopCoefficient * signedContributionMean);
  if (physicalMean < 0) throw invalidInputError(DIRECTION_SUMMARY);

  return Object.freeze({
    physicalMean,
    signedContributionMean,
  });
}