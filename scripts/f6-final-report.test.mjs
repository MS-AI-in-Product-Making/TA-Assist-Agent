/* global structuredClone */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  drawingGovernanceResultV2Schema,
  f2UserReportSchema,
  f4WorkflowCalculationResultSchema,
  f5DataInterpretationResultSchema,
  f6OptimizationResultSchema,
} from "../packages/contracts/dist/contracts.js";
import { formatEngineering, formatPercent } from "./engineering-format.mjs";
import { createF5DataInterpretation } from "../packages/workbook-catalog/dist/f5-data-interpretation.js";
import { createF6ReportProjection } from "../packages/workbook-catalog/dist/index.js";
import { createF6ArtifactBundleFixture, createF6V2ObservationArtifact, F6_FIXTURE_WORKBOOK_HASH } from "./f6-artifact-test-fixture.mjs";
import { createF6FinalReportProjection, worstDisposition } from "./f6-final-report.mjs";
import { runF6FullValidation } from "./run-f6-full-validation.mjs";

const deprecatedF6ReportArtifactName = ["Feature6", "Composed", "Report"].join("-");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function row(values) {
  return `| ${values.join(" | ")} |`;
}

function numberText(value, fallback = "N/A") {
  if (!Number.isFinite(value)) return fallback;
  return Number(value.toFixed(6)).toString();
}

function engineeringText(value, unit, fallback = "N/A") {
  if (!Number.isFinite(value)) return fallback;
  return formatEngineering(value, unit, 6).replace(/\.0+(?=\s)/, "");
}

function percentText(value, fallback = "N/A") {
  if (!Number.isFinite(value)) return fallback;
  return formatPercent((Math.abs(value) <= 1 ? value * 100 : value), 1);
}

function buildSupportedF5Report(bundle) {
  const f3Report = drawingGovernanceResultV2Schema.parse(readJson(bundle.paths.f3));
  const f4Report = f4WorkflowCalculationResultSchema.parse(readJson(bundle.paths.f4));

  const confirmedBy = "controlled-reviewer";
  const confirmedAt = "2026-08-20T00:00:00.000Z";
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

  return f5DataInterpretationResultSchema.parse(createF5DataInterpretation({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: F6_FIXTURE_WORKBOOK_HASH },
    knowledgeBaseVersion: "interpretation-rules-v1",
    worksheets: f3Report.worksheets.map((worksheet) => {
      const calculationResult = f4Report.calculations.find((calculation) => calculation.worksheetSelection.worksheetName === worksheet.worksheetName);
      if (calculationResult === undefined) throw new Error("expected fixture F4 calculation");

      return {
        worksheetName: worksheet.worksheetName,
        imageReference: worksheet.rows[0].imageReference,
        governanceRows: worksheet.rows,
        calculationResult,
        imageObservations: scopes.map((scope) => ({
          scope,
          observedValue: "visible",
          confidence: "high",
          visibleBasis: `Visible basis for ${scope}.`,
          reviewStatus: "confirmed",
          confirmedBy,
          confirmedAt,
        })),
      };
    }),
  }));
}

function buildOpenF5Report(bundle) {
  const artifact = createF6V2ObservationArtifact(bundle);
  return f5DataInterpretationResultSchema.parse(createF5DataInterpretation({
    contractVersion: "v1",
    inputClassification: "confidential",
    workbook: { fileName: "Anonymous.xlsx", contentHash: F6_FIXTURE_WORKBOOK_HASH },
    knowledgeBaseVersion: "interpretation-rules-v1",
    worksheets: artifact.worksheets.map((worksheet, index) => ({
      worksheetName: worksheet.worksheetName,
      imageReference: worksheet.imageReference,
      governanceRows: bundle.f3Worksheets[index].rows,
      calculationResult: bundle.calculations[index],
      observationVersion: artifact.observationVersion,
      contextSnapshot: worksheet.contextSnapshot,
      imageObservations: worksheet.observations,
    })),
  }));
}

function loadRealF6Inputs({ worksheetNames = ["Analysis-A"], blockedWorksheetNames = [], f5Variant = "default", actualFieldOverrides = {}, systemSpecificationOverrides = {} } = {}) {
  const bundle = createF6ArtifactBundleFixture({ worksheetNames, blockedWorksheetNames, actualFieldOverrides, systemSpecificationOverrides });
  const runId = `2026-08-20T00-00-00-000Z-${worksheetNames.join("-")}`;
  const runRoot = path.join(bundle.publishRoot, "f6-runs", runId);

  const result = runF6FullValidation({}, {
    parseArgs: () => ({ ...bundle }),
    resolveLayout: () => ({
      runId,
      runRoot,
      publishRoot: bundle.publishRoot,
      optimizationJsonName: "Feature6-Optimization.json",
      optimizationMdName: "Feature6-Optimization.md",
      finalReportMdName: "Feature6-Report.md",
      runSummaryJsonName: "Feature6-Run-Summary.json",
      manifestName: "manifest.json",
    }),
  });

  expect(result.status, JSON.stringify(result, null, 2)).toBe("completed");

  return {
    generatedAt: "2026-08-20T00:00:00.000Z",
    f2Report: f2UserReportSchema.parse(readJson(bundle.paths.f2)),
    f3Report: drawingGovernanceResultV2Schema.parse(readJson(bundle.paths.f3)),
    f4Report: f4WorkflowCalculationResultSchema.parse(readJson(bundle.paths.f4)),
    f5Report: f5Variant === "supported"
      ? buildSupportedF5Report(bundle)
      : f5Variant === "open"
        ? buildOpenF5Report(bundle)
      : f5DataInterpretationResultSchema.parse(readJson(bundle.paths.f5)),
    f6Optimization: f6OptimizationResultSchema.parse(readJson(path.join(runRoot, "Feature6-Optimization.json"))),
  };
}

function cloneF3WorksheetWithName(worksheetName, sourceWorksheet) {
  const worksheet = structuredClone(sourceWorksheet);
  worksheet.worksheetName = worksheetName;
  worksheet.rows.forEach((row) => {
    row.imageReference.worksheetName = worksheetName;
  });
  return worksheet;
}

function cloneF4CalculationWithName(worksheetName, sourceCalculation, runReference) {
  const calculation = structuredClone(sourceCalculation);
  calculation.worksheetSelection.worksheetName = worksheetName;
  calculation.runReference = runReference;
  return calculation;
}

function cloneF6OptimizationWorksheetWithName(worksheetName, sourceWorksheet) {
  const worksheet = structuredClone(sourceWorksheet);
  worksheet.worksheetName = worksheetName;
  worksheet.baselineIdentity.worksheetName = worksheetName;
  return worksheet;
}

function recountF3Summary(worksheets) {
  return {
    worksheetCount: worksheets.length,
    factorCount: worksheets.length,
    completeCount: worksheets.length,
    governanceRequiredCount: 0,
    duplicateConflictCount: 0,
  };
}

function recountF6Summary(worksheets) {
  const options = worksheets.flatMap((worksheet) => worksheet.options);
  return {
    worksheetCount: worksheets.length,
    completedWorksheetCount: worksheets.filter((worksheet) => worksheet.runStatus === "COMPLETED").length,
    partiallyCompletedWorksheetCount: worksheets.filter((worksheet) => worksheet.runStatus === "PARTIALLY_COMPLETED").length,
    inputRejectedWorksheetCount: worksheets.filter((worksheet) => worksheet.runStatus === "INPUT_REJECTED").length,
    candidateOptionCount: options.filter((option) => option.status === "candidate").length,
    completedOptionCount: options.filter((option) => option.status === "completed").length,
    insufficientEvidenceOptionCount: options.filter((option) => option.status === "insufficient_evidence").length,
    calculationFailedOptionCount: options.filter((option) => option.status === "calculation_failed").length,
  };
}

describe("createF6FinalReportProjection policy", () => {
  it("keeps blocked F2 worksheets in the report summary and fails the workbook", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      blockedWorksheetNames: ["Blocked-A"],
      f5Variant: "supported",
    });
    const projection = createF6FinalReportProjection(inputs);

    expect(projection.reportSummary.worksheetDispositions.map(({ worksheetName }) => worksheetName)).toEqual([
      "Analysis-A",
      "Blocked-A",
    ]);
    expect(projection.reportSummary.worksheetDispositions.map(({ disposition }) => disposition)).toEqual([
      "PASS",
      "FAIL",
    ]);
    expect(projection.reportSummary.workbookDisposition).toBe("FAIL");
    expect(projection.markdown).toContain("| Analysis-A | Loop Analysis-A | No blocking issue in governed evidence | PASS |");
    expect(projection.markdown).toContain("| Blocked-A | Loop Blocked-A | 输入或计算链被阻断 | FAIL |");
  });

  it("maps explicit open F5 evidence to conditional pass", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      f5Variant: "open",
    });
    const projection = createF6FinalReportProjection(inputs);

    expect(projection.reportSummary.workbookDisposition).toBe("CONDITIONAL_PASS");
    expect(projection.reportSummary.worksheetDispositions).toEqual([
      expect.objectContaining({ worksheetName: "Analysis-A", disposition: "CONDITIONAL_PASS" }),
    ]);
    expect(projection.markdown).toContain("| Analysis-A | Loop Analysis-A | 治理或工程复核尚未关闭 | CONDITIONAL_PASS |");
  });

  it("keeps supported structural SIGNALs on pass", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A", "Analysis-B"],
      f5Variant: "supported",
    });
    const projection = createF6FinalReportProjection(inputs);

    expect(projection.reportSummary.workbookDisposition).toBe("PASS");
    expect(projection.reportSummary.worksheetDispositions.map(({ disposition }) => disposition)).toEqual([
      "PASS",
      "PASS",
    ]);
    expect(projection.markdown).toContain("| Analysis-A | Loop Analysis-A | No blocking issue in governed evidence | PASS |");
    expect(projection.markdown).toContain("| Analysis-B | Loop Analysis-B | No blocking issue in governed evidence | PASS |");
  });

  it("fails closed when F5 completed worksheets drift from readyNames", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const mismatchedInputs = loadRealF6Inputs({ worksheetNames: ["Analysis-X"], f5Variant: "supported" });

    expect(() => createF6FinalReportProjection({
      ...inputs,
      f5Report: mismatchedInputs.f5Report,
    })).toThrow(/Invalid F6 final report input: f5Report\./);
  });

  it("fails closed when F3 contains an extra worksheet outside readyNames", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const worksheets = [
      ...structuredClone(inputs.f3Report.worksheets),
      cloneF3WorksheetWithName("Analysis-Extra", inputs.f3Report.worksheets[0]),
    ];
    const projectionInput = {
      ...inputs,
      f3Report: {
        ...structuredClone(inputs.f3Report),
        worksheets,
        summary: recountF3Summary(worksheets),
      },
    };

    expect(() => createF6FinalReportProjection(projectionInput)).toThrow(/Invalid F6 final report input: f3Report\./);
  });

  it("fails closed when F6 Optimization contains an extra worksheet outside readyNames", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const worksheets = [
      ...structuredClone(inputs.f6Optimization.worksheets),
      cloneF6OptimizationWorksheetWithName("Analysis-Extra", inputs.f6Optimization.worksheets[0]),
    ];
    const projectionInput = {
      ...inputs,
      f6Optimization: {
        ...structuredClone(inputs.f6Optimization),
        worksheets,
        summary: recountF6Summary(worksheets),
      },
    };

    expect(() => createF6FinalReportProjection(projectionInput)).toThrow(/Invalid F6 final report input: f6Optimization\./);
  });

  it("accepts extra F4 calculations when every ready worksheet still has exactly one match", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const calculations = [
      ...structuredClone(inputs.f4Report.calculations),
      cloneF4CalculationWithName("Analysis-Extra", inputs.f4Report.calculations[0], "f4-run-1-2"),
    ];
    const projectionInput = {
      ...inputs,
      f4Report: {
        ...structuredClone(inputs.f4Report),
        calculations,
        summary: {
          selectedWorksheetCount: calculations.length,
          completedWorksheetCount: calculations.length,
        },
      },
    };

    const projection = createF6FinalReportProjection(projectionInput);

    expect(projection.reportSummary.workbookDisposition).toBe("PASS");
    expect(projection.reportSummary.worksheetDispositions).toEqual([
      expect.objectContaining({ worksheetName: "Analysis-A", disposition: "PASS" }),
    ]);
  });

  it("rejects duplicate selected F4 calculations as invalid input before rendering", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const duplicate = structuredClone(inputs.f4Report.calculations[0]);
    duplicate.runReference = "f4-run-1-2";
    const calculations = [...structuredClone(inputs.f4Report.calculations), duplicate];

    expect(() => createF6FinalReportProjection({
      ...inputs,
      f4Report: {
        ...structuredClone(inputs.f4Report),
        calculations,
        summary: {
          selectedWorksheetCount: calculations.length,
          completedWorksheetCount: calculations.length,
        },
      },
    })).toThrow(/Invalid F6 final report input: f4Report\./);
  });

  it("requires F6 Optimization provenance reportScope to match F2 worksheet order and blocked names", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      blockedWorksheetNames: ["Blocked-A"],
      f5Variant: "supported",
    });
    const f6Optimization = structuredClone(inputs.f6Optimization);
    f6Optimization.provenance.reportScope = {
      worksheetNames: ["Blocked-A", "Analysis-A"],
      blockedWorksheetNames: ["Blocked-A"],
    };

    expect(() => createF6FinalReportProjection({
      ...inputs,
      f6Optimization,
    })).toThrow(/Invalid F6 final report input: report scope\./);
  });

  it("rejects an empty selected scope as invalid input", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });

    expect(() => createF6FinalReportProjection({
      ...inputs,
      f6Optimization: {
        ...structuredClone(inputs.f6Optimization),
        worksheets: [],
      },
    })).toThrow();
  });

  it("fails closed when root workbook hash drifts before rendering", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const f3Report = structuredClone(inputs.f3Report);
    f3Report.workbook.contentHash = "c".repeat(64);

    expect(() => createF6FinalReportProjection({
      ...inputs,
      f3Report,
    })).toThrow(/Invalid F6 final report input/);
  });

  it("fails closed when F3 table source identity drifts before rendering", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const f3Report = structuredClone(inputs.f3Report);
    f3Report.worksheets[0].rows[0].source.tableId = "drifted-table";

    expect(() => createF6FinalReportProjection({
      ...inputs,
      f3Report,
    })).toThrow(/Invalid F6 final report input/);
  });

  it("fails closed when F6 baseline metrics drift from the calculation before rendering", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const f4Report = structuredClone(inputs.f4Report);
    f4Report.calculations[0].system.mean += 0.01;

    expect(() => createF6FinalReportProjection({
      ...inputs,
      f4Report,
    })).toThrow(/Invalid F6 final report input/);
  });
});

describe("createF6FinalReportProjection final report template", () => {
  it("renders the approved section structure without legacy-report artifacts or duplicate detailed metrics", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const { markdown } = createF6FinalReportProjection(inputs);

    expect(markdown).toContain("# 1. 文档控制 Document Control");
    expect(markdown).toContain("# 2. Workbook 决策总览");
    expect(markdown).toContain("# 3. Worksheet：Analysis-A");
    expect(markdown).toContain("## 3.1 执行摘要");
    expect(markdown).toContain("## 3.2 分析目标与要求");
    expect(markdown).toContain("## 3.4 尺寸链堆叠图");
    expect(markdown).toContain("## 3.5 输入数据");
    expect(markdown).toContain("## 3.6 模型假设与计算方法");
    expect(markdown).toContain("## 3.7 结果与规格符合性");
    expect(markdown).toContain("## 3.8 贡献与敏感度");
    expect(markdown).toContain("# 4. Appendix: Reference Traceability");
    expect(markdown).not.toContain("3.9");
    expect(markdown).not.toContain(deprecatedF6ReportArtifactName);
    expect(markdown.match(/Predictive Cpk \|/g)).toHaveLength(1);
    expect(markdown.match(/RSS 1σ/g)).toHaveLength(1);
  });

  it("renders all factor rows in the worksheet body and keeps blocked worksheets evidence-only", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      blockedWorksheetNames: ["Blocked-A"],
      f5Variant: "supported",
    });
    const { markdown } = createF6FinalReportProjection(inputs);
    const readyCalculation = inputs.f4Report.calculations[0];
    const blockedMarkdown = markdown.split("# 3. Worksheet：Blocked-A")[1] ?? "";

    expect(markdown.match(/^\| \d+ \| Factor /gm) ?? []).toHaveLength(readyCalculation.factorCount);
    expect(markdown).toContain("| Blocked-A |");
    expect(blockedMarkdown).toContain("输入或计算链被阻断");
    expect(blockedMarkdown).not.toContain("## 3.7 结果与规格符合性");
  });

  it("uses approved explicit missing states when optional context, image, and reviewer are absent", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"] });

    const { markdown } = createF6FinalReportProjection(inputs);

    expect(markdown).toContain("NOT_PROVIDED");
    expect(markdown).toContain("NOT_EVALUATED");
    expect(markdown).toContain("PENDING");
    expect(markdown).toContain("不等于已确认的物理根因");
  });

  it("sanitizes unsafe evidence text before rendering markdown", () => {
    const inputs = loadRealF6Inputs({ worksheetNames: ["Analysis-A"], f5Variant: "supported" });
    const imageFact = inputs.f5Report.worksheets[0].statements.find((statement) => (
      statement.type === "FACT" && statement.content.provenanceKind === "image_observation"
    ));
    expect(imageFact).toBeDefined();
    imageFact.content.visibleBasis = "Observed from C:\\private\\fixture<script>.xlsx";

    const { markdown } = createF6FinalReportProjection(inputs);

    expect(markdown).toContain("[redacted-local-path]");
    expect(markdown).not.toContain("<script>");
    expect(markdown).not.toContain("C:\\private\\");
  });

  it("uses governed F6 projection ranges and margins but renders range results as N/A", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      f5Variant: "supported",
      actualFieldOverrides: { nominalValue: 0.12, mean: 0.12 },
    });
    const calculation = inputs.f4Report.calculations[0];
    const projection = createF6ReportProjection({ calculation, inputResolution: 1e-12 });

    const { markdown } = createF6FinalReportProjection(inputs);

    expect(calculation.system.mean).not.toBe(0);
    expect(projection.margins.worstCase.lowerBound).toBeCloseTo(calculation.system.mean + calculation.system.worstCaseLower);
    expect(projection.margins.worstCase.upperBound).toBeCloseTo(calculation.system.mean + calculation.system.worstCaseUpper);
    expect(markdown).toContain(row([
      "Worst-Case Range",
      engineeringText(projection.margins.worstCase.lowerBound, "mm"),
      engineeringText(projection.margins.worstCase.upperBound, "mm"),
      engineeringText(projection.margins.worstCase.minimumMargin, "mm"),
      "N/A",
      "F6 governed projection",
    ]));
    expect(markdown).toContain(row([
      "4σ Statistical Range",
      engineeringText(projection.margins.statistical.lowerBound, "mm"),
      engineeringText(projection.margins.statistical.upperBound, "mm"),
      engineeringText(projection.margins.statistical.minimumMargin, "mm"),
      "N/A",
      "F6 governed projection",
    ]));
  });

  it("displays F4 capability statuses unchanged at equality boundaries", () => {
    const inputs = loadRealF6Inputs({
      worksheetNames: ["Analysis-A"],
      f5Variant: "supported",
      systemSpecificationOverrides: {
        targetSigmaLevel: {
          status: "available", actualValue: 20, displayValue: "20",
          sourceLabel: "Target sigma", sourceCell: "Analysis-A!P56", valueOrigin: "numeric_literal",
        },
      },
    });
    const calculation = inputs.f4Report.calculations[0];
    const projection = createF6FinalReportProjection(inputs);

    const { markdown } = projection;

    expect(calculation.capability.cp).toBeCloseTo(calculation.capability.targetCpk);
    expect(calculation.capability.lowerCpk).toBeCloseTo(calculation.capability.targetCpk);
    expect(calculation.capability.upperCpk).toBeCloseTo(calculation.capability.targetCpk);
    expect([calculation.capability.cpStatus, calculation.capability.lowerCpkStatus, calculation.capability.upperCpkStatus, calculation.capability.status])
      .toEqual(expect.arrayContaining(["FAIL"]));
    expect(markdown).toContain(row(["Predictive Cp", numberText(calculation.capability.cp), calculation.capability.cpStatus, "F4 capability.cpStatus"]));
    expect(markdown).toContain(row(["Predictive CpkL", numberText(calculation.capability.lowerCpk), calculation.capability.lowerCpkStatus, "F4 capability.lowerCpkStatus"]));
    expect(markdown).toContain(row(["Predictive CpkU", numberText(calculation.capability.upperCpk), calculation.capability.upperCpkStatus, "F4 capability.upperCpkStatus"]));
    expect(markdown).toContain(row(["Predictive Cpk", numberText(calculation.capability.cpk), calculation.capability.status, "F4 capability.status"]));
    expect(markdown).toContain(row(["Predicted Yield", percentText(calculation.capability.yield), "N/A", "F4 calculation"]));
    expect(markdown).toContain(row(["Predicted DPM", numberText(calculation.capability.totalDpm), "N/A", "F4 calculation"]));
    expect(projection.reportSummary.worksheetDispositions).toEqual([
      expect.objectContaining({ worksheetName: "Analysis-A", disposition: "INCOMPLETE" }),
    ]);
    expect(projection.reportSummary.workbookDisposition).toBe("INCOMPLETE");
  });
});

describe("worstDisposition", () => {
  it("returns the worst ranked disposition", () => {
    expect(worstDisposition(["PASS", "INCOMPLETE", "FAIL"])).toBe("FAIL");
  });
});