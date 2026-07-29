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

  it("emits a contributor concentration signal and its related improvement option", () => {
    const result = createRules().evaluateInterpretationRules(cpkRequest);

    expect(result.matchedRules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entryId: "root-cause-contributor-concentration",
        entryType: "root-cause-signal",
        relatedFactReferences: ["contributors", "contributors:dimension-a"],
      }),
      expect.objectContaining({
        entryId: "improvement-reduce-contributor",
        entryType: "improvement-option",
        relatedFactReferences: ["contributors", "contributors:dimension-a"],
      }),
    ]));
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

  it("returns insufficient facts when a related signal lacks contributor facts", () => {
    const result = createRules().evaluateInterpretationRules({
      ...cpkRequest,
      facts: {
        cpk: 1.21,
        targetCpk: cpkRequest.facts.targetCpk,
      },
    });

    expect(result).toMatchObject({
      status: "insufficient-facts",
      matchedRules: [],
      missingFacts: ["contributors"],
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
    signal.relatedEntryIds = [performance.entryId, "metric-cpk"];
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
  it("loads only the strict reviewed v1 request", () => {
    const rules = loadInterpretationRules({ version: "interpretation-rules-v1" });
    const result = rules.evaluateInterpretationRules(cpkRequest);
    expect(result.knowledgeBaseVersion).toBe("interpretation-rules-v1");
    expect(result.matchedRules.map(({ entryType, evidence }) => ({ entryType, evidence }))).toEqual([
      {
        entryType: "performance-rule",
        evidence: {
          sourceAlias: "ta-interpretation-rules-v4-2",
          sourceFileHash: "e3e1954233e94c058088c5084b9a27a7847efc74fbf8a26f51584c40ca4f9fa5",
          sheetName: "02_Performance_Rules",
          sourceRange: "A1:H6",
        },
      },
      {
        entryType: "root-cause-signal",
        evidence: {
          sourceAlias: "ta-interpretation-rules-v4-2",
          sourceFileHash: "e3e1954233e94c058088c5084b9a27a7847efc74fbf8a26f51584c40ca4f9fa5",
          sheetName: "03_Root_Cause_Library",
          sourceRange: "A1:H12",
        },
      },
      {
        entryType: "improvement-option",
        evidence: {
          sourceAlias: "ta-interpretation-rules-v4-2",
          sourceFileHash: "e3e1954233e94c058088c5084b9a27a7847efc74fbf8a26f51584c40ca4f9fa5",
          sheetName: "04_Improvement_Proposals",
          sourceRange: "A1:M9",
        },
      },
    ]);

    for (const request of [
      { version: "interpretation-rules-v2" },
      { version: "interpretation-rules-v1", unexpected: true },
      {},
    ]) {
      expect(captureTypedError(() => loadInterpretationRules(request)).typedError).toMatchObject({
        code: "validation_error",
        summary: "Interpretation rule load request is invalid.",
      });
    }
  });
});