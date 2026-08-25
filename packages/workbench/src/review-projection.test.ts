import { describe, expect, it } from "vitest";

import { projectWorksheetReview } from "./review-projection.js";

describe("projectWorksheetReview", () => {
  it("links a finding to source row, cells, image, formula, and F0 rule", () => {
    const result = projectWorksheetReview({
      sessionId: "session-review-1",
      snapshot: {
        contractVersion: "f8-session-snapshot-v1",
        sessionId: "session-review-1",
        revision: 8,
        inputRevision: 4,
        state: "review_required",
        activeAttempt: null,
        priorRunReferences: [],
        artifactRefs: [
          { artifactId: "img-aj-gap", kind: "f1_image", revision: 1, validated: true },
          { artifactId: "f4-report-aj-gap", kind: "f4_report", revision: 6, validated: true },
          { artifactId: "f5-report-aj-gap", kind: "f5_report", revision: 7, validated: true },
          { artifactId: "f6-report-aj-gap", kind: "f6_report", revision: 8, validated: true },
        ],
      },
      f4Report: {
        calculations: [
          {
            worksheetSelection: { worksheetName: "AJ_GAP", tableId: "table-aj-gap" },
            capability: { cpk: 1.02, lowerCpk: 1.02, upperCpk: 1.41, status: "FAIL" },
            traceRecords: [
              {
                outputField: "capability.cpk",
                formulaId: "cpk-v1",
                formulaVersion: "excel-ta-v1",
                sourceCells: ["capability.lowerCpk", "capability.upperCpk"],
              },
            ],
            factors: [
              {
                factorName: "AJ center to C-bucket",
                unit: "mm",
                source: { worksheetName: "AJ_GAP", tableId: "table-aj-gap", sourceRow: 15 },
                input: {
                  nominalValue: 0.3,
                  upperTolerance: 0.05,
                  lowerTolerance: -0.04,
                  longTermSafetyFactor: 1,
                  sigmaLevel: 4,
                  distribution: "normal",
                },
                mean: 0.3,
                halfTolerance: 0.05,
                sigma: 0.01,
                contribution: 0.62,
                trace: {
                  formulaIds: ["factor-mean-v1", "factor-sigma-v1"],
                  sourceCells: ["AJ_GAP!J15", "AJ_GAP!K15", "AJ_GAP!L15"],
                },
              },
            ],
          },
        ],
      },
      f5Report: {
        status: "completed",
        worksheets: [
          {
            worksheetName: "AJ_GAP",
            tableId: "table-aj-gap",
            status: "completed",
            statements: [
              {
                statementId: "rule-cpk-target",
                type: "RULE",
                section: "capability-vs-specification",
                content: {
                  entryId: "performance-cpk-below-target",
                  effectiveVersion: "interpretation-rules-v1",
                  applicability: { analysisDimension: "one-dimensional", method: "rss" },
                  relatedFactReferences: ["cpk", "targetCpk"],
                  evidence: {
                    classification: "internal",
                    sourceAlias: "kb-performance",
                    sourceFileHash: "a".repeat(64),
                    sourceVersion: "2026-Q3",
                    sheetName: "Rules",
                    sourceRange: "A2:B2",
                    owner: "knowledge-steward",
                    confidence: 0.9,
                    effectiveVersion: "interpretation-rules-v1",
                    changeSummary: "Initial reviewed interpretation rules.",
                  },
                },
              },
              {
                statementId: "signal-major-contribution",
                type: "SIGNAL",
                section: "major-contributors",
                content: {
                  entryId: "signal-major-contribution",
                  effectiveVersion: "interpretation-rules-v1",
                  applicability: { analysisDimension: "one-dimensional", method: "rss" },
                  relatedFactReferences: ["contributors"],
                  evidence: {
                    classification: "internal",
                    sourceAlias: "kb-signal",
                    sourceFileHash: "b".repeat(64),
                    sourceVersion: "2026-Q3",
                    sheetName: "Rules",
                    sourceRange: "C3:D3",
                    owner: "knowledge-steward",
                    confidence: 0.9,
                    effectiveVersion: "interpretation-rules-v1",
                    changeSummary: "Initial reviewed interpretation rules.",
                  },
                  requiresEngineeringReview: true,
                },
              },
            ],
            clarifications: [],
            contextualObservations: [],
          },
        ],
      },
      f6Report: {
        runStatus: "COMPLETED",
        worksheets: [
          {
            worksheetName: "AJ_GAP",
            runStatus: "COMPLETED",
            baselineIdentity: {
              workbookContentHash: "c".repeat(64),
              worksheetName: "AJ_GAP",
              tableId: "table-aj-gap",
              calculationRunReference: "calc-aj-gap-1",
            },
            options: [
              {
                optionId: "op1",
                status: "candidate",
                optionKind: "centering",
                title: "OP1 Centering",
                summary: "Shift mean toward target.",
                findings: [],
                scenario: {
                  scenarioId: "scenario-op1",
                  label: "OP1",
                  toleranceChanges: [],
                },
                expectedMetrics: {
                  baselineCpk: 1.02,
                  scenarioCpk: 1.18,
                  deltaCpk: 0.16,
                },
                feasibility: {
                  status: "supported",
                  reasonCodes: ["caller_provided_target"],
                  evidenceReferences: ["Feature6-Optimization-Targets.json"],
                },
                recommendation: { decision: "consider", rationale: "Improves Cpk with existing stack." },
              },
            ],
          },
        ],
        summary: {
          worksheetCount: 1,
          completedWorksheetCount: 1,
          partiallyCompletedWorksheetCount: 0,
          inputRejectedWorksheetCount: 0,
          candidateOptionCount: 1,
          completedOptionCount: 0,
          insufficientEvidenceOptionCount: 0,
          calculationFailedOptionCount: 0,
        },
      },
    }, "AJ_GAP");

    expect(result.findings[0]?.evidence).toEqual({
      sourceRow: 15,
      sourceCells: ["AJ_GAP!J15", "AJ_GAP!K15", "AJ_GAP!L15"],
      imageArtifactId: "img-aj-gap",
      formulaIds: ["cpk-v1"],
      ruleEntryId: "performance-cpk-below-target",
    });
  });
});