import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { exportTaAnalysis } from "./ta-product-exporter.js";

function validatedSource(overrides: Partial<ReturnType<typeof sourceTemplate>> = {}) {
  return {
    ...sourceTemplate(),
    ...overrides,
  };
}

function sourceTemplate() {
  return {
    sourceRunReference: "f6-run-2026-09-02",
    sourceClass: "validated_production",
    verificationStatus: "verified",
    lineage: {
      initialScopeProvenance: "user",
      downstreamScopeProvenance: "user",
    },
    workbook: {
      fileName: "Anonymous.xlsx",
      contentHash: "a".repeat(64),
    },
    worksheetScope: ["Analysis-A"],
    executionStatus: "completed",
    businessDisposition: "FAIL",
    finalReport: "# TA Engineering Analysis Report\n",
    improvementOptions: "# TA Improvement Options\n",
    runSummaryJson: "{\"status\":\"completed\"}\n",
  } as const;
}

describe("exportTaAnalysis", () => {
  it("exports a valid business FAIL without rerunning analysis", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ta-exporter-"));
    try {
      const runF6 = () => {
        throw new Error("must not rerun");
      };
      const exported = await exportTaAnalysis(validatedSource(), { rootDir, runF6 });

      expect(exported.manifest.executionStatus).toBe("completed");
      expect(exported.manifest.businessDisposition).toBe("FAIL");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("returns the same export for identical retry and rejects drift", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ta-exporter-retry-"));
    try {
      const source = validatedSource();
      const first = await exportTaAnalysis(source, { rootDir });
      expect(await exportTaAnalysis(source, { rootDir })).toEqual(first);

      const drifted = validatedSource({ finalReport: "# drifted\n" });
      await expect(exportTaAnalysis(drifted, { rootDir })).rejects.toMatchObject({ code: "evidence_mismatch" });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects execution failure, internal fixture sources, legacy-unverified, and non-user provenance", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ta-exporter-policy-"));
    try {
      await expect(exportTaAnalysis(validatedSource({ executionStatus: "failed" }), { rootDir })).rejects.toMatchObject({ code: "policy_denied" });
      await expect(exportTaAnalysis(validatedSource({ sourceClass: "internal_fixture" }), { rootDir })).rejects.toMatchObject({ code: "policy_denied" });
      await expect(exportTaAnalysis(validatedSource({ verificationStatus: "legacy_unverified" }), { rootDir })).rejects.toMatchObject({ code: "policy_denied" });
      await expect(exportTaAnalysis(validatedSource({ lineage: { initialScopeProvenance: "user", downstreamScopeProvenance: "system" } }), { rootDir })).rejects.toMatchObject({ code: "policy_denied" });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
