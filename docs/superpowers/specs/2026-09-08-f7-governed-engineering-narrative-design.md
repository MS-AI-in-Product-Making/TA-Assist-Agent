# F7 Governed Engineering Narrative Design

## Goal

Upgrade `TA Results Interpretation (based on Assumptions)` from a rule-title list to a conclusion-first engineering narrative comparable in readability to the previously observed M365 Copilot interpretation, while preserving deterministic, auditable F0 V2 behavior.

The default presentation is the approved **Engineering Narrative** direction. User-facing narrative text remains English to match the existing F7 interface and local report.

## Problem

F7 currently displays capability values, matched root-cause titles, controlled option titles, and validation requirements. The facts and F0 V2 matches are governed, but the reader must assemble their meaning manually. The presentation does not quantify capability shortfall, explain the Cp-to-Cpk loss, identify the nearer specification side, connect a dominant contributor to engineering risk, or organize actions by cause.

M365 Copilot appears richer because it creates a connected engineering explanation. Reproducing that behavior through unrestricted generation would reduce repeatability and traceability. F7 instead needs a deterministic narrative projection over the same governed facts and matched F0 rules.

## Governance Boundary

- F0 remains the only owner of result and root-cause rule activation.
- The narrative layer may explain only facts supplied in its validated input and rules listed as matched by F0.
- It must not infer missing measurements, drawing intent, physical feasibility, causation, or unobserved process behavior.
- Root causes remain hypotheses and retain their rule IDs and provenance.
- Actions remain unranked controlled options. Presentation order is a fixed reading order, not an optimization ranking.
- F6 remains the only owner of quantified scenarios, tolerance proposals, scenario ranking, and final recommendations.
- The narrative layer uses deterministic templates only. It does not invoke an LLM or external service.
- Assumption-based RSS output must be labeled as assumption evidence and must not be described as measured capability.
- ME review and the F0 validation requirements remain visible.

## Shared Architecture

Add a pure narrative builder to `@ai-assist/product-language`. Both F7 Web and the F7 local report call the same builder after F0 evaluation.

The shared module has no dependency on Vue, F7 session state, the knowledge-base loader, or report rendering. Consumers remain responsible for calculation and F0 evaluation, then submit a validated projection containing:

- method and evidence basis;
- `cp`, `cpk`, resolved Target Cpk;
- mean, lower specification limit, and upper specification limit;
- matched root-cause rules with IDs and titles;
- matched controlled options with IDs, titles, and validation steps;
- dominant contributors with stable references and contribution percentages;
- F0 knowledge-base version and provenance.

The builder returns immutable narrative sections and supporting quantitative details. It does not return HTML or Markdown.

## Narrative Output

### Result Judgment

Lead with `Capability meets target` or `Capability is below target`. Include Cpk, Target Cpk, and signed margin `Cpk - Target Cpk`.

When specification and mean facts are available, identify the nearer specification side from the lower and upper mean-to-limit distances. If distances are equal within numerical tolerance, report balanced specification-side exposure. This is geometric proximity, not a predicted failure declaration.

### Root Cause Analysis

Render only matched F0 root-cause hypotheses, in RC01, RC02, RC03 reading order:

- **RC01 Excessive variation:** state Cp and Target Cpk and quantify `Cp - Target Cpk`.
- **RC02 Mean shift:** state `Cp - Cpk`, the specification midpoint, signed mean offset from midpoint, and offset direction toward LSL or USL.
- **RC03 Dominant contributor:** identify the highest contributor and its percentage. Additional contributors remain available as evidence but do not crowd the lead narrative.

Each narrative item carries its rule ID and hypothesis status. A rule title must never be rendered without its quantitative explanation when the required facts are present.

### Engineering Risk

Create a concise risk statement from controlled facts:

- below-target margin identifies capability shortfall;
- mean direction identifies the nearer specification side;
- RC01 indicates variation-related exposure;
- RC02 indicates centering loss;
- RC03 indicates contribution concentration.

The statement must use terms such as `indicates`, `is consistent with`, and `requires validation`. It must not claim a verified physical root cause or release disposition.

### Priority Actions

Display matched controlled options in a fixed explanatory sequence:

1. confirm mean-centering feasibility when RC02 matched;
2. reduce total variation when RC01 matched;
3. investigate the dominant contributor when RC03 matched.

This order follows diagnosis dependencies and is labeled `Suggested action sequence`, not `ranked recommendation`. Each action includes the controlled option ID. No target tolerance or optimized value is generated.

### Verification

Deduplicate and preserve the F0 validation steps attached to matched options. Keep ME review, unchanged specification and target, representative evidence, and rerun requirements explicit.

### Evidence Disclosure

Show:

- `Assumption-based RSS` or the actual evaluated method;
- F0 `interpretation-rules-v2` provenance;
- matched rule IDs;
- an explicit statement that the output is not measured evidence and does not replace ME review or F6 optimization.

## Degraded Behavior

- If the basic Cpk judgment is available but enhanced facts are missing, return the result judgment and omit only dependent quantitative clauses.
- Never substitute zero, nominal, midpoint, or a default specification for a missing fact.
- If a root-cause rule is supplied without the facts required for its explanation, return a controlled incomplete-evidence item instead of constructing a claim.
- If F0 evaluation is unavailable or inconsistent, preserve the existing fail-closed `rules-unavailable` behavior.
- A meets-target result may present stability verification but must not invent root causes or corrective actions.

## F7 Web Presentation

Replace the current equal-weight rule lists with this hierarchy:

1. Result Judgment header with status, Cpk, target, and margin.
2. A short Engineering Summary paragraph.
3. Root Cause Analysis items with numerical evidence.
4. Engineering Risk statement.
5. Suggested Action Sequence.
6. Verification Requirements and Evidence Disclosure.

Keep `Input Readiness` as a separate operational section. Preserve stable responsive dimensions and existing F7 visual language. Do not hide provenance or assumptions in a tooltip or collapsed control.

## Local Report Presentation

The report uses the same shared narrative result and renders the same section order in Markdown. Report JSON records structured narrative fields, rule IDs, provenance, actions, and verification requirements so consumers do not need to parse prose.

## Testing

- Unit-test the shared builder independently with RC01, RC02, RC03, combined causes, meets-target, balanced specification distances, missing enhanced facts, stable ordering, and immutable output.
- Assert exact numerical values separately from formatted text.
- Verify F7 Web renders the approved hierarchy and does not retain unsupported generic rule-title-only output.
- Verify F7 local report JSON and Markdown use the same narrative sections as Web.
- Verify rule IDs, provenance, assumption disclosure, and validation requirements remain present.
- Verify no narrative path emits optimized tolerances, ranked recommendations, release decisions, or claims of measured evidence.
- Run full TypeScript build, focused F0/F7 tests, repository policy checks, F7 Web build, and beta runtime build.

## Acceptance Example

For Cpk `0.92`, Target Cpk `1.33`, Cp `1.18`, mean offset `+0.08 mm` from the specification midpoint, and a dominant contributor of `46%`, with RC01, RC02, and RC03 matched, the presentation must communicate:

- capability is below target by `0.41`;
- variation and centering are distinct coexisting hypotheses;
- the mean direction identifies the nearer specification side;
- the named factor contributes `46%` and requires contributor-evidence validation;
- the suggested sequence addresses centering feasibility, variation, and contributor concentration;
- verification reruns against unchanged specifications and target using representative evidence;
- the result is assumption-based and requires ME review.

The exact prose is controlled by tested templates, but Web and report must carry the same engineering meaning and evidence.