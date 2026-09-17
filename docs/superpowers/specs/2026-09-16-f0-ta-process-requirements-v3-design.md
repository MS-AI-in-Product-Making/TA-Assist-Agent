# F0 TA Process Requirements v3 Design

## Goal

Publish an immutable `process-requirements-v3` snapshot that adds controlled P0-P3 component definitions and recommends a priority when callers provide explicit structured component categories.

## Decisions

- v3 derives from a fresh deep clone of v2. Versions v1 and v2 remain unchanged and loadable.
- The user-provided priority table is governed as an approved transcription, not attributed to an unverified workbook range.
- Existing workbook provenance remains supported. Transcription provenance uses a content hash and a logical section locator.
- Definitions remain listable reference content. Separate recommendation entries are evaluable.
- Callers provide controlled component categories only. F0 does not infer categories from arbitrary free text.
- A category maps to exactly one priority. If multiple categories match, the recommendation is the highest criticality in `P0 > P1 > P2 > P3` order.
- Every matched recommendation entry and its provenance remain in the evaluation result.
- The selected priority is advisory. Evaluation output explicitly requires final Microsoft ME/DM alignment.
- Missing or empty categories produce no priority recommendation.

## Controlled Categories

P0 covers battery CTS, Z-axis and around-XY clearance, glass/TDM gaps and Z-step, thermal-module critical paths, and PCB critical clearance/alignment.

P1 covers cover fit/function, hinges, trackpads, buttons, sensors, and cable routing.

P2 covers audio jacks, USB ports, kickstands, logos, SSDs, general PCB components, screws, pins, hooks, magnets, and engagement or assembly features.

P3 covers foams and gaskets used for sealing, cushioning, or noise and vibration reduction.

## Contracts

Add `componentCategories` as a non-empty, duplicate-free array of controlled category enums. Applicability entries use one `componentCategory` predicate while evaluation facts may contain several categories.

Add an optional `priorityRecommendation` object to every evaluation result:

```ts
{
  selectedPriority: "P0" | "P1" | "P2" | "P3";
  matchedEntryIds: string[];
  requiresMeDmAlignment: true;
}
```

It is present only when one or more priority recommendation entries match.

## Provenance

Source metadata and entry provenance become discriminated unions:

- `workbook`: preserves the existing sheet and cell-range identity.
- `approved-transcription`: uses a normalized transcription hash and logical section locator.

Validation compares source type, source identity, hash, revision, owner, and locator. It fails closed on mismatches. The transcription itself is represented by released entries; raw attachment bytes and confidential source text are not stored.

## Consumers

F0 defaults migrate to exact v3. F7 also loads exact v3 and retains its manifest/evaluation/all-entry provenance consistency checks. F7 currently has no component-category field, so it receives the new reference definitions but does not request an automatic priority recommendation.

## Testing

- Contract tests cover v3, categories, recommendation output, and both provenance variants.
- Snapshot tests lock deterministic hashes, source identity, v2 immutability, category mappings, and definitions.
- Query tests cover each P0-P3 mapping, multi-match precedence, all evidence retention, absent categories, and exact version dispatch.
- Validation tests reject duplicate categories and mismatched transcription locators.
- F0 and F7 tests enforce exact v3 and mixed-version fail-closed behavior.
