import { describe, expect, it } from "vitest";
import {
  interpretationRuleEvaluationSchema,
  typedErrorSchema,
} from "@ai-assist/contracts";
import {
  createInterpretationKnowledgeSnapshot,
  createInterpretationRules,
  loadInterpretationRules,
} from "../index.js";
import {
  createValidInterpretationKnowledgeSeedPackage,
  refreshInterpretationKnowledgeManifest,
} from "./test-support.js";
import { createReviewedInterpretationRulesV2SeedPackage } from "./data/interpretation-rules-v2.js";
import { contentHash } from "../validation.js";

const cpkRequest = {
  analysisDimension: "one-dimensional",
  method: "rss",
  facts: {
    cpk: 1.21,
    targetCpk: { value: 1.33, source: "project" },
    contributors: [{ reference: "dimension-a", contributionPercent: 62 }],
  },
} as const;

function createRules() {
  return createInterpretationRules(
    createInterpretationKnowledgeSnapshot(createValidInterpretationKnowledgeSeedPackage()),
  );
}

function captureTypedError(invoke: () => unknown) {
  try {
    invoke();
  } catch (error) {
    const parsed = typedErrorSchema.safeParse(error);
    expect(parsed.success).toBe(true);
    if (parsed.success) return { error, typedError: parsed.data };
  }
  throw new Error("expected a typed error");
}

describe("interpretation rule evaluation", () => {
  it("uses the request CPK target and never substitutes a controlled default", () => {
    const result = createRules().evaluateInterpretationRules(cpkRequest);

    expect(result.resolvedTargets).toEqual({
      cpk: { value: 1.33, source: "project" },
    });
    expect(result.factsUsed).toContain("targetCpk");
    expect(JSON.stringify(result)).not.toContain("1.00");
  });

  it("matches below-target and exact-equality CPK rules", () => {
    const rules = createRules();
    const below = rules.evaluateInterpretationRules(cpkRequest);
    const equal = rules.evaluateInterpretationRules({
      ...cpkRequest,
      facts: { ...cpkRequest.facts, cpk: 1.33 },
    });

    expect(below.matchedRules.map(({ entryId }) => entryId)).toContain("performance-cpk-below-target");
    expect(equal.matchedRules.map(({ entryId }) => entryId)).toContain("performance-cpk");
    expect(equal.matchedRules.map(({ entryId }) => entryId)).not.toContain("performance-cpk-below-target");
  });

  it("copies controlled version and applicability metadata from each matched entry", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    const matchedEntry = seed.entries.find(({ entryId }) => entryId === "performance-cpk-below-target")!;
    matchedEntry.applicability = { analysisDimension: "one-dimensional", method: "rss" };
    refreshInterpretationKnowledgeManifest(seed);

    const result = createInterpretationRules(
      createInterpretationKnowledgeSnapshot(seed),
    ).evaluateInterpretationRules(cpkRequest);
    const matched = result.matchedRules.find(({ entryId }) => entryId === matchedEntry.entryId);

    expect(matched).toMatchObject({
      effectiveVersion: matchedEntry.provenance.effectiveVersion,
      applicability: matchedEntry.applicability,
      evidence: matchedEntry.provenance,
    });
    expect(matched?.applicability).not.toBe(matchedEntry.applicability);
    expect(matched?.evidence).not.toBe(matchedEntry.provenance);
  });

  it("does not activate below-target guidance for equality with contributors", () => {
    const result = createRules().evaluateInterpretationRules({
      ...cpkRequest,
      facts: { ...cpkRequest.facts, cpk: 1.33 },
    });

    expect(result.status).toBe("matched");
    expect(result.matchedRules.map(({ entryId }) => entryId)).toEqual(["performance-cpk"]);
  });

  it("keeps equality matched when contributors are absent", () => {
    const result = createRules().evaluateInterpretationRules({
      ...cpkRequest,
      facts: {
        cpk: 1.33,
        targetCpk: cpkRequest.facts.targetCpk,
      },
    });

    expect(result).toMatchObject({
      status: "matched",
      matchedRules: [expect.objectContaining({ entryId: "performance-cpk" })],
      missingFacts: [],
    });
  });

  it("evaluates achieved sigma against its resolved target", () => {
    const result = createRules().evaluateInterpretationRules({
      analysisDimension: "one-dimensional",
      method: "rss",
      facts: {
        achievedSigma: 4.5,
        targetSigma: { value: 4.5, source: "template" },
        contributors: [{ reference: "dimension-b", contributionPercent: 55 }],
      },
    });

    expect(result).toMatchObject({
      status: "matched",
      resolvedTargets: { sigma: { value: 4.5, source: "template" } },
    });
    expect(result.matchedRules.map(({ entryId }) => entryId)).toContain("performance-sigma-meets-target");
  });

  it("emits contributor guidance without exposing the controlled contributor reference", () => {
    const marker = "sensitive-contributor-reference";
    const result = createRules().evaluateInterpretationRules({
      ...cpkRequest,
      facts: {
        ...cpkRequest.facts,
        contributors: [{ reference: marker, contributionPercent: 62 }],
      },
    });

    expect(result.matchedRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entryId: "root-cause-contributor-concentration",
        entryType: "root-cause-signal",
        relatedFactReferences: ["contributors"],
      }),
      expect.objectContaining({
        entryId: "improvement-reduce-contributor",
        entryType: "improvement-option",
        relatedFactReferences: ["contributors"],
      }),
    ]));
    expect(JSON.stringify(result)).not.toContain(marker);
  });

  it("requires all signal and option dependencies to match", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    const belowRule = seed.entries.find(({ entryId }) => entryId === "performance-cpk-below-target")!;
    const secondPerformance = structuredClone(belowRule);
    secondPerformance.entryId = "performance-cpk-below-target-secondary";
    secondPerformance.comparison = "less-than";
    const firstSignal = seed.entries.find(({ entryId }) => entryId === "root-cause-contributor-concentration")!;
    firstSignal.relatedEntryIds = [belowRule.entryId, secondPerformance.entryId];
    const secondSignal = structuredClone(firstSignal);
    secondSignal.entryId = "root-cause-contributor-secondary";
    secondSignal.activationCondition.thresholdPercent = 70;
    const option = seed.entries.find(({ entryId }) => entryId === "improvement-reduce-contributor")!;
    option.relatedEntryIds = [firstSignal.entryId, secondSignal.entryId];
    seed.entries.push(secondPerformance, secondSignal);
    refreshInterpretationKnowledgeManifest(seed);
    const rules = createInterpretationRules(createInterpretationKnowledgeSnapshot(seed));

    const oneSignal = rules.evaluateInterpretationRules(cpkRequest);
    expect(oneSignal.matchedRules.map(({ entryId }) => entryId)).toContain(firstSignal.entryId);
    expect(oneSignal.matchedRules.map(({ entryId }) => entryId)).not.toContain(secondSignal.entryId);
    expect(oneSignal.matchedRules.map(({ entryId }) => entryId)).not.toContain(option.entryId);

    const bothSignals = rules.evaluateInterpretationRules({
      ...cpkRequest,
      facts: {
        ...cpkRequest.facts,
        contributors: [{ reference: "dimension-a", contributionPercent: 70 }],
      },
    });
    expect(bothSignals.matchedRules.map(({ entryId }) => entryId)).toEqual(expect.arrayContaining([
      belowRule.entryId,
      secondPerformance.entryId,
      firstSignal.entryId,
      secondSignal.entryId,
      option.entryId,
    ]));
  });

  it.each([
    ["empty contributors", []],
    ["zero contribution", [{ reference: "dimension-a", contributionPercent: 0 }]],
    ["below threshold", [{ reference: "dimension-a", contributionPercent: 29.99 }]],
  ])("does not activate contributor guidance for %s", (_description, contributors) => {
    const result = createRules().evaluateInterpretationRules({
      ...cpkRequest,
      facts: { ...cpkRequest.facts, contributors },
    });

    expect(result).toMatchObject({
      status: "matched",
      matchedRules: [expect.objectContaining({ entryId: "performance-cpk-below-target" })],
      missingFacts: [],
    });
    expect(result.matchedRules.map(({ entryType }) => entryType)).toEqual(["performance-rule"]);
  });

  it("activates contributor guidance at the threshold", () => {
    const result = createRules().evaluateInterpretationRules({
      ...cpkRequest,
      facts: {
        ...cpkRequest.facts,
        contributors: [{ reference: "dimension-a", contributionPercent: 30 }],
      },
    });

    expect(result.matchedRules.map(({ entryId }) => entryId)).toEqual([
      "performance-cpk-below-target",
      "root-cause-contributor-concentration",
      "improvement-reduce-contributor",
    ]);
  });

  it("returns insufficient facts and suppresses matches when a target is missing", () => {
    const result = createRules().evaluateInterpretationRules({
      ...cpkRequest,
      facts: {
        cpk: 1.21,
        contributors: cpkRequest.facts.contributors,
      },
    });

    expect(result).toMatchObject({
      status: "insufficient-facts",
      matchedRules: [],
      missingFacts: ["targetCpk"],
    });
  });

  it("keeps the performance match and skips optional signal guidance when contributor facts are absent", () => {
    const result = createRules().evaluateInterpretationRules({
      ...cpkRequest,
      facts: {
        cpk: 1.21,
        targetCpk: cpkRequest.facts.targetCpk,
      },
    });

    expect(result).toMatchObject({
      status: "matched",
      matchedRules: [expect.objectContaining({ entryId: "performance-cpk-below-target" })],
      missingFacts: [],
    });
    expect(result.matchedRules.map(({ entryType }) => entryType)).toEqual(["performance-rule"]);
  });

  it("returns insufficient facts when a present sigma metric lacks its target", () => {
    const result = createRules().evaluateInterpretationRules({
      ...cpkRequest,
      facts: {
        cpk: 1.21,
        targetCpk: cpkRequest.facts.targetCpk,
        achievedSigma: 4.2,
      },
    });

    expect(result).toMatchObject({
      status: "insufficient-facts",
      matchedRules: [],
      missingFacts: ["targetSigma"],
    });
  });

  it("matches a complete Cpk metric when sigma facts are entirely absent", () => {
    const result = createRules().evaluateInterpretationRules({
      ...cpkRequest,
      facts: {
        cpk: 1.21,
        targetCpk: cpkRequest.facts.targetCpk,
      },
    });

    expect(result).toMatchObject({
      status: "matched",
      matchedRules: [expect.objectContaining({ entryId: "performance-cpk-below-target" })],
      missingFacts: [],
    });
  });

  it("returns not applicable when the snapshot does not support the requested method", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    for (const entry of seed.entries) entry.applicability.method = "worst-case";
    refreshInterpretationKnowledgeManifest(seed);
    const rules = createInterpretationRules(createInterpretationKnowledgeSnapshot(seed));

    expect(rules.evaluateInterpretationRules(cpkRequest)).toEqual({
      knowledgeBaseVersion: "interpretation-rules-v1",
      status: "not-applicable",
      resolvedTargets: {},
      factsUsed: [],
      matchedRules: [],
      missingFacts: [],
    });
  });

  it("returns a typed validation error without leaking invalid fact values", () => {
    const marker = "sensitive-fact-value";
    const { error, typedError } = captureTypedError(() => createRules().evaluateInterpretationRules({
      analysisDimension: "one-dimensional",
      method: "rss",
      facts: { cpk: marker },
    }));

    expect(typedError).toMatchObject({
      code: "validation_error",
      summary: "Interpretation rule evaluation request is invalid.",
    });
    expect(JSON.stringify(error)).not.toContain(marker);
  });

  it("returns fresh recursively frozen contract-valid evaluations", () => {
    const rules = createRules();
    const first = rules.evaluateInterpretationRules(cpkRequest);
    const second = rules.evaluateInterpretationRules(cpkRequest);

    expect(interpretationRuleEvaluationSchema.parse(first)).toEqual(first);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.matchedRules).not.toBe(second.matchedRules);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.resolvedTargets)).toBe(true);
    expect(Object.isFrozen(first.matchedRules)).toBe(true);
    expect(Object.isFrozen(first.matchedRules[0]!.evidence)).toBe(true);
    expect(() => Object.assign(first, { status: "not-applicable" })).toThrow(TypeError);
  });

  it("sorts matched rules by evaluation stage and then by entry ID", () => {
    const seed = createValidInterpretationKnowledgeSeedPackage();
    const performance = structuredClone(seed.entries.find(
      ({ entryId }) => entryId === "performance-cpk-below-target",
    )!);
    performance.entryId = "performance-cpk-below-target-secondary";
    const signal = structuredClone(seed.entries.find(
      ({ entryId }) => entryId === "root-cause-contributor-concentration",
    )!);
    signal.entryId = "root-cause-secondary";
    signal.relatedEntryIds = [performance.entryId];
    const option = structuredClone(seed.entries.find(
      ({ entryId }) => entryId === "improvement-reduce-contributor",
    )!);
    option.entryId = "improvement-secondary";
    option.relatedEntryIds = [signal.entryId];
    seed.entries.push(option, signal, performance);
    refreshInterpretationKnowledgeManifest(seed);
    const rules = createInterpretationRules(createInterpretationKnowledgeSnapshot(seed));

    const result = rules.evaluateInterpretationRules(cpkRequest);

    expect(result.matchedRules.map(({ entryType }) => entryType)).toEqual([
      "performance-rule",
      "performance-rule",
      "root-cause-signal",
      "root-cause-signal",
      "improvement-option",
      "improvement-option",
    ]);
    expect(result.matchedRules.map(({ entryId }) => entryId)).toEqual([
      "performance-cpk-below-target",
      "performance-cpk-below-target-secondary",
      "root-cause-contributor-concentration",
      "root-cause-secondary",
      "improvement-reduce-contributor",
      "improvement-secondary",
    ]);
  });
});

describe("interpretation rule loading", () => {
  it("loads the strict reviewed v1 request for historical compatibility", () => {
    const rules = loadInterpretationRules({ version: "interpretation-rules-v1" });
    const result = rules.evaluateInterpretationRules(cpkRequest);
    const commonProvenance = {
      classification: "internal",
      sourceAlias: "ta-interpretation-rules-v4-2",
      sourceFileHash: "e3e1954233e94c058088c5084b9a27a7847efc74fbf8a26f51584c40ca4f9fa5",
      sourceVersion: "4.2",
      owner: "TA knowledge steward",
      confidence: 0.9,
      effectiveVersion: "interpretation-rules-v1",
      changeSummary: "Reviewed TA interpretation guidance from source version 4.2.",
    };
    expect(result.knowledgeBaseVersion).toBe("interpretation-rules-v1");
    expect(result.matchedRules.map(({ entryType, evidence }) => ({ entryType, evidence }))).toEqual([
      {
        entryType: "performance-rule",
        evidence: {
          ...commonProvenance,
          sheetName: "02_Performance_Rules",
          sourceRange: "A2:H4",
        },
      },
      {
        entryType: "root-cause-signal",
        evidence: {
          ...commonProvenance,
          sheetName: "03_Root_Cause_Library",
          sourceRange: "A4:H4",
        },
      },
      {
        entryType: "improvement-option",
        evidence: {
          ...commonProvenance,
          sheetName: "04_Improvement_Proposals",
          sourceRange: "A4:M4",
        },
      },
    ]);

    for (const request of [{ version: "interpretation-rules-v1", unexpected: true }, {}]) {
      expect(captureTypedError(() => loadInterpretationRules(request)).typedError).toMatchObject({
        code: "validation_error",
        summary: "Interpretation rule load request is invalid.",
      });
    }
  });

  it("loads reviewed v2 rules with v2 result and evidence provenance", () => {
    const result = loadInterpretationRules({ version: "interpretation-rules-v2" })
      .evaluateInterpretationRules(cpkRequest);

    expect(result.knowledgeBaseVersion).toBe("interpretation-rules-v2");
    expect(result.matchedRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entryId: "performance-cpk-below-target",
        effectiveVersion: "interpretation-rules-v2",
        evidence: expect.objectContaining({ effectiveVersion: "interpretation-rules-v2" }),
      }),
      expect.objectContaining({
        entryId: "root-cause-contributor-concentration",
        effectiveVersion: "interpretation-rules-v2",
      }),
    ]));
  });

  it("locks the production V2 canonical hashes and user-approved source boundary", () => {
    const seed = createReviewedInterpretationRulesV2SeedPackage();

    expect(seed.sources).toContainEqual(expect.objectContaining({
      sourceAlias: "user-approved-f0-v2-rules-2026-09-08",
      sourceFileHash: "7f17c9c1cedf3d980832ca1f8c0ee3be670eb69f64bd401f41eecfef7839f63d",
    }));
    expect(seed.manifest).toMatchObject({
      sourcesHash: contentHash(seed.sources),
      entriesHash: contentHash(seed.entries),
    });
    expect(seed.manifest.contentHash).toBe(contentHash({
      version: seed.manifest.version,
      sourcesHash: seed.manifest.sourcesHash,
      entriesHash: seed.manifest.entriesHash,
    }));
  });

  it("matches RC01 excessive variation and its controlled option", () => {
    const result = loadInterpretationRules({ version: "interpretation-rules-v2" })
      .evaluateInterpretationRules({
        analysisDimension: "one-dimensional",
        method: "rss",
        facts: {
          cp: 1.1,
          cpk: 1.05,
          targetCpk: { value: 1.33, source: "project" },
        },
      });

    expect(result.matchedRules.map(({ entryId }) => entryId)).toEqual(expect.arrayContaining([
      "root-cause-excessive-variation",
      "improvement-reduce-variation",
    ]));
    expect(result.matchedRules.find(({ entryId }) => entryId === "improvement-reduce-variation"))
      .toMatchObject({
        validationSteps: [
          "Update representative variation evidence.",
          "Rerun the same RSS or Monte Carlo method with unchanged specifications and target.",
          "Confirm Cp and Cpk meet the resolved target using a new representative sample.",
        ],
      });
  });

  it("matches RC02 mean shift only when the process is materially off-center", () => {
    const rules = loadInterpretationRules({ version: "interpretation-rules-v2" });
    const offCenter = rules.evaluateInterpretationRules({
      analysisDimension: "one-dimensional",
      method: "rss",
      facts: {
        cp: 1.5,
        cpk: 1.1,
        targetCpk: { value: 1.33, source: "project" },
        mean: 0.2,
        lowerSpecLimit: -0.5,
        upperSpecLimit: 0.5,
      },
    });
    const centered = rules.evaluateInterpretationRules({
      analysisDimension: "one-dimensional",
      method: "rss",
      facts: {
        cp: 1.5,
        cpk: 1.1,
        targetCpk: { value: 1.33, source: "project" },
        mean: 0,
        lowerSpecLimit: -0.5,
        upperSpecLimit: 0.5,
      },
    });

    expect(offCenter.matchedRules.map(({ entryId }) => entryId)).toEqual(expect.arrayContaining([
      "root-cause-mean-shift",
      "improvement-center-mean",
    ]));
    expect(centered.matchedRules.map(({ entryId }) => entryId)).not.toContain("root-cause-mean-shift");
  });

  it("applies V2 rules to one-dimensional Monte Carlo capability facts", () => {
    const result = loadInterpretationRules({ version: "interpretation-rules-v2" })
      .evaluateInterpretationRules({
        analysisDimension: "one-dimensional",
        method: "monte-carlo",
        facts: {
          cp: 1.1,
          cpk: 0.9,
          targetCpk: { value: 1.33, source: "project" },
          mean: 0.01,
          lowerSpecLimit: -0.1,
          upperSpecLimit: 0.1,
        },
      });

    expect(result.status).toBe("matched");
    expect(result.matchedRules.map(({ entryId }) => entryId)).toEqual(expect.arrayContaining([
      "root-cause-excessive-variation",
      "root-cause-mean-shift",
    ]));
  });

  it("keeps the numerical RC02 tolerance boundary deterministic", () => {
    const evaluate = (gap: number, offset: number) => loadInterpretationRules({ version: "interpretation-rules-v2" })
      .evaluateInterpretationRules({
        analysisDimension: "one-dimensional",
        method: "rss",
        facts: {
          cp: gap,
          cpk: 0,
          targetCpk: { value: 1.33, source: "project" },
          mean: offset,
          lowerSpecLimit: -1,
          upperSpecLimit: 1,
        },
      }).matchedRules.some(({ entryId }) => entryId === "root-cause-mean-shift");

    expect(evaluate(1e-12, 2e-12)).toBe(false);
    expect(evaluate(2e-12, 1e-12)).toBe(false);
    expect(evaluate(2e-12, 2e-12)).toBe(true);
  });

  it("returns RC01, RC02, and RC03 in deterministic order when causes coexist", () => {
    const result = loadInterpretationRules({ version: "interpretation-rules-v2" })
      .evaluateInterpretationRules({
        analysisDimension: "one-dimensional",
        method: "rss",
        facts: {
          cp: 1.1,
          cpk: 0.8,
          targetCpk: { value: 1.33, source: "project" },
          mean: 0.2,
          lowerSpecLimit: -0.5,
          upperSpecLimit: 0.5,
          contributors: [{ reference: "factor-a", contributionPercent: 55 }],
        },
      });

    expect(result.matchedRules.filter(({ entryType }) => entryType === "root-cause-signal")
      .map(({ entryId }) => entryId)).toEqual([
      "root-cause-contributor-concentration",
      "root-cause-excessive-variation",
      "root-cause-mean-shift",
    ]);
  });

  it("keeps user-approved enhanced rules out of V1", () => {
    const result = loadInterpretationRules({ version: "interpretation-rules-v1" })
      .evaluateInterpretationRules({
        analysisDimension: "one-dimensional",
        method: "rss",
        facts: {
          cp: 1.1,
          cpk: 0.8,
          targetCpk: { value: 1.33, source: "project" },
          mean: 0.2,
          lowerSpecLimit: -0.5,
          upperSpecLimit: 0.5,
        },
      });

    expect(result.matchedRules.map(({ entryId }) => entryId)).not.toEqual(expect.arrayContaining([
      "root-cause-excessive-variation",
      "root-cause-mean-shift",
      "improvement-reduce-variation",
      "improvement-center-mean",
    ]));
  });

  it("rejects unknown interpretation rule versions", () => {
    expect(captureTypedError(() => loadInterpretationRules({ version: "interpretation-rules-v3" })).typedError)
      .toMatchObject({
        code: "validation_error",
        summary: "Interpretation rule load request is invalid.",
      });
  });
});