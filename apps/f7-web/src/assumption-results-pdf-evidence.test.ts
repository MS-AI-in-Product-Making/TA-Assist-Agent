import { describe, expect, it } from "vitest";
import { calculateToleranceAnalysis, type KernelCalculationResult } from "@ai-assist/workbook-catalog/calculation-kernel";
import type { F7SessionSnapshot } from "./api/f7-client";
import {
  buildConfirmedEngineeringEvidence,
  type AssumptionResultsCurrentCalculationInput,
  type DimensionChainReportProjection,
} from "./assumption-results-pdf-evidence";

function withFirstFactor(
  session: F7SessionSnapshot,
  update: (factor: F7SessionSnapshot["factors"][number]) => F7SessionSnapshot["factors"][number],
): void {
  const current = session.factors[0]!;
  session.factors = [
    update(current),
    ...session.factors.slice(1),
  ] as F7SessionSnapshot["factors"];
}

function confirmedSnapshot(): F7SessionSnapshot {
  return {
    sessionId: "session-evidence-01",
    workbook: {
      fileName: "demo.xlsx",
      workbookContentHash: "a".repeat(64),
    },
    selectedWorksheetNames: ["Anonymous_TA"],
    systemSpecification: {
      status: "available",
      designNominal: { status: "available", actualValue: -0.05, valueOrigin: "numeric_literal" },
      lowerSpecLimit: { status: "available", actualValue: -0.15, valueOrigin: "numeric_literal" },
      upperSpecLimit: { status: "available", actualValue: 0.05, valueOrigin: "numeric_literal" },
      targetSigmaLevel: { status: "available", actualValue: 3, valueOrigin: "numeric_literal" },
      additionalMeanShift: { status: "available", actualValue: 0, valueOrigin: "defaulted" },
    },
    factors: [
      {
        factorCandidate: {
          workbookContentHash: "a".repeat(64),
          worksheetName: "Anonymous_TA",
          factorCandidateId: "factor-01",
          factorName: "Fabric thickness",
          sourceRow: 15,
          tableId: "table-1",
        },
        setup: {
          confirmed: true,
          factorCandidateId: "factor-01",
          designNominal: -0.57,
          upperTolerance: 0.05,
          lowerTolerance: -0.05,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
        },
        evidence: {
          workbookContentHash: "a".repeat(64),
          factorCandidateId: "factor-01",
          worksheetName: "Anonymous_TA",
          tableId: "table-1",
          sourceRow: 15,
          factorName: "Fabric thickness",
          unit: "mm",
          designNominal: -0.57,
          upperTolerance: 0.05,
          lowerTolerance: -0.05,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
        },
      },
      {
        factorCandidate: {
          workbookContentHash: "a".repeat(64),
          worksheetName: "Anonymous_TA",
          factorCandidateId: "factor-02",
          factorName: "Housing offset",
          sourceRow: 16,
          tableId: "table-1",
        },
        setup: {
          confirmed: true,
          factorCandidateId: "factor-02",
          designNominal: 0.52,
          upperTolerance: 0.04,
          lowerTolerance: -0.04,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
        },
        evidence: {
          workbookContentHash: "a".repeat(64),
          factorCandidateId: "factor-02",
          worksheetName: "Anonymous_TA",
          tableId: "table-1",
          sourceRow: 16,
          factorName: "Housing offset",
          unit: "mm",
          designNominal: 0.52,
          upperTolerance: 0.04,
          lowerTolerance: -0.04,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
        },
      },
    ],
  } as unknown as F7SessionSnapshot;
}

function buildCurrentCalculation(
  session: F7SessionSnapshot,
  additionalMeanShift: number,
): KernelCalculationResult {
  const specification = session.systemSpecification;
  const lowerSpecLimit = specification?.status === "available" && specification.lowerSpecLimit.status === "available"
    ? specification.lowerSpecLimit.actualValue
    : -0.15;
  const upperSpecLimit = specification?.status === "available" && specification.upperSpecLimit.status === "available"
    ? specification.upperSpecLimit.actualValue
    : 0.05;
  const targetSigmaLevel = specification?.status === "available" && specification.targetSigmaLevel.status === "available"
    ? specification.targetSigmaLevel.actualValue
    : 3;

  return calculateToleranceAnalysis({
    factors: session.factors.map((factor) => ({
      source: {
        worksheetName: factor.evidence!.worksheetName,
        tableId: factor.evidence!.tableId,
        sourceRow: factor.evidence!.sourceRow,
      },
      name: factor.evidence!.factorName,
      unit: factor.evidence!.unit,
      input: {
        nominalValue: factor.evidence!.designNominal,
        upperTolerance: factor.evidence!.upperTolerance,
        lowerTolerance: factor.evidence!.lowerTolerance,
        longTermSafetyFactor: factor.evidence!.longTermSafetyFactor,
        sigmaLevel: factor.evidence!.sigmaLevel,
        distribution: "normal",
      },
    })),
    system: {
      designNominal: session.factors.reduce((sum, factor) => sum + factor.evidence!.designNominal, 0),
      lowerSpecLimit,
      upperSpecLimit,
      targetSigmaLevel,
      targetCpk: 1,
      shift: additionalMeanShift,
    },
  });
}

function generatedChain(): DimensionChainReportProjection {
  return {
    status: "generated",
    sourceSignature: "source-signature-v1",
    orientation: "horizontal",
    factors: [
      {
        id: "factor-01",
        itemNumber: 1,
        name: "Fabric thickness",
        designNominal: -0.57,
        upperTolerance: 0.05,
        lowerTolerance: -0.05,
        longTermSafetyFactor: 1,
        sigmaLevel: 4,
        distribution: "Normal",
      },
      {
        id: "factor-02",
        itemNumber: 2,
        name: "Housing offset",
        designNominal: 0.52,
        upperTolerance: 0.04,
        lowerTolerance: -0.04,
        longTermSafetyFactor: 1,
        sigmaLevel: 4,
        distribution: "Normal",
      },
    ],
    manualLayout: {
      boundaryOffsets: {},
      laneOffsets: {},
    },
    reversedFactorIds: ["factor-02"],
    closureDirection: "start-to-end",
  };
}

function expectationStatus(status: unknown): "PASS" | "FAIL" {
  return status === "PASS" ? "PASS" : "FAIL";
}

function currentInput(
  session: F7SessionSnapshot,
  additionalMeanShift = 0,
): AssumptionResultsCurrentCalculationInput {
  return {
    additionalMeanShift,
    calculation: buildCurrentCalculation(session, additionalMeanShift),
  };
}

describe("buildConfirmedEngineeringEvidence", () => {
  it("projects all four response summary groups with complete structured evidence", () => {
    const session = confirmedSnapshot();
    const chain = generatedChain();
    const current = buildCurrentCalculation(session, 0);

    const result = buildConfirmedEngineeringEvidence(session, chain, {
      additionalMeanShift: 0,
      calculation: current,
    });

    expect(result).toBeDefined();
    expect(result?.factorSetup.rows).toHaveLength(2);
    expect(result?.factorSetup.rows[0]).toMatchObject({
      itemNumber: 1,
      factorName: "Fabric thickness",
      designNominal: -0.57,
      upperTolerance: 0.05,
      lowerTolerance: -0.05,
      longTermSafetyFactor: 1,
      sigmaLevel: 4,
      distribution: "Normal",
    });
    expect(result?.factorSetup.rows[1]).toMatchObject({
      itemNumber: 2,
      factorName: "Housing offset",
      designNominal: 0.52,
      upperTolerance: 0.04,
      lowerTolerance: -0.04,
    });
    expect(result?.factorSetup.footer.designNominalTotal).toBeCloseTo(-0.05, 10);
    expect(result?.factorSetup.footer.upperWorstCaseTolerance).toBeCloseTo(0.09, 10);
    expect(result?.factorSetup.footer.lowerWorstCaseTolerance).toBeCloseTo(-0.09, 10);
    expect(result?.factorSetup.footer.rssSigma).toBeCloseTo(0.0160078106, 10);
    expect(result?.factorSetup.footer.contributionTotalPercent).toBeCloseTo(100, 10);

    expect(result?.responseDistribution.mean).toBeCloseTo(current.system.mean, 10);
    expect(result?.responseDistribution.standardDeviation).toBeCloseTo(current.system.rssSigma, 10);
    expect(result?.responseDistribution.lowerSpecLimit).toBeCloseTo(-0.15, 10);
    expect(result?.responseDistribution.upperSpecLimit).toBeCloseTo(0.05, 10);
    expect(result?.responseDistribution.target).toBeCloseTo(-0.05, 10);

    expect(result?.responseSummary.rssAndWorstCase).toEqual({
      sigmaBands: [1, 3, 4, 4.5, 6].map((sigma) => ({
        sigma,
        tolerance: current.system.rssSigma * sigma,
        upper: current.system.mean + current.system.rssSigma * sigma,
        lower: current.system.mean - current.system.rssSigma * sigma,
      })),
      worstCase: {
        tolerance: current.system.worstCaseTolerance,
        upper: current.system.worstCaseUpperBound,
        lower: current.system.worstCaseLowerBound,
      },
    });

    expect(result?.responseSummary.responseAndSpecifications).toEqual({
      designNominal: current.system.designNominal,
      meanResponse: current.system.mean - current.system.shift,
      additionalMeanShift: current.system.shift,
      adjustedMean: current.system.mean,
      lowerSpecLimit: current.capability.lowerSpecLimit,
      upperSpecLimit: current.capability.upperSpecLimit,
      targetSigmaLevel: current.capability.targetSigmaLevel,
      targetCpk: current.capability.targetCpk,
    });

    expect(result?.responseSummary.sigmaLevelAndCapability).toEqual({
      lowerZ: {
        value: current.capability.lowerZ,
        status: expectationStatus(current.capability.lowerCpkStatus),
      },
      upperZ: {
        value: current.capability.upperZ,
        status: expectationStatus(current.capability.upperCpkStatus),
      },
      calculatedSigmaLevel: {
        value: current.capability.z,
        status: expectationStatus(current.capability.status),
      },
      cp: {
        value: current.capability.cp,
        status: expectationStatus(current.capability.cpStatus),
      },
      lowerCpk: {
        value: current.capability.lowerCpk,
        status: expectationStatus(current.capability.lowerCpkStatus),
      },
      upperCpk: {
        value: current.capability.upperCpk,
        status: expectationStatus(current.capability.upperCpkStatus),
      },
      calculatedCpk: {
        value: current.capability.cpk,
        status: expectationStatus(current.capability.status),
      },
    });

    expect(result?.responseSummary.defectsPerMillion).toEqual({
      lowerDpm: current.capability.lowerDpm,
      upperDpm: current.capability.upperDpm,
      totalDpm: current.capability.totalDpm,
      outOfSpecPercent: current.capability.outOfSpecRatio * 100,
      yieldPercent: current.capability.yield * 100,
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain("http://");
    expect(serialized).not.toContain("https://");
    expect(serialized).not.toContain("data:image");

    expect(result?.dimensionChain).toEqual(chain);
  });

  it("returns undefined when setup is missing or effectively unconfirmed by contract", () => {
    const cases: ReadonlyArray<{
      readonly label: string;
      readonly mutate: (session: F7SessionSnapshot) => void;
    }> = [
      {
        label: "setup missing",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          setup: undefined,
        })),
      },
      {
        label: "setup.confirmed not true",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          setup: {
            ...factor.setup!,
            confirmed: false,
          } as unknown as NonNullable<F7SessionSnapshot["factors"][number]["setup"]>,
        })),
      },
    ];

    for (const testCase of cases) {
      const session = confirmedSnapshot();
      testCase.mutate(session);
      expect(buildConfirmedEngineeringEvidence(session, generatedChain(), {
        additionalMeanShift: 0,
        calculation: buildCurrentCalculation(confirmedSnapshot(), 0),
      }), testCase.label).toBeUndefined();
    }
  });

  it("returns undefined when required confirmed evidence is missing", () => {
    const session = confirmedSnapshot();
    session.factors = session.factors.map((factor, index) => (
      index === 0 ? { ...factor, evidence: undefined } : factor
    )) as F7SessionSnapshot["factors"];

    expect(buildConfirmedEngineeringEvidence(session, generatedChain(), {
      additionalMeanShift: 0,
      calculation: buildCurrentCalculation(confirmedSnapshot(), 0),
    })).toBeUndefined();
  });

  it("returns undefined for setup, identity, and workbook/worksheet mismatches", () => {
    const cases: ReadonlyArray<{
      readonly label: string;
      readonly mutate: (session: F7SessionSnapshot) => void;
    }> = [
      {
        label: "setup.designNominal mismatch",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          setup: { ...factor.setup!, designNominal: factor.setup!.designNominal + 0.001 },
        })),
      },
      {
        label: "setup.upperTolerance mismatch",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          setup: { ...factor.setup!, upperTolerance: factor.setup!.upperTolerance + 0.001 },
        })),
      },
      {
        label: "setup.lowerTolerance mismatch",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          setup: { ...factor.setup!, lowerTolerance: factor.setup!.lowerTolerance + 0.001 },
        })),
      },
      {
        label: "setup.longTermSafetyFactor mismatch",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          setup: {
            ...factor.setup!,
            longTermSafetyFactor: (factor.setup?.longTermSafetyFactor ?? 0) + 0.1,
          },
        })),
      },
      {
        label: "setup.sigmaLevel mismatch",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          setup: {
            ...factor.setup!,
            sigmaLevel: (factor.setup?.sigmaLevel ?? 0) + 0.1,
          },
        })),
      },
      {
        label: "setup.distribution mismatch",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          setup: { ...factor.setup!, distribution: "Uniform" },
        })),
      },
      {
        label: "setup factorCandidateId mismatch",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          setup: {
            ...factor.setup!,
            factorCandidateId: "factor-setup-other",
          },
        })),
      },
      {
        label: "evidence factorCandidateId mismatch",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          evidence: {
            ...factor.evidence!,
            factorCandidateId: "factor-evidence-other",
          },
        })),
      },
      {
        label: "evidence sourceRow mismatch",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          evidence: { ...factor.evidence!, sourceRow: factor.evidence!.sourceRow + 1 },
        })),
      },
      {
        label: "evidence tableId mismatch",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          evidence: { ...factor.evidence!, tableId: `${factor.evidence!.tableId}-other` },
        })),
      },
      {
        label: "evidence worksheet mismatch",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          evidence: { ...factor.evidence!, worksheetName: "OtherSheet" },
        })),
      },
      {
        label: "evidence workbook hash mismatch",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          evidence: { ...factor.evidence!, workbookContentHash: "b".repeat(64) },
        })),
      },
      {
        label: "candidate workbook hash mismatch",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          factorCandidate: {
            ...factor.factorCandidate,
            workbookContentHash: "b".repeat(64),
          },
        })),
      },
      {
        label: "candidate id mismatch",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          factorCandidate: { ...factor.factorCandidate, factorCandidateId: "factor-01-other" },
        })),
      },
      {
        label: "candidate name mismatch",
        mutate: (session) => withFirstFactor(session, (factor) => ({
          ...factor,
          factorCandidate: { ...factor.factorCandidate, factorName: "Fabric thickness altered" },
        })),
      },
    ];

    for (const testCase of cases) {
      const session = confirmedSnapshot();
      const current = buildCurrentCalculation(session, 0);
      testCase.mutate(session);
      expect(
        buildConfirmedEngineeringEvidence(session, generatedChain(), {
          additionalMeanShift: 0,
          calculation: current,
        }),
        testCase.label,
      ).toBeUndefined();
    }
  });

  it("returns undefined when current calculation identity or factor input fields are tampered", () => {
    const cases: ReadonlyArray<{
      readonly label: string;
      readonly mutate: (calculation: KernelCalculationResult) => KernelCalculationResult;
    }> = [
      {
        label: "current source worksheetName mismatch",
        mutate: (calculation) => ({
          ...calculation,
          factors: calculation.factors.map((factor, index) => (index === 0
            ? { ...factor, source: { ...factor.source, worksheetName: "OtherSheet" } }
            : factor)),
        }),
      },
      {
        label: "current source tableId mismatch",
        mutate: (calculation) => ({
          ...calculation,
          factors: calculation.factors.map((factor, index) => (index === 0
            ? { ...factor, source: { ...factor.source, tableId: "table-other" } }
            : factor)),
        }),
      },
      {
        label: "current source sourceRow mismatch",
        mutate: (calculation) => ({
          ...calculation,
          factors: calculation.factors.map((factor, index) => (index === 0
            ? { ...factor, source: { ...factor.source, sourceRow: factor.source.sourceRow + 1 } }
            : factor)),
        }),
      },
      {
        label: "current factor name mismatch",
        mutate: (calculation) => ({
          ...calculation,
          factors: calculation.factors.map((factor, index) => (index === 0
            ? { ...factor, name: "Fabric thickness altered" }
            : factor)),
        }),
      },
      {
        label: "current factor unit mismatch",
        mutate: (calculation) => ({
          ...calculation,
          factors: calculation.factors.map((factor, index) => (index === 0
            ? { ...factor, unit: "in" }
            : factor)),
        }),
      },
      {
        label: "current input nominalValue mismatch",
        mutate: (calculation) => ({
          ...calculation,
          factors: calculation.factors.map((factor, index) => (index === 0
            ? { ...factor, input: { ...factor.input, nominalValue: factor.input.nominalValue + 0.001 } }
            : factor)),
        }),
      },
      {
        label: "current input upperTolerance mismatch",
        mutate: (calculation) => ({
          ...calculation,
          factors: calculation.factors.map((factor, index) => (index === 0
            ? { ...factor, input: { ...factor.input, upperTolerance: factor.input.upperTolerance + 0.001 } }
            : factor)),
        }),
      },
      {
        label: "current input lowerTolerance mismatch",
        mutate: (calculation) => ({
          ...calculation,
          factors: calculation.factors.map((factor, index) => (index === 0
            ? { ...factor, input: { ...factor.input, lowerTolerance: factor.input.lowerTolerance + 0.001 } }
            : factor)),
        }),
      },
      {
        label: "current input longTermSafetyFactor mismatch",
        mutate: (calculation) => ({
          ...calculation,
          factors: calculation.factors.map((factor, index) => (index === 0
            ? {
                ...factor,
                input: {
                  ...factor.input,
                  longTermSafetyFactor: factor.input.longTermSafetyFactor + 0.1,
                },
              }
            : factor)),
        }),
      },
      {
        label: "current input sigmaLevel mismatch",
        mutate: (calculation) => ({
          ...calculation,
          factors: calculation.factors.map((factor, index) => (index === 0
            ? { ...factor, input: { ...factor.input, sigmaLevel: factor.input.sigmaLevel + 0.1 } }
            : factor)),
        }),
      },
      {
        label: "current input distribution mismatch",
        mutate: (calculation) => ({
          ...calculation,
          factors: calculation.factors.map((factor, index) => (index === 0
            ? { ...factor, input: { ...factor.input, distribution: "uniform" } }
            : factor)),
        }),
      },
    ];

    for (const testCase of cases) {
      const session = confirmedSnapshot();
      const current = testCase.mutate(buildCurrentCalculation(session, 0));
      expect(buildConfirmedEngineeringEvidence(session, generatedChain(), {
        additionalMeanShift: 0,
        calculation: current,
      }), testCase.label).toBeUndefined();
    }
  });

  it("returns undefined when current calculation and additionalMeanShift are inconsistent", () => {
    const session = confirmedSnapshot();
    const current = buildCurrentCalculation(session, 0.02);
    expect(buildConfirmedEngineeringEvidence(session, generatedChain(), {
      additionalMeanShift: 0,
      calculation: current,
    })).toBeUndefined();

    const mismatchedSystem = {
      ...current,
      capability: {
        ...current.capability,
        lowerSpecLimit: current.capability.lowerSpecLimit - 0.001,
      },
    } satisfies KernelCalculationResult;
    expect(buildConfirmedEngineeringEvidence(session, generatedChain(), {
      additionalMeanShift: 0.02,
      calculation: mismatchedSystem,
    })).toBeUndefined();
  });

  it("returns undefined when system specification is unavailable or incomplete", () => {
    const missingLsl = confirmedSnapshot();
    missingLsl.systemSpecification = {
      ...missingLsl.systemSpecification,
      status: "available",
      lowerSpecLimit: { status: "unavailable", reasonCode: "response_summary_value_missing" },
    } as unknown as F7SessionSnapshot["systemSpecification"];
    expect(buildConfirmedEngineeringEvidence(missingLsl, generatedChain(), {
      additionalMeanShift: 0,
      calculation: buildCurrentCalculation(confirmedSnapshot(), 0),
    })).toBeUndefined();

    const missingUsl = confirmedSnapshot();
    missingUsl.systemSpecification = {
      ...missingUsl.systemSpecification,
      status: "available",
      upperSpecLimit: { status: "unavailable", reasonCode: "response_summary_value_missing" },
    } as unknown as F7SessionSnapshot["systemSpecification"];
    expect(buildConfirmedEngineeringEvidence(missingUsl, generatedChain(), {
      additionalMeanShift: 0,
      calculation: buildCurrentCalculation(confirmedSnapshot(), 0),
    })).toBeUndefined();

    const missingTargetSigma = confirmedSnapshot();
    missingTargetSigma.systemSpecification = {
      ...missingTargetSigma.systemSpecification,
      status: "available",
      targetSigmaLevel: { status: "unavailable", reasonCode: "response_summary_value_missing" },
    } as unknown as F7SessionSnapshot["systemSpecification"];
    expect(buildConfirmedEngineeringEvidence(missingTargetSigma, generatedChain(), {
      additionalMeanShift: 0,
      calculation: buildCurrentCalculation(confirmedSnapshot(), 0),
    })).toBeUndefined();

    const missingMeanShift = confirmedSnapshot();
    missingMeanShift.systemSpecification = {
      ...missingMeanShift.systemSpecification,
      status: "available",
      additionalMeanShift: { status: "unavailable", reasonCode: "response_summary_value_missing" },
    } as unknown as F7SessionSnapshot["systemSpecification"];
    expect(buildConfirmedEngineeringEvidence(missingMeanShift, generatedChain(), {
      additionalMeanShift: 0,
      calculation: buildCurrentCalculation(confirmedSnapshot(), 0),
    })).toBeUndefined();
  });

  it("returns undefined when evidence is non-finite or calculation is not computable", () => {
    const nonFinite = confirmedSnapshot();
    withFirstFactor(nonFinite, (factor) => ({
      ...factor,
      evidence: {
        ...factor.evidence!,
        sigmaLevel: Number.POSITIVE_INFINITY,
      },
    }));
    expect(buildConfirmedEngineeringEvidence(nonFinite, generatedChain(), {
      additionalMeanShift: 0,
      calculation: buildCurrentCalculation(confirmedSnapshot(), 0),
    })).toBeUndefined();

    const notComputable = confirmedSnapshot();
    withFirstFactor(notComputable, (factor) => ({
      ...factor,
      evidence: {
        ...factor.evidence!,
        sigmaLevel: 0,
      },
      setup: {
        ...factor.setup!,
        sigmaLevel: 0,
      },
    }));
    expect(buildConfirmedEngineeringEvidence(notComputable, generatedChain(), {
      additionalMeanShift: 0,
      calculation: buildCurrentCalculation(confirmedSnapshot(), 0),
    })).toBeUndefined();
  });

  it("projects optional volume and failures over volume when volume evidence is available", () => {
    const session = confirmedSnapshot();
    session.systemSpecification = {
      ...session.systemSpecification,
      status: "available",
      volume: { status: "available", actualValue: 2_000_000, valueOrigin: "numeric_literal" },
    } as F7SessionSnapshot["systemSpecification"];

    const current = buildCurrentCalculation(session, 0);
    const result = buildConfirmedEngineeringEvidence(session, generatedChain(), {
      additionalMeanShift: 0,
      calculation: current,
    });

    expect(result).toBeDefined();
    expect(result?.responseSummary.defectsPerMillion.volume).toBe(2_000_000);
    expect(result?.responseSummary.defectsPerMillion.failuresOverVolume).toBeCloseTo(
      ((result?.responseSummary.defectsPerMillion.totalDpm ?? 0) / 1_000_000) * 2_000_000,
      6,
    );
  });

  it("uses current non-zero mean shift for footer, curve, and capability outputs", () => {
    const session = confirmedSnapshot();
    session.systemSpecification = {
      ...session.systemSpecification,
      status: "available",
      additionalMeanShift: { status: "available", actualValue: 0.01, valueOrigin: "numeric_literal" },
    } as F7SessionSnapshot["systemSpecification"];

    const current = buildCurrentCalculation(session, 0.02);
    const result = buildConfirmedEngineeringEvidence(session, generatedChain(), {
      additionalMeanShift: 0.02,
      calculation: current,
    });

    expect(result).toBeDefined();
    expect(result?.factorSetup.footer.additionalMeanShift).toBeCloseTo(0.02, 10);
    expect(result?.factorSetup.footer.adjustedMean).toBeCloseTo(current.system.mean, 10);
    expect(result?.factorSetup.footer.meanResponse).toBeCloseTo(current.system.mean - current.system.shift, 10);
    expect(result?.responseDistribution.mean).toBeCloseTo(current.system.mean, 10);
    expect(result?.responseDistribution.standardDeviation).toBeCloseTo(current.system.rssSigma, 10);
    expect(result?.responseSummary.responseAndSpecifications.additionalMeanShift).toBeCloseTo(0.02, 10);
    expect(result?.responseSummary.responseAndSpecifications.adjustedMean).toBeCloseTo(current.system.mean, 10);
    expect(result?.responseSummary.sigmaLevelAndCapability.calculatedCpk.value).toBeCloseTo(current.capability.cpk, 10);
    expect(result?.responseSummary.defectsPerMillion.totalDpm).toBeCloseTo(current.capability.totalDpm, 10);
  });

  it("requires explicit current calculation input and does not fallback to a kernel recomputation", () => {
    const session = confirmedSnapshot();

    expect(buildConfirmedEngineeringEvidence(session, generatedChain(), undefined as unknown as AssumptionResultsCurrentCalculationInput)).toBeUndefined();
  });

  it("rejects negative or non-integer volume and allows zero with zero failures", () => {
    const invalidVolumes = [-1, 1.5] as const;
    for (const volume of invalidVolumes) {
      const session = confirmedSnapshot();
      session.systemSpecification = {
        ...session.systemSpecification,
        status: "available",
        volume: { status: "available", actualValue: volume, valueOrigin: "numeric_literal" },
      } as F7SessionSnapshot["systemSpecification"];

      expect(buildConfirmedEngineeringEvidence(session, generatedChain(), currentInput(session, 0))).toBeUndefined();
    }

    const zeroVolume = confirmedSnapshot();
    zeroVolume.systemSpecification = {
      ...zeroVolume.systemSpecification,
      status: "available",
      volume: { status: "available", actualValue: 0, valueOrigin: "numeric_literal" },
    } as F7SessionSnapshot["systemSpecification"];

    const zeroResult = buildConfirmedEngineeringEvidence(zeroVolume, generatedChain(), currentInput(zeroVolume, 0));
    expect(zeroResult).toBeDefined();
    expect(zeroResult?.responseSummary.defectsPerMillion.volume).toBe(0);
    expect(zeroResult?.responseSummary.defectsPerMillion.failuresOverVolume).toBe(0);
  });

  it("rejects duplicate, missing, extra, or mispaired factor identity between session and current calculation", () => {
    const duplicateSession = confirmedSnapshot();
    const duplicatedIdentity = duplicateSession.factors[0]!;
    duplicateSession.factors = [
      duplicatedIdentity,
      {
        ...duplicateSession.factors[1]!,
        factorCandidate: {
          ...duplicateSession.factors[1]!.factorCandidate,
          worksheetName: duplicatedIdentity.factorCandidate.worksheetName,
          tableId: duplicatedIdentity.factorCandidate.tableId,
          sourceRow: duplicatedIdentity.factorCandidate.sourceRow,
          factorName: duplicatedIdentity.factorCandidate.factorName,
        },
        setup: {
          ...duplicateSession.factors[1]!.setup!,
          factorCandidateId: duplicateSession.factors[1]!.factorCandidate.factorCandidateId,
        },
        evidence: {
          ...duplicateSession.factors[1]!.evidence!,
          factorCandidateId: duplicateSession.factors[1]!.factorCandidate.factorCandidateId,
          worksheetName: duplicatedIdentity.evidence!.worksheetName,
          tableId: duplicatedIdentity.evidence!.tableId,
          sourceRow: duplicatedIdentity.evidence!.sourceRow,
          factorName: duplicatedIdentity.evidence!.factorName,
        },
      },
    ] as F7SessionSnapshot["factors"];
    const duplicateSessionBaseline = buildCurrentCalculation(duplicateSession, 0);
    const duplicateSessionCalculation = {
      ...duplicateSessionBaseline,
      factors: duplicateSessionBaseline.factors.map((factor, index) => (index === 0
        ? factor
        : {
            ...factor,
            source: {
              ...duplicateSessionBaseline.factors[0]!.source,
            },
            name: duplicateSessionBaseline.factors[0]!.name,
          })),
    } satisfies KernelCalculationResult;
    expect(buildConfirmedEngineeringEvidence(duplicateSession, generatedChain(), {
      additionalMeanShift: 0,
      calculation: duplicateSessionCalculation,
    })).toBeUndefined();

    const session = confirmedSnapshot();
    const baseline = buildCurrentCalculation(session, 0);

    const duplicateCalculation = {
      ...baseline,
      factors: [baseline.factors[0]!, { ...baseline.factors[0]! }],
    } satisfies KernelCalculationResult;
    expect(buildConfirmedEngineeringEvidence(session, generatedChain(), {
      additionalMeanShift: 0,
      calculation: duplicateCalculation,
    })).toBeUndefined();

    const missingCalculation = {
      ...baseline,
      factorCount: baseline.factorCount - 1,
      factors: baseline.factors.slice(0, 1),
    } satisfies KernelCalculationResult;
    expect(buildConfirmedEngineeringEvidence(session, generatedChain(), {
      additionalMeanShift: 0,
      calculation: missingCalculation,
    })).toBeUndefined();

    const extraFactor = {
      ...baseline.factors[0]!,
      source: {
        ...baseline.factors[0]!.source,
        sourceRow: 99,
      },
      name: "Extra factor",
    };
    const extraCalculation = {
      ...baseline,
      factorCount: baseline.factorCount + 1,
      factors: [...baseline.factors, extraFactor],
    } satisfies KernelCalculationResult;
    expect(buildConfirmedEngineeringEvidence(session, generatedChain(), {
      additionalMeanShift: 0,
      calculation: extraCalculation,
    })).toBeUndefined();

    const mispairedCalculation = {
      ...baseline,
      factors: baseline.factors.map((factor, index, list) => ({
        ...factor,
        input: index === 0 ? list[1]!.input : list[0]!.input,
      })),
    } satisfies KernelCalculationResult;
    expect(buildConfirmedEngineeringEvidence(session, generatedChain(), {
      additionalMeanShift: 0,
      calculation: mispairedCalculation,
    })).toBeUndefined();
  });

  it("accepts negligible relative drift at large scale but rejects beyond-threshold and tiny-scale drift", () => {
    const largeScale = confirmedSnapshot();
    withFirstFactor(largeScale, (factor) => ({
      ...factor,
      setup: {
        ...factor.setup!,
        designNominal: 1_000_000_000.001,
      },
      evidence: {
        ...factor.evidence!,
        designNominal: 1_000_000_000,
      },
    }));
    const largeScaleResult = buildConfirmedEngineeringEvidence(
      largeScale,
      generatedChain(),
      currentInput(largeScale, 0),
    );
    expect(largeScaleResult).toBeDefined();

    const largeScaleBeyondRelativeTolerance = confirmedSnapshot();
    withFirstFactor(largeScaleBeyondRelativeTolerance, (factor) => ({
      ...factor,
      setup: {
        ...factor.setup!,
        designNominal: 1_000_000_001.2,
      },
      evidence: {
        ...factor.evidence!,
        designNominal: 1_000_000_000,
      },
    }));
    expect(
      buildConfirmedEngineeringEvidence(
        largeScaleBeyondRelativeTolerance,
        generatedChain(),
        currentInput(largeScaleBeyondRelativeTolerance, 0),
      ),
    ).toBeUndefined();

    const tinyScale = confirmedSnapshot();
    withFirstFactor(tinyScale, (factor) => ({
      ...factor,
      setup: {
        ...factor.setup!,
        designNominal: 0.0000000015,
      },
      evidence: {
        ...factor.evidence!,
        designNominal: 0.000000001,
      },
    }));
    expect(buildConfirmedEngineeringEvidence(tinyScale, generatedChain(), currentInput(tinyScale, 0))).toBeUndefined();
  });
});
