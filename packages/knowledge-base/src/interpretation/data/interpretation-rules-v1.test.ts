import { describe, expect, it } from "vitest";
import { contentHash } from "../../validation.js";
import { createInterpretationKnowledgeSnapshot } from "../validation.js";
import { createReviewedInterpretationRulesV1SeedPackage } from "./interpretation-rules-v1.js";

const SOURCE = {
  sourceAlias: "ta-interpretation-rules-v4-2",
  sourceFileHash: "e3e1954233e94c058088c5084b9a27a7847efc74fbf8a26f51584c40ca4f9fa5",
  sourceVersion: "4.2",
};
const ENTRY_IDS = [
  "metric-cpk",
  "performance-cpk",
  "root-cause-contributor-concentration",
  "improvement-reduce-contributor",
  "decision-escalate",
  "performance-cpk-below-target",
] as const;
const PROVENANCE = {
  "metric-cpk": ["01_Metric_Definitions", "A3:H3"],
  "performance-cpk": ["02_Performance_Rules", "A2:H4"],
  "performance-cpk-below-target": ["02_Performance_Rules", "A2:H4"],
  "root-cause-contributor-concentration": ["03_Root_Cause_Library", "A4:H4"],
  "improvement-reduce-contributor": ["04_Improvement_Proposals", "A4:M4"],
  "decision-escalate": ["05_F5_F6_Decision_Logic", "A2:E2"],
} as const;
const EXCLUDED_SHEETS = [
  "06_Worked_Examples",
  "07_Dynamic_Calculator",
  "09_Fallback_Calculator",
  "10_Example_TA_Interpretation",
];

describe("reviewed interpretation-rules-v1 production snapshot", () => {
  it("publishes the fixed reviewed subset with all five entry types", () => {
    const seed = createReviewedInterpretationRulesV1SeedPackage();
    const ids = seed.entries.map(({ entryId }) => entryId);

    expect(ids).toEqual(ENTRY_IDS);
    expect(new Set(ids).size).toBe(ids.length);
    expect(seed.manifest).toMatchObject({
      sourceCount: 1,
      entryCount: 6,
      entryTypeCounts: {
        "metric-definition": 1,
        "performance-rule": 2,
        "root-cause-signal": 1,
        "improvement-option": 1,
        "decision-policy": 1,
      },
    });
    expect(new Set(seed.entries.map(({ entryType }) => entryType))).toEqual(new Set([
      "metric-definition",
      "performance-rule",
      "root-cause-signal",
      "improvement-option",
      "decision-policy",
    ]));
  });

  it("uses the reviewed workbook identity and exact publishable source rows", () => {
    const seed = createReviewedInterpretationRulesV1SeedPackage();

    expect(seed.sources).toEqual([expect.objectContaining(SOURCE)]);
    for (const entry of seed.entries) {
      expect(entry.provenance).toMatchObject(SOURCE);
      expect([entry.provenance.sheetName, entry.provenance.sourceRange]).toEqual(PROVENANCE[entry.entryId]);
      expect(EXCLUDED_SHEETS).not.toContain(entry.provenance.sheetName);
    }
  });

  it("contains only generalized executable guidance from the reviewed rows", () => {
    const seed = createReviewedInterpretationRulesV1SeedPackage();
    const serialized = JSON.stringify(seed);

    expect(serialized).not.toMatch(/project|part|worked example|workbook example|Example_TA|M1160113|0\.135|0\.185|shim group|https?:\/\//i);
    expect(serialized).not.toMatch(/\.xlsx?|TA_Agent_Knowledge_Base/i);
    expect(serialized).not.toMatch(/"(?:rank|recommendation|priority)"\s*:/i);
    expect(serialized).not.toMatch(/\bP1\b/);
    expect(serialized).not.toMatch(/(?:target|threshold)[^\n]{0,40}1\.00|1\.00[^\n]{0,40}(?:target|threshold)/i);

    const performanceRules = seed.entries.filter((entry) => entry.entryType === "performance-rule");
    expect(performanceRules).toHaveLength(2);
    expect(performanceRules.every((entry) => entry.metric === "cpk" && entry.targetSource === "resolved-target")).toBe(true);
    expect(seed.entries.some((entry) => entry.entryId.includes("sigma"))).toBe(false);

    const root = seed.entries.find(({ entryId }) => entryId === "root-cause-contributor-concentration")!;
    expect(root).toMatchObject({
      entryType: "root-cause-signal",
      activationCondition: { kind: "maximum-contribution-at-least", thresholdPercent: 30 },
    });
    const option = seed.entries.find(({ entryId }) => entryId === "improvement-reduce-contributor")!;
    expect(option).not.toHaveProperty("rank");
  });

  it("publishes a complete Cpk-to-option chain with valid relations", () => {
    const seed = createReviewedInterpretationRulesV1SeedPackage();
    const ids = new Set(seed.entries.map(({ entryId }) => entryId));

    expect(seed.entries.find(({ entryId }) => entryId === "performance-cpk-below-target")?.relatedEntryIds)
      .toEqual(["metric-cpk"]);
    expect(seed.entries.find(({ entryId }) => entryId === "root-cause-contributor-concentration")?.relatedEntryIds)
      .toEqual(["performance-cpk-below-target", "metric-cpk"]);
    expect(seed.entries.find(({ entryId }) => entryId === "improvement-reduce-contributor")?.relatedEntryIds)
      .toEqual(["root-cause-contributor-concentration"]);
    expect(seed.entries.flatMap(({ relatedEntryIds }) => relatedEntryIds).every((id) => ids.has(id))).toBe(true);
    expect(() => createInterpretationKnowledgeSnapshot(seed)).not.toThrow();
  });

  it("matches fixed release counts and content hashes", () => {
    const seed = createReviewedInterpretationRulesV1SeedPackage();

    expect(seed.manifest.sourcesHash).toBe(contentHash(seed.sources));
    expect(seed.manifest.entriesHash).toBe(contentHash(seed.entries));
    expect(seed.manifest.contentHash).toBe(contentHash({
      version: seed.manifest.version,
      sourcesHash: seed.manifest.sourcesHash,
      entriesHash: seed.manifest.entriesHash,
    }));
    expect(seed.manifest).toMatchObject({
      sourcesHash: "a32bd4cf0dc80a97a212b0419fa3a2a7c2ae3522e7567fba238414f0dc5ef3b9",
      entriesHash: "de2b1cb2e4bee1b609c91edba891c1973982e7f41b6fa7eb00ab95eacfe46a52",
      contentHash: "77346326e3015fbcc04485a2ccec916b4bdc0da73305cce80d4e93e1811f7351",
    });
  });
});