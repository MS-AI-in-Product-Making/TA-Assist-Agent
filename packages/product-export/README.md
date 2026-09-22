# F6 PDF rendering

`renderF6PdfSync` validates the Markdown SHA-256 and managed-root image
containment, then renders entirely locally with installed Chrome or Edge.
`playwright-core` is a runtime dependency; no downloaded browser is required.

The synchronous API supervises an isolated Node worker for every attempt.
The worker starts a fresh browser/profile, connects to its loopback-only CDP
endpoint, and calls `page.pdf()` with CSS page size and background printing.
Only the validated local HTML and inline images can load: a content security
policy protects both rendering strategies and Playwright also blocks other
requests. Worker/browser output is never included in errors or logs.

Recovery policy:

1. Prefer Chrome, then Edge; deduplicate installed executable locations.
2. Try three Playwright rounds across all installed engines, each with a new
   profile and output path.
3. After all Playwright failures, try CLI `--print-to-pdf` once per engine,
   again in isolated workers with new profiles.
4. Each attempt has its own 60-second hard worker deadline. Expiry kills the
   worker and its owned browser process tree and advances to the next attempt.
   There is **no overall wall-clock cutoff**. Recovery is finite and ends only
   when a valid PDF succeeds or every local strategy fails.

The supervisor retains the browser PID independently of the worker so a hung
CDP connection cannot prevent cleanup. Process-tree cleanup has a separate
five-second bound; transient Windows profile locks are retried for up to five
additional seconds after termination. Working files live in unique `.ta-assist-f6-pdf-*` directories
under the current working directory (which must be writable) and are removed
before return. No governed source report or existing PDF is rewritten.

PDF signature validation remains mandatory; the workflow still hashes exact
PDF bytes and publishes the manifest last. Failures contain only safe engine,
strategy, category, and elapsed-time metadata. An optional `onAttempt` callback
receives those same diagnostics on success or failure; callback exceptions
cannot interrupt recovery. `executeWorker` supports worker injection, while
the existing `executeFile` injection controls CLI fallback.
