import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { f5DataInterpretationResultSchema } from "../packages/contracts/dist/contracts.js";
import { createCalculation } from "../packages/workbook-catalog/src/calculation.ts";
import { createF5DataInterpretation } from "../packages/workbook-catalog/src/f5-data-interpretation.ts";
import { renderF5Report } from "./f5-report.mjs";

const CONTENT_HASH = "a".repeat(64);
const IMAGE_HASH = "b".repeat(64);
const CORE_SCOPES = [
  "tolerance_loop_closure",
  "datum_chain",
  "assembly_datum_face",
  "stack_start",
  "direction",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function availableText(rawText, sourceCell) {
  return { status: "available", rawText, sourceCell };
}

function availableNumber(rawText, sourceCell, numericValue) {
  return { status: "available", rawText, sourceCell, numericValue, unit: "mm" };
}

function calculationRequest(factorName = "factor|one") {
  const factors = [factorName, "factor-two", "factor-three", "factor-four"];
  const rows = factors.map((name, index) => {
    const row = index + 2;
    return {
      sourceRow: row,
      fields: {
        factorName: availableText(name, `Analysis-A!A${row}`),
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
    contractVersion: "v1",
    inputClassification: "confidential",
    projectReference: "controlled-project-reference",
    runReference: "controlled-run-reference",
    worksheetAnalysisAssets: {
      contractVersion: "v1",
      workbook: { classification: "confidential", contentHash: CONTENT_HASH, catalogContractVersion: "v1" },
      worksheets: [{
        worksheetName: "Analysis-A",
        toleranceLoopDescription: "anonymous-analysis",
        factorTables: [{
          tableId: "table-a",
          headerRow: 1,
          dataRange: { startRow: 2, endRow: 5 },
          columns: [
            { semanticField: "factorName", headerText: "Factor", sourceColumn: "A" },
            { semanticField: "nominalValue", headerText: "Nominal", sourceColumn: "B" },
            { semanticField: "upperTolerance", headerText: "Upper", sourceColumn: "C" },
            { semanticField: "lowerTolerance", headerText: "Lower", sourceColumn: "D" },
            { semanticField: "longTermSafetyFactor", headerText: "LTSF", sourceColumn: "E" },
            { semanticField: "standardDeviation", headerText: "Sigma", sourceColumn: "F" },
            { semanticField: "distribution", headerText: "Distribution", sourceColumn: "G" },
            { semanticField: "unit", headerText: "Unit", sourceColumn: "H" },
          ],
          rows,
        }],
        formulaCells: [],
        imageAssets: [],
      }],
    },
    requiredFieldCheck: {
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash: CONTENT_HASH,
      status: "readyForNextCheck",
      blockingIssues: [],
      advisoryIssues: [],
      summary: { worksheetsChecked: 1, factorTablesChecked: 1, factorRowsChecked: 4, blockingIssueCount: 0, advisoryIssueCount: 0 },
    },
    exceptionResolution: {
      contractVersion: "v1",
      inputClassification: "confidential",
      workbookContentHash: CONTENT_HASH,
      knowledgeBaseVersion: "v1",
      status: "readyToContinue",
      readyToContinue: true,
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
    criticality: "none",
    scenarioOverrides: [],
  };
}

function observation(overrides = {}) {
  return {
    scope: "stack_start",
    observedValue: "visible",
    confidence: "medium",
    visibleBasis: "Observed marker; requires review.",
    reviewStatus: "unreviewed",
    ...overrides,
  };
}

function completedReport({
  observations = [],
  factorName,
  governanceGap = false,
  contextual = false,
  contextualConfidences = CORE_SCOPES.map(() => "high"),
} = {}) {
  const calculationResult = createCalculation(calculationRequest(factorName));
  if (calculationResult.status !== "completed") throw new Error("Expected completed calculation fixture.");
  const imageReference = {
    artifact: "f1",
    worksheetName: "Analysis-A",
    relativePath: "artifacts/analysis-a.png",
    contentHash: IMAGE_HASH,
  };
  const governanceRows = calculationResult.factors.map((factor, index) => ({
    factorInstanceId: String(index + 1).padStart(64, "0"),
    drawingDimensionKey: String(index + 11).padStart(64, "0"),
    deviceLevelDim: `device-dim-${index + 1}`,
    dimensionDescription: "dimension-1",
    partCategory: "controlled-category",
    partSubsystem: "controlled-subsystem",
    drawingNumber: index === 0 ? "DRAW|1" : `DRAW-${index + 1}`,
    dimId: `DIM-${index + 1}`,
    factorDescription: factor.factorName,
    nominal: factor.input.nominalValue,
    upperTolerance: factor.input.upperTolerance,
    lowerTolerance: factor.input.lowerTolerance,
    sigmaLevel: factor.input.sigmaLevel,
    dimIdStatus: "valid",
    qualitySignals: [],
    governanceStatus: governanceGap && index === 0 ? "needs_governance" : "complete",
    imageReference,
    source: {
      ...factor.source,
      sourceCells: {
        partName: `Analysis-A!I${factor.source.sourceRow}`,
        factorName: `Analysis-A!A${factor.source.sourceRow}`,
        nominalValue: `Analysis-A!B${factor.source.sourceRow}`,
        upperTolerance: `Analysis-A!C${factor.source.sourceRow}`,
        lowerTolerance: `Analysis-A!D${factor.source.sourceRow}`,
        standardDeviation: `Analysis-A!F${factor.source.sourceRow}`,
      },
    },
  }));
  const contextualObservations = CORE_SCOPES.map((scope, index) => ({
    scope,
    visualObservation: {
      observedValue: "visible",
      confidence: contextualConfidences[index],
      visibleBasis: `Visible marker for ${scope}.`,
      visibleLabels: scope === "direction" ? ["direction-label"] : [],
      reviewStatus: "unreviewed",
    },
    contextualSignal: {
      signalValue: scope === "direction" && contextualConfidences[index] === "high"
        ? "indicated_consistent"
        : "ambiguous",
      textBasis: `Image and worksheet context require review for ${scope}.`,
      linkedSourceRows: scope === "direction" && contextualConfidences[index] === "high"
        ? [{ tableId: governanceRows[0].source.tableId, sourceRow: governanceRows[0].source.sourceRow }]
        : [],
      linkedVisualLabels: scope === "direction" && contextualConfidences[index] === "high"
        ? [{ label: "direction-label", tableId: governanceRows[0].source.tableId, sourceRow: governanceRows[0].source.sourceRow }]
        : [],
      requiresEngineeringReview: true,
    },
  }));
  const contextSnapshot = {
    dimensionDescription: governanceRows[0].dimensionDescription,
    rows: governanceRows.map((row) => ({
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
      sourceCells: row.source.sourceCells,
    })).reverse(),
  };
  const worksheet = {
    worksheetName: "Analysis-A",
    imageReference,
    governanceRows,
    calculationResult,
    imageObservations: contextual ? contextualObservations : observations,
    ...(contextual ? { observationVersion: "f5-image-observation-v2", contextSnapshot } : {}),
  };
  return createF5DataInterpretation({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: CONTENT_HASH },
    knowledgeBaseVersion: "interpretation-rules-v1",
    worksheets: [worksheet],
  });
}

function withRejectedWorksheet(report, onlyRejected = false) {
  const rejected = {
    worksheetName: "Rejected|Sheet",
    status: "input_rejected",
    reasonCode: "artifact_contract_invalid",
    artifactReference: "worksheet:Rejected|Sheet",
  };
  if (onlyRejected) {
    return {
      ...report,
      status: "input_rejected",
      worksheets: [rejected],
      summary: {
        worksheetCount: 1,
        completedWorksheetCount: 0,
        inputRejectedWorksheetCount: 1,
        statementCount: 0,
        clarificationCount: 0,
        assumptionCount: 0,
      },
    };
  }
  return {
    ...report,
    status: "partially_completed",
    worksheets: [...report.worksheets, rejected],
    summary: { ...report.summary, worksheetCount: 2, inputRejectedWorksheetCount: 1 },
  };
}

function chapter(markdown, heading, nextHeading) {
  const appendixText = auditAppendix(markdown);
  const start = appendixText.indexOf(heading);
  const end = nextHeading === undefined ? appendixText.length : appendixText.indexOf(nextHeading, start);
  return appendixText.slice(start, end);
}

function section(markdown, heading, nextHeading) {
  const start = markdown.indexOf(heading);
  const end = nextHeading === undefined ? markdown.length : markdown.indexOf(nextHeading, start + heading.length);
  return markdown.slice(start, end < 0 ? markdown.length : end);
}

function engineeringSummary(markdown) {
  return section(markdown, "## 工程审查摘要", "## 审计附录");
}

function auditAppendix(markdown) {
  return section(markdown, "## 审计附录");
}

function toleranceStatusReport(status) {
  if (status === "not_evaluated") return completedReport();
  if (status === "needs_review") return completedReport({ observations: [observation()] });
  if (status === "insufficient_evidence") {
    return completedReport({ observations: [observation({ confidence: "low" })] });
  }

  const scopes = [
    "tolerance_loop_closure",
    "datum_chain",
    "assembly_datum_face",
    "stack_start",
    "direction",
    "cross_subsystem",
    "non_geometric_variable",
    "long_dimension_chain",
  ];
  const report = clone(status === "supported"
    ? completedReport({ observations: scopes.map((scope) => observation({ scope, confidence: "high" })) })
    : completedReport());
  const worksheet = report.worksheets[0];
  worksheet.sections.toleranceChainValidity.status = status;
  worksheet.sections.toleranceChainValidity.items = worksheet.sections.toleranceChainValidity.items.map((item) => {
    if (status === "not_applicable") return { ...item, status, relatedStatementIds: [] };
    const imageFact = worksheet.statements.find((statement) => (
      statement.type === "FACT" && statement.content.provenanceKind === "image_observation"
        && statement.content.scope === item.scope
    ));
    return { ...item, status, relatedStatementIds: [imageFact.statementId], clarificationIds: [] };
  });
  return report;
}

describe("renderF5Report", () => {
  it("renders engineering summary before audit appendix with the required worksheet table columns", () => {
    const markdown = renderF5Report(completedReport({ observations: [observation({ confidence: "high" })] }));

    expect(markdown.indexOf("## 工程审查摘要")).toBeGreaterThanOrEqual(0);
    expect(markdown.indexOf("## 审计附录")).toBeGreaterThanOrEqual(0);
    expect(markdown.indexOf("## 工程审查摘要")).toBeLessThan(markdown.indexOf("## 审计附录"));

    const summary = engineeringSummary(markdown);
    expect(summary).toContain("| Worksheet | Status | Cpk | Target Cpk | Top Contributor | Image Evidence | Governance | Next Step |");
    expect(summary).toContain("| Analysis-A |");
  });

  it("keeps verbose provenance in audit appendix while summary remains concise and ownership-scoped", () => {
    const markdown = renderF5Report(completedReport({ observations: [observation({ confidence: "high" })] }));
    const summary = engineeringSummary(markdown);
    const appendix = auditAppendix(markdown);

    for (const label of [
      "image evidence",
      "capability/spec",
      "top contributors",
      "high-confidence visual FACT",
      "ME-review SIGNAL",
      "governance missing",
      "clarification",
      "next step",
      "F5 owned: image evidence, capability/spec interpretation, contributors",
      "Delegated to F6: quantified tolerance range, optimization scenarios, ROI, final engineering decision",
    ]) {
      expect(summary).toContain(label);
    }

    expect(summary).not.toContain("sourceFileHash=");
    expect(summary).not.toContain("sourceCells=");
    expect(appendix).toContain("sourceFileHash=");
    expect(appendix).toContain("sourceCells=");
  });

  it("declares the governed bilingual evidence taxonomy without changing F5 ownership", () => {
    const markdown = renderF5Report(completedReport());

    for (const label of [
      "【输入事实 Fact】", "【计算结果 Calculated】", "【数学推导 Derived】",
      "【工程假设 Assumption】", "【工程推断 Inference】", "【数据缺口 Missing】",
    ]) expect(markdown).toContain(label);
    expect(markdown).not.toContain("ROI ranking");
  });

  it("uses the v2 observation version discriminator to render all v2 evidence layers", () => {
    const report = completedReport({ contextual: true });
    expect(report.worksheets[0].observationVersion).toBe("f5-image-observation-v2");

    const markdown = chapter(
      renderF5Report(report),
      "## 1. 公差链有效性",
      "## 2. 能力与规格对比",
    );

    for (const heading of [
      "#### 五项状态矩阵",
      "#### Visual FACT",
      "#### Worksheet context SIGNAL",
      "#### 分析上下文快照",
    ]) {
      expect(markdown).toContain(heading);
    }
  });

  it("renders v2 scope matrix, isolated visual FACTs, and contextual SIGNALs", () => {
    const markdown = chapter(
      renderF5Report(completedReport({ contextual: true })),
      "## 1. 公差链有效性",
      "## 2. 能力与规格对比",
    );

    expect(markdown).toContain("五项状态矩阵");
    expect(markdown).toContain("Visual FACT");
    expect(markdown).toContain("Worksheet context SIGNAL");
    expect(markdown).toContain("图文联合提示，非工程结论");
    const matrix = section(markdown, "#### 五项状态矩阵", "#### Visual FACT");
    for (const scope of CORE_SCOPES) {
      expect(matrix.match(new RegExp(`\\| ${scope} \\|`, "g"))).toHaveLength(1);
    }

    const visualFacts = section(markdown, "#### Visual FACT", "#### Worksheet context SIGNAL");
    for (const label of ["observedValue", "confidence", "reviewStatus", "image", "visibleBasis", "visibleLabels"]) {
      expect(visualFacts).toContain(label);
    }
    expect(visualFacts).toContain("direction-label");
    expect(visualFacts).not.toMatch(/textBasis|context snapshot/i);

    const contextSignals = section(markdown, "#### Worksheet context SIGNAL", "#### 分析上下文快照");
    for (const label of ["signalValue", "textBasis", "linkedSourceRows", "linkedVisualLabels", "requiresEngineeringReview"]) {
      expect(contextSignals).toContain(label);
    }
    expect(contextSignals).toContain("direction-label");
    expect(contextSignals).toContain("table-a:2");
  });

  it("renders every v2 context snapshot row in source order with original, mapped, numeric, and source-cell fields", () => {
    const report = clone(completedReport({ contextual: true }));
    report.worksheets[0].governanceRows.reverse();
    const markdown = chapter(
      renderF5Report(report),
      "## 1. 公差链有效性",
      "## 2. 能力与规格对比",
    );
    const snapshot = section(markdown, "#### 分析上下文快照", "#### 澄清卡片");

    for (const label of [
      "dimensionDescription",
      "partName",
      "partSubsystem",
      "partCategory",
      "factorName",
      "factorDescription",
      "nominal",
      "upperTolerance",
      "lowerTolerance",
      "sigmaLevel",
      "sourceCells",
    ]) {
      expect(snapshot).toContain(label);
    }
    for (const sourceRow of [2, 3, 4, 5]) expect(snapshot).toContain(`| table-a | ${sourceRow} |`);
    expect(snapshot.indexOf("| table-a | 2 |")).toBeLessThan(snapshot.indexOf("| table-a | 3 |"));
    expect(snapshot.indexOf("| table-a | 3 |")).toBeLessThan(snapshot.indexOf("| table-a | 4 |"));
    expect(snapshot.indexOf("| table-a | 4 |")).toBeLessThan(snapshot.indexOf("| table-a | 5 |"));
    expect(snapshot).toContain("| table-a | 2 | controlled-subsystem | controlled-subsystem | controlled-category | factor|one | factor|one | 0 | 1 | -1 | 2 |".replaceAll("factor|one", "factor\\|one"));
    expect(snapshot).toContain("Analysis-A\\!A2");
    expect(markdown).not.toMatch(/[A-Za-z]:[\\/]/);
  });

  it("escapes and redacts adversarial v2 context text without leaking raw unsafe payloads", () => {
    const report = clone(completedReport({ contextual: true }));
    const worksheet = report.worksheets[0];
    const row = worksheet.contextSnapshot.rows[0];
    const governanceRow = worksheet.governanceRows.find((candidate) => (
      candidate.source.tableId === row.tableId && candidate.source.sourceRow === row.sourceRow
    ));
    const directionSignal = worksheet.statements.find((statement) => (
      statement.type === "SIGNAL"
      && statement.content.signalKind === "image_text_context_review"
      && statement.content.scope === "direction"
    ));
    const directionFact = worksheet.statements.find((statement) => (
      statement.type === "FACT"
      && statement.content.provenanceKind === "image_observation"
      && statement.content.scope === "direction"
    ));
    const unsafeMapped = "<script>mapped()</script>|[mapped](javascript:alert(1))";
    const unsafeOriginal = "# injected-heading|<img src=x onerror=alert(1)>";
    const unsafePath = "C:\\private\\context\\source.xlsx!A2";

    governanceRow.partSubsystem = unsafeMapped;
    row.partSubsystem = unsafeMapped;
    row.partName = unsafeMapped;
    governanceRow.factorDescription = unsafeOriginal;
    row.factorName = unsafeOriginal;
    row.factorDescription = unsafeOriginal;
    const unsafeDimension = "<b>dimension</b> C:\\private\\dimension.txt";
    worksheet.contextSnapshot.dimensionDescription = unsafeDimension;
    for (const candidate of worksheet.governanceRows) candidate.dimensionDescription = unsafeDimension;
    governanceRow.source.sourceCells = { factorName: unsafePath };
    row.sourceCells = { factorName: unsafePath };
    directionSignal.content.textBasis = "<script>signal()</script>|C:\\private\\signal.txt";
    const unsafeLabel = "![label](javascript:alert(3))|<svg>";
    directionSignal.content.linkedVisualLabels[0].label = unsafeLabel;
    directionSignal.content.visualEvidence.visibleLabels = [unsafeLabel];
    directionFact.content.visibleLabels = [unsafeLabel];

    const markdown = renderF5Report(report);

    expect(markdown).toContain("&lt;script&gt;mapped\\(\\)&lt;/script&gt;\\|");
    expect(markdown).toContain("[redacted-local-path]");
    expect(markdown).not.toMatch(/<\/?(?:script|img|svg|b)\b/i);
    expect(markdown).not.toMatch(/!?\[[^\]]*\]\(javascript:/i);
    expect(markdown).not.toContain(unsafePath);
    expect(markdown).not.toContain("C:\\private\\");
    expect(markdown).not.toMatch(/^# injected-heading$/m);
  });

  it("renders a controlled Visual FACT empty state for valid v2 medium and low observations", () => {
    const markdown = chapter(
      renderF5Report(completedReport({
        contextual: true,
        contextualConfidences: ["medium", "low", "medium", "low", "medium"],
      })),
      "## 1. 公差链有效性",
      "## 2. 能力与规格对比",
    );

    const matrix = section(markdown, "#### 五项状态矩阵", "#### Visual FACT");
    expect(matrix.match(/^\| (?:tolerance_loop_closure|datum_chain|assembly_datum_face|stack_start|direction) \|/gm)).toHaveLength(5);
    const visualFacts = section(markdown, "#### Visual FACT", "#### Worksheet context SIGNAL");
    expect(visualFacts).toContain("无满足 FACT gate 的视觉观察");
    expect(markdown).toContain("#### Worksheet context SIGNAL");
    expect(markdown).toContain("#### 分析上下文快照");
  });

  it("preserves v1 rendering and keeps no-v2 fallback clarifications", () => {
    const legacy = renderF5Report(completedReport({ observations: [observation()] }));
    expect(legacy).toContain("- SIGNAL `f5-signal-structural-evidence-review-stack_start`：需要 ME 评审");
    expect(legacy).not.toContain("五项状态矩阵");
    expect(legacy).not.toContain("Worksheet context SIGNAL");

    const fallback = chapter(
      renderF5Report(completedReport()),
      "## 1. 公差链有效性",
      "## 2. 能力与规格对比",
    );
    expect(fallback).toContain("not_evaluated");
    expect(fallback).toContain("drawing_evidence_not_evaluated");
    expect(fallback).toContain("questionForReviewer");
  });

  it("renders the five fixed chapters in order with chapter-scoped FACT and RULE provenance", () => {
    const markdown = renderF5Report(completedReport({ observations: [observation({ confidence: "high" })] }));
    const headings = [
      "## 1. 公差链有效性",
      "## 2. 能力与规格对比",
      "## 3. 主要贡献因子",
      "## 4. 合理公差范围",
      "## 5. 设计优化与并列方案",
    ];

    const headingIndexes = headings.map((heading) => {
      expect(markdown).toContain(heading);
      const index = markdown.indexOf(heading);
      expect(index).toBeGreaterThanOrEqual(0);
      return index;
    });
    expect(headingIndexes).toEqual([...headingIndexes].sort((left, right) => left - right));
    const toleranceChapter = chapter(markdown, headings[0], headings[1]);
    const capabilityChapter = chapter(markdown, headings[1], headings[2]);
    const contributorChapter = chapter(markdown, headings[2], headings[3]);

    expect(toleranceChapter).toContain("| FACT | f5-image-fact-stack_start |");
    expect(capabilityChapter).toContain("#### RULE performance-rule-performance-cpk-below-target");
    expect(capabilityChapter).toContain("| entryId | performance-cpk-below-target |");
    expect(capabilityChapter).toContain("| effectiveVersion | interpretation-rules-v1 |");
    expect(capabilityChapter).toContain("sourceAlias=ta-interpretation-rules-v4-2");
    expect(capabilityChapter).toContain("sheetName=02_Performance_Rules");
    expect(capabilityChapter).toContain("sourceRange=A2:H4");
    expect(capabilityChapter).toContain("sourceFileHash=e3e1954233e94c058088c5084b9a27a7847efc74fbf8a26f51584c40ca4f9fa5");
    for (const metric of [
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
    ]) {
      expect(capabilityChapter).toContain(`| ${metric} |`);
    }
    expect(contributorChapter).toContain("factorReference");
    expect(contributorChapter).toContain("halfTolerance");
    expect(contributorChapter).toContain("sigma");
    expect(contributorChapter).toContain("unit");
    expect(contributorChapter).toContain("reasonCodes");
    expect(contributorChapter).toContain("relatedStatementIds");
    expect(contributorChapter).toContain("governance FACT=f5-fact-f3-governance-1");
    expect(contributorChapter).toContain("Worksheet=Analysis-A; Table=table-a; Row=2");
    expect(contributorChapter).toContain("contribution_concentration");
    expect(contributorChapter).toContain("root-cause-signal-root-cause-contributor-concentration");
    expect(contributorChapter).toContain("#### SIGNAL root-cause-signal-root-cause-contributor-concentration");
    expect(contributorChapter).toContain("| entryId | root-cause-contributor-concentration |");
    expect(contributorChapter).toContain("| effectiveVersion | interpretation-rules-v1 |");
    expect(contributorChapter).toContain("| applicability | analysisDimension=one-dimensional; method=rss |");
    expect(contributorChapter).toContain("| requiresEngineeringReview | true |");
    expect(contributorChapter).toContain("| relatedFactReferences | contributors |");
  });

  it("renders the fixed tolerance status table with every scope and its trace references", () => {
    const report = completedReport({ observations: [observation()] });
    const worksheet = report.worksheets[0];
    const markdown = chapter(
      renderF5Report(report),
      "## 1. 公差链有效性",
      "## 2. 能力与规格对比",
    );

    expect(markdown).toContain("| scope | status | relatedStatementIds | clarificationIds |");
    expect(worksheet.sections.toleranceChainValidity.items).toHaveLength(8);
    for (const item of worksheet.sections.toleranceChainValidity.items) {
      expect(markdown).toContain(`| ${item.scope} | ${item.status} |`);
      for (const statementId of item.relatedStatementIds) expect(markdown).toContain(statementId);
      for (const clarificationId of item.clarificationIds) expect(markdown).toContain(clarificationId);
    }
  });

  it("renders complete capability FACT provenance details", () => {
    const markdown = chapter(
      renderF5Report(completedReport()),
      "## 2. 能力与规格对比",
      "## 3. 主要贡献因子",
    );

    expect(markdown).toContain("| 类型 | statementId | metric | value | unit | provenance | detail |");
    expect(markdown).toContain("outputField=capability.cpk");
    expect(markdown).toContain("formulaId=cpk-v1");
    expect(markdown).toContain("formulaVersion=excel-ta-v1");
    expect(markdown).toContain("sourceCells=Analysis-A\\!B2");
    expect(markdown).toContain("inputField=capability.targetCpk");
    expect(markdown).toContain("method=rss_1d; reason=factor_count_4_to_10; inputField=recommendation.method");
    expect(markdown).toContain("sourceOutputFields=capability.lowerZ, capability.upperZ");
    expect(markdown).toContain("outputField=capability.lowerZ; formulaId=z-lower-v1");
    expect(markdown).toContain("outputField=capability.upperZ; formulaId=z-upper-v1");
  });

  it("uses real contained roots to calculate a relative image link", () => {
    const temporaryRoot = mkdtempSync(path.join(tmpdir(), "f5-report-"));
    const f1ArtifactRoot = path.join(temporaryRoot, "f1");
    const outputRoot = path.join(temporaryRoot, "f5");
    const imagePath = path.join(f1ArtifactRoot, "artifacts", "analysis-a.png");
    mkdirSync(path.dirname(imagePath), { recursive: true });
    mkdirSync(outputRoot, { recursive: true });
    writeFileSync(imagePath, "controlled-image", "utf8");

    const report = completedReport({ observations: [observation({ confidence: "high" })] });
    const markdown = renderF5Report(report, { outputRoot, f1ArtifactRoot, publishRoot: temporaryRoot });

    expect(markdown).toContain("[F1 图片](../f1/artifacts/analysis-a.png)");
    expect(markdown).not.toContain("F1 图片证据链接不可用");
    expect(markdown).not.toContain(temporaryRoot);
  });

  it("renders clickable summary image links only for contained roots and keeps safe fallback otherwise", () => {
    const temporaryRoot = mkdtempSync(path.join(tmpdir(), "f5-report-summary-"));
    const f1ArtifactRoot = path.join(temporaryRoot, "f1");
    const outputRoot = path.join(temporaryRoot, "f5");
    const imagePath = path.join(f1ArtifactRoot, "artifacts", "analysis-a.png");
    mkdirSync(path.dirname(imagePath), { recursive: true });
    mkdirSync(outputRoot, { recursive: true });
    writeFileSync(imagePath, "controlled-image", "utf8");

    const report = completedReport({ observations: [observation({ confidence: "high" })] });
    const withContainedRoots = renderF5Report(report, { outputRoot, f1ArtifactRoot, publishRoot: temporaryRoot });
    const summaryWithContainedRoots = engineeringSummary(withContainedRoots);

    expect(summaryWithContainedRoots).toContain("[F1 图片](../f1/artifacts/analysis-a.png)");
    expect(summaryWithContainedRoots).toContain("- image evidence: [F1 图片](../f1/artifacts/analysis-a.png)");
    expect(summaryWithContainedRoots).not.toContain("\\[F1 图片\\]\\(");
    expect(summaryWithContainedRoots).not.toContain(temporaryRoot);

    const withoutPublishRoot = renderF5Report(report, { outputRoot, f1ArtifactRoot });
    const summaryWithoutPublishRoot = engineeringSummary(withoutPublishRoot);
    expect(summaryWithoutPublishRoot).toContain("F1 图片证据链接不可用");
    expect(summaryWithoutPublishRoot).not.toContain("[F1 图片](");
    expect(summaryWithoutPublishRoot).not.toContain(temporaryRoot);

    const escapingRoots = renderF5Report(report, { outputRoot, f1ArtifactRoot, publishRoot: outputRoot });
    const summaryEscapingRoots = engineeringSummary(escapingRoots);
    expect(summaryEscapingRoots).toContain("F1 图片证据链接不可用");
    expect(summaryEscapingRoots).not.toContain("[F1 图片](");
    expect(summaryEscapingRoots).not.toContain(temporaryRoot);
  });

  it("does not publish relative image links without a common controlled publish root", () => {
    const f1RunRoot = mkdtempSync(path.join(tmpdir(), "f5-report-f1-run-"));
    const f5RunRoot = mkdtempSync(path.join(tmpdir(), "f5-report-f5-run-"));
    const f1ArtifactRoot = path.join(f1RunRoot, "f1");
    const outputRoot = path.join(f5RunRoot, "f5");
    const imagePath = path.join(f1ArtifactRoot, "artifacts", "analysis-a.png");
    mkdirSync(path.dirname(imagePath), { recursive: true });
    mkdirSync(outputRoot, { recursive: true });
    writeFileSync(imagePath, "controlled-image", "utf8");

    const report = completedReport({ observations: [observation({ confidence: "high" })] });
    const withoutPublishRoot = renderF5Report(report, { outputRoot, f1ArtifactRoot });
    const distantPublishRoot = renderF5Report(report, { outputRoot, f1ArtifactRoot, publishRoot: f5RunRoot });

    for (const markdown of [withoutPublishRoot, distantPublishRoot]) {
      expect(markdown).toContain("F1 图片证据链接不可用");
      expect(markdown).not.toContain("[F1 图片](");
      expect(markdown).not.toContain("../");
      expect(markdown).not.toContain(path.basename(f1RunRoot));
      expect(markdown).not.toContain(path.basename(f5RunRoot));
    }
  });

  it("renders unavailable evidence text without failing the numeric report when roots or targets are unavailable", () => {
    const temporaryRoot = mkdtempSync(path.join(tmpdir(), "f5-report-"));
    const f1ArtifactRoot = path.join(temporaryRoot, "f1");
    const outputRoot = path.join(temporaryRoot, "f5");
    mkdirSync(f1ArtifactRoot, { recursive: true });
    mkdirSync(outputRoot, { recursive: true });
    const report = completedReport({ observations: [observation({ confidence: "high" })] });

    const unavailableReports = [
      renderF5Report(report),
      renderF5Report(report, { outputRoot }),
      renderF5Report(report, { f1ArtifactRoot }),
      renderF5Report(report, { outputRoot, f1ArtifactRoot }),
    ];

    for (const markdown of unavailableReports) {
      expect(markdown).toContain("F1 图片证据链接不可用");
      expect(markdown).toContain("## 2. 能力与规格对比");
      expect(markdown).toContain("| FACT |");
      expect(markdown).not.toContain("[F1 图片](");
      expect(markdown).not.toContain(temporaryRoot);
    }
  });

  it("rejects a Windows junction that escapes the real F1 artifact root", ({ skip }) => {
    const temporaryRoot = mkdtempSync(path.join(tmpdir(), "f5-report-"));
    const f1ArtifactRoot = path.join(temporaryRoot, "f1");
    const outputRoot = path.join(temporaryRoot, "f5");
    const outsideRoot = mkdtempSync(path.join(tmpdir(), "f5-report-outside-"));
    const junctionPath = path.join(f1ArtifactRoot, "artifacts");
    mkdirSync(junctionPath, { recursive: true });
    mkdirSync(outputRoot, { recursive: true });
    writeFileSync(path.join(junctionPath, "analysis-a.png"), "controlled-image", "utf8");
    const report = completedReport({ observations: [observation({ confidence: "high" })] });
    const containedMarkdown = renderF5Report(report, { outputRoot, f1ArtifactRoot, publishRoot: temporaryRoot });
    expect(containedMarkdown).toContain("[F1 图片](../f1/artifacts/analysis-a.png)");

    rmSync(junctionPath, { recursive: true });
    writeFileSync(path.join(outsideRoot, "analysis-a.png"), "outside-image", "utf8");
    try {
      symlinkSync(outsideRoot, junctionPath, "junction");
    } catch (error) {
      if (process.platform === "win32" && error?.code === "EPERM") skip();
      throw error;
    }

    const markdown = renderF5Report(report, { outputRoot, f1ArtifactRoot, publishRoot: temporaryRoot });

    expect(markdown).toContain("F1 图片证据链接不可用");
    expect(markdown).not.toContain("[F1 图片](");
    expect(markdown).not.toContain(temporaryRoot);
    expect(markdown).not.toContain(outsideRoot);
  });

  it("escapes Markdown tables and renders only controlled rejection metadata", () => {
    const markdown = renderF5Report(withRejectedWorksheet(completedReport()));

    expect(markdown).toContain("factor\\|one");
    expect(markdown).toContain("DRAW\\|1");
    expect(markdown).toContain("Rejected\\|Sheet");
    expect(markdown).toContain("artifact_contract_invalid");
    expect(markdown).toContain("worksheet:Rejected\\|Sheet");
    expect(markdown).not.toMatch(/message|hiddenReasoning|password|workbookBytes|token/i);
  });

  it("neutralizes raw HTML and Markdown injection in worksheet, factor, clarification, and assumption text", () => {
    const report = withRejectedWorksheet(clone(completedReport({ factorName: "<img src=x onerror=alert(1)> [x](javascript:alert(1))" })));
    const worksheet = report.worksheets[0];
    worksheet.clarifications[0].questionForReviewer = "![x](javascript:alert(1))\n- injected-list & more";
    worksheet.clarifications[0].missingEvidence = ["<img src=x>", "[x](javascript:alert(1))"];
    worksheet.assumptions[0].statement = "<script>alert(1)</script>\n1. injected-list";
    worksheet.assumptions[0].source = "[source](javascript:alert(1)) & <unsafe>";
    report.worksheets[1].worksheetName = "<img src=x onerror=alert(1)> # injected-heading";
    report.worksheets[1].artifactReference = `worksheet:${report.worksheets[1].worksheetName}`;

    const markdown = renderF5Report(report);

    expect(markdown).toContain("&lt;script&gt;alert\\(1\\)&lt;/script&gt;");
    expect(markdown).toContain("&lt;img src=x onerror=alert\\(1\\)&gt;");
    expect(markdown).toContain("&amp; more");
    expect(markdown).not.toMatch(/<\/?(?:img|script)\b/i);
    expect(markdown).not.toMatch(/!?\[[^\]]*\]\(javascript:/i);
    expect(markdown).not.toMatch(/^#{1,6}\s+injected-heading$/m);
    expect(markdown).not.toMatch(/^(?:-|\d+\.)\s+injected-list$/m);
  });

  it("renders an all-rejected report without accepting path-like artifact references", () => {
    const report = withRejectedWorksheet(completedReport(), true);

    const markdown = renderF5Report(report);

    expect(markdown).toContain("根状态：`input_rejected`");
    expect(markdown).toContain("worksheet:Rejected\\|Sheet");
    const unsafe = clone(report);
    unsafe.worksheets[0].artifactReference = "C:\\private\\Rejected.xlsx";
    expect(() => renderF5Report(unsafe)).toThrow("Invalid F5 report.");
  });

  it("renders completed, partially_completed, input_rejected, and contract-valid tolerance status aggregation", () => {
    const completed = completedReport();
    expect(renderF5Report(completed)).toContain("根状态：`completed`");
    expect(renderF5Report(withRejectedWorksheet(completed))).toContain("根状态：`partially_completed`");
    expect(renderF5Report(withRejectedWorksheet(completed, true))).toContain("根状态：`input_rejected`");

    const statuses = ["not_evaluated", "needs_review", "insufficient_evidence", "not_applicable", "supported"];
    const severity = { supported: 0, not_applicable: 0, not_evaluated: 1, insufficient_evidence: 2, needs_review: 3 };

    for (const status of statuses) {
      const report = toleranceStatusReport(status);
      const toleranceSection = report.worksheets[0].sections.toleranceChainValidity;
      expect(toleranceSection.status).toBe(status);
      const aggregateStatus = toleranceSection.items.reduce((highest, item) => (
        severity[item.status] > severity[highest] ? item.status : highest
      ), toleranceSection.items[0].status);
      expect(aggregateStatus).toBe(status);
      const parsed = f5DataInterpretationResultSchema.safeParse(report);
      expect(parsed.success, parsed.success ? status : JSON.stringify(parsed.error.issues)).toBe(true);
      expect(() => renderF5Report(report), status).not.toThrow();
      const toleranceMarkdown = chapter(
        renderF5Report(report),
        "## 1. 公差链有效性",
        "## 2. 能力与规格对比",
      );
      expect(toleranceMarkdown).toContain(`章节状态：\`${status}\``);
      for (const item of toleranceSection.items) {
        expect(toleranceMarkdown).toContain(`| ${item.scope} | ${item.status} |`);
      }
    }
    const partialMarkdown = renderF5Report(withRejectedWorksheet(completed));
    expect(partialMarkdown).toContain("### Worksheet: Analysis-A");
    expect(partialMarkdown).toContain("### Worksheet: Rejected\\|Sheet");
    expect(partialMarkdown.match(/页状态：`input_rejected`/g)).toHaveLength(5);
  });

  it("labels SIGNAL text as needing ME review and renders clarification and assumption states without adoption language", () => {
    const report = clone(completedReport({ observations: [observation()] }));
    report.worksheets[0].assumptions[0] = {
      ...report.worksheets[0].assumptions[0],
      status: "confirmed",
      confirmedBy: "controlled-reviewer",
      confirmedAt: "2026-08-11T08:00:00.000Z",
    };
    report.worksheets[0].assumptions[1].status = "rejected";
    const markdown = renderF5Report(report);

    expect(markdown).toContain("- SIGNAL `f5-signal-structural-evidence-review-stack_start`：需要 ME 评审");
    expect(markdown).toContain("reviewStatus=unreviewed; 需要 ME 评审；观察证据，非确认事实");
    expect(markdown).toContain("观察证据，非确认事实");
    expect(markdown).toContain("reasonCode");
    expect(markdown).toContain("missingEvidence");
    expect(markdown).toContain("affectedConclusionIds");
    expect(markdown).toContain("blockingScope");
    expect(markdown).toContain("questionForReviewer");
    expect(markdown).toContain("proposed（仅提议，未采用）");
    expect(markdown).toContain("status: confirmed");
    expect(markdown).toContain("status: rejected");
    expect(markdown).not.toContain("已采用");
  });

  it("renders a legal identifier governance gap SIGNAL with exact ME review text and governance traceability", () => {
    const markdown = chapter(
      renderF5Report(completedReport({ governanceGap: true })),
      "## 3. 主要贡献因子",
      "## 4. 合理公差范围",
    );

    expect(markdown.split("\n")).toContain("- SIGNAL `f5-signal-identifier-governance-gap-1`：需要 ME 评审");
    expect(markdown).toContain("- triggerFactReferences: f5-fact-f3-governance-1");
    expect(markdown).toContain("governance FACT=f5-fact-f3-governance-1; SIGNAL=f5-signal-identifier-governance-gap-1");
  });

  it("keeps both F6 chapters delegated and options unranked without quantitative or recommendation claims", () => {
    const markdown = renderF5Report(completedReport());
    const delegatedChapters = chapter(markdown, "## 4. 合理公差范围");

    expect(delegatedChapters.match(/delegated_to_f6/g)?.length).toBeGreaterThanOrEqual(2);
    expect(delegatedChapters).toContain("OPTION");
    expect(delegatedChapters).toContain("未排序");
    expect(delegatedChapters).not.toMatch(/量化收益|量化成本|排名|推荐|\brecommended\b|\bpreferred\b/i);
  });

  it("throws a generic controlled error for invalid schema input without echoing values", () => {
    const marker = "sensitive-invalid-marker";
    let thrown;
    try {
      renderF5Report({ featureId: "F5", marker });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).toBe("Invalid F5 report.");
    expect(JSON.stringify(thrown)).not.toContain(marker);
  });

  it("is deterministic and never emits absolute roots, bytes, hidden reasoning, or credential fields", () => {
    const report = completedReport();
    const first = renderF5Report(report);
    const second = renderF5Report(clone(report));

    expect(second).toBe(first);
    expect(first).not.toMatch(/[A-Za-z]:[\\/]/);
    expect(first).not.toMatch(/workbookBytes|hiddenReasoning|chainOfThought|credential|password|token-value/i);
  });
});
