import { describe, expect, it } from "vitest";
import { f6ComposedEngineeringReportSchema } from "../packages/contracts/dist/contracts.js";
import { renderComposedEngineeringReport } from "./f6-composed-report.mjs";

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
