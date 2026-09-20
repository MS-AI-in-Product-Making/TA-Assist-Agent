import { describe, expect, it } from "vitest";
import { f7ReportPdfRouteRequestSchema } from "./f7-report-pdf-contract.js";
import { f7ReportProjectionSchema } from "@ai-assist/contracts";

const report = f7ReportProjectionSchema.parse({
  contractId: "f7-report-v1",
  outputClassification: "confidential",
  sessionId: "session-01",
  generatedAt: "2026-09-16T08:00:00.000Z",
  assessment: "NOT_EVALUABLE",
  workbook: { fileName: "fixture.xlsx", workbookContentHash: "a".repeat(64), worksheetName: "TA" },
  summary: {
    mean: 0,
    standardDeviation: 0,
    yield: 1,
    ppm: 0,
    lowerSpecLimit: -1,
    upperSpecLimit: 1,
    targetSigmaLevel: 3,
    targetCpk: 1,
  },
  simulation: {
    methodId: "F7_MONTE_CARLO_V1",
    status: "complete",
    lowerSpecLimit: -1,
    upperSpecLimit: 1,
    targetSigmaLevel: 3,
    iterations: 10000,
    runSeed: "b".repeat(64),
    correlationMode: "INDEPENDENT",
    mean: 0,
    standardDeviation: 0,
    quantiles: { p00135: 0, p01: 0, p05: 0, p50: 0, p95: 0, p99: 0, p99865: 0 },
    inSpecCount: 10000,
    outOfSpecCount: 0,
    yield: 1,
    outOfSpecProbability: 0,
    ppm: 0,
    histogram: { methodId: "F7_HISTOGRAM_FD_V1", bins: Array.from({ length: 20 }, (_, index) => ({ minimum: index - 10, maximum: index - 9, observedCount: index === 10 ? 10000 : 0 })) },
    normalFit: { methodId: "F7_NORMAL_MOMENT_FIT_V1", mean: 0, standardDeviation: 0, expectedBinCounts: Array.from({ length: 20 }, (_, index) => index === 10 ? 10000 : 0) },
    capability: { status: "not_available", reason: "zero_variance", targetCpk: 1 },
    normalModel: { status: "not_available", reason: "zero_variance" },
    factorManifest: [{ factorId: "c".repeat(64), family: "normal", sourceMode: "MEASURED" }],
  },
  factors: [{
    factorId: "c".repeat(64),
    factorName: "Factor A",
    designNominal: 0,
    upperTolerance: 1,
    lowerTolerance: -1,
    longTermSafetyFactor: 1,
    sigmaLevel: 3,
    setupDistribution: "Normal",
    setupMean: 0,
    setupTolerance: 1,
    setupOneSigma: 1 / 3,
    setupCpk: 1,
    percentContributionToSigma: 1,
    sampleCount: 20,
    readiness: "ready",
    measurementWarning: false,
    loopCoefficient: 1,
    sourceMode: "MEASURED",
    approvedDistribution: "normal",
    sourceReferences: ["TA!A1"],
  }],
  evidence: {
    workbookContentHash: "a".repeat(64),
    worksheetName: "TA",
    specificationSourceCells: {},
    specificationInputOrigins: { lowerSpecLimit: "manual_entry", upperSpecLimit: "manual_entry", targetSigmaLevel: "manual_entry" },
    methodIds: { simulation: "F7_MONTE_CARLO_V1", histogram: "F7_HISTOGRAM_FD_V1", normalFit: "F7_NORMAL_MOMENT_FIT_V1" },
    seed: "b".repeat(64),
    iterations: 10000,
    factorManifest: [{ factorId: "c".repeat(64), family: "normal", sourceMode: "MEASURED" }],
  },
  markdown: "# Report",
});

describe("F7 report PDF request contract", () => {
  it("defaults Factor distribution Appendix inclusion to false", () => {
    expect(f7ReportPdfRouteRequestSchema.parse({ sessionId: "session-01", report }))
      .toMatchObject({ includeFactorDistributionAppendix: false });
  });

  it("accepts an explicit Appendix inclusion decision and rejects non-boolean values", () => {
    expect(f7ReportPdfRouteRequestSchema.parse({
      sessionId: "session-01",
      report,
      includeFactorDistributionAppendix: true,
    }).includeFactorDistributionAppendix).toBe(true);
    expect(f7ReportPdfRouteRequestSchema.safeParse({
      sessionId: "session-01",
      report,
      includeFactorDistributionAppendix: "true",
    }).success).toBe(false);
  });
});