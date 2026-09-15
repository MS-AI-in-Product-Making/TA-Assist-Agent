import type { F7SessionSnapshot } from "@ai-assist/contracts";
import type { AssumptionResultsPdfRouteRequest } from "./assumption-results-pdf-contract.js";

function parseSourceSignature(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
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

  const rowMap = new Map(
    request.engineeringEvidence.factorSetup.rows.map((row) => [row.itemNumber, row]),
  );
  if (rowMap.size !== sessionEvidenceRows.length) {
    return { ok: false };
  }

  for (const evidence of sessionEvidenceRows) {
    const row = rowMap.get(evidence.sourceRow);
    if (row === undefined) {
      return { ok: false };
    }
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
    if (request.engineeringEvidence.dimensionChain.factors.length !== sessionEvidenceRows.length) {
      return { ok: false };
    }
    for (const factor of request.engineeringEvidence.dimensionChain.factors) {
      const evidence = sessionFactorMap.get(factor.id);
      if (evidence === undefined) {
        return { ok: false };
      }
      if (factor.itemNumber !== evidence.sourceRow) return { ok: false };
      if (factor.name !== evidence.factorName) return { ok: false };
      if (factor.designNominal !== evidence.designNominal) return { ok: false };
      if (factor.upperTolerance !== evidence.upperTolerance) return { ok: false };
      if (factor.lowerTolerance !== evidence.lowerTolerance) return { ok: false };
      if (factor.longTermSafetyFactor !== evidence.longTermSafetyFactor) return { ok: false };
      if (factor.sigmaLevel !== evidence.sigmaLevel) return { ok: false };
      if (factor.distribution !== evidence.distribution) return { ok: false };
    }

    const sourceSignature = parseSourceSignature(request.engineeringEvidence.dimensionChain.sourceSignature);
    if (sourceSignature && typeof sourceSignature === "object") {
      const signatureRecord = sourceSignature as Record<string, unknown>;
      if (
        typeof signatureRecord.workbookName === "string"
        && signatureRecord.workbookName !== session.workbook.fileName
      ) {
        return { ok: false };
      }
      if (
        typeof signatureRecord.worksheetName === "string"
        && signatureRecord.worksheetName !== sessionWorksheetName
      ) {
        return { ok: false };
      }
      if (Array.isArray(signatureRecord.factorIds)) {
        const signatureIds = new Set(signatureRecord.factorIds.filter(
          (entry): entry is string => typeof entry === "string",
        ));
        if (signatureIds.size !== sessionFactorMap.size) {
          return { ok: false };
        }
        for (const factorId of sessionFactorMap.keys()) {
          if (!signatureIds.has(factorId)) return { ok: false };
        }
      }
    }
  }

  return { ok: true };
}
