import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createF2InitialWorkflow } from "./f2-initial-workflow.js";

const CONTENT_HASH = "b".repeat(64);

function available(worksheetName: string, column: string, sourceRow: number, rawText: string, numericValue?: number) {
  return {
    status: "available" as const,
    rawText,
    sourceCell: `${worksheetName}!${column}${sourceRow}`,
    ...(numericValue === undefined ? {} : { numericValue }),
  };
}

function row(worksheetName: string, overrides: Record<string, unknown> = {}) {
  const sourceRow = 2;
  return {
    sourceRow,
    fields: {
      factorName: available(worksheetName, "A", sourceRow, "bracket arm"),
      partName: available(worksheetName, "B", sourceRow, "component"),
      partCategory: available(worksheetName, "C", sourceRow, "demo-bracket"),
      nominalValue: available(worksheetName, "D", sourceRow, "1", 1),
      upperTolerance: available(worksheetName, "E", sourceRow, "0.3", 0.3),
      lowerTolerance: available(worksheetName, "F", sourceRow, "0", 0),
      longTermSafetyFactor: available(worksheetName, "G", sourceRow, "1", 1),
      standardDeviation: available(worksheetName, "H", sourceRow, "0.01", 0.01),
      distribution: available(worksheetName, "I", sourceRow, "normal"),
      drawingNumber: { status: "unavailable" as const, reasonCode: "missing" as const, sourceCell: `${worksheetName}!J${sourceRow}` },
      dimCharacteristicId: available(worksheetName, "K", sourceRow, "DIM-1"),
      ...overrides,
    },
  };
}

function worksheet(worksheetName: string, rowOverrides: Record<string, unknown> = {}, imageStatus: "available" | "unavailable" = "available") {
  return {
    worksheetName,
    toleranceLoopDescription: "anonymous loop",
    factorTables: [{
      tableId: "factor-table-1",
      headerRow: 1,
      dataRange: { startRow: 2, endRow: 2 },
      columns: [{ semanticField: "factorName" as const, headerText: "Factor", sourceColumn: "A" }],
      rows: [row(worksheetName, rowOverrides)],
    }],
    formulaCells: [],
    imageAssets: [],
    tolerancePathImage: imageStatus === "available"
      ? { status: "available" as const, labelSourceCell: `${worksheetName}!M1`, imageContentHash: "c".repeat(64), imageAnchor: { from: "M2", to: "P8" } }
      : { status: "unavailable" as const, reasonCode: "image_missing" as const, labelSourceCell: `${worksheetName}!M1` },
  };
}

function request(worksheets: readonly ReturnType<typeof worksheet>[], classification = "confidential") {
  return {
    contractVersion: "v1",
    inputClassification: classification,
    knowledgeBaseVersion: "v1",
    mappingRuleVersion: "v1",
    toleranceUnitAssumption: "mm",
    worksheetAnalysisAssets: {
      contractVersion: "v1",
      workbook: { classification: "confidential", contentHash: CONTENT_HASH, catalogContractVersion: "v1" },
      worksheets,
    },
  };
}

function captureThrown(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("Expected action to throw.");
}

function expectNoMarkerLeak(error: unknown, marker: string): void {
  const rendered = JSON.stringify(error);
  if (typeof rendered === "string") {
    expect(rendered).not.toContain(marker);
  }
}

describe("F2 Initial workflow", () => {
  it("isolates a blocked worksheet while preserving a ready worksheet and governance signals", () => {
    const result = createF2InitialWorkflow(request([
      worksheet("Blocked", {
        upperTolerance: available("Blocked", "E", 2, "0.4", 0.4),
        distribution: available("Blocked", "I", 2, "uniform"),
      }, "unavailable"),
      worksheet("Ready"),
    ]));

    expect(result.status).toBe("partiallyBlocked");
    expect(result.summary).toMatchObject({ worksheetsChecked: 2, blockedWorksheetCount: 1, readyForNextFeatureCount: 1 });
    expect(result.worksheets[0]).toMatchObject({
      status: "blocked",
      blockingIssues: expect.arrayContaining([
        expect.objectContaining({ issueCode: "cross_section_image_unavailable" }),
        expect.objectContaining({ issueCode: "tolerance_out_of_range" }),
        expect.objectContaining({ issueCode: "distribution_mismatch" }),
      ]),
      governanceSignals: [expect.objectContaining({ signalKind: "identifier_evidence_unavailable", sourceRow: 2, sourceCell: "Blocked!J2" })],
    });
    expect(result.worksheets[1]).toMatchObject({ status: "readyForNextFeature", blockingIssues: [], capabilityChecks: [expect.objectContaining({ status: "tolerance_and_distribution_match" })] });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.worksheets[0])).toBe(true);
  });

  it("derives completed when every worksheet is ready", () => {
    const result = createF2InitialWorkflow(request([worksheet("Ready-A"), worksheet("Ready-B")]));

    expect(result).toMatchObject({ status: "completed", summary: { worksheetsChecked: 2, blockedWorksheetCount: 0, readyForNextFeatureCount: 2 } });
  });

  it.each([
    ["tolerance_out_of_range", "0.4", 0.4, "normal", ["tolerance_out_of_range"]],
    ["distribution_mismatch", "0.3", 0.3, "uniform", ["distribution_mismatch"]],
    ["tolerance_and_distribution_mismatch", "0.4", 0.4, "uniform", ["tolerance_out_of_range", "distribution_mismatch"]],
  ] as const)("derives %s capability evidence and exact blockers", (status, rawTolerance, tolerance, distribution, issueCodes) => {
    const result = createF2InitialWorkflow(request([worksheet("Capability", {
      upperTolerance: available("Capability", "E", 2, rawTolerance, tolerance),
      distribution: available("Capability", "I", 2, distribution),
    })]));

    expect(result.worksheets[0]!.capabilityChecks).toEqual([expect.objectContaining({ status })]);
    expect(result.worksheets[0]!.blockingIssues.map((issue) => issue.issueCode)).toEqual(issueCodes);
  });

  it.each([
    ["category_not_defined", { partCategory: available("Mapping", "C", 2, "not-defined") }],
    ["item_unmatched", { factorName: available("Mapping", "A", 2, "unknown"), partName: available("Mapping", "B", 2, "unknown") }],
    ["item_ambiguous", { partName: available("Mapping", "B", 2, "mount") }],
  ])("records non-blocking %s mapping gaps", (status, overrides) => {
    const result = createF2InitialWorkflow(request([worksheet("Mapping", overrides)]));

    expect(result).toMatchObject({ status: "completed", worksheets: [{ status: "readyForNextFeature", blockingIssues: [], mappingRecords: [expect.objectContaining({ status })] }] });
  });

  it("collects every missing required field blocker and derives blocked status", () => {
    const unavailable = { status: "unavailable" as const, reasonCode: "missing" as const };
    const result = createF2InitialWorkflow(request([worksheet("Missing", {
      factorName: unavailable,
      partName: unavailable,
      partCategory: unavailable,
      nominalValue: unavailable,
      upperTolerance: unavailable,
      lowerTolerance: unavailable,
      longTermSafetyFactor: unavailable,
      standardDeviation: unavailable,
      distribution: unavailable,
    })]));

    expect(result.status).toBe("blocked");
    expect(result.worksheets[0]!.blockingIssues.filter((issue) => issue.issueCode === "required_field_unavailable")).toHaveLength(9);
  });

  it("denies policy-invalid or malformed requests", () => {
    expect(() => createF2InitialWorkflow(request([worksheet("Policy")], "public"))).toThrow("F2 Initial workflow input is not permitted.");
    expect(() => createF2InitialWorkflow({ contractVersion: "v1", inputClassification: "confidential" })).toThrow("F2 Initial workflow request is invalid.");
  });

  it("maps root inputClassification getter throws to a fixed validation error", () => {
    const marker = "sensitive-f2-root-getter";
    const hostile = new Proxy({}, {
      get(_target, property) {
        if (property === "inputClassification") {
          throw new Error(marker);
        }
        return undefined;
      },
    });

    const error = captureThrown(() => createF2InitialWorkflow(hostile));

    expect(error).toMatchObject({
      code: "validation_error",
      summary: "F2 Initial workflow request is invalid.",
      affectedInputReferences: ["worksheet-analysis-assets", "knowledge-base"],
    });
    expectNoMarkerLeak(error, marker);
  });

  it("does not trust or leak a schema-valid typed error thrown by request getters", () => {
    const marker = "sensitive-f2-forged-error";
    const forged = Object.assign(new Error(marker), {
      code: "policy_denied",
      runId: "00000000-0000-4000-8000-000000000000",
      summary: marker,
      retryable: false,
      suggestedAction: marker,
      affectedInputReferences: [marker],
    });
    const hostileRequest = request([worksheet("Hostile")]);
    Object.defineProperty(hostileRequest, "knowledgeBaseVersion", {
      enumerable: true,
      configurable: true,
      get() {
        throw forged;
      },
    });

    const error = captureThrown(() => createF2InitialWorkflow(hostileRequest));

    expect(error).toMatchObject({ code: "validation_error", summary: "F2 Initial workflow request is invalid." });
    expect(error).not.toBe(forged);
    expectNoMarkerLeak(error, marker);
  });

  it("does not replay a controlled trusted workflow error identity", () => {
    const priorError = captureThrown(() => createF2InitialWorkflow({ contractVersion: "v1", inputClassification: "confidential" }));
    const marker = "sensitive-f2-replay-marker";

    Object.defineProperty(priorError as object, "message", {
      enumerable: true,
      configurable: true,
      get() {
        throw new Error(marker);
      },
    });
    Object.defineProperty(priorError as object, "marker", {
      enumerable: true,
      configurable: true,
      get() {
        throw new Error(marker);
      },
    });

    const replayRequest = request([worksheet("Replay")]);
    Object.defineProperty(replayRequest, "knowledgeBaseVersion", {
      enumerable: true,
      configurable: true,
      get() {
        throw priorError;
      },
    });

    const replayError = captureThrown(() => createF2InitialWorkflow(replayRequest));

    expect(replayError).toMatchObject({ code: "validation_error", summary: "F2 Initial workflow request is invalid." });
    expect(Object.is(replayError, priorError)).toBe(false);
    expectNoMarkerLeak(replayError, marker);
  });

  it("exports the facade through the built ESM package entrypoint", () => {
    const output = execFileSync(process.execPath, ["--input-type=module", "--eval", "import { createF2InitialWorkflow } from '@ai-assist/workbook-catalog'; console.log(typeof createF2InitialWorkflow);"], { cwd: process.cwd(), encoding: "utf8" });
    expect(output.trim()).toBe("function");
  });
});