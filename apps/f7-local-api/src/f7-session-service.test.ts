import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  f7MonteCarloResultSchema,
  f7ReportProjectionSchema,
  f7SessionSnapshotSchema,
  typedErrorSchema,
  type F7FactorSetupConfirmation,
  type F7SessionSnapshot,
} from "@ai-assist/contracts";
import { runF7MonteCarlo } from "@ai-assist/f7-simulation";
import { createAnonymousWorkbookZip } from "../../../packages/workbook-catalog/src/test-support.js";
import { F7ReportPrerequisiteError } from "./f7-report.js";
import { createF7SessionService, MAX_F7_LOCAL_SESSIONS } from "./f7-session-service.js";

const workbookCatalogTestState = vi.hoisted(() => ({
  hideSelectedWorksheet: false,
  returnInvalidSystemSpecification: false,
}));

vi.mock("@ai-assist/f7-simulation", () => ({ runF7MonteCarlo: vi.fn() }));

vi.mock("@ai-assist/workbook-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ai-assist/workbook-catalog")>();
  return {
    ...actual,
    extractResponseSummarySystemSpecification(
      ...args: Parameters<typeof actual.extractResponseSummarySystemSpecification>
    ) {
      const specification = actual.extractResponseSummarySystemSpecification(...args);
      return workbookCatalogTestState.returnInvalidSystemSpecification
        ? { ...specification, compatibilityBypassProbe: true }
        : specification;
    },
    readOoxmlWorkbook(...args: Parameters<typeof actual.readOoxmlWorkbook>) {
      const workbook = actual.readOoxmlWorkbook(...args);
      return workbookCatalogTestState.hideSelectedWorksheet
        ? { ...workbook, worksheets: new Map() }
        : workbook;
    },
  };
});

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

function worksheet(rows: string): string {
  return `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData>${rows}</sheetData></worksheet>`;
}

function cell(reference: string, value: string): string {
  return `<c r="${reference}"><v>${value}</v></c>`;
}

function sheetRows(includeResponseSummary = true, includeErrorCell = false): string {
  const factors = [
    ["Fabric thickness", "-0.57", "0.0125", "-1", "0.57"],
    ["C-cover height", "-1.94", "0.025", "-1", "1.94"],
    ["Shim thickness", "0.22", "0.0125", "+1", "0.22"],
    ["Switch height", "0.75", "0.025", "+1", "0.75"],
    ["TP PCB thickness", "0.44", "0.0125", "+1", "0.44"],
    ["HAF thickness", "0.05", "0.0125", "+1", "0.05"],
    ["Glass thickness", "1", "0.0125", "+1", "1"],
  ] as const;
  const factorRows = factors.map((factor, index) => {
    const row = 14 + index;
    return `<row r="${row}">${cell(`G${row}`, factor[0])}${cell(`L${row}`, "0")}${cell(`M${row}`, "0")}${cell(`N${row}`, "0")}${cell(`O${row}`, "1")}${cell(`P${row}`, "0")}${cell(`Q${row}`, "Normal")}${cell(`R${row}`, factor[1])}${cell(`S${row}`, factor[4])}${cell(`T${row}`, factor[2])}</row>`;
  }).join("");

  const responseSummaryAnchor = includeResponseSummary
    ? `<row r="53">${cell("O53", "Response Summary")}</row>`
    : "";
  const errorRow = includeErrorCell ? '<row r="52"><c r="P52" t="e"><v>#N/A</v></c></row>' : "";
  return `<row r="11">${cell("G11", "Tolerance Loop Description")}${cell("H11", "Anonymous loop")}</row><row r="13">${cell("G13", "Factor Description (TA Loop)")}${cell("L13", "Design Nominal")}${cell("M13", "+ Tolerance")}${cell("N13", "- Tolerance")}${cell("O13", "Long Term/Safety Factor")}${cell("P13", "Sigma level")}${cell("Q13", "Distribution")}${cell("R13", "Mean")}${cell("S13", "Tolerance")}${cell("T13", "1 Sigma")}</row>${factorRows}${errorRow}${responseSummaryAnchor}<row r="54">${cell("O54", "LSL")}${cell("P54", "-0.15")}</row><row r="55">${cell("O55", "USL")}${cell("P55", "0.05")}</row><row r="56">${cell("O56", "Target Sigma Level")}${cell("P56", "3")}</row>`;
}

function buildWorkbook(options: { readonly includeResponseSummary?: boolean; readonly includeErrorCell?: boolean } = {}): Uint8Array {
  const workbookXml = `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/><sheet name="Auto Summary" sheetId="2" r:id="rId2"/><sheet name="Anonymous_TA" sheetId="3" r:id="rId3"/></sheets></workbook>`;
  const xmlParts: Record<string, string> = {
    "xl/workbook.xml": workbookXml,
    "xl/worksheets/sheet1.xml": worksheet(`<row r="2">${cell("A2", "Document No.")}${cell("B2", "DOC-007")}</row><row r="4">${cell("A4", "Revision:")}${cell("B4", "R2")}</row><row r="6">${cell("A6", "Date:")}${cell("B6", "2026-07-23")}</row>`),
    "xl/worksheets/sheet2.xml": worksheet(`<row r="9">${cell("A9", "Device Level Dim")}${cell("C9", "Tolerance Loop Description")}</row><row r="10">${cell("A10", "Anonymous_TA")}${cell("C10", "First loop")}</row>`),
    "xl/worksheets/sheet3.xml": worksheet(sheetRows(
      options.includeResponseSummary ?? true,
      options.includeErrorCell ?? false,
    )),
  };
  return createAnonymousWorkbookZip({ xmlParts });
}

function createService(options: {
  createId?: () => string;
  now?: () => string;
  createReportProjection?: Parameters<typeof createF7SessionService>[0]["createReportProjection"];
} = {}) {
  return createF7SessionService({
    createId: options.createId ?? (() => "session-fixed"),
    now: options.now ?? (() => "2026-08-19T08:00:00.000Z"),
    ...(options.createReportProjection === undefined
      ? {}
      : { createReportProjection: options.createReportProjection }),
  });
}

function importRequest(workbookBytes: Uint8Array) {
  return {
    contractId: "f7-analysis-request-v1" as const,
    inputClassification: "confidential" as const,
    fileName: "anonymous.xlsx",
    workbookBytes,
  };
}

function worksheetConfirmation(workbookHash: string) {
  return {
    workbookContentHash: workbookHash,
    selectedWorksheetNames: ["Anonymous_TA"],
    confirmed: true as const,
  };
}

function confirmAll(snapshot: F7SessionSnapshot): readonly F7FactorSetupConfirmation[] {
  return snapshot.factors.map((state) => ({
    factorCandidateId: state.factorCandidate.factorCandidateId,
    designNominal: state.factorCandidate.designNominal,
    upperTolerance: state.factorCandidate.upperTolerance,
    lowerTolerance: state.factorCandidate.lowerTolerance,
    confirmed: true,
  }));
}

function expectValidationErrorWithSummary(error: unknown, summary: string, actionContains?: string): void {
  const parsed = typedErrorSchema.safeParse(error);
  expect(parsed.success).toBe(true);
  if (!parsed.success) return;
  expect(parsed.data.code).toBe("validation_error");
  expect(parsed.data.summary).toBe(summary);
  expect(parsed.data.suggestedAction).toContain(actionContains ?? "session");
  expect(parsed.data.affectedInputReferences).toEqual(["f7-session-service"]);
}

function createMonteCarloResult(
  request: Parameters<typeof runF7MonteCarlo>[0] & { readonly targetSigmaLevel: number },
) {
  const mean = 0;
  const standardDeviation = 1;
  const bins = Array.from({ length: 20 }, (_, index) => ({
    minimum: index - 10,
    maximum: index - 9,
    observedCount: index === 0 ? request.iterations : 0,
  }));
  const cp = (request.upperSpecLimit - request.lowerSpecLimit) / (6 * standardDeviation);
  const lowerCpk = (mean - request.lowerSpecLimit) / (3 * standardDeviation);
  const upperCpk = (request.upperSpecLimit - mean) / (3 * standardDeviation);
  const cpk = Math.min(lowerCpk, upperCpk);
  const targetCpk = request.targetSigmaLevel / 3;
  return f7MonteCarloResultSchema.parse({
    methodId: "F7_MONTE_CARLO_V1",
    status: "complete",
    lowerSpecLimit: request.lowerSpecLimit,
    upperSpecLimit: request.upperSpecLimit,
    targetSigmaLevel: request.targetSigmaLevel,
    iterations: request.iterations,
    runSeed: request.runSeed,
    correlationMode: request.correlationMode,
    mean,
    standardDeviation,
    quantiles: {
      p00135: -3,
      p01: -2.33,
      p05: -1.64,
      p50: 0,
      p95: 1.64,
      p99: 2.33,
      p99865: 3,
    },
    inSpecCount: request.iterations,
    outOfSpecCount: 0,
    yield: 1,
    outOfSpecProbability: 0,
    ppm: 0,
    histogram: { methodId: "F7_HISTOGRAM_FD_V1", bins },
    normalFit: {
      methodId: "F7_NORMAL_MOMENT_FIT_V1",
      mean,
      standardDeviation,
      expectedBinCounts: bins.map((bin) => bin.observedCount),
    },
    capability: {
      status: "available",
      cp,
      lowerCpk,
      upperCpk,
      cpk,
      targetCpk,
      targetStatus: cpk >= targetCpk ? "meets_target" : "below_target",
    },
    normalModel: {
      status: "available",
      lowerTailDpm: 0,
      upperTailDpm: 0,
      totalDpm: 0,
      expectedYield: 1,
    },
    factorManifest: request.factors.map(({ factorId, family, sourceMode }) => ({ factorId, family, sourceMode })),
  });
}

function prepareBaselineSimulation(service: ReturnType<typeof createService>): F7SessionSnapshot {
  const imported = service.importWorkbook(importRequest(buildWorkbook()));
  const worksheetReady = service.confirmWorksheet({
    sessionId: imported.sessionId,
    confirmation: worksheetConfirmation(imported.workbook.workbookContentHash),
  });
  let snapshot = service.confirmFactorSetup({
    sessionId: imported.sessionId,
    confirmations: confirmAll(worksheetReady),
  });
  for (const factor of snapshot.factors) {
    snapshot = service.setFactorMode({
      sessionId: imported.sessionId,
      factorId: factor.evidence!.factorId,
      mode: "BASELINE_ASSUMPTION",
    });
  }
  vi.mocked(runF7MonteCarlo).mockImplementation((request) => createMonteCarloResult(
    request as Parameters<typeof runF7MonteCarlo>[0] & { readonly targetSigmaLevel: number },
  ));
  return service.runMonteCarlo({
    sessionId: imported.sessionId,
    lowerSpecLimit: -5,
    upperSpecLimit: 5,
    targetSigmaLevel: 4,
    iterations: 10_000,
    runSeed: "e".repeat(64),
    correlationMode: "INDEPENDENT",
  });
}

describe("createF7SessionService", () => {
  afterEach(() => {
    workbookCatalogTestState.hideSelectedWorksheet = false;
    workbookCatalogTestState.returnInvalidSystemSpecification = false;
    vi.mocked(runF7MonteCarlo).mockReset();
  });

  it("importWorkbook keeps bytes private, uses injected id, and rejects duplicate ids", () => {
    const workbookBytes = buildWorkbook();
    const ids = ["s-1", "s-1"];
    const service = createService({ createId: () => ids.shift() ?? "" });

    const snapshot = service.importWorkbook(importRequest(workbookBytes));
    expect(snapshot.sessionId).toBe("s-1");
    expect(snapshot.status).toBe("worksheet_selection");
    expect(snapshot.worksheetOptions.length).toBeGreaterThan(0);
    expect(snapshot.worksheetOptions[0]?.worksheetName).toBe("Anonymous_TA");
    expect(snapshot.worksheetOptions[0]?.selectionIndex).toBe(1);
    expect(snapshot.workbook.workbookContentHash).toBe(createHash("sha256").update(workbookBytes).digest("hex"));
    expect(snapshot.systemSpecification).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain("workbookBytes");
    expect(f7SessionSnapshotSchema.safeParse(snapshot).success).toBe(true);

    expect(() => service.importWorkbook(importRequest(workbookBytes))).toThrow();
  });

  it("evicts the oldest session when the fixed local session budget is reached", () => {
    const workbookBytes = buildWorkbook();
    const ids = Array.from({ length: 10 }, (_, index) => `s-${index + 1}`);
    let createIdCalls = 0;
    const service = createService({
      createId: () => {
        createIdCalls += 1;
        return ids[createIdCalls - 1] ?? `s-overflow-${createIdCalls}`;
      },
    });

    const snapshots: F7SessionSnapshot[] = [];
    for (let index = 0; index < MAX_F7_LOCAL_SESSIONS; index += 1) {
      snapshots.push(service.importWorkbook(importRequest(workbookBytes)));
    }
    expect(createIdCalls).toBe(MAX_F7_LOCAL_SESSIONS);

    const replacement = service.importWorkbook(importRequest(workbookBytes));

    expect(replacement.sessionId).toBe("s-9");
    expect(createIdCalls).toBe(MAX_F7_LOCAL_SESSIONS + 1);
    let oldestSessionError: unknown;
    try {
      service.getSession(snapshots[0]!.sessionId);
    } catch (error) {
      oldestSessionError = error;
    }
    expectValidationErrorWithSummary(oldestSessionError, "F7 session state was not found.", "Confirm session identity");
    for (const snapshot of snapshots.slice(1)) {
      expect(service.getSession(snapshot.sessionId).sessionId).toBe(snapshot.sessionId);
    }
    expect(service.getSession(replacement.sessionId).sessionId).toBe(replacement.sessionId);
  });

  it("confirmWorksheet transitions to factor_setup and blocks stale hash without mutation", () => {
    const workbookBytes = buildWorkbook();
    const service = createService();
    const imported = service.importWorkbook(importRequest(workbookBytes));

    const next = service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: worksheetConfirmation(imported.workbook.workbookContentHash),
    });

    expect(next.status).toBe("factor_setup");
    expect(next.worksheetOptions.length).toBeGreaterThan(0);
    expect(next.worksheetOptions[0]?.worksheetName).toBe("Anonymous_TA");
    expect(next.systemSpecification).toEqual({
      status: "available",
      lowerSpecLimit: {
        status: "available",
        actualValue: -0.15,
        displayValue: "-0.15",
        sourceLabel: "LSL",
        sourceCell: "Anonymous_TA!P54",
        valueOrigin: "numeric_literal",
      },
      upperSpecLimit: {
        status: "available",
        actualValue: 0.05,
        displayValue: "0.05",
        sourceLabel: "USL",
        sourceCell: "Anonymous_TA!P55",
        valueOrigin: "numeric_literal",
      },
      targetSigmaLevel: {
        status: "available",
        actualValue: 3,
        displayValue: "3",
        sourceLabel: "Target Sigma Level",
        sourceCell: "Anonymous_TA!P56",
        valueOrigin: "numeric_literal",
      },
      additionalMeanShift: {
        status: "available",
        actualValue: 0,
        displayValue: "0",
        sourceLabel: "Additional Mean Shift",
        valueOrigin: "defaulted",
      },
    });
    expect(next.factors.length).toBeGreaterThan(0);
    for (const factor of next.factors) {
      expect(factor.setup).toBeUndefined();
      expect(factor.evidence).toBeUndefined();
    }

    const beforeError = service.getSession(imported.sessionId);
    expect(() => service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: worksheetConfirmation("f".repeat(64)),
    })).toThrow();
    expect(service.getSession(imported.sessionId)).toEqual(beforeError);
  });

  it("preserves unavailable system specification when the Response Summary anchor is missing", () => {
    const service = createService();
    const imported = service.importWorkbook(importRequest(buildWorkbook({ includeResponseSummary: false })));

    expect(imported.systemSpecification).toBeUndefined();
    const next = service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: worksheetConfirmation(imported.workbook.workbookContentHash),
    });

    expect(next.systemSpecification).toEqual({
      status: "unavailable",
      reasonCode: "response_summary_label_missing",
    });
  });

  it("confirms a worksheet containing a formula error cell outside the system specification", () => {
    const service = createService();
    const imported = service.importWorkbook(importRequest(buildWorkbook({ includeErrorCell: true })));

    const next = service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: worksheetConfirmation(imported.workbook.workbookContentHash),
    });

    expect(next.status).toBe("factor_setup");
    expect(next.systemSpecification).toMatchObject({
      status: "available",
      lowerSpecLimit: { actualValue: -0.15 },
      upperSpecLimit: { actualValue: 0.05 },
      targetSigmaLevel: { actualValue: 3 },
    });
  });

  it("rejects a system specification that fails the complete snapshot schema without mutating the session", () => {
    const service = createService();
    const imported = service.importWorkbook(importRequest(buildWorkbook()));
    const before = service.getSession(imported.sessionId);
    workbookCatalogTestState.returnInvalidSystemSpecification = true;

    expect(() => service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: worksheetConfirmation(imported.workbook.workbookContentHash),
    })).toThrow();
    expect(service.getSession(imported.sessionId)).toEqual(before);
  });

  it("fails atomically with a controlled error when the selected worksheet cannot be read", () => {
    const service = createService();
    const imported = service.importWorkbook(importRequest(buildWorkbook()));
    const before = service.getSession(imported.sessionId);
    workbookCatalogTestState.hideSelectedWorksheet = true;

    let selectedWorksheetError: unknown;
    try {
      service.confirmWorksheet({
        sessionId: imported.sessionId,
        confirmation: worksheetConfirmation(imported.workbook.workbookContentHash),
      });
    } catch (error) {
      selectedWorksheetError = error;
    }

    const parsed = typedErrorSchema.safeParse(selectedWorksheetError);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.code).toBe("internal_error");
      expect(parsed.data.summary).toBe("F7 selected worksheet could not be read.");
    }
    expect(service.getSession(imported.sessionId)).toEqual(before);
  });

  it("confirmFactorSetup accepts the selected factor set and rejects duplicates atomically", () => {
    const workbookBytes = buildWorkbook();
    const service = createService();
    const imported = service.importWorkbook(importRequest(workbookBytes));
    const worksheetReady = service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: worksheetConfirmation(imported.workbook.workbookContentHash),
    });
    const confirmations = confirmAll(worksheetReady);

    const good = service.confirmFactorSetup({
      sessionId: imported.sessionId,
      confirmations,
    });
    expect(good.status).toBe("measurement_entry");
    for (const factor of good.factors) {
      expect(factor.setup?.confirmed).toBe(true);
      expect(factor.evidence).toBeDefined();
    }

    const another = createService();
    const imported2 = another.importWorkbook(importRequest(workbookBytes));
    const setup2 = another.confirmWorksheet({
      sessionId: imported2.sessionId,
      confirmation: worksheetConfirmation(imported2.workbook.workbookContentHash),
    });
    const selected = another.confirmFactorSetup({
      sessionId: imported2.sessionId,
      confirmations: [confirmAll(setup2)[0]!, {
        factorCandidateId: "b".repeat(64),
        factorName: "User stack gap",
        userAdded: true,
        designNominal: 0.4,
        upperTolerance: 0.08,
        lowerTolerance: -0.04,
        longTermSafetyFactor: 1,
        sigmaLevel: 4,
        distribution: "Normal",
        confirmed: true,
      }],
    });
    expect(selected.factors).toHaveLength(2);
    expect(selected.factors[1]?.factorCandidate).toMatchObject({
      factorCandidateId: "b".repeat(64),
      factorName: "User stack gap",
      userAdded: true,
      sourceCells: {},
    });
    expect(selected.factors[1]?.evidence).toMatchObject({
      userAdded: true,
      calculatedMean: 0.42000000000000004,
      oneSigma: 0.015,
    });

    const duplicateService = createService();
    const duplicateImport = duplicateService.importWorkbook(importRequest(workbookBytes));
    const duplicateSetup = duplicateService.confirmWorksheet({
      sessionId: duplicateImport.sessionId,
      confirmation: worksheetConfirmation(duplicateImport.workbook.workbookContentHash),
    });
    const before = duplicateService.getSession(duplicateImport.sessionId);
    expect(() => duplicateService.confirmFactorSetup({
      sessionId: duplicateImport.sessionId,
      confirmations: [confirmAll(duplicateSetup)[0]!, confirmAll(duplicateSetup)[0]!],
    })).toThrow();
    expect(duplicateService.getSession(duplicateImport.sessionId)).toEqual(before);
  });

  it("reconfirms factor setup after analysis and clears all downstream results", () => {
    const service = createService();
    const completed = prepareBaselineSimulation(service);
    expect(completed.status).toBe("phase_1_ready");
    expect(completed.monteCarloResult).toBeDefined();

    const confirmations = completed.factors.map((factor, index) => ({
      ...factor.setup!,
      designNominal: index === 0 ? factor.setup!.designNominal - 0.1 : factor.setup!.designNominal,
      confirmed: true as const,
    }));
    const reconfirmed = service.confirmFactorSetup({
      sessionId: completed.sessionId,
      confirmations,
    });

    expect(reconfirmed.status).toBe("measurement_entry");
    expect(reconfirmed.monteCarloResult).toBeUndefined();
    expect(reconfirmed.factors[0]?.setup?.designNominal).toBe(confirmations[0]?.designNominal);
    for (const factor of reconfirmed.factors) {
      expect(factor.sourceMode).toBeUndefined();
      expect(factor.input).toBeUndefined();
      expect(factor.measurementPasteResult).toBeUndefined();
      expect(factor.distributionFitResult).toBeUndefined();
      expect(factor.distributionApproval).toBeUndefined();
    }
  });

  it("setFactorMode handles baseline and measured transitions and clears obsolete state", () => {
    const workbookBytes = buildWorkbook();
    const service = createService();
    const imported = service.importWorkbook(importRequest(workbookBytes));
    const worksheetReady = service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: worksheetConfirmation(imported.workbook.workbookContentHash),
    });
    const setup = service.confirmFactorSetup({ sessionId: imported.sessionId, confirmations: confirmAll(worksheetReady) });
    const target = setup.factors[0]?.evidence?.factorId;
    expect(target).toBeDefined();
    if (!target) throw new Error("expected factor id");

    const measured = service.setFactorMode({ sessionId: imported.sessionId, factorId: target, mode: "MEASURED" });
    expect(measured.status).toBe("measurement_entry");
    expect(measured.factors[0]?.input).toEqual({ mode: "MEASURED" });

    const pasted = service.pasteMeasurements({
      sessionId: imported.sessionId,
      factorId: target,
      unit: "bad-client-unit",
      structure: "UNORDERED_SAMPLE",
      sourceReference: "paste-1",
      msaStatus: "available",
      text: Array.from({ length: 30 }, (_, index) => `${index + 1}`).join("\n"),
    });
    expect(pasted.factors[0]?.measurementPasteResult?.dataset?.importedAt).toBe("2026-08-19T08:00:00.000Z");
    expect(pasted.factors[0]?.measurementPasteResult?.dataset?.unit).toBe("unspecified");

    const baseline = service.setFactorMode({ sessionId: imported.sessionId, factorId: target, mode: "BASELINE_ASSUMPTION" });
    expect(baseline.factors[0]?.input?.mode).toBe("BASELINE_ASSUMPTION");
    expect(baseline.factors[0]?.measurementPasteResult).toBeUndefined();
    expect(baseline.factors[0]?.datasetValidation).toBeUndefined();

    const measuredAgain = service.setFactorMode({ sessionId: imported.sessionId, factorId: target, mode: "MEASURED" });
    expect(measuredAgain.factors[0]?.input).toEqual({ mode: "MEASURED" });
    expect(() => service.setFactorMode({ sessionId: imported.sessionId, factorId: "a".repeat(64), mode: "MEASURED" })).toThrow();
    expect(() => service.setFactorMode({ sessionId: "missing", factorId: target, mode: "MEASURED" })).toThrow();
  });

  it("pasteMeasurements and disposition drive readiness transitions", () => {
    const workbookBytes = buildWorkbook();
    const service = createService();
    const imported = service.importWorkbook(importRequest(workbookBytes));
    const worksheetReady = service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: worksheetConfirmation(imported.workbook.workbookContentHash),
    });
    let snapshot = service.confirmFactorSetup({ sessionId: imported.sessionId, confirmations: confirmAll(worksheetReady) });

    const factorIds = snapshot.factors.map((state) => state.evidence?.factorId).filter((value): value is string => value !== undefined);
    snapshot = service.setFactorMode({ sessionId: imported.sessionId, factorId: factorIds[0]!, mode: "MEASURED" });
    for (const factorId of factorIds.slice(1)) {
      snapshot = service.setFactorMode({ sessionId: imported.sessionId, factorId, mode: "BASELINE_ASSUMPTION" });
    }
    expect(snapshot.status).toBe("measurement_entry");

    snapshot = service.pasteMeasurements({
      sessionId: imported.sessionId,
      factorId: factorIds[0]!,
      unit: "mm",
      structure: "UNORDERED_SAMPLE",
      sourceReference: "paste-main",
      msaStatus: "available",
      text: Array.from({ length: 20 }, (_, index) => `${index + 1}`).join("\n"),
    });
    expect(snapshot.status).toBe("phase_1_ready");

    snapshot = service.applyMeasurementDisposition({
      sessionId: imported.sessionId,
      factorId: factorIds[0]!,
      rowNumbers: [1],
      action: "EXCLUDE",
      reason: "OUTLIER",
      operatorReference: "op-1",
      confirmed: true,
    });
    expect(snapshot.status).toBe("measurement_entry");

    snapshot = service.applyMeasurementDisposition({
      sessionId: imported.sessionId,
      factorId: factorIds[0]!,
      rowNumbers: [1],
      action: "RESTORE",
      reason: "OUTLIER",
      operatorReference: "op-1",
      confirmed: true,
    });
    expect(snapshot.status).toBe("phase_1_ready");
  });

  it("fits and persists a ready measured factor using included observations", () => {
    const service = createService();
    const imported = service.importWorkbook(importRequest(buildWorkbook()));
    const worksheetReady = service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: worksheetConfirmation(imported.workbook.workbookContentHash),
    });
    let snapshot = service.confirmFactorSetup({
      sessionId: imported.sessionId,
      confirmations: confirmAll(worksheetReady),
    });
    const factorIds = snapshot.factors
      .map((state) => state.evidence?.factorId)
      .filter((value): value is string => value !== undefined);
    snapshot = service.setFactorMode({
      sessionId: imported.sessionId,
      factorId: factorIds[0]!,
      mode: "MEASURED",
    });
    snapshot = service.pasteMeasurements({
      sessionId: imported.sessionId,
      factorId: factorIds[0]!,
      unit: "mm",
      structure: "UNORDERED_SAMPLE",
      sourceReference: "fit-ready",
      msaStatus: "available",
      text: Array.from({ length: 32 }, (_, index) => String(0.8 + index * 0.025 + (index % 3) * 0.004)).join("\n"),
    });
    expect(snapshot.factors[0]?.datasetValidation?.status).toBe("ready");

    const fitted = service.fitDistribution({ sessionId: imported.sessionId, factorId: factorIds[0]! });
    const fitResult = fitted.factors[0]?.distributionFitResult;
    expect(fitResult?.factorId).toBe(factorIds[0]);
    expect(fitResult?.sampleSize).toBe(32);
    expect(fitResult?.characteristicKind).toBe("other");
    expect(fitResult?.candidates.map((candidate) => candidate.family)).toEqual([
      "normal", "lognormal", "weibull", "gamma", "uniform",
    ]);
    expect(fitResult).toEqual(expect.objectContaining({
      sampleDiagnostics: expect.objectContaining({
        mean: expect.any(Number),
        median: expect.any(Number),
        skewness: expect.any(Number),
        coefficientOfVariation: expect.any(Number),
        meanMedianRelativeDifference: expect.any(Number),
        normalQqCurvature: expect.any(Number),
      }),
      selectionDecision: expect.objectContaining({
        methodId: "F7_MODEL_SELECTION_V1",
        status: expect.stringMatching(/^(unique_preference|no_unique_preference|no_acceptable_model|withheld_candidate_failures)$/),
        competitiveFamilies: expect.any(Array),
        proposedFinalFamily: expect.any(String),
        confidence: expect.stringMatching(/^(low|moderate)$/),
        reasonCodes: expect.any(Array),
      }),
    }));
    expect(fitResult).not.toHaveProperty("recommendedFamily");
    expect(fitResult?.candidates[0]).toEqual(expect.objectContaining({
      modelSpecification: expect.any(String),
      parameterCount: expect.any(Number),
      aic: expect.any(Number),
      deltaAicc: expect.any(Number),
      deltaBic: expect.any(Number),
      bootstrap: expect.objectContaining({
        replicates: 10000,
        methodId: "F7_BOOTSTRAP_V2",
        candidateMethodId: "F7_DISTRIBUTION_FIT_V1",
        extremeReplicateCount: expect.any(Number),
        confidenceInterval: expect.objectContaining({
          level: 0.95,
          method: "wilson_score",
          lower: expect.any(Number),
          upper: expect.any(Number),
        }),
      }),
    }));
    expect(service.getSession(imported.sessionId).factors[0]?.distributionFitResult).toEqual(fitResult);
    expect(f7SessionSnapshotSchema.safeParse(fitted).success).toBe(true);
  });

  it("requires explicit fit approval before running a reproducible Monte Carlo analysis", () => {
    const service = createService();
    const imported = service.importWorkbook(importRequest(buildWorkbook()));
    const worksheetReady = service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: worksheetConfirmation(imported.workbook.workbookContentHash),
    });
    let snapshot = service.confirmFactorSetup({
      sessionId: imported.sessionId,
      confirmations: confirmAll(worksheetReady),
    });
    const factorIds = snapshot.factors
      .map((state) => state.evidence?.factorId)
      .filter((value): value is string => value !== undefined);
    snapshot = service.setFactorMode({ sessionId: imported.sessionId, factorId: factorIds[0]!, mode: "MEASURED" });
    for (const factorId of factorIds.slice(1)) {
      snapshot = service.setFactorMode({ sessionId: imported.sessionId, factorId, mode: "BASELINE_ASSUMPTION" });
    }
    snapshot = service.pasteMeasurements({
      sessionId: imported.sessionId,
      factorId: factorIds[0]!,
      unit: "mm",
      structure: "UNORDERED_SAMPLE",
      sourceReference: "monte-carlo-ready",
      msaStatus: "available",
      text: Array.from({ length: 32 }, (_, index) => String(0.8 + index * 0.025 + (index % 3) * 0.004)).join("\n"),
    });
    snapshot = service.fitDistribution({ sessionId: imported.sessionId, factorId: factorIds[0]! });
    const proposedFamily = snapshot.factors[0]?.distributionFitResult?.selectionDecision.proposedFinalFamily;
    expect(proposedFamily).toBeDefined();

    const runRequest = {
      sessionId: imported.sessionId,
      lowerSpecLimit: -5,
      upperSpecLimit: 5,
      targetSigmaLevel: 4,
      iterations: 10_000 as const,
      runSeed: "c".repeat(64),
      correlationMode: "INDEPENDENT" as const,
    };
    expect(() => service.runMonteCarlo(runRequest)).toThrow();

    snapshot = service.approveDistribution({
      sessionId: imported.sessionId,
      factorId: factorIds[0]!,
      family: proposedFamily!,
      confirmed: true,
    });
    expect(snapshot.factors[0]?.distributionApproval?.family).toBe(proposedFamily);

    vi.mocked(runF7MonteCarlo).mockImplementation((request) => createMonteCarloResult(
      request as Parameters<typeof runF7MonteCarlo>[0] & { readonly targetSigmaLevel: number },
    ));
    const first = service.runMonteCarlo(runRequest);
    const second = service.runMonteCarlo(runRequest);
    expect(runF7MonteCarlo).toHaveBeenCalledWith(expect.objectContaining({ targetSigmaLevel: 4 }));
    expect(first.monteCarloResult).toEqual(second.monteCarloResult);
    expect(first.monteCarloResult?.targetSigmaLevel).toBe(4);
    expect(first.monteCarloResult).toEqual(expect.objectContaining({
      methodId: "F7_MONTE_CARLO_V1",
      iterations: 10_000,
      runSeed: "c".repeat(64),
      factorManifest: expect.arrayContaining([
        expect.objectContaining({ factorId: factorIds[0], sourceMode: "MEASURED", family: proposedFamily }),
      ]),
    }));

    const replaced = service.pasteMeasurements({
      sessionId: imported.sessionId,
      factorId: factorIds[0]!,
      unit: "mm",
      structure: "UNORDERED_SAMPLE",
      sourceReference: "monte-carlo-replaced",
      msaStatus: "available",
      text: Array.from({ length: 32 }, (_, index) => String(0.9 + index * 0.02)).join("\n"),
    });
    expect(replaced.factors[0]?.distributionApproval).toBeUndefined();
    expect(replaced.monteCarloResult).toBeUndefined();
  });

  it("generates a contract-valid report with the injected timestamp", () => {
    const service = createService({ now: () => "2026-08-25T09:30:00.000Z" });
    const simulated = prepareBaselineSimulation(service);

    const report = service.generateReport({ sessionId: simulated.sessionId });

    expect(report.generatedAt).toBe("2026-08-25T09:30:00.000Z");
    expect(report.sessionId).toBe(simulated.sessionId);
    expect(f7ReportProjectionSchema.parse(report)).toEqual(report);
  });

  it("blocks report generation before Monte Carlo completes", () => {
    const service = createService();
    const imported = service.importWorkbook(importRequest(buildWorkbook()));

    expect(() => service.generateReport({ sessionId: imported.sessionId })).toThrow(
      expect.objectContaining({
        code: "prerequisite_not_ready",
        summary: "F7 session operation is not ready.",
      }),
    );
  });

  it("blocks report generation after a factor change clears Monte Carlo", () => {
    const service = createService();
    const simulated = prepareBaselineSimulation(service);
    const factorId = simulated.factors[0]!.evidence!.factorId;

    const changed = service.setFactorMode({
      sessionId: simulated.sessionId,
      factorId,
      mode: "MEASURED",
    });

    expect(changed.monteCarloResult).toBeUndefined();
    expect(() => service.generateReport({ sessionId: simulated.sessionId })).toThrow(
      expect.objectContaining({ code: "prerequisite_not_ready" }),
    );
  });

  it("maps a known report prerequisite mismatch to the fixed prerequisite error", () => {
    const reportPrerequisiteError = new F7ReportPrerequisiteError("stale simulation manifest");
    const service = createService({
      createReportProjection: () => {
        throw reportPrerequisiteError;
      },
    });
    const simulated = prepareBaselineSimulation(service);

    expect(() => service.generateReport({ sessionId: simulated.sessionId })).toThrow(
      expect.objectContaining({
        code: "prerequisite_not_ready",
        summary: "F7 session operation is not ready.",
      }),
    );
  });

  it("does not map an unknown report projector error to a prerequisite", () => {
    const projectorError = new Error("unexpected projector failure");
    const service = createService({
      createReportProjection: () => {
        throw projectorError;
      },
    });
    const simulated = prepareBaselineSimulation(service);

    expect(() => service.generateReport({ sessionId: simulated.sessionId })).toThrow(projectorError);
  });

  it("clears a persisted distribution fit after paste, disposition, or source mode changes", () => {
    const service = createService();
    const imported = service.importWorkbook(importRequest(buildWorkbook()));
    const worksheetReady = service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: worksheetConfirmation(imported.workbook.workbookContentHash),
    });
    let snapshot = service.confirmFactorSetup({
      sessionId: imported.sessionId,
      confirmations: confirmAll(worksheetReady),
    });
    const factorIds = snapshot.factors
      .map((state) => state.evidence?.factorId)
      .filter((value): value is string => value !== undefined);
    snapshot = service.setFactorMode({
      sessionId: imported.sessionId,
      factorId: factorIds[0]!,
      mode: "MEASURED",
    });
    for (const factorId of factorIds.slice(1)) {
      snapshot = service.setFactorMode({
        sessionId: imported.sessionId,
        factorId,
        mode: "BASELINE_ASSUMPTION",
      });
    }
    const paste = (sourceReference: string) => service.pasteMeasurements({
      sessionId: imported.sessionId,
      factorId: factorIds[0]!,
      unit: "mm",
      structure: "UNORDERED_SAMPLE",
      sourceReference,
      msaStatus: "available",
      text: Array.from({ length: 32 }, (_, index) => String(0.8 + index * 0.025 + (index % 3) * 0.004)).join("\n"),
    });

    snapshot = paste("fit-before-paste");
    snapshot = service.fitDistribution({ sessionId: imported.sessionId, factorId: factorIds[0]! });
    expect(snapshot.factors[0]?.distributionFitResult).toBeDefined();
    snapshot = paste("replacement-paste");
    expect(snapshot.factors[0]?.distributionFitResult).toBeUndefined();

    snapshot = service.fitDistribution({ sessionId: imported.sessionId, factorId: factorIds[0]! });
    expect(snapshot.factors[0]?.distributionFitResult).toBeDefined();
    snapshot = service.applyMeasurementDisposition({
      sessionId: imported.sessionId,
      factorId: factorIds[0]!,
      rowNumbers: [1],
      action: "EXCLUDE",
      reason: "OUTLIER",
      operatorReference: "op-fit-invalidation",
      confirmed: true,
    });
    expect(snapshot.factors[0]?.distributionFitResult).toBeUndefined();
    snapshot = service.applyMeasurementDisposition({
      sessionId: imported.sessionId,
      factorId: factorIds[0]!,
      rowNumbers: [1],
      action: "RESTORE",
      reason: "OUTLIER",
      operatorReference: "op-fit-invalidation",
      confirmed: true,
    });
    snapshot = service.fitDistribution({ sessionId: imported.sessionId, factorId: factorIds[0]! });
    expect(snapshot.factors[0]?.distributionFitResult).toBeDefined();
    snapshot = service.setFactorMode({
      sessionId: imported.sessionId,
      factorId: factorIds[0]!,
      mode: "BASELINE_ASSUMPTION",
    });
    expect(snapshot.factors[0]?.distributionFitResult).toBeUndefined();
  });

  it("rejects ineligible distribution fit requests atomically", () => {
    const service = createService();
    const imported = service.importWorkbook(importRequest(buildWorkbook()));
    const worksheetReady = service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: worksheetConfirmation(imported.workbook.workbookContentHash),
    });
    let snapshot = service.confirmFactorSetup({
      sessionId: imported.sessionId,
      confirmations: confirmAll(worksheetReady),
    });
    const factorIds = snapshot.factors
      .map((state) => state.evidence?.factorId)
      .filter((value): value is string => value !== undefined);

    snapshot = service.setFactorMode({ sessionId: imported.sessionId, factorId: factorIds[0]!, mode: "BASELINE_ASSUMPTION" });
    const baselineBefore = service.getSession(imported.sessionId);
    expect(() => service.fitDistribution({ sessionId: imported.sessionId, factorId: factorIds[0]! })).toThrow();
    expect(service.getSession(imported.sessionId)).toEqual(baselineBefore);

    snapshot = service.setFactorMode({ sessionId: imported.sessionId, factorId: factorIds[0]!, mode: "MEASURED" });
    const unreadyBefore = service.getSession(imported.sessionId);
    expect(() => service.fitDistribution({ sessionId: imported.sessionId, factorId: factorIds[0]! })).toThrow();
    expect(service.getSession(imported.sessionId)).toEqual(unreadyBefore);

    expect(() => service.fitDistribution({ sessionId: imported.sessionId, factorId: "f".repeat(64) })).toThrow();
    expect(service.getSession(imported.sessionId)).toEqual(unreadyBefore);

    snapshot = service.pasteMeasurements({
      sessionId: imported.sessionId,
      factorId: factorIds[0]!,
      unit: "mm",
      structure: "UNORDERED_SAMPLE",
      sourceReference: "fit-blocked",
      msaStatus: "available",
      text: "1\n2\n3",
    });
    expect(snapshot.factors[0]?.datasetValidation?.status).toBe("blocked");
    const blockedBefore = service.getSession(imported.sessionId);
    expect(() => service.fitDistribution({ sessionId: imported.sessionId, factorId: factorIds[0]! })).toThrow();
    expect(service.getSession(imported.sessionId)).toEqual(blockedBefore);
  });

  it("getSession returns frozen snapshots and sessions remain isolated", () => {
    const workbookBytes = buildWorkbook();
    const ids = ["s-1", "s-2"];
    const service = createService({ createId: () => ids.shift() ?? "" });
    const s1 = service.importWorkbook(importRequest(workbookBytes));
    const s2 = service.importWorkbook(importRequest(workbookBytes));
    const a = service.confirmWorksheet({ sessionId: s1.sessionId, confirmation: worksheetConfirmation(s1.workbook.workbookContentHash) });
    const b = service.getSession(s2.sessionId);
    expect(a.sessionId).not.toBe(b.sessionId);
    expect(b.status).toBe("worksheet_selection");

    const frozen = service.getSession(s1.sessionId);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.factors)).toBe(true);
    expect(() => {
      (frozen.selectedWorksheetNames as string[]).push("BAD");
    }).toThrow();
    let missingSessionError: unknown;
    try {
      service.getSession("missing");
    } catch (error) {
      missingSessionError = error;
    }
    expectValidationErrorWithSummary(missingSessionError, "F7 session state was not found.");
    expect(f7SessionSnapshotSchema.safeParse(service.getSession(s1.sessionId)).success).toBe(true);
  });
});