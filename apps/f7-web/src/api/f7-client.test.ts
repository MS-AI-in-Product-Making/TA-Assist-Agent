import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createF7Client, type AssumptionResultsPdfRequest, type F7Client } from "./f7-client";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function wilsonScoreInterval(successes: number, trials: number): { lower: number; upper: number } {
  const z = 1.959963984540054;
  const zSquared = z * z;
  const proportion = successes / trials;
  const denominator = 1 + zSquared / trials;
  const center = (proportion + zSquared / (2 * trials)) / denominator;
  const margin = (z / denominator)
    * Math.sqrt((proportion * (1 - proportion) + zSquared / (4 * trials)) / trials);
  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) };
}

const distributionFitResult = {
  factorId: HASH_B,
  sampleSize: 32,
  characteristicKind: "other",
  candidates: [{
    family: "normal",
    modelSpecification: "normal_location_scale",
    parameterCount: 2,
    parameters: { mean: 1, standardDeviation: 0.1 },
    logLikelihood: -10,
    aic: 24,
    aicc: 24 + 12 / 29,
    bic: 2 * Math.log(32) + 20,
    deltaAicc: 0,
    deltaBic: 0,
    ks: 0.1,
    ad: 0.2,
    qqPoints: [{ observed: 0.9, theoretical: 0.9 }, { observed: 1.1, theoretical: 1.1 }],
    bootstrap: {
      statisticId: "anderson_darling",
      observedStatistic: 0.2,
      comparisonDirection: "greater_than_or_equal",
      refitEachReplicate: true,
      extremeReplicateCount: 5000,
      confidenceInterval: { level: 0.95, method: "wilson_score", ...wilsonScoreInterval(5000, 10000) },
      pValue: 5001 / 10001,
      replicates: 10000,
      seed: HASH_A,
      methodId: "F7_BOOTSTRAP_V2",
      candidateMethodId: "F7_DISTRIBUTION_FIT_V1",
      streamDigest: HASH_B,
      status: "acceptable",
    },
    warnings: [],
  }],
  failedCandidates: [],
  sampleDiagnostics: {
    mean: 1,
    median: 1,
    skewness: 0,
    coefficientOfVariation: 0.1,
    meanMedianRelativeDifference: 0,
    normalQqCurvature: 0,
  },
  selectionDecision: {
    methodId: "F7_MODEL_SELECTION_V1",
    status: "unique_preference",
    numericBestFamily: "normal",
    competitiveFamilies: ["normal"],
    proposedFinalFamily: "normal",
    confidence: "moderate",
    reasonCodes: ["SINGLE_ACCEPTABLE_COMPETITOR", "SMALL_SAMPLE_UNCERTAINTY"],
  },
} as const;

const validSnapshot = {
  contractId: "f7-analysis-result-v1",
  outputClassification: "confidential",
  sessionId: "session-01",
  status: "worksheet_selection",
  workbook: {
    fileName: "demo.xlsx",
    workbookContentHash: HASH_A,
  },
  selectedWorksheetNames: [],
  worksheetOptions: [
    {
      selectionIndex: 1,
      worksheetName: "Anonymous_TA",
      toleranceLoopDescription: "Loop A",
      worksheetKind: "analysis",
      source: {
        summarySheet: "Auto Summary",
        summaryRow: 10,
        worksheetAnchor: "Anonymous_TA!A1",
      },
    },
  ],
  factors: [
    {
      factorCandidate: {
        workbookContentHash: HASH_A,
        worksheetName: "Anonymous_TA",
        tableId: "tbl-1",
        sourceRow: 15,
        sourceCells: { mean: "Anonymous_TA!R15" },
        factorCandidateId: HASH_B,
        factorName: "C-cover height",
        excelSignedMean: -1.94,
        designNominal: -1.94,
        upperTolerance: 0.1,
        lowerTolerance: -0.1,
        standardDeviation: 0.2,
        distribution: "Normal",
        lowerSpecLimit: 0,
        upperSpecLimit: 10,
      },
    },
  ],
} as const;

const validReport = {
  contractId: "f7-report-v1",
  outputClassification: "confidential",
  sessionId: "session-01",
  generatedAt: "2026-08-25T08:00:00.000Z",
  assessment: "MEETS_TARGET",
  workbook: {
    fileName: "demo.xlsx",
    workbookContentHash: HASH_A,
    worksheetName: "Anonymous_TA",
  },
  summary: {
    mean: 0,
    standardDeviation: 0.1,
    yield: 0.99,
    ppm: 10_000,
    lowerSpecLimit: -0.5,
    upperSpecLimit: 0.5,
    targetSigmaLevel: 4,
    cp: 5 / 3,
    cpk: 5 / 3,
    targetCpk: 4 / 3,
  },
  simulation: {
    methodId: "F7_MONTE_CARLO_V1",
    status: "complete",
    lowerSpecLimit: -0.5,
    upperSpecLimit: 0.5,
    targetSigmaLevel: 4,
    iterations: 10_000,
    runSeed: HASH_A,
    correlationMode: "INDEPENDENT",
    mean: 0,
    standardDeviation: 0.1,
    quantiles: { p00135: -0.3, p01: -0.23, p05: -0.16, p50: 0, p95: 0.16, p99: 0.23, p99865: 0.3 },
    inSpecCount: 9900,
    outOfSpecCount: 100,
    yield: 0.99,
    outOfSpecProbability: 0.01,
    ppm: 10_000,
    histogram: {
      methodId: "F7_HISTOGRAM_FD_V1",
      bins: Array.from({ length: 20 }, (_, index) => ({
        minimum: index - 10,
        maximum: index - 9,
        observedCount: index === 0 ? 10_000 : 0,
      })),
    },
    normalFit: {
      methodId: "F7_NORMAL_MOMENT_FIT_V1",
      mean: 0,
      standardDeviation: 0.1,
      expectedBinCounts: Array.from({ length: 20 }, (_, index) => index === 0 ? 10_000 : 0),
    },
    capability: {
      status: "available",
      cp: 5 / 3,
      lowerCpk: 5 / 3,
      upperCpk: 5 / 3,
      cpk: 5 / 3,
      targetCpk: 4 / 3,
      targetStatus: "meets_target",
    },
    normalModel: {
      status: "available",
      lowerTailDpm: 5_000,
      upperTailDpm: 5_000,
      totalDpm: 10_000,
      expectedYield: 0.99,
    },
    factorManifest: [{ factorId: HASH_B, family: "normal", sourceMode: "MEASURED" }],
  },
  factors: [{
    factorId: HASH_B,
    factorName: "C-cover height",
    loopCoefficient: 1,
    sourceMode: "MEASURED",
    designNominal: 0,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    longTermSafetyFactor: 1,
    sigmaLevel: 4,
    setupDistribution: "Normal",
    approvedDistribution: "normal",
    sourceReferences: ["Anonymous_TA!R15"],
  }],
  evidence: {
    workbookContentHash: HASH_A,
    worksheetName: "Anonymous_TA",
    specificationSourceCells: {},
    specificationInputOrigins: {
      lowerSpecLimit: "manual_entry",
      upperSpecLimit: "manual_entry",
      targetSigmaLevel: "manual_entry",
    },
    methodIds: {
      simulation: "F7_MONTE_CARLO_V1",
      histogram: "F7_HISTOGRAM_FD_V1",
      normalFit: "F7_NORMAL_MOMENT_FIT_V1",
    },
    seed: HASH_A,
    iterations: 10_000,
    factorManifest: [{ factorId: HASH_B, family: "normal", sourceMode: "MEASURED" }],
  },
  markdown: "# F7 Report\n",
} as const;

const assumptionResultsPdfRequest = {
  sessionId: "session-01",
  workbookName: "demo.xlsx",
  worksheetName: "Anonymous_TA",
  resultJudgment: {
    status: "meets-target",
    headline: "Capability meets target",
  },
  resultSummaryCaption: "Comparison of assumption-based RSS results with system specifications and derived targets",
  summaryRows: [{
    metric: "Cpk",
    result: "1.67",
    reference: ">= 1.33",
    referenceDetail: "Target capability",
    difference: "+0.34",
    assessment: "Meets target",
    performanceContext: "Assumption-based result",
    tone: "pass",
  }],
  overallAssessment: "The assumed design meets the target.",
  rootCauseItems: [{
    title: "Primary driver",
    narrative: "C-cover height dominates variation.",
    hypothesisStatus: "hypothesis",
    incompleteEvidence: false,
    quantitativeEvidence: [{ label: "Contribution (%)", value: "100%" }],
  }],
  actionItems: [{
    optionId: "improvement-center-mean",
    title: "Center the process mean",
    narrative: "Confirm mean-centering feasibility.",
    meanCenteringAdjustment: {
      current: "+0.03",
      recommended: "0",
      adjustment: "-0.03 toward LSL",
    },
    outcome: {
      label: "Expected result",
      value: "Mean 0",
      context: "after applying the recommended adjustment",
    },
  }, {
    optionId: "improvement-relax-final-specification",
    title: "Relax the final specification",
    narrative: "Apply only as a fallback.",
    specificationAdjustment: {
      lower: { current: "-0.1", recommended: "-0.37", adjustment: "-0.27" },
      upper: { current: "0.1", recommended: "0.43", adjustment: "+0.33" },
    },
    outcome: {
      label: "Expected result",
      value: "Cpk 1.33",
      context: "after applying both recommended limits",
    },
  }],
  contributors: [{
    factorName: "C-cover height",
    reference: "Anonymous_TA!R15",
    designNominal: -1.94,
    upperTolerance: 0.1,
    lowerTolerance: -0.1,
    contributionPercent: 100,
    cumulativePercent: 100,
  }],
  processGuidanceContext: "Evaluated against the current TA worksheet and analysis state.",
  processGuidance: [{ state: "guidance", title: "Next step", message: "Collect measurements." }],
} as const satisfies AssumptionResultsPdfRequest;

function generatePdfThroughClientContract(client: F7Client): Promise<Blob> {
  return client.generateAssumptionResultsPdf(assumptionResultsPdfRequest);
}

describe("createF7Client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generates an assumptions-results PDF through the exact route, body, and headers", async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([37, 80, 68, 70, 45]), {
      status: 200,
      headers: { "content-type": "Application/PDF; charset=binary" },
    }));

    const pdf = await generatePdfThroughClientContract(createF7Client("http://localhost:3017"));

    expect(pdf).toBeInstanceOf(Blob);
    expect(pdf.size).toBeGreaterThan(0);
    expect(pdf.type).toContain("application/pdf");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3017/f7/assumption-results/pdf");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(assumptionResultsPdfRequest),
    });
  });

  it("maps assumptions-results PDF API JSON errors to the typed server error", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      code: "validation_error",
      summary: "PDF request is invalid.",
      suggestedAction: "Correct the request and retry.",
      affectedInputReferences: ["summaryRows"],
      rawMessage: "private validation detail",
    }), {
      status: 400,
      headers: { "content-type": "application/json" },
    }));

    await expect(createF7Client().generateAssumptionResultsPdf(assumptionResultsPdfRequest)).rejects.toEqual({
      code: "validation_error",
      summary: "PDF request is invalid.",
      suggestedAction: "Correct the request and retry.",
      affectedInputReferences: ["summaryRows"],
    });
  });

  it("rejects a successful assumptions-results response that is not a PDF", async () => {
    fetchMock.mockResolvedValue(new Response("not a pdf", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }));

    await expect(createF7Client().generateAssumptionResultsPdf(assumptionResultsPdfRequest)).rejects.toEqual({
      code: "request_failed",
      summary: "Unable to complete the F7 workbench request.",
      suggestedAction: "Retry the action. If the issue persists, restart the local API.",
      affectedInputReferences: ["f7-web-client"],
    });
  });

  it.each([
    "application/pdf-malware",
    "text/plain; profile=application/pdf",
  ])("rejects assumptions-results content type %s", async (contentType) => {
    fetchMock.mockResolvedValue(new Response("not a pdf", {
      status: 200,
      headers: { "content-type": contentType },
    }));

    await expect(createF7Client().generateAssumptionResultsPdf(assumptionResultsPdfRequest)).rejects.toEqual({
      code: "request_failed",
      summary: "Unable to complete the F7 workbench request.",
      suggestedAction: "Retry the action. If the issue persists, restart the local API.",
      affectedInputReferences: ["f7-web-client"],
    });
  });

  it("rejects an empty assumptions-results PDF", async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array(), {
      status: 200,
      headers: { "content-type": "application/pdf" },
    }));

    await expect(createF7Client().generateAssumptionResultsPdf(assumptionResultsPdfRequest)).rejects.toEqual({
      code: "request_failed",
      summary: "Unable to complete the F7 workbench request.",
      suggestedAction: "Retry the action. If the issue persists, restart the local API.",
      affectedInputReferences: ["f7-web-client"],
    });
  });

  it("maps assumptions-results PDF fetch rejection to the generic error", async () => {
    fetchMock.mockRejectedValue(new TypeError("ECONNRESET private transport detail"));

    await expect(createF7Client().generateAssumptionResultsPdf(assumptionResultsPdfRequest)).rejects.toEqual({
      code: "request_failed",
      summary: "Unable to complete the F7 workbench request.",
      suggestedAction: "Retry the action. If the issue persists, restart the local API.",
      affectedInputReferences: ["f7-web-client"],
    });
  });

  it("generates a governed report PDF through the exact route and body", async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([37, 80, 68, 70, 45]), {
      status: 200,
      headers: { "content-type": "application/pdf" },
    }));

    const pdf = await createF7Client("http://localhost:3017").generateReportPdf({
      sessionId: "session-01",
      report: validReport,
    });

    expect(pdf.size).toBe(5);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3017/f7/report/pdf");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "session-01", report: validReport }),
    });
  });

  it.each([
    ["an unexpected media type", "text/plain", new Uint8Array([37, 80, 68, 70, 45])],
    ["an invalid PDF signature", "application/pdf", new TextEncoder().encode("not a pdf")],
  ])("rejects report PDF responses with %s", async (_caseName, contentType, body) => {
    fetchMock.mockResolvedValue(new Response(body, {
      status: 200,
      headers: { "content-type": contentType },
    }));

    await expect(createF7Client().generateReportPdf({
      sessionId: "session-01",
      report: validReport,
    })).rejects.toEqual({
      code: "request_failed",
      summary: "Unable to complete the F7 workbench request.",
      suggestedAction: "Retry the action. If the issue persists, restart the local API.",
      affectedInputReferences: ["f7-web-client"],
    });
  });

  it("generates a report through the exact JSON route, method, and body", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(validReport), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    const report = await createF7Client("http://localhost:3017").generateReport({ sessionId: "session-01" });

    expect(report).toEqual(validReport);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3017/f7/report");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "session-01" }),
    });
  });

  it("rejects an otherwise-valid report response containing an unknown field", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...validReport, extra: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await expect(createF7Client().generateReport({ sessionId: "session-01" })).rejects.toEqual({
      code: "request_failed",
      summary: "Unable to complete the F7 workbench request.",
      suggestedAction: "Retry the action. If the issue persists, restart the local API.",
      affectedInputReferences: ["f7-web-client"],
    });
  });

  it("rejects an otherwise-valid report response for a different session", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      ...validReport,
      sessionId: "session-02",
      markdown: "# Cross-session response must not leak\n",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await expect(createF7Client().generateReport({ sessionId: "session-01" })).rejects.toEqual({
      code: "request_failed",
      summary: "Unable to complete the F7 workbench request.",
      suggestedAction: "Retry the action. If the issue persists, restart the local API.",
      affectedInputReferences: ["f7-web-client"],
    });
  });

  it("maps report generation failures to the typed server error", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      code: "prerequisite_not_ready",
      summary: "Run Monte Carlo before generating a report.",
      suggestedAction: "Run Monte Carlo, then generate the report again.",
      affectedInputReferences: ["session-01"],
    }), {
      status: 409,
      headers: { "content-type": "application/json" },
    }));

    await expect(createF7Client().generateReport({ sessionId: "session-01" })).rejects.toEqual({
      code: "prerequisite_not_ready",
      summary: "Run Monte Carlo before generating a report.",
      suggestedAction: "Run Monte Carlo, then generate the report again.",
      affectedInputReferences: ["session-01"],
    });
  });

  it("uses exact routes/methods for all eight APIs and JSON body rules", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(validSnapshot), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const client = createF7Client("http://localhost:3017");

    await client.confirmWorksheet({
      sessionId: "s-1",
      workbookContentHash: HASH_A,
      selectedWorksheetName: "Anonymous_TA",
      confirmed: true,
    });

    await client.confirmFactors({
      sessionId: "s-1",
      systemSpecification: {
        lowerSpecLimit: -0.62,
        upperSpecLimit: -0.52,
        targetSigmaLevel: 3,
      },
      confirmations: [{
        factorCandidateId: HASH_B,
        designNominal: -0.57,
        upperTolerance: 0.05,
        lowerTolerance: -0.05,
        confirmed: true,
      }],
    });

    await client.setFactorMode({
      sessionId: "s-1",
      factorId: "factor id/1",
      mode: "MEASURED",
    });

    await client.pasteMeasurements({
      sessionId: "s-1",
      factorId: "factor id/1",
      structure: "UNORDERED_SAMPLE",
      sourceReference: "src-1",
      msaStatus: "available",
      text: "1\n2\n3",
    });

    await client.applyMeasurementDisposition({
      sessionId: "s-1",
      factorId: "factor id/1",
      rowNumbers: [5, 8],
      action: "EXCLUDE",
      reason: "OUTLIER",
      operatorReference: "op-9",
      confirmed: true,
    });

    await client.fitDistribution({
      sessionId: "s-1",
      factorId: "factor id/1",
    });

    await client.getSession("session id/01");

    expect(fetchMock).toHaveBeenCalledTimes(7);

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3017/f7/workbook/worksheet-confirm");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("POST");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({ "content-type": "application/json" });

    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:3017/f7/factors/confirm");
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("POST");

    expect(fetchMock.mock.calls[2]?.[0]).toBe("http://localhost:3017/f7/factors/factor%20id%2F1/mode");
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).method).toBe("POST");
    expect(JSON.parse(((fetchMock.mock.calls[2]?.[1] as RequestInit).body as string))).toEqual({ sessionId: "s-1", mode: "MEASURED" });

    expect(fetchMock.mock.calls[3]?.[0]).toBe("http://localhost:3017/f7/factors/factor%20id%2F1/measurements/paste");
    expect((fetchMock.mock.calls[3]?.[1] as RequestInit).method).toBe("POST");

    expect(fetchMock.mock.calls[4]?.[0]).toBe("http://localhost:3017/f7/factors/factor%20id%2F1/measurements/disposition");
    expect((fetchMock.mock.calls[4]?.[1] as RequestInit).method).toBe("POST");
    const dispositionBody = JSON.parse(((fetchMock.mock.calls[4]?.[1] as RequestInit).body as string));
    expect(dispositionBody.factorId).toBeUndefined();

    expect(fetchMock.mock.calls[5]?.[0]).toBe("http://localhost:3017/f7/factors/factor%20id%2F1/distribution-fit");
    expect((fetchMock.mock.calls[5]?.[1] as RequestInit).method).toBe("POST");
    expect(JSON.parse(((fetchMock.mock.calls[5]?.[1] as RequestInit).body as string))).toEqual({ sessionId: "s-1" });

    expect(fetchMock.mock.calls[6]?.[0]).toBe("http://localhost:3017/f7/session/session%20id%2F01");
    expect(fetchMock.mock.calls[6]?.[1]).toBeUndefined();
  });

  it("maps non-2xx JSON error envelope to controlled F7UiError fields", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      code: "validation_error",
      summary: "F7 request is invalid.",
      suggestedAction: "Use the documented DTO.",
      affectedInputReferences: ["f7-local-api"],
      rawMessage: "secret stack trace",
    }), {
      status: 400,
      headers: { "content-type": "application/json" },
    }));
    const client = createF7Client("http://localhost:3017");

    await expect(client.getSession("s-1")).rejects.toEqual({
      code: "validation_error",
      summary: "F7 request is invalid.",
      suggestedAction: "Use the documented DTO.",
      affectedInputReferences: ["f7-local-api"],
    });
  });

  it("uses fixed generic error when non-JSON/malformed response fails", async () => {
    fetchMock.mockResolvedValue(new Response("<html>bad gateway marker</html>", {
      status: 502,
      headers: { "content-type": "text/html" },
    }));
    const client = createF7Client("http://localhost:3017");

    await expect(client.getSession("s-1")).rejects.toEqual({
      code: "request_failed",
      summary: "Unable to complete the F7 workbench request.",
      suggestedAction: "Retry the action. If the issue persists, restart the local API.",
      affectedInputReferences: ["f7-web-client"],
    });
  });

  it("maps fetch rejection to generic connection-safe error without native leak", async () => {
    fetchMock.mockRejectedValue(new TypeError("ECONNRESET socket hang up"));
    const client = createF7Client("http://localhost:3017");

    await expect(client.getSession("s-1")).rejects.toEqual({
      code: "request_failed",
      summary: "Unable to complete the F7 workbench request.",
      suggestedAction: "Retry the action. If the issue persists, restart the local API.",
      affectedInputReferences: ["f7-web-client"],
    });
  });

  it("rejects malformed success snapshot payload", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const client = createF7Client("http://localhost:3017");

    await expect(client.getSession("s-1")).rejects.toEqual({
      code: "request_failed",
      summary: "Unable to complete the F7 workbench request.",
      suggestedAction: "Retry the action. If the issue persists, restart the local API.",
      affectedInputReferences: ["f7-web-client"],
    });
  });

  it("preserves a complete governed distribution fit payload after deep validation", async () => {
    const expandedSnapshot = {
      ...validSnapshot,
      factors: [{ ...validSnapshot.factors[0], distributionFitResult }],
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(expandedSnapshot), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    const result = await createF7Client("http://localhost:3017").fitDistribution({
      sessionId: "s-1",
      factorId: HASH_B,
    });

    expect(result).toEqual(expandedSnapshot);
  });

  it("rejects an otherwise-valid distribution fit payload containing legacy recommendedFamily", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      ...validSnapshot,
      factors: [
        {
          ...validSnapshot.factors[0],
          distributionFitResult: {
            ...distributionFitResult,
            recommendedFamily: "normal",
          },
        },
      ],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const client = createF7Client("http://localhost:3017");

    await expect(client.fitDistribution({ sessionId: "s-1", factorId: HASH_B })).rejects.toEqual({
      code: "request_failed",
      summary: "Unable to complete the F7 workbench request.",
      suggestedAction: "Retry the action. If the issue persists, restart the local API.",
      affectedInputReferences: ["f7-web-client"],
    });
  });

  it("rejects an otherwise-valid distribution fit payload containing Bootstrap V1", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      ...validSnapshot,
      factors: [{
        ...validSnapshot.factors[0],
        distributionFitResult: {
          ...distributionFitResult,
          candidates: [{
            ...distributionFitResult.candidates[0],
            bootstrap: { ...distributionFitResult.candidates[0].bootstrap, methodId: "F7_BOOTSTRAP_V1" },
          }],
        },
      }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await expect(createF7Client("http://localhost:3017").fitDistribution({
      sessionId: "s-1",
      factorId: HASH_B,
    })).rejects.toMatchObject({
      code: "request_failed",
      affectedInputReferences: ["f7-web-client"],
    });
  });

  it("importWorkbook converts file to base64 and sends canonical payload", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(validSnapshot), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const client = createF7Client("http://localhost:3017");

    const file = new File([new Uint8Array([1, 2, 3])], "demo.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await client.importWorkbook({ file });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3017/f7/workbook/import");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "content-type": "application/json" });

    const body = JSON.parse(init.body as string);
    expect(body.fileName).toBe("demo.xlsx");
    expect(body.workbookBase64).toBe("AQID");
  });

  it("rejects >16MiB before conversion/network", async () => {
    const client = createF7Client("http://localhost:3017");
    const oversized = {
      size: (16 * 1024 * 1024) + 1,
      name: "big.xlsx",
    } as File;

    await expect(client.importWorkbook({ file: oversized })).rejects.toEqual({
      code: "validation_error",
      summary: "Workbook exceeds the 16 MiB local import limit.",
      suggestedAction: "Reduce workbook size and retry import.",
      affectedInputReferences: ["big.xlsx"],
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps FileReader failure to controlled generic error", async () => {
    const originalFileReader = globalThis.FileReader;
    class FailingFileReader {
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
      result: string | ArrayBuffer | null = null;

      readAsDataURL(_blob: Blob): void {
        this.onerror?.call(
          this as unknown as FileReader,
          new ProgressEvent("error") as ProgressEvent<FileReader>,
        );
      }
    }
    vi.stubGlobal("FileReader", FailingFileReader as unknown as typeof FileReader);

    const client = createF7Client("http://localhost:3017");
    const file = new File([new Uint8Array([1, 2, 3])], "demo.xlsx");

    await expect(client.importWorkbook({ file })).rejects.toEqual({
      code: "request_failed",
      summary: "Unable to complete the F7 workbench request.",
      suggestedAction: "Retry the action. If the issue persists, restart the local API.",
      affectedInputReferences: ["f7-web-client"],
    });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubGlobal("FileReader", originalFileReader);
  });
});
