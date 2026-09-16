# F7 Process Requirements V3 Priority Guidance Design

## Goal

Update the F7 `TA Process and Requirements` interpretation to use the governed
P0-P3 content published by `process-requirements-v3`. Users explicitly classify
confirmed Factors with controlled component categories; F7 then displays the
V3 priority recommendation, its mandatory Microsoft ME/DM alignment, and the
four governed priority definitions.

## Decisions

- Add an optional controlled `componentCategory` to Factor setup confirmation
  and confirmed Factor evidence.
- Treat the category as an explicit user classification. Do not infer it from
  Factor names, part names, worksheet text, or other free text.
- Do not add the category to Factor candidate or Factor identity hashes.
- Preserve compatibility with existing workbooks, snapshots, API requests, and
  sessions that have no category.
- Aggregate unique confirmed categories in stable order and pass them to the
  existing `process-requirements-v3` evaluator.
- Display the evaluator's highest-criticality recommendation using the existing
  governed order `P0 > P1 > P2 > P3`.
- Always state that final priority requires Microsoft ME/DM alignment.
- Keep P0-P3 definitions separate from the ordered process-guidance actions.
- Keep Web and generated PDF interpretation content aligned.

## Data Flow

1. `FactorInputTable` presents a controlled category selector for each Factor.
2. Factor setup confirmation carries the optional category to the local API.
3. `confirmF7FactorSetup` preserves it in confirmed evidence without changing
   `factorCandidateId` or `factorId`.
4. `buildF0ProcessGuidance` gathers unique confirmed categories and evaluates
   exact `process-requirements-v3` facts.
5. The projection returns ordinary guidance entries, four priority definitions,
   and an optional priority recommendation.
6. `TAResultsInterpretation` renders the recommendation and definitions and
   includes the same governed content in the PDF request.

## User Interface

- Add a `Component category` select control to Factor Setup.
- Use plain-language labels for the twelve controlled enum values.
- Permit an unclassified state so older and incomplete sessions remain valid.
- In `TA Process and Requirements`, show a compact `Recommended priority P#`
  summary only when at least one category is present.
- Show the ME/DM alignment requirement next to the recommendation.
- Show P0-P3 definitions as a compact reference list below the recommendation
  and before the existing ordered guidance actions.
- Continue using text and structure, not color alone, for warning or priority
  meaning.

## Error Handling

- Existing manifest, evaluation, and entry-provenance version checks remain
  fail-closed.
- Invalid categories fail strict contract validation.
- A missing category produces no recommendation and is not an error.
- A missing or malformed V3 definition makes the complete process-guidance
  projection unavailable rather than mixing versions.
- PDF fields are optional at the route boundary for backward compatibility, but
  current F7 requests include the same projection shown on screen.

## Testing

- Contract tests cover valid, invalid, and absent Factor categories.
- Adapter tests prove category preservation and stable Factor identity.
- Factor table tests cover selector labels, editing, and confirmation payloads.
- Guidance tests cover category aggregation, P0-P3 precedence, definitions,
  no-category behavior, and mixed-version failure.
- Component and PDF tests cover visible recommendation, ME/DM alignment,
  definitions, request parity, and backward-compatible payloads.
- Focused F7 unit, integration, build, and browser checks run after implementation.

## Scope

This change updates the F7 consumer only. It reuses the existing V3 contracts,
knowledge snapshot, evaluator, priority ordering, and provenance. It does not
change F0/F6 behavior or infer component categories from workbook content.