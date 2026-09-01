import { describe, expect, it } from "vitest";
import {
  taProductExportManifestSchema,
  taProductExportRecordSchema,
  taProductRunReferenceSchema,
  validatedTaBaselineReferenceSchema,
} from "./ta-product-contracts.js";
import { createProductRunReference } from "../../product-language/src/product-identifiers.js";

function validManifest() {
  return {
    contractVersion: "ta-assist-product-export-v1",
    workflow: "TA Workbook Analysis",
    generatedAt: "2026-09-01T00:00:00.000Z",
    workbook: { fileName: "Gearbox-TA.xlsx", contentHash: "a".repeat(64) },
    worksheetScope: ["Analysis-A"],
    executionStatus: "completed" as const,
    businessDisposition: "FAIL" as const,
    exportStatus: "completed" as const,
    productRunReference: "ta-run-7m4k2p9q",
    files: [
      {
        displayName: "TA Engineering Analysis Report",
        fileName: "TA-Engineering-Analysis-Report.md",
        mediaType: "text/markdown",
        byteSize: 12,
        sha256: "b".repeat(64),
      },
    ],
  };
}

function validBaseline() {
  return {
    contractVersion: "validated-ta-baseline-reference-v1",
    baselineSessionId: "session-01",
    baselineRunReference: "controlled-run-reference",
    workbookContentHash: "a".repeat(64),
    finalReportSha256: "b".repeat(64),
    sourceArtifacts: {
      drawingGovernance: { artifactId: "controlled-f3", sha256: "c".repeat(64) },
      calculation: { artifactId: "controlled-f4", sha256: "d".repeat(64) },
      interpretation: { artifactId: "controlled-f5", sha256: "e".repeat(64) },
      optimization: { artifactId: "controlled-f6", sha256: "f".repeat(64) },
    },
  };
}

describe("TA product export contracts", () => {
  it("accepts a product-only export manifest", () => {
    expect(taProductExportManifestSchema.parse(validManifest())).toBeDefined();
  });

  it("retains controlled source references required by measurement feedback", () => {
    expect(validatedTaBaselineReferenceSchema.parse(validBaseline())).toBeDefined();
  });

  it("rejects extra keys on manifest, export record, baseline reference and source artifact", () => {
    expect(
      taProductExportManifestSchema.safeParse({
        ...validManifest(),
        extraField: true,
      }).success,
    ).toBe(false);

    expect(
      taProductExportRecordSchema.safeParse({
        ...validManifest().files[0],
        extraField: true,
      }).success,
    ).toBe(false);

    expect(
      validatedTaBaselineReferenceSchema.safeParse({
        ...validBaseline(),
        extraField: true,
      }).success,
    ).toBe(false);

    expect(
      validatedTaBaselineReferenceSchema.safeParse({
        ...validBaseline(),
        sourceArtifacts: {
          ...validBaseline().sourceArtifacts,
          drawingGovernance: {
            ...validBaseline().sourceArtifacts.drawingGovernance,
            extraField: true,
          },
        },
      }).success,
    ).toBe(false);
  });

  it("rejects invalid hash and invalid product run reference", () => {
    expect(
      taProductExportManifestSchema.safeParse({
        ...validManifest(),
        workbook: { ...validManifest().workbook, contentHash: "A".repeat(64) },
      }).success,
    ).toBe(false);

    expect(
      taProductExportManifestSchema.safeParse({
        ...validManifest(),
        productRunReference: "ta-run-INVALID",
      }).success,
    ).toBe(false);
  });

  it("rejects manifest fields that expose baseline/source/internal references", () => {
    expect(
      taProductExportManifestSchema.safeParse({
        ...validManifest(),
        baselineSessionId: "session-should-not-leak",
      }).success,
    ).toBe(false);

    expect(
      taProductExportManifestSchema.safeParse({
        ...validManifest(),
        sourceArtifacts: validBaseline().sourceArtifacts,
      }).success,
    ).toBe(false);
  });

  it("rejects path-style artifact IDs", () => {
    const pathStyleIds = ["C:\\foo\\bar", "/tmp/x", "file://x", "../x"];

    for (const artifactId of pathStyleIds) {
      const parsed = validatedTaBaselineReferenceSchema.safeParse({
        ...validBaseline(),
        sourceArtifacts: {
          ...validBaseline().sourceArtifacts,
          drawingGovernance: { artifactId, sha256: "c".repeat(64) },
        },
      });
      expect(parsed.success).toBe(false);
    }
  });

  it("ensures product run reference generator and schema stay compatible", () => {
    const ref = createProductRunReference("seed-2026-09-01");
    expect(taProductRunReferenceSchema.safeParse(ref).success).toBe(true);
  });
});
