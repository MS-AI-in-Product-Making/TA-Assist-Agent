# F7 Wide Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase usable desktop width and reduce Distribution Fit horizontal scrolling without introducing page-level overflow.

**Architecture:** Change only the main workbench width constraint. Preserve the existing table overflow boundary as the narrow-screen fallback.

**Tech Stack:** CSS, Vitest, Vue 3, Vite, Playwright.

---

### Task 1: Widen And Verify The Workbench

**Files:**
- Modify: `apps/f7-web/src/style.css`
- Test: `scripts/f7-web-layout.test.mjs`

- [x] Add a failing CSS contract test requiring `width: 100%` and `max-width: 1760px` on `.workbench-root`.
- [x] Run `npx vitest run scripts/f7-web-layout.test.mjs` and confirm the current 1360px rule fails.
- [x] Change `.workbench-root` to `max-width: 1760px`.
- [x] Run the focused test, full F7 Web tests, and `npm run build:f7:web`.
- [x] Verify desktop width utilization and narrow-screen contained scrolling in the browser.