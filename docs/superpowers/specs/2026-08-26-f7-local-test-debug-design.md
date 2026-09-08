# F7 Local Test and Debug Design

## Goal

Exercise the F7 local web workflow with `Test_TP_Step_202600805.xlsx`, identify reproducible defects, and improve the F7 modules without allowing confidential samples or generated test artifacts into Git.

## Data Isolation

- Treat the workbook and all derived data as confidential local test material.
- Store the workbook copy, browser screenshots, console logs, network observations, and disposable automation under `local-test/f7/<run-id>/`.
- Rely on the existing repository rule that ignores `local-test/`, and verify it with `git check-ignore` and `git status` before completion.
- Do not copy workbook data into tracked fixtures, source files, snapshots, or design documentation.

## Test Stages

1. Establish a clean baseline with the focused F7 unit tests and F7 web build.
2. Start the local API and web application with `npm run dev:f7`.
3. Verify API and browser availability on `127.0.0.1:4317` and `127.0.0.1:5177`.
4. Run the workbook through import, worksheet selection, factor confirmation, source-mode selection, measurement handling, capability analysis, distribution fit and approval, Monte Carlo, and report generation as far as the workbook and current Phase 1 boundary permit.
5. Capture screenshots, browser console errors, failed requests, and exact reproduction steps under the run directory.
6. Classify each observation as expected limitation, usability issue, data compatibility issue, or functional defect.

## Debugging Workflow

For each functional defect:

1. Reproduce it consistently and trace the failing request or state transition.
2. State one root-cause hypothesis supported by the captured evidence.
3. Add the narrowest failing automated test that represents the behavior.
4. Apply one focused fix at the owning module.
5. Re-run the focused test, relevant F7 suite, build, and browser scenario.

Expected Phase 1 constraints, such as unsupported workbook structures or baseline factors without a governed sampler, are reported separately rather than silently patched around.

## Completion Criteria

- The local stack starts and its endpoints respond.
- The supplied workbook is exercised through every reachable workflow stage.
- Every discovered issue has evidence, classification, and a reproducible scenario.
- Implemented fixes have focused regression tests and pass relevant validation.
- `git status` contains no workbook, confidential sample, screenshot, log, or disposable test artifact.