import { createHash } from "node:crypto";
import {
  F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS,
  F7_MEASUREMENT_IMPORT_MAX_FACTORS,
  F7_MEASUREMENT_IMPORT_TEMPLATE_CONTRACT_ID,
  createTypedError,
  f7FactorEvidenceSchema,
  f7MeasurementImportAuthoritySchema,
  f7MeasurementImportFactorManifestSchema,
  f7MeasurementImportManifestSchema,
  type F7FactorEvidence,
} from "@ai-assist/contracts";
import { z } from "zod";

const INPUT_REFERENCE = "f7-measurement-template-input";
const INPUT_SUMMARY = "F7 measurement template authority input is invalid.";
const FACTOR_SET_DOMAIN = "f7-measurement-factor-set-v1";
const SESSION_STATE_DOMAIN = "f7-measurement-session-state-v1";
const AUTHORITY_DOMAIN = "f7-measurement-authority-v1";
const FACTOR_VALUE_DOMAIN = "f7-measurement-factor-values-v1";
const FACTOR_COORDINATE_DOMAIN = "f7-measurement-factor-coordinates-v1";
const FACTORS_DOMAIN = "f7-measurement-manifest-factors-v1";
const LOCKED_VALUES_DOMAIN = "f7-measurement-locked-values-v1";
const LOCKED_COORDINATES_DOMAIN = "f7-measurement-locked-coordinates-v1";

const FACTOR_ROW_MAP = Object.freeze({
  factorName: 2,
  partNumber: 3,
  dimId: 4,
  designNominal: 5,
  upperTolerance: 6,
  lowerTolerance: 7,
  lowerSpecLimit: 8,
  upperSpecLimit: 9,
  specificationSource: 10,
  limitStatus: 11,
  measurementStructure: 12,
  subgroupSize: 13,
  estimator: 14,
});

const MANIFEST_COORDINATES = Object.freeze({
  contractIdCell: "_F7_MANIFEST!B2",
  contractVersionCell: "_F7_MANIFEST!B3",
  templateIdCell: "_F7_MANIFEST!B4",
  workbookContentHashCell: "_F7_MANIFEST!B5",
  worksheetNameCell: "_F7_MANIFEST!B6",
  worksheetStableIdCell: "_F7_MANIFEST!B7",
  factorSetDigestCell: "_F7_MANIFEST!B8",
  factorsDigestCell: "_F7_MANIFEST!B9",
  lockedValueDigestCell: "_F7_MANIFEST!B10",
  lockedCoordinateDigestCell: "_F7_MANIFEST!B11",
  sessionStateDigestCell: "_F7_MANIFEST!B12",
  authorityDigestCell: "_F7_MANIFEST!B13",
  factorsStartRow: 16,
});

export const F7_MEASUREMENT_TEMPLATE_LAYOUT = Object.freeze({
  visibleSheetName: "Measurements",
  manifestSheetName: "_F7_MANIFEST",
  firstFactorColumn: 2,
  firstMeasurementRow: 15,
  measurementCapacity: F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS,
  lastMeasurementRow: 15 + F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS - 1,
  factorRows: FACTOR_ROW_MAP,
  manifest: MANIFEST_COORDINATES,
});

type F7SpecificationSource = "Worksheet" | "Derived";

type ParsedFactorEvidence = F7FactorEvidence & {
  readonly partNumber?: string;
  readonly dimId?: string;
  readonly specificationSource?: F7SpecificationSource;
};

type F7MeasurementImportFactorCoordinates = {
  readonly factorNameCell: string;
  readonly partNumberCell: string;
  readonly dimIdCell: string;
  readonly designNominalCell: string;
  readonly upperToleranceCell: string;
  readonly lowerToleranceCell: string;
  readonly lowerSpecLimitCell: string;
  readonly upperSpecLimitCell: string;
  readonly specificationSourceCell: string;
  readonly limitStatusCell: string;
  readonly measurementStructureCell: string;
  readonly subgroupSizeCell: string;
  readonly estimatorCell: string;
  readonly measurementColumn: string;
  readonly firstMeasurementCell: string;
};

type F7MeasurementImportFactorManifest = z.infer<typeof f7MeasurementImportFactorManifestSchema>;
type F7MeasurementImportManifest = z.infer<typeof f7MeasurementImportManifestSchema>;
export type F7MeasurementImportAuthority = z.infer<typeof f7MeasurementImportAuthoritySchema>;

export interface F7MeasurementImportAuthorityInput {
  readonly sessionId: string;
  readonly templateId: string;
  readonly workbookContentHash: string;
  readonly worksheetName: string;
  readonly worksheetStableId: string;
  readonly measurementImportRevision: number;
  readonly factors: readonly F7FactorEvidence[];
}

export interface F7MeasurementSessionStateInput {
  readonly templateId: string;
  readonly workbookContentHash: string;
  readonly worksheetStableId: string;
  readonly factorSetDigest: string;
  readonly measurementImportRevision: number;
}

const authorityInputSchema = z.object({
  sessionId: z.string().min(1),
  templateId: z.string().min(1),
  workbookContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  worksheetName: z.string().trim().min(1).max(300),
  worksheetStableId: z.string().min(1),
  measurementImportRevision: z.number().int().nonnegative(),
  factors: z.array(f7FactorEvidenceSchema).min(1).max(F7_MEASUREMENT_IMPORT_MAX_FACTORS),
}).strict();

const sessionStateInputSchema = z.object({
  templateId: z.string().min(1),
  workbookContentHash: z.string().regex(/^[a-f0-9]{64}$/),
  worksheetStableId: z.string().min(1),
  factorSetDigest: z.string().regex(/^[a-f0-9]{64}$/),
  measurementImportRevision: z.number().int().nonnegative(),
}).strict();

function requestError(summary: string): Error {
  return createTypedError({
    code: "validation_error",
    summary,
    suggestedAction: "Provide validated F7 factor evidence and stable workbook identity inputs.",
    affectedInputReferences: [INPUT_REFERENCE],
  });
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function normalizeNegativeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function canonicalNumber(value: number): string {
  return String(normalizeNegativeZero(value));
}

function canonicalOptionalString(value: string | undefined): string {
  if (value === undefined) return "";
  const trimmed = value.trim();
  return trimmed.length === 0 ? "" : trimmed;
}

function hashLengthPrefixed(domain: string, parts: readonly string[]): string {
  const hash = createHash("sha256");
  hash.update(domain, "utf8");
  hash.update("\n", "utf8");
  for (const part of parts) {
    hash.update(`${Buffer.byteLength(part, "utf8")}:`, "utf8");
    hash.update(part, "utf8");
    hash.update("|", "utf8");
  }
  return hash.digest("hex");
}

function nearlyEqualAtScale(left: number, right: number, scale: number): boolean {
  return Number.isFinite(left)
    && Number.isFinite(right)
    && Math.abs(left - right) <= Number.EPSILON * 64
      * Math.max(Math.abs(left), Math.abs(right), Math.abs(scale), 1);
}

function normalizedPhysicalSpecificationLimits(
  designNominal: number,
  lowerTolerance: number,
  upperTolerance: number,
): { readonly lower: number; readonly upper: number } {
  const lowerEndpoint = normalizeNegativeZero(designNominal + lowerTolerance);
  const upperEndpoint = normalizeNegativeZero(designNominal + upperTolerance);
  return {
    lower: lowerEndpoint <= 0 && upperEndpoint >= 0
      ? 0
      : Math.min(Math.abs(lowerEndpoint), Math.abs(upperEndpoint)),
    upper: Math.max(Math.abs(lowerEndpoint), Math.abs(upperEndpoint)),
  };
}

function columnLetters(columnNumber: number): string {
  let current = columnNumber;
  let result = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function specificationSource(value: F7SpecificationSource | undefined): F7SpecificationSource {
  return value ?? "Derived";
}

function validateFactorAlignment(
  authorityInput: z.infer<typeof authorityInputSchema>,
  factor: ParsedFactorEvidence,
): void {
  if (factor.workbookContentHash !== authorityInput.workbookContentHash) throw requestError(INPUT_SUMMARY);
  if (factor.worksheetName !== authorityInput.worksheetName) throw requestError(INPUT_SUMMARY);

  const lowerEndpoint = normalizeNegativeZero(factor.designNominal + factor.lowerTolerance);
  const upperEndpoint = normalizeNegativeZero(factor.designNominal + factor.upperTolerance);
  const crossesZero = Math.min(lowerEndpoint, upperEndpoint) <= 0 && Math.max(lowerEndpoint, upperEndpoint) >= 0;
  const scale = Math.max(Math.abs(lowerEndpoint), Math.abs(upperEndpoint), 1);
  const factorSource = specificationSource(factor.specificationSource);

  if (factorSource === "Worksheet") {
    if (crossesZero && !nearlyEqualAtScale(factor.lowerSpecLimit, 0, scale)) throw requestError(INPUT_SUMMARY);
    return;
  }

  const expectedLimits = normalizedPhysicalSpecificationLimits(
    factor.designNominal,
    factor.lowerTolerance,
    factor.upperTolerance,
  );

  if (crossesZero) {
    if (!nearlyEqualAtScale(factor.lowerSpecLimit, 0, scale)) throw requestError(INPUT_SUMMARY);
    if (!nearlyEqualAtScale(factor.upperSpecLimit, expectedLimits.upper, scale)) throw requestError(INPUT_SUMMARY);
    return;
  }

  if (!nearlyEqualAtScale(factor.lowerSpecLimit, expectedLimits.lower, scale)) throw requestError(INPUT_SUMMARY);
  if (!nearlyEqualAtScale(factor.upperSpecLimit, expectedLimits.upper, scale)) throw requestError(INPUT_SUMMARY);
}

function buildFactorCoordinates(column: string): F7MeasurementImportFactorCoordinates {
  return {
    factorNameCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}${FACTOR_ROW_MAP.factorName}`,
    partNumberCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}${FACTOR_ROW_MAP.partNumber}`,
    dimIdCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}${FACTOR_ROW_MAP.dimId}`,
    designNominalCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}${FACTOR_ROW_MAP.designNominal}`,
    upperToleranceCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}${FACTOR_ROW_MAP.upperTolerance}`,
    lowerToleranceCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}${FACTOR_ROW_MAP.lowerTolerance}`,
    lowerSpecLimitCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}${FACTOR_ROW_MAP.lowerSpecLimit}`,
    upperSpecLimitCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}${FACTOR_ROW_MAP.upperSpecLimit}`,
    specificationSourceCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}${FACTOR_ROW_MAP.specificationSource}`,
    limitStatusCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}${FACTOR_ROW_MAP.limitStatus}`,
    measurementStructureCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}${FACTOR_ROW_MAP.measurementStructure}`,
    subgroupSizeCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}${FACTOR_ROW_MAP.subgroupSize}`,
    estimatorCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}${FACTOR_ROW_MAP.estimator}`,
    measurementColumn: column,
    firstMeasurementCell: `${F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName}!${column}${F7_MEASUREMENT_TEMPLATE_LAYOUT.firstMeasurementRow}`,
  };
}

function hashProjectedFactorValues(factor: Omit<F7MeasurementImportFactorManifest, "immutableValueDigest" | "immutableCoordinateDigest">): string {
  return hashLengthPrefixed(FACTOR_VALUE_DOMAIN, [
    factor.factorId,
    factor.factorName,
    canonicalOptionalString(factor.partNumber),
    canonicalOptionalString(factor.dimId),
    factor.unit,
    canonicalNumber(factor.designNominal),
    canonicalNumber(factor.upperTolerance),
    canonicalNumber(factor.lowerTolerance),
    canonicalNumber(factor.lowerSpecLimit),
    canonicalNumber(factor.upperSpecLimit),
    factor.specificationSource,
    factor.limitStatus,
  ]);
}

function hashProjectedFactorCoordinates(factor: Omit<F7MeasurementImportFactorManifest, "immutableValueDigest" | "immutableCoordinateDigest">): string {
  const coordinates = factor.coordinates;
  return hashLengthPrefixed(FACTOR_COORDINATE_DOMAIN, [
    factor.factorId,
    coordinates.factorNameCell,
    coordinates.partNumberCell,
    coordinates.dimIdCell,
    coordinates.designNominalCell,
    coordinates.upperToleranceCell,
    coordinates.lowerToleranceCell,
    coordinates.lowerSpecLimitCell,
    coordinates.upperSpecLimitCell,
    coordinates.specificationSourceCell,
    coordinates.limitStatusCell,
    coordinates.measurementStructureCell,
    coordinates.subgroupSizeCell,
    coordinates.estimatorCell,
    coordinates.measurementColumn,
    coordinates.firstMeasurementCell,
  ]);
}

function hashLockedCoordinateValues(manifest: F7MeasurementImportManifest): string {
  return hashLengthPrefixed(LOCKED_COORDINATES_DOMAIN, [
    F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName,
    F7_MEASUREMENT_TEMPLATE_LAYOUT.manifestSheetName,
    MANIFEST_COORDINATES.contractIdCell,
    MANIFEST_COORDINATES.contractVersionCell,
    MANIFEST_COORDINATES.templateIdCell,
    MANIFEST_COORDINATES.workbookContentHashCell,
    MANIFEST_COORDINATES.worksheetNameCell,
    MANIFEST_COORDINATES.worksheetStableIdCell,
    MANIFEST_COORDINATES.factorSetDigestCell,
    MANIFEST_COORDINATES.factorsDigestCell,
    MANIFEST_COORDINATES.lockedValueDigestCell,
    MANIFEST_COORDINATES.lockedCoordinateDigestCell,
    MANIFEST_COORDINATES.sessionStateDigestCell,
    MANIFEST_COORDINATES.authorityDigestCell,
    String(MANIFEST_COORDINATES.factorsStartRow),
    ...manifest.factors.flatMap((factor) => [factor.factorId, factor.immutableCoordinateDigest]),
  ]);
}

function projectManifestFactor(factor: ParsedFactorEvidence, index: number): F7MeasurementImportFactorManifest {
  const column = columnLetters(F7_MEASUREMENT_TEMPLATE_LAYOUT.firstFactorColumn + index);
  const factorSource = specificationSource(factor.specificationSource);
  const lowerEndpoint = normalizeNegativeZero(factor.designNominal + factor.lowerTolerance);
  const upperEndpoint = normalizeNegativeZero(factor.designNominal + factor.upperTolerance);
  const limitStatus = Math.min(lowerEndpoint, upperEndpoint) <= 0 && Math.max(lowerEndpoint, upperEndpoint) >= 0
    ? "CROSSES_ZERO" as const
    : "VALID" as const;
  const projected = {
    factorId: factor.factorId,
    factorName: factor.factorName,
    ...(canonicalOptionalString(factor.partNumber).length === 0 ? {} : { partNumber: canonicalOptionalString(factor.partNumber) }),
    ...(canonicalOptionalString(factor.dimId).length === 0 ? {} : { dimId: canonicalOptionalString(factor.dimId) }),
    unit: factor.unit,
    designNominal: normalizeNegativeZero(factor.designNominal),
    upperTolerance: normalizeNegativeZero(factor.upperTolerance),
    lowerTolerance: normalizeNegativeZero(factor.lowerTolerance),
    lowerSpecLimit: normalizeNegativeZero(factor.lowerSpecLimit),
    upperSpecLimit: normalizeNegativeZero(factor.upperSpecLimit),
    specificationSource: factorSource,
    limitStatus,
    coordinates: buildFactorCoordinates(column),
  };
  return {
    ...projected,
    immutableValueDigest: hashProjectedFactorValues(projected),
    immutableCoordinateDigest: hashProjectedFactorCoordinates(projected),
  };
}

export function hashF7MeasurementFactorSet(factorsInput: readonly F7FactorEvidence[]): string {
  const factors = z.array(f7FactorEvidenceSchema).min(1).max(F7_MEASUREMENT_IMPORT_MAX_FACTORS).parse(factorsInput) as readonly ParsedFactorEvidence[];
  return hashLengthPrefixed(FACTOR_SET_DOMAIN, factors.flatMap((factor) => [
    factor.factorId,
    factor.factorName,
    factor.unit,
    canonicalNumber(factor.designNominal),
    canonicalNumber(factor.upperTolerance),
    canonicalNumber(factor.lowerTolerance),
    canonicalNumber(factor.lowerSpecLimit),
    canonicalNumber(factor.upperSpecLimit),
    specificationSource(factor.specificationSource),
  ]));
}

export function hashF7MeasurementSessionState(input: F7MeasurementSessionStateInput): string {
  const parsed = sessionStateInputSchema.safeParse(input);
  if (!parsed.success) throw requestError(INPUT_SUMMARY);
  return hashLengthPrefixed(SESSION_STATE_DOMAIN, [
    F7_MEASUREMENT_IMPORT_TEMPLATE_CONTRACT_ID,
    "1",
    parsed.data.templateId,
    parsed.data.workbookContentHash,
    parsed.data.worksheetStableId,
    parsed.data.factorSetDigest,
    String(parsed.data.measurementImportRevision),
  ]);
}

export function createF7MeasurementImportAuthority(input: F7MeasurementImportAuthorityInput): F7MeasurementImportAuthority {
  const parsed = authorityInputSchema.safeParse(input);
  if (!parsed.success) throw requestError(INPUT_SUMMARY);

  const factors = parsed.data.factors as readonly ParsedFactorEvidence[];

  for (const factor of factors) validateFactorAlignment(parsed.data, factor);

  const manifestFactors = factors.map((factor, index) => projectManifestFactor(factor, index));
  const factorSetDigest = hashF7MeasurementFactorSet(factors);
  const factorsDigest = hashLengthPrefixed(FACTORS_DOMAIN, manifestFactors.flatMap((factor) => [
    factor.factorId,
    factor.immutableValueDigest,
    factor.immutableCoordinateDigest,
  ]));
  const lockedValueDigest = hashLengthPrefixed(LOCKED_VALUES_DOMAIN, [
    F7_MEASUREMENT_IMPORT_TEMPLATE_CONTRACT_ID,
    "1",
    parsed.data.templateId,
    parsed.data.workbookContentHash,
    parsed.data.worksheetName,
    ...manifestFactors.flatMap((factor) => [factor.factorId, factor.immutableValueDigest]),
  ]);
  const sessionStateDigest = hashF7MeasurementSessionState({
    templateId: parsed.data.templateId,
    workbookContentHash: parsed.data.workbookContentHash,
    worksheetStableId: parsed.data.worksheetStableId,
    factorSetDigest,
    measurementImportRevision: parsed.data.measurementImportRevision,
  });

  const manifest = {
    contractId: F7_MEASUREMENT_IMPORT_TEMPLATE_CONTRACT_ID,
    contractVersion: 1 as const,
    templateId: parsed.data.templateId,
    workbookContentHash: parsed.data.workbookContentHash,
    worksheetName: parsed.data.worksheetName,
    worksheetStableId: parsed.data.worksheetStableId,
    factorSetDigest,
    factorsDigest,
    lockedValueDigest,
    lockedCoordinateDigest: "",
    factors: manifestFactors,
  } satisfies F7MeasurementImportManifest;

  const lockedCoordinateDigest = hashLockedCoordinateValues(manifest);

  const authority = {
    sessionId: parsed.data.sessionId,
    sessionStateDigest,
    authorityDigest: "",
    manifest: {
      ...manifest,
      lockedCoordinateDigest,
    },
  } satisfies F7MeasurementImportAuthority;

  authority.authorityDigest = hashLengthPrefixed(AUTHORITY_DOMAIN, [
    authority.sessionId,
    authority.sessionStateDigest,
    authority.manifest.contractId,
    String(authority.manifest.contractVersion),
    authority.manifest.templateId,
    authority.manifest.workbookContentHash,
    authority.manifest.worksheetName,
    authority.manifest.worksheetStableId,
    authority.manifest.factorSetDigest,
    authority.manifest.factorsDigest,
    authority.manifest.lockedValueDigest,
    authority.manifest.lockedCoordinateDigest,
  ]);

  const result = f7MeasurementImportAuthoritySchema.safeParse(authority);
  if (!result.success) throw requestError(INPUT_SUMMARY);
  return deepFreeze(structuredClone(result.data));
}