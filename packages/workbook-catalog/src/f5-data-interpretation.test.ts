import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import {
  f5DataInterpretationRequestSchema,
  f5DataInterpretationResultSchema,
  type F5DataInterpretationRequest,
} from "@ai-assist/contracts";
import { createCalculation } from "./calculation.js";
import { createInterpretation } from "./interpretation-placeholder.js";
import { createF5DataInterpretation } from "./f5-data-interpretation.js";

const CONTENT_HASH = "a".repeat(64);
const IMAGE_HASH = "b".repeat(64);

function availableText(rawText: string, sourceCell: string) {
  return { status: "available" as const, rawText, sourceCell };
}

function availableNumber(rawText: string, sourceCell: string, numericValue: number) {
  return { status: "available" as const, rawText, sourceCell, numericValue, unit: "mm" };
}

function calculationRequest(factorCount = 4) {
  const rows = Array.from({ length: factorCount }, (_, index) => {
    const row = index + 2;
    return {
      sourceRow: row,
      fields: {
        factorName: availableText(`factor-${index + 1}`, `Analysis-A!A${row}`),
        nominalValue: availableNumber("0", `Analysis-A!B${row}`, 0),
        upperTolerance: availableNumber("1", `Analysis-A!C${row}`, 1),
        lowerTolerance: availableNumber("-1", `Analysis-A!D${row}`, -1),
        longTermSafetyFactor: availableNumber("1", `Analysis-A!E${row}`, 1),
        standardDeviation: availableNumber(index === 0 ? "2" : "1", `Analysis-A!F${row}`, index === 0 ? 2 : 1),
        distribution: availableText("normal", `Analysis-A!G${row}`),
        unit: availableText("mm", `Analysis-A!H${row}`),
      },
    };
  });
  return {
    contractVersion: "v1" as const,
    inputClassification: "confidential" as const,
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetAnalysisAssets: {
      contractVersion: "v1" as const,
      workbook: { classification: "confidential" as const, contentHash: CONTENT_HASH, catalogContractVersion: "v1" as const },
      worksheets: [{
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "anonymous-analysis",
        factorTables: [{
          tableId: "table-a",
          headerRow: 1,
          dataRange: { startRow: 2, endRow: factorCount + 1 },
          columns: [
            { semanticField: "factorName" as const, headerText: "Factor", sourceColumn: "A" },
            { semanticField: "nominalValue" as const, headerText: "Nominal", sourceColumn: "B" },
            { semanticField: "upperTolerance" as const, headerText: "Upper", sourceColumn: "C" },
            { semanticField: "lowerTolerance" as const, headerText: "Lower", sourceColumn: "D" },
            { semanticField: "longTermSafetyFactor" as const, headerText: "LTSF", sourceColumn: "E" },
            { semanticField: "standardDeviation" as const, headerText: "Sigma", sourceColumn: "F" },
            { semanticField: "distribution" as const, headerText: "Distribution", sourceColumn: "G" },
            { semanticField: "unit" as const, headerText: "Unit", sourceColumn: "H" },
          ],
          rows,
        }],
        formulaCells: [],
        imageAssets: [],
      }],
    },
    requiredFieldCheck: {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      workbookContentHash: CONTENT_HASH,
      status: "readyForNextCheck" as const,
      blockingIssues: [],
      advisoryIssues: [],
      summary: { worksheetsChecked: 1, factorTablesChecked: 1, factorRowsChecked: factorCount, blockingIssueCount: 0, advisoryIssueCount: 0 },
    },
    exceptionResolution: {
      contractVersion: "v1" as const,
      inputClassification: "confidential" as const,
      workbookContentHash: CONTENT_HASH,
      knowledgeBaseVersion: "v1" as const,
      status: "readyToContinue" as const,
      readyToContinue: true as const,
      acceptedExceptions: [],
      pendingExceptions: [],
      summary: { actionableSignalCount: 0, acceptedExceptionCount: 0, pendingExceptionCount: 0, invalidCandidateCount: 0 },
    },
    worksheetSelection: { worksheetName: "Analysis-A", tableId: "table-a" },
    systemSpecification: {
      designNominal: 0,
      lowerSpecLimit: -3,
      upperSpecLimit: 3,
      targetSigmaLevel: 3,
      targetCpk: 1.33,
      additionalMeanShift: -1,
    },
    criticality: "none" as const,
    scenarioOverrides: [],
  };
}

function completedCalculation(factorCount = 4) {
  const result = createCalculation(calculationRequest(factorCount));
  expect(result.status).toBe("completed");
  if (result.status !== "completed") throw new Error("expected completed calculation fixture");
  return result;
}

const imageReference = {
  artifact: "f1" as const,
  worksheetName: "Analysis-A",
  relativePath: "artifacts/analysis-a.png",
  contentHash: IMAGE_HASH,
};

function request(options: {
  factorCount?: number;
  observations?: F5DataInterpretationRequest["worksheets"][number]["imageObservations"];
  governanceStatus?: "complete" | "needs_governance" | "blocked_for_reminder";
} = {}): F5DataInterpretationRequest {
  const calculationResult = completedCalculation(options.factorCount);
  const governanceRows = calculationResult.factors.map((factor, index) => ({
    factorInstanceId: String(index + 1).padStart(64, "0"),
    drawingDimensionKey: options.governanceStatus === undefined || options.governanceStatus === "complete"
      ? String(index + 11).padStart(64, "0")
      : undefined,
    deviceLevelDim: `device-dim-${index + 1}`,
    dimensionDescription: `dimension-${index + 1}`,
    partCategory: "controlled-category",
    partSubsystem: "controlled-subsystem",
    drawingNumber: options.governanceStatus === "needs_governance" ? null : `DRAW-${index + 1}`,
    dimId: options.governanceStatus === "needs_governance" ? null : `DIM-${index + 1}`,
    factorDescription: factor.factorName,
    nominal: factor.input.nominalValue,
    upperTolerance: factor.input.upperTolerance,
    lowerTolerance: factor.input.lowerTolerance,
    sigmaLevel: factor.input.sigmaLevel,
    dimIdStatus: options.governanceStatus === "needs_governance" ? "missing" as const : "valid" as const,
    qualitySignals: options.governanceStatus === "needs_governance" ? ["drawing_number_missing" as const, "dim_id_missing" as const] : [],
    governanceStatus: options.governanceStatus ?? "complete" as const,
    imageReference,
    source: { ...factor.source, sourceCells: {} },
  }));
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: CONTENT_HASH },
    knowledgeBaseVersion: "interpretation-rules-v1",
    worksheets: [{
      worksheetName: "Analysis-A",
      imageReference,
      governanceRows,
      calculationResult,
      imageObservations: options.observations ?? [],
    }],
  };
}

function requestForWorksheets(worksheetNames: string[]): F5DataInterpretationRequest {
  const input = request();
  input.worksheets = worksheetNames.map((worksheetName, index) => {
    const worksheet = structuredClone(input.worksheets[0]!);
    worksheet.worksheetName = worksheetName;
    worksheet.imageReference = {
      ...worksheet.imageReference,
      worksheetName,
      relativePath: `artifacts/analysis-${index + 1}.png`,
    };
    worksheet.calculationResult.worksheetSelection.worksheetName = worksheetName;
    for (const factor of worksheet.calculationResult.factors) {
      factor.source.worksheetName = worksheetName;
    }
    for (const row of worksheet.governanceRows) {
      row.source.worksheetName = worksheetName;
      row.imageReference = structuredClone(worksheet.imageReference);
    }
    return worksheet;
  });
  return f5DataInterpretationRequestSchema.parse(input);
}

function observation(overrides: Partial<F5DataInterpretationRequest["worksheets"][number]["imageObservations"][number]> = {}) {
  return {
    scope: "stack_start" as const,
    observedValue: "visible" as const,
    confidence: "medium" as const,
    visibleBasis: "Controlled worksheet image observation.",
    reviewStatus: "unreviewed" as const,
    ...overrides,
  };
}

const CORE_SCOPES = [
  "tolerance_loop_closure",
  "datum_chain",
  "assembly_datum_face",
  "stack_start",
  "direction",
] as const;

function v2Request() {
  const input = request() as unknown as ReturnType<typeof request> & {
    worksheets: Array<ReturnType<typeof request>["worksheets"][number] & {
      observationVersion: "f5-image-observation-v2";
      contextSnapshot: {
        dimensionDescription: string;
        rows: Array<{
          tableId: string;
          sourceRow: number;
          partName: string | null;
          partSubsystem: string | null;
          partCategory: string | null;
          factorName: string | null;
          factorDescription: string | null;
          nominal: number | null;
          upperTolerance: number | null;
          lowerTolerance: number | null;
          sigmaLevel: number | null;
          sourceCells: Record<string, string>;
        }>;
      };
      imageObservations: Array<{
        scope: typeof CORE_SCOPES[number];
        visualObservation: {
          observedValue: "visible" | "not_visible" | "ambiguous";
          confidence: "high" | "medium" | "low";
          visibleBasis: string;
          visibleLabels: string[];
          reviewStatus: "unreviewed" | "confirmed" | "rejected";
        };
        contextualSignal: {
          signalValue: "indicated_consistent" | "indicated_conflict" | "ambiguous" | "insufficient_evidence";
          textBasis: string;
          linkedSourceRows: Array<{ tableId: string; sourceRow: number }>;
          linkedVisualLabels: Array<{ label: string; tableId: string; sourceRow: number }>;
          requiresEngineeringReview: true;
        };
      }>;
    }>;
  };
  const worksheet = input.worksheets[0]!;
  const firstGovernanceRow = worksheet.governanceRows[0]!;
  worksheet.governanceRows.forEach((row) => {
    row.dimensionDescription = firstGovernanceRow.dimensionDescription;
    row.source.sourceCells = { factorName: `Analysis-A!A${row.source.sourceRow}` };
  });
  worksheet.observationVersion = "f5-image-observation-v2";
  worksheet.contextSnapshot = {
    dimensionDescription: firstGovernanceRow.dimensionDescription,
    rows: worksheet.governanceRows.map((row) => ({
      tableId: row.source.tableId,
      sourceRow: row.source.sourceRow,
      partName: row.partSubsystem,
      partSubsystem: row.partSubsystem,
      partCategory: row.partCategory,
      factorName: row.factorDescription,
      factorDescription: row.factorDescription,
      nominal: row.nominal,
      upperTolerance: row.upperTolerance,
      lowerTolerance: row.lowerTolerance,
      sigmaLevel: row.sigmaLevel,
      sourceCells: structuredClone(row.source.sourceCells),
    })),
  };
  worksheet.imageObservations = CORE_SCOPES.map((scope) => ({
    scope,
    visualObservation: {
      observedValue: "visible",
      confidence: scope === "direction" || scope === "stack_start" ? "high" : "medium",
      visibleBasis: `Visible marker for ${scope}.`,
      visibleLabels: scope === "direction" ? ["factor-1"] : [],
      reviewStatus: "unreviewed",
    },
    contextualSignal: {
      signalValue: scope === "direction" ? "indicated_consistent" : "ambiguous",
      textBasis: `Image and worksheet context require review for ${scope}.`,
      linkedSourceRows: scope === "direction"
        ? [{ tableId: firstGovernanceRow.source.tableId, sourceRow: firstGovernanceRow.source.sourceRow }]
        : [],
      linkedVisualLabels: scope === "direction"
        ? [{
            label: "factor-1",
            tableId: firstGovernanceRow.source.tableId,
            sourceRow: firstGovernanceRow.source.sourceRow,
          }]
        : [],
      requiresEngineeringReview: true,
    },
  }));
  return input;
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

function captureThrown(action: () => unknown): unknown {
  try {
    action();
    return undefined;
  } catch (error) {
    return error;
  }
}

describe("createF5DataInterpretation", () => {
  it.each([
    "C:\\private\\Demo.xlsx",
    "\\\\server\\share\\Demo.xlsx",
    "/home/private/Demo.xlsx",
    "subdir/name.xlsx",
    "../Demo.xlsx",
    "Demo\u0001.xlsx",
  ])("rejects unsafe workbook basename %j", (fileName) => {
    const input = request();
    input.workbook.fileName = fileName;
    expect(f5DataInterpretationRequestSchema.safeParse(input).success).toBe(false);
  });

  it("accepts a normal workbook basename", () => {
    const input = request();
    input.workbook.fileName = "Demo.xlsx";
    expect(f5DataInterpretationRequestSchema.safeParse(input).success).toBe(true);
  });

  it("calls objective interpretation once per worksheet and builds all fixed sections", () => {
    const createObjectiveInterpretation = vi.fn(createInterpretation);
    const result = createF5DataInterpretation(request(), { createObjectiveInterpretation });

    expect(createObjectiveInterpretation).toHaveBeenCalledOnce();
    expect(createObjectiveInterpretation).toHaveBeenCalledWith({
      contractVersion: "v1",
      inputClassification: "confidential",
      calculationResult: expect.any(Object),
    });
    expect(result).toMatchObject({
      featureId: "F5",
      status: "completed",
      summary: { worksheetCount: 1, completedWorksheetCount: 1, inputRejectedWorksheetCount: 0 },
      worksheets: [{
        status: "completed",
        sections: {
          capabilityVsSpecification: { status: "supported" },
          majorContributors: { status: "supported" },
          reasonableToleranceRange: { status: "delegated_to_f6" },
          designOptimizationAndParallelOptions: { status: "delegated_to_f6" },
        },
      }],
    });
    expect(f5DataInterpretationResultSchema.parse(result)).toEqual(result);
  });

  it("adds a controlled clarification to every worksheet after enhanced observations are rejected", () => {
    const input = requestForWorksheets(["Analysis-A", "Analysis-B"]);
    const result = createF5DataInterpretation({
      ...input,
      observationFallback: { reasonCode: "enhanced_observation_rejected" },
    });

    expect(result.status).toBe("completed");
    for (const worksheet of result.worksheets) {
      if (worksheet.status !== "completed") throw new Error("expected completed worksheet");
      expect(worksheet.sections.toleranceChainValidity.status).toBe("not_evaluated");
      expect(worksheet.clarifications).toEqual(expect.arrayContaining([
        expect.objectContaining({
          reasonCode: "enhanced_observation_rejected",
          missingEvidence: ["validated enhanced image observations"],
        }),
      ]));
      expect(worksheet).not.toHaveProperty("observationVersion");
      expect(worksheet).not.toHaveProperty("contextSnapshot");
    }
    expect(f5DataInterpretationResultSchema.parse(result)).toEqual(result);
  });

  it.each([
    ["throw", () => { throw new Error("C:\\private\\objective.txt token=secret"); }],
    ["invalid result", () => ({ status: "completed" })],
    ["trace prerequisite", (objectiveInput: Parameters<typeof createInterpretation>[0]) => {
      const objective = structuredClone(createInterpretation(objectiveInput));
      if (objective.status !== "completed") throw new Error("expected completed objective fixture");
      const tracedFact = objective.statements.find((statement) => (
        statement.type === "FACT" && statement.content.provenanceKind === "formula_output"
      ));
      if (tracedFact?.type !== "FACT" || tracedFact.content.provenanceKind !== "formula_output") {
        throw new Error("expected traced objective FACT fixture");
      }
      tracedFact.content.traceRecords = [];
      return objective;
    }],
  ])("isolates an objective %s failure to its worksheet and preserves selection order", (_case, failObjective) => {
    const input = requestForWorksheets(["Analysis-A", "Analysis-B"]);
    const createObjectiveInterpretation = vi.fn((objectiveInput: Parameters<typeof createInterpretation>[0]) => {
      if (objectiveInput.calculationResult.worksheetSelection.worksheetName === "Analysis-B") {
        return failObjective(objectiveInput) as ReturnType<typeof createInterpretation>;
      }
      return createInterpretation(objectiveInput);
    });

    const result = createF5DataInterpretation(input, { createObjectiveInterpretation });

    expect(result.status).toBe("partially_completed");
    expect(result.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-A", "Analysis-B"]);
    expect(result.worksheets[0]).toMatchObject({ worksheetName: "Analysis-A", status: "completed" });
    expect(result.worksheets[1]).toEqual({
      worksheetName: "Analysis-B",
      status: "input_rejected",
      reasonCode: "interpretation_failed",
      artifactReference: "worksheet:Analysis-B",
    });
    expect(result.summary).toMatchObject({
      worksheetCount: 2,
      completedWorksheetCount: 1,
      inputRejectedWorksheetCount: 1,
    });
    expect(JSON.stringify(result)).not.toMatch(/private|objective\.txt|token|secret/i);
  });

  it("returns an input_rejected root when objective interpretation fails for every worksheet", () => {
    const result = createF5DataInterpretation(
      requestForWorksheets(["Analysis-A", "Analysis-B"]),
      { createObjectiveInterpretation: vi.fn(() => { throw new Error("objective failed"); }) },
    );

    expect(result.status).toBe("input_rejected");
    expect(result.worksheets).toEqual([
      {
        worksheetName: "Analysis-A",
        status: "input_rejected",
        reasonCode: "interpretation_failed",
        artifactReference: "worksheet:Analysis-A",
      },
      {
        worksheetName: "Analysis-B",
        status: "input_rejected",
        reasonCode: "interpretation_failed",
        artifactReference: "worksheet:Analysis-B",
      },
    ]);
    expect(result.summary).toEqual({
      worksheetCount: 2,
      completedWorksheetCount: 0,
      inputRejectedWorksheetCount: 2,
      statementCount: 0,
      clarificationCount: 0,
      assumptionCount: 0,
    });
    expect(f5DataInterpretationResultSchema.parse(result)).toEqual(result);
  });

  it("preserves the complete objective capability FACT set with exact F4 values and trace", () => {
    const input = request();
    const result = createF5DataInterpretation(input);
    const worksheet = result.worksheets[0]!;
    if (worksheet.status !== "completed") throw new Error("expected completed worksheet");

    const capabilityIds = new Set(worksheet.sections.capabilityVsSpecification.statementIds);
    const capabilityStatements = worksheet.statements.filter(({ statementId }) => capabilityIds.has(statementId));
    expect(capabilityStatements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "FACT", content: expect.objectContaining({ metric: "cpk" }) }),
        expect.objectContaining({
          type: "RULE",
          content: expect.objectContaining({
            entryId: "performance-cpk-below-target",
            effectiveVersion: "interpretation-rules-v1",
            applicability: { analysisDimension: "one-dimensional", method: "rss" },
            evidence: expect.any(Object),
          }),
        }),
      ]),
    );
    const capabilityFacts = capabilityStatements.filter((statement) => statement.type === "FACT");
    expect(capabilityFacts.map((statement) => statement.content.metric).sort()).toEqual([
      "achieved_sigma",
      "cp",
      "cpk",
      "lower_spec_limit",
      "recommended_method",
      "rss_sigma",
      "target_cpk",
      "target_sigma",
      "total_dpm",
      "upper_spec_limit",
      "yield",
    ]);
    const factByMetric = new Map(capabilityFacts.map((statement) => [statement.content.metric, statement]));
    expect(factByMetric.get("cp")?.content).toMatchObject({
      value: input.worksheets[0]!.calculationResult.capability.cp,
      outputField: "capability.cp",
      traceRecords: [input.worksheets[0]!.calculationResult.traceRecords.find(({ outputField }) => outputField === "capability.cp")],
    });
    expect(factByMetric.get("rss_sigma")?.content).toMatchObject({
      value: input.worksheets[0]!.calculationResult.system.rssSigma,
      outputField: "system.rssSigma",
      traceRecords: [input.worksheets[0]!.calculationResult.traceRecords.find(({ outputField }) => outputField === "system.rssSigma")],
    });
    expect(factByMetric.get("recommended_method")?.content).toMatchObject({
      method: input.worksheets[0]!.calculationResult.recommendation.method,
    });
    expect(worksheet.statements.some((statement) => statement.type === "SIGNAL" && "entryId" in statement.content)).toBe(true);
    expect(worksheet.statements.some((statement) => statement.type === "OPTION" && statement.content.rank === null)).toBe(true);
  });

  it("orders every contributor descending and resolves ties by original F4 index", () => {
    const input = request();
    const result = createF5DataInterpretation(input);
    const worksheet = result.worksheets[0]!;
    if (worksheet.status !== "completed") throw new Error("expected completed worksheet");
    const items = worksheet.sections.majorContributors.items;

    expect(items).toHaveLength(4);
    for (let index = 1; index < items.length; index += 1) {
      const previous = items[index - 1]!;
      const current = items[index]!;
      expect(current.contributionPercent).toBeLessThanOrEqual(previous.contributionPercent);
      if (current.contributionPercent === previous.contributionPercent) {
        expect(current.factorIndex).toBeGreaterThan(previous.factorIndex);
      }
    }
    for (const item of items) {
      const factor = input.worksheets[0]!.calculationResult.factors[item.factorIndex]!;
      expect(item.factorReference).toBe(`${item.source.worksheetName}/${item.source.tableId}/${item.source.sourceRow}`);
      expect(item).toMatchObject({
        halfTolerance: factor.halfTolerance,
        sigma: factor.sigma,
        unit: factor.unit,
      });
      expect(item.relatedStatementIds).toContain(`fact-factor-contribution-${item.factorIndex + 1}`);
      expect(item).not.toHaveProperty("partNumber");
    }
    const highestContribution = items[0]!.contributionPercent;
    for (const item of items) {
      if (item.contributionPercent === highestContribution) {
        expect(item.reasonCodes).toEqual(["contribution_concentration"]);
        expect(item.relatedStatementIds).toContain("root-cause-signal-root-cause-contributor-concentration");
      } else {
        expect(item.reasonCodes).toEqual([]);
      }
    }
  });

  it("publishes all eight structural scopes in stable order with per-item evidence status and references", () => {
    const result = createF5DataInterpretation(request({ observations: [
      observation({ scope: "tolerance_loop_closure", confidence: "low" }),
      observation({ scope: "datum_chain", confidence: "high", reviewStatus: "rejected" }),
      observation({ scope: "assembly_datum_face", confidence: "medium" }),
      observation({ scope: "stack_start", confidence: "high" }),
    ] }));
    const worksheet = result.worksheets[0]!;
    if (worksheet.status !== "completed") throw new Error("expected completed worksheet");

    expect(worksheet.sections.toleranceChainValidity.items.map(({ scope }) => scope)).toEqual([
      "tolerance_loop_closure",
      "datum_chain",
      "assembly_datum_face",
      "stack_start",
      "direction",
      "cross_subsystem",
      "non_geometric_variable",
      "long_dimension_chain",
    ]);
    expect(worksheet.sections.toleranceChainValidity.items.map(({ status }) => status)).toEqual([
      "insufficient_evidence",
      "insufficient_evidence",
      "needs_review",
      "needs_review",
      "not_evaluated",
      "not_evaluated",
      "not_evaluated",
      "not_evaluated",
    ]);
    expect(worksheet.sections.toleranceChainValidity.status).toBe("needs_review");
    for (const item of worksheet.sections.toleranceChainValidity.items) {
      expect(item.relatedStatementIds.every((id) => worksheet.statements.some(({ statementId }) => statementId === id))).toBe(true);
      expect(item.clarificationIds.every((id) => worksheet.clarifications.some(({ clarificationId }) => clarificationId === id))).toBe(true);
      for (const clarificationId of item.clarificationIds) {
        expect(worksheet.clarifications.find(({ clarificationId: id }) => id === clarificationId)).toMatchObject({
          section: "toleranceChainValidity",
          structuralScope: item.scope,
        });
      }
      if (item.status === "needs_review") {
        expect(item.relatedStatementIds.length).toBeGreaterThan(0);
        for (const statementId of item.relatedStatementIds) {
          const statement = worksheet.statements.find(({ statementId: id }) => id === statementId)!;
          if (statement.type === "FACT" && statement.content.provenanceKind === "image_observation") {
            expect(statement.content.scope).toBe(item.scope);
          } else if (statement.type === "SIGNAL" && "signalKind" in statement.content) {
            const triggerScopes = (statement.content.triggerFactReferences ?? []).map((triggerId) => {
              const trigger = worksheet.statements.find(({ statementId: id }) => id === triggerId)!;
              return trigger.type === "FACT" && trigger.content.provenanceKind === "image_observation"
                ? trigger.content.scope
                : undefined;
            });
            const observationScopes = (statement.content.observationEvidence ?? []).map(({ scope }) => scope);
            expect([...triggerScopes, ...observationScopes]).toEqual([item.scope]);
          }
        }
      } else {
        expect(item.clarificationIds.length).toBeGreaterThan(0);
      }
    }
  });

  it.each([
    ["none", [], "not_evaluated", 0, 0],
    ["low", [
      observation({ scope: "stack_start", confidence: "low" }),
      observation({ scope: "direction", confidence: "medium" }),
    ], "needs_review", 0, 1],
    ["rejected", [
      observation({ scope: "stack_start", confidence: "high", reviewStatus: "rejected" }),
      observation({ scope: "direction", confidence: "high", reviewStatus: "confirmed", confirmedBy: "controlled-reviewer", confirmedAt: "2026-08-11T08:00:00.000Z" }),
    ], "needs_review", 1, 1],
    ["medium", [observation()], "needs_review", 0, 1],
    ["high", [observation({ confidence: "high" })], "needs_review", 1, 1],
    ["confirmed", [
      observation({ scope: "assembly_datum_face", confidence: "high", reviewStatus: "confirmed", confirmedBy: "controlled-reviewer", confirmedAt: "2026-08-11T08:00:00.000Z" }),
      observation({ scope: "stack_start", confidence: "high", reviewStatus: "confirmed", confirmedBy: "controlled-reviewer", confirmedAt: "2026-08-11T08:00:00.000Z" }),
      observation({ scope: "cross_subsystem", confidence: "high", reviewStatus: "confirmed", confirmedBy: "controlled-reviewer", confirmedAt: "2026-08-11T08:00:00.000Z" }),
      observation({ scope: "direction", confidence: "high", reviewStatus: "confirmed", confirmedBy: "controlled-reviewer", confirmedAt: "2026-08-11T08:00:00.000Z" }),
    ], "needs_review", 4, 4],
  ] as const)("applies the %s image evidence gate", (imageCase, observations, status, factCount, signalCount) => {
    const result = createF5DataInterpretation(request({ observations: [...observations] }));
    const worksheet = result.worksheets[0]!;
    if (worksheet.status !== "completed") throw new Error("expected completed worksheet");
    const imageFacts = worksheet.statements.filter((statement) => statement.type === "FACT" && statement.content.provenanceKind === "image_observation");
    const imageSignals = worksheet.statements.filter((statement) => statement.type === "SIGNAL" && "signalKind" in statement.content && statement.content.signalKind === "structural_evidence_review");

    expect(worksheet.sections.toleranceChainValidity.status).toBe(status);
    expect(imageFacts).toHaveLength(factCount);
    expect(imageSignals).toHaveLength(signalCount);
    if (imageCase === "rejected") {
      expect(imageFacts.map((statement) => statement.content.scope)).toEqual(["direction"]);
      expect(imageSignals[0]!.content.triggerFactReferences).toEqual(imageFacts.map(({ statementId }) => statementId));
    }
    if (imageCase === "low" || imageCase === "medium") {
      const signalContent = imageSignals[0]!.content as unknown as {
        triggerFactReferences?: string[];
        observationEvidence: unknown[];
      };
      expect(signalContent.triggerFactReferences).toBeUndefined();
      expect(signalContent.observationEvidence).toEqual([
        expect.objectContaining({
          scope: imageCase === "low" ? "direction" : "stack_start",
          observedValue: "visible",
          imageReference,
          confidence: "medium",
          reviewStatus: "unreviewed",
        }),
      ]);
    }
    if (imageCase === "low" || imageCase === "rejected") {
      expect(worksheet.clarifications).toEqual(expect.arrayContaining([
        expect.objectContaining({
          reasonCode: imageCase === "low" ? "image_observation_low_confidence" : "image_observation_rejected",
          missingEvidence: expect.arrayContaining([expect.stringContaining("stack_start")]),
        }),
      ]));
    }
    if (status === "not_evaluated" || status === "insufficient_evidence") {
      expect(worksheet.clarifications.some(({ section }) => section === "toleranceChainValidity")).toBe(true);
    }
  });

  it("treats a lone low-confidence image observation as insufficient evidence", () => {
    const result = createF5DataInterpretation(request({ observations: [observation({ confidence: "low" })] }));
    const worksheet = result.worksheets[0]!;
    if (worksheet.status !== "completed") throw new Error("expected completed worksheet");

    expect(worksheet.sections.toleranceChainValidity.status).toBe("insufficient_evidence");
    expect(worksheet.clarifications).toEqual(expect.arrayContaining([
      expect.objectContaining({
        section: "toleranceChainValidity",
        reasonCode: "image_observation_low_confidence",
      }),
    ]));
    expect(worksheet.statements.some(
      (statement) => statement.type === "FACT" && statement.content.provenanceKind === "image_observation",
    )).toBe(false);
    expect(worksheet.statements.some(
      (statement) => statement.type === "SIGNAL"
        && "signalKind" in statement.content
        && statement.content.signalKind === "structural_evidence_review",
    )).toBe(false);
  });

  it("keeps incomplete confirmed structural evidence in engineering review", () => {
    const result = createF5DataInterpretation(request({ observations: [observation({
      confidence: "high",
      reviewStatus: "confirmed",
      confirmedBy: "controlled-reviewer",
      confirmedAt: "2026-08-11T08:00:00.000Z",
    })] }));
    const worksheet = result.worksheets[0]!;
    if (worksheet.status !== "completed") throw new Error("expected completed worksheet");

    expect(worksheet.sections.toleranceChainValidity.status).toBe("needs_review");
    expect(worksheet.statements).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "SIGNAL", content: expect.objectContaining({ signalKind: "structural_evidence_review" }) }),
    ]));
  });

  it("preserves confirmation audit metadata on image FACT and observation evidence", () => {
    const confirmedBy = "controlled-reviewer";
    const confirmedAt = "2026-08-11T08:00:00.000Z";
    const result = createF5DataInterpretation(request({ observations: [
      observation({ scope: "stack_start", confidence: "high", reviewStatus: "confirmed", confirmedBy, confirmedAt }),
      observation({ scope: "direction", confidence: "medium", reviewStatus: "confirmed", confirmedBy, confirmedAt }),
    ] }));
    const worksheet = result.worksheets[0]!;
    if (worksheet.status !== "completed") throw new Error("expected completed worksheet");

    const imageFact = worksheet.statements.find((statement) => (
      statement.type === "FACT" && statement.content.provenanceKind === "image_observation"
    ));
    expect(imageFact).toEqual(expect.objectContaining({
      content: expect.objectContaining({ confirmedBy, confirmedAt }),
    }));
    const structuralSignal = worksheet.statements.find((statement) => (
      statement.type === "SIGNAL" && "signalKind" in statement.content
        && statement.content.signalKind === "structural_evidence_review"
        && statement.content.observationEvidence !== undefined
    ));
    expect(structuralSignal).toEqual(expect.objectContaining({
      content: expect.objectContaining({
        observationEvidence: [expect.objectContaining({ confirmedBy, confirmedAt })],
      }),
    }));
  });

  it("keeps confirmed ambiguous image evidence in engineering review without creating an engineering RULE", () => {
    const result = createF5DataInterpretation(request({ observations: [observation({
      observedValue: "ambiguous",
      confidence: "high",
      reviewStatus: "confirmed",
      confirmedBy: "controlled-reviewer",
      confirmedAt: "2026-08-11T08:00:00.000Z",
    })] }));
    const worksheet = result.worksheets[0]!;
    if (worksheet.status !== "completed") throw new Error("expected completed worksheet");

    expect(worksheet.sections.toleranceChainValidity.status).toBe("needs_review");
    expect(worksheet.statements.some((statement) => statement.type === "RULE" && statement.section === "tolerance-chain-validity")).toBe(false);
  });

  it("separates v2 visual FACTs from one contextual SIGNAL per core scope", () => {
    const input = v2Request();
    const expectedContextSnapshot = structuredClone(input.worksheets[0]!.contextSnapshot);
    const parsedInput = f5DataInterpretationRequestSchema.safeParse(input);
    expect(parsedInput.success, parsedInput.success ? undefined : JSON.stringify(parsedInput.error.issues, null, 2)).toBe(true);
    const result = createF5DataInterpretation(input);
    const worksheet = result.worksheets[0]!;
    if (worksheet.status !== "completed") throw new Error("expected completed worksheet");

    expect(worksheet).toMatchObject({
      observationVersion: "f5-image-observation-v2",
      contextSnapshot: expectedContextSnapshot,
    });
    expect(worksheet.contextSnapshot).not.toBe(input.worksheets[0]!.contextSnapshot);
    expect(worksheet.contextSnapshot.rows[0]).not.toBe(input.worksheets[0]!.contextSnapshot.rows[0]);

    const imageFacts = worksheet.statements.filter((statement) => (
      statement.type === "FACT" && statement.content.provenanceKind === "image_observation"
    ));
    expect(imageFacts.map((statement) => statement.content.scope)).toEqual(["stack_start", "direction"]);
    expect(imageFacts.find(({ content }) => content.scope === "direction")?.content).toMatchObject({
      visibleLabels: ["factor-1"],
    });
    for (const fact of imageFacts) {
      expect(fact.content).not.toHaveProperty("textBasis");
      expect(fact.content).not.toHaveProperty("contextSnapshot");
      expect(fact.statementId).toBe(`f5-image-fact-${fact.content.scope}`);
    }

    const contextSignals = worksheet.statements.filter((statement) => (
      statement.type === "SIGNAL" && "signalKind" in statement.content
        && statement.content.signalKind === "image_text_context_review"
    ));
    expect(contextSignals).toHaveLength(5);
    expect(contextSignals.map((statement) => statement.content.scope)).toEqual(CORE_SCOPES);
    expect(contextSignals.map((statement) => statement.statementId)).toEqual([
      "f5-context-signal-tolerance_loop_closure",
      "f5-context-signal-datum_chain",
      "f5-context-signal-assembly_datum_face",
      "f5-context-signal-stack_start",
      "f5-context-signal-direction",
    ]);
    expect(contextSignals.every((statement) => statement.content.requiresEngineeringReview)).toBe(true);
    expect(contextSignals.find((statement) => statement.content.scope === "direction")?.content).toMatchObject({
      signalValue: "indicated_consistent",
      textBasis: expect.stringContaining("direction"),
      linkedSourceRows: [{ tableId: "table-a", sourceRow: 2 }],
      linkedVisualLabels: [{ label: "factor-1", tableId: "table-a", sourceRow: 2 }],
    });
    expect(worksheet.statements.some((statement) => (
      statement.type === "RULE" && statement.section === "tolerance-chain-validity"
    ))).toBe(false);
  });

  it("keeps all v2 core scopes reviewed while retaining noncore clarifications and F6 delegation", () => {
    const input = v2Request();
    const worksheetInput = input.worksheets[0]!;
    worksheetInput.imageObservations.find(({ scope }) => scope === "stack_start")!.visualObservation = {
      observedValue: "ambiguous",
      confidence: "low",
      visibleBasis: "No visible start marker or reliable mapping.",
      visibleLabels: [],
      reviewStatus: "unreviewed",
    };
    worksheetInput.imageObservations.find(({ scope }) => scope === "stack_start")!.contextualSignal = {
      signalValue: "insufficient_evidence",
      textBasis: "The first row alone does not identify a visible stack start.",
      linkedSourceRows: [],
      linkedVisualLabels: [],
      requiresEngineeringReview: true,
    };
    worksheetInput.imageObservations.find(({ scope }) => scope === "assembly_datum_face")!.contextualSignal = {
      signalValue: "insufficient_evidence",
      textBasis: "No marked assembly datum face is visible.",
      linkedSourceRows: [],
      linkedVisualLabels: [],
      requiresEngineeringReview: true,
    };

    const parsedInput = f5DataInterpretationRequestSchema.safeParse(input);
    expect(parsedInput.success, parsedInput.success ? undefined : JSON.stringify(parsedInput.error.issues, null, 2)).toBe(true);

    const result = createF5DataInterpretation(input);
    const worksheet = result.worksheets[0]!;
    if (worksheet.status !== "completed") throw new Error("expected completed worksheet");
    const itemByScope = new Map(worksheet.sections.toleranceChainValidity.items.map((item) => [item.scope, item]));

    for (const scope of CORE_SCOPES) {
      expect(itemByScope.get(scope)?.status).not.toBe("not_evaluated");
    }
    expect(itemByScope.get("stack_start")?.status).toBe("insufficient_evidence");
    expect(worksheet.statements.some((statement) => (
      statement.type === "FACT" && statement.content.provenanceKind === "image_observation"
        && statement.content.scope === "stack_start"
    ))).toBe(false);
    expect(worksheet.clarifications.map(({ structuralScope }) => structuralScope)).toEqual([
      "stack_start",
      "cross_subsystem",
      "non_geometric_variable",
      "long_dimension_chain",
    ]);
    expect(worksheet.sections.reasonableToleranceRange.status).toBe("delegated_to_f6");
    expect(worksheet.sections.designOptimizationAndParallelOptions.status).toBe("delegated_to_f6");
  });

  it.each(["missing", "suspected_invalid", "duplicate_conflict", "blocked_for_reminder"] as const)(
    "emits identifier governance review signals for %s without invalidating tolerance-chain status",
    (issue) => {
    const input = issue === "missing" ? request({ governanceStatus: "needs_governance" }) : request();
    if (issue !== "missing") {
      for (const row of input.worksheets[0]!.governanceRows) {
        row.governanceStatus = issue === "blocked_for_reminder" ? "blocked_for_reminder" : "needs_governance";
        if (issue === "suspected_invalid") {
          delete row.drawingDimensionKey;
          row.dimIdStatus = "suspected_invalid";
          row.qualitySignals = ["dim_id_suspected_invalid"];
        } else if (issue === "duplicate_conflict") {
          row.qualitySignals = ["duplicate_conflict"];
        }
      }
    }
    const result = createF5DataInterpretation(input);
    const worksheet = result.worksheets[0]!;
    if (worksheet.status !== "completed") throw new Error("expected completed worksheet");
    const governanceSignals = worksheet.statements.filter((statement) => statement.type === "SIGNAL" && "signalKind" in statement.content && statement.content.signalKind === "identifier_governance_gap");
    const governanceFacts = worksheet.statements.filter((statement) => (
      statement.type === "FACT" && statement.content.provenanceKind === "f3_governance"
    ));

    expect(governanceSignals).toHaveLength(4);
    expect(governanceFacts).toHaveLength(4);
    expect(governanceSignals.every((statement) => statement.content.requiresEngineeringReview)).toBe(true);
    for (const row of input.worksheets[0]!.governanceRows) {
      const governanceFact = governanceFacts.find((statement) => (
        statement.type === "FACT"
        && statement.content.provenanceKind === "f3_governance"
        && statement.content.source.sourceRow === row.source.sourceRow
      ));
      expect(governanceFact).toEqual(expect.objectContaining({
        type: "FACT",
        section: "major-contributors",
        content: {
          provenanceKind: "f3_governance",
          source: row.source,
          drawingNumber: row.drawingNumber,
          dimId: row.dimId,
          dimIdStatus: row.dimIdStatus,
          governanceStatus: row.governanceStatus,
          qualitySignals: row.qualitySignals,
        },
      }));
      const governanceSignal = governanceSignals.find((statement) => (
        statement.content.triggerFactReferences[0] === governanceFact?.statementId
      ));
      expect(governanceSignal).toBeDefined();
    }
    expect(worksheet.sections.toleranceChainValidity.status).toBe("not_evaluated");
    if (issue === "missing") {
      expect(worksheet.sections.majorContributors.items.every((item) => item.drawingNumber === null && item.dimId === null)).toBe(true);
    }
  });

  it("proposes only structural assumptions for missing datum, stack start, subsystem, and direction evidence", () => {
    const result = createF5DataInterpretation(request());
    const worksheet = result.worksheets[0]!;
    if (worksheet.status !== "completed") throw new Error("expected completed worksheet");

    expect(worksheet.assumptions.map(({ assumptionId }) => assumptionId)).toEqual([
      "assumption-assembly-datum-face",
      "assumption-stack-start",
      "assumption-cross-subsystem",
      "assumption-direction",
    ]);
    expect(worksheet.assumptions.every(({ status, affectedSections }) => status === "proposed" && affectedSections.length === 1 && affectedSections[0] === "toleranceChainValidity")).toBe(true);
    expect(worksheet.sections.capabilityVsSpecification.statementIds.length).toBeGreaterThan(0);
    expect(worksheet.sections.majorContributors.items).toHaveLength(4);
  });

  it("preserves objective FACT mapping for RSS matched, not-applicable, and insufficient-facts results", () => {
    const matched = createF5DataInterpretation(request());
    const notApplicable = createF5DataInterpretation(request({ factorCount: 3 }));
    const insufficientObjective = vi.fn((input: unknown) => {
      const objective = structuredClone(createInterpretation(input));
      if (objective.status !== "completed") throw new Error("expected completed objective fixture");
      objective.ruleEvaluationStatus = "insufficient-facts";
      objective.statements = objective.statements.filter(({ type }) => type === "FACT");
      objective.clarifications.push({
        clarificationId: "clarification-rule-facts-insufficient",
        reasonCode: "rule_facts_insufficient",
        message: "Controlled calculation facts are insufficient.",
        missingFacts: ["targetCpk"],
      });
      return objective;
    });
    const insufficient = createF5DataInterpretation(request(), { createObjectiveInterpretation: insufficientObjective as typeof createInterpretation });

    for (const result of [matched, notApplicable, insufficient]) {
      const worksheet = result.worksheets[0]!;
      if (worksheet.status !== "completed") throw new Error("expected completed worksheet");
      expect(worksheet.statements).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: "FACT", content: expect.objectContaining({ metric: "cpk" }) }),
        expect.objectContaining({ type: "FACT", content: expect.objectContaining({ metric: "factor_contribution" }) }),
      ]));
      expect(f5DataInterpretationResultSchema.safeParse(result).success).toBe(true);
    }
  });

  it("deep-freezes a clone and leaves request input unchanged", () => {
    const input = request({ observations: [observation()] });
    const before = structuredClone(input);
    const result = createF5DataInterpretation(input);

    expect(input).toEqual(before);
    expect(result).not.toBe(input);
    expectDeeplyFrozen(result);
  });

  it("uses safe typed errors for invalid and public requests", () => {
    const marker = "sensitive-f5-marker";
    const invalidError = captureThrown(() => createF5DataInterpretation({ inputClassification: "confidential", marker }));
    const policyError = captureThrown(() => createF5DataInterpretation({ inputClassification: "public", marker }));

    expect(invalidError).toMatchObject({ code: "validation_error", affectedInputReferences: ["f5-data-interpretation-request-v1"] });
    expect(policyError).toMatchObject({ code: "policy_denied", affectedInputReferences: ["f5-data-interpretation-request-v1"] });
    expect(JSON.stringify([invalidError, policyError])).not.toContain(marker);
  });

  it("exports the orchestrator through the built ESM package entrypoint", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        "import { createF5DataInterpretation } from '@ai-assist/workbook-catalog'; console.log(typeof createF5DataInterpretation);",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(output.trim()).toBe("function");
  });
});