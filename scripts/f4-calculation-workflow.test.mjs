import { describe, expect, it } from "vitest";
import {
  calculationLegacyUnavailableResultSchema,
  f4HandoffReadySchema,
} from "../packages/contracts/dist/contracts.js";
import {
  createCalculation,
  createCalculationRequestFromF4Handoff,
} from "../packages/workbook-catalog/dist/index.js";
import { calculateF4Workflow } from "./f4-calculation-workflow.mjs";

function createHandoff(worksheetName, sourceRow, { workbookContentHash = "a".repeat(64), tableIds = ["factor-table-1"] } = {}) {
  return f4HandoffReadySchema.parse({
    contractVersion: "v1",
    handoffVersion: "f4-handoff-v1",
    inputClassification: "confidential",
    status: "ready",
    workbookContentHash,
    worksheetName,
    toleranceLoopDescription: `Loop ${worksheetName}`,
    systemSpecification: {
      designNominal: -0.05,
      lowerSpecLimit: {
        status: "available",
        actualValue: -0.15,
        displayValue: "-0.15",
        sourceLabel: "*Lower Spec Limit ->",
        sourceCell: `${worksheetName}!P54`,
        valueOrigin: "numeric_literal",
      },
      upperSpecLimit: {
        status: "available",
        actualValue: 0.05,
        displayValue: "0.05",
        sourceLabel: "*Upper Spec Limit ->",
        sourceCell: `${worksheetName}!P55`,
        valueOrigin: "numeric_literal",
      },
      targetSigmaLevel: {
        status: "available",
        actualValue: 3,
        displayValue: "3.0sigma",
        sourceLabel: "*Target sigma Level ->",
        sourceCell: `${worksheetName}!P56`,
        valueOrigin: "numeric_literal",
      },
      targetCpk: 1,
      additionalMeanShift: {
        status: "available",
        actualValue: 0,
        displayValue: "0",
        sourceLabel: "Additional Mean Shift",
        valueOrigin: "defaulted",
      },
    },
    factors: tableIds.map((tableId) => ({
      tableId,
      sourceRow,
      unit: "mm",
      actualFields: {
        factorName: `Factor ${worksheetName}`,
        partName: "Anonymous bracket",
        drawingNumber: "DRAW-A",
        dimCharacteristicId: String(sourceRow),
        partCategory: "Display",
        nominalValue: 3.145,
        upperTolerance: 0.1,
        lowerTolerance: -0.1,
        longTermSafetyFactor: 1,
        sigmaLevel: 4,
        distribution: "Normal",
        mean: 3.145,
        tolerance: 0.1,
        oneSigma: 0.025,
        percentContributionToSigma: 1,
        notes: null,
      },
      sourceCells: {
        factorName: `${worksheetName}!E${sourceRow}`,
        partName: `${worksheetName}!F${sourceRow}`,
        partCategory: `${worksheetName}!H${sourceRow}`,
        nominalValue: `${worksheetName}!I${sourceRow}`,
        upperTolerance: `${worksheetName}!J${sourceRow}`,
        lowerTolerance: `${worksheetName}!K${sourceRow}`,
        longTermSafetyFactor: `${worksheetName}!L${sourceRow}`,
        standardDeviation: `${worksheetName}!M${sourceRow}`,
        distribution: `${worksheetName}!N${sourceRow}`,
      },
    })),
  });
}

function createLoaded(handoffs = [createHandoff("Analysis-B", 22), createHandoff("Analysis-A", 14)]) {
  return {
    status: "accepted",
    reportPath: "Feature2-Report.json",
    workbook: {
      fileName: "Anonymous.xlsx",
      contentHash: "a".repeat(64),
      f1GeneratedAt: "2026-08-03T00:00:00.000Z",
    },
    handoffs,
  };
}

function createCompletedFromHandoff(handoff, index, runId = "f4-run-1") {
  const request = createCalculationRequestFromF4Handoff({
    handoff,
    projectReference: `f4-${handoff.workbookContentHash.slice(0, 16)}`,
    runReference: `${runId}-${index + 1}`,
    criticality: "none",
  });
  const result = createCalculation(request);
  if (result.status !== "completed") throw new Error("expected completed fixture result");
  return result;
}

describe("calculateF4Workflow", () => {
  it("validates the entire batch before dependency calls", () => {
    const createRequestCalls = [];
    const calculateCalls = [];
    const createRequest = (payload) => {
      createRequestCalls.push(payload);
      return payload;
    };
    const calculate = (payload) => {
      calculateCalls.push(payload);
      return createCompletedFromHandoff(payload.handoff, 0, "f4-run-1");
    };

    const oversized = createLoaded(
      Array.from({ length: 101 }, (_, index) => createHandoff(`Analysis-${String(index + 1).padStart(3, "0")}`, index + 2)),
    );
    expect(() => calculateF4Workflow(oversized, { runId: "f4-run-1", createRequest, calculate })).toThrow("F4 workflow calculation failed.");

    const duplicateWorksheet = createLoaded([
      createHandoff("Analysis-A", 11),
      createHandoff("Analysis-A", 12),
    ]);
    expect(() => calculateF4Workflow(duplicateWorksheet, { runId: "f4-run-1", createRequest, calculate })).toThrow("F4 workflow calculation failed.");

    const unsafeWorkbookName = {
      ...createLoaded([createHandoff("Analysis-A", 11)]),
      workbook: {
        ...createLoaded([createHandoff("Analysis-A", 11)]).workbook,
        fileName: "../unsafe.xlsx",
      },
    };
    expect(() => calculateF4Workflow(unsafeWorkbookName, { runId: "f4-run-1", createRequest, calculate })).toThrow("F4 workflow calculation failed.");

    const hashMismatch = createLoaded([
      createHandoff("Analysis-A", 11, { workbookContentHash: "b".repeat(64) }),
    ]);
    expect(() => calculateF4Workflow(hashMismatch, { runId: "f4-run-1", createRequest, calculate })).toThrow("F4 workflow calculation failed.");

    const multipleTableIds = createLoaded([
      createHandoff("Analysis-A", 11, { tableIds: ["factor-table-1", "factor-table-2"] }),
    ]);
    expect(() => calculateF4Workflow(multipleTableIds, { runId: "f4-run-1", createRequest, calculate })).toThrow("F4 workflow calculation failed.");

    expect(createRequestCalls).toHaveLength(0);
    expect(calculateCalls).toHaveLength(0);
  });

  it("processes each handoff exactly once in order with controlled metadata", () => {
    const loaded = createLoaded();
    const callOrder = [];
    const createRequestCalls = [];
    const calculateCalls = [];

    const createRequest = ({ handoff, projectReference, runReference, criticality, ...rest }) => {
      callOrder.push(handoff.worksheetName);
      createRequestCalls.push({ handoff, projectReference, runReference, criticality, rest });
      return { handoff, runReference };
    };

    const calculate = ({ handoff, runReference }) => {
      calculateCalls.push({ worksheetName: handoff.worksheetName, runReference });
      return createCompletedFromHandoff(handoff, Number(runReference.split("-").at(-1)) - 1, "f4-run-1");
    };

    const result = calculateF4Workflow(loaded, {
      runId: "f4-run-1",
      generatedAt: "2026-08-07T00:00:00.000Z",
      createRequest,
      calculate,
    });

    expect(callOrder).toEqual(["Analysis-B", "Analysis-A"]);
    expect(createRequestCalls).toHaveLength(2);
    expect(calculateCalls).toHaveLength(2);
    expect(createRequestCalls.map((call) => call.projectReference)).toEqual([
      "f4-aaaaaaaaaaaaaaaa",
      "f4-aaaaaaaaaaaaaaaa",
    ]);
    expect(createRequestCalls.map((call) => call.runReference)).toEqual(["f4-run-1-1", "f4-run-1-2"]);
    expect(createRequestCalls.map((call) => call.criticality)).toEqual(["none", "none"]);
    expect(createRequestCalls.map((call) => Object.keys(call.rest))).toEqual([[], []]);

    expect(result.summary).toEqual({
      selectedWorksheetCount: 2,
      completedWorksheetCount: 2,
    });
    expect(result.source).toEqual({
      artifactReference: "Feature2-Report.json",
      workbookFileName: "Anonymous.xlsx",
      workbookContentHash: "a".repeat(64),
    });
  });

  it("returns a deep-cloned deeply-frozen result", () => {
    const loaded = createLoaded();
    const generatedResult = JSON.parse(JSON.stringify(createCompletedFromHandoff(loaded.handoffs[0], 0, "f4-run-1")));

    const result = calculateF4Workflow(loaded, {
      runId: "f4-run-1",
      generatedAt: "2026-08-07T00:00:00.000Z",
      createRequest: ({ handoff }) => ({ handoff }),
      calculate: ({ handoff }) => {
        const index = handoff.worksheetName === "Analysis-B" ? 0 : 1;
        return index === 0 ? generatedResult : createCompletedFromHandoff(handoff, 1, "f4-run-1");
      },
    });

    generatedResult.projectReference = "mutated-after-return";

    expect(result.calculations[0].projectReference).toBe("f4-aaaaaaaaaaaaaaaa");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.summary)).toBe(true);
    expect(Object.isFrozen(result.calculations)).toBe(true);
    expect(Object.isFrozen(result.calculations[0])).toBe(true);
    expect(() => {
      result.summary.selectedWorksheetCount = 99;
    }).toThrow();
  });

  it("rejects invalid loaded input and empty handoffs", () => {
    expect(() => calculateF4Workflow(null, { runId: "f4-run-1" })).toThrow("F4 workflow calculation failed.");
    expect(() => calculateF4Workflow({ status: "accepted", workbook: {}, handoffs: [] }, { runId: "f4-run-1" })).toThrow("F4 workflow calculation failed.");
  });

  it("fails closed when calculation result is not completed", () => {
    const loaded = createLoaded([createHandoff("Analysis-B", 22)]);
    const unavailable = calculationLegacyUnavailableResultSchema.parse({
      contractVersion: "v1",
      outputClassification: "confidential",
      featureId: "F4",
      status: "feature_not_available",
      projectReference: "f4-aaaaaaaaaaaaaaaa",
      runReference: "f4-run-1-1",
      worksheetReferences: ["Analysis-B"],
      requiredPrerequisites: ["approved-template-regression", "approved-windows-excel-worker"],
    });

    expect(() => calculateF4Workflow(loaded, {
      runId: "f4-run-1",
      generatedAt: "2026-08-07T00:00:00.000Z",
      createRequest: () => ({ request: true }),
      calculate: () => unavailable,
    })).toThrow("F4 workflow calculation failed.");
  });

  it("fails closed when dependency throws without leaking sensitive markers", () => {
    const loaded = createLoaded([createHandoff("SENSITIVE_MARKER_WORKSHEET", 22)]);

    const thrown = () => calculateF4Workflow(loaded, {
      runId: "f4-run-1",
      createRequest: () => {
        throw new Error("dependency failed with marker SENSITIVE_MARKER_WORKSHEET");
      },
    });

    expect(thrown).toThrow("F4 workflow calculation failed.");
    expect(() => {
      try {
        thrown();
      } catch (error) {
        expect(String(error)).not.toContain("SENSITIVE_MARKER_WORKSHEET");
        throw error;
      }
    }).toThrow();
  });

  it("converts forged external safe-message errors into a fresh generic safe error", () => {
    const loaded = createLoaded([createHandoff("Analysis-B", 22)]);
    const marker = "SENSITIVE_ENUM_MARKER";
    const forged = new Error("F4 workflow calculation failed.");
    Object.defineProperty(forged, "sensitiveMarker", {
      value: marker,
      enumerable: true,
      writable: true,
      configurable: true,
    });

    try {
      calculateF4Workflow(loaded, {
        runId: "f4-run-1",
        createRequest: () => {
          throw forged;
        },
      });
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBe(forged);
      expect(String(error)).toBe("Error: F4 workflow calculation failed.");
      expect("sensitiveMarker" in error).toBe(false);
      expect(JSON.stringify(error)).not.toContain(marker);
    }
  });

  it("does not leak when thrown value has a message getter that throws", () => {
    const loaded = createLoaded([createHandoff("Analysis-B", 22)]);
    const marker = "SENSITIVE_GETTER_MARKER";
    const malicious = new Error("placeholder");
    Object.defineProperty(malicious, "message", {
      enumerable: true,
      configurable: true,
      get() {
        throw new Error(`getter exploded ${marker}`);
      },
    });

    const thrown = () => calculateF4Workflow(loaded, {
      runId: "f4-run-1",
      createRequest: () => {
        throw malicious;
      },
    });

    expect(thrown).toThrow("F4 workflow calculation failed.");
    expect(() => {
      try {
        thrown();
      } catch (error) {
        expect(String(error)).not.toContain(marker);
        expect(JSON.stringify(error)).not.toContain(marker);
        throw error;
      }
    }).toThrow();
  });

  it("fails closed when output contract becomes invalid", () => {
    const loaded = createLoaded([createHandoff("Analysis-B", 22)]);

    expect(() => calculateF4Workflow(loaded, {
      runId: "f4-run-1",
      generatedAt: "2026-08-07T00:00:00.000Z",
      createRequest: () => ({ request: true }),
      calculate: () => ({ status: "completed", unexpected: true }),
    })).toThrow("F4 workflow calculation failed.");
  });

  it("fails closed when calculation workbook hash or worksheet does not match handoff", () => {
    const loaded = createLoaded([createHandoff("Analysis-B", 22)]);
    const completed = createCompletedFromHandoff(loaded.handoffs[0], 0, "f4-run-1");

    expect(() => calculateF4Workflow(loaded, {
      runId: "f4-run-1",
      createRequest: () => ({ request: true }),
      calculate: () => ({ ...completed, workbookContentHash: "b".repeat(64) }),
    })).toThrow("F4 workflow calculation failed.");

    expect(() => calculateF4Workflow(loaded, {
      runId: "f4-run-1",
      createRequest: () => ({ request: true }),
      calculate: () => ({
        ...completed,
        worksheetSelection: { ...completed.worksheetSelection, worksheetName: "Wrong-Sheet" },
      }),
    })).toThrow("F4 workflow calculation failed.");
  });

  it("binds completed result references exactly to generated request and handoff evidence", () => {
    const loaded = createLoaded([createHandoff("Analysis-B", 22)]);
    const completed = createCompletedFromHandoff(loaded.handoffs[0], 0, "f4-run-1");

    expect(() => calculateF4Workflow(loaded, {
      runId: "f4-run-1",
      createRequest: () => ({ request: true }),
      calculate: () => ({ ...completed, projectReference: "f4-tampered-reference" }),
    })).toThrow("F4 workflow calculation failed.");

    expect(() => calculateF4Workflow(loaded, {
      runId: "f4-run-1",
      createRequest: () => ({ request: true }),
      calculate: () => ({ ...completed, runReference: "f4-run-1-99" }),
    })).toThrow("F4 workflow calculation failed.");

    expect(() => calculateF4Workflow(loaded, {
      runId: "f4-run-1",
      createRequest: () => ({ request: true }),
      calculate: () => ({
        ...completed,
        worksheetSelection: { ...completed.worksheetSelection, tableId: "factor-table-2" },
      }),
    })).toThrow("F4 workflow calculation failed.");
  });

  it("fails fast so a later handoff is not called when a prior binding check fails", () => {
    const loaded = createLoaded([
      createHandoff("Analysis-A", 11),
      createHandoff("Analysis-B", 12),
      createHandoff("Analysis-C", 13),
    ]);
    const createRequestCalls = [];
    const calculateCalls = [];

    expect(() => calculateF4Workflow(loaded, {
      runId: "f4-run-1",
      createRequest: (payload) => {
        createRequestCalls.push(payload.handoff.worksheetName);
        return payload;
      },
      calculate: (payload) => {
        calculateCalls.push(payload.handoff.worksheetName);
        const index = Number(payload.runReference.split("-").at(-1)) - 1;
        const completed = createCompletedFromHandoff(payload.handoff, index, "f4-run-1");
        if (payload.handoff.worksheetName === "Analysis-B") {
          return { ...completed, runReference: "f4-run-1-TAMPERED" };
        }
        return completed;
      },
    })).toThrow("F4 workflow calculation failed.");

    expect(createRequestCalls).toEqual(["Analysis-A", "Analysis-B"]);
    expect(calculateCalls).toEqual(["Analysis-A", "Analysis-B"]);
  });

  it("keeps a safe generic error when loaded/options getters or dependency data throw", () => {
    const marker = "SENSITIVE_PROXY_MARKER";
    const loaded = new Proxy({}, {
      get() {
        throw new Error(`read failed ${marker}`);
      },
    });

    const thrownFromLoaded = () => calculateF4Workflow(loaded, { runId: "f4-run-1" });
    expect(thrownFromLoaded).toThrow("F4 workflow calculation failed.");
    expect(() => {
      try {
        thrownFromLoaded();
      } catch (error) {
        expect(String(error)).not.toContain(marker);
        expect(JSON.stringify(error)).not.toContain(marker);
        throw error;
      }
    }).toThrow();

    const safeLoaded = createLoaded([createHandoff("Analysis-A", 11)]);
    const options = new Proxy({}, {
      get(_target, prop) {
        if (prop === "runId") throw new Error(`options exploded ${marker}`);
        return undefined;
      },
      ownKeys() {
        throw new Error(`keys exploded ${marker}`);
      },
    });

    const thrownFromOptions = () => calculateF4Workflow(safeLoaded, options);
    expect(thrownFromOptions).toThrow("F4 workflow calculation failed.");
    expect(() => {
      try {
        thrownFromOptions();
      } catch (error) {
        expect(String(error)).not.toContain(marker);
        expect(JSON.stringify(error)).not.toContain(marker);
        throw error;
      }
    }).toThrow();
  });
});
