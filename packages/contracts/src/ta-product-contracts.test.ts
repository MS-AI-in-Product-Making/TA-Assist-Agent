import { describe, expect, it } from "vitest";
import { taProductExportManifestSchema, validatedTaBaselineReferenceSchema } from "./ta-product-contracts.js";

describe("TA product export contracts", () => {
  it("accepts a product-only export manifest", () => {
    expect(
      taProductExportManifestSchema.parse({
        contractVersion: "ta-assist-product-export-v1",
        workflow: "TA Workbook Analysis",
        generatedAt: "2026-09-01T00:00:00.000Z",
        workbook: { fileName: "Gearbox-TA.xlsx", contentHash: "a".repeat(64) },
        worksheetScope: ["Analysis-A"],
        executionStatus: "completed",
        businessDisposition: "FAIL",
        exportStatus: "completed",
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
      }),
    ).toBeDefined();
  });

  it("retains controlled source references required by measurement feedback", () => {
    expect(
      validatedTaBaselineReferenceSchema.parse({
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
      }),
    ).toBeDefined();
  });
});
