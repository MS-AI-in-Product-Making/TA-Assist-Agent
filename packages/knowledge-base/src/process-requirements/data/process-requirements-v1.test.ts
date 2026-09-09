import { describe, expect, it } from "vitest";
import type {
  ProcessRequirementEntry,
  ProcessRequirementEntryType,
} from "@ai-assist/contracts";
import { contentHash } from "../../validation.js";
import { createProcessRequirementSnapshot } from "../validation.js";
import { createReviewedProcessRequirementsV1SeedPackage } from "./process-requirements-v1.js";

const SOURCE_HASH = "44c8249abca1638af5803e0bddc0de2a468fae64093b3e8f0648862923db8418";
const APPROVED_SOURCE_RANGES = new Set([
  "B7:B9",
  "B12:R12",
  "B16:R16",
  "B19:R19",
  "B22:R22",
  "B25:R33",
  "B36:S37",
  "B39:M40",
  "B45:T47",
  "B54:M55",
]);
const ENTRY_TYPES = [
  "requirement",
  "warning",
  "escalation",
  "milestone",
  "instruction",
  "definition",
] as const satisfies readonly ProcessRequirementEntryType[];
const REQUIRED_RULE_IDS = [
  "method-escalation-complex-stack",
  "method-escalation-three-dimensional-sensitivity",
  "camera-fov-escalation",
  "target-cts-six-sigma",
  "target-ctf-four-sigma",
  "milestone-odm-p0-asr",
  "milestone-odm-p1-asr",
  "milestone-odm-p2-before-tooling",
  "milestone-odm-p3-before-tooling",
  "requirement-post-build-real-part-data",
  "milestone-subsystem-dfm-cts",
  "milestone-subsystem-dfm-ctf",
  "requirement-input-completeness",
  "requirement-output-completeness",
  "requirement-gap-ado-notice",
  "warning-priority-review-alignment",
  "instruction-establish-tolerance-loop",
  "instruction-model-pin-hole-float",
  "instruction-model-position-half-total",
  "instruction-model-profile-half-total",
  "instruction-model-mean-shift",
  "instruction-select-capability-distribution",
  "warning-long-term-multiplier-guidance",
  "instruction-review-model-output",
  "instruction-auto-summary-operations",
  "instruction-required-dimensions-operations",
] as const;
const EXPECTED_SOURCES_HASH = "2f6d38e4bef1dd9362cef295fd17891d8af16bdc1465703e70fbc4163d1cbebd";
const EXPECTED_ENTRIES_HASH = "a9310c07917ce82056a280c1dbb3d93fea39cc2fa6bb377b199450adc5d5abbd";
const EXPECTED_CONTENT_HASH = "256e3387542c2362e80a0450697c41e27fc6dfdbe2962d1872c663b8f44e6421";
const DEFINITION_IDS = [
  "definition-cp",
  "definition-cpk",
  "definition-dimensional-management",
  "definition-rss",
  "definition-sigma-level",
  "definition-standard-deviation",
  "definition-tolerance-analysis",
  "definition-tolerance-loop-path",
  "definition-three-dimensional-variation-analysis",
  "definition-worst-case",
] as const;
const EXPECTED_ENTRY_IDS = [...REQUIRED_RULE_IDS, ...DEFINITION_IDS] as const;

function entryById(entries: readonly ProcessRequirementEntry[], entryId: string): ProcessRequirementEntry {
  const entry = entries.find((candidate) => candidate.entryId === entryId);
  expect(entry, `missing entry ${entryId}`).toBeDefined();
  return entry!;
}

describe("reviewed process-requirements-v1 seed", () => {
  it("publishes the controlled source identity and a valid generated manifest", () => {
    const seed = createReviewedProcessRequirementsV1SeedPackage();

    expect(seed.sources).toEqual([{
      sourceAlias: "controlled-ta-template-beta",
      hash: SOURCE_HASH,
      revision: "Beta",
      sheet: "TA Process and Requirements",
      range: "A1:T59",
      sourceClassification: "confidential",
      releasedClassification: "internal",
      owner: "Dimensional Management",
      reviewedAt: "2026-09-09T00:00:00.000Z",
    }]);
    expect(seed.manifest).toMatchObject({
      version: "process-requirements-v1",
      classification: "internal",
      counts: {
        sources: 1,
        entries: seed.entries.length,
      },
      sourcesHash: EXPECTED_SOURCES_HASH,
      entriesHash: EXPECTED_ENTRIES_HASH,
    });
    expect(seed.manifest.contentHash).toBe(EXPECTED_CONTENT_HASH);
    expect(contentHash(seed.sources)).toBe(EXPECTED_SOURCES_HASH);
    expect(contentHash(seed.entries)).toBe(EXPECTED_ENTRIES_HASH);
    expect(() => createProcessRequirementSnapshot(seed)).not.toThrow();
  });

  it("covers every entry type, required process rule, and exactly ten definitions", () => {
    const seed = createReviewedProcessRequirementsV1SeedPackage();
    const ids = seed.entries.map(({ entryId }) => entryId);
    const definitions = seed.entries.filter(({ entryType }) => entryType === "definition");

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(seed.entries.map(({ entryType }) => entryType))).toEqual(new Set(ENTRY_TYPES));
    expect(ids).toEqual(EXPECTED_ENTRY_IDS);
    expect(definitions.map(({ entryId }) => entryId)).toEqual(DEFINITION_IDS);
    expect(definitions).toHaveLength(10);
    expect(definitions.every((entry) => (
      entry.topic === "terminology"
      && entry.normativeStrength === "informational"
      && Object.keys(entry.applicability).length === 1
      && entry.applicability.requiredFacts.length === 0
    ))).toBe(true);
  });

  it("encodes executable applicability and required facts for reviewed rules", () => {
    const entries = createReviewedProcessRequirementsV1SeedPackage().entries;

    expect(entryById(entries, "method-escalation-complex-stack").applicability).toEqual({
      analysisMethod: "one-dimensional-rss",
      minimumToleranceCountExclusive: 10,
      requiredFacts: ["analysisMethod", "toleranceCount"],
    });
    expect(entryById(entries, "method-escalation-complex-stack").message).toMatch(
      /Dimensional Management.*three-dimensional analysis/i,
    );
    expect(entryById(entries, "method-escalation-three-dimensional-sensitivity").applicability).toEqual({
      analysisMethod: "one-dimensional-rss",
      hasThreeDimensionalSensitivity: true,
      requiredFacts: ["analysisMethod", "hasThreeDimensionalSensitivity"],
    });
    expect(entryById(entries, "method-escalation-three-dimensional-sensitivity").message).toMatch(
      /Dimensional Management.*three-dimensional analysis/i,
    );
    expect(entryById(entries, "camera-fov-escalation").applicability).toEqual({
      analysisMethod: "one-dimensional-rss",
      subject: "camera-fov-clearance",
      requiredFacts: ["analysisMethod", "subject"],
    });
    expect(entryById(entries, "camera-fov-escalation").message).toMatch(
      /Dimensional Management.*three-dimensional analysis/i,
    );
    expect(entryById(entries, "target-cts-six-sigma")).toMatchObject({
      message: "Use a 6-sigma target for CTS characteristics.",
      applicability: { characteristicClass: "cts", requiredFacts: ["characteristicClass"] },
    });
    expect(entryById(entries, "target-ctf-four-sigma")).toMatchObject({
      message: "Use a 4-sigma target for CTF characteristics.",
      applicability: { characteristicClass: "ctf", requiredFacts: ["characteristicClass"] },
    });
    expect(entryById(entries, "milestone-odm-p0-asr").applicability).toEqual({
      actor: "odm",
      priority: "P0",
      lifecycleStage: "asr",
      requiredFacts: ["actor", "priority", "lifecycleStage"],
    });
    expect(entryById(entries, "milestone-odm-p3-before-tooling").applicability).toEqual({
      actor: "odm",
      priority: "P3",
      lifecycleStage: "before-tooling",
      requiredFacts: ["actor", "priority", "lifecycleStage"],
    });
    expect(entryById(entries, "requirement-post-build-real-part-data").applicability).toEqual({
      actor: "odm",
      lifecycleStage: "after-tooling-trial-or-build",
      requiredFacts: ["actor", "lifecycleStage"],
    });
    expect(entryById(entries, "milestone-subsystem-dfm-cts").applicability).toEqual({
      actor: "subsystem-supplier",
      characteristicClass: "cts",
      lifecycleStage: "dfm",
      requiredFacts: ["actor", "characteristicClass", "lifecycleStage"],
    });
    expect(entryById(entries, "milestone-subsystem-dfm-ctf").applicability).toEqual({
      actor: "subsystem-supplier",
      characteristicClass: "ctf",
      lifecycleStage: "dfm",
      requiredFacts: ["actor", "characteristicClass", "lifecycleStage"],
    });
    expect(entryById(entries, "requirement-gap-ado-notice").applicability).toEqual({
      requirementGapPresent: true,
      requiredFacts: ["requirementGapPresent"],
    });
    expect(entryById(entries, "instruction-model-pin-hole-float").applicability).toEqual({
      factorRepresentation: "pin-hole-float",
      requiredFacts: ["factorRepresentation"],
    });
    expect(entryById(entries, "instruction-auto-summary-operations").applicability).toEqual({
      workbookArea: "auto-summary",
      requiredFacts: ["workbookArea"],
    });
    expect(entryById(entries, "instruction-required-dimensions-operations").applicability).toEqual({
      workbookArea: "part-sub-required-dimensions",
      requiredFacts: ["workbookArea"],
    });
  });

  it("uses only approved source subranges with concise normalized messages", () => {
    const entries = createReviewedProcessRequirementsV1SeedPackage().entries;
    const usedRanges = new Set(entries.map(({ provenance }) => provenance.sourceRange));

    expect(usedRanges).toEqual(APPROVED_SOURCE_RANGES);
    for (const entry of entries) {
      expect(APPROVED_SOURCE_RANGES).toContain(entry.provenance.sourceRange);
      expect(entry.provenance).toMatchObject({
        sourceAlias: "controlled-ta-template-beta",
        sourceFileHash: SOURCE_HASH,
        sourceRevision: "Beta",
        sheetName: "TA Process and Requirements",
        effectiveVersion: "process-requirements-v1",
        owner: "Dimensional Management",
        confidence: "reviewed",
      });
      expect(entry.message.length).toBeLessThanOrEqual(180);
      expect(entry.message).not.toMatch(/[\r\n\t]|^\s|\s$| {2,}/);
    }
  });

  it("excludes local identity, recipient, document, filename, and verbatim-source markers", () => {
    const serialized = JSON.stringify(createReviewedProcessRequirementsV1SeedPackage());
    const forbiddenMarkers = [
      "Test_TP_Step",
      "C:\\Users",
      "C:\\\\Users",
      "JDM1",
      "CKM1",
      "FMH1",
      "M1160113",
      "sourceText",
      "rawText",
      "verbatim",
      "More than 10 tolerances or potential 3D geometry sensitivity warns that a 1D linear analysis may be inappropriate",
      "Camera FOV clearance is not evaluated with 1D TA and requires Dimensional Management support",
      "Part/Sub Required Dimensions is generated, refreshed after TA sheet changes, not manually edited",
    ];

    for (const marker of forbiddenMarkers) expect(serialized).not.toContain(marker);
    expect(serialized).not.toMatch(/\.(?:xlsx|xlsm)\b/i);
    expect(serialized).not.toMatch(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/);
    expect(serialized).not.toMatch(/(?:\b[A-Za-z][A-Za-z0-9+.-]*:\/\/|(?:^|[\s"'(=])\/\/)/i);
    expect(serialized).not.toMatch(/(?:[A-Za-z]:[\\/]|\\\\|(?:^|[\s"'(=])\/(?![\s/]))/);
  });
});