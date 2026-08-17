import { describe, expect, it } from "vitest";
import { f6OptimizationResultSchema } from "../packages/contracts/dist/contracts.js";
import { renderF6Report } from "./f6-report.mjs";

const HASH = "a".repeat(64);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function result() {
  return f6OptimizationResultSchema.parse({
    contractVersion: "v1",
    outputClassification: "confidential",
    featureId: "F6",
    status: "calculation_failed",
    optimizationVersion: "f6-optimization-v1",
    workbook: { fileName: "Anonymous.xlsx", contentHash: HASH },
    worksheets: [{
      worksheetName: "Analysis|<script>[x](javascript:alert(1))",
      f4CalculationIndex: 1,
      status: "calculation_failed",
      baselineMetrics: { mean: 0, rssSigma: 0.2, cp: 0.9, cpk: 0.8, yield: 0.98, dpm: 20_000 },
      targetCapability: { targetCpk: 1.33, targetSigmaLevel: 4, source: "worksheet" },
      inputFindings: [],
      options: [
        {
          status: "calculation_failed",
          optionId: "top-1",
          optionKind: "reduce_top_contributor_20",
          reasonCode: "controlled_failure|<b>",
          evidenceReferences: [],
          impactRank: null,
        },
        {
          status: "calculation_failed",
          optionId: "top-3",
          optionKind: "reduce_top_3_contributors_30",
          reasonCode: "controlled_failure",
          evidenceReferences: [],
          impactRank: null,
        },
        {
          status: "insufficient_evidence",
          optionId: "supplier-gate",
          optionKind: "improve_supplier_capability",
          predictedImprovement: "insufficient_evidence",
          requiredInputs: ["confirmed_supplier_capability_evidence", "controlled_supplier_scenario_calculation"],
          evidenceReferences: [],
          relativeCost: "insufficient_evidence",
          roiScore: "not_computed",
          impactRank: null,
        },
        {
          status: "insufficient_evidence",
          optionId: "datum-gate",
          optionKind: "tighten_datum_strategy",
          predictedImprovement: "insufficient_evidence",
          requiredInputs: ["confirmed_datum_chain_evidence", "engineering_review"],
          evidenceReferences: [],
          relativeCost: "insufficient_evidence",
          roiScore: "not_computed",
          impactRank: null,
        },
      ],
      risks: [{
        riskId: "risk-1",
        category: "Product",
        rating: "Critical",
        status: "open",
        reason: "Cpk below requirement | <img src=x onerror=alert(1)>",
        evidenceReferences: [{ artifact: "Feature5-Report.json", contentHash: HASH }],
      }],
      recommendations: [],
      roiStatus: "not_computed",
      clarifications: [{
        clarificationId: "supplier-input",
        reasonCode: "supplier_scenario_evidence_closure_required",
        requiredInputs: ["confirmed_supplier_capability_evidence"],
        questionForReviewer: "Provide supplier evidence.",
        evidenceReferences: [],
      }],
    }],
    summary: {
      worksheetCount: 1,
      completedWorksheetCount: 0,
      partiallyCompletedWorksheetCount: 0,
      calculationFailedWorksheetCount: 1,
      inputRejectedWorksheetCount: 0,
      completedOptionCount: 0,
      calculationFailedOptionCount: 2,
      insufficientEvidenceOptionCount: 2,
    },
    provenance: {
      f2Reference: { artifact: "Feature2-Report.json", contentHash: HASH },
      f3Reference: { artifact: "Feature3-Report.json", contentHash: HASH },
      f4Reference: { artifact: "Feature4-Calculation.json", contentHash: HASH, runId: "run-1", calculationVersion: "excel-ta-v1" },
      f5Reference: { artifact: "Feature5-Report.json", contentHash: HASH, interpretationVersion: "f5-data-interpretation-v1" },
      f0Versions: { knowledgeBaseVersion: "v1", capabilityVersion: "internal-v1", interpretationVersion: "interpretation-rules-v1" },
      scenarioPolicyVersion: "f6-scenario-policy-v1",
    },
  });
}

describe("renderF6Report", () => {
  it("renders governed metrics, risks, options, and literal evidence gaps", () => {
    const markdown = renderF6Report(result());

    expect(markdown).toContain("# Feature 6 优化工程报告");
    expect(markdown).toContain("| Metric | Result | Status |");
    expect(markdown).toContain("| Scenario | Predicted Improvement |");
    expect(markdown).toContain("Improve Supplier Capability");
    expect(markdown).toContain("Tighten Datum Strategy");
    expect(markdown).toContain(String.raw`insufficient\_evidence`);
    expect(markdown).toContain(String.raw`confirmed\_supplier\_capability\_evidence`);
    expect(markdown).toContain(String.raw`confirmed\_datum\_chain\_evidence`);
    expect(markdown).toContain(String.raw`Highest Impact Action: insufficient\_evidence`);
    expect(markdown).toContain(String.raw`ROI: not\_computed`);
    expect(markdown).toContain(String.raw`| Cpk | 0.8 | calculation\_failed |`);
    expect(markdown).not.toMatch(/meets target|below target/);
    expect(markdown).not.toContain("Highest ROI");
    expect(markdown.endsWith("\n")).toBe(true);
  });

  it("escapes Markdown, HTML, tables, and links without emitting traces or absolute paths", () => {
    const markdown = renderF6Report(result(), { ignored: "C:\\private\\secret.xlsx" });

    expect(markdown).toContain("Analysis\\|&lt;script&gt;\\[x\\]\\(javascript:alert\\(1\\)\\)");
    expect(markdown).toContain("Cpk below requirement \\| &lt;img src=x onerror=alert\\(1\\)&gt;");
    expect(markdown).not.toMatch(/<script|<img|javascript:\[|[A-Za-z]:[\\/]/i);
    expect(markdown).not.toMatch(/sourceCells|traceRecords|excelFormula|calculationTrace/i);
  });

  it("is deterministic and rejects invalid structured input generically", () => {
    expect(renderF6Report(clone(result()))).toBe(renderF6Report(result()));
    expect(() => renderF6Report({ featureId: "F6", secret: "do-not-echo" })).toThrow("Invalid F6 result.");
  });
});
