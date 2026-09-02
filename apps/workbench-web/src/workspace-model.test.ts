import { describe, expect, it } from "vitest";

import type { F2UserReport, F4WorkflowCalculationResult, F5DataInterpretationResult } from "@ai-assist/contracts";

import { projectEngineeringWorkspace, type EngineeringWorkspaceInput } from "./workspace-model.js";

const HASH = "a".repeat(64);

function fixtureInput(): EngineeringWorkspaceInput {
  return {
    f2Report: report([
      worksheet("Blocked-A", "blocked"),
      worksheet("Ready-A", "ready", [factorRow(12, "间隙因子", "支架", "Gap factor", "Bracket"), factorRow(13, "第二因子", "电池", "Second factor", "Battery")]),
    ]),
    f4Report: calculationReport("Ready-A", [13, 12]),
  };
}

function metricsInput(): EngineeringWorkspaceInput {
  return {
    f2Report: report([
      worksheet("Ready-A", "ready", [factorRow(12, "间隙因子", "支架", "Gap factor", "Bracket")], {
        designNominal: 1.5,
        lowerSpecLimit: 1.3,
        upperSpecLimit: 1.7,
      }),
    ]),
    f4Report: calculationReport("Ready-A", [12], {
      mean: 1.627,
      rssSigma: 0.05,
      additionalMeanShift: 0.02,
      worstCaseLower: 1.45,
      worstCaseUpper: 1.79,
    }),
  };
}

describe("projectEngineeringWorkspace", () => {
  it("projects stable factor rows in F2 order even when F4 order differs", () => {
    const model = projectEngineeringWorkspace(fixtureInput());
    const factors = model.worksheets.find(({ worksheetName }) => worksheetName === "Ready-A")?.factors;

    expect(factors?.map(({ sourceRow }) => sourceRow)).toEqual([12, 13]);
    expect((factors?.[0]?.factorName as any)?.displayText).toBe("Gap factor");
    expect((factors?.[0]?.factorName as any)?.sourceText).toBe("间隙因子");
    expect((factors?.[0]?.partName as any)?.displayText).toBe("Bracket");
    expect((factors?.[0]?.partName as any)?.sourceText).toBe("支架");
    expect(factors?.[0]?.capabilityResult).toBe("Internal within guidance");
    expect((factors?.[0]?.knowledgeRecommendation as any)?.displayText).toBe("Maximum total tolerance band 0.5 mm · internal-v1 · v1");
    expect((factors?.[0]?.knowledgeRecommendation as any)?.sourceText).toBe("Maximum total tolerance band 0.5 mm · internal-v1 · v1");
    expect(factors?.[0]).toMatchObject({
      key: "Ready-A\u0000factor-table-1\u000012",
      worksheetName: "Ready-A",
      tableId: "factor-table-1",
      sourceRow: 12,
      factorName: { displayText: "Gap factor", sourceText: "间隙因子", translated: true },
      partName: { displayText: "Bracket", sourceText: "支架", translated: true },
      partCategory: "CNC",
      nominalDisplay: "1.000",
      upperToleranceDisplay: "0.200",
      lowerToleranceDisplay: "-0.200",
      meanDisplay: "1.000",
      oneSigmaDisplay: "0.050",
      contributionDisplay: "40.0%",
      contribution: 0.4,
    });
  });

  it("projects worksheet analysis target fields directly from system specification evidence", () => {
    const model = projectEngineeringWorkspace({
      f2Report: report([
        worksheet("Ready-A", "ready", [factorRow(12, "间隙因子", "支架", "Gap factor", "Bracket")], {
          designNominal: 1.627,
          lowerSpecLimit: 0,
          upperSpecLimit: 5,
        }),
      ]),
      f4Report: calculationReport("Ready-A", [12]),
    });
    const readyWorksheet = model.worksheets.find(({ worksheetName }) => worksheetName === "Ready-A");

    expect(readyWorksheet).toMatchObject({
      analysisTarget: {
        description: "Ready-A loop",
        designNominal: {
          actual: 1.627,
          display: "1.627",
          sourceLabel: "*Design Nominal ►",
          sourceCell: "Ready-A!P53",
        },
        lowerSpecLimit: {
          actual: 0,
          display: "0.000",
          sourceLabel: "*Lower Spec Limit ►",
          sourceCell: "Ready-A!P54",
        },
        upperSpecLimit: {
          actual: 5,
          display: "5.000",
          sourceLabel: "*Upper Spec Limit ►",
          sourceCell: "Ready-A!P55",
        },
        unit: "mm",
      },
    });
    expect((readyWorksheet as any)?.analysisTarget?.designNominal?.actual).not.toBe(2.5);
  });

  it("maps loop label only from exact F5 linkedVisualLabels and falls back to not available", () => {
    const model = projectEngineeringWorkspace(fixtureInput());
    const readyWorksheet = model.worksheets.find(({ worksheetName }) => worksheetName === "Ready-A");

    expect(readyWorksheet?.factors[0]?.loopLabel).toBeUndefined();

    const mapped = projectEngineeringWorkspace({ ...fixtureInput(), f5Report: f5LoopLabels([
      { worksheetName: "Ready-A", tableId: "factor-table-1", sourceRow: 12, label: "Loop A" },
    ]) });
    expect(mapped.worksheets.find(({ worksheetName }) => worksheetName === "Ready-A")?.factors[0]?.loopLabel).toBe("Loop A");

    const ambiguous = projectEngineeringWorkspace({ ...fixtureInput(), f5Report: f5LoopLabels([
      { worksheetName: "Ready-A", tableId: "factor-table-1", sourceRow: 12, label: "Loop A" },
      { worksheetName: "Ready-A", tableId: "factor-table-1", sourceRow: 12, label: "Loop B" },
    ]) });
    expect(ambiguous.worksheets.find(({ worksheetName }) => worksheetName === "Ready-A")?.factors[0]?.loopLabel).toBeUndefined();
  });

  it("exposes Mean Response and Additional Mean Shift without Mean Offset", () => {
    const model = projectEngineeringWorkspace(metricsInput());
    const readyWorksheet = model.worksheets.find(({ worksheetName }) => worksheetName === "Ready-A");

    expect(readyWorksheet?.metrics).toMatchObject({
      mean: 1.627,
      meanShift: 0.02,
    });
    expect(readyWorksheet?.metrics).not.toHaveProperty("meanOffset");
  });

  it("maps blocked F2 worksheets without inventing factors", () => {
    const model = projectEngineeringWorkspace({ f2Report: report([worksheet("Blocked-A", "blocked")]) });

    expect(model.worksheets[0]).toMatchObject({ status: "blocked", factors: [] });
  });

  it("uses the first ready worksheet when no valid selection exists", () => {
    expect(projectEngineeringWorkspace(fixtureInput()).selectedWorksheetName).toBe("Ready-A");
    expect(projectEngineeringWorkspace({ ...fixtureInput(), selectedWorksheetName: "missing" }).selectedWorksheetName).toBe("Ready-A");
  });

  it("selects a risk worksheet when no ready worksheet exists", () => {
    const f4Report = calculationReport("Risk-A");
    (f4Report.calculations[0] as any).capability.status = "FAIL";

    const model = projectEngineeringWorkspace({
      f2Report: report([
        worksheet("Blocked-A", "blocked"),
        worksheet("Risk-A", "ready", [factorRow(12, "风险因子", "支架", "Risk factor", "Bracket")]),
      ]),
      f4Report,
    });

    expect(model.worksheets[1]).toMatchObject({ worksheetName: "Risk-A", status: "risk" });
    expect(model.selectedWorksheetName).toBe("Risk-A");
  });

  it("does not hide the F3 ADO decision workspace while F4 is pending", () => {
    const input = fixtureInput();
    const model = projectEngineeringWorkspace({
      snapshot: {
        contractVersion: "f8-session-snapshot-v1",
        sessionId: "session",
        revision: 6,
        inputRevision: 1,
        state: "ado_decision_required",
        activeAttempt: null,
        priorRunReferences: [],
      },
      f2Report: input.f2Report,
    });

    expect(model.worksheets).not.toHaveLength(0);
    expect(model).not.toHaveProperty("preparationMessage");
  });

  it("does not hide live ADO validation progress while F4 is pending", () => {
    const input = fixtureInput();
    const model = projectEngineeringWorkspace({
      snapshot: {
        contractVersion: "f8-session-snapshot-v1",
        sessionId: "session",
        revision: 7,
        inputRevision: 1,
        state: "ado_action_pending",
        activeAttempt: null,
        priorRunReferences: [],
      },
      f2Report: input.f2Report,
    });

    expect(model).not.toHaveProperty("preparationMessage");
  });

  it("drops structural inventory sheets after governed F2 worksheets are available", () => {
    const input = fixtureInput();
    const model = projectEngineeringWorkspace({ ...input, snapshot: { contractVersion: "f8-session-snapshot-v1", sessionId: "session", revision: 2, inputRevision: 1, state: "review_required", activeAttempt: null, priorRunReferences: [], worksheetCapabilities: [{ worksheetName: "Worksheet Names", whatIfAvailable: false }] } });
    expect(model.worksheets.map(({ worksheetName }) => worksheetName)).not.toContain("Worksheet Names");
    expect(model.selectedWorksheetName).toBe("Ready-A");
  });

  it("uses ready worksheets from a partially blocked F2 report", () => {
    const input = fixtureInput();
    const f2Report = { ...input.f2Report!, status: "partiallyBlocked" as const };
    expect(projectEngineeringWorkspace({ ...input, f2Report }).selectedWorksheetName).toBe("Ready-A");
  });

  it("never exposes internal workflow state labels", () => {
    expect(JSON.stringify(projectEngineeringWorkspace(fixtureInput()))).not.toMatch(/f4_running|ado_action_pending|activeAttempt/);
  });

  it("does not claim preparation before a workbook is uploaded", () => {
    expect(projectEngineeringWorkspace({ snapshot: { contractVersion: "f8-session-snapshot-v1", sessionId: "session", revision: 0, inputRevision: 0, state: "created", activeAttempt: null, priorRunReferences: [] } })).not.toHaveProperty("preparationMessage");
  });
});

function worksheet(
  worksheetName: string,
  status: "ready" | "blocked",
  rows: ReturnType<typeof factorRow>[] = [],
  specification: { readonly designNominal?: number; readonly lowerSpecLimit: number; readonly upperSpecLimit: number } = { designNominal: -0.05, lowerSpecLimit: -0.15, upperSpecLimit: 0.05 },
) {
  const designNominal = specification.designNominal ?? 0;
  return {
    worksheetName,
    toleranceLoopDescription: `${worksheetName} loop`,
    status,
    tolerancePathImageStatus: "available",
    systemSpecification: {
      status: "available",
      designNominal: { status: "available", actualValue: designNominal, displayValue: designNominal.toFixed(3), sourceLabel: "*Design Nominal ►", sourceCell: `${worksheetName}!P53`, valueOrigin: "numeric_literal" },
      lowerSpecLimit: { status: "available", actualValue: specification.lowerSpecLimit, displayValue: specification.lowerSpecLimit.toFixed(3), sourceLabel: "*Lower Spec Limit ►", sourceCell: `${worksheetName}!P54`, valueOrigin: "numeric_literal" },
      upperSpecLimit: { status: "available", actualValue: specification.upperSpecLimit, displayValue: specification.upperSpecLimit.toFixed(3), sourceLabel: "*Upper Spec Limit ►", sourceCell: `${worksheetName}!P55`, valueOrigin: "numeric_literal" },
      targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3.0σ", sourceLabel: "*Target σ Level ►", sourceCell: `${worksheetName}!P56`, valueOrigin: "numeric_literal" },
      additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift ►", sourceCell: `${worksheetName}!P50`, valueOrigin: "defaulted" },
    },
    systemSpecificationIssues: status === "blocked" ? [{ reasonCode: "required_field_missing" }] : [],
    rows,
    missingFieldSummary: [],
  };
}

function f5LoopLabels(mappings: Array<{ worksheetName: string; tableId: string; sourceRow: number; label: string }>): F5DataInterpretationResult {
  return {
    status: "completed",
    worksheets: mappings.reduce<Array<{ worksheetName: string; status: string; statements: Array<Record<string, unknown>> }>>((acc, mapping) => {
      const entry = acc.find((item) => item.worksheetName === mapping.worksheetName);
      const statement = {
        type: "SIGNAL",
        content: {
          signalKind: "image_text_context_review",
          linkedVisualLabels: [{ label: mapping.label, tableId: mapping.tableId, sourceRow: mapping.sourceRow }],
        },
      };
      if (entry === undefined) {
        acc.push({ worksheetName: mapping.worksheetName, status: "completed", statements: [statement] });
      } else {
        entry.statements.push(statement);
      }
      return acc;
    }, []),
  } as unknown as F5DataInterpretationResult;
}

function factorRow(sourceRow: number, sourceFactorName: string, sourcePartName: string, displayFactorName: string, displayPartName: string) {
  return {
    worksheetName: "Ready-A",
    tableId: "factor-table-1",
    sourceRow,
    actualFields: { factorName: sourceFactorName, partName: sourcePartName, drawingNumber: null, dimCharacteristicId: null, partCategory: "CNC", nominalValue: 1, upperTolerance: 0.2, lowerTolerance: -0.2, longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "Normal", mean: 1, tolerance: 0.2, oneSigma: 0.05, percentContributionToSigma: 0.4, notes: null },
    displayFields: { factorName: displayFactorName, partName: displayPartName, drawingNumber: null, dimCharacteristicId: null, partCategory: "CNC", nominalValue: "1.000", upperTolerance: "0.200", lowerTolerance: "-0.200", longTermSafetyFactor: "1.0", sigmaLevel: "4.0", distribution: "Normal", mean: "1.000", tolerance: "0.200", oneSigma: "0.050", percentContributionToSigma: "40.0%", notes: null },
    sourceCells: { factorName: `Ready-A!E${sourceRow}` },
    missingRequiredFields: [],
    missingIdentifiers: ["dimCharacteristicId", "partNumber"],
    capabilityStatus: "internal_within_guidance",
    adoReminderRequested: true,
    recommendation: sourceRow === 12 ? { maximumRecommendedTotalBand: 0.5, unit: "mm", matchedEntryId: "v1" } : undefined,
  };
}

function report(worksheets: ReturnType<typeof worksheet>[]): F2UserReport {
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    featureId: "F2",
    status: "completed",
    workbook: { fileName: "anonymous.xlsx", contentHash: HASH },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot: "managed/f2",
    worksheets,
    f4Handoffs: [],
    adoEvents: [],
    summary: {
      worksheetsChecked: worksheets.length,
      blockedWorksheetCount: worksheets.filter(({ status }) => status === "blocked").length,
      readyWorksheetCount: worksheets.filter(({ status }) => status === "ready").length,
      factorRowCount: 0,
      rowsWithRequiredMissing: 0,
      requiredMissingFieldCount: 0,
      missingImageWorksheetCount: 0,
      internalWithinGuidanceCount: 0,
      internalGuidanceExceededCount: 0,
      f0InformationInsufficientCount: 0,
      publicLibraryMatchCount: 0,
      nonF0ProcessCategoryCount: 0,
      unableToCheckCount: 0,
      publicToleranceDifferenceCount: 0,
      publicDistributionDifferenceCount: 0,
      missingDimIdCount: 0,
      missingPartNumberCount: 0,
    },
  } as F2UserReport;
}

function calculationReport(
  worksheetName: string,
  sourceRows: number[] = [12],
  system: { readonly mean: number; readonly rssSigma: number; readonly additionalMeanShift: number; readonly worstCaseLower: number; readonly worstCaseUpper: number } = { mean: 0, rssSigma: 0.05, additionalMeanShift: 0, worstCaseLower: -0.15, worstCaseUpper: 0.15 },
): F4WorkflowCalculationResult {
  return {
    source: { workbookFileName: "anonymous.xlsx" },
    calculations: [{
      worksheetSelection: { worksheetName },
      factors: sourceRows.map((sourceRow) => ({
        source: { tableId: "factor-table-1", sourceRow: 12 },
        factorName: sourceRow === 12 ? "Gap factor" : "Second factor",
        unit: "mm",
        input: { nominalValue: 1, upperTolerance: 0.2, lowerTolerance: -0.2 },
        contribution: sourceRow === 12 ? 0.4 : 0.6,
      })).map((factor, index) => ({ ...factor, source: { ...factor.source, sourceRow: sourceRows[index]! } })),
      system,
      capability: { lowerSpecLimit: -0.2, upperSpecLimit: 0.2, cp: 1.33, lowerCpk: 1.2, upperCpk: 1.3, cpk: 1.2, status: "PASS" },
    }],
  } as unknown as F4WorkflowCalculationResult;
}
