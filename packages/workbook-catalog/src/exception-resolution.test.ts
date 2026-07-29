import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createCapabilityValidation } from "./capability-validation.js";
import { createExceptionResolution } from "./exception-resolution.js";
import { createRequiredFieldCheck } from "./required-field-check.js";

const REQUIRED_FIELDS = [
  "factorName",
  "partName",
  "partCategory",
  "nominalValue",
  "upperTolerance",
  "lowerTolerance",
  "longTermSafetyFactor",
  "standardDeviation",
  "distribution",
] as const;
const NUMERIC_FIELDS = new Set(["nominalValue", "upperTolerance", "lowerTolerance", "longTermSafetyFactor", "standardDeviation"]);
const CONTENT_HASH = "a".repeat(64);

function available(field: string, column: string, rawText?: string, numericValue?: number) {
  const numeric = NUMERIC_FIELDS.has(field);
  return {
    status: "available" as const,
    rawText: rawText ?? (numeric ? "1" : `anonymous-${field}`),
    sourceCell: `Analysis-A!${column}2`,
    ...(numeric ? { numericValue: numericValue ?? 1 } : {}),
  };
}

function unavailable() {
  return { status: "unavailable" as const, reasonCode: "missing" as const };
}

function fieldsFor(overrides: Record<string, unknown> = {}) {
  return {
    ...Object.fromEntries(REQUIRED_FIELDS.map((field, index) => [field, available(field, String.fromCharCode(65 + index))])),
    factorName: available("factorName", "A", "anonymous-factor"),
    partName: available("partName", "B", "anonymous-part"),
    partCategory: available("partCategory", "C", "demo-bracket"),
    nominalValue: available("nominalValue", "D", "1", 1),
    upperTolerance: available("upperTolerance", "E", "1", 1),
    lowerTolerance: available("lowerTolerance", "F", "0", 0),
    longTermSafetyFactor: available("longTermSafetyFactor", "G", "1", 1),
    standardDeviation: available("standardDeviation", "H", "1", 1),
    distribution: available("distribution", "I", "normal"),
    unit: available("unit", "J", "mm"),
    ...overrides,
  };
}

function capabilityValidationFor(fields = fieldsFor()) {
  const worksheetAnalysisAssets = {
    contractVersion: "v1" as const,
    workbook: { classification: "confidential" as const, contentHash: CONTENT_HASH, catalogContractVersion: "v1" as const },
    worksheets: [{
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "anonymous",
      factorTables: [{
        tableId: "table-a",
        headerRow: 1,
        dataRange: { startRow: 2, endRow: 2 },
        columns: [{ semanticField: "factorName" as const, headerText: "Factor", sourceColumn: "A" }],
        rows: [{ sourceRow: 2, fields }],
      }],
      formulaCells: [],
      imageAssets: [],
    }],
  };
  const requiredFieldCheck = createRequiredFieldCheck({
    contractVersion: "v1",
    inputClassification: "confidential",
    worksheetAnalysisAssets,
  });
  return createCapabilityValidation({
    contractVersion: "v1",
    inputClassification: "confidential",
    knowledgeBaseVersion: "v1",
    worksheetAnalysisAssets,
    requiredFieldCheck,
  });
}

describe("exception resolution", () => {
  it("requires one valid candidate for each derived F2.2 signal", () => {
    const capabilityValidation = capabilityValidationFor();
    const signalRef = `${CONTENT_HASH}|Analysis-A|table-a|2|tolerance_out_of_library`;
    const request = {
      contractVersion: "v1",
      inputClassification: "confidential",
      capabilityValidation,
    };

    const complete = createExceptionResolution({
      ...request,
      candidates: [{
        signalRef,
        recordedBy: "anonymous-engineer",
        recordedAt: "2026-07-27T10:15:30.000Z",
        rationale: "Anonymous evidence reviewed.",
      }],
    });
    const missing = createExceptionResolution({ ...request, candidates: [] });

    expect(complete).toMatchObject({
      status: "readyToContinue",
      readyToContinue: true,
      acceptedExceptions: [{
        signalRef,
        snapshot: { signalKind: "tolerance_out_of_library", signal: { totalTolerance: 1, unit: "mm" } },
      }],
      summary: { actionableSignalCount: 1, acceptedExceptionCount: 1, pendingExceptionCount: 0, invalidCandidateCount: 0 },
    });
    expect(missing).toMatchObject({
      status: "pendingExceptions",
      readyToContinue: false,
      pendingExceptions: [{ signalRef, reasonCode: "missing_candidate" }],
    });
    expect(Object.isFrozen(complete)).toBe(true);
    expect(Object.isFrozen(complete.acceptedExceptions[0]!)).toBe(true);
    expect(() => { (complete.acceptedExceptions as unknown as unknown[]).push({}); }).toThrow();
  });

  it("exports createExceptionResolution through the built ESM package entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "--eval", "import { createExceptionResolution } from '@ai-assist/workbook-catalog'; console.log(typeof createExceptionResolution);"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output.trim()).toBe("function");
  });

  it("derives one distribution signal and rejects duplicate or semantically invalid candidates", () => {
    const capabilityValidation = capabilityValidationFor(fieldsFor({
      upperTolerance: available("upperTolerance", "E", "0.1", 0.1),
      lowerTolerance: available("lowerTolerance", "F", "-0.05", -0.05),
      distribution: available("distribution", "I", "uniform"),
    }));
    const signalRef = `${CONTENT_HASH}|Analysis-A|table-a|2|distribution_mismatch`;
    const request = {
      contractVersion: "v1",
      inputClassification: "confidential",
      capabilityValidation,
    };

    const duplicate = createExceptionResolution({
      ...request,
      candidates: [
        { signalRef, recordedBy: "anonymous-engineer", recordedAt: "2026-07-27T10:15:30.000Z", rationale: "First." },
        { signalRef, recordedBy: "anonymous-engineer", recordedAt: "2026-07-27T10:15:30.000Z", rationale: "Second." },
      ],
    });
    const invalid = createExceptionResolution({
      ...request,
      candidates: [{ signalRef, recordedBy: "anonymous-engineer", recordedAt: "not-a-timestamp", rationale: " " }],
    });

    expect(duplicate).toMatchObject({
      status: "pendingExceptions",
      pendingExceptions: [{ signalRef, reasonCode: "duplicate_candidate", snapshot: { signalKind: "distribution_mismatch" } }],
      summary: { actionableSignalCount: 1, acceptedExceptionCount: 0, pendingExceptionCount: 1, invalidCandidateCount: 2 },
    });
    expect(invalid).toMatchObject({
      status: "pendingExceptions",
      pendingExceptions: [{ signalRef, reasonCode: "invalid_candidate" }],
      summary: { invalidCandidateCount: 1 },
    });
  });

  it("keeps unknown candidates non-continuable and rejects the F2.1 gate", () => {
    const completed = capabilityValidationFor();
    const unknownCandidateResult = createExceptionResolution({
      contractVersion: "v1",
      inputClassification: "confidential",
      capabilityValidation: completed,
      candidates: [{
        signalRef: `${CONTENT_HASH}|Analysis-A|table-a|2|unknown_signal`,
        recordedBy: "anonymous-engineer",
        recordedAt: "2026-07-27T10:15:30.000Z",
        rationale: "Anonymous evidence reviewed.",
      }],
    });
    const blocked = capabilityValidationFor(fieldsFor({ nominalValue: unavailable() }));

    expect(unknownCandidateResult).toMatchObject({
      status: "pendingExceptions",
      readyToContinue: false,
      summary: { actionableSignalCount: 1, pendingExceptionCount: 1, invalidCandidateCount: 1 },
    });
    expect(() => createExceptionResolution({
      contractVersion: "v1",
      inputClassification: "confidential",
      capabilityValidation: blocked,
      candidates: [],
    })).toThrow("Exception resolution request is invalid.");
  });
});