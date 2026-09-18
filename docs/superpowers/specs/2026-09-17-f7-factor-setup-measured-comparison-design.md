# F7 Factor Setup Measured Comparison Design

**Date:** 2026-09-17
**Status:** Approved by autonomous recommended-choice authorization
**Target:** `apps/f7-web`

## Goal

Let engineers compare each Factor's setup assumptions with accepted real measurements directly in the Factor Setup table.

## Table Design

The existing Factor row remains the Setup row. Add a `Cpk` column immediately after `1σ`; the Setup cell shows `sigmaLevel / 3`.

When a measured Factor has a ready imported dataset, render one lightly shaded comparison row immediately below its Setup row. The Factor cell identifies the row as `Actual / Δ`. Non-comparison cells remain empty. The Mean, Tolerance, 1σ, and Cpk cells each stack the Actual value over a signed Delta value.

The comparison row is hidden while Factor Setup is editable. It is also absent for baseline Factors and measured Factors without a ready dataset.

## Calculation Rules

Use only included observations from the ready `measurementPasteResult.dataset`. Ordered values retain source-row order. Rational-subgroup datasets reuse the governed within-subgroup standard-deviation calculation used by the measurement workspace.

- Setup Mean: existing calculated Factor mean.
- Actual Mean: arithmetic mean of included observations.
- Mean Delta: `abs(actualMean) - abs(setupMean)`.
- Setup Tolerance: existing positive half-tolerance.
- Actual Tolerance: `3 * actualStandardDeviation`, displayed as `±3σ` process spread rather than as an engineering specification.
- Tolerance Delta: `actualTolerance - setupTolerance`.
- Setup 1σ: existing calculated Factor one-sigma value.
- Actual 1σ: sample standard deviation, or governed within-subgroup standard deviation for rational subgroups.
- 1σ Delta: `actualStandardDeviation - setupOneSigma`.
- Setup Cpk: `setupSigmaLevel / 3`, as explicitly requested.
- Actual Cpk: the existing `calculateF7Capability` result based on Factor LSL, USL, measured mean, and measured standard deviation.
- Cpk Delta: `actualCpk - setupCpk`.

Calculations must not modify session state or duplicate API-owned data. A focused pure helper derives the display projection from one Factor.

## Unavailable Results

A ready dataset with at least one included finite observation still gets an Actual row. Mean remains available. If there are fewer than two observations or zero variation, Actual Tolerance, 1σ, Cpk, and their deltas display `—`. No values are invented.

## Presentation and Accessibility

Use a quiet neutral comparison-row background and a top border to visually bind the row to its Setup row. Each metric has explicit `Actual` and `Δ` labels; sign and color are not the only indicators. The comparison row receives an accessible label including the Factor name. Keep fixed column widths and the existing horizontal table scroll behavior on narrow screens.

## Verification

Pure-helper tests cover absolute Mean comparison, ±3σ, Setup Cpk mapping, Actual Cpk, rational subgroups, insufficient data, zero variation, and excluded observations. Component tests cover Cpk column placement, Setup values, conditional Actual-row rendering, delta labels, edit-mode hiding, and no row for baseline/unready Factors. Browser checks cover desktop alignment and 390 px horizontal scrolling without overlap or clipping.
