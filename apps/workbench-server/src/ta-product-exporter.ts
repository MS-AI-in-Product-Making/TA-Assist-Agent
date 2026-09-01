import path from "node:path";

import {
  createTypedError,
  taProductExportManifestSchema,
  type TaProductExportManifest,
  type TaProductExportRecord,
} from "@ai-assist/contracts";
import { createProductRunReference } from "@ai-assist/product-language";
import {
  commitProductExport,
  contentSha256,
  prepareProductExport,
  verifyExistingProductExport,
  type ProductExportRequest,
  type ProductExportResult,
} from "@ai-assist/product-export";
import { computeTaReportSemanticDigest } from "@ai-assist/workbench";

export interface TaAnalysisExportSource {
  readonly sourceRunReference: string;
  readonly sourceClass: "validated_production" | "internal_fixture";
  readonly verificationStatus: "verified" | "legacy_unverified";
  readonly lineage: {
    readonly initialScopeProvenance: "user" | "system";
    readonly downstreamScopeProvenance: "user" | "system";
  };
  readonly workbook: {
    readonly fileName: string;
    readonly contentHash: string;
  };
  readonly worksheetScope: readonly string[];
  readonly executionStatus: "completed" | "failed" | "cancelled";
  readonly businessDisposition: "PASS" | "FAIL" | "CONDITIONAL_PASS" | "INCOMPLETE";
  readonly finalReport: string;
  readonly improvementOptions: string;
  readonly runSummaryJson: string;
}

export interface TaProductExportResult {
  readonly root: string;
  readonly manifest: TaProductExportManifest;
  readonly semanticDigest: string;
}

export interface TaProductExporterOptions {
  readonly rootDir: string;
  readonly runF6?: () => unknown;
}

function deny(summary: string, reference: string): never {
  throw createTypedError({
    code: "policy_denied",
    summary,
    suggestedAction: "Export only validated production output with user-confirmed lineage.",
    affectedInputReferences: [reference],
  });
}

function mapBusinessDisposition(value: TaAnalysisExportSource["businessDisposition"]): "PASS" | "FAIL" | "REVIEW" {
  if (value === "PASS") return "PASS";
  if (value === "FAIL") return "FAIL";
  return "REVIEW";
}

function toRecord(result: ProductExportResult, displayName: string, fileName: string, mediaType: string): TaProductExportRecord {
  const file = result.manifest.files.find((candidate) => candidate.relativePath === fileName);
  if (file === undefined) {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: `Export manifest is missing required file: ${fileName}`,
      suggestedAction: "Regenerate product export from validated source artifacts.",
      affectedInputReferences: [fileName],
    });
  }
  return {
    displayName,
    fileName,
    mediaType,
    byteSize: file.byteSize,
    sha256: file.sha256,
  };
}

function exportRequest(source: TaAnalysisExportSource, rootDir: string): ProductExportRequest {
  const productRunReference = createProductRunReference(`${source.sourceRunReference}:${source.workbook.contentHash}`);
  const managedRoot = path.join(rootDir, "runtime", "workbench", "product-exports");
  return {
    managedRoot,
    exportId: productRunReference,
    files: [
      { relativePath: "TA-Engineering-Analysis-Report.md", content: source.finalReport },
      { relativePath: "TA-Improvement-Options.md", content: source.improvementOptions },
      { relativePath: "TA-Analysis-Run-Summary.json", content: source.runSummaryJson },
    ],
  };
}

function semanticDigest(source: TaAnalysisExportSource): string {
  return computeTaReportSemanticDigest({
    schemaVersion: "ta-engineering-report-projection-v1",
    title: "TA Engineering Analysis Report",
    workbookDisposition: source.businessDisposition,
    worksheetDispositions: source.worksheetScope.map((worksheetName) => ({ worksheetName, disposition: source.businessDisposition })),
    workbook: {
      fileName: source.workbook.fileName,
      contentHash: source.workbook.contentHash,
    },
    worksheets: source.worksheetScope.map((worksheetName) => ({
      worksheetName,
      toleranceLoopDescription: worksheetName,
      disposition: source.businessDisposition,
      requiredAction: source.businessDisposition === "PASS" ? "None" : "Engineering review required before release decision",
      findings: [],
      assumptions: [],
      clarifications: [],
      gatingEvidenceReferences: [],
    })),
  });
}

export async function exportTaAnalysis(source: TaAnalysisExportSource, options: TaProductExporterOptions): Promise<TaProductExportResult> {
  if (source.executionStatus !== "completed") {
    deny("Product export only permits completed workflow execution status.", source.sourceRunReference);
  }
  if (source.sourceClass !== "validated_production") {
    deny("Product export rejects internal fixture sources.", source.sourceRunReference);
  }
  if (source.verificationStatus !== "verified") {
    deny("Product export rejects legacy unverified sources.", source.sourceRunReference);
  }
  if (source.lineage.initialScopeProvenance !== "user" || source.lineage.downstreamScopeProvenance !== "user") {
    deny("Product export requires user provenance for both worksheet confirmations.", source.sourceRunReference);
  }

  const request = exportRequest(source, options.rootDir);
  let result: ProductExportResult;
  try {
    result = await verifyExistingProductExport(request);
  } catch (error) {
    const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
    if (code !== "evidence_mismatch") {
      throw error;
    }
    result = await commitProductExport(await prepareProductExport(request));
  }

  const productRunReference = createProductRunReference(`${source.sourceRunReference}:${source.workbook.contentHash}`);
  const manifest = taProductExportManifestSchema.parse({
    contractVersion: "ta-assist-product-export-v1",
    workflow: "TA Workbook Analysis",
    generatedAt: result.manifest.generatedAt,
    workbook: source.workbook,
    worksheetScope: [...source.worksheetScope],
    executionStatus: source.executionStatus,
    businessDisposition: mapBusinessDisposition(source.businessDisposition),
    exportStatus: "completed",
    productRunReference,
    files: [
      toRecord(result, "TA Engineering Analysis Report", "TA-Engineering-Analysis-Report.md", "text/markdown"),
      toRecord(result, "TA Improvement Options", "TA-Improvement-Options.md", "text/markdown"),
      toRecord(result, "TA Analysis Run Summary", "TA-Analysis-Run-Summary.json", "application/json"),
    ],
  });

  const digest = semanticDigest(source);
  const summaryHash = contentSha256(source.runSummaryJson);
  void summaryHash;

  return {
    root: result.root,
    manifest,
    semanticDigest: digest,
  };
}
