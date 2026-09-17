import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS,
  F7_MEASUREMENT_IMPORT_MAX_FACTORS,
  F7_MEASUREMENT_IMPORT_TEMPLATE_CONTRACT_ID,
  f7MeasurementImportAuthoritySchema,
  type F7FactorEvidence,
} from "@ai-assist/contracts";
import {
  F7_MEASUREMENT_TEMPLATE_LAYOUT,
  createF7MeasurementImportAuthority,
  hashF7MeasurementFactorSet,
  hashF7MeasurementSessionState,
  type F7MeasurementImportAuthorityInput,
} from "./f7-measurement-template.js";

const WORKBOOK_HASH = "a".repeat(64);
const WORKBOOK_HASH_2 = "b".repeat(64);
const TEMPLATE_ID = "template-opaque-001";
const WORKSHEET_NAME = "Anonymous_TA";
const WORKSHEET_STABLE_ID = "worksheet-stable-001";
const WORKSHEET_STABLE_ID_2 = "worksheet-stable-002";
const SESSION_ID = "session-1";
const LOCKED_COORDINATE_DOMAIN = "f7-measurement-locked-coordinates-v1";

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

function makeFactor(overrides: Partial<F7FactorEvidence> = {}): F7FactorEvidence {
  const base: F7FactorEvidence = {
    workbookContentHash: WORKBOOK_HASH,
    worksheetName: WORKSHEET_NAME,
    tableId: "table-1",
    sourceRow: 14,
    sourceCells: {
      factorName: `${WORKSHEET_NAME}!G14`,
      distribution: `${WORKSHEET_NAME}!Q14`,
      excelSignedMean: `${WORKSHEET_NAME}!R14`,
      standardDeviation: `${WORKSHEET_NAME}!T14`,
      factorLowerSpecLimit: `${WORKSHEET_NAME}!J14`,
      factorUpperSpecLimit: `${WORKSHEET_NAME}!K14`,
      lowerSpecLimit: `${WORKSHEET_NAME}!J14`,
      upperSpecLimit: `${WORKSHEET_NAME}!K14`,
    },
    factorCandidateId: "1".repeat(64),
    factorId: "2".repeat(64),
    factorName: "Fabric thickness",
    partNumber: "PN-001",
    dimId: "DIM-001",
    unit: "mm",
    unitSource: "user_confirmed",
    designNominal: 0.57,
    upperTolerance: 0.15,
    lowerTolerance: -0.05,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "Normal",
    calculatedMean: 0.62,
    tolerance: 0.1,
    oneSigma: 0.025,
    percentContributionToSigma: 1,
    loopCoefficient: 1,
    physicalMean: 0.62,
    signedContributionMean: 0.62,
    baselineSampler: {
      samplerId: "NORMAL_LOCATION_SCALE_V1",
      physicalMean: 0.62,
      standardDeviation: 0.025,
      support: "REAL",
    },
    specificationSource: "Worksheet",
    lowerSpecLimit: 0.52,
    upperSpecLimit: 0.72,
  };

  return {
    ...base,
    ...overrides,
    sourceCells: {
      ...base.sourceCells,
      ...(overrides.sourceCells ?? {}),
    },
    baselineSampler: {
      ...base.baselineSampler,
      ...(overrides.baselineSampler ?? {}),
    },
  };
}

function makeInput(
  overrides: Partial<F7MeasurementImportAuthorityInput> = {},
): F7MeasurementImportAuthorityInput {
  return {
    sessionId: SESSION_ID,
    templateId: TEMPLATE_ID,
    workbookContentHash: WORKBOOK_HASH,
    worksheetName: WORKSHEET_NAME,
    worksheetStableId: WORKSHEET_STABLE_ID,
    measurementImportRevision: 0,
    factors: [
      makeFactor(),
      makeFactor({
        factorCandidateId: "3".repeat(64),
        factorId: "4".repeat(64),
        factorName: "C-cover height",
        partNumber: "PN-002",
        dimId: "DIM-002",
        designNominal: -0.05,
        upperTolerance: 0.1,
        lowerTolerance: -0.1,
        calculatedMean: -0.05,
        physicalMean: 0.05,
        signedContributionMean: -0.05,
        loopCoefficient: -1,
        lowerSpecLimit: 0,
        upperSpecLimit: 0.15,
        baselineSampler: {
          samplerId: "NORMAL_LOCATION_SCALE_V1",
          physicalMean: 0.05,
          standardDeviation: 0.025,
          support: "REAL",
        },
        sourceRow: 15,
      }),
    ],
    ...overrides,
  };
}

function makeManyFactors(count: number): F7FactorEvidence[] {
  return Array.from({ length: count }, (_, index) => makeFactor({
    factorCandidateId: `${(index + 1).toString(16).padStart(64, "0")}`.slice(-64),
    factorId: `${(index + 101).toString(16).padStart(64, "0")}`.slice(-64),
    factorName: `Factor ${index + 1}`,
    sourceRow: 14 + index,
    tableId: `table-${index + 1}`,
    partNumber: `PN-${index + 1}`,
    dimId: `DIM-${index + 1}`,
  }));
}

describe("F7 measurement template authority", () => {
  it("exposes a frozen deterministic layout with reserved 500-row measurement capacity", () => {
    expect(Object.isFrozen(F7_MEASUREMENT_TEMPLATE_LAYOUT)).toBe(true);
    expect(F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName).toBe("Measurements");
    expect(F7_MEASUREMENT_TEMPLATE_LAYOUT.manifestSheetName).toBe("_F7_MANIFEST");
    expect(F7_MEASUREMENT_TEMPLATE_LAYOUT.firstFactorColumn).toBe(2);
    expect(F7_MEASUREMENT_TEMPLATE_LAYOUT.measurementCapacity).toBe(F7_DISTRIBUTION_FIT_MAX_OBSERVATIONS);
    expect(F7_MEASUREMENT_TEMPLATE_LAYOUT.measurementCapacity).toBe(500);
    expect(F7_MEASUREMENT_TEMPLATE_LAYOUT.firstMeasurementRow).toBe(15);
    expect(F7_MEASUREMENT_TEMPLATE_LAYOUT.lastMeasurementRow).toBe(514);
    expect(F7_MEASUREMENT_TEMPLATE_LAYOUT.factorRows).toEqual({
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
    expect(F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest).toEqual({
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
  });

  it("uses the public contracts exports and keeps the source free of deep contracts imports", () => {
    const source = readFileSync(fileURLToPath(new URL("./f7-measurement-template.ts", import.meta.url)), "utf8");

    expect(F7_MEASUREMENT_IMPORT_TEMPLATE_CONTRACT_ID).toBe("f7-measurement-import-template-v1");
    expect(F7_MEASUREMENT_IMPORT_MAX_FACTORS).toBe(100);
    expect(f7MeasurementImportAuthoritySchema).toBeDefined();
    expect(source).not.toContain("../../contracts/src/f7-contracts.js");
    expect(source).not.toContain("unknown as");
  });

  it("includes every immutable manifest coordinate in the locked-coordinate digest", () => {
    const authority = createF7MeasurementImportAuthority(makeInput());
    const expectedLockedCoordinateDigest = hashLengthPrefixed(LOCKED_COORDINATE_DOMAIN, [
      F7_MEASUREMENT_TEMPLATE_LAYOUT.visibleSheetName,
      F7_MEASUREMENT_TEMPLATE_LAYOUT.manifestSheetName,
      F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest.contractIdCell,
      F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest.contractVersionCell,
      F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest.templateIdCell,
      F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest.workbookContentHashCell,
      F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest.worksheetNameCell,
      F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest.worksheetStableIdCell,
      F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest.factorSetDigestCell,
      F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest.factorsDigestCell,
      F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest.lockedValueDigestCell,
      F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest.lockedCoordinateDigestCell,
      F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest.sessionStateDigestCell,
      F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest.authorityDigestCell,
      String(F7_MEASUREMENT_TEMPLATE_LAYOUT.manifest.factorsStartRow),
      ...authority.manifest.factors.flatMap((factor) => [factor.factorId, factor.immutableCoordinateDigest]),
    ]);

    expect(authority.manifest.lockedCoordinateDigest).toBe(expectedLockedCoordinateDigest);
  });

  it("rejects more than 100 factors in the hash helper and authority creator", () => {
    const hundredOneFactors = makeManyFactors(F7_MEASUREMENT_IMPORT_MAX_FACTORS + 1);

    expect(() => hashF7MeasurementFactorSet(hundredOneFactors)).toThrow();
    expect(() => createF7MeasurementImportAuthority(makeInput({ factors: hundredOneFactors }))).toThrow();
  });

  it("builds a valid authority with factor columns starting at B in evidence order", () => {
    const authority = createF7MeasurementImportAuthority(makeInput());

    expect(f7MeasurementImportAuthoritySchema.parse(authority)).toEqual(authority);
    expect(Object.isFrozen(authority)).toBe(true);
    expect(Object.isFrozen(authority.manifest)).toBe(true);
    expect(Object.isFrozen(authority.manifest.factors)).toBe(true);

    const [firstFactor, secondFactor] = authority.manifest.factors;
    expect(firstFactor?.coordinates.factorNameCell).toBe("Measurements!B2");
    expect(firstFactor?.coordinates.partNumberCell).toBe("Measurements!B3");
    expect(firstFactor?.coordinates.dimIdCell).toBe("Measurements!B4");
    expect(firstFactor?.coordinates.designNominalCell).toBe("Measurements!B5");
    expect(firstFactor?.coordinates.upperToleranceCell).toBe("Measurements!B6");
    expect(firstFactor?.coordinates.lowerToleranceCell).toBe("Measurements!B7");
    expect(firstFactor?.coordinates.lowerSpecLimitCell).toBe("Measurements!B8");
    expect(firstFactor?.coordinates.upperSpecLimitCell).toBe("Measurements!B9");
    expect(firstFactor?.coordinates.specificationSourceCell).toBe("Measurements!B10");
    expect(firstFactor?.coordinates.limitStatusCell).toBe("Measurements!B11");
    expect(firstFactor?.coordinates.measurementStructureCell).toBe("Measurements!B12");
    expect(firstFactor?.coordinates.subgroupSizeCell).toBe("Measurements!B13");
    expect(firstFactor?.coordinates.estimatorCell).toBe("Measurements!B14");
    expect(firstFactor?.coordinates.measurementColumn).toBe("B");
    expect(firstFactor?.coordinates.firstMeasurementCell).toBe(`Measurements!B${F7_MEASUREMENT_TEMPLATE_LAYOUT.firstMeasurementRow}`);
    expect(secondFactor?.coordinates.measurementColumn).toBe("C");
    expect(secondFactor?.coordinates.factorNameCell).toBe("Measurements!C2");
    expect(authority.manifest.factors.map((factor) => factor.factorId)).toEqual([
      "2".repeat(64),
      "4".repeat(64),
    ]);
  });

  it("projects cross-zero versus valid limit status without manufacturing optional identifiers", () => {
    const authority = createF7MeasurementImportAuthority(makeInput({
      factors: [
        makeFactor({ partNumber: undefined, dimId: undefined, specificationSource: undefined }),
        makeFactor({
          factorCandidateId: "3".repeat(64),
          factorId: "4".repeat(64),
          factorName: "Cross-zero gap",
          designNominal: -0.05,
          upperTolerance: 0.1,
          lowerTolerance: -0.1,
          calculatedMean: -0.05,
          physicalMean: 0.05,
          signedContributionMean: -0.05,
          loopCoefficient: -1,
          lowerSpecLimit: 0,
          upperSpecLimit: 0.15,
          specificationSource: undefined,
          partNumber: undefined,
          dimId: undefined,
          baselineSampler: {
            samplerId: "NORMAL_LOCATION_SCALE_V1",
            physicalMean: 0.05,
            standardDeviation: 0.025,
            support: "REAL",
          },
          sourceRow: 15,
        }),
      ],
    }));

    const [validFactor, crossZeroFactor] = authority.manifest.factors;
    expect(validFactor?.limitStatus).toBe("VALID");
    expect(validFactor && "partNumber" in validFactor).toBe(false);
    expect(validFactor && "dimId" in validFactor).toBe(false);
    expect(validFactor?.specificationSource).toBe("Derived");
    expect(crossZeroFactor?.limitStatus).toBe("CROSSES_ZERO");
    expect(crossZeroFactor?.lowerSpecLimit).toBe(0);
    expect(crossZeroFactor?.upperSpecLimit).toBe(0.15);
    expect(crossZeroFactor?.specificationSource).toBe("Derived");
  });

  it("accepts worksheet authoritative non-crossing factor limits that differ from derived endpoints", () => {
    const authority = createF7MeasurementImportAuthority(makeInput({
      factors: [
        makeFactor({
          designNominal: 10,
          lowerTolerance: -2,
          upperTolerance: 4,
          calculatedMean: 11,
          physicalMean: 11,
          signedContributionMean: 11,
          loopCoefficient: 1,
          baselineSampler: {
            samplerId: "NORMAL_LOCATION_SCALE_V1",
            physicalMean: 11,
            standardDeviation: 0.025,
            support: "REAL",
          },
          lowerSpecLimit: 9,
          upperSpecLimit: 20,
          specificationSource: "Worksheet",
        }),
      ],
    }));

    const [factor] = authority.manifest.factors;
    expect(factor?.specificationSource).toBe("Worksheet");
    expect(factor?.limitStatus).toBe("VALID");
    expect(factor?.lowerSpecLimit).toBe(9);
    expect(factor?.upperSpecLimit).toBe(20);
  });

  it("accepts worksheet cross-zero factor limits when the authoritative lower limit is zero", () => {
    const authority = createF7MeasurementImportAuthority(makeInput({
      factors: [
        makeFactor({
          designNominal: -2,
          lowerTolerance: -3,
          upperTolerance: 7,
          calculatedMean: -4,
          physicalMean: 4,
          signedContributionMean: -4,
          loopCoefficient: -1,
          baselineSampler: {
            samplerId: "NORMAL_LOCATION_SCALE_V1",
            physicalMean: 4,
            standardDeviation: 0.025,
            support: "REAL",
          },
          lowerSpecLimit: 0,
          upperSpecLimit: 15,
          specificationSource: "Worksheet",
        }),
      ],
    }));

    const [factor] = authority.manifest.factors;
    expect(factor?.specificationSource).toBe("Worksheet");
    expect(factor?.limitStatus).toBe("CROSSES_ZERO");
    expect(factor?.lowerSpecLimit).toBe(0);
    expect(factor?.upperSpecLimit).toBe(15);
  });

  it("rejects worksheet cross-zero factor limits when the authoritative lower limit is above zero", () => {
    expect(() => createF7MeasurementImportAuthority(makeInput({
      factors: [
        makeFactor({
          designNominal: -2,
          lowerTolerance: -3,
          upperTolerance: 7,
          calculatedMean: -4,
          physicalMean: 4,
          signedContributionMean: -4,
          loopCoefficient: -1,
          baselineSampler: {
            samplerId: "NORMAL_LOCATION_SCALE_V1",
            physicalMean: 4,
            standardDeviation: 0.025,
            support: "REAL",
          },
          lowerSpecLimit: 0.01,
          upperSpecLimit: 15,
          specificationSource: "Worksheet",
        }),
      ],
    }))).toThrow("F7 measurement template authority input is invalid.");
  });

  it("creates stable domain-separated digests and identical input yields identical authority", () => {
    const input = makeInput();
    const first = createF7MeasurementImportAuthority(input);
    const second = createF7MeasurementImportAuthority(input);
    const factorSetDigest = hashF7MeasurementFactorSet(input.factors);
    const sessionStateDigest = hashF7MeasurementSessionState({
      templateId: input.templateId,
      workbookContentHash: input.workbookContentHash,
      worksheetStableId: input.worksheetStableId,
      factorSetDigest,
      measurementImportRevision: input.measurementImportRevision,
    });

    expect(first).toEqual(second);
    expect(first.manifest.factorSetDigest).toBe(factorSetDigest);
    expect(first.sessionStateDigest).toBe(sessionStateDigest);
    expect(first.authorityDigest).not.toBe(first.sessionStateDigest);
    expect(first.authorityDigest).not.toBe(first.manifest.factorSetDigest);
    expect(first.manifest.factorsDigest).not.toBe(first.manifest.factorSetDigest);
    expect(first.manifest.lockedValueDigest).not.toBe(first.manifest.lockedCoordinateDigest);
  });

  it("changes factor-set digest when factor order, unit, or specifications change", () => {
    const base = makeInput();
    const reversedDigest = hashF7MeasurementFactorSet([...base.factors].reverse());
    const unitDigest = hashF7MeasurementFactorSet([
      makeFactor({ unit: "um" }),
      base.factors[1]!,
    ]);
    const lowerSpecDigest = hashF7MeasurementFactorSet([
      makeFactor({ lowerSpecLimit: 0.51 }),
      base.factors[1]!,
    ]);

    expect(reversedDigest).not.toBe(hashF7MeasurementFactorSet(base.factors));
    expect(unitDigest).not.toBe(hashF7MeasurementFactorSet(base.factors));
    expect(lowerSpecDigest).not.toBe(hashF7MeasurementFactorSet(base.factors));
  });

  it("changes session-state digest when workbook, worksheet identity, factor-set, or revision change", () => {
    const base = makeInput();
    const factorSetDigest = hashF7MeasurementFactorSet(base.factors);
    const changedFactorSetDigest = hashF7MeasurementFactorSet([...base.factors].reverse());
    const baseDigest = hashF7MeasurementSessionState({
      templateId: base.templateId,
      workbookContentHash: base.workbookContentHash,
      worksheetStableId: base.worksheetStableId,
      factorSetDigest,
      measurementImportRevision: base.measurementImportRevision,
    });

    expect(hashF7MeasurementSessionState({
      templateId: base.templateId,
      workbookContentHash: WORKBOOK_HASH_2,
      worksheetStableId: base.worksheetStableId,
      factorSetDigest,
      measurementImportRevision: base.measurementImportRevision,
    })).not.toBe(baseDigest);
    expect(hashF7MeasurementSessionState({
      templateId: base.templateId,
      workbookContentHash: base.workbookContentHash,
      worksheetStableId: WORKSHEET_STABLE_ID_2,
      factorSetDigest,
      measurementImportRevision: base.measurementImportRevision,
    })).not.toBe(baseDigest);
    expect(hashF7MeasurementSessionState({
      templateId: base.templateId,
      workbookContentHash: base.workbookContentHash,
      worksheetStableId: base.worksheetStableId,
      factorSetDigest: changedFactorSetDigest,
      measurementImportRevision: base.measurementImportRevision,
    })).not.toBe(baseDigest);
    expect(hashF7MeasurementSessionState({
      templateId: base.templateId,
      workbookContentHash: base.workbookContentHash,
      worksheetStableId: base.worksheetStableId,
      factorSetDigest,
      measurementImportRevision: 1,
    })).not.toBe(baseDigest);
  });
});