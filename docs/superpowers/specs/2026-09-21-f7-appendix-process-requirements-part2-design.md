# F7 Appendix Process Requirements Part 2 Design

**Date:** 2026-09-21
**Status:** Approved for planning
**Target:** F7 Web Appendix and governed F7 PDF report

## Goal

Add the existing **TA Process and Requirements** content to the F7 Appendix as **Part 2**, after the existing Factor Distribution References content in **Part 1**. The Web Appendix and generated F7 PDF report must present the same governed process content without creating a second independently maintained copy.

## Scope

The change is limited to:

- `apps/f7-web`: shared TA Process presentation, Appendix structure, and report-PDF request projection.
- `apps/f7-local-api`: report-PDF request validation and print rendering for Appendix Part 2.

Shared packages, process-requirement evaluation rules, Monte Carlo calculations, workbook state, and the standalone assumption-results PDF remain unchanged.

## Appendix Structure

The existing Appendix remains one expandable workspace section with one PDF inclusion checkbox.

- **Part 1 — Factor Distribution References** retains the current per-Factor distribution plots and ordering.
- **Part 2 — TA Process and Requirements** follows Part 1 and displays the same V3 priority review requirements, priority definitions, recommendation, process actions, warnings, and supporting text shown in the TA Results Interpretation view.
- The current Appendix header, expand/collapse control, and `Include in PDF Report` checkbox remain the only top-level controls.
- Expanding or collapsing the Appendix applies to both parts.
- Part 2 is rendered only when governed process guidance is available. The Appendix remains available when either Part 1 or Part 2 has content.

## Content Reuse

The current TA Process markup and fixed review timing text will be extracted behind a focused reusable Web component or presentation model. Both TA Results Interpretation and Appendix Part 2 consume that shared presentation surface.

The governed process evaluation remains sourced from the current session interpretation. The new Appendix must not re-evaluate rules, alter priority recommendations, or duplicate controlled wording in a second component.

## PDF Behavior

The existing `Include in PDF Report` checkbox controls both Appendix parts as one unit.

When unchecked:

- Neither Part 1 nor Part 2 is added to the F7 report PDF.

When checked:

- The client sends the authoritative Factor distribution entries and the projected TA Process content required by the PDF renderer.
- The PDF renders one Appendix section with Part 1 first and Part 2 second.
- Missing content is omitted at the part level without inventing fallback engineering guidance.
- All incoming text is validated and HTML-escaped by the local API.

The PDF request extension is optional so existing callers remain compatible.

## Data Flow

1. The existing session interpretation produces governed process guidance, priority definitions, and any priority recommendation.
2. A shared Web presentation builder/component normalizes the display data used by TA Results Interpretation and Appendix Part 2.
3. Appendix expansion displays the two parts from their authoritative sources.
4. PDF generation includes both optional part payloads only when the shared Appendix checkbox is selected.
5. The local API validates the optional process payload and renders it after the Factor distribution content.

## Accessibility And Layout

- The Appendix toggle retains correct `aria-expanded` and `aria-controls` behavior for the combined content.
- Part headings use explicit `Part 1` and `Part 2` labels and semantic heading order.
- Existing warning emphasis and V3 labeling are preserved.
- PDF pagination keeps the Part 2 heading with its first content block and avoids splitting individual process-guidance items when practical.
- The design follows the existing restrained engineering-report visual language; no new decorative card layer is introduced.

## Error Handling

- Unavailable process guidance suppresses Part 2 rather than showing stale or fabricated content.
- Invalid PDF process payloads fail request validation consistently with existing report-PDF behavior.
- A Part 2 rendering failure must not silently substitute different guidance.

## Verification

Focused tests will cover:

- TA Results Interpretation still renders the complete existing process content through the shared presentation surface.
- Appendix renders Part 1 then Part 2 under one expansion control.
- Appendix visibility when only one part has content.
- The shared checkbox includes or excludes both parts from the PDF request.
- PDF request schema accepts the optional Part 2 payload and rejects malformed content.
- PDF HTML renders Part 1 before Part 2, preserves warnings and priority content, escapes unsafe text, and omits both parts when not requested.
- Existing F7 report PDF and assumption-results PDF tests remain passing.

## Acceptance Criteria

- Web Appendix visibly labels and orders Part 1 and Part 2.
- Part 2 matches the governed TA Process and Requirements content already shown in the product.
- One expand/collapse control and one PDF checkbox govern the complete Appendix.
- A selected Appendix produces a PDF containing both available parts in the same order as Web.
- No controlled engineering wording or rule evaluation is duplicated.
- Changes remain confined to F7 Web and F7 local API.
