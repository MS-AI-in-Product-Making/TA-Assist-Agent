import { afterEach, describe, expect, it } from "vitest";
import { request } from "node:http";
import { Socket } from "node:net";
import { createTypedError, typedErrorSchema, type F7SessionService } from "@ai-assist/contracts";
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

function createRealService(): F7SessionService {
  return createF7SessionService({
    createId: () => "session-fixed",
    now: () => "2026-08-19T08:00:00.000Z",
  });
}

function createTypedErrorService(code: Parameters<typeof createTypedError>[0]["code"]): F7SessionService {
  const throwTyped = () => {
    throw createTypedError({
      code,
      summary: code === "policy_denied" ? "Denied." : "Typed failure.",
      suggestedAction: "Do controlled retry.",
      affectedInputReferences: ["controlled-ref"],
    });
  };

  return {
    importWorkbook: throwTyped,
    confirmWorksheet: throwTyped,
    confirmFactorSetup: throwTyped,
    setFactorMode: throwTyped,
    pasteMeasurements: throwTyped,
    applyMeasurementDisposition: throwTyped,
    getSession: throwTyped,
  };
}

type HttpResult = {
  readonly status: number;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly rawBody: string;
  readonly json: unknown;
};

async function httpJson(options: {
  readonly port: number;
  readonly method: string;
  readonly path: string;
  readonly body?: unknown;
  readonly bodyRaw?: string;
  readonly contentType?: string;
  readonly headers?: Record<string, string>;
}): Promise<HttpResult> {
  const bodyRaw = options.bodyRaw ?? (options.body === undefined ? "" : JSON.stringify(options.body));
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };
  if (!("content-type" in Object.fromEntries(Object.keys(headers).map((key) => [key.toLowerCase(), true])))) {
    if (options.body !== undefined || options.bodyRaw !== undefined) {
      headers["content-type"] = options.contentType ?? "application/json";
    }
  }
  if (bodyRaw.length > 0) headers["content-length"] = String(Buffer.byteLength(bodyRaw, "utf8"));

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
        const rawBody = Buffer.concat(chunks).toString("utf8");
        let json: unknown = undefined;
        try {
          json = rawBody.length > 0 ? JSON.parse(rawBody) : undefined;
        } catch {
          json = undefined;
        }
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          rawBody,
          json,
        });
      });
    });
    req.on("error", reject);
    if (bodyRaw.length > 0) req.write(bodyRaw);
    req.end();
  });
}

type RawHttpResult = {
  readonly data: string;
  readonly closed: boolean;
};

async function rawHttpRequest(port: number, payload: string): Promise<RawHttpResult> {
  return await new Promise<RawHttpResult>((resolve, reject) => {
    const socket = new Socket();
    const chunks: Buffer[] = [];
    let closed = false;
    let done = false;

    const maybeResolve = (): void => {
      if (done) return;
      const buffer = Buffer.concat(chunks);
      const raw = buffer.toString("utf8");
      const separatorIndex = raw.indexOf("\r\n\r\n");
      if (separatorIndex < 0) return;

      const headerText = raw.slice(0, separatorIndex);
      const lengthMatch = /\r\ncontent-length:\s*(\d+)\r\n/i.exec(`\r\n${headerText}\r\n`);
      if (!lengthMatch) return;

      const expectedLength = Number(lengthMatch[1]);
      if (!Number.isFinite(expectedLength)) return;

      const bodyStart = Buffer.byteLength(raw.slice(0, separatorIndex + 4), "utf8");
      const bodyLength = buffer.length - bodyStart;
      if (bodyLength < expectedLength) return;

      done = true;
      socket.destroy();
      resolve({ data: raw, closed: true });
    };

    socket.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      maybeResolve();
    });
    socket.once("error", reject);
    socket.once("close", () => {
      if (done) return;
      closed = true;
      resolve({
        data: Buffer.concat(chunks).toString("utf8"),
        closed,
      });
    });

    socket.connect(port, "127.0.0.1", () => {
      socket.write(payload);
    });
  });
}

function expectRequestEnvelope(result: HttpResult, status: number): void {
  expect(result.status).toBe(status);
  expect(result.headers["cache-control"]).toBe("no-store");
  expect(String(result.headers["content-type"])).toContain("application/json");
  expect(result.headers["access-control-allow-origin"]).toBeUndefined();
  expect(result.json).toEqual({
    code: "validation_error",
    summary: "F7 request is invalid.",
    suggestedAction: "Use the documented F7 route DTO and retry.",
    affectedInputReferences: ["f7-local-api"],
  });
}

describe("f7 local server", () => {
  const openServers: Array<import("node:http").Server> = [];

  afterEach(async () => {
    await Promise.all(openServers.splice(0).map(async (server) => {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }));
  });

  it("binds on loopback and supports end-to-end import/get", async () => {
    const service = createRealService();
    const events: Array<{ kind: string; status: number }> = [];
    const server = createF7LocalServer({ service, onEvent: (event) => events.push({ ...event }) });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    expect(address.address).toBe("127.0.0.1");
    expect(address.family).toBe("IPv4");

    const workbook = buildWorkbook();
    const importResult = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/import",
      body: {
        fileName: "anonymous.xlsx",
        workbookBase64: Buffer.from(workbook).toString("base64"),
      },
    });
    expect(importResult.status).toBe(200);
    expect(((importResult.json as { worksheetOptions?: unknown }).worksheetOptions as unknown[] | undefined)?.length).toBeGreaterThan(0);
    const imported = importResult.json as { sessionId: string; workbook: { workbookContentHash: string } };

    const getResult = await httpJson({
      port: address.port,
      method: "GET",
      path: `/f7/session/${encodeURIComponent(imported.sessionId)}`,
    });
    expect(getResult.status).toBe(200);
    expect((getResult.json as { sessionId: string }).sessionId).toBe(imported.sessionId);
    expect(JSON.stringify(getResult.json)).not.toContain("workbookBase64");

    expect(events[0]).toEqual({ kind: "f7.workbook.import", status: 200 });
    expect(events[1]).toEqual({ kind: "f7.session.get", status: 200 });
    expect(JSON.stringify(events)).not.toContain(imported.sessionId);
  });

  it("dispatches all seven routes with strict parsing and safe percent decoding", async () => {
    const service = createRealService();
    const server = createF7LocalServer({ service });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);
    const workbook = buildWorkbook();

    const imported = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/import",
      body: {
        fileName: "anonymous.xlsx",
        workbookBase64: Buffer.from(workbook).toString("base64"),
      },
    });
    const importJson = imported.json as { sessionId: string; workbook: { workbookContentHash: string } };

    const worksheetRejected = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/worksheet-confirm",
      body: {
        sessionId: importJson.sessionId,
        confirmation: {
          workbookContentHash: importJson.workbook.workbookContentHash,
          selectedWorksheetNames: ["Not_In_Options"],
          confirmed: true,
        },
      },
    });
    expect(worksheetRejected.status).toBe(400);
    expect(worksheetRejected.json).toEqual({
      code: "validation_error",
      summary: "F7 factor extraction request is invalid.",
      suggestedAction: "Provide a supported confidential F7 workbook request and explicit confirmations.",
      affectedInputReferences: ["f7-excel-adapter"],
    });

    const worksheet = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/worksheet-confirm",
      body: {
        sessionId: importJson.sessionId,
        confirmation: {
          workbookContentHash: importJson.workbook.workbookContentHash,
          selectedWorksheetNames: ["Anonymous_TA"],
          confirmed: true,
        },
      },
    });
    expect(worksheet.status).toBe(200);
    expect(JSON.stringify(worksheet.json)).not.toContain("workbookBytes");

    const factorSetup = worksheet.json as {
      status: string;
      factors: Array<{
        factorCandidate: { factorCandidateId: string };
        setup?: unknown;
        evidence?: { factorId?: string };
        physicalMean?: unknown;
      }>;
    };
    expect(factorSetup.status).toBe("factor_setup");
    expect(factorSetup.factors.length).toBeGreaterThan(0);
    for (const factor of factorSetup.factors) {
      expect(typeof factor.factorCandidate.factorCandidateId).toBe("string");
      expect(factor.factorCandidate.factorCandidateId.length).toBeGreaterThan(0);
      expect(factor.setup).toBeUndefined();
      expect(factor.evidence).toBeUndefined();
      expect(factor.physicalMean).toBeUndefined();
    }

    const factorConfirm = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/factors/confirm",
      body: {
        sessionId: importJson.sessionId,
        confirmations: factorSetup.factors.map((factor, index) => ({
          factorCandidateId: factor.factorCandidate.factorCandidateId,
          loopCoefficient: index < 2 ? -1 : 1,
          unit: "mm",
          confirmed: true,
        })),
      },
    });
    expect(factorConfirm.status).toBe(200);

    const configured = factorConfirm.json as {
      factors: Array<{ evidence?: { factorId: string } }>;
    };
    const factorId = configured.factors[0]?.evidence?.factorId;
    expect(typeof factorId).toBe("string");
    if (!factorId) return;

    const encodedFactorPath = encodeURIComponent(factorId);
    const setMode = await httpJson({
      port: address.port,
      method: "POST",
      path: `/f7/factors/${encodedFactorPath}/mode`,
      body: { sessionId: importJson.sessionId, mode: "MEASURED" },
    });
    expect(setMode.status).toBe(200);

    const paste = await httpJson({
      port: address.port,
      method: "POST",
      path: `/f7/factors/${encodedFactorPath}/measurements/paste`,
      body: {
        sessionId: importJson.sessionId,
        structure: "UNORDERED_SAMPLE",
        sourceReference: "paste-route",
        msaStatus: "available",
        text: "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20",
      },
    });
    expect(paste.status).toBe(200);

    const disposition = await httpJson({
      port: address.port,
      method: "POST",
      path: `/f7/factors/${encodedFactorPath}/measurements/disposition`,
      body: {
        sessionId: importJson.sessionId,
        rowNumbers: [1],
        action: "EXCLUDE",
        reason: "OUTLIER",
        operatorReference: "op-a",
        confirmed: true,
      },
    });
    expect(disposition.status).toBe(200);

    const malformedEncoded = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/factors/%E0%A4%A/mode",
      body: { sessionId: importJson.sessionId, mode: "MEASURED" },
    });
    expectRequestEnvelope(malformedEncoded, 400);
  });

  it("requires application/json on body routes and rejects invalid or non-object JSON", async () => {
    const service = createRealService();
    const server = createF7LocalServer({ service });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const unsupported = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/import",
      bodyRaw: "{}",
      contentType: "text/plain",
    });
    expectRequestEnvelope(unsupported, 415);

    const invalidJson = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/import",
      bodyRaw: "{bad-json",
      contentType: "application/json",
    });
    expectRequestEnvelope(invalidJson, 400);

    const nonObject = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/import",
      bodyRaw: "[]",
      contentType: "application/json",
    });
    expectRequestEnvelope(nonObject, 400);
  });

  it("enforces strict unknown fields and forbids factorId in factor route body", async () => {
    const service = createRealService();
    const server = createF7LocalServer({ service });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);
    const workbook = buildWorkbook();

    const imported = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/import",
      body: {
        fileName: "anonymous.xlsx",
        workbookBase64: Buffer.from(workbook).toString("base64"),
        unexpected: true,
      },
    });
    expectRequestEnvelope(imported, 400);

    const okImport = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/import",
      body: {
        fileName: "anonymous.xlsx",
        workbookBase64: Buffer.from(workbook).toString("base64"),
      },
    });
    const importJson = okImport.json as { sessionId: string; workbook: { workbookContentHash: string } };

    const badNested = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/worksheet-confirm",
      body: {
        sessionId: importJson.sessionId,
        confirmation: {
          workbookContentHash: importJson.workbook.workbookContentHash,
          selectedWorksheetNames: ["Anonymous_TA"],
          confirmed: true,
          nestedExtra: "x",
        },
      },
    });
    expectRequestEnvelope(badNested, 400);

    const goodWorksheet = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/worksheet-confirm",
      body: {
        sessionId: importJson.sessionId,
        confirmation: {
          workbookContentHash: importJson.workbook.workbookContentHash,
          selectedWorksheetNames: ["Anonymous_TA"],
          confirmed: true,
        },
      },
    });
    const setup = goodWorksheet.json as { factors: Array<{ factorCandidate: { factorCandidateId: string } }> };
    const goodFactors = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/factors/confirm",
      body: {
        sessionId: importJson.sessionId,
        confirmations: setup.factors.map((factor, index) => ({
          factorCandidateId: factor.factorCandidate.factorCandidateId,
          loopCoefficient: index < 2 ? -1 : 1,
          unit: "mm",
          confirmed: true,
        })),
      },
    });
    expect(goodFactors.status).toBe(200);
    const configured = goodFactors.json as { factors: Array<{ evidence?: { factorId: string } }> };
    const factorId = configured.factors[0]?.evidence?.factorId;
    if (!factorId) return;

    const modeBodyWithFactor = await httpJson({
      port: address.port,
      method: "POST",
      path: `/f7/factors/${encodeURIComponent(factorId)}/mode`,
      body: { sessionId: importJson.sessionId, mode: "MEASURED", factorId },
    });
    expectRequestEnvelope(modeBodyWithFactor, 400);

    const pasteBodyWithFactor = await httpJson({
      port: address.port,
      method: "POST",
      path: `/f7/factors/${encodeURIComponent(factorId)}/measurements/paste`,
      body: {
        sessionId: importJson.sessionId,
        structure: "UNORDERED_SAMPLE",
        sourceReference: "paste-x",
        msaStatus: "available",
        text: "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20",
        factorId,
      },
    });
    expectRequestEnvelope(pasteBodyWithFactor, 400);

    const dispositionBodyWithFactor = await httpJson({
      port: address.port,
      method: "POST",
      path: `/f7/factors/${encodeURIComponent(factorId)}/measurements/disposition`,
      body: {
        sessionId: importJson.sessionId,
        rowNumbers: [1],
        action: "EXCLUDE",
        reason: "OUTLIER",
        operatorReference: "op-b",
        confirmed: true,
        factorId,
      },
    });
    expectRequestEnvelope(dispositionBodyWithFactor, 400);
  });

  it("enforces raw body limits and strict canonical base64 decode", async () => {
    const service = createRealService();
    const server = createF7LocalServer({ service });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const oversizedRawBody = JSON.stringify({
      fileName: "anonymous.xlsx",
      workbookBase64: "YQ==",
      padding: "A".repeat(22_380_000),
    });
    const tooBigRaw = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/import",
      bodyRaw: oversizedRawBody,
      contentType: "application/json",
    });
    expectRequestEnvelope(tooBigRaw, 413);

    const badBase64Whitespace = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/import",
      body: {
        fileName: "anonymous.xlsx",
        workbookBase64: "YQ==\n",
      },
    });
    expectRequestEnvelope(badBase64Whitespace, 400);

    const badBase64UrlSafe = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/import",
      body: {
        fileName: "anonymous.xlsx",
        workbookBase64: "-_==",
      },
    });
    expectRequestEnvelope(badBase64UrlSafe, 400);

    const tooBigDecoded = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/import",
      body: {
        fileName: "anonymous.xlsx",
        workbookBase64: Buffer.alloc((16 * 1024 * 1024) + 1, 1).toString("base64"),
      },
    });
    expectRequestEnvelope(tooBigDecoded, 413);

    const bigOtherBody = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/worksheet-confirm",
      body: {
        sessionId: "s",
        confirmation: {
          workbookContentHash: "a".repeat(64),
          selectedWorksheetNames: ["A".repeat(1_200_000)],
          confirmed: true,
        },
      },
    });
    expectRequestEnvelope(bigOtherBody, 413);
  });

  it("accepts exactly 16 MiB decoded workbook bytes and passes exact byte length to service", async () => {
    let recordedWorkbookBytesLength = -1;
    const realService = createRealService();
    const schemaValidSnapshot = realService.importWorkbook({
      contractId: "f7-analysis-request-v1",
      inputClassification: "confidential",
      fileName: "seed.xlsx",
      workbookBytes: buildWorkbook(),
    });
    const service: F7SessionService = {
      importWorkbook: (request) => {
        recordedWorkbookBytesLength = request.workbookBytes.byteLength;
        return schemaValidSnapshot;
      },
      confirmWorksheet: (request) => realService.confirmWorksheet(request),
      confirmFactorSetup: (request) => realService.confirmFactorSetup(request),
      setFactorMode: (request) => realService.setFactorMode(request),
      pasteMeasurements: (request) => realService.pasteMeasurements(request),
      applyMeasurementDisposition: (request) => realService.applyMeasurementDisposition(request),
      getSession: (sessionId) => realService.getSession(sessionId),
    };

    const server = createF7LocalServer({ service });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const maxDecodedWorkbook = Buffer.alloc(16 * 1024 * 1024);
    const bodyRaw = JSON.stringify({
      fileName: "boundary-16mib.xlsx",
      workbookBase64: maxDecodedWorkbook.toString("base64"),
    });

    const accepted = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/workbook/import",
      bodyRaw,
      contentType: "application/json",
    });

    expect(accepted.status).toBe(200);
    expect(recordedWorkbookBytesLength).toBe(16 * 1024 * 1024);
  });

  it("enforces GET /f7/session/:sessionId without query or body", async () => {
    const service = createRealService();
    const server = createF7LocalServer({ service });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const withQuery = await httpJson({
      port: address.port,
      method: "GET",
      path: "/f7/session/abc?q=1",
    });
    expectRequestEnvelope(withQuery, 400);

    const withBody = await httpJson({
      port: address.port,
      method: "GET",
      path: "/f7/session/abc",
      bodyRaw: "{}",
      contentType: "application/json",
    });
    expectRequestEnvelope(withBody, 400);
  });

  it("rejects unsupported transfer-encoding and does not dispatch service", async () => {
    let serviceCalls = 0;
    const service: F7SessionService = {
      importWorkbook: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      confirmWorksheet: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      confirmFactorSetup: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      setFactorMode: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      pasteMeasurements: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      applyMeasurementDisposition: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      getSession: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
    };

    const server = createF7LocalServer({ service });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const response = await rawHttpRequest(
      address.port,
      "POST /f7/workbook/import HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nTransfer-Encoding: gzip\r\n\r\n{}",
    );

    expect(response.data).toContain("HTTP/1.1 400");
    expect(serviceCalls).toBe(0);
    expect(response.closed).toBe(true);
  });

  it("rejects CL plus TE ambiguity with deterministic 400 and close", async () => {
    let serviceCalls = 0;
    const service: F7SessionService = {
      importWorkbook: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      confirmWorksheet: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      confirmFactorSetup: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      setFactorMode: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      pasteMeasurements: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      applyMeasurementDisposition: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      getSession: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
    };

    const server = createF7LocalServer({ service });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const response = await rawHttpRequest(
      address.port,
      "POST /f7/workbook/import HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 2\r\nTransfer-Encoding: chunked\r\n\r\n{}",
    );

    expect(response.data).toContain("HTTP/1.1 400");
    expect(serviceCalls).toBe(0);
    expect(response.closed).toBe(true);
  });

  it("rejects invalid or multiple content-length at parser/handler boundary with close", async () => {
    let serviceCalls = 0;
    const service: F7SessionService = {
      importWorkbook: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      confirmWorksheet: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      confirmFactorSetup: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      setFactorMode: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      pasteMeasurements: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      applyMeasurementDisposition: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
      getSession: () => {
        serviceCalls += 1;
        throw new Error("unexpected dispatch");
      },
    };

    const server = createF7LocalServer({ service });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const response = await rawHttpRequest(
      address.port,
      "POST /f7/workbook/import HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 2, 3\r\n\r\n{}",
    );

    expect(response.data).toContain("HTTP/1.1 400");
    expect(serviceCalls).toBe(0);
    expect(response.closed).toBe(true);
  });

  it("accepts valid chunked JSON POST for body routes", async () => {
    const service = createRealService();
    const server = createF7LocalServer({ service });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const workbook = buildWorkbook();
    const payload = JSON.stringify({
      fileName: "anonymous.xlsx",
      workbookBase64: Buffer.from(workbook).toString("base64"),
    });
    const chunkHex = payload.length.toString(16);

    const response = await rawHttpRequest(
      address.port,
      `POST /f7/workbook/import HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n${chunkHex}\r\n${payload}\r\n0\r\n\r\n`,
    );

    expect(response.data).toContain("HTTP/1.1 200");
    expect(response.data).toContain("content-type: application/json; charset=utf-8");
  });

  it("maps typed service errors to stable status and controlled envelope", async () => {
    const policyService = createTypedErrorService("policy_denied");
    const policyServer = createF7LocalServer({ service: policyService });
    openServers.push(policyServer);
    const policyAddress = await listenF7LocalServer(policyServer, 0);
    const policyResult = await httpJson({
      port: policyAddress.port,
      method: "POST",
      path: "/f7/workbook/import",
      body: { fileName: "x.xlsx", workbookBase64: "YQ==" },
    });
    expect(policyResult.status).toBe(403);
    expect(typedErrorSchema.safeParse(policyResult.json).success).toBe(false);
    expect(policyResult.json).toEqual({
      code: "policy_denied",
      summary: "Denied.",
      suggestedAction: "Do controlled retry.",
      affectedInputReferences: ["controlled-ref"],
    });

    const validationService = createTypedErrorService("evidence_mismatch");
    const validationServer = createF7LocalServer({ service: validationService });
    openServers.push(validationServer);
    const validationAddress = await listenF7LocalServer(validationServer, 0);
    const validationResult = await httpJson({
      port: validationAddress.port,
      method: "POST",
      path: "/f7/workbook/import",
      body: { fileName: "x.xlsx", workbookBase64: "YQ==" },
    });
    expect(validationResult.status).toBe(400);

    const capacityService = createTypedErrorService("prerequisite_not_ready");
    const capacityServer = createF7LocalServer({ service: capacityService });
    openServers.push(capacityServer);
    const capacityAddress = await listenF7LocalServer(capacityServer, 0);
    const capacityResult = await httpJson({
      port: capacityAddress.port,
      method: "POST",
      path: "/f7/workbook/import",
      body: { fileName: "x.xlsx", workbookBase64: "YQ==" },
    });
    expect(capacityResult.status).toBe(409);

    const internalService = {
      ...createRealService(),
      importWorkbook: () => {
        throw new Error("secret-stack-and-marker");
      },
    } as F7SessionService;
    const internalServer = createF7LocalServer({ service: internalService });
    openServers.push(internalServer);
    const internalAddress = await listenF7LocalServer(internalServer, 0);
    const internalResult = await httpJson({
      port: internalAddress.port,
      method: "POST",
      path: "/f7/workbook/import",
      body: { fileName: "x.xlsx", workbookBase64: "YQ==" },
    });
    expect(internalResult.status).toBe(500);
    expect(internalResult.rawBody).not.toContain("secret-stack-and-marker");
    expect(internalResult.json).toEqual({
      code: "internal_error",
      summary: "F7 local API request failed.",
      suggestedAction: "Retry the request. If the problem persists, restart the local API.",
      affectedInputReferences: ["f7-local-api"],
    });
  });

  it("returns 404 for unknown and excluded routes and has no CORS or OPTIONS support", async () => {
    const service = createRealService();
    const server = createF7LocalServer({ service });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const unknown = await httpJson({
      port: address.port,
      method: "GET",
      path: "/unknown",
    });
    expectRequestEnvelope(unknown, 404);

    const capability = await httpJson({
      port: address.port,
      method: "GET",
      path: "/f7/capability",
    });
    expectRequestEnvelope(capability, 404);

    const fit = await httpJson({
      port: address.port,
      method: "GET",
      path: "/f7/fit",
    });
    expectRequestEnvelope(fit, 404);

    const monteCarlo = await httpJson({
      port: address.port,
      method: "GET",
      path: "/f7/monte-carlo",
    });
    expectRequestEnvelope(monteCarlo, 404);

    const recommendation = await httpJson({
      port: address.port,
      method: "GET",
      path: "/f7/recommendation",
    });
    expectRequestEnvelope(recommendation, 404);

    const optionsRoute = await httpJson({
      port: address.port,
      method: "OPTIONS",
      path: "/f7/workbook/import",
    });
    expectRequestEnvelope(optionsRoute, 404);
  });
});