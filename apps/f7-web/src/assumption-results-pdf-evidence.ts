import type { DeepReadonly } from "vue";
import { calculateToleranceAnalysis } from "@ai-assist/workbook-catalog/calculation-kernel";
import type { Distribution } from "@ai-assist/contracts";
import type { F7SessionSnapshot, F7SetupDistribution } from "./api/f7-client";

const DISTRIBUTION_BY_LABEL: Readonly<Record<F7SetupDistribution, Distribution>> = {
  Normal: "normal",
  Uniform: "uniform",
  Triangular: "triangular",
  Trapezoidal: "trapezoidal",
  Elliptical: "elliptical",
  Beta: "beta",
};

export type DimensionChainReportOrientation = "horizontal" | "vertical";
export type DimensionChainReportStatus = "generated" | "fallback";
export type DimensionChainClosureDirection = "start-to-end" | "end-to-start";

export interface DimensionChainReportFactor {
  readonly id: string;
  readonly itemNumber: number;
  readonly name: string;
  readonly designNominal: number;
  readonly upperTolerance: number;
  readonly lowerTolerance: number;
  readonly longTermSafetyFactor: number;
  readonly sigmaLevel: number;
  readonly distribution: F7SetupDistribution;
}

export interface DimensionChainReportManualLayout {
  readonly boundaryOffsets: Readonly<Record<string, number>>;
  readonly laneOffsets: Readonly<Record<string, number>>;
  readonly closureStartOffset?: number;
  readonly closureEndOffset?: number;
  readonly closureLaneOffset?: number;
}

export type DimensionChainReportProjection =
  | {
      readonly status: "generated";
      readonly sourceSignature: string;
      readonly orientation: DimensionChainReportOrientation;
      readonly factors: readonly DimensionChainReportFactor[];
      readonly manualLayout: DimensionChainReportManualLayout;
      readonly reversedFactorIds: readonly string[];
      readonly closureDirection: DimensionChainClosureDirection;
    }
  | {
      readonly status: "fallback";
      readonly sourceSignature: string;
    };

export interface AssumptionResultsEngineeringEvidenceFactorRow {
  readonly itemNumber: number;
  readonly factorName: string;
  readonly designNominal: number;
  readonly upperTolerance: number;
  readonly lowerTolerance: number;
  readonly longTermSafetyFactor: number;
  readonly sigmaLevel: number;
  readonly distribution: F7SetupDistribution;
  readonly mean: number;
  readonly tolerance: number;
  readonly oneSigma: number;
  readonly contributionPercent: number;
}

export interface AssumptionResultsEngineeringEvidenceFactorFooter {
  readonly designNominalTotal: number;
  readonly upperWorstCaseTolerance: number;
  readonly lowerWorstCaseTolerance: number;
  readonly meanResponse: number;
  readonly rssTolerance: number;
  readonly rssSigma: number;
  readonly contributionTotalPercent: number;
  readonly additionalMeanShift: number;
  readonly adjustedMean: number;
}

export interface AssumptionResultsEngineeringEvidenceResponseDistribution {
  readonly mean: number;
  readonly standardDeviation: number;
  readonly lowerSpecLimit: number;
  readonly upperSpecLimit: number;
  readonly target: number;
}

export interface AssumptionResultsEngineeringEvidenceResponseSummary {
  readonly rssAndWorstCase: {
    readonly rssSigma: number;
    readonly worstCaseTolerance: number;
    readonly worstCaseUpperBound: number;
    readonly worstCaseLowerBound: number;
  };
  readonly responseAndSpecifications: {
    readonly designNominal: number;
    readonly meanResponse: number;
    readonly additionalMeanShift: number;
    readonly adjustedMean: number;
    readonly lowerSpecLimit: number;
    readonly upperSpecLimit: number;
    readonly targetCpk: number;
  };
  readonly sigmaLevelAndCapability: {
    readonly lowerZ: number;
    readonly upperZ: number;
    readonly calculatedSigmaLevel: number;
    readonly cp: number;
    readonly lowerCpk: number;
    readonly upperCpk: number;
    readonly calculatedCpk: number;
  };
  readonly defectsPerMillion: {
    readonly lowerDpm: number;
    readonly upperDpm: number;
    readonly totalDpm: number;
    readonly outOfSpecPercent: number;
    readonly yieldPercent: number;
  };
}

export interface AssumptionResultsEngineeringEvidence {
  readonly factorSetup: {
    readonly rows: readonly AssumptionResultsEngineeringEvidenceFactorRow[];
    readonly footer: AssumptionResultsEngineeringEvidenceFactorFooter;
  };
  readonly dimensionChain: DimensionChainReportProjection;
  readonly responseDistribution: AssumptionResultsEngineeringEvidenceResponseDistribution;
  readonly responseSummary: AssumptionResultsEngineeringEvidenceResponseSummary;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function finiteSystemSpecification(
  session: DeepReadonly<F7SessionSnapshot>,
): {
  readonly lowerSpecLimit: number;
  readonly upperSpecLimit: number;
  readonly targetSigmaLevel: number;
  readonly additionalMeanShift: number;
} | undefined {
  const specification = session.systemSpecification;
  if (
    specification?.status !== "available"
    || specification.lowerSpecLimit.status !== "available"
    || specification.upperSpecLimit.status !== "available"
    || specification.targetSigmaLevel.status !== "available"
    || specification.additionalMeanShift.status !== "available"
  ) {
    return undefined;
  }

  const lowerSpecLimit = specification.lowerSpecLimit.actualValue;
  const upperSpecLimit = specification.upperSpecLimit.actualValue;
  const targetSigmaLevel = specification.targetSigmaLevel.actualValue;
  const additionalMeanShift = specification.additionalMeanShift.actualValue;

  if (
    !isFiniteNumber(lowerSpecLimit)
    || !isFiniteNumber(upperSpecLimit)
    || !isFiniteNumber(targetSigmaLevel)
    || !isFiniteNumber(additionalMeanShift)
    || targetSigmaLevel <= 0
    || lowerSpecLimit >= upperSpecLimit
  ) {
    return undefined;
  }

  return {
    lowerSpecLimit,
    upperSpecLimit,
    targetSigmaLevel,
    additionalMeanShift,
  };
}

export function buildConfirmedEngineeringEvidence(
  session: DeepReadonly<F7SessionSnapshot>,
  chain: DimensionChainReportProjection,
): AssumptionResultsEngineeringEvidence | undefined {
  if (session.factors.length === 0) return undefined;

  const system = finiteSystemSpecification(session);
  if (!system) return undefined;

  const confirmedFactors = session.factors.map((factor) => {
    if (factor.setup?.confirmed !== true || factor.evidence === undefined) return undefined;
    if (
      !isFiniteNumber(factor.setup.designNominal)
      || !isFiniteNumber(factor.setup.upperTolerance)
      || !isFiniteNumber(factor.setup.lowerTolerance)
      || !isFiniteNumber(factor.setup.longTermSafetyFactor)
      || !isFiniteNumber(factor.setup.sigmaLevel)
    ) {
      return undefined;
    }
    if (!isFiniteNumber(factor.evidence.designNominal)
      || !isFiniteNumber(factor.evidence.upperTolerance)
      || !isFiniteNumber(factor.evidence.lowerTolerance)
      || !isFiniteNumber(factor.evidence.longTermSafetyFactor)
      || !isFiniteNumber(factor.evidence.sigmaLevel)) {
      return undefined;
    }
    return {
      factor,
      setup: factor.setup,
      evidence: factor.evidence,
    };
  });

  if (confirmedFactors.some((factor) => factor === undefined)) return undefined;

  const factors = confirmedFactors as readonly {
    readonly factor: F7SessionSnapshot["factors"][number];
    readonly setup: NonNullable<F7SessionSnapshot["factors"][number]["setup"]>;
    readonly evidence: NonNullable<F7SessionSnapshot["factors"][number]["evidence"]>;
  }[];

  let calculation: ReturnType<typeof calculateToleranceAnalysis>;
  try {
    calculation = calculateToleranceAnalysis({
      factors: factors.map(({ factor, setup, evidence }) => ({
        source: {
          worksheetName: evidence.worksheetName,
          tableId: evidence.tableId,
          sourceRow: evidence.sourceRow,
        },
        name: evidence.factorName,
        unit: evidence.unit,
        input: {
          nominalValue: setup.designNominal,
          upperTolerance: setup.upperTolerance,
          lowerTolerance: setup.lowerTolerance,
          longTermSafetyFactor: setup.longTermSafetyFactor,
          sigmaLevel: setup.sigmaLevel,
          distribution: DISTRIBUTION_BY_LABEL[setup.distribution],
        },
      })),
      system: {
        designNominal: factors.reduce((sum, { setup }) => sum + setup.designNominal, 0),
        lowerSpecLimit: system.lowerSpecLimit,
        upperSpecLimit: system.upperSpecLimit,
        targetSigmaLevel: system.targetSigmaLevel,
        targetCpk: system.targetSigmaLevel / 3,
        shift: system.additionalMeanShift,
      },
    });
  } catch {
    return undefined;
  }

  const totalContribution = calculation.factors.reduce((sum, factor) => sum + factor.contribution, 0) * 100;

  const rows = factors.map(({ factor, setup, evidence }, index) => {
    const kernelFactor = calculation.factors.find((entry) => (
      entry.source.tableId === evidence.tableId
      && entry.source.sourceRow === evidence.sourceRow
      && entry.name === evidence.factorName
    ));
    if (!kernelFactor) return undefined;
    return {
      itemNumber: index + 1,
      factorName: evidence.factorName,
      designNominal: setup.designNominal,
      upperTolerance: setup.upperTolerance,
      lowerTolerance: setup.lowerTolerance,
      longTermSafetyFactor: setup.longTermSafetyFactor,
      sigmaLevel: setup.sigmaLevel,
      distribution: setup.distribution,
      mean: kernelFactor.mean,
      tolerance: kernelFactor.halfTolerance,
      oneSigma: kernelFactor.sigma,
      contributionPercent: kernelFactor.contribution * 100,
    } satisfies AssumptionResultsEngineeringEvidenceFactorRow;
  });

  if (rows.some((row) => row === undefined)) return undefined;

  const safeRows = rows as readonly AssumptionResultsEngineeringEvidenceFactorRow[];

  return {
    factorSetup: {
      rows: safeRows,
      footer: {
        designNominalTotal: calculation.system.designNominal,
        upperWorstCaseTolerance: calculation.system.responseUpperTolerance,
        lowerWorstCaseTolerance: calculation.system.responseLowerTolerance,
        meanResponse: calculation.system.mean - calculation.system.shift,
        rssTolerance: calculation.system.rssSigma * 3,
        rssSigma: calculation.system.rssSigma,
        contributionTotalPercent: totalContribution,
        additionalMeanShift: calculation.system.shift,
        adjustedMean: calculation.system.mean,
      },
    },
    dimensionChain: chain,
    responseDistribution: {
      mean: calculation.system.mean,
      standardDeviation: calculation.system.rssSigma,
      lowerSpecLimit: calculation.capability.lowerSpecLimit,
      upperSpecLimit: calculation.capability.upperSpecLimit,
      target: calculation.system.designNominal,
    },
    responseSummary: {
      rssAndWorstCase: {
        rssSigma: calculation.system.rssSigma,
        worstCaseTolerance: calculation.system.worstCaseTolerance,
        worstCaseUpperBound: calculation.system.worstCaseUpperBound,
        worstCaseLowerBound: calculation.system.worstCaseLowerBound,
      },
      responseAndSpecifications: {
        designNominal: calculation.system.designNominal,
        meanResponse: calculation.system.mean - calculation.system.shift,
        additionalMeanShift: calculation.system.shift,
        adjustedMean: calculation.system.mean,
        lowerSpecLimit: calculation.capability.lowerSpecLimit,
        upperSpecLimit: calculation.capability.upperSpecLimit,
        targetCpk: calculation.capability.targetCpk,
      },
      sigmaLevelAndCapability: {
        lowerZ: calculation.capability.lowerZ,
        upperZ: calculation.capability.upperZ,
        calculatedSigmaLevel: calculation.capability.z,
        cp: calculation.capability.cp,
        lowerCpk: calculation.capability.lowerCpk,
        upperCpk: calculation.capability.upperCpk,
        calculatedCpk: calculation.capability.cpk,
      },
      defectsPerMillion: {
        lowerDpm: calculation.capability.lowerDpm,
        upperDpm: calculation.capability.upperDpm,
        totalDpm: calculation.capability.totalDpm,
        outOfSpecPercent: calculation.capability.outOfSpecRatio * 100,
        yieldPercent: calculation.capability.yield * 100,
      },
    },
  };
}
