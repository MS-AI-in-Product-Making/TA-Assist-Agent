# TA Real-Measurement Analysis Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a discoverable workspace skill that starts and opens the existing F7 local Web UI from Chinese or English multi-Factor real-measurement business intent.

**Architecture:** A single `.github/skills/ta-real-measurement-analysis/SKILL.md` owns trigger routing and agent behavior while existing npm scripts continue to own process startup. A Node test treats the skill text as a stable contract without duplicating runtime implementation. F7 remains an internal compatibility alias rather than the required user vocabulary.

**Tech Stack:** VS Code workspace skills, Markdown/YAML frontmatter, Node.js test runner, npm, Vue/Vite F7 Web UI.

---

### Task 1: Define the skill contract

**Files:**
- Create: `scripts/f7-analysis-skill.test.mjs`

- [x] **Step 1: Write the failing test**

Create a Node test that reads `.github/skills/ta-real-measurement-analysis/SKILL.md` and asserts bilingual business-intent discovery, negative trigger boundaries, `npm run dev:f7`, both loopback URLs, async/background startup, listener reuse, partial-port conflict handling, browser opening, multi-Factor measured-value guidance, and local safety boundaries.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test scripts/f7-analysis-skill.test.mjs`

Expected: FAIL because `.github/skills/ta-real-measurement-analysis/SKILL.md` does not exist.

### Task 2: Implement the TA real-measurement analysis skill

**Files:**
- Create: `.github/skills/ta-real-measurement-analysis/SKILL.md`
- Test: `scripts/f7-analysis-skill.test.mjs`

- [x] **Step 1: Write the minimal skill**

Add valid YAML frontmatter with `name`, trigger-rich `description`, `user-invocable`, and optional workbook `argument-hint`. Define entry routing, port preflight, background startup, readiness evidence, browser opening, UI workflow guidance, error handling, allowed commands, and safety boundaries.

- [x] **Step 2: Run test to verify it passes**

Run: `node --test scripts/f7-analysis-skill.test.mjs`

Expected: PASS.

- [x] **Step 3: Validate existing F7 wiring**

Run: `npx vitest run scripts/f7-project-wiring.test.mjs scripts/f7-phase-1-docs.test.mjs`

Expected: PASS.

### Task 3: Verify the live startup path

**Files:**
- No file changes.

- [x] **Step 1: Start the local stack**

Run `npm run dev:f7` as a long-running process and retain its terminal identifier.

- [x] **Step 2: Verify readiness**

Confirm Web `http://127.0.0.1:5177` renders and API port `127.0.0.1:4317` accepts connections. Check the browser console for startup errors.

- [x] **Step 3: Leave the UI available**

Keep the development stack running and report the Web URL to the user.