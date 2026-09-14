import type { DeepReadonly } from "vue";
import type { KernelCalculationResult } from "@ai-assist/workbook-catalog/calculation-kernel";
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
    readonly sigmaBands: readonly {
      readonly sigma: 1 | 3 | 4 | 4.5 | 6;
      readonly tolerance: number;
      readonly upper: number;
      readonly lower: number;
    }[];
    readonly worstCase: {
      readonly tolerance: number;
      readonly upper: number;
      readonly lower: number;
    };
  };
  readonly responseAndSpecifications: {
    readonly designNominal: number;
    readonly meanResponse: number;
    readonly additionalMeanShift: number;
    readonly adjustedMean: number;
    readonly lowerSpecLimit: number;
    readonly upperSpecLimit: number;
    readonly targetSigmaLevel: number;
    readonly targetCpk: number;
  };
  readonly sigmaLevelAndCapability: {
    readonly lowerZ: {
      readonly value: number;
      readonly status: "PASS" | "FAIL";
    };
    readonly upperZ: {
      readonly value: number;
      readonly status: "PASS" | "FAIL";
    };
    readonly calculatedSigmaLevel: {
      readonly value: number;
      readonly status: "PASS" | "FAIL";
    };
    readonly cp: {
      readonly value: number;
      readonly status: "PASS" | "FAIL";
    };
    readonly lowerCpk: {
      readonly value: number;
      readonly status: "PASS" | "FAIL";
    };
    readonly upperCpk: {
      readonly value: number;
      readonly status: "PASS" | "FAIL";
    };
    readonly calculatedCpk: {
      readonly value: number;
      readonly status: "PASS" | "FAIL";
    };
  };
  readonly defectsPerMillion: {
    readonly lowerDpm: number;
    readonly upperDpm: number;
    readonly totalDpm: number;
    readonly outOfSpecPercent: number;
    readonly yieldPercent: number;
    readonly volume?: number;
    readonly failuresOverVolume?: number;
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

export interface AssumptionResultsCurrentCalculationInput {
  readonly additionalMeanShift: number;
  readonly calculation: KernelCalculationResult;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nearlyEqual(
  left: number,
  right: number,
  absoluteTolerance = 1e-12,
  relativeTolerance = 1e-9,
): boolean {
  return Math.abs(left - right)
    <= Math.max(absoluteTolerance, relativeTolerance * Math.max(Math.abs(left), Math.abs(right)));
}

function isFiniteAndPositive(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function toStatus(value: unknown): "PASS" | "FAIL" {
  return value === "PASS" ? "PASS" : "FAIL";
}

function allFinite(values: readonly unknown[]): values is readonly number[] {
  return values.every((value) => isFiniteNumber(value));
}

function factorIdentityKey(input: {
  readonly worksheetName: string;
  readonly tableId: string;
  readonly sourceRow: number;
  readonly factorName: string;
}): string {
  return JSON.stringify([
    input.worksheetName,
    input.tableId,
    input.sourceRow,
    input.factorName,
  ]);
}

function finiteSystemSpecification(
  session: DeepReadonly<F7SessionSnapshot>,
): {
  readonly lowerSpecLimit: number;
  readonly upperSpecLimit: number;
  readonly targetSigmaLevel: number;
  readonly additionalMeanShift: number;
  readonly volume?: number;
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
  const rawVolume = specification.volume;
  const volume = rawVolume?.status === "available" ? rawVolume.actualValue : undefined;

  if (
    !isFiniteNumber(lowerSpecLimit)
    || !isFiniteNumber(upperSpecLimit)
    || !isFiniteNumber(targetSigmaLevel)
    || !isFiniteNumber(additionalMeanShift)
    || (volume !== undefined && !isNonNegativeInteger(volume))
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
    ...(volume !== undefined ? { volume } : {}),
  };
}

export function buildConfirmedEngineeringEvidence(
  session: DeepReadonly<F7SessionSnapshot>,
  chain: DimensionChainReportProjection,
  currentCalculationInput: AssumptionResultsCurrentCalculationInput,
): AssumptionResultsEngineeringEvidence | undefined {
  if (session.factors.length === 0) return undefined;
  if (currentCalculationInput === undefined) return undefined;

  const system = finiteSystemSpecification(session);
  if (!system) return undefined;

  const confirmedFactors = session.factors.map((factor) => {
    if (factor.setup?.confirmed !== true || factor.evidence === undefined) return undefined;
    if (factor.setup.factorCandidateId !== factor.factorCandidate.factorCandidateId) return undefined;
    if (factor.evidence.factorCandidateId !== factor.factorCandidate.factorCandidateId) return undefined;
    if (factor.evidence.factorCandidateId !== factor.setup.factorCandidateId) return undefined;
    if (factor.evidence.workbookContentHash !== session.workbook.workbookContentHash) return undefined;
    if (factor.evidence.workbookContentHash !== factor.factorCandidate.workbookContentHash) return undefined;
    if (factor.evidence.worksheetName !== factor.factorCandidate.worksheetName) return undefined;
    if (factor.evidence.tableId !== factor.factorCandidate.tableId) return undefined;
    if (factor.evidence.sourceRow !== factor.factorCandidate.sourceRow) return undefined;
    if (factor.evidence.factorName !== factor.factorCandidate.factorName) return undefined;
    if (
      !isFiniteNumber(factor.setup.designNominal)
      || !isFiniteNumber(factor.setup.upperTolerance)
      || !isFiniteNumber(factor.setup.lowerTolerance)
      || !isFiniteAndPositive(factor.setup.longTermSafetyFactor)
      || !isFiniteAndPositive(factor.setup.sigmaLevel)
    ) {
      return undefined;
    }
    if (!isFiniteNumber(factor.evidence.designNominal)
      || !isFiniteNumber(factor.evidence.upperTolerance)
      || !isFiniteNumber(factor.evidence.lowerTolerance)
      || !isFiniteAndPositive(factor.evidence.longTermSafetyFactor)
      || !isFiniteAndPositive(factor.evidence.sigmaLevel)) {
      return undefined;
    }
    if (factor.setup.lowerTolerance >= factor.setup.upperTolerance) return undefined;
    if (factor.evidence.lowerTolerance >= factor.evidence.upperTolerance) return undefined;
    if (!nearlyEqual(factor.setup.designNominal, factor.evidence.designNominal)) return undefined;
    if (!nearlyEqual(factor.setup.upperTolerance, factor.evidence.upperTolerance)) return undefined;
    if (!nearlyEqual(factor.setup.lowerTolerance, factor.evidence.lowerTolerance)) return undefined;
    if (!nearlyEqual(factor.setup.longTermSafetyFactor, factor.evidence.longTermSafetyFactor)) return undefined;
    if (!nearlyEqual(factor.setup.sigmaLevel, factor.evidence.sigmaLevel)) return undefined;
    if (factor.setup.distribution !== factor.evidence.distribution) return undefined;

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

  const designNominalTotal = factors.reduce((sum, { evidence }) => sum + evidence.designNominal, 0);

  if (!isFiniteNumber(currentCalculationInput.additionalMeanShift)) return undefined;
  const calculation = currentCalculationInput.calculation;
  if (!nearlyEqual(currentCalculationInput.additionalMeanShift, calculation.system.shift)) return undefined;
  if (calculation.factorCount !== factors.length || calculation.factors.length !== factors.length) return undefined;
  if (!nearlyEqual(calculation.system.designNominal, designNominalTotal)) return undefined;
  if (!nearlyEqual(calculation.capability.lowerSpecLimit, system.lowerSpecLimit)) return undefined;
  if (!nearlyEqual(calculation.capability.upperSpecLimit, system.upperSpecLimit)) return undefined;
  if (!nearlyEqual(calculation.capability.targetSigmaLevel, system.targetSigmaLevel)) return undefined;
  if (!nearlyEqual(calculation.capability.targetCpk, system.targetSigmaLevel / 3)) return undefined;

  const sessionFactorsByKey = new Map<string, (typeof factors)[number]>();
  for (const entry of factors) {
    const key = factorIdentityKey({
      worksheetName: entry.evidence.worksheetName,
      tableId: entry.evidence.tableId,
      sourceRow: entry.evidence.sourceRow,
      factorName: entry.evidence.factorName,
    });
    if (sessionFactorsByKey.has(key)) return undefined;
    sessionFactorsByKey.set(key, entry);
  }

  const calculationFactorsByKey = new Map<string, KernelCalculationResult["factors"][number]>();
  for (const factor of calculation.factors) {
    const key = factorIdentityKey({
      worksheetName: factor.source.worksheetName,
      tableId: factor.source.tableId,
      sourceRow: factor.source.sourceRow,
      factorName: factor.name,
    });
    if (calculationFactorsByKey.has(key)) return undefined;
    calculationFactorsByKey.set(key, factor);
  }

  if (sessionFactorsByKey.size !== calculationFactorsByKey.size) return undefined;
  for (const [key, { evidence }] of sessionFactorsByKey) {
    const matched = calculationFactorsByKey.get(key);
    if (!matched) return undefined;
    if (matched.unit !== evidence.unit) return undefined;
    if (!nearlyEqual(matched.input.nominalValue, evidence.designNominal)) return undefined;
    if (!nearlyEqual(matched.input.upperTolerance, evidence.upperTolerance)) return undefined;
    if (!nearlyEqual(matched.input.lowerTolerance, evidence.lowerTolerance)) return undefined;
    if (!nearlyEqual(matched.input.longTermSafetyFactor, evidence.longTermSafetyFactor)) return undefined;
    if (!nearlyEqual(matched.input.sigmaLevel, evidence.sigmaLevel)) return undefined;
    if (matched.input.distribution !== DISTRIBUTION_BY_LABEL[evidence.distribution]) return undefined;
  }

  if (!allFinite([
    calculation.system.designNominal,
    calculation.system.mean,
    calculation.system.shift,
    calculation.system.rssSigma,
    calculation.system.worstCaseTolerance,
    calculation.system.worstCaseUpperBound,
    calculation.system.worstCaseLowerBound,
    calculation.system.responseUpperTolerance,
    calculation.system.responseLowerTolerance,
    calculation.capability.lowerSpecLimit,
    calculation.capability.upperSpecLimit,
    calculation.capability.targetCpk,
    calculation.capability.lowerZ,
    calculation.capability.upperZ,
    calculation.capability.z,
    calculation.capability.cp,
    calculation.capability.lowerCpk,
    calculation.capability.upperCpk,
    calculation.capability.cpk,
    calculation.capability.lowerDpm,
    calculation.capability.upperDpm,
    calculation.capability.totalDpm,
    calculation.capability.outOfSpecRatio,
    calculation.capability.yield,
  ])) {
    return undefined;
  }

  const totalContribution = calculation.factors.reduce((sum, factor) => sum + factor.contribution, 0) * 100;
  if (!isFiniteNumber(totalContribution)) return undefined;

  const rows = factors.map(({ evidence }, index) => {
    const key = factorIdentityKey({
      worksheetName: evidence.worksheetName,
      tableId: evidence.tableId,
      sourceRow: evidence.sourceRow,
      factorName: evidence.factorName,
    });
    const kernelFactor = calculationFactorsByKey.get(key);
    if (!kernelFactor) return undefined;
    if (!allFinite([kernelFactor.mean, kernelFactor.halfTolerance, kernelFactor.sigma, kernelFactor.contribution])) {
      return undefined;
    }
    return {
      itemNumber: index + 1,
      factorName: evidence.factorName,
      designNominal: evidence.designNominal,
      upperTolerance: evidence.upperTolerance,
      lowerTolerance: evidence.lowerTolerance,
      longTermSafetyFactor: evidence.longTermSafetyFactor,
      sigmaLevel: evidence.sigmaLevel,
      distribution: evidence.distribution,
      mean: kernelFactor.mean,
      tolerance: kernelFactor.halfTolerance,
      oneSigma: kernelFactor.sigma,
      contributionPercent: kernelFactor.contribution * 100,
    } satisfies AssumptionResultsEngineeringEvidenceFactorRow;
  });

  if (rows.some((row) => row === undefined)) return undefined;

  const safeRows = rows as readonly AssumptionResultsEngineeringEvidenceFactorRow[];
  const sigmaBands = [1, 3, 4, 4.5, 6] as const;
  const responseMean = calculation.system.mean;
  const responseSigma = calculation.system.rssSigma;
  const totalDpm = calculation.capability.totalDpm;
  const failuresOverVolume = system.volume === undefined ? undefined : totalDpm / 1_000_000 * system.volume;

  if (system.volume !== undefined && !isFiniteNumber(failuresOverVolume)) return undefined;

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
        sigmaBands: sigmaBands.map((sigma) => ({
          sigma,
          tolerance: responseSigma * sigma,
          upper: responseMean + responseSigma * sigma,
          lower: responseMean - responseSigma * sigma,
        })),
        worstCase: {
          tolerance: calculation.system.worstCaseTolerance,
          upper: calculation.system.worstCaseUpperBound,
          lower: calculation.system.worstCaseLowerBound,
        },
      },
      responseAndSpecifications: {
        designNominal: calculation.system.designNominal,
        meanResponse: calculation.system.mean - calculation.system.shift,
        additionalMeanShift: calculation.system.shift,
        adjustedMean: calculation.system.mean,
        lowerSpecLimit: calculation.capability.lowerSpecLimit,
        upperSpecLimit: calculation.capability.upperSpecLimit,
        targetSigmaLevel: calculation.capability.targetSigmaLevel,
        targetCpk: calculation.capability.targetCpk,
      },
      sigmaLevelAndCapability: {
        lowerZ: { value: calculation.capability.lowerZ, status: toStatus(calculation.capability.lowerCpkStatus) },
        upperZ: { value: calculation.capability.upperZ, status: toStatus(calculation.capability.upperCpkStatus) },
        calculatedSigmaLevel: { value: calculation.capability.z, status: toStatus(calculation.capability.status) },
        cp: { value: calculation.capability.cp, status: toStatus(calculation.capability.cpStatus) },
        lowerCpk: { value: calculation.capability.lowerCpk, status: toStatus(calculation.capability.lowerCpkStatus) },
        upperCpk: { value: calculation.capability.upperCpk, status: toStatus(calculation.capability.upperCpkStatus) },
        calculatedCpk: { value: calculation.capability.cpk, status: toStatus(calculation.capability.status) },
      },
      defectsPerMillion: {
        lowerDpm: calculation.capability.lowerDpm,
        upperDpm: calculation.capability.upperDpm,
        totalDpm,
        outOfSpecPercent: calculation.capability.outOfSpecRatio * 100,
        yieldPercent: calculation.capability.yield * 100,
        ...(system.volume !== undefined ? { volume: system.volume } : {}),
        ...(failuresOverVolume !== undefined ? { failuresOverVolume } : {}),
      },
    },
  };
}
