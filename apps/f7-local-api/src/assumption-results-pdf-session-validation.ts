import type { F7SessionSnapshot } from "@ai-assist/contracts";
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

export function validateAssumptionResultsPdfRequestAgainstSession(
  request: AssumptionResultsPdfRouteRequest,
  session: F7SessionSnapshot,
): { ok: true } | { ok: false } {
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
    if (row.designNominal !== evidence.designNominal) return { ok: false };
    if (row.upperTolerance !== evidence.upperTolerance) return { ok: false };
    if (row.lowerTolerance !== evidence.lowerTolerance) return { ok: false };
    if (row.longTermSafetyFactor !== evidence.longTermSafetyFactor) return { ok: false };
    if (row.sigmaLevel !== evidence.sigmaLevel) return { ok: false };
    if (row.distribution !== evidence.distribution) return { ok: false };
    if (row.mean !== evidence.calculatedMean) return { ok: false };
    if (row.tolerance !== evidence.tolerance) return { ok: false };
    if (row.oneSigma !== evidence.oneSigma) return { ok: false };
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
      if (factor.designNominal !== evidence.designNominal) return { ok: false };
      if (factor.upperTolerance !== evidence.upperTolerance) return { ok: false };
      if (factor.lowerTolerance !== evidence.lowerTolerance) return { ok: false };
      if (factor.longTermSafetyFactor !== evidence.longTermSafetyFactor) return { ok: false };
      if (factor.sigmaLevel !== evidence.sigmaLevel) return { ok: false };
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

  return { ok: true };
}
