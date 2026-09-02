import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { assertNoProhibitedProductIdentifiers } from "../../packages/product-language/src/index.ts";
import { expect, test, installSessionCookie } from "./workbench-fixture.js";

const FIXTURE_WORKBOOK = resolve("test/f8-e2e/fixtures/anonymous-ta-workbook.xlsx");
const FAILED_EXPORT_SESSION_ID = "80808080-8080-4808-8808-808080808080";
const LOCAL_PATH_PATTERN = /(?:[A-Za-z]:\\|file:\/\/|\\\\|\/Users\/|\/home\/|\/tmp\/|\/var\/)/i;

type SessionSnapshot = { readonly revision: number; readonly state: string };

type ProductExportReceipt = {
  readonly root: string;
  readonly semanticDigest: string;
  readonly exportManifestSha256: string;
  readonly manifest: {
    readonly businessDisposition: "PASS" | "FAIL" | "REVIEW" | "UNKNOWN";
    readonly executionStatus: "completed" | "failed" | "cancelled";
    readonly files: ReadonlyArray<{
      readonly fileName: string;
      readonly mediaType: string;
      readonly sha256: string;
      readonly byteSize: number;
    }>;
  };
};

test.describe.configure({ mode: "serial", timeout: 120_000 });

test("exports business FAIL product output from trusted route artifacts with verified files and no measurement-session side effects", async ({ page, context, workbench }) => {
  await installSessionCookie(context, workbench.origin, workbench.child, workbench.sessionId);
  const beforeRoots = await readExportRoots(workbench.rootDir);

  const snapshot = await readSession(page.request, workbench.origin, workbench.sessionId);
  expect(snapshot.state).toBe("review_required");

  const csrfToken = await readCsrf(page.request, workbench.origin);
  const exportResponse = await page.request.post(`${workbench.origin}/api/sessions/${encodeURIComponent(workbench.sessionId)}/product-export`, {
    headers: {
      "x-csrf-token": csrfToken,
      "content-type": "application/json",
    },
    data: {
      contractVersion: "ta-product-export-command-v1",
      sessionId: workbench.sessionId,
      expectedRevision: snapshot.revision,
      idempotencyKey: `e2e-export-${randomUUID()}`,
    },
  });
  const exportResponseBody = await exportResponse.text();
  expect({ status: exportResponse.status(), body: exportResponseBody }).toMatchObject({ status: 200 });

  const exported = JSON.parse(exportResponseBody) as ProductExportReceipt;
  expect(exported.root.replace(/\\/g, "/")).toContain("runtime/workbench/product-exports");
  const exportRootPath = resolve(workbench.rootDir, exported.root);
  expect(exported.manifest.businessDisposition).toBe("FAIL");
  expect(exported.manifest.executionStatus).toBe("completed");
  expect(exported.semanticDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(exported.exportManifestSha256).toMatch(/^[a-f0-9]{64}$/);

  const rootLayout = await readExportRootLayout(exportRootPath);
  expect(rootLayout.topLevelFiles).toEqual([
    "TA-Analysis-Run-Summary.json",
    "TA-Engineering-Analysis-Report.md",
    "TA-Improvement-Options.md",
    "export-manifest.json",
  ]);
  expect(rootLayout.topLevelDirectories).toEqual(["evidence"]);

  const expectedCoreMediaTypes = new Map<string, string>([
    ["TA-Engineering-Analysis-Report.md", "text/markdown"],
    ["TA-Improvement-Options.md", "text/markdown"],
    ["TA-Analysis-Run-Summary.json", "application/json"],
  ]);
  const expectedEvidenceMediaTypes = new Map<string, string>([
    ["evidence/Drawing-Traceability-Review.json", "application/json"],
    ["evidence/Tolerance-Calculation.json", "application/json"],
    ["evidence/Engineering-Interpretation.json", "application/json"],
    ["evidence/Engineering-Summary-Report.md", "text/markdown"],
  ]);

  for (const [fileName, mediaType] of expectedCoreMediaTypes.entries()) {
    expect(exported.manifest.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ fileName, mediaType }),
    ]));
  }

  const evidenceFiles = exported.manifest.files.filter((file) => file.fileName.startsWith("evidence/"));
  expect(evidenceFiles.length).toBeGreaterThan(0);
  expect(new Set(evidenceFiles.map((file) => file.fileName))).toEqual(new Set(expectedEvidenceMediaTypes.keys()));

  for (const file of exported.manifest.files) {
    if (file.fileName.startsWith("evidence/")) {
      expect(file.mediaType).toBe(expectedEvidenceMediaTypes.get(file.fileName));
    } else {
      expect(file.mediaType).toBe(expectedCoreMediaTypes.get(file.fileName));
    }
    expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(file.byteSize).toBeGreaterThan(0);

    const fileBytes = await readFile(join(exportRootPath, file.fileName));
    expect(fileBytes.byteLength).toBe(file.byteSize);
    expect(createHash("sha256").update(fileBytes).digest("hex")).toBe(file.sha256);

    if (file.mediaType.startsWith("text/") || file.mediaType === "application/json") {
      const text = fileBytes.toString("utf8");
      expect(text).not.toMatch(LOCAL_PATH_PATTERN);
      try {
        assertNoProhibitedProductIdentifiers(text);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Product-surface check failed for ${file.fileName}: ${message}`);
      }
    }
  }

  const exportManifestBytes = await readFile(join(exportRootPath, "export-manifest.json"));
  expect(createHash("sha256").update(exportManifestBytes).digest("hex")).toBe(exported.exportManifestSha256);

  expect(JSON.stringify(exported)).not.toMatch(LOCAL_PATH_PATTERN);
  assertNoMeasurementSessionSideEffects(workbench.rootDir, workbench.sessionId);

  const afterRoots = await readExportRoots(workbench.rootDir);
  expect(afterRoots.length).toBeGreaterThan(beforeRoots.length);
});

test("rejects forged or stale source commands and does not emit a new product export", async ({ page, context, workbench }) => {
  await installSessionCookie(context, workbench.origin, workbench.child, workbench.sessionId);
  const beforeRoots = await readExportRoots(workbench.rootDir);

  const snapshot = await readSession(page.request, workbench.origin, workbench.sessionId);
  const csrfToken = await readCsrf(page.request, workbench.origin);

  const forged = await page.request.post(`${workbench.origin}/api/sessions/${encodeURIComponent(workbench.sessionId)}/product-export`, {
    headers: {
      "x-csrf-token": csrfToken,
      "content-type": "application/json",
    },
    data: {
      contractVersion: "ta-product-export-command-v1",
      sessionId: workbench.sessionId,
      expectedRevision: snapshot.revision,
      idempotencyKey: `e2e-export-forged-${randomUUID()}`,
      sourceRunReference: "forged-client-run",
      verificationStatus: "verified",
      workbook: { fileName: "forged.xlsx", contentHash: "a".repeat(64) },
      finalReport: "# forged\n",
    },
  });
  expect(forged.status()).toBe(400);
  expect(await forged.json()).toEqual({ error: "product_export_schema_rejected" });

  const stale = await page.request.post(`${workbench.origin}/api/sessions/${encodeURIComponent(workbench.sessionId)}/product-export`, {
    headers: {
      "x-csrf-token": csrfToken,
      "content-type": "application/json",
    },
    data: {
      contractVersion: "ta-product-export-command-v1",
      sessionId: workbench.sessionId,
      expectedRevision: snapshot.revision + 1,
      idempotencyKey: `e2e-export-stale-${randomUUID()}`,
    },
  });
  expect(stale.status()).toBe(409);

  const afterRoots = await readExportRoots(workbench.rootDir);
  expect(afterRoots).toEqual(beforeRoots);
});

test("rejects export when TA session execution failed and does not emit a new product export", async ({ page, context, workbench }) => {
  await installSessionCookie(context, workbench.origin, workbench.child, FAILED_EXPORT_SESSION_ID);
  const beforeRoots = await readExportRoots(workbench.rootDir);

  const snapshot = await readSession(page.request, workbench.origin, FAILED_EXPORT_SESSION_ID);
  expect(snapshot.state).toBe("failed");
  const csrfToken = await readCsrf(page.request, workbench.origin);
  const failed = await page.request.post(`${workbench.origin}/api/sessions/${encodeURIComponent(FAILED_EXPORT_SESSION_ID)}/product-export`, {
    headers: {
      "x-csrf-token": csrfToken,
      "content-type": "application/json",
    },
    data: {
      contractVersion: "ta-product-export-command-v1",
      sessionId: FAILED_EXPORT_SESSION_ID,
      expectedRevision: snapshot.revision,
      idempotencyKey: `e2e-export-failed-${randomUUID()}`,
    },
  });
  expect(failed.status()).toBeGreaterThanOrEqual(400);
  expect(failed.status()).toBeLessThan(500);

  const afterRoots = await readExportRoots(workbench.rootDir);
  expect(afterRoots).toEqual(beforeRoots);
});

function assertNoMeasurementSessionSideEffects(rootDir: string, expectedSessionId: string): void {
  const database = new DatabaseSync(join(rootDir, "runtime", "workbench", "workbench.sqlite"), { readOnly: true, timeout: 5_000 });
  try {
    const rows = database.prepare("SELECT session_id, snapshot_json FROM sessions").all() as Array<{ session_id: string; snapshot_json: string }>;
    expect(rows.map((row) => row.session_id)).toContain(expectedSessionId);
    const states = rows.map((row) => {
      const snapshot = JSON.parse(row.snapshot_json) as { state?: unknown };
      return typeof snapshot.state === "string" ? snapshot.state : "";
    });
    expect(states.some((state) => /measurement/i.test(state))).toBe(false);
  } finally {
    database.close();
  }
}

async function readCsrf(request: { get(url: string): Promise<{ ok(): boolean; status(): number; json(): Promise<{ csrfToken: string }> }> }, origin: string): Promise<string> {
  const response = await request.get(`${origin}/api/csrf`);
  if (!response.ok()) throw new Error(`csrf fetch failed (${response.status()})`);
  return (await response.json()).csrfToken;
}

async function readSession(request: { get(url: string): Promise<{ ok(): boolean; status(): number; json(): Promise<SessionSnapshot> }> }, origin: string, sessionId: string): Promise<SessionSnapshot> {
  const response = await request.get(`${origin}/api/sessions/${encodeURIComponent(sessionId)}`);
  if (!response.ok()) throw new Error(`session fetch failed (${response.status()})`);
  return await response.json() as SessionSnapshot;
}

async function readExportRoots(rootDir: string): Promise<string[]> {
  const exportsRoot = join(rootDir, "runtime", "workbench", "product-exports");
  const entries = await readdir(exportsRoot, { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function readExportRootLayout(root: string): Promise<{ topLevelFiles: string[]; topLevelDirectories: string[] }> {
  const entries = await readdir(root, { withFileTypes: true });
  return {
    topLevelFiles: entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort(),
    topLevelDirectories: entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(),
  };
}`r`n