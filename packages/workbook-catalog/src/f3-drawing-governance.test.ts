import { describe, expect, it } from "vitest";
import { createF3DrawingGovernance } from "./f3-drawing-governance.js";

const contentHash = "a".repeat(64);

function row(overrides: { drawingNumber?: string | null; dimId?: string | null; sourceRow?: number } = {}) {
  const drawingNumber = overrides.drawingNumber === undefined ? "DRAW-A" : overrides.drawingNumber;
  const dimId = overrides.dimId === undefined ? "307" : overrides.dimId;
  const sourceRow = overrides.sourceRow ?? 14;
  return {
    worksheetName: "Analysis-A",
    tableId: "factor-table-1",
    sourceRow,
    actualFields: {
      factorName: `Anonymous offset ${sourceRow}`,
      partName: "Anonymous bracket",
      drawingNumber,
      dimCharacteristicId: dimId,
      partCategory: "CNC",
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
      factorName: `Analysis-A!E${sourceRow}`,
      partName: `Analysis-A!F${sourceRow}`,
      drawingNumber: `Analysis-A!G${sourceRow}`,
      dimCharacteristicId: `Analysis-A!H${sourceRow}`,
      partCategory: `Analysis-A!I${sourceRow}`,
      nominalValue: `Analysis-A!J${sourceRow}`,
      upperTolerance: `Analysis-A!K${sourceRow}`,
      lowerTolerance: `Analysis-A!L${sourceRow}`,
      standardDeviation: `Analysis-A!N${sourceRow}`,
    },
    missingRequiredFields: [],
    missingIdentifiers: [],
    capabilityStatus: "non_f0_process_category" as const,
    adoReminderRequested: false,
  };
}

function requestWithRows(rows: ReturnType<typeof row>[]) {
  return {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash },
    worksheets: [{
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "Anonymous device gap",
      f2Status: "ready",
      rows,
    }],
  };
}

function requestWithDimId(dimId: string | null) {
  return requestWithRows([row({ dimId })]);
}

describe("createF3DrawingGovernance", () => {
  it.each([
    [null, "missing"],
    ["1", "suspected_invalid"],
    ["12", "valid"],
    ["307", "valid"],
    ["1234", "valid"],
    ["DIM307", "needs_confirmation"],
  ] as const)("classifies %s as %s", (dimId, expected) => {
    const report = createF3DrawingGovernance(requestWithDimId(dimId));

    expect(report.status).toBe(expected === "valid" ? "completed" : "governance_required");
    expect(report.worksheets[0]?.rows[0]?.dimIdStatus).toBe(expected);
  });

  it("allows the same DIM ID on different drawings", () => {
    const report = createF3DrawingGovernance(requestWithRows([
      row({ drawingNumber: "DRAW-A", dimId: "307", sourceRow: 14 }),
      row({ drawingNumber: "DRAW-B", dimId: "307", sourceRow: 15 }),
    ]));

    expect(report.summary.duplicateConflictCount).toBe(0);
    expect(report.worksheets[0]?.rows.every((item) => item.drawingDimensionKey !== undefined)).toBe(true);
  });

  it("flags duplicate DIM IDs only within the same normalized drawing", () => {
    const report = createF3DrawingGovernance(requestWithRows([
      row({ drawingNumber: "DRAW-A", dimId: "307", sourceRow: 14 }),
      row({ drawingNumber: " draw-a ", dimId: "307", sourceRow: 15 }),
    ]));

    expect(report.status).toBe("governance_required");
    expect(report.summary.duplicateConflictCount).toBe(2);
    expect(report.worksheets[0]?.rows.every((item) => item.qualitySignals.includes("duplicate_conflict"))).toBe(true);
  });

  it("omits formal keys until both identifiers are valid", () => {
    const report = createF3DrawingGovernance(requestWithRows([
      row({ drawingNumber: null, dimId: "307", sourceRow: 14 }),
      row({ drawingNumber: "DRAW-A", dimId: "1", sourceRow: 15 }),
    ]));

    expect(report.worksheets[0]?.rows.every((item) => item.drawingDimensionKey === undefined)).toBe(true);
  });

  it("sorts deterministically, freezes output, and does not mutate input", () => {
    const request = requestWithRows([row({ sourceRow: 15 }), row({ sourceRow: 14 })]);
    const snapshot = structuredClone(request);

    const first = createF3DrawingGovernance(request);
    const second = createF3DrawingGovernance(request);

    expect(first).toEqual(second);
    expect(first.worksheets[0]?.rows.map((item) => item.source.sourceRow)).toEqual([14, 15]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.worksheets[0]?.rows[0]?.source)).toBe(true);
    expect(request).toEqual(snapshot);
  });
});