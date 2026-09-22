# F6 PDF rendering

`renderF6PdfSync` validates the Markdown SHA-256 and managed-root image
containment, then renders entirely locally with installed Chrome or Edge.
`playwright-core` and `tree-kill` are direct runtime dependencies; no downloaded
browser is required.

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
4. Playwright rounds use progressively longer per-engine deadlines: 30, 120,
   then 300 seconds. The final CLI fallback allows 600 seconds per engine.
   Expiry kills the live owned worker and all its descendants, then advances.
   Healthy slow renders can complete on later attempts; success returns immediately.
   There is **no overall wall-clock cutoff**. Recovery is finite and ends only
   when a valid PDF succeeds or every local strategy fails.

The synchronous boundary launches a local asynchronous supervisor that owns the
worker `ChildProcess` from spawn until close. No browser PID file is used.
Both Playwright and CLI workers await browser process close and flush the PDF,
then send the allowlisted IPC status `READY_SUCCESS`. They hold their PID alive
until the supervisor sends `ACK_COMMIT` or controlled `ABORT`; there is no
independent successful exit. The supervisor serializes READY and timeout in
one event loop. READY-first cancels the render deadline, validates the PDF
signature/length, sends the decision, and waits for worker close. Invalid output
gets `ABORT` and remains a failed attempt, not a committed artifact.

Timeout-first marks termination before starting Windows taskkill `/T /F`
or Unix process-group termination, and never acknowledges late READY.
The worker therefore remains alive at its original PID while asynchronous
taskkill is resolving its target. Once a decision is sent, or exit/close is
observed, no further PID-targeted termination is scheduled. Launch/close
failures also leave the worker live for supervisor-owned tree cleanup.
Unexpected supervisor IPC disconnect triggers worker-owned browser cleanup;
if graceful close cannot complete, the still-live worker terminates its own
tree. Normal timeout cleanup never disconnects IPC to trigger this guard.
Process-tree termination and worker close have a separate five-second bound;
an outstanding Windows taskkill is cancelled through its owned process handle
and its close confirmed before the supervisor can disconnect the worker.
Failure to confirm cleanup returns `cleanup_failed`. Transient Windows profile
locks are retried for up to five
additional seconds after termination. Working files live in unique `.ta-assist-f6-pdf-*` directories
under the current working directory (which must be writable) and are removed
before return. No governed source report or existing PDF is rewritten.

PDF signature validation remains mandatory; the workflow still hashes exact
PDF bytes and publishes the manifest last. Failures contain only safe engine,
strategy, category, elapsed-time, and actual deadline metadata. An optional `onAttempt` callback
receives those same diagnostics on success or failure; callback exceptions
cannot interrupt recovery. `executeWorker` supports worker injection, while
the existing `executeFile` injection controls CLI fallback. Internal `deadlines`
dependency injection accepts exactly three strictly increasing Playwright
deadlines and a longer CLI deadline, each a positive integer at most 600,000 ms.
Deadlines are not read from environment variables or user input. There is no
global timer that abandons the report after 90 seconds (or any other duration).
