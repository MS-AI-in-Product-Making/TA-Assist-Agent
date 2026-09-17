# F7 Measured Data Analysis Progress Design

**Date:** 2026-09-17
**Status:** Approved
**Target:** `apps/f7-web`

## Goal

After a successful bulk measurement import, show a prominent animated progress strip in Factor Setup while automatic distribution analysis runs, with row-level states remaining in the Source Mode column.

## Design

`App.vue` owns a transient automatic-analysis progress value containing the ordered Factor IDs, the active Factor ID, and the completed count. It starts after import commit and before the first automatic `fitDistribution` call, advances before each sequential fit, and clears in `finally` on success or failure.

`FactorInputTable` receives the optional progress value. During automatic analysis, the active row replaces `Measured Data` with a spinner and `Analyzing`; later rows show `Queued`; completed rows use their normal `Measured Data` state. Existing global busy behavior keeps controls disabled during processing.

While progress exists, a full-width feedback strip appears between the Factor Setup heading and the table. It contains a spinner, `Analyzing measured data N / total`, and the same 4 px indeterminate orange progress animation used by workbook reading. The strip owns the summary previously shown inside the Source Mode header, avoiding duplicate progress text and additional header height. It disappears with the transient progress value on success or failure, without reserving empty space afterward.

Progress is presentational only. It does not change measurement readiness, warning rules, distribution approval, API contracts, or failure handling. When a fit fails, progress clears and the existing controlled error remains visible.

## Accessibility

The progress summary uses `role="status"` with `aria-live="polite"`. The spinner and progress bar are decorative because the text conveys the same state. Active and queued buttons receive explicit accessible names including their state; color and animation are not the only signals. The bar stops animating when reduced motion is requested.

## Verification

App tests hold sequential fit promises to verify active, queued, completed, and total progress states. Component tests cover the full-width feedback strip, progress rendering, and normal-state restoration. CSS tests cover stable strip layout, animation reuse, and reduced-motion behavior. Browser checks confirm desktop and mobile alignment, no clipping, and removal of the former Source Mode header summary.