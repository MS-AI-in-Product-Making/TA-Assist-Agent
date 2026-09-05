import { describe, expect, it } from "vitest";

import {
  f6MaterializationResultSchema,
  type F6AnalysisContextProposal,
} from "@ai-assist/contracts";

import type { F6InputMaterializationLineage } from "./types.js";
import { materializeF6AnalysisContext, materializeF6OptimizationTargets } from "./f6-input-materializer.js";

function buildLineage(overrides: Partial<F6InputMaterializationLineage> = {}): F6InputMaterializationLineage {
  return {
    reviewContextId: "review-context-2",
    expectedReviewContextId: "review-context-2",
    workbookContentHash: "a".repeat(64),
    calculationVersion: "excel-ta-v1",
    projectReference: "project-a",
    runReference: "f4-run-a",
    worksheets: [
      {
        worksheetName: "gap w rubber_TPoverload500g",
        tableId: "table-gap-1",
        factors: [
          {
            sourceRow: 14,
            factorName: "battery flatness",
            unit: "mm",
            lowerTolerance: -0.15,
            upperTolerance: 0.15,
          },
        ],
        system: {
          designNominal: 0,
          mean: 0,
          rssSigma: 0.1,
          lowerSpecLimit: -0.4,
          upperSpecLimit: 0.4,
          targetCpk: 1.33,
          traceReferences: [{ outputField: "system.mean", formulaId: "mean-1", formulaVersion: "v1" }],
        },
      },
      {
        worksheetName: "gap w rubber_static",
        tableId: "table-gap-2",
        factors: [],
        system: {
          designNominal: 0,
          mean: 0,
          rssSigma: 0.12,
          lowerSpecLimit: -0.5,
          upperSpecLimit: 0.5,
          targetCpk: 1.33,
          traceReferences: [{ outputField: "system.mean", formulaId: "mean-1", formulaVersion: "v1" }],
        },
      },
    ],
    ...overrides,
  };
}

describe("materializeF6AnalysisContext", () => {
  it("materializes narrative and exact worksheet binding with baseline identity from current lineage", () => {
    const proposal: F6AnalysisContextProposal = {
      proposalVersion: "f6-analysis-context-proposal-v1",
      userText: "橡胶压缩会影响装配间隙，500g load 是关键工况。",
      worksheetSelectors: ["gap w rubber_TPoverload500g"],
      clarifications: [],
    };

    const result = materializeF6AnalysisContext(proposal, buildLineage());

    expect(result.status).toBe("draft_ready");
    if (result.status !== "draft_ready") return;

    expect(f6MaterializationResultSchema.parse(result)).toEqual(result);

    expect(result.artifact.contextVersion).toBe("f6-analysis-context-v2");
    expect(result.artifact.worksheets).toHaveLength(1);
    expect(result.artifact.worksheets[0]?.engineeringNarrative).toBe(proposal.userText);
    expect(result.artifact.worksheets[0]?.worksheetName).toBe("gap w rubber_TPoverload500g");
    expect(result.artifact.worksheets[0]?.baselineIdentity).toEqual({
      calculationVersion: "excel-ta-v1",
      projectReference: "project-a",
      runReference: "f4-run-a",
      workbookContentHash: "a".repeat(64),
      worksheetName: "gap w rubber_TPoverload500g",
      tableId: "table-gap-1",
    });
    expect(result.artifact.worksheets[0]?.operatingConditions).toEqual([]);
    expect(result.artifact.worksheets[0]?.correlationRequirement).toEqual({ mode: "NOT_PROVIDED" });
    expect(result.artifact.worksheets[0]).not.toHaveProperty("functionalRequirements");
    expect(result.artifact.worksheets[0]).not.toHaveProperty("loopDefinition");
  });

  it("returns proposal_ambiguous clarification for unknown worksheet selector", () => {
    const proposal: F6AnalysisContextProposal = {
      proposalVersion: "f6-analysis-context-proposal-v1",
      userText: "test",
      worksheetSelectors: ["unknown-sheet"],
      clarifications: [],
    };

    const result = materializeF6AnalysisContext(proposal, buildLineage());

    expect(result).toEqual({
      status: "clarification_required",
      clarifications: [
        expect.objectContaining({
          clarificationId: "proposal_ambiguous",
          reasonCode: "proposal_ambiguous",
        }),
      ],
    });
  });

  it("returns proposal_ambiguous clarification for duplicate worksheet selectors", () => {
    const proposal: F6AnalysisContextProposal = {
      proposalVersion: "f6-analysis-context-proposal-v1",
      userText: "test",
      worksheetSelectors: ["gap w rubber_static", "gap w rubber_static"],
      clarifications: [],
    };

    const result = materializeF6AnalysisContext(proposal, buildLineage());

    expect(result).toEqual({
      status: "clarification_required",
      clarifications: [
        expect.objectContaining({
          clarificationId: "proposal_ambiguous",
          reasonCode: "proposal_ambiguous",
        }),
      ],
    });
  });

  it("returns draft_identity_mismatch clarification for stale review context", () => {
    const proposal: F6AnalysisContextProposal = {
      proposalVersion: "f6-analysis-context-proposal-v1",
      userText: "test",
      worksheetSelectors: ["gap w rubber_static"],
      clarifications: [],
    };

    const result = materializeF6AnalysisContext(proposal, buildLineage({
      reviewContextId: "review-context-1",
      expectedReviewContextId: "review-context-2",
    }));

    expect(result).toEqual({
      status: "clarification_required",
      clarifications: [
        expect.objectContaining({
          clarificationId: "draft_identity_mismatch",
          reasonCode: "draft_identity_mismatch",
        }),
      ],
    });
  });
});

describe("materializeF6OptimizationTargets", () => {
  it("keeps pure system_mean_shift direction as qualitative only", () => {
    const result = materializeF6OptimizationTargets({
      proposalVersion: "f6-optimization-targets-proposal-v1",
      userText: "优先评估系统均值偏移。",
      directions: [{
        adjustmentClass: "system_mean_shift",
        worksheetSelector: "gap w rubber_TPoverload500g",
      }],
      clarifications: [],
    }, buildLineage());

    expect(result.status).toBe("draft_ready");
    if (result.status !== "draft_ready") return;

    expect(f6MaterializationResultSchema.parse(result)).toEqual(result);
    expect(result.artifact).toBeUndefined();
    expect(result.preview.qualitativeDirections).toEqual([
      { adjustmentClass: "system_mean_shift", worksheetName: "gap w rubber_TPoverload500g" },
    ]);
  });

  it("resolves identity for qualitative factor_nominal direction", () => {
    const result = materializeF6OptimizationTargets({
      proposalVersion: "f6-optimization-targets-proposal-v1",
      userText: "先定性评估 battery flatness nominal 的方向。",
      directions: [{
        adjustmentClass: "factor_nominal",
        worksheetSelector: "gap w rubber_TPoverload500g",
        factorSelector: "battery flatness",
      }],
      clarifications: [],
    }, buildLineage());

    expect(result.status).toBe("draft_ready");
    if (result.status !== "draft_ready") return;

    expect(result.artifact).toBeUndefined();
    expect(result.preview.qualitativeDirections).toEqual([
      {
        adjustmentClass: "factor_nominal",
        worksheetName: "gap w rubber_TPoverload500g",
        factor: {
          worksheetName: "gap w rubber_TPoverload500g",
          tableId: "table-gap-1",
          sourceRow: 14,
          factorName: "battery flatness",
          unit: "mm",
        },
      },
    ]);
    expect(f6MaterializationResultSchema.parse(result)).toEqual(result);
  });

  it("resolves identity for qualitative factor_sigma direction", () => {
    const result = materializeF6OptimizationTargets({
      proposalVersion: "f6-optimization-targets-proposal-v1",
      userText: "先定性评估 battery flatness sigma 方向。",
      directions: [{
        adjustmentClass: "factor_sigma",
        worksheetSelector: "gap w rubber_TPoverload500g",
        factorSelector: "battery flatness",
      }],
      clarifications: [],
    }, buildLineage());

    expect(result.status).toBe("draft_ready");
    if (result.status !== "draft_ready") return;

    expect(result.artifact).toBeUndefined();
    expect(result.preview.qualitativeDirections).toEqual([
      {
        adjustmentClass: "factor_sigma",
        worksheetName: "gap w rubber_TPoverload500g",
        factor: {
          worksheetName: "gap w rubber_TPoverload500g",
          tableId: "table-gap-1",
          sourceRow: 14,
          factorName: "battery flatness",
          unit: "mm",
        },
      },
    ]);
  });

  it("materializes explicit battery flatness upper tolerance to governed v2 factor target", () => {
    const result = materializeF6OptimizationTargets({
      proposalVersion: "f6-optimization-targets-proposal-v1",
      userText: "battery flatness upper tolerance 调整到 0.25 mm。",
      directions: [{
        adjustmentClass: "factor_tolerance",
        worksheetSelector: "gap w rubber_TPoverload500g",
        factorSelector: "battery flatness",
        numericTarget: {
          field: "upper_tolerance",
          value: 0.25,
          unit: "mm",
        },
      }],
      clarifications: [],
    }, buildLineage());

    expect(result.status).toBe("draft_ready");
    if (result.status !== "draft_ready") return;

    expect(f6MaterializationResultSchema.parse(result)).toEqual(result);

    expect(result.artifact.targetVersion).toBe("f6-optimization-targets-v2");
    expect(result.artifact.worksheets).toHaveLength(1);
    expect(result.artifact.worksheets[0]?.worksheetName).toBe("gap w rubber_TPoverload500g");
    expect(result.artifact.worksheets[0]?.tableId).toBe("table-gap-1");
    expect(result.artifact.worksheets[0]?.targets).toEqual([
      expect.objectContaining({
        targetType: "factor_tolerance",
        factor: {
          worksheetName: "gap w rubber_TPoverload500g",
          tableId: "table-gap-1",
          sourceRow: 14,
          factorName: "battery flatness",
          unit: "mm",
        },
        upperTolerance: 0.25,
        lowerTolerance: -0.15,
        unit: "mm",
      }),
    ]);
  });

  it("returns clarification for duplicated factor names under same worksheet", () => {
    const result = materializeF6OptimizationTargets({
      proposalVersion: "f6-optimization-targets-proposal-v1",
      userText: "调整 battery flatness。",
      directions: [{
        adjustmentClass: "factor_tolerance",
        worksheetSelector: "gap w rubber_TPoverload500g",
        factorSelector: "battery flatness",
        numericTarget: {
          field: "upper_tolerance",
          value: 0.2,
          unit: "mm",
        },
      }],
      clarifications: [],
    }, buildLineage({
      worksheets: [{
        worksheetName: "gap w rubber_TPoverload500g",
        tableId: "table-gap-1",
        factors: [
          { sourceRow: 14, factorName: "battery flatness", unit: "mm", lowerTolerance: -0.1, upperTolerance: 0.1 },
          { sourceRow: 20, factorName: "battery flatness", unit: "mm", lowerTolerance: -0.12, upperTolerance: 0.12 },
        ],
        system: {
          designNominal: 0,
          mean: 0,
          rssSigma: 0.1,
          lowerSpecLimit: -0.4,
          upperSpecLimit: 0.4,
          targetCpk: 1.33,
          traceReferences: [{ outputField: "system.mean", formulaId: "mean-1", formulaVersion: "v1" }],
        },
      }],
    }));

    expect(result).toEqual({
      status: "clarification_required",
      clarifications: [
        expect.objectContaining({
          clarificationId: "proposal_ambiguous",
          reasonCode: "proposal_ambiguous",
        }),
      ],
    });
  });

  it("returns clarification when worksheet is outside current validated scope", () => {
    const result = materializeF6OptimizationTargets({
      proposalVersion: "f6-optimization-targets-proposal-v1",
      userText: "调整 tolerance。",
      directions: [{
        adjustmentClass: "factor_tolerance",
        worksheetSelector: "outside-sheet",
        factorSelector: "battery flatness",
        numericTarget: {
          field: "upper_tolerance",
          value: 0.2,
          unit: "mm",
        },
      }],
      clarifications: [],
    }, buildLineage());

    expect(result).toEqual({
      status: "clarification_required",
      clarifications: [
        expect.objectContaining({
          clarificationId: "proposal_ambiguous",
          reasonCode: "proposal_ambiguous",
        }),
      ],
    });
  });

  it("returns clarification when system specification omits explicit LSL/USL target", () => {
    const result = materializeF6OptimizationTargets({
      proposalVersion: "f6-optimization-targets-proposal-v1",
      userText: "调整规格。",
      directions: [{
        adjustmentClass: "system_specification",
        worksheetSelector: "gap w rubber_TPoverload500g",
      }],
      clarifications: [],
    }, buildLineage());

    expect(result).toEqual({
      status: "clarification_required",
      clarifications: [
        expect.objectContaining({
          clarificationId: "proposal_ambiguous",
          reasonCode: "proposal_ambiguous",
        }),
      ],
    });
  });

  it("returns clarification when explicit tolerance bounds become invalid", () => {
    const result = materializeF6OptimizationTargets({
      proposalVersion: "f6-optimization-targets-proposal-v1",
      userText: "把 tolerance 改成无效区间。",
      directions: [
        {
          adjustmentClass: "factor_tolerance",
          worksheetSelector: "gap w rubber_TPoverload500g",
          factorSelector: "battery flatness",
          numericTarget: {
            field: "upper_tolerance",
            value: -0.3,
            unit: "mm",
          },
        },
        {
          adjustmentClass: "factor_tolerance",
          worksheetSelector: "gap w rubber_TPoverload500g",
          factorSelector: "battery flatness",
          numericTarget: {
            field: "lower_tolerance",
            value: -0.2,
            unit: "mm",
          },
        },
      ],
      clarifications: [],
    }, buildLineage());

    expect(result).toEqual({
      status: "clarification_required",
      clarifications: [
        expect.objectContaining({
          clarificationId: "proposal_ambiguous",
          reasonCode: "proposal_ambiguous",
        }),
      ],
    });
  });

  it("returns clarification when explicit numeric target unit is missing", () => {
    const result = materializeF6OptimizationTargets({
      proposalVersion: "f6-optimization-targets-proposal-v1",
      userText: "battery flatness upper tolerance 到 0.2。",
      directions: [{
        adjustmentClass: "factor_tolerance",
        worksheetSelector: "gap w rubber_TPoverload500g",
        factorSelector: "battery flatness",
        numericTarget: {
          field: "upper_tolerance",
          value: 0.2,
          unit: "",
        },
      }],
      clarifications: [],
    } as unknown as Parameters<typeof materializeF6OptimizationTargets>[0], buildLineage());

    expect(result).toEqual({
      status: "clarification_required",
      clarifications: [
        expect.objectContaining({
          clarificationId: "proposal_ambiguous",
          reasonCode: "proposal_ambiguous",
        }),
      ],
    });
  });

  it("returns clarification for factor-bound qualitative direction missing factorSelector", () => {
    const result = materializeF6OptimizationTargets({
      proposalVersion: "f6-optimization-targets-proposal-v1",
      userText: "先做 factor_sigma 方向。",
      directions: [{
        adjustmentClass: "factor_sigma",
        worksheetSelector: "gap w rubber_TPoverload500g",
      }],
      clarifications: [],
    }, buildLineage());

    expect(result).toEqual({
      status: "clarification_required",
      clarifications: [
        expect.objectContaining({
          clarificationId: "proposal_ambiguous",
          reasonCode: "proposal_ambiguous",
        }),
      ],
    });
  });

  it("returns clarification for factor-bound qualitative direction with unknown factor", () => {
    const result = materializeF6OptimizationTargets({
      proposalVersion: "f6-optimization-targets-proposal-v1",
      userText: "先做 factor_nominal 方向。",
      directions: [{
        adjustmentClass: "factor_nominal",
        worksheetSelector: "gap w rubber_TPoverload500g",
        factorSelector: "unknown-factor",
      }],
      clarifications: [],
    }, buildLineage());

    expect(result).toEqual({
      status: "clarification_required",
      clarifications: [
        expect.objectContaining({
          clarificationId: "proposal_ambiguous",
          reasonCode: "proposal_ambiguous",
        }),
      ],
    });
  });

  it("returns clarification for factor-bound qualitative direction with duplicate factor binding", () => {
    const result = materializeF6OptimizationTargets({
      proposalVersion: "f6-optimization-targets-proposal-v1",
      userText: "先做 improvement_ratio 方向。",
      directions: [{
        adjustmentClass: "improvement_ratio",
        worksheetSelector: "gap w rubber_TPoverload500g",
        factorSelector: "battery flatness",
      }],
      clarifications: [],
    }, buildLineage({
      worksheets: [{
        worksheetName: "gap w rubber_TPoverload500g",
        tableId: "table-gap-1",
        factors: [
          { sourceRow: 14, factorName: "battery flatness", unit: "mm", lowerTolerance: -0.1, upperTolerance: 0.1 },
          { sourceRow: 20, factorName: "battery flatness", unit: "mm", lowerTolerance: -0.12, upperTolerance: 0.12 },
        ],
        system: {
          designNominal: 0,
          mean: 0,
          rssSigma: 0.1,
          lowerSpecLimit: -0.4,
          upperSpecLimit: 0.4,
          targetCpk: 1.33,
          traceReferences: [{ outputField: "system.mean", formulaId: "mean-1", formulaVersion: "v1" }],
        },
      }],
    }));

    expect(result).toEqual({
      status: "clarification_required",
      clarifications: [
        expect.objectContaining({
          clarificationId: "proposal_ambiguous",
          reasonCode: "proposal_ambiguous",
        }),
      ],
    });
  });

  it("rejects forged identity and hash fields from client proposal payload", () => {
    const result = materializeF6OptimizationTargets({
      proposalVersion: "f6-optimization-targets-proposal-v1",
      userText: "test",
      directions: [{
        adjustmentClass: "system_mean_shift",
        worksheetSelector: "gap w rubber_TPoverload500g",
      }],
      clarifications: [],
      workbookContentHash: "b".repeat(64),
      draftHash: "c".repeat(64),
    } as unknown as Parameters<typeof materializeF6OptimizationTargets>[0], buildLineage());

    expect(result).toEqual({
      status: "clarification_required",
      clarifications: [
        expect.objectContaining({
          clarificationId: "proposal_ambiguous",
          reasonCode: "proposal_ambiguous",
        }),
      ],
    });
  });
});
