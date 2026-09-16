import { describe, expect, it } from "vitest";
import type { ProcessRequirementEntry } from "@ai-assist/contracts";
import { contentHash } from "../../validation.js";
import { createReviewedProcessRequirementsV2SeedPackage } from "../../index.js";
import { createProcessRequirementSnapshot } from "../validation.js";
import { createReviewedProcessRequirementsV1SeedPackage } from "./process-requirements-v1.js";

const SOURCE_HASH = "44c8249abca1638af5803e0bddc0de2a468fae64093b3e8f0648862923db8418";
const EXPECTED_SOURCES_HASH = "469a1e0169212a51fb2194cc6b81feca9b0439e16868f40144b74ea06ae2cae0";
const EXPECTED_ENTRIES_HASH = "915f5692fe0c125811b4e7884a7562c8353afd0d8a8f69f9a6d314d804d9549a";
const EXPECTED_CONTENT_HASH = "fd6dee4527d3f1bab13845a4c81574eeb13441d0bb4ccdc3a7c0233fc4603f8c";

function entryById(entries: readonly ProcessRequirementEntry[], entryId: string): ProcessRequirementEntry {
  const entry = entries.find((candidate) => candidate.entryId === entryId);
  expect(entry, `missing entry ${entryId}`).toBeDefined();
  return entry!;
}

describe("reviewed process-requirements-v2 seed", () => {
  it("publishes the v2 identity, review date, valid manifest, and deterministic hashes", () => {
    const seed = createReviewedProcessRequirementsV2SeedPackage();

    expect(seed.sources).toEqual([{
      sourceAlias: "controlled-ta-template-beta",
      hash: SOURCE_HASH,
      revision: "Beta",
      sheet: "TA Process and Requirements",
      range: "A1:T59",
      sourceClassification: "confidential",
      releasedClassification: "internal",
      owner: "Dimensional Management",
      reviewedAt: "2026-09-16T00:00:00.000Z",
    }]);
    expect(seed.manifest).toEqual({
      version: "process-requirements-v2",
      classification: "internal",
      releasedAt: "2026-09-16T00:00:00.000Z",
      changeSummary: "Add small-stack worst-case guidance and clarify complex-stack escalation.",
      counts: {
        sources: 1,
        entries: 37,
        entryTypes: {
          requirement: 6,
          warning: 2,
          escalation: 3,
          milestone: 6,
          instruction: 10,
          definition: 10,
        },
      },
      sourcesHash: EXPECTED_SOURCES_HASH,
      entriesHash: EXPECTED_ENTRIES_HASH,
      contentHash: EXPECTED_CONTENT_HASH,
    });
    expect(contentHash(seed.sources)).toBe(EXPECTED_SOURCES_HASH);
    expect(contentHash(seed.entries)).toBe(EXPECTED_ENTRIES_HASH);
    expect(() => createProcessRequirementSnapshot(seed)).not.toThrow();
  });

  it("adds small-stack worst-case guidance immediately after the complex-stack entry", () => {
    const entries = createReviewedProcessRequirementsV2SeedPackage().entries;
    const complexIndex = entries.findIndex(({ entryId }) => entryId === "method-escalation-complex-stack");
    const smallStackIndex = entries.findIndex(({ entryId }) => (
      entryId === "instruction-consider-worst-case-small-stack"
    ));

    expect(smallStackIndex).toBe(complexIndex + 1);
    expect(entryById(entries, "instruction-consider-worst-case-small-stack")).toEqual({
      entryId: "instruction-consider-worst-case-small-stack",
      entryType: "instruction",
      topic: "analysis-method",
      title: "Consider Worst Case for small stacks",
      message: "Consider Worst Case values when the tolerance stack contains fewer than 4 factors.",
      normativeStrength: "should",
      applicability: {
        maximumToleranceCountExclusive: 4,
        requiredFacts: ["toleranceCount"],
      },
      relatedEntryIds: [],
      provenance: {
        sourceAlias: "controlled-ta-template-beta",
        sourceFileHash: SOURCE_HASH,
        sourceRevision: "Beta",
        sheetName: "TA Process and Requirements",
        sourceRange: "B19:R19",
        effectiveVersion: "process-requirements-v2",
        owner: "Dimensional Management",
        confidence: "reviewed",
        changeSummary: "Add reviewed worst-case guidance for tolerance stacks with fewer than four factors.",
      },
    });
  });

  it("updates only the reviewed complex-stack message semantics", () => {
    const v1Entry = entryById(
      createReviewedProcessRequirementsV1SeedPackage().entries,
      "method-escalation-complex-stack",
    );
    const v2Entry = entryById(
      createReviewedProcessRequirementsV2SeedPackage().entries,
      "method-escalation-complex-stack",
    );

    expect(v2Entry.message).toBe(
      "Consult Dimensional Management and consider 3D Variation Analysis software when a one-dimensional stack has more than 10 tolerances.",
    );
    expect({ ...v2Entry, message: v1Entry.message, provenance: v1Entry.provenance }).toEqual(v1Entry);
  });

  it("uses v2 provenance for every entry without mutating fresh v1 seeds", () => {
    const before = createReviewedProcessRequirementsV1SeedPackage();
    const v2 = createReviewedProcessRequirementsV2SeedPackage();
    const after = createReviewedProcessRequirementsV1SeedPackage();

    expect(after).toEqual(before);
    expect(v2.sources[0]).not.toBe(before.sources[0]);
    expect(v2.entries[0]).not.toBe(before.entries[0]);
    expect(v2.entries.every(({ provenance }) => (
      provenance.effectiveVersion === "process-requirements-v2"
      && provenance.changeSummary.length > 0
    ))).toBe(true);
  });
});
