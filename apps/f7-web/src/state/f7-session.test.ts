import { describe, expect, it, vi } from "vitest";
import type { F7Client, F7ReportProjection, F7SessionSnapshot } from "../api/f7-client";
import { createF7SessionStore } from "./f7-session";

const snapshot = {
  sessionId: "session-01",
  workbook: { workbookContentHash: "a".repeat(64) },
} as F7SessionSnapshot;

const report = {
  contractId: "f7-report-v1",
  sessionId: "session-01",
} as F7ReportProjection;

function createClient(): F7Client {
  return {
    importWorkbook: vi.fn(async () => snapshot),
    confirmWorksheet: vi.fn(async () => snapshot),
    confirmFactors: vi.fn(async () => snapshot),
    setFactorMode: vi.fn(async () => snapshot),
    pasteMeasurements: vi.fn(async () => snapshot),
    applyMeasurementDisposition: vi.fn(async () => snapshot),
    fitDistribution: vi.fn(async () => snapshot),
    approveDistribution: vi.fn(async () => snapshot),
    runMonteCarlo: vi.fn(async () => snapshot),
    generateReport: vi.fn(async () => report),
    generateReportPdf: vi.fn(async () => new Blob(["%PDF-1.7"], { type: "application/pdf" })),
    generateAssumptionResultsPdf: vi.fn(async () => new Blob(["%PDF-1.7"], { type: "application/pdf" })),
    getSession: vi.fn(async () => snapshot),
  };
}

describe("createF7SessionStore report state", () => {
  it("generates and stores a report for the current session", async () => {
    const client = createClient();
    const store = createF7SessionStore(client);
    await store.importWorkbook(new File([], "demo.xlsx"));

    await store.generateReport();

    expect(client.generateReport).toHaveBeenCalledWith({ sessionId: "session-01" });
    expect(store.report.value).toEqual(report);
    expect(store.busyAction.value).toBeNull();
  });

  it("clears a generated report after every successful snapshot update including refresh", async () => {
    const client = createClient();
    const store = createF7SessionStore(client);
    await store.importWorkbook(new File([], "demo.xlsx"));

    const mutations = [
      () => store.importWorkbook(new File([], "replacement.xlsx")),
      () => store.confirmWorksheet("Anonymous_TA"),
      () => store.confirmFactors([], {
        lowerSpecLimit: -0.62,
        upperSpecLimit: -0.52,
        targetSigmaLevel: 3,
      }),
      () => store.setFactorMode("factor-01", "MEASURED"),
      () => store.pasteMeasurements({
        factorId: "factor-01",
        structure: "UNORDERED_SAMPLE",
        sourceReference: "clipboard",
        msaStatus: "available",
        text: "1\n2",
      }),
      () => store.applyMeasurementDisposition({
        factorId: "factor-01",
        rowNumbers: [1],
        action: "EXCLUDE",
        reason: "OUTLIER",
        operatorReference: "operator-01",
      }),
      () => store.fitDistribution("factor-01"),
      () => store.approveDistribution("factor-01", "normal"),
      () => store.runMonteCarlo({
        lowerSpecLimit: -1,
        upperSpecLimit: 1,
        targetSigmaLevel: 4,
        iterations: 10_000,
        runSeed: "b".repeat(64),
        correlationMode: "INDEPENDENT",
      }),
    ];

    for (const mutate of mutations) {
      await store.generateReport();
      await mutate();
      expect(store.report.value).toBeNull();
    }

    await store.generateReport();
    await store.refreshSession();
    expect(store.report.value).toBeNull();
  });

  it("preserves the current session and report when refresh fails", async () => {
    const client = createClient();
    const store = createF7SessionStore(client);
    await store.importWorkbook(new File([], "demo.xlsx"));
    await store.generateReport();
    const currentSession = store.session.value;
    const currentReport = store.report.value;
    const refreshError = {
      code: "request_failed",
      summary: "Unable to refresh the F7 session.",
      suggestedAction: "Retry refresh.",
      affectedInputReferences: ["session-01"],
    };
    client.getSession = vi.fn(async () => { throw refreshError; });

    await expect(store.refreshSession()).rejects.toEqual(refreshError);

    expect(store.session.value).toBe(currentSession);
    expect(store.report.value).toBe(currentReport);
    expect(store.busyAction.value).toBeNull();
  });

  it("surfaces a controlled prerequisite error when generating without a session", async () => {
    const client = createClient();
    const store = createF7SessionStore(client);

    await expect(store.generateReport()).rejects.toEqual({
      code: "prerequisite_not_ready",
      summary: "Import a workbook before continuing.",
      suggestedAction: "Import and confirm a workbook.",
      affectedInputReferences: ["f7-session"],
    });
    expect(client.generateReport).not.toHaveBeenCalled();
    expect(store.error.value?.code).toBe("prerequisite_not_ready");
  });
});