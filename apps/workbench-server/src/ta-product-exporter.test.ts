import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

import { describe, expect, it } from "vitest";
import { createSessionStore } from "@ai-assist/workbench";

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

async function seedValidatedSession(rootDir: string, sessionId: string, projection = projectionTemplate()) {
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
  const f6Projection = await writeArtifact(rootDir, join(f6Root, "Feature6-Report-Projection.json"), `${JSON.stringify(projection, null, 2)}\n`);
  await writeArtifact(rootDir, join(f6Root, "Feature6-Optimization.md"), "# TA Improvement Options\n");
  await writeArtifact(rootDir, join(f6Root, "Feature6-Run-Summary.json"), "{\"status\":\"completed\"}\n");

  const reviewContext = {
    workbookHash: "a".repeat(64),
    downstreamSelectionHash: createHash("sha256").update(JSON.stringify(["Analysis-A"])) .digest("hex"),
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
          selectedWorksheetNames: ["Analysis-A"],
          confirmed: true,
          provenance: "user",
        },
        downstreamScopeSelection: {
          workbookContentHash: "a".repeat(64),
          selectedWorksheetNames: ["Analysis-A"],
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
          { artifactId: "f6-report-projection", sessionId, inputRevision: 1, kind: "f6_report_projection", relativePath: f6Projection.relativePath, contentHash: f6Projection.contentHash, reviewContext },
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
  return { f6ProjectionPath: join(f6Root, "Feature6-Report-Projection.json") };
}

describe("exportTaAnalysisForSession", () => {
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
      const manifestPath = join(exported.root, "export-manifest.json");
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
});
