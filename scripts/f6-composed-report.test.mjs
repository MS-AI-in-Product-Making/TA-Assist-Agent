import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { f6LegacyComposedEngineeringReportSchema as f6ComposedEngineeringReportSchema } from "../packages/contracts/dist/contracts.js";
import { renderComposedEngineeringReport as renderComposedEngineeringReportV2, renderLegacyComposedEngineeringReport as renderComposedEngineeringReport } from "./f6-composed-report.mjs";

const HASH = "a".repeat(64);
const REFERENCE = { artifact: "Feature5-Report.json", contentHash: HASH };
const SECTIONS = [
  "Executive Summary",
  "Requirement Review",
  "Input Validation",
  "Capability Assessment",
  "Contributor Analysis",
  "Root Cause Analysis",
  "Risk Assessment",
  "Recommendations",
  "What-If Analysis",
  "Final Conclusion",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function report() {
  return f6ComposedEngineeringReportSchema.parse({
    contractVersion: "v1",
    outputClassification: "confidential",
    reportVersion: "f6-composed-report-v1",
    workbook: { fileName: "Anonymous.xlsx", contentHash: HASH },
    overallStatus: "RISK",
    workbookExecutiveSummary: [
      "Overall Status: RISK.",
      "Worst worksheet: Ready|<b>[x](javascript:alert(1)); Cpk 1.1.",
      "Yield 0.99; OOS 0.01 (10000 ppm).",
      "Top contributor: Factor|One (65%).",
      "Highest Impact Action: Ready:reduce_top_contributor_20.",
    ],
    blockedWorksheets: [{
      worksheetName: "Blocked|<script>[bad](javascript:alert(2))",
      findings: [{
        findingCode: "f2_input_blocked",
        findingKind: "validation_abnormality",
        severity: "Critical",
        message: "Missing required image | <img src=x onerror=alert(1)>",
        affectsCapabilityData: false,
        evidenceReferences: [REFERENCE],
      }],
    }],
    worksheets: [{
      worksheetName: "Ready|<b>[x](javascript:alert(1))",
      status: "RISK",
      targetCapability: { targetCpk: 1.33, targetSigmaLevel: 4, source: "worksheet" },
      confirmedRequirementViolation: false,
      missingCapabilityData: false,
      evidenceReferences: [REFERENCE],
      sections: {
        executiveSummary: [
          "Status: RISK.",
          "Cpk 1.1 versus target 1.33.",
          "Yield 0.99; OOS 0.01.",
          "Top contributor: Factor|One (65%).",
          "Key risk: High Product.",
        ],
        requirementReview: {
          ctq: "CTQ|<i>",
          nominal: 0,
          lowerSpecLimit: -1,
          upperSpecLimit: 1,
          specWidth: 2,
          assessment: "Requirement understood.",
          riskLevel: "High",
          evidenceReferences: [REFERENCE],
        },
        inputValidation: [{
          findingCode: "unsupported_assumption",
          findingKind: "governance_gap",
          severity: "Major",
          message: "Assumption requires review.",
          affectsCapabilityData: false,
          evidenceReferences: [REFERENCE],
        }],
        capabilityAssessment: {
          metrics: { mean: 0, rssSigma: 0.2, cp: 1.2, cpk: 1.1, yield: 0.99, dpm: 10_000 },
          oosRate: 0.01,
          oosPpm: 10_000,
          findings: ["Cpk below target."],
          evidenceReferences: [REFERENCE],
        },
        contributorAnalysis: {
          topContributors: [
            { factorName: "Factor|One", contributionPercent: 65, tableId: "table-a", sourceRow: 2 },
            { factorName: "Factor Two", contributionPercent: 25, tableId: "table-a", sourceRow: 3 },
          ],
          top1Concentration: 65,
          top3Concentration: 90,
          concentrationAssessment: "concentrated",
          policyVersion: "f6-contributor-policy-v1",
          evidenceReferences: [REFERENCE],
        },
        rootCauseAnalysis: {
          factBasedFindings: ["FACT visual-1: visual datum_chain observation remains unreviewed."],
          ruleFindings: ["RULE rule-1: governed interpretation rule evidence."],
          optionFindings: ["OPTION option-1: F5 option evidence retained without recommendation promotion."],
          signals: ["SIGNAL context-1: datum context is unreviewed; engineering review required."],
          evidenceStatus: "supported",
          evidenceReferences: [REFERENCE],
        },
        riskAssessment: ["Product", "Manufacturing", "Assembly", "Supplier", "Customer Experience"].map((category, index) => ({
          category,
          rating: index === 0 ? "High" : "Low",
          status: index === 0 ? "open" : "closed",
          reason: index === 0 ? "Cpk below target | <u>risk</u>" : `Governed ${category} assessment found no elevated risk.`,
          evidenceReferences: [REFERENCE],
        })),
        recommendations: [
          { kind: "verified_option", recommendationId: "recommend-top", text: "Review controlled top contributor option.", expectedBenefit: "Improve Cpk.", optionId: "Ready:reduce_top_contributor_20", evidenceReferences: [REFERENCE] },
          { kind: "evidence_closure", recommendationId: "close-datum", clarificationId: "datum-review", text: "Evidence closure datum-review: confirm datum evidence.", expectedBenefit: "Close datum evidence gap.", evidenceReferences: [REFERENCE] },
        ],
        whatIfAnalysis: {
          options: [
            { optionKind: "reduce_top_contributor_20", status: "completed", summary: "delta Cpk 0.2", predictedImprovement: 0.2, evidenceReferences: [REFERENCE] },
            { optionKind: "reduce_top_3_contributors_30", status: "completed", summary: "delta Cpk 0.4", predictedImprovement: 0.4, evidenceReferences: [REFERENCE] },
            { optionKind: "improve_supplier_capability", status: "insufficient_evidence", summary: "insufficient_evidence", predictedImprovement: "insufficient_evidence", requiredInputs: ["confirmed_supplier_capability_evidence"], evidenceReferences: [REFERENCE] },
            { optionKind: "tighten_datum_strategy", status: "insufficient_evidence", summary: "insufficient_evidence", predictedImprovement: "insufficient_evidence", requiredInputs: ["confirmed_datum_chain_evidence", "engineering_review"], evidenceReferences: [REFERENCE] },
          ],
          highestImpactAction: "Highest Impact Action: Ready:reduce_top_contributor_20.",
          roiStatus: "not_computed",
          evidenceReferences: [REFERENCE],
        },
        finalConclusion: [
          "Current design status: RISK.",
          "Baseline Cpk 1.1; target Cpk 1.33.",
          "Largest gap is 0.23 Cpk.",
          "Highest Impact Action: Ready:reduce_top_contributor_20.",
          "Capability target source: worksheet.",
        ],
      },
    }],
  });
}

function section(markdown, heading, nextHeading) {
  const start = markdown.indexOf(heading);
  const end = nextHeading === undefined ? markdown.length : markdown.indexOf(nextHeading, start + heading.length);
  return markdown.slice(start, end);
}

describe("renderComposedEngineeringReport", () => {
  it("renders the workbook summary and exact ten worksheet sections in order", () => {
    const markdown = renderComposedEngineeringReport(report());
    const worksheet = markdown.slice(markdown.indexOf("## Worksheet:"));
    const indexes = SECTIONS.map((name) => worksheet.indexOf(`### ${name}`));

    expect(markdown).toContain("# F5 + F6 联合工程报告");
    expect(markdown).toContain("## Workbook Executive Summary");
    expect(indexes.every((index) => index >= 0)).toBe(true);
    expect(indexes).toEqual([...indexes].sort((left, right) => left - right));
    expect(markdown.endsWith("\n")).toBe(true);
  });

  it("locks table headers, four scenarios, and executive/final bullet limits", () => {
    const markdown = renderComposedEngineeringReport(report());
    for (const header of [
      "| Item | Value |",
      "| Metric | Result | Status |",
      "| Rank | Contributor | Contribution |",
      "| Risk Area | Rating | Reason |",
      "| Priority | Recommendation | Expected Benefit |",
      "| Scenario | Predicted Improvement |",
    ]) expect(markdown).toContain(header);

    const whatIf = section(markdown, "### What-If Analysis", "### Final Conclusion");
    expect(whatIf).toContain("Reduce Top Contributor 20%");
    expect(whatIf).toContain("Reduce Top 3 Contributors 30%");
    expect(whatIf).toContain("Improve Supplier Capability");
    expect(whatIf).toContain("Tighten Datum Strategy");
    expect(whatIf.match(/^\| (?:Reduce|Improve|Tighten)/gm)).toHaveLength(4);
    expect(section(markdown, "### Executive Summary", "### Requirement Review").match(/^- /gm)).toHaveLength(5);
    expect(section(markdown, "### Final Conclusion").match(/^- /gm)).toHaveLength(5);
  });

  it("keeps blocked names out of capability, contributor, and what-if numeric sections", () => {
    const markdown = renderComposedEngineeringReport(report());
    const blockedName = String.raw`Blocked\|&lt;script&gt;\[bad\]\(javascript:alert\(2\)\)`;
    const numericSections = [
      section(markdown, "### Capability Assessment", "### Contributor Analysis"),
      section(markdown, "### Contributor Analysis", "### Root Cause Analysis"),
      section(markdown, "### What-If Analysis", "### Final Conclusion"),
    ].join("\n");

    expect(markdown).toContain("## Workbook Input Validation");
    expect(markdown).toContain(blockedName);
    expect(numericSections).not.toContain("Blocked");
  });

  it("preserves evidence labels and avoids unsupported datum certainty or ROI claims", () => {
    const markdown = renderComposedEngineeringReport(report());

    expect(markdown).toContain("FACT visual-1");
    expect(markdown).toContain("RULE rule-1");
    expect(markdown).toContain("OPTION option-1");
    expect(markdown).toContain("SIGNAL context-1");
    expect(markdown).toContain("unreviewed");
    expect(markdown).toContain("engineering review required");
    expect(markdown).not.toMatch(/datum (?:is )?(?:confirmed|certain)/i);
    expect(markdown).toContain(String.raw`ROI: not\_computed`);
    expect(markdown).toContain("Highest Impact Action");
    expect(markdown).not.toContain("Highest ROI");
  });

  it("renders sanitized recommendation IDs and exact option or clarification references", () => {
    const input = report();
    input.worksheets[0].sections.recommendations[0].recommendationId = String.raw`recommend|<b>C:\private\id`;
    input.worksheets[0].sections.recommendations[0].optionId = String.raw`option|<i>C:\private\option`;
    input.worksheets[0].sections.recommendations[1].recommendationId = String.raw`closure|<u>C:\private\id`;
    input.worksheets[0].sections.recommendations[1].clarificationId = String.raw`clarify|<em>C:\private\action`;

    const markdown = renderComposedEngineeringReport(input);
    const recommendations = section(markdown, "### Recommendations", "### What-If Analysis");

    expect(recommendations).toContain(String.raw`\[recommend\|&lt;b&gt;[redacted-local-path]\] \[option:option\|&lt;i&gt;[redacted-local-path]\]`);
    expect(recommendations).toContain(String.raw`\[closure\|&lt;u&gt;[redacted-local-path]\] \[clarification:clarify\|&lt;em&gt;[redacted-local-path]\]`);
    expect(recommendations).not.toMatch(/<b>|<i>|<u>|<em>|C:\\private/i);
  });

  it("escapes Markdown, HTML, tables, and links without traces or absolute paths", () => {
    const markdown = renderComposedEngineeringReport(report(), { outputRoot: "C:\\private\\report" });

    expect(markdown).toContain(String.raw`Ready\|&lt;b&gt;\[x\]\(javascript:alert\(1\)\)`);
    expect(markdown).toContain(String.raw`Factor\|One`);
    expect(markdown).toContain(String.raw`Cpk below target \| &lt;u&gt;risk&lt;/u&gt;`);
    expect(markdown).not.toMatch(/<script|<img|<u>|[A-Za-z]:[\\/]/i);
    expect(markdown).not.toMatch(/sourceCells|traceRecords|excelFormula|calculationTrace/i);
  });

  it("redacts absolute paths from rendered risk, recommendation, and root-cause text", () => {
    const input = report();
    const injected = String.raw`C:\private\risk.txt after-win; \\server\share\evidence.csv after-unc; /home/user/input after-posix; [/opt/review] after-bracket; [drawing](/var/drawings/a.pdf) after-markdown; "C:\Program Files\secret.txt" after-quoted; <b>html</b> | table SAFE_TRAILER`;
    input.worksheets[0].sections.riskAssessment[0].reason = injected;
    input.worksheets[0].sections.recommendations[0].text = injected;
    input.worksheets[0].sections.recommendations[0].expectedBenefit = injected;
    input.worksheets[0].sections.recommendations[1].text = injected;
    input.worksheets[0].sections.rootCauseAnalysis.factBasedFindings[0] = injected;
    input.worksheets[0].sections.rootCauseAnalysis.ruleFindings[0] = injected;
    input.worksheets[0].sections.rootCauseAnalysis.optionFindings[0] = injected;
    input.worksheets[0].sections.rootCauseAnalysis.signals[0] = injected;
    input.worksheets[0].sections.inputValidation[0].message = injected;
    input.worksheets[0].sections.capabilityAssessment.findings[0] = injected;
    input.worksheets[0].sections.whatIfAnalysis.options[0].summary = injected;
    input.worksheets[0].sections.finalConclusion[0] = injected;

    const markdown = renderComposedEngineeringReport(input);

    for (const raw of ["C:\\private", "\\\\server\\share", "/home/user", "/opt/review", "/var/drawings"]) {
      expect(markdown).not.toContain(raw);
    }
    expect(markdown).not.toContain("<b>");
    expect(markdown).toContain("[redacted-local-path]");
    for (const preserved of ["after-win", "after-unc", "after-posix", "after-bracket", "after-markdown", "after-quoted", String.raw`SAFE\_TRAILER`]) {
      expect(markdown).toContain(preserved);
    }
    expect(markdown).toContain(String.raw`\| table`);
  });

  it("is deterministic and rejects invalid composed input generically", () => {
    expect(renderComposedEngineeringReport(clone(report()))).toBe(renderComposedEngineeringReport(report()));
    expect(() => renderComposedEngineeringReport({ reportVersion: "f6-composed-report-v1", secret: "do-not-echo" }))
      .toThrow("Invalid F6 composed engineering report.");
  });

  it.each([
    ["true without a finding", (input) => {
      input.blockedWorksheets = [];
      input.worksheets[0].confirmedRequirementViolation = true;
      input.worksheets[0].status = "FAIL";
      input.overallStatus = "FAIL";
    }],
    ["a finding with false", (input) => {
      input.worksheets[0].sections.inputValidation.push({
        findingCode: "requirement_violation",
        findingKind: "confirmed_requirement_violation",
        severity: "Critical",
        message: "A governed requirement is violated.",
        affectsCapabilityData: true,
        evidenceReferences: [REFERENCE],
      });
    }],
  ])("rejects a forged requirement violation (%s) before rendering output", (_label, forge) => {
    const input = report();
    forge(input);

    expect(() => renderComposedEngineeringReport(input))
      .toThrow("Invalid F6 composed engineering report.");
  });
});

describe("renderComposedEngineeringReport V2", () => {
  function reportV2() {
    const base = (sectionId, status = "SUPPORTED") => ({ sectionId, status, evidenceIds: [] });
    const quantity = (value) => ({ value, unit: "mm" });
    const range = (lower, upper) => ({ lower, upper, unit: "mm" });
    const statistical = { sigmaLevel: 4, lowerBound: -0.2, upperBound: 0.2, lowerMargin: -0.05, upperMargin: -0.05, minimumMargin: -0.05, formulaReferences: [] };
    const worstCase = { lowerBound: -0.2, upperBound: 0.2, lowerMargin: -0.05, upperMargin: -0.05, minimumMargin: -0.05, formulaReferences: [] };
    const gap = { gapId: "gap-context", priority: "P1", blocksFinalDecision: false, missingInformation: "Operating conditions were not provided.", affectedSections: ["operatingConditions"], suggestedSource: "Analysis Context", responsibleRole: "Design engineering role", verificationMethod: "Confirm operating conditions.", evidenceReferences: [] };
    const sections = {
      executiveSummary: { ...base("executive_summary"), analysisObject: null, mean: quantity(0), rssSigma: quantity(0.05), statisticalRange: range(-0.2, 0.2), worstCaseRange: range(-0.2, 0.2), minimumMargin: quantity(-0.05), predictiveCpk: 1.1, topContributors: [], primaryRisks: [], decision: "CONDITIONAL_PASS", actionRequired: true },
      objectiveAndRequirements: { ...base("objective_and_requirements", "PARTIAL"), analysisObject: null, analysisCharacteristic: "DIM829, Audio Jack to C bucket Gap", target: quantity(0), lsl: quantity(-0.15), usl: quantity(0.15), targetCpk: 1, requirementIds: [], functionalBoundary: null, passFailCriteria: null },
      operatingConditions: { ...base("operating_conditions", "INSUFFICIENT_EVIDENCE"), conditions: [] },
      inputIntegrity: {
        ...base("input_integrity", "PARTIAL"),
        rating: "PARTIALLY_COMPLETE",
        factors: [],
        findings: [],
        governanceSummary: {
          factorCount: 3,
          drawingNumberMissingCount: 3,
          dimIdMissingCount: 3,
          affectedSourceRows: [2, 3, 4],
        },
      },
      toleranceLoopDefinition: {
        ...base("tolerance_loop_definition", "INSUFFICIENT_EVIDENCE"),
        start: null,
        end: null,
        responseDirection: null,
        terms: [],
        equation: null,
        reviewRequired: true,
        loopEvidence: {
          imageReference: {
            artifact: "f1",
            worksheetName: "Analysis-A",
            relativePath: "images/Analysis-A.png",
            contentHash: "b".repeat(64),
          },
          toleranceLoopDescription: "DIM829, Audio Jack to C bucket Gap",
          factorDescriptions: [
            { tableId: "table-a", sourceRow: 2, factorDescription: "factor-1" },
            { tableId: "table-a", sourceRow: 3, factorDescription: "factor-2" },
            { tableId: "table-a", sourceRow: 4, factorDescription: "factor-3" },
          ],
          visualFacts: [
            {
              statementId: "fact-visual-1",
              scope: "direction",
              observedValue: "visible",
              confidence: "high",
              reviewStatus: "unreviewed",
              visibleBasis: "Arrow and labels are visible.",
            },
          ],
          contextSignals: [
            {
              statementId: "signal-context-1",
              scope: "direction",
              signalValue: "ambiguous",
              textBasis: "Context rows are not fully mapped.",
              requiresEngineeringReview: true,
            },
          ],
          requiresEngineeringReview: true,
          signedEquationAuthorized: false,
        },
      },
      calculationSelfCheck: {
        ...base("calculation_self_check"),
        meanCheck: {
          checkId: "mean",
          calculated: { value: 0, unit: "mm" },
          reported: { value: 0, unit: "mm" },
          difference: { value: 0, unit: "mm" },
          tolerance: { value: 1e-12, unit: "mm" },
          toleranceBasis: "input resolution",
          result: "PASS",
          formulaCheckIds: ["system.mean"],
        },
        rssCheck: {
          checkId: "rss",
          calculated: { value: 0.05, unit: "mm" },
          reported: { value: 0.05, unit: "mm" },
          difference: { value: 0, unit: "mm" },
          tolerance: { value: 1e-12, unit: "mm" },
          toleranceBasis: "input resolution",
          result: "PASS",
          formulaCheckIds: ["system.rssSigma"],
        },
        rangeChecks: [],
        worstCaseCheck: {
          checkId: "worst-case",
          calculated: { value: 0, unit: "mm" },
          reported: { value: 0, unit: "mm" },
          difference: { value: 0, unit: "mm" },
          tolerance: { value: 1e-12, unit: "mm" },
          toleranceBasis: "input resolution",
          result: "PASS",
          formulaCheckIds: ["system.worstCaseUpper", "system.worstCaseLower"],
        },
        worstCaseUpperCheck: {
          checkId: "worst-case-upper",
          calculated: { value: 0.2, unit: "mm" },
          reported: { value: 0.2, unit: "mm" },
          difference: { value: 0, unit: "mm" },
          tolerance: { value: 1e-12, unit: "mm" },
          toleranceBasis: "input resolution",
          result: "PASS",
          formulaCheckIds: ["system.worstCaseUpper"],
        },
        worstCaseLowerCheck: {
          checkId: "worst-case-lower",
          calculated: { value: -0.2, unit: "mm" },
          reported: { value: -0.2, unit: "mm" },
          difference: { value: 0, unit: "mm" },
          tolerance: { value: 1e-12, unit: "mm" },
          toleranceBasis: "input resolution",
          result: "PASS",
          formulaCheckIds: ["system.worstCaseLower"],
        },
      },
      statisticalResults: {
        ...base("statistical_results"),
        mean: quantity(0),
        adjustedMean: quantity(0),
        meanShift: quantity(0),
        rssSigma: quantity(0.05),
        ranges: [
          { sigmaLevel: 1, range: range(-0.05, 0.05), formulaCheckId: "statistical-bound-1sigma-v1" },
          { sigmaLevel: 3, range: range(-0.15, 0.15), formulaCheckId: "statistical-bound-3sigma-v1" },
          { sigmaLevel: 4, range: range(-0.2, 0.2), formulaCheckId: "statistical-bound-4sigma-v1" },
          { sigmaLevel: 6, range: range(-0.3, 0.3), formulaCheckId: "statistical-bound-6sigma-v1" },
        ],
        worstCase: range(-0.2, 0.2),
        formulaChecks: [
          {
            outputField: "statistical_range_target_1sigma",
            formulaId: "statistical-bound-1sigma-v1",
            formulaVersion: "v1",
            expression: "Mean ± 1 × RSS 1σ",
            inputs: [
              { name: "Mean", value: 0, unit: "mm", source: "system.mean" },
              { name: "RSS 1σ", value: 0.05, unit: "mm", source: "system.rssSigma" },
              { name: "N", value: 1, unit: "sigma", source: "target.sigmaLevel" },
            ],
            result: { value: 0.05, unit: "mm" },
            sourceCells: ["T40"],
            recomputable: true,
          },
          {
            outputField: "statistical_range_target_3sigma",
            formulaId: "statistical-bound-3sigma-v1",
            formulaVersion: "v1",
            expression: "Mean ± 3 × RSS 1σ",
            inputs: [
              { name: "Mean", value: 0, unit: "mm", source: "system.mean" },
              { name: "RSS 1σ", value: 0.05, unit: "mm", source: "system.rssSigma" },
              { name: "N", value: 3, unit: "sigma", source: "target.sigmaLevel" },
            ],
            result: { value: 0.15, unit: "mm" },
            sourceCells: ["T40"],
            recomputable: true,
          },
          {
            outputField: "statistical_range_target_4sigma",
            formulaId: "statistical-bound-4sigma-v1",
            formulaVersion: "v1",
            expression: "Mean ± 4 × RSS 1σ",
            inputs: [
              { name: "Mean", value: 0, unit: "mm", source: "system.mean" },
              { name: "RSS 1σ", value: 0.05, unit: "mm", source: "system.rssSigma" },
              { name: "N", value: 4, unit: "sigma", source: "target.sigmaLevel" },
            ],
            result: { value: 0.2, unit: "mm" },
            sourceCells: ["T41"],
            recomputable: true,
          },
          {
            outputField: "statistical_range_target_6sigma",
            formulaId: "statistical-bound-6sigma-v1",
            formulaVersion: "v1",
            expression: "Mean ± 6 × RSS 1σ",
            inputs: [
              { name: "Mean", value: 0, unit: "mm", source: "system.mean" },
              { name: "RSS 1σ", value: 0.05, unit: "mm", source: "system.rssSigma" },
              { name: "N", value: 6, unit: "sigma", source: "target.sigmaLevel" },
            ],
            result: { value: 0.3, unit: "mm" },
            sourceCells: ["T42"],
            recomputable: true,
          },
          {
            outputField: "margin.statistical.minimumMargin",
            formulaId: "margin-statistical-min-v1",
            formulaVersion: "v1",
            expression: "min(USL - UpperBound, LowerBound - LSL)",
            inputs: [
              { name: "USL", value: 0.15, unit: "mm", source: "capability.upperSpecLimit" },
              { name: "UpperBound", value: 0.2, unit: "mm", source: "statistical.upperBound" },
              { name: "LowerBound", value: -0.2, unit: "mm", source: "statistical.lowerBound" },
              { name: "LSL", value: -0.15, unit: "mm", source: "capability.lowerSpecLimit" },
            ],
            result: { value: -0.05, unit: "mm" },
            sourceCells: ["T49"],
            recomputable: true,
          },
          {
            outputField: "capability.lowerCpk",
            formulaId: "cpk-lower-v1",
            formulaVersion: "v1",
            expression: "CpkL = (Mean - LSL) / (3 × RSS 1σ)",
            inputs: [
              { name: "Mean", value: 0, unit: "mm", source: "system.mean" },
              { name: "LSL", value: -0.15, unit: "mm", source: "capability.lowerSpecLimit" },
              { name: "RSS 1σ", value: 0.05, unit: "mm", source: "system.rssSigma" },
            ],
            result: { value: 1, unit: "ratio" },
            sourceCells: ["T55"],
            recomputable: true,
          },
          {
            outputField: "capability.upperCpk",
            formulaId: "cpk-upper-v1",
            formulaVersion: "v1",
            expression: "CpkU = (USL - Mean) / (3 × RSS 1σ)",
            inputs: [
              { name: "USL", value: 0.15, unit: "mm", source: "capability.upperSpecLimit" },
              { name: "Mean", value: 0, unit: "mm", source: "system.mean" },
              { name: "RSS 1σ", value: 0.05, unit: "mm", source: "system.rssSigma" },
            ],
            result: { value: 1, unit: "ratio" },
            sourceCells: ["T56"],
            recomputable: true,
          },
          {
            outputField: "capability.cpk",
            formulaId: "cpk-v1",
            formulaVersion: "v1",
            expression: "Cpk = min(CpkL, CpkU)",
            inputs: [
              { name: "CpkL", value: 1, unit: "ratio", source: "capability.lowerCpk" },
              { name: "CpkU", value: 1, unit: "ratio", source: "capability.upperCpk" },
            ],
            result: { value: 1, unit: "ratio" },
            sourceCells: ["T57"],
            recomputable: true,
          },
        ],
      },
      specificationAndMargins: { ...base("specification_and_margins"), specification: { target: quantity(0), lsl: quantity(-0.15), usl: quantity(0.15), targetCpk: 1 }, assessment: { statistical, worstCase }, interferenceStatus: "UNKNOWN" },
      capabilityAssessment: { ...base("capability_assessment"), basis: "PREDICTIVE_TOLERANCE_MODEL", cp: 1.2, lowerCpk: 1.1, upperCpk: 1.2, cpk: 1.1, lowerZ: 3.3, upperZ: 3.6, predictedDpm: 500, predictedYield: 0.9995, targetCpk: 1, result: "PASS", limitations: ["Predictive model, not measured production capability."] },
      contributorAnalysis: { ...base("contributor_analysis"), contributors: [], interpretationLimit: "High contribution is not root-cause proof." },
      sensitivityAndOptimization: { ...base("sensitivity_and_optimization", "PARTIAL"), sensitivities: [], targets: [], options: [], highestImpactAction: null, roiStatus: "NOT_COMPUTED" },
      riskAssessment: { ...base("risk_assessment", "PARTIAL"), risks: [] },
      engineeringRecommendations: { ...base("engineering_recommendations", "PARTIAL"), mandatoryActions: [], validationActions: [], conditionalOptimizations: [] },
      designIntentReview: { ...base("design_intent_review", "PARTIAL"), checks: [] },
      dataGaps: { ...base("data_gaps", "PARTIAL"), gaps: [gap] },
      finalConclusion: { ...base("final_conclusion"), summary: "Predictive baseline passes with open conditions.", decision: "CONDITIONAL_PASS", basis: ["Predictive Cpk meets target."], limitations: [gap.missingInformation], nextActions: [gap.verificationMethod], baselineDecision: "PASS" },
    };
    return {
      contractVersion: "v1",
      outputClassification: "confidential",
      reportVersion: "f6-composed-report-v2",
      workbook: { fileName: "Anonymous.xlsx", contentHash: HASH },
      overallStatus: "CONDITIONAL_PASS",
      workbookSummary: { scope: { selectedWorksheetNames: ["Analysis-A"], excludedWorksheetNames: [] }, worksheetStatuses: [{ worksheetName: "Analysis-A", status: "CONDITIONAL_PASS" }], worstSupportedFinding: { worksheetName: "Analysis-A", baselineDecision: "PASS", reason: "Predictive baseline passes." }, blockingGapCount: 0, actionRequired: true },
      blockedWorksheets: [],
      worksheets: [{ worksheetName: "Analysis-A", tableId: "table-a", status: "CONDITIONAL_PASS", baselineDecision: "PASS", dataGaps: [gap], decisionInputs: { blockingP0GapIds: [], conditionalP1GapIds: [gap.gapId], supportedFailureEvidenceIds: [], openHighRiskIds: [] }, sections, evidenceIndex: [] }],
    };
  }

  it("renders the sixteen Chinese chapters in fixed order with separated RSS, WC, Margin and predictive capability", () => {
    const markdown = renderComposedEngineeringReportV2(reportV2());
    const headings = [
      "## 1. 执行摘要 Executive Summary", "## 2. 分析目标与功能要求", "## 3. 分析工况与适用边界",
      "## 4. 输入数据与完整性检查", "## 5. 公差链定义 Tolerance Loop Definition", "## 6. Loop 一致性与计算自检",
      "## 7. 统计分析结果", "## 8. 规格符合性与 Margin 评估", "## 9. 制程能力评估 Capability Assessment",
      "## 10. 变异贡献分析 Contributor Analysis", "## 11. 敏感度与优化收益分析", "## 12. 风险评估",
      "## 13. 工程建议", "## 14. 设计意图审查 Design Intent Review", "## 15. 数据缺口与待确认事项", "## 16. 最终结论",
    ];
    let previous = -1;
    for (const heading of headings) {
      const index = markdown.indexOf(heading);
      expect(index, heading).toBeGreaterThan(previous);
      previous = index;
    }
    expect(markdown).toContain("RSS 1σ");
    expect(markdown).toContain("Worst Case Margin");
    expect(markdown).toContain("预测性能力指标");
    expect(markdown).toContain("Target 4σ statistical range");
    expect(markdown).toContain("Mean ± 4 × RSS 1σ");
    expect(markdown).toContain("Target 4σ Minimum Margin");
    expect(markdown).toContain("Worst-case Minimum Margin");
    expect(markdown).toContain("负值表示评估范围超出 Spec");
    expect(markdown).toContain("CpkL = (Mean - LSL) / (3 × RSS 1σ)");
    expect(markdown).toContain("CpkU = (USL - Mean) / (3 × RSS 1σ)");
    expect(markdown).toContain("Cpk = min(CpkL, CpkU)");
    expect(markdown).toContain("1σ statistical range");
    expect(markdown).toContain("3σ statistical range");
    expect(markdown).toContain("6σ statistical range");
    expect(markdown).toContain("margin.statistical.minimumMargin");
    expect(markdown).toContain(String.raw`min\(USL - UpperBound, LowerBound - LSL\)`);
    expect(markdown).toMatch(/LSL.*USL.*Target Cpk/s);
    expect(markdown).toContain("PREDICTIVE_TOLERANCE_MODEL");
    expect(markdown).toContain("不是量产实测 Cpk");
    expect(markdown).toContain("P1");
    expect(markdown).toContain("F4 基线复算与数值一致性检查");
    expect(markdown).toContain("F6 recomputed");
    expect(markdown).toContain("F4 reported");
    expect(markdown).toContain("1e-12 mm");
    expect(markdown).not.toContain("Tolerance 0.000 mm");
    expect(markdown).not.toContain("Requirement Review");
    expect(markdown).toContain("分析特性：DIM829, Audio Jack to C bucket Gap");
    expect(markdown).toContain("结构化工程定义：未提供");
    expect(markdown).toContain("Drawing Number 缺失：3/3");
    expect(markdown).toContain("DIM ID 缺失：3/3");
    expect(markdown).toContain("F1 tolerance-path image");
    expect(markdown).toContain("SIGNAL");
    expect(markdown).toContain("不能生成 signed equation");
  });

  it("renders contained image links and falls back safely when roots are absent, escaping, or missing", ({ skip }) => {
    const base = path.join(tmpdir(), `f6-render-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const publishRoot = path.join(base, "publish");
    const outputRoot = path.join(publishRoot, "f6", "run");
    const f1ArtifactRoot = path.join(publishRoot, "f1");
    const imagePath = path.join(f1ArtifactRoot, "images", "Analysis-A.png");
    const outsideRoot = path.join(base, "outside");
    mkdirSync(path.dirname(imagePath), { recursive: true });
    mkdirSync(outputRoot, { recursive: true });
    writeFileSync(imagePath, "png");

    try {
      const markdownWithLink = renderComposedEngineeringReportV2(reportV2(), { outputRoot, f1ArtifactRoot, publishRoot });
      expect(markdownWithLink).toMatch(/\[F1 图片\]\([^)]*images\/Analysis-A\.png\)/);
      expect(markdownWithLink).not.toMatch(/[A-Za-z]:[\\/]/);

      const markdownWithoutRoots = renderComposedEngineeringReportV2(reportV2(), { outputRoot });
      expect(markdownWithoutRoots).toContain("F1 图片证据链接不可用");

      const junctionPath = path.join(f1ArtifactRoot, "images");
      rmSync(junctionPath, { recursive: true, force: true });
      mkdirSync(outsideRoot, { recursive: true });
      writeFileSync(path.join(outsideRoot, "Analysis-A.png"), "outside");
      try {
        symlinkSync(outsideRoot, junctionPath, "junction");
      } catch (error) {
        if (process.platform === "win32" && error?.code === "EPERM") skip();
        throw error;
      }
      const markdownEscaping = renderComposedEngineeringReportV2(reportV2(), { outputRoot, f1ArtifactRoot, publishRoot });
      expect(markdownEscaping).toContain("F1 图片证据链接不可用");
      expect(markdownEscaping).not.toContain("[F1 图片](");
      expect(markdownEscaping).not.toContain(outsideRoot);

      const missing = reportV2();
      missing.worksheets[0].sections.toleranceLoopDefinition.loopEvidence.imageReference.relativePath = "images/missing.png";
      const markdownMissing = renderComposedEngineeringReportV2(missing, { outputRoot, f1ArtifactRoot, publishRoot });
      expect(markdownMissing).toContain("F1 图片证据链接不可用");
      expect(markdownMissing).not.toContain("images/missing.png");
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
