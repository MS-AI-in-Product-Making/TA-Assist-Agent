import { describe, expect, it } from "vitest";
import { contentHash } from "../../validation.js";
import { createInterpretationKnowledgeSnapshot } from "../validation.js";
import { createReviewedInterpretationRulesV1SeedPackage } from "./interpretation-rules-v1.js";

const SOURCE = {
  sourceAlias: "ta-interpretation-rules-v4-2",
};
const ALLOWED_SOURCE_KEYS = new Set([
  "sourceAlias",
  "sourceFileHash",
  "sourceVersion",
  "classification",
  "owner",
]);
const ALLOWED_PROVENANCE_KEYS = new Set([
  ...ALLOWED_SOURCE_KEYS,
  "sheetName",
  "sourceRange",
  "confidence",
  "effectiveVersion",
  "changeSummary",
]);
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
const ALLOWED_PUBLISHED_SHEETS = new Set(Object.values(PROVENANCE).map(([sheetName]) => sheetName));
const FORBIDDEN_SNAPSHOT_PATTERNS = [
  /worked example/i,
  /workbook example/i,
  /example_ta/i,
  /https?:\/\//i,
  /\brank(?:ed|ing)?\b/i,
  /\bP1\b/i,
] as const;
const FORBIDDEN_OBJECT_KEYS = new Set([
  "projectId",
  "projectName",
  "partNumber",
  "sourceFile",
  "sourceUrl",
  "url",
]);
const FORBIDDEN_OPTION_KEYS = new Set(["rank", "recommendation", "priority"]);

function objectKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(objectKeys);
  }
  if (value === null || typeof value !== "object") {
    return [];
  }
  return Object.entries(value).flatMap(([key, child]) => [key, ...objectKeys(child)]);
}

function numericFields(value: unknown): Array<{ key: string; value: number }> {
  if (Array.isArray(value)) {
    return value.flatMap(numericFields);
  }
  if (value === null || typeof value !== "object") {
    return [];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === "number" ? [{ key, value: child }] : numericFields(child));
}

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

    expect(seed.sources).toHaveLength(1);
    expect(seed.sources[0]?.sourceAlias).toBe(SOURCE.sourceAlias);
    expect(Object.keys(seed.sources[0] ?? {}).every((key) => ALLOWED_SOURCE_KEYS.has(key))).toBe(true);
    for (const entry of seed.entries) {
      expect(entry.provenance.sourceAlias).toBe(SOURCE.sourceAlias);
      expect(Object.keys(entry.provenance).every((key) => ALLOWED_PROVENANCE_KEYS.has(key))).toBe(true);
      expect([entry.provenance.sheetName, entry.provenance.sourceRange]).toEqual(PROVENANCE[entry.entryId]);
      expect(ALLOWED_PUBLISHED_SHEETS).toContain(entry.provenance.sheetName);
      expect(EXCLUDED_SHEETS).not.toContain(entry.provenance.sheetName);
    }
  });

  it("contains only generalized executable guidance from the reviewed rows", () => {
    const seed = createReviewedInterpretationRulesV1SeedPackage();
    const serialized = JSON.stringify(seed);

    for (const pattern of FORBIDDEN_SNAPSHOT_PATTERNS) {
      expect(serialized).not.toMatch(pattern);
    }
    expect(objectKeys(seed).filter((key) => FORBIDDEN_OBJECT_KEYS.has(key))).toEqual([]);

    const performanceRules = seed.entries.filter((entry) => entry.entryType === "performance-rule");
    expect(performanceRules).toHaveLength(2);
    expect(performanceRules.every((entry) => entry.metric === "cpk" && entry.targetSource === "resolved-target")).toBe(true);
    expect(performanceRules.flatMap(numericFields).filter(({ key }) => /target/i.test(key))).toEqual([]);
    expect(seed.entries.some((entry) => entry.entryId.includes("sigma"))).toBe(false);
    expect(seed.entries.flatMap(numericFields)
      .filter(({ key, value }) => /default|threshold/i.test(key) && value === 1)).toEqual([]);

    const root = seed.entries.find(({ entryId }) => entryId === "root-cause-contributor-concentration")!;
    expect(root).toMatchObject({
      entryType: "root-cause-signal",
      activationCondition: { kind: "maximum-contribution-at-least", thresholdPercent: 30 },
    });
    const option = seed.entries.find(({ entryId }) => entryId === "improvement-reduce-contributor")!;
    expect(objectKeys(option).filter((key) => FORBIDDEN_OPTION_KEYS.has(key))).toEqual([]);
  });

  it("detects anonymized synthetic leak markers through structural safeguards", () => {
    const syntheticLeakProbe = {
      projectId: "confidential-case-marker",
      sourceFile: "source-workbook-filename-marker",
      nested: { default: 1, note: "case-specific-numeric-marker" },
    };

    expect(objectKeys(syntheticLeakProbe).filter((key) => FORBIDDEN_OBJECT_KEYS.has(key)))
      .toEqual(["projectId", "sourceFile"]);
    expect(numericFields(syntheticLeakProbe)
      .filter(({ key, value }) => /default|threshold/i.test(key) && value === 1))
      .toEqual([{ key: "default", value: 1 }]);
  });

  it("publishes a complete Cpk-to-option chain with valid relations", () => {
    const seed = createReviewedInterpretationRulesV1SeedPackage();
    const ids = new Set(seed.entries.map(({ entryId }) => entryId));

    expect(seed.entries.find(({ entryId }) => entryId === "performance-cpk-below-target")?.relatedEntryIds)
      .toEqual(["metric-cpk"]);
    expect(seed.entries.find(({ entryId }) => entryId === "root-cause-contributor-concentration")?.relatedEntryIds)
      .toEqual(["performance-cpk-below-target"]);
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
      entriesHash: "51ef30b60057c90e78811c6518d0622899038a4f6392cb942ea8b0a5d54eda11",
      contentHash: "5a4e355821b31718a2af34316a259c4cc736a1fad3a2c52575bfaf0a80368c71",
    });
  });
});