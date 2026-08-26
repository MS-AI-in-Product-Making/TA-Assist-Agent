# F7 Monte Carlo System Specification and Histogram Design

**Date:** 2026-08-25
**Status:** Approved for implementation planning

## Purpose

Extend F7 Step 5 so the selected Excel worksheet supplies System LSL, System USL,
and Target Sigma Level as editable run defaults. After simulation, show the actual
empirical histogram, a moment-fitted Normal curve, specification/reference lines,
and the process and defect statistics needed to interpret the run.

This work remains inside Step 5. It does not implement Step 6 Report and does not
return raw Monte Carlo samples to the browser.

## Selected Approach

The simulation service returns a bounded histogram summary derived from the actual
seeded samples. The browser renders that summary with the repository's existing SVG
plot conventions. This preserves reproducibility and auditability without sending
10,000 or 100,000 raw values across the local API.

Rejected alternatives:

- Returning every sample increases response size, memory use, and confidential data
  exposure without improving the requested view.
- Synthesizing histogram bars in the browser from only mean and standard deviation
  would present a theoretical distribution as observed simulation evidence.

## Excel System Specification Flow

When the user confirms one worksheet, the local service reads that worksheet from
the already-held workbook bytes and calls the existing
`extractResponseSummarySystemSpecification` implementation. The extractor remains
semantic: it locates the Response Summary labels and does not hardcode P54/P55/P56.

The F7 session snapshot receives a selected-worksheet `systemSpecification` with:

- `lowerSpecLimit`
- `upperSpecLimit`
- `targetSigmaLevel`

Each field preserves `actualValue`, `displayValue`, `sourceLabel`, `sourceCell`, and
`valueOrigin`. An unavailable specification remains unavailable with its reason and
must not be replaced by a hidden default.

Step 5 initializes its three editable controls from the available Excel actual
values. Edits are run-scoped overrides only: they do not mutate workbook evidence or
write back to Excel. The UI displays each Excel source cell below its control and
marks a changed value as an override. Invalid values block simulation:

- LSL and USL must be finite and LSL < USL.
- Target Sigma Level must be finite and greater than zero.

## Monte Carlo Contract

The run request adds `targetSigmaLevel`. The result echoes the effective value so a
stored result is self-contained and cannot be reinterpreted using later form edits.

The result also adds:

- `histogram`: contiguous empirical bins with minimum, maximum, and observed count.
- `normalFit`: method ID, mean, standard deviation, and expected Normal count for
  each empirical bin.
- `capability`: Cp, lower Cpk, upper Cpk, Cpk, target Cpk, and target status.
- `normalModel`: expected lower-tail, upper-tail, total DPM, and expected yield.

Target Sigma does not rescale factor distributions and therefore does not alter the
seeded sample stream, observed yield, or observed PPM. It controls these references:

$$
Target\ Cpk = \frac{Target\ Sigma}{3}
$$

$$
Target\ range = \bar{x} \pm Target\ Sigma \cdot s
$$

The capability values use the simulated output mean and sample standard deviation:

$$
Cp = \frac{USL-LSL}{6s}
$$

$$
Cpk = \min\left(\frac{\bar{x}-LSL}{3s},\frac{USL-\bar{x}}{3s}\right)
$$

Zero simulated variance makes capability and Normal-model tail statistics
unavailable rather than infinite.

## Histogram and Fit Rules

Histogram bins are calculated from sorted actual simulation values. Bin count uses
the Freedman-Diaconis rule, bounded to 20 through 60 bins, with a deterministic
square-root fallback when the interquartile range is zero. Bins cover all simulated
values, are contiguous, and their counts must sum exactly to the iteration count.

For each bin, the fitted Normal expected count is:

$$
n \cdot \left[\Phi\left(\frac{b-\bar{x}}{s}\right)
- \Phi\left(\frac{a-\bar{x}}{s}\right)\right]
$$

where $a$ and $b$ are bin boundaries. The line is explicitly labeled
`Moment-fitted Normal`; it is not described as an accepted goodness-of-fit result.
No KS p-value is fabricated. The existing empirical observed count/PPM remains the
governed defect result; Normal expected DPM is shown separately as a model estimate.

## Step 5 UI

The existing industrial workbench styling remains unchanged. The Step 5 panel gains:

1. A three-column System LSL, System USL, Target Sigma Level input row with Excel
   source evidence and override state.
2. The existing iterations, seed, correlation mode, and Run simulation controls.
3. A full-width empirical histogram with a dark fitted Normal line and vertical
   references for LSL, USL, mean, and mean +/- Target Sigma.
4. Compact sections for Process Outputs, Normal Model Statistics, and Observed
   Defect Statistics.

The chart uses responsive SVG with stable dimensions, accessible title/description,
non-color-only line distinctions, and no chart editing controls.

## Errors and Governance

- Missing or invalid worksheet specification leaves the affected inputs empty and
  displays the extractor reason; simulation stays disabled until corrected.
- A user override is visible in the UI and persisted in the Monte Carlo result.
- Contract invariants reject histogram count mismatches, non-contiguous bins,
  inconsistent capability minima, and rate/count mismatches.
- Existing session confidentiality and no-store API behavior remain unchanged.

## Testing

- Contract tests cover specification evidence, target sigma, bins, capability, and
  consistency failures.
- Session-service tests prove selected worksheet values and source cells reach the
  snapshot and unavailable evidence fails closed.
- Simulation tests prove deterministic bins, count totals, Normal expected counts,
  Cp/Cpk, target status, and unchanged sample results when only Target Sigma changes.
- Vue tests prove Excel defaults, editable overrides, validation, source labels,
  chart references, and statistics sections.
- Browser verification covers a valid workbook at desktop and mobile widths and
  checks console/network errors and SVG non-blank rendering.
