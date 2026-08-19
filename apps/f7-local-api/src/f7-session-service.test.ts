import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  f7SessionSnapshotSchema,
  typedErrorSchema,
  type F7FactorSetupConfirmation,
  type F7SessionSnapshot,
} from "@ai-assist/contracts";
import { createAnonymousWorkbookZip } from "../../../packages/workbook-catalog/src/test-support.js";
import { createF7SessionService, MAX_F7_LOCAL_SESSIONS } from "./f7-session-service.js";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

function worksheet(rows: string): string {
  return `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData>${rows}</sheetData></worksheet>`;
}

function cell(reference: string, value: string): string {
  return `<c r="${reference}"><v>${value}</v></c>`;
}

function sheetRows(): string {
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

  return `<row r="11">${cell("G11", "Tolerance Loop Description")}${cell("H11", "Anonymous loop")}</row><row r="13">${cell("G13", "Factor Description (TA Loop)")}${cell("L13", "Design Nominal")}${cell("M13", "+ Tolerance")}${cell("N13", "- Tolerance")}${cell("O13", "Long Term/Safety Factor")}${cell("P13", "Sigma level")}${cell("Q13", "Distribution")}${cell("R13", "Mean")}${cell("S13", "Tolerance")}${cell("T13", "1 Sigma")}</row>${factorRows}<row r="54">${cell("O54", "LSL")}${cell("P54", "-0.15")}</row><row r="55">${cell("O55", "USL")}${cell("P55", "0.05")}</row>`;
}

function buildWorkbook(): Uint8Array {
  const workbookXml = `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/><sheet name="Auto Summary" sheetId="2" r:id="rId2"/><sheet name="Anonymous_TA" sheetId="3" r:id="rId3"/></sheets></workbook>`;
  const xmlParts: Record<string, string> = {
    "xl/workbook.xml": workbookXml,
    "xl/worksheets/sheet1.xml": worksheet(`<row r="2">${cell("A2", "Document No.")}${cell("B2", "DOC-007")}</row><row r="4">${cell("A4", "Revision:")}${cell("B4", "R2")}</row><row r="6">${cell("A6", "Date:")}${cell("B6", "2026-07-23")}</row>`),
    "xl/worksheets/sheet2.xml": worksheet(`<row r="9">${cell("A9", "Device Level Dim")}${cell("C9", "Tolerance Loop Description")}</row><row r="10">${cell("A10", "Anonymous_TA")}${cell("C10", "First loop")}</row>`),
    "xl/worksheets/sheet3.xml": worksheet(sheetRows()),
  };
  return createAnonymousWorkbookZip({ xmlParts });
}

function createService(options: {
  createId?: () => string;
  now?: () => string;
} = {}) {
  return createF7SessionService({
    createId: options.createId ?? (() => "session-fixed"),
    now: options.now ?? (() => "2026-08-19T08:00:00.000Z"),
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
  return snapshot.factors.map((state, index) => ({
    factorCandidateId: state.factorCandidate.factorCandidateId,
    loopCoefficient: index < 2 ? -1 : 1,
    unit: "mm",
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

describe("createF7SessionService", () => {
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
    expect(JSON.stringify(snapshot)).not.toContain("workbookBytes");
    expect(f7SessionSnapshotSchema.safeParse(snapshot).success).toBe(true);

    expect(() => service.importWorkbook(importRequest(workbookBytes))).toThrow();
  });

  it("enforces a fixed local session budget before ID allocation", () => {
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

    let capacityError: unknown;
    try {
      service.importWorkbook(importRequest(workbookBytes));
    } catch (error) {
      capacityError = error;
    }

    expectValidationErrorWithSummary(capacityError, "F7 local session capacity is reached.", "Restart");
    expect(createIdCalls).toBe(MAX_F7_LOCAL_SESSIONS);
    for (const snapshot of snapshots) {
      expect(service.getSession(snapshot.sessionId).sessionId).toBe(snapshot.sessionId);
    }
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

  it("confirmFactorSetup requires complete unique confirmations and has atomic failures", () => {
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
    const before = another.getSession(imported2.sessionId);
    const oneMissing = confirmAll(setup2).slice(0, -1);
    expect(() => another.confirmFactorSetup({ sessionId: imported2.sessionId, confirmations: oneMissing })).toThrow();
    expect(() => another.confirmFactorSetup({
      sessionId: imported2.sessionId,
      confirmations: [confirmAll(setup2)[0]!, confirmAll(setup2)[0]!, ...confirmAll(setup2).slice(1)],
    })).toThrow();
    expect(another.getSession(imported2.sessionId)).toEqual(before);
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
    expect(pasted.factors[0]?.measurementPasteResult?.dataset?.unit).toBe("mm");

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