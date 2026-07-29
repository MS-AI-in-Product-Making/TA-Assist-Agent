import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createUnifiedExceptionResolution } from "./unified-exception-resolution.js";

const CONTENT_HASH = "a".repeat(64);
const capabilityValidation = {
  contractVersion: "v1" as const,
  inputClassification: "confidential" as const,
  knowledgeBaseVersion: "v1" as const,
  workbookContentHash: CONTENT_HASH,
  status: "completed" as const,
  rows: [{
    worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 2, factorName: "anonymous-factor",
    tolerance: { status: "out_of_library" as const, totalTolerance: 0.2, unit: "mm" as const },
    distribution: { status: "not_applicable" as const },
  }],
  summary: { factorRowsChecked: 1, inLibraryCount: 0, outOfLibraryCount: 1, toleranceUnableToValidateCount: 0, distributionMatchCount: 0, distributionMismatchCount: 0, distributionUnableToValidateCount: 0, distributionNotApplicableCount: 1 },
};
const identifierQualityCheck = {
  contractVersion: "v1" as const,
  inputClassification: "confidential" as const,
  workbookContentHash: CONTENT_HASH,
  status: "completed" as const,
  signals: [{ signalKind: "identifier_missing" as const, worksheetName: "Analysis-A", tableId: "table-a", field: "drawingNumber" as const, sourceRows: [2] }],
  summary: { factorRowsChecked: 1, actionableSignalCount: 1, identifierMissingCount: 1, identifierEvidenceUnavailableCount: 0, identifierTextInvalidCount: 0, dimIdDuplicateCount: 0 },
};
const capabilityRef = `${CONTENT_HASH}|capability_validation|Analysis-A|table-a|2|tolerance_out_of_library`;
const identifierRef = `${CONTENT_HASH}|identifier_quality|Analysis-A|table-a|drawingNumber|identifier_missing|`;
const candidate = (signalRef: string) => ({ signalRef, recordedBy: "anonymous-engineer", recordedAt: "2026-07-27T10:15:30.000Z", rationale: "Anonymous evidence reviewed." });

describe("unified exception resolution", () => {
  it("requires one valid candidate for every current F2.2 and F2.4 signal", () => {
    const complete = createUnifiedExceptionResolution({ contractVersion: "v2", inputClassification: "confidential", capabilityValidation, identifierQualityCheck, candidates: [candidate(capabilityRef), candidate(identifierRef)] });
    const missing = createUnifiedExceptionResolution({ contractVersion: "v2", inputClassification: "confidential", capabilityValidation, identifierQualityCheck, candidates: [candidate(capabilityRef)] });

    expect(complete).toMatchObject({ status: "readyToContinue", readyToContinue: true, summary: { actionableSignalCount: 2, capabilitySignalCount: 1, identifierSignalCount: 1, acceptedExceptionCount: 2, invalidCandidateCount: 0 } });
    expect(complete.acceptedExceptions.map((entry) => entry.snapshot.source)).toEqual(["capability_validation", "identifier_quality"]);
    expect(missing).toMatchObject({ status: "pendingExceptions", readyToContinue: false, pendingExceptions: [{ signalRef: identifierRef, reasonCode: "missing_candidate" }] });
    expect(Object.isFrozen(complete)).toBe(true);
  });

  it("exports createUnifiedExceptionResolution through the built ESM package entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", "import { createUnifiedExceptionResolution } from '@ai-assist/workbook-catalog'; console.log(typeof createUnifiedExceptionResolution);"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output.trim()).toBe("function");
  });
});
