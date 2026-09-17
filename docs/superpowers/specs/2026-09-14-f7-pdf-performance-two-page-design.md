# F7 PDF Performance and Two-Page Decision Brief Design

**Date:** 2026-09-14
**Status:** Approved
**Target branch:** `User/Ralf/F7_Generate_a_PDF_Report`
**Selected layout:** A - Decision Brief

## Goal

Reduce the user-visible PDF generation delay substantially, provide explicit completion feedback, and format a representative F7 assumption-results report as a readable two-page A4 landscape document.

## Decision

Keep the controlled server-generated PDF workflow. Do not replace it with a screenshot or direct `window.print()` flow.

Direct Web printing opens a browser print dialog and cannot provide the existing one-click automatic download. Canvas-based client export would reduce text searchability and produce less reliable tables and charts. The existing structured request and report-native HTML/SVG renderer preserve searchable text, controlled content, sharp charts, and deterministic filenames.

The implementation will remove the process-wait bottleneck from the current Edge/Chrome invocation and compact the print layout into the approved Decision Brief composition.

## Performance Diagnosis and Design

The current renderer launches Edge/Chrome through `execFile`, which captures child stdout and stderr. Chromium helper processes can inherit those pipes after the main print process exits, delaying callback completion even though rendering has finished. During the observed slow request, the HTTP connection remained open while only an Edge crash-reporting descendant remained.

The renderer will use a bounded browser-process adapter that:

- launches only a controlled installed Edge or Chrome executable;
- does not capture stdout or stderr;
- hides the Windows process window;
- keeps the existing isolated temporary browser profile;
- waits for deterministic process completion;
- terminates a hung process after a bounded timeout;
- validates the generated file as non-empty `%PDF-` bytes;
- preserves queue limits and temporary-directory cleanup.

The API contract and frontend request payload remain unchanged.

## Two-Page Composition

The report remains A4 landscape and uses two explicit report page groups.

### Page 1 - Decision and Diagnosis

- report title and workbook/worksheet source
- TA Result Summary
- overall assessment
- Root Cause Analysis

### Page 2 - Action and Priority

- Suggested Action Sequence
- contributor Pareto chart
- tolerance-adjustment priority table
- TA Process and Requirements

Print CSS will reduce excess vertical spacing, use compact but readable table cells, keep headings with their content, and avoid splitting individual evidence and guidance items. The second page starts with an explicit page break.

The representative current F7 payload must render in exactly two pages without clipping or overlap. Longer valid narratives or unusually large bounded collections may extend to a third page rather than truncate engineering evidence or reduce text below the readable minimum.

## User Feedback

The existing button continues to show `Generating PDF...` and remains disabled while the request is active.

After a successful download starts, an accessible polite live region displays a completion message including elapsed time, for example `PDF downloaded in 1.8 seconds.` The message remains visible until the next generation attempt or the session changes. Failures continue to display the actionable inline error and never show a success state.

## Error Handling

- Browser launch, timeout, missing output, invalid output, and cleanup failures continue through the existing API error envelope.
- A timed-out render releases its queue slot so the next request can proceed.
- Session changes and component unmounts continue to suppress stale downloads and stale status messages.
- No partial or invalid PDF is downloaded.

## Testing

Use test-driven development in focused slices:

1. Add a failing process-adapter test that reproduces a browser main process completing while descendant pipe handles remain open.
2. Replace captured process execution with the bounded non-capturing adapter and verify timeout and error propagation.
3. Add renderer assertions for the two explicit page groups, page break, compact print rules, and complete section coverage.
4. Add Vue tests for generating, success-with-elapsed-time, failure, session-change, and unmount states.
5. Run focused F7 API and Web tests and builds.
6. Generate a real representative PDF, verify `%PDF-`, confirm exactly two pages, and inspect rendered pages for clipping, overlap, legibility, and complete content.
7. Measure representative end-to-end generation time on the current Windows development machine before and after the process-adapter change.

## Acceptance Criteria

- One click still downloads a searchable PDF without opening a print dialog.
- The representative F7 report generates in no more than 5 seconds on the current development machine after the API is ready.
- The representative F7 report contains exactly two A4 landscape pages.
- Page 1 presents decision and diagnosis; page 2 presents action and priority.
- No visible report section or engineering evidence from the representative payload is omitted, clipped, or overlapped.
- The UI reports successful download with elapsed time and reports failures accessibly.
- Renderer timeout, queue release, PDF validation, and cleanup remain enforced.
- No workbook write-back, remote upload, F6 change, or shared-package change is introduced.
