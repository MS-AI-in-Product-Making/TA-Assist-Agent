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
          { artifactId: "img-aj-gap", kind: "f1_image", revision: 4, validated: true, reviewContextId: "context-review-1" },
          { artifactId: "f4-report-aj-gap", kind: "f4_calculation", revision: 4, validated: true, reviewContextId: "context-review-1" },
          { artifactId: "f5-report-aj-gap", kind: "f5_report", revision: 4, validated: true, reviewContextId: "context-review-1" },
          { artifactId: "f6-report-aj-gap", kind: "f6_report", revision: 4, validated: true, reviewContextId: "context-review-1" },
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

  it("rebinds evidence to the selected finding instead of retaining the first finding", () => {
    const input = createReviewInput();
    const result = projectWorksheetReview({
      ...input,
      f4Report: {
        calculations: [{
          ...input.f4Report!.calculations![0]!,
          factors: [
            input.f4Report!.calculations![0]!.factors![0]!,
            {
              ...input.f4Report!.calculations![0]!.factors![0]!,
              factorName: "B stack to datum",
              contribution: 0.24,
              source: { worksheetName: "AJ_GAP", tableId: "table-aj-gap", sourceRow: 24 },
              trace: { formulaIds: ["factor-b-v1"], sourceCells: ["AJ_GAP!J24"] },
            },
          ],
        }],
      },
      f5Report: {
        ...input.f5Report,
        worksheets: [{
          ...input.f5Report!.worksheets![0]!,
          statements: [
            ...input.f5Report!.worksheets![0]!.statements!,
            {
              statementId: "signal-b-stack",
              type: "SIGNAL",
              content: {
                entryId: "signal-b-stack",
                requiresEngineeringReview: true,
                factorSourceRow: 24,
              },
            },
          ],
        }],
      },
    }, { selectedWorksheetName: "AJ_GAP", selectedFindingId: "signal-b-stack" });

    expect(result.selectedFindingId).toBe("signal-b-stack");
    expect(result.evidence).toMatchObject({
      sourceRow: 24,
      sourceCells: ["AJ_GAP!J24"],
      formulaIds: ["cpk-v1"],
    });
  });

  it("rejects same-name worksheet artifacts from a different review context", () => {
    const input = createReviewInput();
    const result = projectWorksheetReview({
      ...input,
      snapshot: {
        ...input.snapshot,
        artifactRefs: input.snapshot.artifactRefs!.map((artifact) => ({
          ...artifact,
          reviewContextId: artifact.kind === "f5_report" ? "context-rerun-b" : "context-rerun-a",
          workbookContentHash: "c".repeat(64),
          selectionHash: "d".repeat(64),
        })),
      },
    }, { selectedWorksheetName: "AJ_GAP" });

    expect(result.findings).toEqual([]);
    expect(result.evidence).toBeUndefined();
  });

  it("rejects review artifacts that omit the required review context id", () => {
    const input = createReviewInput();
    const result = projectWorksheetReview({
      ...input,
      snapshot: {
        ...input.snapshot,
        artifactRefs: input.snapshot.artifactRefs!.map((artifact) => {
          const withoutContext = { ...artifact };
          delete (withoutContext as { reviewContextId?: string }).reviewContextId;
          return withoutContext;
        }),
      },
    }, { selectedWorksheetName: "AJ_GAP" });

    expect(result.findings).toEqual([]);
    expect(result.evidence).toBeUndefined();
  });

  it("rejects a review context without every required current artifact", () => {
    const input = createReviewInput();
    const result = projectWorksheetReview({
      ...input,
      snapshot: {
        ...input.snapshot,
        artifactRefs: input.snapshot.artifactRefs!.filter((artifact) => artifact.kind !== "f5_report").map((artifact) => ({
          ...artifact,
          reviewContextId: "context-rerun-a",
        })),
      },
    }, { selectedWorksheetName: "AJ_GAP" });

    expect(result.findings).toEqual([]);
    expect(result.evidence).toBeUndefined();
  });

  it("uses only the complete active-revision context when the worksheet is rerun", () => {
    const input = createReviewInput();
    const currentContext = "context-rerun-current";
    const result = projectWorksheetReview({
      ...input,
      snapshot: {
        ...input.snapshot,
        artifactRefs: [
          ...input.snapshot.artifactRefs!.map((artifact) => ({
            ...artifact,
            reviewContextId: "context-rerun-stale",
            revision: 3,
          })),
          ...input.snapshot.artifactRefs!.map((artifact) => ({
            ...artifact,
            artifactId: `${artifact.artifactId}-current`,
            reviewContextId: currentContext,
            revision: 4,
          })),
        ],
      },
    }, { selectedWorksheetName: "AJ_GAP" });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.evidence.imageArtifactId).toBe("img-aj-gap-current");
    expect(result.report?.artifactId).toBe("f6-report-aj-gap-current");
  });

  it("rejects same-context reports whose worksheet table identity is mixed", () => {
    const input = createReviewInput();
    const result = projectWorksheetReview({
      ...input,
      f6Report: {
        worksheets: [{
          ...input.f6Report!.worksheets![0]!,
          baselineIdentity: { worksheetName: "AJ_GAP", tableId: "table-from-another-run" },
        }],
      },
    }, { selectedWorksheetName: "AJ_GAP" });

    expect(result.findings).toEqual([]);
    expect(result.worksheets[0]?.status).toBe("evidence_mismatch");
  });
});

function createReviewInput() {
  return {
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
        { artifactId: "img-aj-gap", kind: "f1_image", revision: 4, validated: true, reviewContextId: "context-review-1" },
        { artifactId: "f4-report-aj-gap", kind: "f4_calculation", revision: 4, validated: true, reviewContextId: "context-review-1" },
        { artifactId: "f5-report-aj-gap", kind: "f5_report", revision: 4, validated: true, reviewContextId: "context-review-1" },
        { artifactId: "f6-report-aj-gap", kind: "f6_report", revision: 4, validated: true, reviewContextId: "context-review-1" },
      ],
    },
    f4Report: {
      calculations: [{
        worksheetSelection: { worksheetName: "AJ_GAP", tableId: "table-aj-gap" },
        capability: { cpk: 1.02, status: "FAIL" },
        traceRecords: [{ outputField: "capability.cpk", formulaId: "cpk-v1" }],
        factors: [{
          factorName: "AJ center to C-bucket",
          contribution: 0.62,
          source: { worksheetName: "AJ_GAP", tableId: "table-aj-gap", sourceRow: 15 },
          trace: { formulaIds: ["factor-mean-v1"], sourceCells: ["AJ_GAP!J15", "AJ_GAP!K15", "AJ_GAP!L15"] },
        }],
      }],
    },
    f5Report: {
      worksheets: [{
        worksheetName: "AJ_GAP",
        tableId: "table-aj-gap",
        statements: [{
          statementId: "signal-major-contribution",
          type: "SIGNAL",
          content: { entryId: "signal-major-contribution", requiresEngineeringReview: true },
        }],
      }],
    },
    f6Report: { worksheets: [{ worksheetName: "AJ_GAP", baselineIdentity: { worksheetName: "AJ_GAP", tableId: "table-aj-gap" }, options: [] }] },
  };
}