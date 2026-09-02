import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it, vi } from "vitest";
import * as workbench from "@ai-assist/workbench";

import { canonicalSelectedWorksheetSetHash, createSessionStore, openSessionStore } from "@ai-assist/workbench";

import { exportTaAnalysisForSession } from "./ta-product-exporter.js";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function projectionTemplate(gatingEvidenceReferences: readonly string[] = ["F3:Analysis-A:governance", "F5:Analysis-A:SIGNAL"]) {
  return {
    schemaVersion: "ta-engineering-report-projection-v1",
    title: "TA Engineering Analysis Report",
    workbookDisposition: "FAIL",
    worksheetDispositions: [{ worksheetName: "Analysis-A", disposition: "FAIL" }],
    workbook: {
      fileName: "Anonymous.xlsx",
      contentHash: "a".repeat(64),
    },
    worksheets: [{
      worksheetName: "Analysis-A",
      toleranceLoopDescription: "Loop A",
      disposition: "FAIL",
      requiredAction: "Engineering review required before release decision",
      findings: ["Finding A"],
      assumptions: ["Assumption A"],
      clarifications: ["Clarification A"],
      gatingEvidenceReferences,
    }],
  } as const;
}

async function writeArtifact(rootDir: string, absolutePath: string, value: string): Promise<{ relativePath: string; contentHash: string }> {
  await mkdir(join(absolutePath, ".."), { recursive: true });
  await writeFile(absolutePath, value, "utf8");
  return { relativePath: relative(rootDir, absolutePath), contentHash: sha256(value) };
}

async function seedValidatedSession(
  rootDir: string,
  sessionId: string,
  projection = projectionTemplate(),
  selection: {
    readonly initialSelectedWorksheetNames?: readonly string[];
    readonly downstreamSelectedWorksheetNames?: readonly string[];
  } = {},
) {
  const initialSelectedWorksheetNames = [...(selection.initialSelectedWorksheetNames ?? ["Analysis-A"])];
  const downstreamSelectedWorksheetNames = [...(selection.downstreamSelectedWorksheetNames ?? ["Analysis-A"])];
  const productionRoot = join(rootDir, "runtime", "workbench", "runner-output", sessionId, "production");
  const f2Root = join(productionRoot, "f2");
  const f3Root = join(productionRoot, "f3");
  const f4Root = join(productionRoot, "f4");
  const f5Root = join(productionRoot, "f5");
  const f6Root = join(productionRoot, "f6", "2026-09-02T00-00-00-000Z");
  await mkdir(f6Root, { recursive: true });

  const f2 = await writeArtifact(rootDir, join(f2Root, "Feature2-Report.json"), `${JSON.stringify({ status: "completed" })}\n`);
  const f3 = await writeArtifact(rootDir, join(f3Root, "Feature3-Report.json"), `${JSON.stringify({ status: "completed" })}\n`);
  const f4 = await writeArtifact(rootDir, join(f4Root, "Feature4-Calculation.json"), `${JSON.stringify({ status: "completed" })}\n`);
  const f5 = await writeArtifact(rootDir, join(f5Root, "Feature5-Report.json"), `${JSON.stringify({ status: "completed" })}\n`);
  const f6Optimization = await writeArtifact(rootDir, join(f6Root, "Feature6-Optimization.json"), `${JSON.stringify({ status: "completed" })}\n`);
  const f6Report = await writeArtifact(rootDir, join(f6Root, "Feature6-Report.md"), "# TA Engineering Analysis Report\n");
  const projectionRoot = join(rootDir, "runtime", "workbench", "managed-artifacts", sessionId, "engineering-summary-projection");
  const f6Projection = await writeArtifact(rootDir, join(projectionRoot, "revision-1.json"), `${JSON.stringify(projection, null, 2)}\n`);
  await writeArtifact(rootDir, join(f6Root, "Feature6-Optimization.md"), "# TA Improvement Options\n");
  await writeArtifact(rootDir, join(f6Root, "Feature6-Run-Summary.json"), "{\"status\":\"completed\"}\n");

  const reviewContext = {
    workbookHash: "a".repeat(64),
    downstreamSelectionHash: canonicalSelectedWorksheetSetHash(downstreamSelectedWorksheetNames),
    baselineRunReference: "f2-run-2026-09-02",
  };

  const store = await createSessionStore({ rootDir, sessionId });
  try {
    await store.applyCommand({
      contractVersion: "f8-session-command-v1",
      sessionId,
      commandId: "seed-product-export",
      expectedRevision: 0,
      command: "upload_workbook",
      payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
    }, async (snapshot) => ({
      snapshot: {
        ...snapshot,
        revision: 1,
        inputRevision: 1,
        state: "review_required",
        activeAttempt: null,
        initialScopeSelection: {
          workbookContentHash: "a".repeat(64),
          selectedWorksheetNames: initialSelectedWorksheetNames,
          confirmed: true,
          provenance: "user",
        },
        downstreamScopeSelection: {
          workbookContentHash: "a".repeat(64),
          selectedWorksheetNames: downstreamSelectedWorksheetNames,
          confirmed: true,
          provenance: "user",
        },
        priorRunReferences: [{ featureId: "F2", referenceId: "f2-ref", contractVersion: "v1", workbookHash: "a".repeat(64), runReference: "f2-run-2026-09-02" }],
      },
      artifactReferenceOps: {
        upsert: [
          { artifactId: "f2-report", sessionId, inputRevision: 1, kind: "f2_report", relativePath: f2.relativePath, contentHash: f2.contentHash },
          { artifactId: "f3-report", sessionId, inputRevision: 1, kind: "f3_report", relativePath: f3.relativePath, contentHash: f3.contentHash, reviewContext },
          { artifactId: "f4-calculation", sessionId, inputRevision: 1, kind: "f4_calculation", relativePath: f4.relativePath, contentHash: f4.contentHash, reviewContext },
          { artifactId: "f5-report", sessionId, inputRevision: 1, kind: "f5_report", relativePath: f5.relativePath, contentHash: f5.contentHash, reviewContext },
          { artifactId: "f6-optimization", sessionId, inputRevision: 1, kind: "f6_optimization", relativePath: f6Optimization.relativePath, contentHash: f6Optimization.contentHash, reviewContext },
          { artifactId: "f6-report", sessionId, inputRevision: 1, kind: "f6_report", relativePath: f6Report.relativePath, contentHash: f6Report.contentHash, reviewContext },
          {
            artifactId: "engineering-summary-projection:1",
            sessionId,
            inputRevision: 1,
            kind: "engineering_summary_projection",
            relativePath: f6Projection.relativePath,
            contentHash: f6Projection.contentHash,
            reviewContext,
            metadata: { reviewContext },
          },
        ],
      },
    }));
  } finally {
    await store.close();
  }

  await mkdir(join(rootDir, "runtime", "workbench", "registries", "production-roots"), { recursive: true });
  await writeFile(
    join(rootDir, "runtime", "workbench", "registries", "production-roots", `${sessionId}.json`),
    JSON.stringify({ f1Root: join(productionRoot, "f1"), f2Root, f3Root, f4Root, f5Root, f6Root }),
    "utf8",
  );
  return {
    f6ProjectionPath: join(projectionRoot, "revision-1.json"),
    productionRoot,
    f3Root,
    f4Root,
    f5Root,
    f6Root,
  };
}

async function corruptPersistedSnapshotWithDuplicateDownstreamSelection(
  rootDir: string,
  sessionId: string,
  duplicateSelection: readonly string[] = ["Analysis-A", "Analysis-A"],
): Promise<void> {
  const databasePath = join(rootDir, "runtime", "workbench", "workbench.sqlite");
  const database = new DatabaseSync(databasePath, {
    enableForeignKeyConstraints: true,
    timeout: 5_000,
  });
  try {
    const row = database.prepare(`SELECT snapshot_json FROM sessions WHERE session_id = ?`).get(sessionId) as { snapshot_json: string } | undefined;
    if (row === undefined) {
      throw new Error(`Missing persisted snapshot for session ${sessionId}`);
    }

    const snapshot = JSON.parse(row.snapshot_json) as {
      readonly downstreamScopeSelection?: {
        readonly workbookContentHash: string;
        readonly selectedWorksheetNames: readonly string[];
        readonly confirmed: boolean;
        readonly provenance: "user" | "system";
      };
    };
    const downstream = snapshot.downstreamScopeSelection;
    if (downstream === undefined) {
      throw new Error(`Missing downstream scope selection for session ${sessionId}`);
    }

    const mutated = {
      ...snapshot,
      downstreamScopeSelection: {
        ...downstream,
        selectedWorksheetNames: [...duplicateSelection],
      },
    };
    database.prepare(`UPDATE sessions SET snapshot_json = ? WHERE session_id = ?`).run(JSON.stringify(mutated), sessionId);
  } finally {
    database.close();
  }
}

function readPersistedSnapshotJson(rootDir: string, sessionId: string): unknown {
  const databasePath = join(rootDir, "runtime", "workbench", "workbench.sqlite");
  const database = new DatabaseSync(databasePath, {
    enableForeignKeyConstraints: true,
    timeout: 5_000,
  });
  try {
    const row = database.prepare(`SELECT snapshot_json FROM sessions WHERE session_id = ?`).get(sessionId) as { snapshot_json: string } | undefined;
    if (row === undefined) {
      throw new Error(`Missing persisted snapshot for session ${sessionId}`);
    }
    return JSON.parse(row.snapshot_json) as unknown;
  } finally {
    database.close();
  }
}

describe("exportTaAnalysisForSession", () => {
  it("accepts non-sorted downstream worksheet selection when reviewContext hash uses canonical set hash", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ta-exporter-nonsorted-selection-"));
    const sessionId = "50505050-5050-4505-8505-505050505050";
    try {
      const projection = {
        ...projectionTemplate(["F3:Analysis-A:governance", "F3:Analysis-B:governance"]),
        worksheetDispositions: [
          { worksheetName: "Analysis-B", disposition: "FAIL" },
          { worksheetName: "Analysis-A", disposition: "FAIL" },
        ],
        worksheets: [
          {
            ...projectionTemplate(["F3:Analysis-A:governance", "F3:Analysis-B:governance"]).worksheets[0],
            worksheetName: "Analysis-B",
            toleranceLoopDescription: "Loop B",
            gatingEvidenceReferences: ["F3:Analysis-B:governance"],
          },
          {
            ...projectionTemplate(["F3:Analysis-A:governance", "F3:Analysis-B:governance"]).worksheets[0],
            worksheetName: "Analysis-A",
            toleranceLoopDescription: "Loop A",
            gatingEvidenceReferences: ["F3:Analysis-A:governance"],
          },
        ],
      };
      await seedValidatedSession(rootDir, sessionId, projection, {
        initialSelectedWorksheetNames: ["Analysis-A", "Analysis-B"],
        downstreamSelectedWorksheetNames: ["Analysis-B", "Analysis-A"],
      });

      const exported = await exportTaAnalysisForSession({
        contractVersion: "ta-product-export-command-v1",
        sessionId,
        expectedRevision: 1,
        idempotencyKey: "export-nonsorted-selection",
      }, { rootDir });

      expect(exported.manifest.worksheetScope).toEqual(["Analysis-B", "Analysis-A"]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("fails closed when downstream worksheet selection contains duplicate worksheet names", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ta-exporter-duplicate-selection-"));
    const sessionId = "50909090-5090-4509-8509-509090909090";
    const actualOpenSessionStore = workbench.openSessionStore;
    const openSessionStoreSpy = vi.spyOn(workbench, "openSessionStore");
    try {
      await seedValidatedSession(rootDir, sessionId, projectionTemplate(), {
        initialSelectedWorksheetNames: ["Analysis-A"],
        downstreamSelectedWorksheetNames: ["Analysis-A"],
      });

      await corruptPersistedSnapshotWithDuplicateDownstreamSelection(rootDir, sessionId, ["Analysis-A", "Analysis-A"]);

      openSessionStoreSpy.mockImplementation(async (options) => {
        const store = await actualOpenSessionStore(options);
        const corruptedSnapshot = readPersistedSnapshotJson(options.rootDir, options.sessionId) as Awaited<ReturnType<typeof store.readSnapshot>>;
        return {
          readSnapshot: async () => corruptedSnapshot,
          readArtifactReference: store.readArtifactReference.bind(store),
          readCommandReceipt: store.readCommandReceipt.bind(store),
          readCommittedCommand: store.readCommittedCommand.bind(store),
          applyCommand: store.applyCommand.bind(store),
          recordAttemptResult: store.recordAttemptResult.bind(store),
          close: store.close.bind(store),
        };
      });

      await expect(exportTaAnalysisForSession({
        contractVersion: "ta-product-export-command-v1",
        sessionId,
        expectedRevision: 1,
        idempotencyKey: "export-duplicate-selection",
      }, { rootDir })).rejects.toMatchObject({
        code: "evidence_mismatch",
        summary: expect.stringMatching(/duplicate worksheet names/i),
      });
    } finally {
      openSessionStoreSpy.mockRestore();
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("detects real projection mutation drift and rejects stale source", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ta-exporter-projection-"));
    const sessionId = "51515151-5151-4515-8515-515151515151";
    try {
      const seeded = await seedValidatedSession(rootDir, sessionId);
      const command = { contractVersion: "ta-product-export-command-v1", sessionId, expectedRevision: 1, idempotencyKey: "export-1" } as const;

      const first = await exportTaAnalysisForSession(command, { rootDir });
      expect(first.semanticDigest).toMatch(/^[a-f0-9]{64}$/);

      const mutated = projectionTemplate();
      const driftedProjection = {
        ...mutated,
        worksheets: [{
          ...mutated.worksheets[0],
          findings: ["Finding drifted"],
          assumptions: ["Assumption drifted"],
          clarifications: ["Clarification drifted"],
          gatingEvidenceReferences: ["F3:Analysis-A:governance"],
        }],
      };
      await writeFile(seeded.f6ProjectionPath, `${JSON.stringify(driftedProjection, null, 2)}\n`, "utf8");

      await expect(exportTaAnalysisForSession(command, { rootDir })).rejects.toMatchObject({ code: "evidence_mismatch" });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("exports only projection-referenced evidence and skips evidence directory when no refs", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ta-exporter-evidence-"));
    const sessionId = "52525252-5252-4525-8525-525252525252";
    try {
      await seedValidatedSession(rootDir, sessionId, projectionTemplate([]));
      const exported = await exportTaAnalysisForSession({ contractVersion: "ta-product-export-command-v1", sessionId, expectedRevision: 1, idempotencyKey: "export-2" }, { rootDir });
      expect(exported.manifest.files.some((file) => file.fileName.startsWith("evidence/"))).toBe(false);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("returns out-of-band export manifest hash and persists internal export record", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ta-exporter-store-"));
    const sessionId = "53535353-5353-4535-8535-535353535353";
    try {
      await seedValidatedSession(rootDir, sessionId);
      const exported = await exportTaAnalysisForSession({ contractVersion: "ta-product-export-command-v1", sessionId, expectedRevision: 1, idempotencyKey: "export-3" }, { rootDir });
      const manifestPath = resolve(rootDir, exported.root, "export-manifest.json");
      const manifestBytes = await readFile(manifestPath);
      const expectedManifestSha = createHash("sha256").update(manifestBytes).digest("hex");
      expect(exported.exportManifestSha256).toBe(expectedManifestSha);
      expect((exported.manifest as Record<string, unknown>).exportManifestSha256).toBeUndefined();

      const recordPath = join(rootDir, "runtime", "workbench", "product-export-store", `${basename(exported.root)}.json`);
      const record = JSON.parse(await readFile(recordPath, "utf8")) as Record<string, unknown>;
      expect(record.status).toBe("completed");
      expect(record.semanticDigest).toBe(exported.semanticDigest);
      expect(record.exportManifestSha256).toBe(exported.exportManifestSha256);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("requires one current validated projection artifact registration instead of sibling-path guessing", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ta-exporter-projection-registration-"));
    const sessionId = "54545454-5454-4545-8545-545454545454";
    try {
      await seedValidatedSession(rootDir, sessionId);
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "remove-projection-registration",
          expectedRevision: 1,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot,
          artifactReferenceOps: { delete: ["engineering-summary-projection:1"] },
        }));
      } finally {
        await store.close();
      }

      await expect(exportTaAnalysisForSession({
        contractVersion: "ta-product-export-command-v1",
        sessionId,
        expectedRevision: 2,
        idempotencyKey: "export-projection-registration",
      }, { rootDir })).rejects.toMatchObject({ code: "evidence_mismatch" });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("fails closed when production-roots binding is missing or drifted", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ta-exporter-roots-binding-"));
    const sessionId = "56565656-5656-4565-8565-565656565656";
    try {
      const seeded = await seedValidatedSession(rootDir, sessionId);
      await rm(join(rootDir, "runtime", "workbench", "registries", "production-roots", `${sessionId}.json`), { force: true });
      await expect(exportTaAnalysisForSession({
        contractVersion: "ta-product-export-command-v1",
        sessionId,
        expectedRevision: 1,
        idempotencyKey: "export-roots-missing",
      }, { rootDir })).rejects.toMatchObject({ code: "evidence_mismatch" });

      await writeFile(
        join(rootDir, "runtime", "workbench", "registries", "production-roots", `${sessionId}.json`),
        JSON.stringify({
          f1Root: join(seeded.productionRoot, "f1"),
          f2Root: join(seeded.productionRoot, "f2"),
          f3Root: join(seeded.productionRoot, "f3"),
          f4Root: join(seeded.productionRoot, "f4"),
          f5Root: join(seeded.productionRoot, "f5"),
          f6Root: join(seeded.productionRoot, "f6", "mismatch"),
        }),
        "utf8",
      );
      await expect(exportTaAnalysisForSession({
        contractVersion: "ta-product-export-command-v1",
        sessionId,
        expectedRevision: 1,
        idempotencyKey: "export-roots-drift",
      }, { rootDir })).rejects.toMatchObject({ code: "evidence_mismatch" });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects symlink or junction evidence paths based on the original artifact path", async ({ skip }) => {
    const rootDir = await mkdtemp(join(tmpdir(), "ta-exporter-evidence-symlink-"));
    const sessionId = "57575757-5757-4575-8575-575757575757";
    try {
      const seeded = await seedValidatedSession(rootDir, sessionId);
      const linkedParent = join(seeded.productionRoot, "links");
      const linkedEvidenceRoot = join(linkedParent, "evidence-link");
      await mkdir(linkedParent, { recursive: true });
      try {
        await symlink(seeded.f3Root, linkedEvidenceRoot, "junction");
      } catch {
        skip("Junction creation unavailable in this environment.");
        return;
      }

      const linkedReportPath = join(linkedEvidenceRoot, "Feature3-Report.json");
      const linkedHash = sha256(await readFile(linkedReportPath, "utf8"));
      const store = await openSessionStore({ rootDir, sessionId });
      try {
        await store.applyCommand({
          contractVersion: "f8-session-command-v1",
          sessionId,
          commandId: "rebind-f3-to-symlink",
          expectedRevision: 1,
          command: "upload_workbook",
          payload: { fileName: "book.xlsx", workbookBytes: new Uint8Array([80, 75, 3, 4]), inputClassification: "confidential" },
        }, async (snapshot) => ({
          snapshot,
          artifactReferenceOps: {
            upsert: [{
              artifactId: "f3-report",
              sessionId,
              inputRevision: 1,
              kind: "f3_report",
              relativePath: relative(rootDir, linkedReportPath),
              contentHash: linkedHash,
              reviewContext: {
                workbookHash: "a".repeat(64),
                downstreamSelectionHash: createHash("sha256").update(JSON.stringify(["Analysis-A"])) .digest("hex"),
                baselineRunReference: "f2-run-2026-09-02",
              },
            }],
          },
        }));
      } finally {
        await store.close();
      }

      await expect(exportTaAnalysisForSession({
        contractVersion: "ta-product-export-command-v1",
        sessionId,
        expectedRevision: 2,
        idempotencyKey: "export-symlink-evidence",
      }, { rootDir })).rejects.toMatchObject({ code: "policy_denied" });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it.each(["PASS", "FAIL", "CONDITIONAL_PASS", "INCOMPLETE"] as const)(
    "keeps %s business disposition exportable when execution completed",
    async (disposition) => {
      const rootDir = await mkdtemp(join(tmpdir(), "ta-exporter-business-disposition-"));
      const sessionId = `58${disposition.length.toString().padStart(2, "0")}585858-5858-4585-8585-585858585858`;
      try {
        const projection = {
          ...projectionTemplate(["F3:Analysis-A:governance"]),
          workbookDisposition: disposition,
          worksheetDispositions: [{ worksheetName: "Analysis-A", disposition }],
          worksheets: [{ ...projectionTemplate(["F3:Analysis-A:governance"]).worksheets[0], disposition }],
        };
        await seedValidatedSession(rootDir, sessionId, projection);
        const receipt = await exportTaAnalysisForSession({
          contractVersion: "ta-product-export-command-v1",
          sessionId,
          expectedRevision: 1,
          idempotencyKey: `export-disposition-${disposition}`,
        }, { rootDir });
        expect(receipt.manifest.executionStatus).toBe("completed");
        expect(receipt.manifest.exportStatus).toBe("completed");
      } finally {
        await rm(rootDir, { recursive: true, force: true });
      }
    },
  );
});
