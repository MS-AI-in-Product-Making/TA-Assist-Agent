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

  it("sorts matched rules deterministically and keeps provenance-backed evidence", () => {
    const result = createRules().evaluateInterpretationRules(cpkRequest);
    const entryIds = result.matchedRules.map(({ entryId }) => entryId);

    expect(entryIds).toEqual([...entryIds].sort());
    expect(result.matchedRules.every(({ evidence }) => (
      evidence.sourceAlias === "capability-handbook"
      && evidence.sourceFileHash === "a".repeat(64)
      && evidence.sheetName === "Rules"
      && evidence.sourceRange === "A2:H20"
    ))).toBe(true);
  });
});

describe("interpretation rule loading", () => {
  it("loads only the strict reviewed v1 request", () => {
    const rules = loadInterpretationRules({ version: "interpretation-rules-v1" });
    expect(rules.evaluateInterpretationRules(cpkRequest).knowledgeBaseVersion)
      .toBe("interpretation-rules-v1");

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