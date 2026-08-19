import { afterEach, describe, expect, it } from "vitest";
import { request } from "node:http";
import type { F7SessionSnapshot } from "@ai-assist/contracts";
import { createAnonymousWorkbookZip } from "../../../packages/workbook-catalog/src/test-support.js";
import { createF7SessionService } from "./f7-session-service.js";
import { createF7LocalServer, listenF7LocalServer } from "./server.js";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

function worksheet(rows: string): string {
  return `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData>${rows}</sheetData></worksheet>`;
}

function cell(reference: string, value: string): string {
  return `<c r="${reference}"><v>${value}</v></c>`;
}

function factorRows(): string {
  const factors = [
    ["Factor A", "0.57", "0.0125", "+1", "0.57"],
    ["Factor B", "0.32", "0.0100", "+1", "0.32"],
  ] as const;

  const rows = factors.map((factor, index) => {
    const row = 14 + index;
    return `<row r="${row}">${cell(`G${row}`, factor[0])}${cell(`L${row}`, "0")}${cell(`M${row}`, "0")}${cell(`N${row}`, "0")}${cell(`O${row}`, "1")}${cell(`P${row}`, "0")}${cell(`Q${row}`, "Normal")}${cell(`R${row}`, factor[1])}${cell(`S${row}`, factor[4])}${cell(`T${row}`, factor[2])}</row>`;
  }).join("");

  return `<row r="11">${cell("G11", "Tolerance Loop Description")}${cell("H11", "Two-factor anonymous loop")}</row><row r="13">${cell("G13", "Factor Description (TA Loop)")}${cell("L13", "Design Nominal")}${cell("M13", "+ Tolerance")}${cell("N13", "- Tolerance")}${cell("O13", "Long Term/Safety Factor")}${cell("P13", "Sigma level")}${cell("Q13", "Distribution")}${cell("R13", "Mean")}${cell("S13", "Tolerance")}${cell("T13", "1 Sigma")}</row>${rows}<row r="54">${cell("O54", "LSL")}${cell("P54", "-1")}</row><row r="55">${cell("O55", "USL")}${cell("P55", "1")}</row>`;
}

function buildWorkbook(): Uint8Array {
  const workbookXml = `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/><sheet name="Auto Summary" sheetId="2" r:id="rId2"/><sheet name="Anonymous_TA" sheetId="3" r:id="rId3"/></sheets></workbook>`;
  const xmlParts: Record<string, string> = {
    "xl/workbook.xml": workbookXml,
    "xl/worksheets/sheet1.xml": worksheet(`<row r="2">${cell("A2", "Document No.")}${cell("B2", "DOC-010")}</row><row r="4">${cell("A4", "Revision:")}${cell("B4", "R1")}</row><row r="6">${cell("A6", "Date:")}${cell("B6", "2026-08-19")}</row>`),
    "xl/worksheets/sheet2.xml": worksheet(`<row r="9">${cell("A9", "Device Level Dim")}${cell("C9", "Tolerance Loop Description")}</row><row r="10">${cell("A10", "Anonymous_TA")}${cell("C10", "Two-factor loop")}</row>`),
    "xl/worksheets/sheet3.xml": worksheet(factorRows()),
  };
  return createAnonymousWorkbookZip({ xmlParts });
}

type HttpResult = {
  readonly status: number;
  readonly json: unknown;
};

async function httpJson(options: {
  readonly port: number;
  readonly method: string;
  readonly path: string;
  readonly body?: unknown;
}): Promise<HttpResult> {
  const bodyRaw = options.body === undefined ? "" : JSON.stringify(options.body);
  const headers: Record<string, string> = {};
  if (bodyRaw.length > 0) {
    headers["content-type"] = "application/json";
    headers["content-length"] = String(Buffer.byteLength(bodyRaw, "utf8"));
  }
  return await new Promise<HttpResult>((resolve, reject) => {
    const req = request({
      host: "127.0.0.1",
      port: options.port,
      method: options.method,
      path: options.path,
      headers,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve({
          status: res.statusCode ?? 0,
          json: raw.length > 0 ? JSON.parse(raw) : undefined,
        });
      });
    });
    req.on("error", reject);
    if (bodyRaw.length > 0) req.write(bodyRaw);
    req.end();
  });
}

const forbiddenTopLevelKeys = [
  "capability",
  "cpk",
  "fit",
  "distributionFit",
  "simulation",
  "monteCarlo",
  "recommendation",
  "rawWorkbookBytes",
];

function assertNoForbiddenKeys(value: unknown): void {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === null || current === undefined) continue;
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    if (typeof current !== "object") continue;
    const record = current as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      expect(forbiddenTopLevelKeys.includes(key)).toBe(false);
      stack.push(record[key]);
    }
  }
}

describe("f7 phase 1 flow", () => {
  const openServers: Array<import("node:http").Server> = [];

  afterEach(async () => {
    await Promise.all(openServers.splice(0).map(async (server) => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }));
  });

  it("completes worksheet import to phase_1_ready with measured/baseline mix and confidential snapshot", async () => {
    const service = createF7SessionService({
      createId: () => "session-flow-fixed",
      now: () => "2026-08-20T08:00:00.000Z",
    });
    const server = createF7LocalServer({ service });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const workbook = buildWorkbook();

    const imported = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/import",
      body: {
        fileName: "anonymous-phase1.xlsx",
        workbookBase64: Buffer.from(workbook).toString("base64"),
      },
    });
    expect(imported.status).toBe(200);

    const session = imported.json as F7SessionSnapshot;
    expect(session.status).toBe("worksheet_selection");
    expect(session.outputClassification).toBe("confidential");
    expect(session.worksheetOptions.length).toBe(1);

    const worksheetConfirmed = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/worksheet-confirm",
      body: {
        sessionId: session.sessionId,
        confirmation: {
          workbookContentHash: session.workbook.workbookContentHash,
          selectedWorksheetNames: ["Anonymous_TA"],
          confirmed: true,
        },
      },
    });
    expect(worksheetConfirmed.status).toBe(200);
    const setupSnapshot = worksheetConfirmed.json as F7SessionSnapshot;
    expect(setupSnapshot.status).toBe("factor_setup");
    expect(setupSnapshot.factors).toHaveLength(2);

    const factorConfirmed = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/factors/confirm",
      body: {
        sessionId: session.sessionId,
        confirmations: setupSnapshot.factors.map((factor) => ({
          factorCandidateId: factor.factorCandidate.factorCandidateId,
          loopCoefficient: 1,
          unit: "mm",
          confirmed: true,
        })),
      },
    });
    expect(factorConfirmed.status).toBe(200);
    const confirmedSnapshot = factorConfirmed.json as F7SessionSnapshot;
    expect(confirmedSnapshot.status).toBe("measurement_entry");

    const factorA = confirmedSnapshot.factors[0]?.evidence;
    const factorB = confirmedSnapshot.factors[1]?.evidence;
    expect(factorA?.loopCoefficient).toBe(1);
    expect(factorA?.unit).toBe("mm");
    expect(factorB?.loopCoefficient).toBe(1);
    expect(factorB?.unit).toBe("mm");
    if (!factorA || !factorB) throw new Error("factor evidence is required");

    const setMeasured = await httpJson({
      port: address.port,
      method: "POST",
      path: `/f7/factors/${encodeURIComponent(factorA.factorId)}/mode`,
      body: { sessionId: session.sessionId, mode: "MEASURED" },
    });
    expect(setMeasured.status).toBe(200);

    const setBaseline = await httpJson({
      port: address.port,
      method: "POST",
      path: `/f7/factors/${encodeURIComponent(factorB.factorId)}/mode`,
      body: { sessionId: session.sessionId, mode: "BASELINE_ASSUMPTION" },
    });
    expect(setBaseline.status).toBe(200);

    const orderedPaste = [
      "value\tsequence",
      ...Array.from({ length: 32 }, (_, index) => `${(0.57 + index / 10000).toFixed(4)}\t${index + 1}`),
    ].join("\n");

    const pasted = await httpJson({
      port: address.port,
      method: "POST",
      path: `/f7/factors/${encodeURIComponent(factorA.factorId)}/measurements/paste`,
      body: {
        sessionId: session.sessionId,
        structure: "ORDERED_INDIVIDUALS",
        sourceReference: "manual-paste-fixture",
        msaStatus: "unknown",
        text: orderedPaste,
      },
    });
    expect(pasted.status).toBe(200);

    const finalSnapshot = pasted.json as F7SessionSnapshot;
    expect(finalSnapshot.status).toBe("phase_1_ready");
    expect(finalSnapshot.outputClassification).toBe("confidential");
    expect(finalSnapshot.selectedWorksheetNames).toEqual(["Anonymous_TA"]);
    expect(finalSnapshot.worksheetOptions).toEqual(session.worksheetOptions);

    const finalA = finalSnapshot.factors.find((factor) => factor.evidence?.factorId === factorA.factorId);
    const finalB = finalSnapshot.factors.find((factor) => factor.evidence?.factorId === factorB.factorId);
    expect(finalA?.input?.mode).toBe("MEASURED");
    expect(finalB?.input?.mode).toBe("BASELINE_ASSUMPTION");

    expect(finalA?.measurementPasteResult?.status).toBe("ready");
    expect(finalA?.datasetValidation?.status).toBe("ready");
    expect(finalA?.measurementPasteResult?.dataset?.analyzedCount).toBe(32);
    expect(finalA?.measurementPasteResult?.dataset?.sourceReference).toBe("manual-paste-fixture");
    expect(finalA?.measurementPasteResult?.dataset?.structure).toBe("ORDERED_INDIVIDUALS");
    expect(finalA?.measurementPasteResult?.dataset?.msaStatus).toBe("unknown");
    expect(finalA?.measurementPasteResult?.dataset?.observations.map((item) => item.sequence)).toEqual(
      Array.from({ length: 32 }, (_, index) => String(index + 1)),
    );

    expect(finalA?.evidence?.worksheetName).toBe("Anonymous_TA");
    expect(finalA?.evidence?.sourceRow).toBe(14);
    expect(finalA?.evidence?.sourceCells.factorName).toBe("Anonymous_TA!G14");
    expect(finalB?.evidence?.worksheetName).toBe("Anonymous_TA");
    expect(finalB?.evidence?.sourceRow).toBe(15);
    expect(finalB?.measurementPasteResult).toBeUndefined();
    expect(finalB?.datasetValidation).toBeUndefined();
    expect((finalB?.input as { dataset?: unknown } | undefined)?.dataset).toBeUndefined();

    const serialized = JSON.stringify(finalSnapshot);
    expect(serialized).not.toContain("workbookBytes");
    expect(serialized).not.toContain("workbookBase64");
    expect(serialized).not.toContain("rawWorkbookBytes");

    assertNoForbiddenKeys(finalSnapshot);
  });
});