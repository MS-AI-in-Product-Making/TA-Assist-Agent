# AI Assist Agent Roadmap Update Design

## Purpose

Rename the product-facing project from the TA-specific working name to **AI Assist Agent** and align GitHub planning artifacts with the product definition in `docs/04-feature-breakdown.md`.

## Source of Truth

- Product name: **AI Assist Agent**.
- V1 roadmap shape: one Epic, four ME User Stories, and F0-F8 Features.
- Existing GitHub issue numbers should be preserved where possible to avoid breaking links.
- TA domain language remains valid: TA workbook, DIM ID, Cpk, RSS, WC, CTS/CTF, measured Cpk, and evidence pane terminology should not be generalized away.

## Repository Naming Update

Update user-facing repository documentation from **AI TA Analysis Agent** / **Surface TA Analysis Agent** to **AI Assist Agent**.

Keep detailed product scope intact:

- The V1 product still assists tolerance-analysis workflows.
- Feature documents still describe the TA-specific workflow.
- Confidential engineering notes and formula references are not removed unless they conflict with the new product name.

## GitHub Issues Update

Use the docs-defined structure as the planning model:

1. **User Story 1 - Reliable First-Pass TA Result and Summary**
   - Covers F0, F1, F2, F4, and F8.
2. **User Story 2 - DIM ID and Drawing Governance Before Key Milestones**
   - Covers F3.
3. **User Story 3 - Objective Conclusions and Comparable Options**
   - Covers F5 and F6.
4. **User Story 4 - Measured Cpk Feedback and Continuous Accuracy Improvement**
   - Covers F7.

Preserve existing Feature issue numbers and update their bodies/checklists to match `docs/04-feature-breakdown.md`.

Treat existing S0-S9 User Story issues as historical migration records rather than deleting them. If closing is supported safely, close them with a note pointing to the new four-story structure; otherwise update their body/title to mark them migrated.

## GitHub Project Update

Rename Project #1 to **AI Assist Agent Roadmap**.

Update the project short description/readme to explain that the board tracks the V1 roadmap as:

- 4 User Stories
- F0-F8 Features
- implementation tasks inside Feature issue checklists

Update the `User Story` single-select project field from S0-S9 options to the four docs-defined User Stories, then assign each Feature issue to the correct option.

## Safety and Verification

- Do not delete issues.
- Do not break existing issue links.
- Keep old issue numbers where possible.
- Verify Project #1 title and item grouping after update.
- Verify repository docs contain the new product-facing name.
- Verify feature issue bodies contain concrete task checklists aligned with docs.

