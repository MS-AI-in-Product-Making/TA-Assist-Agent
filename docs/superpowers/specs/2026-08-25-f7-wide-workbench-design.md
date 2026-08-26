# F7 Wide Workbench Design

## Goal

Use more available desktop width so the Distribution Fit result table requires less horizontal scrolling, while preserving contained scrolling on narrow screens.

## Design

Increase the main workbench maximum width from 1360px to 1760px. Keep `width: 100%`, existing page padding, and the Distribution Fit table's local `overflow-x: auto`. This lets common wide desktop viewports expose more columns without changing statistical content, column sizing, or mobile behavior.

## Verification

Lock the desktop width in a CSS contract test, run the F7 Web test suite and production build, then measure page and table overflow at 1440px, 1920px, and 390px viewports.