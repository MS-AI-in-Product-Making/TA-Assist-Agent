import { describe, expect, it, vi } from "vitest";
import type {
  F7Client,
  F7MeasurementImportPreviewResponse,
  F7ReportProjection,
  F7SessionSnapshot,
} from "../api/f7-client";
import { createF7SessionStore } from "./f7-session";

const snapshot = {
  sessionId: "session-01",
  workbook: { workbookContentHash: "a".repeat(64) },
} as F7SessionSnapshot;

const report = {
  contractId: "f7-report-v1",
  sessionId: "session-01",
} as F7ReportProjection;

const measurementImportPreview = {
  previewId: "preview-01",
  expiresAt: "2026-09-16T08:15:00.000Z",
  sessionStateDigest: "a".repeat(64),
  factorSetDigest: "b".repeat(64),
  status: "ready",
  factorCount: 1,
  replacementFactorIds: ["b".repeat(64)],
  factors: [{
    factorId: "b".repeat(64),
    factorName: "C-cover height",
    unit: "mm",
    structure: "ORDERED_INDIVIDUALS",
    sampleCount: 32,
    status: "ready",
    replacesExistingFactor: true,
    diagnostics: [],
    warnings: [],
    validation: {
      status: "ready",
      blockingIssues: [],
      advisoryIssues: [],
      candidateEligibility: {
        normal: "eligible",
        lognormal: "eligible",
        weibull: "eligible",
        gamma: "eligible",
        uniform: "eligible_with_boundary_warning",
      },
    },
  }],
  diagnostics: [],
  readyFactorCount: 1,
  blockedFactorCount: 0,
  replacementCount: 1,
  totalSampleCount: 32,
  diagnosticCount: 0,
} satisfies F7MeasurementImportPreviewResponse;

const committedSnapshot = {
  ...snapshot,
  factors: [{ sourceMode: "MEASURED" }],
} as F7SessionSnapshot;

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
    generateAssumptionResultsPdf: vi.fn(async () => new Blob(["%PDF-1.7"], { type: "application/pdf" })),
    getSession: vi.fn(async () => snapshot),
    downloadMeasurementTemplate: vi.fn(async () => ({
      fileName: "F7_Measurements_Anonymous_TA.xlsx",
      bytes: new Uint8Array([80, 75]),
    })),
    previewMeasurementImport: vi.fn(async () => measurementImportPreview),
    commitMeasurementImport: vi.fn(async () => committedSnapshot),
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

describe("createF7SessionStore measurement import lifecycle", () => {
  it("exposes a readonly null preview by default", () => {
    const store = createF7SessionStore(createClient());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(store.measurementImportPreview.value).toBeNull();
    (store.measurementImportPreview as { value: F7MeasurementImportPreviewResponse | null }).value = measurementImportPreview;
    expect(store.measurementImportPreview.value).toBeNull();
    warn.mockRestore();
  });

  it("downloads with its busy action and does not mutate the session", async () => {
    const client = createClient();
    const store = createF7SessionStore(client);
    await store.importWorkbook(new File([], "demo.xlsx"));
    const currentSession = store.session.value;
    let resolveDownload!: (value: { fileName: string; bytes: Uint8Array }) => void;
    client.downloadMeasurementTemplate = vi.fn(() => new Promise<{ fileName: string; bytes: Uint8Array }>((resolve) => { resolveDownload = resolve; }));

    const pending = store.downloadMeasurementTemplate();
    expect(store.busyAction.value).toBe("downloadMeasurementTemplate");
    resolveDownload({ fileName: "template.xlsx", bytes: new Uint8Array([80, 75]) });

    await expect(pending).resolves.toEqual({ fileName: "template.xlsx", bytes: new Uint8Array([80, 75]) });
    expect(client.downloadMeasurementTemplate).toHaveBeenCalledWith({ sessionId: "session-01" });
    expect(store.session.value).toBe(currentSession);
    expect(store.busyAction.value).toBeNull();
  });

  it.each(["ready", "blocked"] as const)("retains a %s preview for review without changing the session", async (status) => {
    const client = createClient();
    const preview = { ...measurementImportPreview, status } as F7MeasurementImportPreviewResponse;
    client.previewMeasurementImport = vi.fn(async () => preview);
    const store = createF7SessionStore(client);
    await store.importWorkbook(new File([], "demo.xlsx"));
    const currentSession = store.session.value;

    await store.previewMeasurementImport(new File([new Uint8Array([1, 2, 3])], "measurements.xlsx"));

    expect(client.previewMeasurementImport).toHaveBeenCalledWith({
      sessionId: "session-01",
      file: expect.objectContaining({ name: "measurements.xlsx" }),
    });
    expect(store.measurementImportPreview.value).toEqual(preview);
    expect(store.session.value).toBe(currentSession);
    expect(store.busyAction.value).toBeNull();
  });

  it("clears a stale preview before upload and leaves it cleared when upload fails", async () => {
    const client = createClient();
    const store = createF7SessionStore(client);
    await store.importWorkbook(new File([], "demo.xlsx"));
    await store.previewMeasurementImport(new File([], "first.xlsx"));
    let rejectUpload!: (error: unknown) => void;
    client.previewMeasurementImport = vi.fn(() => new Promise<F7MeasurementImportPreviewResponse>((_resolve, reject) => { rejectUpload = reject; }));

    const pending = store.previewMeasurementImport(new File([], "second.xlsx"));
    expect(store.measurementImportPreview.value).toBeNull();
    expect(store.busyAction.value).toBe("previewMeasurementImport");
    rejectUpload({
      code: "validation_error",
      summary: "Measurement workbook is invalid.",
      suggestedAction: "Correct the workbook.",
      affectedInputReferences: ["second.xlsx"],
    });

    await expect(pending).rejects.toMatchObject({ code: "validation_error" });
    expect(store.measurementImportPreview.value).toBeNull();
  });

  it("cancels a retained or in-flight preview without allowing a late response to restore it", async () => {
    const client = createClient();
    const store = createF7SessionStore(client);
    await store.importWorkbook(new File([], "demo.xlsx"));
    await store.previewMeasurementImport(new File([], "measurements.xlsx"));
    const currentSession = store.session.value;

    store.cancelMeasurementImport();

    expect(store.measurementImportPreview.value).toBeNull();
    expect(store.session.value).toBe(currentSession);

    let resolvePreview!: (preview: F7MeasurementImportPreviewResponse) => void;
    client.previewMeasurementImport = vi.fn(() => new Promise<F7MeasurementImportPreviewResponse>((resolve) => { resolvePreview = resolve; }));
    const pending = store.previewMeasurementImport(new File([], "late.xlsx"));
    store.cancelMeasurementImport();
    resolvePreview(measurementImportPreview);
    await pending;
    expect(store.measurementImportPreview.value).toBeNull();
  });

  it("clears preview after every authority-changing mutation and refresh", async () => {
    const store = createF7SessionStore(createClient());
    await store.importWorkbook(new File([], "demo.xlsx"));
    const mutations = [
      () => store.importWorkbook(new File([], "replacement.xlsx")),
      () => store.confirmWorksheet("Anonymous_TA"),
      () => store.confirmFactors([], { lowerSpecLimit: -1, upperSpecLimit: 1, targetSigmaLevel: 4 }),
      () => store.setFactorMode("factor-01", "MEASURED"),
      () => store.pasteMeasurements({
        factorId: "factor-01",
        structure: "UNORDERED_SAMPLE" as const,
        sourceReference: "clipboard",
        msaStatus: "available" as const,
        text: "1\n2",
      }),
      () => store.applyMeasurementDisposition({
        factorId: "factor-01",
        rowNumbers: [1],
        action: "EXCLUDE" as const,
        reason: "OUTLIER" as const,
        operatorReference: "operator-01",
      }),
      () => store.refreshSession(),
    ];

    for (const mutate of mutations) {
      await store.previewMeasurementImport(new File([], "measurements.xlsx"));
      await mutate();
      expect(store.measurementImportPreview.value).toBeNull();
    }
  });

  it("commits the preview atomically, replaces the session, and clears preview", async () => {
    const client = createClient();
    const store = createF7SessionStore(client);
    await store.importWorkbook(new File([], "demo.xlsx"));
    await store.previewMeasurementImport(new File([], "measurements.xlsx"));

    const pending = store.commitMeasurementImport();
    expect(store.busyAction.value).toBe("commitMeasurementImport");
    await pending;

    expect(client.commitMeasurementImport).toHaveBeenCalledWith({
      sessionId: "session-01",
      previewId: "preview-01",
      replacementFactorIds: ["b".repeat(64)],
      confirmed: true,
    });
    expect(store.session.value).toEqual(committedSnapshot);
    expect(store.measurementImportPreview.value).toBeNull();
    expect(store.busyAction.value).toBeNull();
  });

  it("preserves the old session but clears the consumed preview when commit fails", async () => {
    const client = createClient();
    const store = createF7SessionStore(client);
    await store.importWorkbook(new File([], "demo.xlsx"));
    await store.previewMeasurementImport(new File([], "measurements.xlsx"));
    const currentSession = store.session.value;
    client.commitMeasurementImport = vi.fn(async () => {
      throw {
        code: "prerequisite_not_ready",
        summary: "The preview is stale.",
        suggestedAction: "Upload a new workbook.",
        affectedInputReferences: ["preview-01"],
      };
    });

    await expect(store.commitMeasurementImport()).rejects.toMatchObject({ code: "prerequisite_not_ready" });

    expect(store.session.value).toBe(currentSession);
    expect(store.measurementImportPreview.value).toBeNull();
    expect(store.busyAction.value).toBeNull();
  });

  it("reconciles the authoritative session after an uncertain commit failure", async () => {
    const client = createClient();
    const reconciledSnapshot = { ...snapshot, status: "phase_1_ready" } as F7SessionSnapshot;
    client.commitMeasurementImport = vi.fn(async () => {
      throw {
        code: "request_failed",
        summary: "Unable to complete the F7 workbench request.",
        suggestedAction: "Retry the action.",
        affectedInputReferences: ["f7-web-client"],
      };
    });
    client.getSession = vi.fn(async () => reconciledSnapshot);
    const store = createF7SessionStore(client);
    await store.importWorkbook(new File([], "demo.xlsx"));
    await store.previewMeasurementImport(new File([], "measurements.xlsx"));

    await expect(store.commitMeasurementImport()).rejects.toMatchObject({ code: "request_failed" });

    expect(client.getSession).toHaveBeenCalledWith("session-01");
    expect(store.session.value).toEqual(reconciledSnapshot);
    expect(store.measurementImportPreview.value).toBeNull();
  });
});