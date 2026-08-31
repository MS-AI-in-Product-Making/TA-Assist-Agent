import { createHash, randomUUID } from "node:crypto";
import { fork, type ChildProcess } from "node:child_process";
import { readFile, readdir, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

const FIXTURE_WORKBOOK = resolve("test/f8-e2e/fixtures/anonymous-ta-workbook.xlsx");
const LOCAL_PATH_PATTERN = /(?:[A-Za-z]:\\|file:\/\/|\\\\|\/Users\/|\/home\/|\/tmp\/|\/var\/)/i;

type F8SessionSnapshot = {
  readonly state: string;
  readonly revision: number;
  readonly artifactRefs?: ReadonlyArray<{ readonly kind: string }>;
  readonly activeAttempt?: unknown;
  readonly downstreamScopeSelection?: { readonly workbookContentHash?: string; readonly selectedWorksheetNames?: readonly string[]; readonly confirmed?: boolean };
  readonly [key: string]: unknown;
};

type HostImportInput = {
  readonly requestId: string;
  readonly sessionId: string;
  readonly fileName: string;
  readonly bytesBase64?: string;
  readonly generatedZip?: true;
  readonly oversize?: true;
};

type ChatHarness = {
  readonly child: ChildProcess;
  readonly rootDir: string;
  readonly origin: string;
  runAnalyze(prompt: string): Promise<{ readonly sessionId: string; readonly url: string; readonly openedUrl?: string; readonly responseText: string; readonly importReceipt?: { readonly artifactId: string; readonly contentHash: string; readonly snapshotRevision: number; readonly state: string } }>;
  createSession(): Promise<string>;
  classifyAnalyzeIntent(prompt: string): Promise<unknown>;
  importPhysicalWorkbook(input: { readonly sessionId: string; readonly workbookPath: string }): Promise<unknown>;
  importHostWorkbook(input: HostImportInput): Promise<unknown>;
  readSnapshot(sessionId: string): Promise<F8SessionSnapshot>;
  authenticate(sessionId: string): Promise<string>;
  stages(sessionId: string): Promise<readonly string[]>;
  close(): Promise<void>;
};

test.describe.configure({ mode: "serial", timeout: 120_000 });

test("Case A accepts an explicit workbook path into one managed session with live Web progress and governed artifacts", async ({ page, context }) => {
  const harness = await startChatHarness();
  try {
    const workbookHash = await sha256File(FIXTURE_WORKBOOK);
    const sseEvents: string[] = [];

    const chat = await harness.runAnalyze(`帮我分析 "${FIXTURE_WORKBOOK}"`);
    expect(chat.responseText).toMatch(/^Workbook accepted\. Session [0-9a-f-]{36} is running in TA Assist Workbench\.$/);
    expect(chat.importReceipt).toMatchObject({ contentHash: workbookHash, snapshotRevision: 1, state: "f0_validating" });
    expect(chat.url).toContain(`session=${chat.sessionId}`);
    expect(chat.openedUrl).toBe(chat.url);
    expect(JSON.stringify(chat)).not.toMatch(LOCAL_PATH_PATTERN);

    await installSessionCookie(context, harness.origin, await harness.authenticate(chat.sessionId));
    await page.goto(chat.url);
    await expect(page.locator(".connection-indicator")).toHaveText("Connected");
    await collectSseEvents(page, harness.origin, chat.sessionId, sseEvents);
    await expect.poll(() => readSession(page.request, harness.origin, chat.sessionId).then((snapshot) => snapshot.state), { timeout: 30_000 }).toBe("review_required");

    const snapshot = await readSession(page.request, harness.origin, chat.sessionId);
    expect(snapshot.artifactRefs?.map((artifact) => artifact.kind)).toEqual(expect.arrayContaining(["f2_report", "f3_report", "f4_calculation", "f5_report", "f6_report"]));
    expect(snapshot.activeAttempt).toBeNull();
    expect(snapshot.downstreamScopeSelection).toMatchObject({ workbookContentHash: workbookHash, selectedWorksheetNames: ["Synthetic_A"], confirmed: true });
    expect(await harness.stages(chat.sessionId)).toEqual(["f0_validating", "f1_f2_running", "f3_running", "f4_running", "f5_running", "f6_running"]);
    expect(sseEvents).toEqual(expect.arrayContaining(["snapshot"]));
    expect(sseEvents).toContain("runner_progress");
    await expectNoLocalPathLeak(harness.rootDir, FIXTURE_WORKBOOK);
  } finally {
    await harness.close();
  }
});

test("Case B opens the same real session for Web multipart upload and downstream analysis", async ({ page, context }) => {
  const harness = await startChatHarness();
  try {
    const chat = await harness.runAnalyze("帮我分析这份 TA 报告");
    expect(chat.responseText).toBe("TA Assist Workbench is ready. Upload a workbook to begin.");
    expect(chat.importReceipt).toBeUndefined();
    expect(chat.url).toContain(`session=${chat.sessionId}`);

    await installSessionCookie(context, harness.origin, await harness.authenticate(chat.sessionId));
    await page.goto(chat.url);
    await expect(page.locator(".connection-indicator")).toHaveText("Connected");
    await expect.poll(() => readSession(page.request, harness.origin, chat.sessionId).then((snapshot) => snapshot.state)).toBe("created");

    const csrfToken = await readCsrf(page.request, harness.origin);
    const file = await readFile(FIXTURE_WORKBOOK);
    const uploadResponse = await page.request.post(`${harness.origin}/api/sessions/${encodeURIComponent(chat.sessionId)}/files`, {
      headers: { "x-csrf-token": csrfToken },
      multipart: {
        kind: "workbook",
        file: { name: basename(FIXTURE_WORKBOOK), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: file },
      },
    });
    expect(uploadResponse.status()).toBe(201);
    const artifact = await uploadResponse.json() as { artifactId: string; contentHash: string };
    const uploadCommand = await page.request.post(`${harness.origin}/api/sessions/${encodeURIComponent(chat.sessionId)}/commands`, {
      headers: { "x-csrf-token": csrfToken },
      data: {
        contractVersion: "f8-session-command-v1",
        sessionId: chat.sessionId,
        commandId: `web-upload-${randomUUID()}`,
        expectedRevision: 0,
        command: "upload_workbook",
        payload: { artifactId: artifact.artifactId, inputClassification: "confidential" },
      },
    });
    expect(uploadCommand.status()).toBe(202);

    await expect.poll(() => readSession(page.request, harness.origin, chat.sessionId).then((snapshot) => snapshot.state), { timeout: 30_000 }).toBe("review_required");
    const snapshot = await readSession(page.request, harness.origin, chat.sessionId);
    expect(snapshot.downstreamScopeSelection?.workbookContentHash).toBe(artifact.contentHash);
    expect(await harness.stages(chat.sessionId)).toEqual(["f0_validating", "f1_f2_running", "f3_running", "f4_running", "f5_running", "f6_running"]);
    await expectNoLocalPathLeak(harness.rootDir, FIXTURE_WORKBOOK);
  } finally {
    await harness.close();
  }
});

test("negative chat and host-import cases fail closed without attempts, duplicate uploads, or path disclosure", async () => {
  const harness = await startChatHarness();
  try {
    expect(await harness.classifyAnalyzeIntent(`Analyze ${FIXTURE_WORKBOOK} and C:\\TA\\second.xlsx`)).toMatchObject({ kind: "invalid_analyze_ta", reason: "multiple_paths" });
    expect(await harness.classifyAnalyzeIntent("Analyze .\\relative.xlsx")).toMatchObject({ kind: "invalid_analyze_ta", reason: "relative_path" });
    expect(await harness.classifyAnalyzeIntent("Analyze https://example.test/report.xlsx")).toMatchObject({ kind: "invalid_analyze_ta", reason: "url_not_allowed" });
    expect(await harness.classifyAnalyzeIntent("Analyze C:\\TA\\report.xlsm")).toMatchObject({ kind: "invalid_analyze_ta", reason: "non_xlsx_path" });
    expect(await harness.classifyAnalyzeIntent("Analyze C:\\TA\\bad.xlsx\u0000")).toMatchObject({ kind: "invalid_analyze_ta", reason: "control_chars" });

    const sessionId = await harness.createSession();
    await expectSanitizedRejection(harness.importPhysicalWorkbook({ sessionId, workbookPath: resolve("test/f8-e2e/fixtures/missing.xlsx") }));
    await expectSanitizedRejection(harness.importPhysicalWorkbook({ sessionId, workbookPath: resolve("test/f8-e2e/fixtures") }));
    await expectSanitizedRejection(harness.importPhysicalWorkbook({ sessionId, workbookPath: resolve("package.json") }));
    await expectSanitizedRejection(harness.importHostWorkbook({ requestId: "malformed", sessionId, fileName: "bad.xlsx", bytesBase64: Buffer.from("not an OOXML workbook").toString("base64") }));
    await expectSanitizedRejection(harness.importHostWorkbook({ requestId: "oversize", sessionId, fileName: "big.xlsx", oversize: true }));
    await expectSanitizedRejection(harness.importHostWorkbook({ requestId: "bad-name", sessionId, fileName: "C:\\secret\\bad.xlsx", generatedZip: true }));

    const first = await harness.importHostWorkbook({ requestId: "duplicate", sessionId, fileName: "duplicate.xlsx", generatedZip: true });
    const second = await harness.importHostWorkbook({ requestId: "duplicate", sessionId, fileName: "duplicate.xlsx", generatedZip: true });
    expect(second).toEqual(first);
    expect((await harness.stages(sessionId)).filter((stage) => stage === "f0_validating")).toHaveLength(1);

    const snapshot = await harness.readSnapshot(sessionId);
    expect(snapshot.revision).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(snapshot)).not.toMatch(LOCAL_PATH_PATTERN);
    await expectNoLocalPathLeak(harness.rootDir, FIXTURE_WORKBOOK);
  } finally {
    await harness.close();
  }
});

async function startChatHarness(): Promise<ChatHarness> {
  const child = fork("test/f8-e2e/chat-entry-server.mjs", [], { cwd: process.cwd(), silent: true });
  const started = await readStartup(child);
  return {
    child,
    ...started,
    runAnalyze: (prompt) => requestChild(child, "runAnalyze", { prompt }),
    createSession: () => requestChild(child, "createSession", {}),
    classifyAnalyzeIntent: (prompt) => requestChild(child, "classifyAnalyzeIntent", { prompt }),
    importPhysicalWorkbook: (input) => requestChild(child, "importPhysicalWorkbook", input),
    importHostWorkbook: ({ requestId, ...input }) => requestChild(child, "importHostWorkbook", { ...input, importRequestId: requestId }),
    readSnapshot: (sessionId) => requestChild(child, "readSnapshot", { sessionId }),
    authenticate: (sessionId) => requestChild(child, "authenticate", { sessionId }),
    stages: (sessionId) => requestChild(child, "stages", { sessionId }),
    async close() {
      await stopChild(child);
      await rm(started.rootDir, { recursive: true, force: true });
    },
  };
}

async function readStartup(child: ChildProcess): Promise<{ origin: string; rootDir: string }> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    child.stdout!.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      const line = stdout.split(/\r?\n/).find((candidate) => candidate.startsWith("{"));
      if (line !== undefined) resolve(JSON.parse(line));
    });
    child.stderr!.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.once("exit", (code) => reject(new Error(stderr || `Chat E2E server exited before readiness (${code}).`)));
    child.once("error", reject);
  });
}

async function requestChild<T>(child: ChildProcess, operation: string, payload: Record<string, unknown>): Promise<T> {
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const onMessage = (value: unknown) => {
      const message = value as { type?: unknown; requestId?: unknown; ok?: unknown; result?: unknown; error?: unknown };
      if (message.type !== "chatEntryResult" || message.requestId !== requestId) return;
      child.off("message", onMessage);
      if (message.ok === true) resolve(message.result as T);
      else {
        const error = message.error as { code?: unknown; summary?: unknown; affectedInputReferences?: unknown } | undefined;
        reject(Object.assign(new Error(`Chat E2E harness operation failed: ${JSON.stringify({ code: error?.code, summary: error?.summary, affectedInputReferences: error?.affectedInputReferences })}`), message.error));
      }
    };
    child.on("message", onMessage);
    child.send?.({ type: "chatEntryRequest", requestId, operation, ...payload }, (error) => {
      if (error !== null) {
        child.off("message", onMessage);
        reject(error);
      }
    });
  });
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill();
  await exited;
}

async function installSessionCookie(context: BrowserContext, origin: string, cookieHeader: string): Promise<void> {
  const value = cookieHeader.match(/ta_session=([^;]+)/)?.[1];
  if (value === undefined) throw new Error("test browser cookie missing");
  await context.addCookies([{ name: "ta_session", value, url: origin, httpOnly: true, sameSite: "Strict" }]);
}

async function readCsrf(request: APIRequestContext, origin: string): Promise<string> {
  const response = await request.get(`${origin}/api/csrf`);
  if (!response.ok()) throw new Error(`csrf fetch failed (${response.status()})`);
  return (await response.json()).csrfToken;
}

async function readSession(request: APIRequestContext, origin: string, sessionId: string): Promise<F8SessionSnapshot> {
  const response = await request.get(`${origin}/api/sessions/${encodeURIComponent(sessionId)}`);
  if (!response.ok()) throw new Error(`session fetch failed (${response.status()})`);
  return await response.json() as F8SessionSnapshot;
}

async function collectSseEvents(page: Page, origin: string, sessionId: string, output: string[]): Promise<void> {
  await page.evaluate(() => { window.__chatEntryEvents = []; });
  await page.evaluate(({ origin, sessionId }) => new Promise<void>((resolve) => {
    const source = new EventSource(`${origin}/api/sessions/${encodeURIComponent(sessionId)}/events`);
    const finish = () => { source.close(); resolve(); };
    source.addEventListener("snapshot", () => { window.__chatEntryEvents.push("snapshot"); });
    source.addEventListener("runner_progress", () => { window.__chatEntryEvents.push("runner_progress"); });
    setTimeout(finish, 750);
  }), { origin, sessionId });
  output.push(...await page.evaluate(() => window.__chatEntryEvents));
}

async function expectNoLocalPathLeak(rootDir: string, workbookPath: string): Promise<void> {
  const files = await listFiles(rootDir);
  const leakedFiles = [];
  const workbookText = workbookPath.replace(/\\/g, "\\\\");
  for (const file of files.filter((candidate) => !candidate.endsWith(".sqlite") && !candidate.endsWith(".sqlite-shm") && !candidate.endsWith(".sqlite-wal") && !candidate.endsWith(".xlsx"))) {
    const text = await readFile(file, "utf8").catch(() => "");
    if (text.includes(workbookPath) || text.includes(workbookText)) leakedFiles.push(file);
  }
  expect(leakedFiles).toEqual([]);
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else files.push(path);
  }
  return files;
}

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function expectSanitizedRejection(promise: Promise<unknown>): Promise<void> {
  let rejected: unknown;
  try {
    await promise;
  } catch (error) {
    rejected = error;
  }
  expect(rejected).toBeDefined();
  expect(JSON.stringify(rejected)).not.toMatch(LOCAL_PATH_PATTERN);
}

declare global {
  interface Window { __chatEntryEvents: string[] }
}
