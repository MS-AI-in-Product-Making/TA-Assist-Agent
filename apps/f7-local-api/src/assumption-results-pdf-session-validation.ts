import type { F7SessionSnapshot, ProcessRequirementComponentCategory } from "@ai-assist/contracts";
import { loadProcessRequirements } from "@ai-assist/knowledge-base/process-requirements";
import {
  calculateToleranceAnalysis,
  isCalculationKernelError,
} from "@ai-assist/workbook-catalog/calculation-kernel";
import type { AssumptionResultsPdfRouteRequest } from "./assumption-results-pdf-contract.js";

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function parseBoundaryKey(key: string): { readonly left: string; readonly right: string } | undefined {
  const parts = key.split("::");
  if (parts.length !== 2) return undefined;
  const [left, right] = parts;
  if (!left || !right) return undefined;
  return { left, right };
}

const IDENTITY_ABSOLUTE_TOLERANCE = 1e-12;
const DERIVED_ABSOLUTE_TOLERANCE = 1e-12;
const DERIVED_RELATIVE_TOLERANCE = 1e-9;
const DERIVED_MAX_ALLOWED_ABSOLUTE_DIFF = 1e-7;

const DISTRIBUTION_BY_LABEL = {
  Normal: "normal",
  Uniform: "uniform",
  Triangular: "triangular",
  Trapezoidal: "trapezoidal",
  Elliptical: "elliptical",
  Beta: "beta",
} as const;

function nearlyEqual(left: number, right: number): boolean {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false;
  }
  const absoluteDifference = Math.abs(left - right);
  if (absoluteDifference > DERIVED_MAX_ALLOWED_ABSOLUTE_DIFF) {
    return false;
  }
  return absoluteDifference <= Math.max(
    DERIVED_ABSOLUTE_TOLERANCE,
    DERIVED_RELATIVE_TOLERANCE * Math.max(Math.abs(left), Math.abs(right)),
  );
}

function sameSessionIdentityNumber(left: number, right: number): boolean {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false;
  }
  return Object.is(left, right) || Math.abs(left - right) <= IDENTITY_ABSOLUTE_TOLERANCE;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validatePriorityRecommendation(
  request: AssumptionResultsPdfRouteRequest,
  sessionEvidenceRows: readonly NonNullable<F7SessionSnapshot["factors"][number]["evidence"]>[],
): boolean {
  const componentCategories = [...new Set(sessionEvidenceRows.flatMap((evidence) => {
    const category = evidence.componentCategory as ProcessRequirementComponentCategory | undefined;
    return category === undefined ? [] : [category];
  }))].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  if (componentCategories.length === 0) {
    return request.priorityRecommendation === undefined;
  }

  const evaluation = loadProcessRequirements({ version: "process-requirements-v3" })
    .evaluateProcessRequirements({
      actor: "all",
      analysisMethod: "one-dimensional-rss",
      toleranceCount: sessionEvidenceRows.length,
      componentCategories,
    });
  const expected = evaluation.status === "matched" ? evaluation.priorityRecommendation : undefined;
  const actual = request.priorityRecommendation;
  return expected !== undefined
    && actual !== undefined
    && actual.selectedPriority === expected.selectedPriority
    && actual.requiresMeDmAlignment === expected.requiresMeDmAlignment;
}

function toStatus(value: "PASS" | "FAIL"): "PASS" | "FAIL" {
  return value;
}

function validateDerivedEngineeringEvidence(
  request: AssumptionResultsPdfRouteRequest,
  sessionEvidenceRows: readonly NonNullable<F7SessionSnapshot["factors"][number]["evidence"]>[],
  session: F7SessionSnapshot,
  calculate: typeof calculateToleranceAnalysis,
): boolean {
  const specification = session.systemSpecification;
  if (
    specification?.status !== "available"
    || specification.lowerSpecLimit.status !== "available"
    || specification.upperSpecLimit.status !== "available"
    || specification.targetSigmaLevel.status !== "available"
    || specification.additionalMeanShift.status !== "available"
  ) {
    return false;
  }

  const additionalMeanShift = request.engineeringEvidence.factorSetup.footer.additionalMeanShift;

  const kernelFactors = sessionEvidenceRows.map((evidence) => ({
    source: {
      worksheetName: evidence.worksheetName,
      tableId: evidence.tableId,
      sourceRow: evidence.sourceRow,
    },
    name: evidence.factorName,
    unit: evidence.unit,
    input: {
      nominalValue: evidence.designNominal,
      upperTolerance: evidence.upperTolerance,
      lowerTolerance: evidence.lowerTolerance,
      longTermSafetyFactor: evidence.longTermSafetyFactor,
      sigmaLevel: evidence.sigmaLevel,
      distribution: DISTRIBUTION_BY_LABEL[evidence.distribution],
    },
  }));

  let kernel;
  try {
    kernel = calculate({
      factors: kernelFactors,
      system: {
        designNominal: kernelFactors.reduce((sum, factor) => sum + factor.input.nominalValue, 0),
        lowerSpecLimit: specification.lowerSpecLimit.actualValue,
        upperSpecLimit: specification.upperSpecLimit.actualValue,
        targetSigmaLevel: specification.targetSigmaLevel.actualValue,
        targetCpk: specification.targetSigmaLevel.actualValue / 3,
        shift: additionalMeanShift,
      },
    });
  } catch (error) {
    if (isCalculationKernelError(error)) {
      return false;
    }
    throw error;
  }

  const factorByKey = new Map(kernel.factors.map((factor) => [
    JSON.stringify([factor.source.worksheetName, factor.source.tableId, factor.source.sourceRow, factor.name]),
    factor,
  ]));

  for (const evidenceRow of request.engineeringEvidence.factorSetup.rows) {
    const sourceEvidence = sessionEvidenceRows[evidenceRow.itemNumber - 1];
    if (!sourceEvidence) return false;
    const key = JSON.stringify([
      sourceEvidence.worksheetName,
      sourceEvidence.tableId,
      sourceEvidence.sourceRow,
      sourceEvidence.factorName,
    ]);
    const factor = factorByKey.get(key);
    if (!factor) return false;
    if (!nearlyEqual(evidenceRow.mean, factor.mean)) return false;
    if (!nearlyEqual(evidenceRow.tolerance, factor.halfTolerance)) return false;
    if (!nearlyEqual(evidenceRow.oneSigma, factor.sigma)) return false;
    if (!nearlyEqual(evidenceRow.contributionPercent, factor.contribution * 100)) return false;
  }

  const contributionTotalPercent = kernel.factors.reduce((sum, factor) => sum + factor.contribution, 0) * 100;
  const footer = request.engineeringEvidence.factorSetup.footer;
  if (!nearlyEqual(footer.designNominalTotal, kernel.system.designNominal)) return false;
  if (!nearlyEqual(footer.upperWorstCaseTolerance, kernel.system.responseUpperTolerance)) return false;
  if (!nearlyEqual(footer.lowerWorstCaseTolerance, kernel.system.responseLowerTolerance)) return false;
  if (!nearlyEqual(footer.meanResponse, kernel.system.mean - kernel.system.shift)) return false;
  if (!nearlyEqual(footer.rssTolerance, kernel.system.rssSigma * 3)) return false;
  if (!nearlyEqual(footer.rssSigma, kernel.system.rssSigma)) return false;
  if (!nearlyEqual(footer.contributionTotalPercent, contributionTotalPercent)) return false;
  if (!nearlyEqual(footer.adjustedMean, kernel.system.mean)) return false;

  const distribution = request.engineeringEvidence.responseDistribution;
  if (!nearlyEqual(distribution.mean, kernel.system.mean)) return false;
  if (!nearlyEqual(distribution.standardDeviation, kernel.system.rssSigma)) return false;
  if (!nearlyEqual(distribution.lowerSpecLimit, kernel.capability.lowerSpecLimit)) return false;
  if (!nearlyEqual(distribution.upperSpecLimit, kernel.capability.upperSpecLimit)) return false;
  if (!nearlyEqual(distribution.target, kernel.system.designNominal)) return false;

  const summary = request.engineeringEvidence.responseSummary;
  const expectedSigmaBands = [1, 3, 4, 4.5, 6] as const;
  if (summary.rssAndWorstCase.sigmaBands.length !== expectedSigmaBands.length) return false;
  for (const [index, sigma] of expectedSigmaBands.entries()) {
    const sigmaBand = summary.rssAndWorstCase.sigmaBands[index];
    if (!sigmaBand || sigmaBand.sigma !== sigma) return false;
    if (!nearlyEqual(sigmaBand.tolerance, kernel.system.rssSigma * sigma)) return false;
    if (!nearlyEqual(sigmaBand.upper, kernel.system.mean + kernel.system.rssSigma * sigma)) return false;
    if (!nearlyEqual(sigmaBand.lower, kernel.system.mean - kernel.system.rssSigma * sigma)) return false;
  }

  if (!nearlyEqual(summary.rssAndWorstCase.worstCase.tolerance, kernel.system.worstCaseTolerance)) return false;
  if (!nearlyEqual(summary.rssAndWorstCase.worstCase.upper, kernel.system.worstCaseUpperBound)) return false;
  if (!nearlyEqual(summary.rssAndWorstCase.worstCase.lower, kernel.system.worstCaseLowerBound)) return false;

  if (!nearlyEqual(summary.responseAndSpecifications.designNominal, kernel.system.designNominal)) return false;
  if (!nearlyEqual(summary.responseAndSpecifications.meanResponse, kernel.system.mean - kernel.system.shift)) return false;
  if (!nearlyEqual(summary.responseAndSpecifications.additionalMeanShift, kernel.system.shift)) return false;
  if (!nearlyEqual(summary.responseAndSpecifications.adjustedMean, kernel.system.mean)) return false;
  if (!nearlyEqual(summary.responseAndSpecifications.lowerSpecLimit, kernel.capability.lowerSpecLimit)) return false;
  if (!nearlyEqual(summary.responseAndSpecifications.upperSpecLimit, kernel.capability.upperSpecLimit)) return false;
  if (!nearlyEqual(summary.responseAndSpecifications.targetSigmaLevel, kernel.capability.targetSigmaLevel)) return false;
  if (!nearlyEqual(summary.responseAndSpecifications.targetCpk, kernel.capability.targetCpk)) return false;

  if (!nearlyEqual(summary.sigmaLevelAndCapability.lowerZ.value, kernel.capability.lowerZ)) return false;
  if (summary.sigmaLevelAndCapability.lowerZ.status !== toStatus(kernel.capability.lowerCpkStatus)) return false;
  if (!nearlyEqual(summary.sigmaLevelAndCapability.upperZ.value, kernel.capability.upperZ)) return false;
  if (summary.sigmaLevelAndCapability.upperZ.status !== toStatus(kernel.capability.upperCpkStatus)) return false;
  if (!nearlyEqual(summary.sigmaLevelAndCapability.calculatedSigmaLevel.value, kernel.capability.z)) return false;
  if (summary.sigmaLevelAndCapability.calculatedSigmaLevel.status !== toStatus(kernel.capability.status)) return false;
  if (!nearlyEqual(summary.sigmaLevelAndCapability.cp.value, kernel.capability.cp)) return false;
  if (summary.sigmaLevelAndCapability.cp.status !== toStatus(kernel.capability.cpStatus)) return false;
  if (!nearlyEqual(summary.sigmaLevelAndCapability.lowerCpk.value, kernel.capability.lowerCpk)) return false;
  if (summary.sigmaLevelAndCapability.lowerCpk.status !== toStatus(kernel.capability.lowerCpkStatus)) return false;
  if (!nearlyEqual(summary.sigmaLevelAndCapability.upperCpk.value, kernel.capability.upperCpk)) return false;
  if (summary.sigmaLevelAndCapability.upperCpk.status !== toStatus(kernel.capability.upperCpkStatus)) return false;
  if (!nearlyEqual(summary.sigmaLevelAndCapability.calculatedCpk.value, kernel.capability.cpk)) return false;
  if (summary.sigmaLevelAndCapability.calculatedCpk.status !== toStatus(kernel.capability.status)) return false;

  const dpm = summary.defectsPerMillion;
  if (!nearlyEqual(dpm.lowerDpm, kernel.capability.lowerDpm)) return false;
  if (!nearlyEqual(dpm.upperDpm, kernel.capability.upperDpm)) return false;
  if (!nearlyEqual(dpm.totalDpm, kernel.capability.totalDpm)) return false;
  if (!nearlyEqual(dpm.outOfSpecPercent, kernel.capability.outOfSpecRatio * 100)) return false;
  if (!nearlyEqual(dpm.yieldPercent, kernel.capability.yield * 100)) return false;

  const sessionVolume = specification.volume?.status === "available"
    ? specification.volume.actualValue
    : undefined;
  const requestVolume = dpm.volume;
  const requestFailuresOverVolume = dpm.failuresOverVolume;
  if (sessionVolume === undefined) {
    if (requestVolume !== undefined || requestFailuresOverVolume !== undefined) return false;
  } else {
    if (requestVolume === undefined || requestFailuresOverVolume === undefined) return false;
    if (!finiteNumber(requestVolume) || !finiteNumber(requestFailuresOverVolume)) return false;
    if (!nearlyEqual(requestVolume, sessionVolume)) return false;
    const expectedFailuresOverVolume = kernel.capability.totalDpm / 1_000_000 * sessionVolume;
    if (!nearlyEqual(requestFailuresOverVolume, expectedFailuresOverVolume)) return false;
  }

  return true;
}

export function validateAssumptionResultsPdfRequestAgainstSession(
  request: AssumptionResultsPdfRouteRequest,
  session: F7SessionSnapshot,
  dependencies: {
    readonly calculateToleranceAnalysis?: typeof calculateToleranceAnalysis;
  } = {},
): { ok: true } | { ok: false } {
  const calculate = dependencies.calculateToleranceAnalysis ?? calculateToleranceAnalysis;

  if (request.workbookName !== session.workbook.fileName) {
    return { ok: false };
  }

  const sessionEvidenceRows = session.factors
    .map((factorState) => factorState.evidence)
    .filter((evidence): evidence is NonNullable<typeof evidence> => evidence !== undefined);
  if (sessionEvidenceRows.length === 0) {
    return { ok: false };
  }

  const worksheetNames = new Set(sessionEvidenceRows.map((evidence) => evidence.worksheetName));
  if (worksheetNames.size !== 1) {
    return { ok: false };
  }
  const [sessionWorksheetName] = [...worksheetNames];
  if (sessionWorksheetName === undefined || request.worksheetName !== sessionWorksheetName) {
    return { ok: false };
  }

  const setupRows = request.engineeringEvidence.factorSetup.rows;
  if (setupRows.length !== sessionEvidenceRows.length) {
    return { ok: false };
  }

  for (const [index, evidence] of sessionEvidenceRows.entries()) {
    const row = setupRows[index];
    if (row === undefined) {
      return { ok: false };
    }
    if (row.itemNumber !== index + 1) return { ok: false };
    if (row.factorName !== evidence.factorName) return { ok: false };
    if (!sameSessionIdentityNumber(row.designNominal, evidence.designNominal)) return { ok: false };
    if (!sameSessionIdentityNumber(row.upperTolerance, evidence.upperTolerance)) return { ok: false };
    if (!sameSessionIdentityNumber(row.lowerTolerance, evidence.lowerTolerance)) return { ok: false };
    if (!sameSessionIdentityNumber(row.longTermSafetyFactor, evidence.longTermSafetyFactor)) return { ok: false };
    if (!sameSessionIdentityNumber(row.sigmaLevel, evidence.sigmaLevel)) return { ok: false };
    if (row.distribution !== evidence.distribution) return { ok: false };
    if (!sameSessionIdentityNumber(row.mean, evidence.calculatedMean)) return { ok: false };
    if (!sameSessionIdentityNumber(row.tolerance, evidence.tolerance)) return { ok: false };
    if (!sameSessionIdentityNumber(row.oneSigma, evidence.oneSigma)) return { ok: false };
  }

  const sessionFactorMap = new Map(sessionEvidenceRows.map((evidence) => [evidence.factorId, evidence]));
  if (request.engineeringEvidence.dimensionChain.status === "generated") {
    const generatedChain = request.engineeringEvidence.dimensionChain;
    if (generatedChain.factors.length !== sessionEvidenceRows.length) {
      return { ok: false };
    }

    const sessionFactorIds = sessionEvidenceRows.map((evidence) => evidence.factorId);
    const generatedFactorIds = generatedChain.factors.map((factor) => factor.id);
    if (!hasUniqueValues(sessionFactorIds) || !hasUniqueValues(generatedFactorIds)) {
      return { ok: false };
    }
    if (generatedFactorIds.length !== sessionFactorIds.length) return { ok: false };
    const sessionIdSet = new Set(sessionFactorIds);
    const generatedIdSet = new Set(generatedFactorIds);
    if (sessionIdSet.size !== generatedIdSet.size) return { ok: false };
    for (const factorId of sessionIdSet) {
      if (!generatedIdSet.has(factorId)) return { ok: false };
    }

    for (const [index, factor] of generatedChain.factors.entries()) {
      const evidence = sessionFactorMap.get(factor.id);
      if (evidence === undefined) {
        return { ok: false };
      }
      if (factor.itemNumber !== index + 1) return { ok: false };
      if (evidence.factorId !== sessionFactorIds[index]) return { ok: false };
      if (factor.name !== evidence.factorName) return { ok: false };
      if (!sameSessionIdentityNumber(factor.designNominal, evidence.designNominal)) return { ok: false };
      if (!sameSessionIdentityNumber(factor.upperTolerance, evidence.upperTolerance)) return { ok: false };
      if (!sameSessionIdentityNumber(factor.lowerTolerance, evidence.lowerTolerance)) return { ok: false };
      if (!sameSessionIdentityNumber(factor.longTermSafetyFactor, evidence.longTermSafetyFactor)) return { ok: false };
      if (!sameSessionIdentityNumber(factor.sigmaLevel, evidence.sigmaLevel)) return { ok: false };
      if (factor.distribution !== evidence.distribution) return { ok: false };
    }

    if (!hasUniqueValues(generatedChain.reversedFactorIds)) {
      return { ok: false };
    }
    for (const reversedFactorId of generatedChain.reversedFactorIds) {
      if (!generatedIdSet.has(reversedFactorId)) {
        return { ok: false };
      }
    }

    const validBoundaryKeys = new Set(generatedChain.factors.slice(1).map((factor, index) => (
      `${generatedChain.factors[index]!.id}::${factor.id}`
    )));
    for (const key of Object.keys(generatedChain.manualLayout.boundaryOffsets)) {
      const parsed = parseBoundaryKey(key);
      if (parsed === undefined) {
        return { ok: false };
      }
      if (!generatedIdSet.has(parsed.left) || !generatedIdSet.has(parsed.right)) {
        return { ok: false };
      }
      if (!validBoundaryKeys.has(key)) {
        return { ok: false };
      }
    }
    for (const key of Object.keys(generatedChain.manualLayout.laneOffsets)) {
      if (!generatedIdSet.has(key)) {
        return { ok: false };
      }
    }
  }

  if (!validateDerivedEngineeringEvidence(request, sessionEvidenceRows, session, calculate)) {
    return { ok: false };
  }
  if (!validatePriorityRecommendation(request, sessionEvidenceRows)) {
    return { ok: false };
  }

  return { ok: true };
}
