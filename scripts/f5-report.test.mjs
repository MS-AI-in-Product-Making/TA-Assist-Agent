import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCalculation } from "../packages/workbook-catalog/src/calculation.ts";
import { createF5DataInterpretation } from "../packages/workbook-catalog/src/f5-data-interpretation.ts";
import { renderF5Report } from "./f5-report.mjs";

const CONTENT_HASH = "a".repeat(64);
const IMAGE_HASH = "b".repeat(64);

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

function completedReport({ observations = [], factorName, governanceGap = false } = {}) {
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
    dimensionDescription: `dimension-${index + 1}`,
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
    source: { ...factor.source, sourceCells: {} },
  }));
  return createF5DataInterpretation({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: CONTENT_HASH },
    knowledgeBaseVersion: "interpretation-rules-v1",
    worksheets: [{
      worksheetName: "Analysis-A",
      imageReference,
      governanceRows,
      calculationResult,
      imageObservations: observations,
    }],
  });
}

function withRejectedWorksheet(report, onlyRejected = false) {
  const rejected = {
    worksheetName: "Rejected|Sheet",
    status: "input_rejected",
    issues: [{
      reasonCode: "artifact|invalid",
      message: "C:\\controlled\\secret.xlsx\nAuthorization: Bearer token-value hiddenReasoning=private password=secret workbookBytes=raw-data",
    }],
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
  const start = markdown.indexOf(heading);
  const end = nextHeading === undefined ? markdown.length : markdown.indexOf(nextHeading, start);
  return markdown.slice(start, end);
}

describe("renderF5Report", () => {
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
    expect(contributorChapter).toContain("factorReference");
    expect(contributorChapter).toContain("governance FACT=f5-fact-f3-governance-1");
    expect(contributorChapter).toContain("Worksheet=Analysis-A; Table=table-a; Row=2");
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

  it("escapes Markdown tables and redacts Windows paths and credentials", () => {
    const markdown = renderF5Report(withRejectedWorksheet(completedReport()));

    expect(markdown).toContain("factor\\|one");
    expect(markdown).toContain("DRAW\\|1");
    expect(markdown).toContain("Rejected\\|Sheet");
    expect(markdown).toContain("artifact\\|invalid");
    expect(markdown).toContain("[redacted-local-path]");
    expect(markdown).toContain("Authorization: [redacted]");
    expect(markdown).not.toContain("secret.xlsx");
    expect(markdown).not.toContain("token-value");
    expect(markdown).not.toMatch(/hiddenReasoning|password|workbookBytes|private|raw-data/i);
  });

  it("neutralizes raw HTML and Markdown injection in worksheet, factor, clarification, and assumption text", () => {
    const report = withRejectedWorksheet(clone(completedReport({ factorName: "<img src=x onerror=alert(1)> [x](javascript:alert(1))" })));
    const worksheet = report.worksheets[0];
    worksheet.clarifications[0].questionForReviewer = "![x](javascript:alert(1))\n- injected-list & more";
    worksheet.clarifications[0].missingEvidence = ["<img src=x>", "[x](javascript:alert(1))"];
    worksheet.assumptions[0].statement = "<script>alert(1)</script>\n1. injected-list";
    worksheet.assumptions[0].source = "[source](javascript:alert(1)) & <unsafe>";
    report.worksheets[1].worksheetName = "<script>alert(1)</script>\n# injected-heading";

    const markdown = renderF5Report(report);

    expect(markdown).toContain("&lt;script&gt;alert\\(1\\)&lt;/script&gt;");
    expect(markdown).toContain("&lt;img src=x onerror=alert\\(1\\)&gt;");
    expect(markdown).toContain("&amp; more");
    expect(markdown).not.toMatch(/<\/?(?:img|script)\b/i);
    expect(markdown).not.toMatch(/!?\[[^\]]*\]\(javascript:/i);
    expect(markdown).not.toMatch(/^#{1,6}\s+injected-heading$/m);
    expect(markdown).not.toMatch(/^(?:-|\d+\.)\s+injected-list$/m);
  });

  it("redacts spaced Windows, UNC, POSIX paths and multi-word sensitive values up to safe delimiters", () => {
    const report = withRejectedWorksheet(completedReport(), true);
    report.worksheets[0].issues[0].message = [
      "windows=C:\\Users\\Jane Doe\\secret.xlsx; safeField=visible",
      "unc=\\\\server\\Team Share\\secret file.xlsx; safeField2=visible-two",
      "posix=/home/jane/secret.xlsx; safeField3=visible-three",
      "token=multi word secret; safeField4=visible-four",
      "Authorization: Bearer multi word credential; safeField5=visible-five",
    ].join("\n");

    const markdown = renderF5Report(report);

    expect(markdown.match(/\[redacted-local-path\]/g)).toHaveLength(3 * 5);
    expect(markdown.match(/\[redacted(?:-sensitive-field)?\]/g)?.length).toBeGreaterThanOrEqual(2 * 5);
    expect(markdown).toContain("safeField=visible");
    expect(markdown).toContain("safeField5=visible-five");
    expect(markdown).not.toMatch(/Jane Doe|Team Share|secret\.xlsx|secret file\.xlsx|multi word secret|multi word credential/);
  });

  it("renders completed, partially_completed, input_rejected, and all tolerance page statuses independently", () => {
    const completed = completedReport();
    expect(renderF5Report(completed)).toContain("根状态：`completed`");
    expect(renderF5Report(withRejectedWorksheet(completed))).toContain("根状态：`partially_completed`");
    expect(renderF5Report(withRejectedWorksheet(completed, true))).toContain("根状态：`input_rejected`");

    const statusReports = [
      completed,
      completedReport({ observations: [observation()] }),
      completedReport({ observations: [observation({ confidence: "low" })] }),
      clone(completed),
      clone(completedReport({ observations: [observation({ confidence: "high" })] })),
    ];
    statusReports[3].worksheets[0].sections.toleranceChainValidity.status = "not_applicable";
    statusReports[4].worksheets[0].sections.toleranceChainValidity.status = "supported";
    const statuses = ["not_evaluated", "needs_review", "insufficient_evidence", "not_applicable", "supported"];

    statuses.forEach((status, index) => {
      expect(renderF5Report(statusReports[index])).toContain(`章节状态：\`${status}\``);
    });
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

    expect(markdown).toContain("- SIGNAL `f5-signal-structural-evidence-review`：需要 ME 评审");
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
    const markdown = renderF5Report(completedReport({ governanceGap: true }));

    expect(markdown.split("\n")).toContain("- SIGNAL `f5-signal-identifier-governance-gap-1`：需要 ME 评审");
    expect(markdown).toContain("- triggerFactReferences: f5-fact-f3-governance-1");
    expect(markdown).toContain("governance FACT=f5-fact-f3-governance-1; SIGNAL=f5-signal-identifier-governance-gap-1");
  });

  it("keeps both F6 chapters delegated and options unranked without quantitative or recommendation claims", () => {
    const markdown = renderF5Report(completedReport());

    expect(markdown.match(/delegated_to_f6/g)?.length).toBeGreaterThanOrEqual(2);
    expect(markdown).toContain("OPTION");
    expect(markdown).toContain("未排序");
    expect(markdown).not.toMatch(/量化收益|量化成本|排名|推荐|\brecommended\b|\bpreferred\b/i);
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
