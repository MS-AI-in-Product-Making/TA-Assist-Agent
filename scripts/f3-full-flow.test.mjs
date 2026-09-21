import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function f2Report() {
  const row = {
    worksheetName: "Analysis-A",
    tableId: "factor-table-1",
    sourceRow: 14,
    factorOrdinal: { value: "A", rawText: "A", sourceCell: "Analysis-A!D14" },
    actualFields: {
      factorName: "Anonymous offset",
      partName: "Anonymous bracket",
      drawingNumber: "DRAW-A",
      dimCharacteristicId: "1",
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
    sourceCells: { factorName: "Analysis-A!E14" },
    imageReference: {
      artifact: "f1",
      relativePath: "worksheets/Analysis-A/tolerance-path.png",
      contentHash: "b".repeat(64),
      worksheetName: "Analysis-A",
    },
    missingRequiredFields: [],
    missingIdentifiers: [],
    capabilityStatus: "non_f0_process_category",
    adoReminderRequested: false,
  };
  const systemSpecification = {
    status: "available",
    designNominal: { status: "available", actualValue: -0.05, displayValue: "-0.05", sourceLabel: "*Design Nominal ►", sourceCell: "Analysis-A!P53", valueOrigin: "numeric_literal" },
    lowerSpecLimit: { status: "available", actualValue: -0.15, displayValue: "-0.15", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Analysis-A!P54", valueOrigin: "numeric_literal" },
    upperSpecLimit: { status: "available", actualValue: 0.05, displayValue: "0.05", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Analysis-A!P55", valueOrigin: "numeric_literal" },
    targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3.0σ", sourceLabel: "*Target σ Level ►", sourceCell: "Analysis-A!P56", valueOrigin: "numeric_literal" },
    additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
  };
  return {
    contractVersion: "v1",
    inputClassification: "confidential",
    status: "completed",
    workbook: { fileName: "Anonymous.xlsx", contentHash: "a".repeat(64), f1GeneratedAt: "2026-08-03T00:00:00.000Z" },
    knowledgeBaseVersions: ["v1", "internal-v1"],
    mappingRuleVersion: "v1",
    artifactRoot: "controlled/f1",
    worksheets: [{
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "Anonymous device gap",
      status: "ready",
      tolerancePathImageStatus: "available",
      systemSpecification,
      systemSpecificationIssues: [],
      rows: [row],
      missingFieldSummary: [],
    }],
    f4Handoffs: [{
      contractVersion: "v1", handoffVersion: "f4-handoff-v1", inputClassification: "confidential", status: "ready",
      workbookContentHash: "a".repeat(64), worksheetName: "Analysis-A", toleranceLoopDescription: "Anonymous device gap",
      systemSpecification: {
        designNominal: -0.05, lowerSpecLimit: systemSpecification.lowerSpecLimit, upperSpecLimit: systemSpecification.upperSpecLimit,
        targetSigmaLevel: systemSpecification.targetSigmaLevel, targetCpk: 1, additionalMeanShift: systemSpecification.additionalMeanShift,
      },
      factors: [{ tableId: row.tableId, sourceRow: row.sourceRow, factorOrdinal: row.factorOrdinal, unit: "mm", actualFields: row.actualFields, sourceCells: row.sourceCells }],
    }],
    adoEvents: [],
    summary: {
      worksheetsChecked: 1,
      blockedWorksheetCount: 0,
      readyWorksheetCount: 1,
      factorRowCount: 1,
      rowsWithRequiredMissing: 0,
      requiredMissingFieldCount: 0,
      missingImageWorksheetCount: 0,
      internalWithinGuidanceCount: 0,
      internalGuidanceExceededCount: 0,
      f0InformationInsufficientCount: 0,
      publicLibraryMatchCount: 0,
      nonF0ProcessCategoryCount: 1,
      unableToCheckCount: 0,
      publicToleranceDifferenceCount: 0,
      publicDistributionDifferenceCount: 0,
      missingDimIdCount: 0,
      missingPartNumberCount: 0,
    },
  };
}

function createAnalysisWorkspaceRoot(root) {
  const analysisRoot = path.join(root, "20260921 - Anonymous");
  const stagePaths = {
    f1: path.join(analysisRoot, "01 - F1 Data Parsing"),
    f2: path.join(analysisRoot, "02 - F2 Data Cleaning"),
    f3: path.join(analysisRoot, "03 - F3 Drawing Governance"),
    f4: path.join(analysisRoot, "04 - F4 Calculation Engine"),
    f5: path.join(analysisRoot, "05 - F5 Result Interpretation"),
    f6: path.join(analysisRoot, "06 - F6 Design Optimization"),
  };
  for (const stagePath of Object.values(stagePaths)) mkdirSync(stagePath, { recursive: true });
  writeFileSync(path.join(analysisRoot, "analysis-run-summary.json"), JSON.stringify({
    contractVersion: "analysis-workspace-v1",
    analysisRoot,
    summaryPath: path.join(analysisRoot, "analysis-run-summary.json"),
    workbook: { fileName: "Anonymous.xlsx", contentHash: "a".repeat(64) },
    allocationDate: "20260921",
    currentStage: "f1",
    stageDirectories: {
      f1: "01 - F1 Data Parsing",
      f2: "02 - F2 Data Cleaning",
      f3: "03 - F3 Drawing Governance",
      f4: "04 - F4 Calculation Engine",
      f5: "05 - F5 Result Interpretation",
      f6: "06 - F6 Design Optimization",
    },
    stages: {
      f1: { status: "pending", artifacts: {} },
      f2: { status: "pending", artifacts: {} },
      f3: { status: "pending", artifacts: {} },
      f4: { status: "pending", artifacts: {} },
      f5: { status: "pending", artifacts: {} },
      f6: { status: "pending", artifacts: {} },
    },
    overallStatus: "in_progress",
  }, null, 2));
  return { analysisRoot, stagePaths };
}

describe("Feature 3 local artifact flow", () => {
  it("defaults the current workspace flow to the fixed F3 stage without a feature3-output child", () => {
    const root = mkdtempSync(path.join(tmpdir(), "f3-flow-workspace-"));
    roots.push(root);
    const { analysisRoot, stagePaths } = createAnalysisWorkspaceRoot(root);
    const f2Root = stagePaths.f2;
    const f3Root = stagePaths.f3;
    writeFileSync(path.join(f2Root, "Feature2-Report.json"), JSON.stringify(f2Report()));

    const stdout = execFileSync(process.execPath, ["scripts/run-f3-full-validation.mjs", f2Root, "--analysis-root", analysisRoot], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
    });
    const result = JSON.parse(stdout);

    expect(result.outputDirectory).toBe(f3Root);
    expect(result.reportJsonPath).toBe(path.join(f3Root, "Feature3-Report.json"));
    expect(existsSync(path.join(analysisRoot, "feature3-output"))).toBe(false);
    expect(readFileSync(result.reportMdPath, "utf8")).toContain("Dimension Description");
  });

  it("writes only report artifacts for input_rejected in a clean workspace stage", () => {
    const root = mkdtempSync(path.join(tmpdir(), "f3-flow-rejected-"));
    roots.push(root);
    const { analysisRoot, stagePaths } = createAnalysisWorkspaceRoot(root);
    const report = f2Report();
    delete report.worksheets[0].toleranceLoopDescription;
    writeFileSync(path.join(stagePaths.f2, "Feature2-Report.json"), JSON.stringify(report));

    const stdout = execFileSync(process.execPath, [
      "scripts/run-f3-full-validation.mjs",
      stagePaths.f2,
      "--analysis-root", analysisRoot,
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
    });
    const result = JSON.parse(stdout);

    expect(result.status).toBe("input_rejected");
    expect(result.reportJsonPath).toBe(path.join(stagePaths.f3, "Feature3-Report.json"));
    expect(result).not.toHaveProperty("reminderMdPath");
    expect(result).not.toHaveProperty("historyHtmlPath");
    expect(existsSync(path.join(stagePaths.f3, "Feature3-ADO-Reminder.md"))).toBe(false);
    expect(existsSync(path.join(stagePaths.f3, "Feature3-ADO-History.html"))).toBe(false);
  });

  it("rejects a dirty workspace stage before input_rejected can leave stale reminder or history artifacts", () => {
    const root = mkdtempSync(path.join(tmpdir(), "f3-flow-dirty-"));
    roots.push(root);
    const { analysisRoot, stagePaths } = createAnalysisWorkspaceRoot(root);
    const report = f2Report();
    delete report.worksheets[0].toleranceLoopDescription;
    writeFileSync(path.join(stagePaths.f2, "Feature2-Report.json"), JSON.stringify(report));
    const staleReportPath = path.join(stagePaths.f3, "Feature3-Report.json");
    const staleReminderPath = path.join(stagePaths.f3, "Feature3-ADO-Reminder.md");
    const staleHistoryPath = path.join(stagePaths.f3, "Feature3-ADO-History.html");
    writeFileSync(staleReportPath, "stale report\n");
    writeFileSync(staleReminderPath, "stale reminder\n");
    writeFileSync(staleHistoryPath, "stale history\n");

    const result = spawnSync(process.execPath, [
      "scripts/run-f3-full-validation.mjs",
      stagePaths.f2,
      "--analysis-root", analysisRoot,
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
    });
    expect(result.status).toBe(1);
    expect(result.stdout.trim()).toBe("");
    expect(readFileSync(staleReportPath, "utf8")).toBe("stale report\n");
    expect(readFileSync(staleReminderPath, "utf8")).toBe("stale reminder\n");
    expect(readFileSync(staleHistoryPath, "utf8")).toBe("stale history\n");
  });

  it("writes matching Feature 3 JSON and Markdown reports", () => {
    const root = mkdtempSync(path.join(tmpdir(), "f3-flow-"));
    roots.push(root);
    const f2Root = path.join(root, "f2");
    const outputRoot = path.join(root, "f3");
    mkdirSync(f2Root);
    writeFileSync(path.join(f2Root, "Feature2-Report.json"), JSON.stringify(f2Report()));

    const stdout = execFileSync(process.execPath, ["scripts/run-f3-full-validation.mjs", f2Root], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, AI_TVA_F3_OUTPUT_ROOT: outputRoot },
    });
    const result = JSON.parse(stdout);
    const json = JSON.parse(readFileSync(result.reportJsonPath, "utf8"));
    const markdown = readFileSync(result.reportMdPath, "utf8");
    const reminder = readFileSync(path.join(outputRoot, "Feature3-ADO-Reminder.md"), "utf8");
    const historyHtml = readFileSync(path.join(outputRoot, "Feature3-ADO-History.html"), "utf8");

    expect(result.status).toBe("governance_required");
    expect(json.modelVersion).toBe("drawing-governance-v2");
    expect(json.ado.status).toBe("not_requested");
    expect(markdown).toContain("Dimension Description");
    expect(markdown).toContain(json.worksheets[0].toleranceLoopDescription);
    expect(result.reminderMdPath).toBe(path.join(outputRoot, "Feature3-ADO-Reminder.md"));
    expect(result.historyHtmlPath).toBe(path.join(outputRoot, "Feature3-ADO-History.html"));
    expect(reminder).toContain("| Worksheet Source | Device Level Dim | Dimension Description |");
    expect(historyHtml).toContain("<table>");
    expect(historyHtml.match(/<th>/g)).toHaveLength(12);
    expect(historyHtml.match(/<tr data-f3-factor-row=true>/g)).toHaveLength(json.summary.factorCount);
    expect(historyHtml.match(/<tr data-f3-group-row=true>/g)).toHaveLength(1);
  });

  it("writes only the selected ready worksheet", () => {
    const root = mkdtempSync(path.join(tmpdir(), "f3-flow-selection-"));
    roots.push(root);
    const f2Root = path.join(root, "f2");
    const outputRoot = path.join(root, "f3");
    mkdirSync(f2Root);
    const report = f2Report();
    const secondWorksheet = structuredClone(report.worksheets[0]);
    secondWorksheet.worksheetName = "Analysis-B";
    secondWorksheet.toleranceLoopDescription = "Anonymous device gap B";
    secondWorksheet.rows[0].worksheetName = "Analysis-B";
    secondWorksheet.rows[0].actualFields.factorName = "Anonymous offset B";
    secondWorksheet.rows[0].sourceCells.factorName = "Analysis-B!E14";
    secondWorksheet.rows[0].imageReference = {
      ...secondWorksheet.rows[0].imageReference,
      relativePath: "worksheets/Analysis-B/tolerance-path.png",
      worksheetName: "Analysis-B",
    };
    const secondHandoff = structuredClone(report.f4Handoffs[0]);
    secondHandoff.worksheetName = "Analysis-B";
    secondHandoff.toleranceLoopDescription = "Anonymous device gap B";
    secondHandoff.factors[0].actualFields.factorName = "Anonymous offset B";
    secondHandoff.factors[0].sourceCells.factorName = "Analysis-B!E14";
    report.worksheets.push(secondWorksheet);
    report.f4Handoffs.push(secondHandoff);
    report.summary.worksheetsChecked = 2;
    report.summary.readyWorksheetCount = 2;
    report.summary.factorRowCount = 2;
    report.summary.nonF0ProcessCategoryCount = 2;
    writeFileSync(path.join(f2Root, "Feature2-Report.json"), JSON.stringify(report));

    const stdout = execFileSync(process.execPath, [
      "scripts/run-f3-full-validation.mjs",
      f2Root,
      "--worksheet", "Analysis-B",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, AI_TVA_F3_OUTPUT_ROOT: outputRoot },
    });
    const result = JSON.parse(stdout);
    const json = JSON.parse(readFileSync(result.reportJsonPath, "utf8"));
    const markdown = readFileSync(result.reportMdPath, "utf8");

    expect(json.worksheets.map(({ worksheetName }) => worksheetName)).toEqual(["Analysis-B"]);
    expect(json.summary.worksheetCount).toBe(1);
    expect(markdown).toContain("Analysis-B");
    expect(markdown).not.toContain("Analysis-A");
  });
});