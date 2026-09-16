import { describe, expect, it } from "vitest";
import type { ProcessRequirementEntry } from "@ai-assist/contracts";
import { createReviewedProcessRequirementsV3SeedPackage } from "../../index.js";
import { createProcessRequirementSnapshot } from "../validation.js";
import { createReviewedProcessRequirementsV2SeedPackage } from "./process-requirements-v2.js";

const EXPECTED_MAPPINGS = {
  "battery-cts": "P0",
  "z-axis-or-around-xy-clearance": "P0",
  "glass-tdm-gap-or-z-step": "P0",
  "thermal-module-critical-path": "P0",
  "pcb-critical-clearance-or-alignment": "P0",
  "cover-fit-and-function": "P1",
  "hinge-trackpad-button-or-sensor": "P1",
  "cable-routing": "P1",
  "external-port-kickstand-logo-or-ssd": "P2",
  "pcb-component-or-fastener": "P2",
  "engagement-or-assembly-feature": "P2",
  "foam-or-gasket-sealing-cushioning-or-nvh": "P3",
} as const;
const EXPECTED_SOURCES_HASH = "50b45f2e983e18f0ea306b15709d7a8cc9c0069ac96b03092754eadde5f4aab9";
const EXPECTED_ENTRIES_HASH = "fd4db8163ef9fc0b21416701591c6f0f040f464b5218edec48a5d2fa5f770410";
const EXPECTED_CONTENT_HASH = "032b5d788ed31a54820ac408dcd66b737fdf073c9d4dccde180450c3941dff2b";

function recommendationEntries(entries: readonly ProcessRequirementEntry[]) {
  return entries.filter(({ entryId }) => entryId.startsWith("priority-recommendation-"));
}

describe("reviewed process-requirements-v3 seed", () => {
  it("publishes a valid deterministic v3 snapshot with approved-transcription provenance", () => {
    const seed = createReviewedProcessRequirementsV3SeedPackage();
    const transcription = seed.sources.find(({ sourceAlias }) => (
      sourceAlias === "approved-priority-guidance"
    ));

    expect(seed.manifest).toMatchObject({
      version: "process-requirements-v3",
      counts: {
        sources: 2,
        entries: 53,
        entryTypes: { instruction: 22, definition: 14 },
      },
    });
    expect(seed.manifest.sourcesHash).toBe(EXPECTED_SOURCES_HASH);
    expect(seed.manifest.entriesHash).toBe(EXPECTED_ENTRIES_HASH);
    expect(seed.manifest.contentHash).toBe(EXPECTED_CONTENT_HASH);
    expect(transcription).toMatchObject({
      sourceType: "approved-transcription",
      sourceAlias: "approved-priority-guidance",
      revision: "user-approved-2026-09-16",
      section: "priority-definitions",
    });
    expect(() => createProcessRequirementSnapshot(seed)).not.toThrow();
  });

  it("adds four list-only P0-P3 definitions from the approved transcription", () => {
    const definitions = createReviewedProcessRequirementsV3SeedPackage().entries.filter(
      ({ entryId }) => /^definition-priority-p[0-3]-components$/.test(entryId),
    );

    expect(definitions.map(({ entryId }) => entryId)).toEqual([
      "definition-priority-p0-components",
      "definition-priority-p1-components",
      "definition-priority-p2-components",
      "definition-priority-p3-components",
    ]);
    expect(definitions.every(({ entryType, topic, applicability, provenance }) => (
      entryType === "definition"
      && topic === "priority"
      && applicability.requiredFacts.length === 0
      && provenance.effectiveVersion === "process-requirements-v3"
      && provenance.sourceAlias === "approved-priority-guidance"
    ))).toBe(true);
  });

  it("maps every controlled category to one priority and ME/DM alignment", () => {
    const entries = recommendationEntries(createReviewedProcessRequirementsV3SeedPackage().entries);
    const mappings = Object.fromEntries(entries.map((entry) => [
      entry.applicability.componentCategory,
      entry.recommendedPriority,
    ]));

    expect(entries).toHaveLength(12);
    expect(mappings).toEqual(EXPECTED_MAPPINGS);
    expect(entries.every(({ applicability, relatedEntryIds, provenance }) => (
      applicability.requiredFacts.length === 1
      && applicability.requiredFacts[0] === "componentCategories"
      && relatedEntryIds.includes("warning-priority-review-alignment")
      && provenance.sourceAlias === "approved-priority-guidance"
    ))).toBe(true);
  });

  it("does not mutate fresh v2 seeds", () => {
    const before = createReviewedProcessRequirementsV2SeedPackage();
    createReviewedProcessRequirementsV3SeedPackage();
    const after = createReviewedProcessRequirementsV2SeedPackage();

    expect(after).toEqual(before);
  });
});