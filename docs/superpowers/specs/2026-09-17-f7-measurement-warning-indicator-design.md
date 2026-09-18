# F7 Measurement Warning Indicator Design

**Date:** 2026-09-17
**Status:** Approved
**Target:** `apps/f7-web`

## Goal

After real measurements are imported, show a red `Warning` label beside `Open workspace` for each Factor whose committed measurements have an import warning. Opening the workspace must show the specific warning text.

## Design

The Web app deterministically rebuilds warning rules from committed session data. A warning exists when the confirmed Factor specification crosses zero, an included measurement falls outside the Factor LSL/USL, or the existing 3σ/IQR data-quality diagnostics identify a candidate outlier. A shared pure helper returns the warning messages so the Factor table indicator and workspace detail cannot disagree.

The Factor table renders a non-interactive red `Warning` text label immediately after `Open workspace` only when the helper returns at least one warning. The measurement workspace renders the same messages in a red warning region near the Factor specification. The button remains the only interaction.

This change does not alter import validation, block commit, add persisted state, or change backend/contracts. Factors without these warnings remain unchanged.

## Verification

Component/integration tests cover a warning Factor, a clean Factor, exact workspace details, and the existing workspace navigation. Type checking and the focused F7 Web test suite must pass.
