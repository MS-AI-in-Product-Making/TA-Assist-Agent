import { describe, expect, it } from "vitest";
import type { F7SessionSnapshot } from "./api/f7-client";
import {
  buildConfirmedEngineeringEvidence,
  type DimensionChainReportProjection,
} from "./assumption-results-pdf-evidence";

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
        factorCandidate: { factorCandidateId: "factor-01", factorName: "Fabric thickness", sourceRow: 15, tableId: "table-1" },
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
        factorCandidate: { factorCandidateId: "factor-02", factorName: "Housing offset", sourceRow: 16, tableId: "table-1" },
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

describe("buildConfirmedEngineeringEvidence", () => {
  it("projects ordered confirmed setup rows, footer values, response distribution, and supplied chain", () => {
    const session = confirmedSnapshot();
    const chain = generatedChain();

    const result = buildConfirmedEngineeringEvidence(session, chain);

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

    expect(result?.responseDistribution.mean).toBeCloseTo(-0.05, 10);
    expect(result?.responseDistribution.standardDeviation).toBeCloseTo(0.0160078106, 10);
    expect(result?.responseDistribution.lowerSpecLimit).toBeCloseTo(-0.15, 10);
    expect(result?.responseDistribution.upperSpecLimit).toBeCloseTo(0.05, 10);
    expect(result?.responseDistribution.target).toBeCloseTo(-0.05, 10);
    expect(result?.responseSummary.responseAndSpecifications.adjustedMean).toBeCloseTo(-0.05, 10);
    expect(result?.dimensionChain).toEqual(chain);
  });

  it("returns undefined when required confirmed evidence is missing", () => {
    const session = confirmedSnapshot();
    session.factors = session.factors.map((factor, index) => (
      index === 0 ? { ...factor, evidence: undefined } : factor
    )) as F7SessionSnapshot["factors"];

    expect(buildConfirmedEngineeringEvidence(session, generatedChain())).toBeUndefined();
  });

  it("returns undefined when required system specification evidence is unavailable", () => {
    const session = confirmedSnapshot();
    session.systemSpecification = {
      ...session.systemSpecification,
      status: "available",
      lowerSpecLimit: { status: "unavailable", reason: "not found" },
    } as F7SessionSnapshot["systemSpecification"];

    expect(buildConfirmedEngineeringEvidence(session, generatedChain())).toBeUndefined();
  });
});
