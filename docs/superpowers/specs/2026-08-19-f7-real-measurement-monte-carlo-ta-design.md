# F7 Real Measurement Monte Carlo TA Design

**Date:** 2026-08-19
**Status:** Approved for implementation planning
**Initial deployment:** Local single-user Web application

## 1. Purpose

F7 closes the gap between assumption-based tolerance analysis and observed manufacturing behavior. It allows an engineer to select a TA worksheet, provide real measurements for any subset of factors, evaluate process capability and candidate distributions, run a reproducible Monte Carlo simulation, compare the result with the F4 Worst Case and RSS baseline, and receive evidence-governed recommendations.

The first release reads factor definitions directly from a selected Excel worksheet. This is an interim adapter. The statistical and reporting contracts must remain independent of Excel so the source can later be replaced by verified F2, F4, F5, and F6 artifacts.

## 2. Reference Workbook Evidence

The reference workbook `Test_TP_Step_202600805.xlsx` and worksheet `TP_C_Step_TA` provide the initial golden fixture.

The worksheet contains seven active factors:

| Factor | Loop coefficient | Physical baseline mean | Signed contribution mean | Baseline tolerance | Baseline distribution |
|---|---:|---:|---:|---:|---|
| Fabric thickness | -1 | 0.57 | -0.57 | 0.05 | Normal |
| C-cover height | -1 | 1.94 | -1.94 | 0.10 | Normal |
| Shim thickness | +1 | 0.22 | 0.22 | 0.05 | Normal |
| Switch height | +1 | 0.75 | 0.75 | 0.10 | Normal |
| TP PCB thickness | +1 | 0.44 | 0.44 | 0.05 | Normal |
| HAF thickness | +1 | 0.05 | 0.05 | 0.05 | Normal |
| Glass thickness | +1 | 1.00 | 1.00 | 0.05 | Normal |

The Excel baseline stores signed contribution means. Their sum is `-0.05`. The Excel baseline also has RSS sigma `0.0450693909432999`, lower specification limit `-0.15`, upper specification limit `0.05`, and Cpk `0.739600261633636`. The Excel adapter normalizes signed contribution values into physical coordinates exactly once; the simulation then applies the coefficient exactly once. These values are regression evidence, not hardcoded production defaults.

## 3. Scope

### 3.1 In scope

- Local import of an `.xlsx` workbook and explicit TA worksheet selection.
- Confirmation of factor identity, unit, loop coefficient, specifications, and source cells.
- Per-factor selection between real measurement data and the verified Excel/F4 baseline assumption.
- Paste-oriented measurement entry with optional timestamp, sequence, subgroup, and batch metadata.
- Data validation, process stability signals, capability analysis, candidate distribution fitting, and fit review.
- Seeded Monte Carlo simulation with at least 100,000 iterations by default.
- Progress, cancellation, convergence diagnostics, visualization, baseline comparison, and exportable governed artifacts.
- Deterministic findings and recommendations grounded in F0 rules and compatible with F5/F6 evidence boundaries.

### 3.2 Out of scope for the first release

- Multi-user hosting, cloud storage, authentication, or remote measurement upload.
- Automatic write-back to the source workbook, F0 knowledge base, ADO, MES, PLM, or supplier systems.
- Automatic deletion or correction of outliers.
- Measurement System Analysis or Gage R&R calculation. F7 records MSA status and warns when it is absent.
- Correlated-factor simulation. The first release reuses the F6 correlation mode and permits a governed verdict only for confirmed `INDEPENDENT` analysis. `CORRELATED` or `UNKNOWN` runs are preview-only and return `INCOMPLETE`.
- Automatic engineering approval or unreviewed AI conclusions.
- Claiming Six Sigma tail performance from an insufficient simulation count.

## 4. Feature Ownership

### F7.0 Run Setup

- Import the workbook and identify candidate TA worksheets.
- Require user confirmation of one worksheet before processing measurements.
- Normalize factor identity, loop coefficient, unit, nominal, tolerance, baseline distribution, and source trace.
- Record whether each factor uses `MEASURED` or `BASELINE_ASSUMPTION` input.

### F7.1 Measurement Data

- Accept pasted or imported numeric observations.
- Preserve order and optional subgroup, batch, timestamp, and source metadata.
- Validate finite values, units, duplicates, missing values, sample count, physical support, and specification association.
- Detect potential outliers but never remove them automatically.

### F7.2 Stability and Capability

- Select the permitted capability method from the measurement structure.
- Produce descriptive statistics, control/stability signals, confidence intervals, and capability metrics.
- Prevent Cp/Cpk from being reported when within-process sigma cannot be supported.

### F7.3 Distribution Modeling

- Fit eligible Normal, Lognormal, Weibull, Gamma, and Uniform candidates.
- Calculate likelihood, AICc, BIC, goodness-of-fit diagnostics, and bootstrap stability.
- Require user approval of the distribution used by simulation.

### F7.4 Monte Carlo Engine

- Combine measured fitted distributions and baseline assumptions in one run.
- Apply explicit loop coefficients and system mean shift.
- Execute seeded, chunked, cancellable simulation with convergence evidence.
- Produce empirical output distribution, yield, DPM, quantiles, margins, and sensitivity evidence.

### F7.5 Visualization and Comparison

- Present per-factor measurements, capability, fit diagnostics, and selected source mode.
- Present output histogram, density/CDF, specification limits, yield curve, sensitivity ranking, and convergence.
- Compare Monte Carlo results with F4 Worst Case/RSS and disclose why they differ.

### F7.6 Governed Recommendation

- Publish F7-owned measurement, capability, fit, Monte Carlo, and sensitivity FACTs.
- Pass those FACTs to F5 for F0-grounded interpretation rather than creating a second interpretation owner.
- Pass confirmed targets and scenario inputs to F6 for feasibility, impact ranking, and optimization.
- Compose only evidence-backed F5/F6 outputs into the F7 report; do not invent an improvement order when F6 evidence is absent.

## 5. Architecture Decision

### 5.1 Selected approach

Use a local-first modular Web application:

- `apps/f7-web`: Vue 3 and Vite workbench.
- `apps/f7-local-api`: local Node API and run lifecycle.
- `packages/f7-statistics`: pure TypeScript statistical functions.
- `packages/f7-simulation`: seeded Monte Carlo kernel and worker protocol.
- `packages/contracts`: strict F7 schemas and invariants.
- Existing `packages/workbook-catalog`: Excel adapter initially, F2/F4/F5/F6 artifact adapters later.

Long-running analysis runs in Node worker threads. The UI remains responsive and receives structured progress events. ECharts renders charts from bounded summaries rather than receiving all simulation samples by default.

### 5.2 Statistical implementation decision

The production runtime remains TypeScript to match the repository and simplify artifact reuse. Established statistical/numerical packages must be used where they provide the required methods. Distribution fitting and critical probability functions must not be approximated with ad hoc formulas.

Golden fixtures are independently generated with a trusted reference implementation such as SciPy and checked into tests as non-confidential expected values. The Python reference is a validation oracle, not a production runtime dependency.

### 5.3 Alternatives not selected

- A team-hosted service adds identity, tenancy, retention, database, job queue, and operations before the statistical workflow is validated.
- A browser-only application weakens auditability and package control and makes long-running lifecycle management less reliable.
- A Python runtime service provides rich statistics but creates deployment and cross-language contract complexity for the first local release.

### 5.4 Contract migration

The existing `cpk-request-v1` and `cpk-result-v1` placeholder contracts remain unchanged and continue returning `feature_not_available`. F7 implementation introduces separate versioned contracts beginning with `f7-analysis-request-v1` and `f7-analysis-result-v1`; it does not change the meaning of the placeholder contracts in place.

F7 remains governance status `unavailable` through Phases 1 to 3. It can become `available` only after the upstream artifact adapters, canonical identity policy, approved local measurement-store policy, statistical acceptance checks, and F5/F6 handoffs are complete.

This design supersedes the target scope in the minimal F7 placeholder design while preserving its fail-closed public behavior until the new contracts are accepted. DIM ID backfill and T3-to-T1 knowledge proposals remain controlled later-phase workflows.

## 6. Core Data Model

### 6.1 Factor identity

Factor text is not a stable identity. During the Excel-only phase, identity is:

```text
workbookContentHash + worksheetName + tableId + sourceRow
```

When F2/F3 integration replaces the Excel adapter, F7 also stores Drawing Number, DIM ID, and the upstream factor instance identity. Historical runs remain bound to their original workbook and artifact hashes.

### 6.2 Loop direction

Loop direction is explicit:

```text
loopCoefficient: -1 | 0 | +1
measurementConvention: unsigned_physical_value
```

`-1` is subtractive, `+1` is additive, and `0` identifies a neutral Assembly Shift factor whose Design Nominal is zero. Assembly Shift does not advance Dimension Chain geometry, but its tolerance and sampled variation still contribute to RSS and Monte Carlo results.

Users enter physical measurements such as `0.57`. F7 applies the coefficient during system simulation. It must not require users to enter negative thickness values and must not infer loop direction from nominal sign at runtime. Measurements for a neutral Assembly Shift are signed offsets centered around zero.

The canonical baseline coordinate is also physical. For the interim workbook adapter only, a signed Excel contribution is converted as:

$$
\mu_{physical}=c\,\mu_{excelSigned}, \qquad \sigma_{physical}=\sigma_{excel}
$$

The adapter rejects a row when the confirmed coefficient and converted physical value are inconsistent with the factor's physical-domain policy. Downstream contracts never carry an ambiguous mean: they store `physicalMean`, `loopCoefficient`, and the derived `signedContributionMean` separately.

### 6.3 Factor source mode

Every factor has exactly one selected source mode:

```text
MEASURED
BASELINE_ASSUMPTION
```

`MEASURED` requires a validated dataset and an approved fit. `BASELINE_ASSUMPTION` requires a versioned sampler contract containing physical mean, standard deviation, support, sampler ID, and parameters. The report lists every baseline-assumption factor.

An F4 distribution label and sigma multiplier alone are not a complete sampling model. The initial workbook fixture may map `Normal` to `NORMAL_LOCATION_SCALE_V1`. Uniform and symmetric Triangular use separately approved location/scale samplers. Trapezoidal, Elliptical, and Beta factors remain `baseline_sampler_not_defined` until an approved F4-compatible parameterization contract exists; they must not silently fall back to Normal.

### 6.4 Measurement structure

The supported structures are:

- `RATIONAL_SUBGROUP`: subgroup ID and at least two observations per valid subgroup.
- `ORDERED_INDIVIDUALS`: observation sequence or timestamp without rational subgroups.
- `UNORDERED_SAMPLE`: values without defensible process order.

The dataset records unit, source reference, imported-at timestamp, observation count, content hash, missing/rejected row counts, and any user-approved dispositions.

## 7. Measurement Validation

Validation runs before any capability or fitting calculation.

Dataset-level blocking conditions:

- No numeric observations.
- Non-finite values after parsing.
- Unit mismatch with the factor.
- Missing factor specifications when capability is requested.
- Fewer than 20 accepted observations.

Candidate-level ineligibility does not block the dataset. Zero or negative observations make Lognormal, Weibull, and Gamma ineligible while Normal remains eligible.

Advisory conditions:

- 20 to 29 observations: exploratory analysis only; capability and fit diagnostics may be previewed, but fit approval, governed Monte Carlo, and recommendation are blocked. Preview simulation is capped at 10,000 iterations and labeled `EXPLORATORY`.
- 30 to 49 observations: fit uncertainty warning.
- Missing MSA/Gage R&R evidence.
- Duplicate values or suspicious paste patterns.
- Outlier candidates.
- Mixed batch or process-condition metadata.

Outliers remain in the default dataset. Exclusion requires a reason, operator confirmation, and a new dataset hash. Both original and analyzed counts are reported.

## 8. Stability and Capability Rules

Every metric carries `methodId`, `methodVersion`, `status`, formula inputs, and source references. Metric status is one of `available`, `descriptive_only`, or `not_available`.

### 8.1 Rational subgroups

Method `POOLED_WITHIN_V1` requires at least two rational subgroups, each with at least two observations, and at least 10 total within-subgroup degrees of freedom. Each subgroup standard deviation uses denominator $n_g-1$. The pooled within sigma is:

$$
s_w=\sqrt{\frac{\sum_g(n_g-1)s_g^2}{\sum_g(n_g-1)}}
$$

Cp and Cpk use $s_w$. Pp and Ppk use the overall sample standard deviation with denominator $n-1$.

### 8.2 Ordered individuals

Method `I_MR_WITHIN_V1` requires at least 20 ordered observations and 19 valid adjacent moving ranges. Moving ranges reset at an explicit batch boundary. Within sigma is $\bar{MR}/1.128$. Cp and Cpk are labeled with this method ID. Pp and Ppk use overall sample standard deviation with denominator $n-1$.

### 8.3 Unordered samples

Only Pp and Ppk are reported. Cp and Cpk return `not_available` with reason `within_sigma_not_supported`.

For a two-sided specification:

$$
P_p = \frac{USL-LSL}{6s}, \qquad
P_{pk} = \min\left(\frac{\bar{x}-LSL}{3s},\frac{USL-\bar{x}}{3s}\right)
$$

Cp/Cpk use an approved within-process sigma in place of overall $s$.

The first release requires finite two-sided LSL and USL. One-sided capability is deferred and rejected with `unsupported_specification_shape`. Zero variation returns `not_available` with `zero_variance`; a mean outside specification may produce a negative Cpk or Ppk and is not clamped.

All capability intervals use a deterministic 2,000-replicate percentile bootstrap with a separately persisted bootstrap seed. Rational-subgroup bootstrap resamples complete subgroups; ordered-individual bootstrap uses moving blocks of length $\max(2,\lceil n^{1/3}\rceil)$; unordered bootstrap resamples observations. The report labels Cp/Cpk and Pp/Ppk as moment-based indices. Non-normal percentile capability is deferred.

Bootstrap method `F7_BOOTSTRAP_V1` uses `PCG32_XSH_RR_64_32_V1`: 64-bit state, multiplier `6364136223846793005`, XSH-RR output permutation, and the reference `pcg32_srandom_r(initstate, initseq)` initialization sequence. Production uses an approved library whose output matches locked reference vectors.

Run and bootstrap seeds are exactly 32 bytes represented as 64 lowercase hexadecimal characters. Text fields are Unicode NFC normalized and UTF-8 encoded. Each field is encoded as one presence byte (`01` present, `00` absent); a present byte is followed by a four-byte unsigned big-endian byte length and the field bytes. The fixed-order replicate index is encoded as an unsigned eight-byte big-endian integer. Candidate absence is encoded by its `00` presence byte, not an empty string.

SHA-256 is calculated over the encoded domain prefix `F7_BOOTSTRAP_V1\0`, bootstrap seed bytes, stable factor identity, method ID, optional candidate ID, and replicate index in that order. The first eight digest bytes interpreted as unsigned little-endian form `initstate`. The next eight bytes interpreted as unsigned little-endian and masked to 63 bits form `initseq`, avoiding the PCG increment high-bit alias before reference initialization. The full 32-byte digest is persisted as `streamDigest`; derivation is deterministic and cryptographically collision-resistant rather than claiming mathematical uniqueness. Replicates are aggregated by ascending replicate index, so worker count and scheduling cannot change results. Golden bootstrap vectors cover field presence, empty versus absent values, Unicode normalization, endianness, seed encoding, initialization, each resampling mode, and each candidate family.

Stability method `SPC_RULE1_V1` intentionally implements only the one-point-beyond-three-sigma rule. For ordered individuals, the I chart uses $\bar{x}\pm3(\bar{MR}/1.128)$ and the moving-range chart uses lower limit zero and upper limit $3.267\bar{MR}$. Unordered samples return stability `not_available`.

Rational-subgroup stability requires at least three subgroups, at least 10 leave-one-out within degrees of freedom for every tested subgroup, and Normal residual fit status `acceptable` under the F7.3 bootstrap threshold. Until distribution evidence is available, subgroup stability is `pending_distribution_evidence`. A Normal fit status of `weak` or `rejected` returns stability `not_available` with reason `normal_stability_model_not_supported`.

For subgroup $g$, let $N_{-g}$, $\bar{x}_{-g}$, and $s_{w,-g}$ be the count, weighted mean, and pooled within sigma from all other subgroups. Each $s_{w,-g}$ must be finite and strictly positive. Otherwise the subgroup stability result is `not_available` with reason `invalid_leave_one_out_variance`; no infinite statistic or control signal is emitted. The mean statistic is:

$$
z_g=\frac{\bar{x}_g-\bar{x}_{-g}}{s_{w,-g}\sqrt{1/n_g+1/N_{-g}}}
$$

It signals when $|z_g|>3$. Boundary equality does not signal. The variance statistic is:

$$
F_g=\frac{s_g^2}{s_{w,-g}^2},\qquad
df_1=n_g-1,\qquad
df_2=\sum_{h\ne g}(n_h-1)
$$

With total two-sided alpha `0.0027`, variance signals when $F_g<F^{-1}(0.00135;df_1,df_2)$ or $F_g>F^{-1}(0.99865;df_1,df_2)$. Boundary equality does not signal. This F-test is valid only under the accepted Normal residual model above. If leave-one-out prerequisites fail, rational-subgroup stability is `not_available` while the separately governed capability method may remain mathematically available.

Stability is evaluated before capability verdict. A triggered control-rule signal changes Cp/Cpk to `descriptive_only`; the report must not label the process capable. Pp/Ppk remain descriptive performance indices. Missing MSA evidence is advisory and visible but does not alter the mathematical index. Acceptance fixtures lock every control limit, boundary equality, batch reset, and signal reason.

## 9. Distribution Fit Decision

Only two-parameter candidates are in the first release. Lognormal, Weibull, and Gamma use location fixed at zero. Candidate eligibility follows support and data evidence:

- Normal: unbounded continuous values.
- Lognormal, Weibull, Gamma: strictly positive values.
- Uniform: finite bounded process; first-release maximum-likelihood bounds are sample minimum and maximum and always carry a boundary-sensitivity warning.

Each eligible candidate includes parameter estimates, log likelihood, AICc, BIC, Anderson-Darling, KS, Q-Q data, and bootstrap fit stability. Goodness-of-fit p-values use `F7_BOOTSTRAP_V1` with 2,000 parametric replicates because parameters are estimated from the same sample. The bootstrap seed and candidate substream identity are stored in the decision manifest.

AICc is primary for small samples; BIC and diagnostics are supporting evidence. Bootstrap p-value below `0.05` is `rejected`, `0.05` through less than `0.10` is `weak`, and at least `0.10` is `acceptable`. F7 may recommend an acceptable candidate but may not silently select it. A weak candidate requires an engineer override reason; a rejected candidate cannot be used by a governed run. `EMPIRICAL_RESAMPLING` and three-parameter fits are deferred.

## 10. Monte Carlo Model

For iteration $j$, the system response is:

$$
Y_j = \Delta\mu + \sum_{i=1}^{k} s(c_i) X_{i,j},
\qquad
s(c_i)=\begin{cases}
1, & c_i=0 \\
c_i, & c_i\in\{-1,+1\}
\end{cases}
$$

where $c_i$ is the explicit loop coefficient, $X_{i,j}$ is sampled from either the approved measured fit or F4-compatible baseline distribution, and $\Delta\mu$ is the verified system additional mean shift. For Assembly Shift, $c_i=0$ expresses neutral geometry while $s(c_i)=1$ preserves its signed random offset and variance.

Default settings:

- Iterations: `100000`.
- Seed: generated once, displayed, persisted, and editable.
- Chunk size: implementation-controlled and bounded.
- Factor dependence: imported from F6 analysis context as `INDEPENDENT`, `CORRELATED`, or `UNKNOWN`. Only confirmed `INDEPENDENT` permits a governed result.
- Progress events: completed iterations, elapsed time, estimated remaining time, and convergence summary.

Allowed presets are 10,000 for preview, 100,000 for standard analysis, and 1,000,000 for higher tail resolution. Custom values are bounded by local resource policy.

The reproducibility manifest stores `engineVersion`, `prngId`, `samplerVersionByFactor`, `runSeed`, `bootstrapSeed`, `factorSubstreamPolicy`, `chunkSize`, and aggregation version. Simulation uses `PCG32_XSH_RR_64_32_V1`. Factor substreams use the same presence-byte, length-prefix, Unicode, endianness, SHA-256, 63-bit `initseq`, and full `streamDigest` rules as bootstrap with domain prefix `F7_SIMULATION_V1\0`, run seed, and stable factor identity. Worker count and chunking therefore do not change draws. Aggregation occurs in chunk-index order. Golden random vectors lock seed encoding, PRNG initialization, and each sampler.

The run calculates mean, standard deviation, selected quantiles, LSL/USL exceedance counts, empirical yield, DPM, confidence intervals, and sensitivity. Spearman rank correlation is reported as a directional association diagnostic. For a confirmed independent additive model, method `INDEPENDENT_VARIANCE_SHARE_V1` calculates each factor's sample variance after coefficient application and divides it by the sum of factor variances. Shares must sum to one within `1e-12`; the largest share determines the highest-variation factor. Variance share is unavailable for `CORRELATED` or `UNKNOWN`. The report distinguishes Monte Carlo yield from normal-assumption Cpk.

The first release always runs the requested iteration count; convergence never stops a run early. After each 10,000-iteration chunk, it reports cumulative mean, standard deviation, yield interval, and selected quantiles. For metric values $a$ and $b$ in consecutive chunks, define:

$$
\delta(a,b)=\frac{|a-b|}{\max(|a|,|b|,\epsilon)}, \qquad
\epsilon=\max(10^{-12},10^{-6}(USL-LSL))
$$

Diagnostic status is `stable` only when $\delta<0.001$ for both cumulative mean and standard deviation over five consecutive chunks; otherwise it is `not_stable`. Specification width is required and positive, so $\epsilon$ is defined in the system unit. Boundary equality is not stable. This status is evidence, not a substitute for the requested count.

With 100,000 iterations, one observed defect represents 10 DPM. Yield intervals use two-sided 95% Clopper-Pearson intervals. If zero failures occur, the report also states the one-sided 95% exact upper bound, approximately `29.96 DPM` for 100,000 iterations, rather than claiming zero DPM or Six Sigma capability. Rare-event or importance-sampling methods are deferred.

The worker checks cancellation at least every 10,000 iterations. The reference performance fixture requires cancellation acknowledgement within one second, progress at least once per chunk, and peak process memory below 256 MiB for 1,000,000 iterations. Raw samples are not retained after their aggregate and bounded chart reservoir are updated.

When correlation mode is `CORRELATED` or `UNKNOWN`, F7 may run an explicitly labeled independent preview but returns system-analysis status `INCOMPLETE`, blocks system Monte Carlo yield/DPM verdict and F5/F6 recommendation composition, and requests paired observation IDs or correlation evidence. Per-factor stability and capability results remain valid within their own evidence scope. F7 must not treat user acknowledgement as evidence that known correlation is absent.

## 11. User Experience

The application is a workbench, not a landing page.

1. Import workbook and confirm worksheet.
2. Review factor identity, coefficient, unit, specifications, and Excel trace.
3. Choose measured or baseline mode per factor.
4. Paste measurements in a grid or drawer and resolve validation issues.
5. Review capability and stability per measured factor.
6. Compare candidate fits and approve one fit per measured factor.
7. Review simulation settings and the independence assumption.
8. Run, monitor, or cancel the simulation.
9. Inspect visual report, recommendations, assumptions, and provenance.
10. Export JSON plus a human-readable report without modifying the workbook.

The factor table remains visible throughout the workflow. Each factor shows source mode, observation count, capability status, fit status, and simulation readiness. The evidence pane shows workbook cells and artifact hashes.

## 12. Visualization

Required visualizations:

- Per-factor histogram, specification limits, fit overlay, Q-Q plot, and capability summary.
- Stability/control chart when ordered evidence permits it.
- System output histogram and CDF with LSL, USL, mean, and key quantiles.
- Monte Carlo versus F4 RSS overlay and Worst Case bounds.
- Yield/DPM with confidence interval and simulation resolution warning.
- Sensitivity ranking with measured/baseline source badges.
- Convergence by chunk.

Charts consume aggregated bins, quantiles, and diagnostics. Raw confidential measurements are not embedded in exported reports unless the user explicitly selects a controlled data appendix.

## 13. Recommendation Governance

Recommendations are produced in two layers.

### 13.1 F7-owned deterministic facts

- Which factors fail stability or capability checks.
- Which selected distributions have fit status `weak` under the defined bootstrap p-value thresholds.
- Which factors dominate simulated sensitivity or variance.
- Whether the system fails because of mean shift, variation, tail behavior, specification mismatch, or insufficient evidence.
- How Monte Carlo differs from F4 RSS/Worst Case and which input change caused the difference.
- Which inputs require clarification before F5/F6 handoff.

### 13.2 Delegated interpretation and optimization

F5 consumes F7 facts and references versioned F0 entries to produce governed interpretation. F6 consumes confirmed targets and F7/F4 facts to produce feasibility, impact ranking, and optimization. F7 composes those returned artifacts but does not reproduce their rule or ranking logic. It may not invent supplier capability, cost, correlation, process causality, or an optimization result.

The composed action order follows evidence:

1. Resolve invalid, unstable, or insufficient measurement evidence.
2. Address mean shift when centering dominates failure.
3. Ask F5 to interpret the highest verified sensitivity/contribution factor against F0 rules.
4. Use F6 scenario or reverse-solve evidence for ranked numerical improvement options.
5. Escalate to 3D variation or correlated analysis when the one-dimensional independence model is inadequate.

F0 backfill is a separate reviewed workflow. F7 never upgrades T3 evidence to T1 automatically.

## 14. Security and Provenance

- Workbook and measurements are `confidential`.
- The local API binds to loopback only.
- Raw values are excluded from logs and error messages.
- Default sessions are ephemeral. Persistence or export requires explicit user action.
- Every dataset, workbook, baseline artifact, fit decision, setting set, and result has a content hash.
- A result is invalid if its workbook, worksheet, factor identity, dataset hash, fit decision, or simulation seed does not match its manifest.
- Enabling F7 as `available` requires an approved local measurement-store policy and canonical factor/DIM identity policy.

## 15. Error and Cancellation Model

Errors are worksheet- or factor-scoped where possible. One invalid measured factor blocks that factor from simulation but does not destroy other entered data. The run cannot start until every factor is simulation-ready through either measured or baseline mode.

Worker cancellation occurs at chunk boundaries. A cancelled run persists no completed result and is marked `cancelled` with settings and progress only. Numeric overflow, invalid distribution parameters, non-finite samples, manifest mismatch, or inconsistent units fail closed.

## 16. Acceptance Strategy

### Contract and validation

- Strict schemas reject unknown fields, non-confidential input, identity mismatch, invalid units, and inconsistent summaries.
- Tests cover all three measurement structures and the Cp/Cpk availability gate.
- Outlier exclusions change the dataset hash and require a reason.

### Statistical verification

- Golden Normal, Lognormal, Weibull, Gamma, and Uniform fixtures are generated independently.
- Parameter estimates, likelihood criteria, diagnostics, capability metrics, and confidence intervals are checked against trusted reference values.
- Golden bootstrap vectors verify factor/method/candidate substreams and schedule-independent aggregation.
- Pathological samples cover constants, tiny variance, heavy tails, zero/negative values, and insufficient samples.
- SPC fixtures verify Rule 1 limits, equality boundaries, batch resets, accepted/weak/rejected Normal residual evidence, non-finite and zero leave-one-out variance, rational-subgroup leave-one-out mean and F-test variance signals, insufficient leave-one-out degrees of freedom, and unordered `not_available` behavior.

### Monte Carlo verification

- Same manifest and inputs produce byte-equivalent numeric summaries and match locked PRNG/sampler vectors.
- The seven-factor `TP_C_Step_TA` all-baseline Normal run has expected system mean exactly `-0.05` within `1e-12`; its simulated sigma differs from F4 RSS sigma by no more than three Monte Carlo standard errors; its simulated Cpk comparison retains the F4 baseline identity and never applies a coefficient twice.
- Mixed measured/baseline runs preserve coefficients, units, and factor identities.
- Independent variance shares match analytic additive fixtures and sum to one within `1e-12`; correlated and unknown modes omit variance shares.
- Progress is monotonic by 10,000-iteration chunk, cancellation acknowledgement is within one second in the reference fixture, and 1,000,000 iterations use less than 256 MiB peak process memory.
- Convergence fixtures cover ordinary, zero-mean, near-zero-mean, exact-threshold, stable, and non-stable sequences using the specified $\epsilon$ formula.

### Web workflow

- Desktop and mobile layouts do not overlap, although full analysis is optimized for desktop.
- Paste, validation, fit confirmation, run, cancel, report, and export are covered by browser tests.
- Confidential values do not appear in console logs or unapproved report fields.

## 17. Delivery Phases

### Phase 1: Foundation

F7.0 and F7.1 only: contracts, Excel adapter, worksheet/factor confirmation, explicit coefficients, per-factor source mode, measurement paste, validation, provenance, and local workbench shell.

### Phase 2: Statistical analysis

F7.2 and F7.3: stability modes, capability metrics, fit candidates, diagnostics, bootstrap evidence, and fit confirmation.

### Phase 3: Simulation and visualization

F7.4 and F7.5: worker protocol, seeded simulation, progress/cancellation, convergence, comparison, sensitivity, charts, and exports.

### Phase 4A: Artifact and identity integration

Replace direct Excel extraction with verified F2 and F4 artifacts while preserving workbook, worksheet, table, row, Drawing Number, DIM ID, and factor-instance identity.

### Phase 4B: F5/F0 interpretation handoff

Publish F7 facts through a versioned adapter and consume F5 interpretation with F0 citations. F7 contains no duplicate interpretation rules.

### Phase 4C: F6 optimization handoff

Pass confirmed targets, correlation status, and measured capability evidence to F6. Consume F6 feasibility and ranked options without reranking them in F7.

### Phase 4D: Controlled F0 feedback proposal

Create a separately approved proposal workflow for DIM-linked T1 evidence. No automatic knowledge-base write or T3-to-T1 upgrade is permitted.

Each phase has its own implementation plan and acceptance gate. Phases 1 through 3 remain experimental and F7 stays `unavailable`. Phase 1 must not implement placeholder statistical results for later phases.

## 18. Design Decisions Summary

- Local-first Vue Web workbench with a Node API and worker threads.
- TypeScript production statistics with independent reference fixtures.
- Explicit loop coefficients; physical measurements remain unsigned.
- Per-factor measured/baseline mixing is required.
- Cp/Cpk availability is governed by measurement structure.
- Distribution selection requires evidence and user confirmation.
- Monte Carlo is seeded, chunked, cancellable, and convergence-aware.
- 100,000 iterations are the default, not proof of rare-event capability.
- Recommendations are deterministic-first and F0/F5/F6 governed.
- Direct Excel input is temporary; contracts are artifact-source neutral.