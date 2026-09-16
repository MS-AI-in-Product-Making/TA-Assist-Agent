import { describe, expect, it } from "vitest";
import type {
  AdoTraceabilityV3,
  CalculationCompletedResult,
  DrawingGovernanceResultV3,
  F2UserReport,
  F6AnalysisContext,
} from "@ai-assist/contracts";
import { classifyWorksheetDomain, createF6ProcessChecks, type F6ProcessCheck } from "./f6-process-requirements.js";

type F2Worksheet = F2UserReport["worksheets"][number];
type F3Worksheet = Extract<DrawingGovernanceResultV3, { status: "completed" | "governance_required" }>["worksheets"][number];

interface FixtureOverrides {
  readonly factorCount?: number;
  readonly worksheetName?: string;
  readonly toleranceLoopDescription?: string;
  readonly currentSigma?: number;
  readonly targetSigma?: number | null;
  readonly lowerSpecLimitStatus?: "available" | "unavailable";
  readonly upperSpecLimitStatus?: "available" | "unavailable";
  readonly missingRequiredFields?: readonly string[];
  readonly missingIdentifiers?: readonly ("dimCharacteristicId" | "drawingNumber" | "partNumber")[];
  readonly f4CalculabilityIssues?: readonly { readonly reasonCode: "factor_tolerance_range_invalid"; readonly sourceRow: number }[];
  readonly f3GovernanceStatus?: "complete" | "needs_governance" | "blocked_for_reminder";
  readonly f3Ado?: AdoTraceabilityV3;
  readonly analysisObjectKind?: "GAP" | "STEP" | "FUNCTIONAL_DIMENSION";
  readonly includeAnalysisContext?: boolean;
}

const hash = "a".repeat(64);
const worksheet = "Gap_Stack";
const tableId = "factor-table-1";

function sourceCell(row: number, column: string): string {
  return `${worksheet}!${column}${row}`;
}

function actualFields(row: number) {
  return {
    factorName: `Factor ${row}`,
    partName: `Part ${row}`,
    drawingNumber: `DWG-${row}`,
    dimCharacteristicId: `DIM-${row}`,
    partCategory: "Gap bracket",
    nominalValue: 10,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    distribution: "normal",
    mean: 10,
    tolerance: 0.2,
    oneSigma: 0.025,
    percentContributionToSigma: 100,
    notes: null,
  };
}

function sourceCells(row: number) {
  return {
    factorName: sourceCell(row, "A"),
    partName: sourceCell(row, "B"),
    drawingNumber: sourceCell(row, "C"),
    dimCharacteristicId: sourceCell(row, "D"),
    partCategory: sourceCell(row, "E"),
    nominalValue: sourceCell(row, "F"),
    upperTolerance: sourceCell(row, "G"),
    lowerTolerance: sourceCell(row, "H"),
    longTermSafetyFactor: sourceCell(row, "I"),
    standardDeviation: sourceCell(row, "J"),
    distribution: sourceCell(row, "K"),
  };
}

function f2Rows(count: number, overrides: FixtureOverrides) {
  return Array.from({ length: count }, (_, index) => {
    const row = index + 2;
    return {
      worksheetName: overrides.worksheetName ?? worksheet,
      tableId,
      sourceRow: row,
      factorOrdinal: { value: String(index + 1), rawText: String(index + 1) },
      actualFields: actualFields(row),
      displayFields: Object.fromEntries(Object.entries(actualFields(row)).map(([key, value]) => [key, value === null ? null : String(value)])),
      sourceCells: sourceCells(row),
      imageReference: {
        artifact: "f1" as const,
        relativePath: `images/${row}.png`,
        contentHash: hash,
        worksheetName: overrides.worksheetName ?? worksheet,
      },
      missingRequiredFields: index === 0 ? [...(overrides.missingRequiredFields ?? [])] : [],
      missingIdentifiers: index === 0 ? [...(overrides.missingIdentifiers ?? [])] : [],
      capabilityStatus: "internal_within_guidance" as const,
      f0KnowledgeBaseVersion: "internal-v1" as const,
      recommendation: {
        kind: "internal-guidance" as const,
        assessedTotalBand: 0.2,
        maximumRecommendedTotalBand: 0.3,
        unit: "mm" as const,
        matchedEntryId: "internal-gap",
        fallbackApplied: false,
        evidence: { sourceFileHash: hash, sheetName: "Guidance", sourceRange: "A1:D2" },
      },
      adoReminderRequested: false,
    };
  });
}

function evidenceNumber(value: number, field: string) {
  return { status: "available" as const, sourceCell: `${worksheet}!${field}1`, displayValue: String(value), actualValue: value, valueOrigin: "numeric_literal" as const };
}

function unavailableEvidence(field: string) {
  return { status: "unavailable" as const, reasonCode: "response_summary_value_missing" as const, sourceCell: `${worksheet}!${field}1`, displayValue: "", actualValue: "", valueOrigin: "missing" as const };
}

function f2Worksheet(overrides: FixtureOverrides = {}): F2Worksheet {
  const count = overrides.factorCount ?? 4;
  const lowerSpecLimit = overrides.lowerSpecLimitStatus === "unavailable" ? unavailableEvidence("LSL") : evidenceNumber(9, "LSL");
  const upperSpecLimit = overrides.upperSpecLimitStatus === "unavailable" ? unavailableEvidence("USL") : evidenceNumber(11, "USL");
  const targetSigmaLevel = overrides.targetSigma === null ? unavailableEvidence("SIGMA") : evidenceNumber(overrides.targetSigma ?? 4, "SIGMA");
  return {
    worksheetName: overrides.worksheetName ?? worksheet,
    toleranceLoopDescription: overrides.toleranceLoopDescription ?? "Gap stack requirement",
    tolerancePathImageStatus: "available",
    systemSpecification: {
      status: lowerSpecLimit.status === "available" && upperSpecLimit.status === "available" && targetSigmaLevel.status === "available" ? "available" : "unavailable",
      designNominal: evidenceNumber(10, "NOM"),
      lowerSpecLimit,
      upperSpecLimit,
      targetSigmaLevel,
      additionalMeanShift: evidenceNumber(0, "SHIFT"),
    },
    systemSpecificationIssues: targetSigmaLevel.status === "available" ? [] : [{ field: "targetSigmaLevel", reasonCode: "response_summary_value_missing" }],
    f4CalculabilityIssues: [...(overrides.f4CalculabilityIssues ?? [])],
    status: "ready",
    rows: f2Rows(count, overrides),
    missingFieldSummary: [],
  } as F2Worksheet;
}

function f3Worksheet(overrides: FixtureOverrides = {}): F3Worksheet {
  const rows = f2Rows(overrides.factorCount ?? 4, overrides).map((row, index) => ({
    factorInstanceId: hash,
    factorOrdinal: row.factorOrdinal,
    drawingDimensionKey: row.missingIdentifiers.includes("drawingNumber") || row.missingIdentifiers.includes("dimCharacteristicId") ? undefined : hash,
    deviceLevelDim: `Device dim ${row.sourceRow}`,
    dimensionDescription: "Gap stack closure",
    partCategory: "Gap bracket",
    partSubsystem: "Display",
    drawingNumber: row.missingIdentifiers.includes("drawingNumber") ? null : `DWG-${row.sourceRow}`,
    dimId: row.missingIdentifiers.includes("dimCharacteristicId") ? null : `DIM-${row.sourceRow}`,
    factorDescription: `Factor ${row.sourceRow}`,
    nominal: 10,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    sigmaLevel: 4,
    dimIdStatus: row.missingIdentifiers.includes("dimCharacteristicId") ? "missing" as const : "valid" as const,
    qualitySignals: row.missingIdentifiers.includes("drawingNumber") ? ["drawing_number_missing" as const] : [],
    governanceStatus: index === 0 ? overrides.f3GovernanceStatus ?? "complete" as const : "complete" as const,
    imageReference: row.imageReference!,
    source: { worksheetName: row.worksheetName, tableId: row.tableId, sourceRow: row.sourceRow, sourceCells: row.sourceCells },
  }));
  return {
    worksheetName: overrides.worksheetName ?? worksheet,
    toleranceLoopDescription: overrides.toleranceLoopDescription ?? "Gap stack requirement",
    rows,
  } as F3Worksheet;
}

function calculation(overrides: FixtureOverrides = {}): CalculationCompletedResult {
  const count = overrides.factorCount ?? 4;
  return {
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F4",
    status: "completed",
    calculationVersion: "excel-ta-v1",
    projectReference: "project",
    runReference: "run",
    workbookContentHash: hash,
    worksheetSelection: { worksheetName: overrides.worksheetName ?? worksheet, tableId },
    factorCount: count,
    recommendation: { method: "monte_carlo", reason: "factor_count_4_to_10", refer3d: false, criticality: "none", criticalityRisk: false },
    factors: f2Rows(count, overrides).map((row, index) => ({
      factorName: `Factor ${index + 1}`,
      unit: "mm",
      source: { worksheetName: row.worksheetName, tableId, sourceRow: row.sourceRow },
      input: { nominalValue: 10, upperTolerance: 0.1, lowerTolerance: -0.1, longTermSafetyFactor: 1, sigmaLevel: overrides.currentSigma ?? 4, distribution: "normal" },
      mean: 10,
      halfTolerance: 0.1,
      sigma: 0.025,
      contribution: 1 / count,
      trace: { formulaIds: ["factor-mean-v1", "factor-sigma-v1"], sourceCells: [`${worksheet}!A${row.sourceRow}`] },
    })),
    system: { designNominal: 10, mean: 10, additionalMeanShift: 0, worstCaseUpper: 0.4, worstCaseLower: -0.4, rssSigma: 0.05 },
    capability: {
      lowerSpecLimit: 9,
      upperSpecLimit: 11,
      targetSigmaLevel: overrides.targetSigma ?? 4,
      targetCpk: (overrides.targetSigma ?? 4) / 3,
      cp: 6.66,
      lowerCpk: 6.66,
      upperCpk: 6.66,
      cpk: 6.66,
      lowerZ: 20,
      upperZ: 20,
      lowerDpm: 0,
      upperDpm: 0,
      totalDpm: 0,
      outOfSpecRatio: 0,
      yield: 1,
      status: "PASS",
    },
    traceRecords: [],
    scenarios: [],
  } as CalculationCompletedResult;
}

function analysisContext(overrides: FixtureOverrides = {}): F6AnalysisContext | undefined {
  if (overrides.includeAnalysisContext === false) return undefined;
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    contextVersion: "f6-analysis-context-v2",
    workbookContentHash: hash,
    worksheets: [{
      worksheetName: overrides.worksheetName ?? worksheet,
      tableId,
      baselineIdentity: {
        projectReference: "project",
        runReference: "run",
        calculationVersion: "excel-ta-v1",
        workbookContentHash: hash,
        worksheetName: overrides.worksheetName ?? worksheet,
        tableId,
        factorCount: overrides.factorCount ?? 4,
        factors: [],
        system: calculation(overrides).system,
        capability: calculation(overrides).capability,
      },
      analysisObject: overrides.analysisObjectKind === undefined ? undefined : {
        kind: overrides.analysisObjectKind,
        name: `${overrides.analysisObjectKind} object`,
        physicalMeaning: "Deterministic fixture object",
        measurementDirection: "Z",
        positiveDirectionDefinition: "positive",
        negativeDirectionDefinition: "negative",
        evidence: { source: "analysis-request", worksheetName: overrides.worksheetName ?? worksheet, sourceRows: [{ worksheetName: overrides.worksheetName ?? worksheet, tableId, sourceRow: 2 }] },
      },
      operatingConditions: [],
      correlationRequirement: { mode: "NOT_PROVIDED" },
      engineeringNarrative: "Fixture narrative",
    }],
  } as F6AnalysisContext;
}

function completeFixture(overrides: FixtureOverrides = {}) {
  return {
    worksheetName: overrides.worksheetName ?? worksheet,
    toleranceLoopDescription: overrides.toleranceLoopDescription ?? "Gap stack requirement",
    f2Worksheet: f2Worksheet(overrides),
    f3Worksheet: f3Worksheet(overrides),
    f3Ado: overrides.f3Ado ?? { status: "updated", operation: "created", organization: "org", project: "proj", workItemId: 1119604 },
    calculation: calculation(overrides),
    analysisContext: analysisContext(overrides),
  };
}

function fixture(overrides: FixtureOverrides = {}) {
  return structuredClone(completeFixture(overrides));
}

function findCheck(checks: readonly F6ProcessCheck[], checkId: F6ProcessCheck["checkId"]): F6ProcessCheck {
  const check = checks.find((entry) => entry.checkId === checkId);
  if (check === undefined) throw new Error(`missing check ${checkId}`);
  return check;
}

function targetSigmaCheck(input: ReturnType<typeof completeFixture>): F6ProcessCheck {
  return findCheck(createF6ProcessChecks(input), "target-sigma");
}

describe("createF6ProcessChecks", () => {
  it("returns seven checks in fixed order", () => {
    expect(createF6ProcessChecks(completeFixture()).map(({ checkId }) => checkId)).toEqual([
      "analysis-method",
      "input-completeness",
      "output-completeness",
      "tolerance-validity",
      "drawing-dim-governance",
      "ado-traceability",
      "target-sigma",
    ]);
  });

  it.each([
    [3, "WARNING", "Worst Case"],
    [4, "COMPLETE", "suitable"],
    [11, "WARNING", "3D Variation Analysis"],
  ] as const)("maps factor count %i deterministically", (factorCount, status, phrase) => {
    const check = findCheck(createF6ProcessChecks(fixture({ factorCount })), "analysis-method");
    expect(check).toMatchObject({ status });
    expect(check.summary).toContain(phrase);
    expect(check.summary).not.toMatch(/one-dimensional.*10|10.*one-dimensional/iu);
  });

  it("marks complete inputs, outputs, tolerances, drawing governance, ADO, and sigma as complete", () => {
    const checks = createF6ProcessChecks(completeFixture({ analysisObjectKind: "GAP", targetSigma: 3, currentSigma: 3 }));
    expect(checks.map(({ status }) => status)).toEqual(["COMPLETE", "COMPLETE", "COMPLETE", "COMPLETE", "COMPLETE", "COMPLETE", "COMPLETE"]);
  });

  it("summarizes missing required fields and identifiers by stable ordinal and source row", () => {
    const checks = createF6ProcessChecks(fixture({
      missingRequiredFields: ["upperTolerance", "distribution"],
      missingIdentifiers: ["drawingNumber", "dimCharacteristicId"],
      f3GovernanceStatus: "needs_governance",
    }));
    expect(findCheck(checks, "input-completeness")).toMatchObject({ status: "MISSING" });
    expect(findCheck(checks, "input-completeness").details).toEqual([
      "Factor 1 row 2 missing required fields: upperTolerance, distribution.",
    ]);
    expect(findCheck(checks, "drawing-dim-governance")).toMatchObject({ status: "WARNING" });
    expect(findCheck(checks, "drawing-dim-governance").details).toEqual([
      "Factor 1 row 2 missing identifiers: drawingNumber, dimCharacteristicId.",
      "Factor 1 row 2 governance status: needs_governance.",
    ]);
  });

  it("treats missing LSL, USL, target sigma, and invalid factor tolerance ranges as missing tolerance evidence", () => {
    const check = findCheck(createF6ProcessChecks(fixture({
      lowerSpecLimitStatus: "unavailable",
      upperSpecLimitStatus: "unavailable",
      targetSigma: null,
      f4CalculabilityIssues: [{ reasonCode: "factor_tolerance_range_invalid", sourceRow: 2 }],
    })), "tolerance-validity");
    expect(check).toMatchObject({ status: "MISSING" });
    expect(check.details).toEqual([
      "System specification missing lowerSpecLimit.",
      "System specification missing upperSpecLimit.",
      "System specification missing targetSigmaLevel.",
      "Factor row 2 has invalid tolerance range.",
    ]);
  });

  it("reports process guidance gaps as warning without overriding missing evidence", () => {
    const check = findCheck(createF6ProcessChecks(fixture({ worksheetName: "Interface", toleranceLoopDescription: "Interface", includeAnalysisContext: false })), "target-sigma");
    expect(check).toMatchObject({ status: "WARNING" });
    expect(check.summary).toContain("ambiguous");
  });

  it("gives Battery precedence over Gap", () => {
    const check = targetSigmaCheck(fixture({
      worksheetName: "Battery_gap",
      toleranceLoopDescription: "Battery pack gap",
      currentSigma: 4,
    }));
    expect(check).toMatchObject({ status: "WARNING" });
    expect(check.summary).toContain("recommended 6 sigma");
  });

  it("maps Gap to 3 sigma, Step to 3 sigma, Other to 4 sigma, and ambiguous to warning", () => {
    expect(targetSigmaCheck(fixture({ worksheetName: "Cover_gap", currentSigma: 3 })).status).toBe("COMPLETE");
    expect(targetSigmaCheck(fixture({ worksheetName: "Cover_step", currentSigma: 3 })).status).toBe("COMPLETE");
    expect(targetSigmaCheck(fixture({ worksheetName: "Bracket_width", toleranceLoopDescription: "Bracket width", currentSigma: 4 })).status).toBe("COMPLETE");
    expect(targetSigmaCheck(fixture({ worksheetName: "Interface", toleranceLoopDescription: "Interface", currentSigma: 4, includeAnalysisContext: false })).status).toBe("WARNING");
  });

  it("summarizes ADO traceability outcomes without constructing links", () => {
    expect(findCheck(createF6ProcessChecks(fixture({ f3Ado: { status: "updated", operation: "updated", organization: "org", project: "proj", workItemId: 123 } })), "ado-traceability").details)
      .toEqual(["ADO work item updated: org/proj#123."]);
    expect(findCheck(createF6ProcessChecks(fixture({ f3Ado: { status: "not_requested" } })), "ado-traceability")).toMatchObject({ status: "MISSING" });
    expect(findCheck(createF6ProcessChecks(fixture({ f3Ado: { status: "failed", reasonCode: "permission_denied" } })), "ado-traceability")).toMatchObject({ status: "WARNING" });
  });

  it("returns immutable check objects", () => {
    const checks = createF6ProcessChecks(completeFixture());
    expect(Object.isFrozen(checks)).toBe(true);
    expect(Object.isFrozen(checks[0])).toBe(true);
    expect(Object.isFrozen(checks[0]?.details)).toBe(true);
  });
});

describe("classifyWorksheetDomain", () => {
  it("prefers caller-provided analysis object over text matching", () => {
    expect(classifyWorksheetDomain(fixture({ worksheetName: "generic", toleranceLoopDescription: "generic", analysisObjectKind: "STEP" }))).toEqual({
      kind: "step",
      source: "analysis-object",
      matchedField: "analysisContext.worksheets[0].analysisObject.kind",
    });
  });

  it("uses explicit Battery tokens but not ambiguous cell text", () => {
    expect(classifyWorksheetDomain(fixture({ worksheetName: "Battery_gap", toleranceLoopDescription: "Battery pack gap" })).kind).toBe("battery");
    expect(classifyWorksheetDomain(fixture({ worksheetName: "cell_gap" })).kind).toBe("gap");
  });
});