# F0 TA Process and Requirements V2 Design

**Date:** 2026-09-16

## Goal

Publish a new governed `process-requirements-v2` knowledge snapshot that adds the reviewed
small-stack Worst Case guidance and expands the existing complex-stack escalation with the
reviewed 3D Variation Analysis software guidance.

The update informs engineering analysis. It does not automatically select Worst Case or 3D
analysis, change tolerance calculations, or replace Dimensional Management review.

## Source and Provenance

The added guidance is reviewed evidence from the existing controlled `TA Process and
Requirements` source. Both stack-size rules use the existing `B19:R19` source range and retain
the registered source alias, revision, classification, owner, and source hash. No new source path,
document content, or unsupported provenance is introduced.

## Versioning

The existing `process-requirements-v1` snapshot remains immutable. A new
`process-requirements-v2` snapshot carries the updated entries. F0 capability validation and F7
process-guidance integration move to the exact v2 version and continue to fail closed on missing,
invalid, or mismatched knowledge.

## Knowledge Model

Extend process-requirement applicability with an optional
`maximumToleranceCountExclusive` integer predicate. It uses the existing `toleranceCount` fact and
matches only when the count is strictly below the configured threshold.

Add one reviewed instruction:

- Entry ID: `instruction-consider-worst-case-small-stack`
- Topic: `analysis-method`
- Type: `instruction`
- Normative strength: `should`
- Condition: `toleranceCount < 4`
- Title: `Consider Worst Case for small stacks`
- Message: `Consider Worst Case values when the tolerance stack contains fewer than 4 factors.`

Update the existing `method-escalation-complex-stack` message so that a one-dimensional stack with
more than 10 tolerances continues to require consultation with Dimensional Management and also
advises considering 3D Variation Analysis software. Its type remains `escalation`, its normative
strength remains `must`, and its condition remains `toleranceCount > 10` with the
`one-dimensional-rss` analysis method.

If both minimum and maximum tolerance-count predicates are present on one entry, validation rejects
an empty or impossible interval. This release does not require such a compound range.

## Evaluation and F7 Presentation

The F0 evaluator owns both threshold comparisons. Downstream applications pass supported facts and
must not duplicate the numeric thresholds or controlled messages.

F7 continues to pass:

- `actor: "all"`;
- `analysisMethod: "one-dimensional-rss"`;
- `toleranceCount` from the selected worksheet Factor count;
- `requirementGapPresent` only when a governed capability result is available.

The small-stack entry appears as ordinary guidance and never receives a Warning label solely because
its condition matches. The complex-stack escalation receives a Warning label only when its
`> 10` condition matches. Existing requirement-gap warning behavior remains unchanged.

## Boundary Behavior

| Factor count | Worst Case guidance | 3D escalation warning |
| ---: | :---: | :---: |
| 3 | Yes | No |
| 4 | No | No |
| 10 | No | No |
| 11 | No | Yes |

Unknown or absent tolerance count activates neither conditional rule and is reported through the
existing missing-fact evidence behavior. Invalid negative or non-integer counts remain rejected by
the request schema.

## Validation and Failure Behavior

- Contract parsing accepts `maximumToleranceCountExclusive` only as a non-negative integer.
- Snapshot validation includes the new predicate in deterministic content hashing.
- Unsupported knowledge versions and manifest mismatches fail closed.
- F7 does not synthesize fallback guidance if loading or evaluation fails.
- Existing v1 behavior remains reproducible for callers explicitly loading v1.

## Testing

1. Contract tests accept the new maximum predicate and reject negative, fractional, and unknown
   values.
2. Knowledge query tests prove the 3/4 and 10/11 boundaries and missing-fact behavior.
3. Seed and validation tests prove v2 identity, entry content, counts, hashes, and provenance.
4. F0 workflow-runner tests require the exact v2 version.
5. F7 builder tests prove small-stack guidance is normal guidance and complex-stack matches are
   warnings without local threshold duplication.
6. F7 component tests verify controlled titles/messages and Warning presentation remain readable.
7. Run focused tests first, then package type checks, builds, and relevant lint checks.

## Acceptance Criteria

1. Fewer than 4 Factors produces the reviewed Worst Case recommendation as normal guidance.
2. Exactly 4 Factors does not match the small-stack rule.
3. More than 10 Factors preserves the Dimensional Management escalation and includes the reviewed
   3D Variation Analysis software recommendation.
4. Exactly 10 Factors does not activate the complex-stack warning.
5. F0 remains the sole owner of thresholds, wording, applicability, version, and provenance.
6. Existing calculations and PASS/FAIL decisions are unchanged.