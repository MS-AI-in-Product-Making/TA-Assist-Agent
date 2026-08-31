import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { opendir, open, readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const startedAt = new Date();
const root = process.cwd();
const outputRoot = join(root, "F8-session-output", "chat-entry");
const sddReportPath = join(root, ".superpowers", "sdd", "2026-08-31-chat-to-web-ta-analysis", "task-5-report.md");
const rootTaskReportPath = join(root, "task-5-report.md");
const productionWorkbook = resolve("uploads/e80898f5-ba61-4b9b-8243-8b05f310fad3/workbook/6abad918-8cfb-441a-b747-4c00cfef0d54-Maera_gap_TP_brkt_and__battery_20260305V1_-_test.xlsx");
const evidence = [];

const mode = parseMode(process.argv.slice(2));
mkdirSync(outputRoot, { recursive: true });
rmSync(rootTaskReportPath, { force: true });

try {
  if (mode !== "production") {
    run("root build", "npm", ["run", "build"]);
    run("chat-entry deterministic Playwright E2E", "npx", ["playwright", "test", "test/f8-e2e/chat-entry.spec.ts", "--reporter=line"]);
    run("workbench web unit regressions", "node", [".\\node_modules\\vitest\\vitest.mjs", "run", "apps/workbench-web/src", "--reporter=dot"]);
  }

  let production;
  if (mode !== "deterministic") {
    if (mode === "production") run("root build", "npm", ["run", "build"]);
    production = await runProductionEntryVerification();
  }

  writeVerificationReport("DONE", "Chat Task 5 verification completed.", production);
  if (production !== undefined) writeSddTaskReport("DONE", production);
  printFinalStatus("DONE", production);
} catch (error) {
  const production = error?.production;
  const summary = error instanceof Error ? error.message : String(error);
  writeVerificationReport("DONE_WITH_CONCERNS", summary, production);
  writeSddTaskReport("DONE_WITH_CONCERNS", production, summary);
  printFinalStatus("DONE_WITH_CONCERNS", production, summary);
  process.exitCode = error?.exitCode ?? 1;
}

function parseMode(args) {
  if (args.includes("--production")) return "production";
  if (args.includes("--deterministic")) return "deterministic";
  if (args.includes("--all") || args.length === 0) return "all";
  throw new Error(`Unknown mode. Use --all, --deterministic, or --production. Received: ${args.join(" ")}`);
}

function run(label, command, args) {
  const started = new Date();
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
  const finished = new Date();
  evidence.push({ label, command: [command, ...args].join(" "), exitCode: result.status, startedAt: started.toISOString(), finishedAt: finished.toISOString(), stdout: tail(result.stdout), stderr: tail(result.stderr) });
  if (result.status !== 0) {
    const error = new Error(`Verification command failed: ${label}`);
    error.exitCode = result.status ?? 1;
    throw error;
  }
}

async function runProductionEntryVerification() {
  const productionStartedAt = new Date();
  const runId = `${timestampSlug(productionStartedAt)}-${randomUUID()}`;
  const serverRoot = join(outputRoot, "production", runId);
  mkdirSync(serverRoot, { recursive: true });

  const workbook = await readPhysicallyValidatedWorkbook(productionWorkbook);
  const { startWorkbenchServer } = await import(pathToFileURL(join(root, "apps", "workbench-server", "dist", "index.js")).href);
  const { createSessionStore, openSessionStore } = await import("@ai-assist/workbench");
  const sessionId = randomUUID();
  const store = await createSessionStore({ rootDir: serverRoot, sessionId });
  await store.close();

  const started = await startWorkbenchServer({ rootDir: serverRoot, resumeSessionId: sessionId });
  const server = started.server;
  const origin = new URL(started.url).origin;
  const browserAuth = await server.testAuthenticate(sessionId);
  const cookie = browserAuth.headers.cookie;
  const sseEvents = [];
  const stopSse = startSseMonitor(origin, sessionId, cookie, sseEvents);
  const stateTransitions = [];
  let importReceipt;
  let finalSnapshot;
  let businessFailure;

  try {
    importReceipt = await server.importHostWorkbook({ requestId: `production-${runId}`, sessionId, fileName: basename(workbook.path), bytes: workbook.bytes });
    finalSnapshot = await driveProductionSession({ serverRoot, sessionId, origin, cookie, openSessionStore, stateTransitions });
    if (finalSnapshot.state === "failed") businessFailure = readRunnerError(serverRoot, sessionId) ?? { state: "failed" };
  } finally {
    stopSse();
    server.server.closeAllConnections();
    await server.close();
  }

  const productionFinishedAt = new Date();
  const production = {
    status: finalSnapshot?.state === "review_required" ? "DONE" : "DONE_WITH_CONCERNS",
    startedAt: productionStartedAt.toISOString(),
    finishedAt: productionFinishedAt.toISOString(),
    elapsedMs: productionFinishedAt.getTime() - productionStartedAt.getTime(),
    sessionId,
    serverRoot: relativePath(serverRoot),
    origin,
    workbook: { fileName: basename(workbook.path), size: workbook.size, sha256: workbook.sha256 },
    importReceipt,
    stateTransitions,
    sse: { eventCount: sseEvents.length, events: sseEvents.slice(0, 200) },
    artifacts: [],
    persistedLeakCheck: undefined,
    finalState: finalSnapshot?.state,
    businessFailure,
  };

  try {
    production.artifacts = await verifyArtifactHashes(serverRoot, sessionId, finalSnapshot?.artifactRefs ?? [], openSessionStore);
    production.persistedLeakCheck = await assertNoAbsoluteSourcePath({ serverRoot, sourceWorkbookPath: workbook.path });
  } catch (error) {
    error.production = production;
    throw error;
  }

  writeFileSync(join(outputRoot, `production-entry-${runId}.json`), `${JSON.stringify(production, null, 2)}\n`, "utf8");
  if (production.status !== "DONE") {
    const error = new Error(`Production entry finished with ${production.finalState ?? "unknown"}.`);
    error.production = production;
    throw error;
  }
  return production;
}

async function driveProductionSession({ serverRoot, sessionId, origin, cookie, openSessionStore, stateTransitions }) {
  const deadline = Date.now() + 20 * 60_000;
  let lastState;
  let localOnlySubmitted = false;
  while (Date.now() < deadline) {
    const snapshot = await readSnapshot(openSessionStore, serverRoot, sessionId);
    if (snapshot.state !== lastState) {
      stateTransitions.push({ state: snapshot.state, revision: snapshot.revision, at: new Date().toISOString() });
      lastState = snapshot.state;
    }
    if (snapshot.state === "ado_decision_required" && !localOnlySubmitted) {
      await submitSessionCommand(origin, cookie, sessionId, {
        contractVersion: "f8-session-command-v1",
        sessionId,
        commandId: `production-local-only-${randomUUID()}`,
        expectedRevision: snapshot.revision,
        command: "confirm_ado_decision",
        payload: { decision: "local_only" },
      });
      localOnlySubmitted = true;
    }
    if (snapshot.state === "review_required" || snapshot.state === "failed" || snapshot.state === "cancelled") return snapshot;
    await delay(500);
  }
  const timeoutSnapshot = await readSnapshot(openSessionStore, serverRoot, sessionId);
  const error = new Error(`Production entry timed out in state ${timeoutSnapshot.state}.`);
  error.production = { sessionId, finalState: timeoutSnapshot.state, stateTransitions };
  throw error;
}

async function readSnapshot(openSessionStore, rootDir, sessionId) {
  const store = await openSessionStore({ rootDir, sessionId });
  try {
    return await store.readSnapshot();
  } finally {
    await store.close();
  }
}

async function submitSessionCommand(origin, cookie, sessionId, command) {
  const csrfResponse = await fetch(`${origin}/api/csrf`, { headers: { cookie } });
  if (!csrfResponse.ok) throw new Error(`CSRF request failed: ${csrfResponse.status}`);
  const { csrfToken } = await csrfResponse.json();
  const response = await fetch(`${origin}/api/sessions/${encodeURIComponent(sessionId)}/commands`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": csrfToken, cookie },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(`Session command ${command.command} failed: ${response.status} ${await response.text()}`);
  return await response.json();
}

function startSseMonitor(origin, sessionId, cookie, sink) {
  const controller = new AbortController();
  void (async () => {
    try {
      const response = await fetch(`${origin}/api/sessions/${encodeURIComponent(sessionId)}/events`, { headers: { cookie }, signal: controller.signal });
      if (!response.ok || response.body === null) {
        sink.push({ eventName: "sse_open_failed", status: response.status });
        return;
      }
      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      let buffer = "";
      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let splitIndex;
        while ((splitIndex = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, splitIndex);
          buffer = buffer.slice(splitIndex + 2);
          const parsed = parseSseFrame(frame);
          if (parsed !== undefined) sink.push(parsed);
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) sink.push({ eventName: "sse_error", summary: error instanceof Error ? error.message : String(error) });
    }
  })();
  return () => controller.abort();
}

function parseSseFrame(frame) {
  if (frame.startsWith(":")) return undefined;
  const eventName = frame.match(/^event: (.+)$/m)?.[1] ?? "message";
  const dataLine = frame.match(/^data: (.+)$/m)?.[1];
  let state;
  let stage;
  if (dataLine !== undefined) {
    try {
      const payload = JSON.parse(dataLine);
      state = typeof payload?.state === "string" ? payload.state : undefined;
      stage = typeof payload?.stage === "string" ? payload.stage : undefined;
    } catch {
      state = undefined;
    }
  }
  return { eventName, ...(state === undefined ? {} : { state }), ...(stage === undefined ? {} : { stage }) };
}

async function readPhysicallyValidatedWorkbook(workbookPath) {
  const path = resolve(workbookPath);
  if (extname(path).toLowerCase() !== ".xlsx") throw new Error("Production workbook must be an .xlsx file.");
  if (!existsSync(path)) throw new Error(`Production workbook is missing: ${relativePath(path)}`);
  const workspaceReal = realpathSync(root);
  const pathReal = realpathSync(path);
  if (!isContained(workspaceReal, pathReal)) throw new Error("Production workbook must stay under the workspace root.");
  if (!inspectPhysicalPath(root, path)) throw new Error("Production workbook path is not a regular non-linked file path.");
  const handle = await open(path, "r");
  try {
    const [handleStats, targetStats] = await Promise.all([handle.stat(), stat(pathReal)]);
    if (!handleStats.isFile() || handleStats.dev !== targetStats.dev || handleStats.ino !== targetStats.ino) throw new Error("Production workbook changed during validation.");
    const bytes = new Uint8Array(await handle.readFile());
    return { path, size: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex"), bytes };
  } finally {
    await handle.close();
  }
}

function inspectPhysicalPath(rootDir, candidatePath) {
  try {
    const rootReal = realpathSync(rootDir);
    const candidateReal = realpathSync(candidatePath);
    if (!isContained(rootReal, candidateReal)) return false;
    let current = rootReal;
    const relation = relative(rootReal, candidateReal);
    if (lstatSync(current).isSymbolicLink()) return false;
    for (const segment of relation.split(/[\\/]+/).filter(Boolean)) {
      current = join(current, segment);
      const stats = lstatSync(current);
      if (stats.isSymbolicLink()) return false;
      if (current !== candidateReal && !stats.isDirectory()) return false;
    }
    const finalStats = lstatSync(candidateReal);
    return finalStats.isFile() && !finalStats.isSymbolicLink();
  } catch {
    return false;
  }
}

async function verifyArtifactHashes(rootDir, sessionId, artifactRefs, openSessionStore) {
  const artifacts = [];
  const store = await openSessionStore({ rootDir, sessionId });
  let hydratedRefs;
  try {
    hydratedRefs = await Promise.all(artifactRefs.map(async (artifact) => ({ ...artifact, ...await store.readArtifactReference(artifact.artifactId) })));
  } finally {
    await store.close();
  }
  for (const artifact of hydratedRefs) {
    const entry = {
      artifactId: artifact.artifactId,
      kind: artifact.kind,
      revision: artifact.revision,
      validated: artifact.validated,
      relativePath: artifact.relativePath,
      contentHash: artifact.contentHash,
    };
    if (typeof artifact.contentHash === "string" && typeof artifact.relativePath === "string") {
      const path = resolve(rootDir, artifact.relativePath);
      if (!isContained(resolve(rootDir), path)) throw new Error(`Artifact escaped managed root: ${artifact.artifactId}`);
      const bytes = await readFile(path);
      const actualHash = createHash("sha256").update(bytes).digest("hex");
      if (actualHash !== artifact.contentHash) throw new Error(`Artifact hash mismatch for ${artifact.artifactId}`);
      artifacts.push({ ...entry, actualHash });
    } else {
      artifacts.push(entry);
    }
  }
  return artifacts;
}

async function assertNoAbsoluteSourcePath({ serverRoot, sourceWorkbookPath }) {
  const inspected = [];
  const forbiddenSources = sourcePathVariants(sourceWorkbookPath);
  for await (const filePath of walk(serverRoot)) {
    if (!/\.(json|md|txt|log)$/i.test(filePath)) continue;
    const text = await readFile(filePath, "utf8");
    if (forbiddenSources.some((source) => text.toLowerCase().includes(source))) {
      throw new Error(`Persisted text file contains an absolute local path: ${relativePath(filePath)}`);
    }
    inspected.push(relativePath(filePath));
  }
  return { inspectedFileCount: inspected.length, inspectedFiles: inspected.slice(0, 200) };
}

function sourcePathVariants(sourceWorkbookPath) {
  const resolved = resolve(sourceWorkbookPath);
  const real = realpathSync(resolved);
  return [...new Set([
    resolved,
    real,
    resolved.replaceAll("\\", "/"),
    real.replaceAll("\\", "/"),
    pathToFileURL(resolved).href,
    pathToFileURL(real).href,
  ].map((value) => value.toLowerCase()))];
}

async function* walk(directory) {
  const handle = await opendir(directory);
  for await (const entry of handle) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile()) yield path;
  }
}

function readRunnerError(rootDir, sessionId) {
  try {
    return JSON.parse(readFileSync(join(rootDir, "runtime", "workbench", "registries", "runner-errors", `${sessionId}.json`), "utf8"));
  } catch {
    return undefined;
  }
}

function writeVerificationReport(status, summary, production) {
  const finishedAt = new Date();
  const reportPath = join(outputRoot, `verify-chat-entry-${timestampSlug(finishedAt)}.md`);
  const lines = [
    "# Chat Task 5 Verification Report",
    "",
    `Status: ${status}`,
    `Started: ${startedAt.toISOString()}`,
    `Finished: ${finishedAt.toISOString()}`,
    `Elapsed ms: ${finishedAt.getTime() - startedAt.getTime()}`,
    "",
    "## Summary",
    "",
    summary,
    "",
    "## Command Evidence",
    "",
    ...evidence.flatMap((entry) => [
      `### ${entry.label}`,
      `Command: ${entry.command}`,
      `Exit code: ${entry.exitCode}`,
      `Started: ${entry.startedAt}`,
      `Finished: ${entry.finishedAt}`,
      "",
      "```text",
      [entry.stdout, entry.stderr].filter(Boolean).join("\n").trim(),
      "```",
      "",
    ]),
    ...(production === undefined ? [] : ["## Production Entry", "", "```json", JSON.stringify(publicProductionSummary(production), null, 2), "```", ""]),
  ];
  writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
}

function writeSddTaskReport(status, production, concern) {
  mkdirSync(dirname(sddReportPath), { recursive: true });
  const finishedAt = new Date();
  const lines = [
    "# Task 5 Report: Chat-to-Web Production Verification",
    "",
    `Status: ${status}`,
    `Started: ${startedAt.toISOString()}`,
    `Finished: ${finishedAt.toISOString()}`,
    `Elapsed ms: ${production?.elapsedMs ?? finishedAt.getTime() - startedAt.getTime()}`,
    "",
    "## Scope",
    "",
    "- Root build is executed before deterministic Playwright chat-entry verification.",
    "- Production entry creates a real SessionStore session, starts the default Workbench server/runner, imports the existing workbook through host import bytes after physical validation, and submits only the governed local-only ADO decision through the session command API.",
    "- Verification records state transitions, SSE observations, artifact kinds/hashes, and scans persisted JSON/Markdown/log artifacts for absolute source-path leaks.",
    "",
    "## Result",
    "",
    concern === undefined ? "No verifier concern was reported." : concern,
    "",
    "## Production Summary",
    "",
    "```json",
    JSON.stringify(publicProductionSummary(production), null, 2),
    "```",
    "",
  ];
  writeFileSync(sddReportPath, `${lines.join("\n")}\n`, "utf8");
}

function publicProductionSummary(production) {
  if (production === undefined) return undefined;
  return {
    status: production.status,
    sessionId: production.sessionId,
    finalState: production.finalState,
    elapsedMs: production.elapsedMs,
    workbook: production.workbook,
    importReceipt: production.importReceipt,
    stateTransitions: production.stateTransitions,
    sse: production.sse,
    artifacts: production.artifacts.map(({ artifactId, kind, revision, validated, relativePath, contentHash, actualHash }) => ({ artifactId, kind, revision, validated, relativePath, contentHash, actualHash })),
    persistedLeakCheck: production.persistedLeakCheck,
    businessFailure: production.businessFailure,
  };
}

function printFinalStatus(status, production, concern) {
  const payload = {
    status,
    elapsedMs: production?.elapsedMs,
    sessionId: production?.sessionId,
    finalState: production?.finalState,
    artifactKinds: production?.artifacts?.map((artifact) => artifact.kind),
    artifactHashes: production?.artifacts?.map((artifact) => ({ kind: artifact.kind, contentHash: artifact.contentHash })),
    ...(concern === undefined ? {} : { concern }),
  };
  console.log(JSON.stringify(payload, null, 2));
}

function timestampSlug(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function relativePath(path) {
  return relative(root, path).replaceAll("\\", "/");
}

function isContained(rootDir, candidate) {
  const relation = relative(rootDir, candidate);
  return relation === "" || (!relation.startsWith("..") && !/^[A-Za-z]:/.test(relation));
}

function tail(value) {
  const text = String(value ?? "").trim();
  if (text.length <= 6000) return text;
  return text.slice(-6000);
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
