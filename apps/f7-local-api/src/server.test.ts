import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { request } from "node:http";
import { Socket } from "node:net";
import {
  createTypedError,
  f7ReportProjectionSchema,
  typedErrorSchema,
  type F7SessionService,
} from "@ai-assist/contracts";
import { calculateToleranceAnalysis } from "@ai-assist/workbook-catalog/calculation-kernel";
import { createAnonymousWorkbookZip } from "../../../packages/workbook-catalog/src/test-support.js";
import {
  encodeRfc5987FileName,
  safePdfDownloadFileName,
  safeUnicodePdfDownloadFileName,
  type AssumptionResultsPdfRouteRequest,
} from "./assumption-results-pdf-contract.js";
import {
  AssumptionResultsPdfQueueFullError,
  type AssumptionResultsPdfRenderer,
} from "./assumption-results-pdf-renderer.js";
import { createF7SessionService } from "./f7-session-service.js";
import {
  createF7LocalServer as createProductionF7LocalServer,
  listenF7LocalServer,
} from "./server.js";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

const DISTRIBUTION_BY_LABEL = {
  Normal: "normal",
  Uniform: "uniform",
  Triangular: "triangular",
  Trapezoidal: "trapezoidal",
  Elliptical: "elliptical",
  Beta: "beta",
} as const;

type ServerOptions = Parameters<typeof createProductionF7LocalServer>[0];

function createF7LocalServer(
  options: Omit<ServerOptions, "assumptionResultsPdfRenderer"> & {
    readonly assumptionResultsPdfRenderer?: AssumptionResultsPdfRenderer;
  },
): ReturnType<typeof createProductionF7LocalServer> {
  const assumptionResultsPdfRenderer = options.assumptionResultsPdfRenderer ?? {
    render: vi.fn(async () => Buffer.from("%PDF-1.7\ntest-fake")),
  };
  return createProductionF7LocalServer({ ...options, assumptionResultsPdfRenderer });
}

function worksheet(rows: string): string {
  return `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData>${rows}</sheetData></worksheet>`;
}

function cell(reference: string, value: string): string {
  return `<c r="${reference}"><v>${value}</v></c>`;
}

function sheetRows(firstFactorName = "Fabric thickness"): string {
  const factors = [
    [firstFactorName, "-0.57", "0.0125", "-1", "0.57"],
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

  return `<row r="11">${cell("G11", "Tolerance Loop Description")}${cell("H11", "Anonymous loop")}</row><row r="13">${cell("G13", "Factor Description (TA Loop)")}${cell("L13", "Design Nominal")}${cell("M13", "+ Tolerance")}${cell("N13", "- Tolerance")}${cell("O13", "Long Term/Safety Factor")}${cell("P13", "Sigma level")}${cell("Q13", "Distribution")}${cell("R13", "Mean")}${cell("S13", "Tolerance")}${cell("T13", "1 Sigma")}</row>${factorRows}<row r="50">${cell("O50", "Additional Mean Shift")}${cell("P50", "0.01")}</row><row r="53">${cell("O53", "Response Summary")}</row><row r="54">${cell("O54", "Design Nominal")}${cell("P54", "1.627")}</row><row r="55">${cell("O55", "LSL")}${cell("P55", "-0.15")}</row><row r="56">${cell("O56", "USL")}${cell("P56", "0.05")}${cell("W56", "Volume")}${cell("X56", "1000")}</row><row r="57">${cell("O57", "Target Sigma Level")}${cell("P57", "4")}</row>`;
}

function buildWorkbook(firstFactorName = "Fabric thickness"): Uint8Array {
  const workbookXml = `<?xml version="1.0"?><workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Title Page" sheetId="1" r:id="rId1"/><sheet name="Auto Summary" sheetId="2" r:id="rId2"/><sheet name="Anonymous_TA" sheetId="3" r:id="rId3"/></sheets></workbook>`;
  const xmlParts: Record<string, string> = {
    "xl/workbook.xml": workbookXml,
    "xl/worksheets/sheet1.xml": worksheet(`<row r="2">${cell("A2", "Document No.")}${cell("B2", "DOC-007")}</row><row r="4">${cell("A4", "Revision:")}${cell("B4", "R2")}</row><row r="6">${cell("A6", "Date:")}${cell("B6", "2026-07-23")}</row>`),
    "xl/worksheets/sheet2.xml": worksheet(`<row r="9">${cell("A9", "Device Level Dim")}${cell("C9", "Tolerance Loop Description")}</row><row r="10">${cell("A10", "Anonymous_TA")}${cell("C10", "First loop")}</row>`),
    "xl/worksheets/sheet3.xml": worksheet(sheetRows(firstFactorName)),
  };
  return createAnonymousWorkbookZip({ xmlParts });
}

function createRealService(): F7SessionService {
  return createF7SessionService({
    createId: () => "session-fixed",
    now: () => "2026-08-19T08:00:00.000Z",
  });
}

function validAssumptionResultsPdfRequest(): AssumptionResultsPdfRouteRequest {
  return {
    sessionId: "session-fixed",
    workbookName: "Design 装配.xlsx",
    worksheetName: "TA Result",
    resultJudgment: {
      status: "below-target",
      headline: "Capability is below target",
    },
    resultSummaryCaption: "Comparison of assumption-based RSS results with system specifications and derived targets",
    summaryRows: [{
      metric: "Mean",
      result: "1.20",
      reference: "1.00",
      difference: "+0.20",
      assessment: "Below target",
      performanceContext: "80% of target",
      tone: "fail",
    }],
    overallAssessment: "The assumed result is outside the target.",
    rootCauseItems: [{
      title: "Excessive variation hypothesis",
      narrative: "Variation exceeds the resolved target.",
      hypothesisStatus: "hypothesis",
      incompleteEvidence: false,
      quantitativeEvidence: [{ label: "Cp vs target gap", value: "-1" }],
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
      narrative: "Apply only as a final fallback.",
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
    contributors: [],
    processGuidanceContext: "Evaluated against the current TA worksheet and analysis state.",
    processGuidance: [],
    engineeringEvidence: {
      factorSetup: {
        rows: [{
          itemNumber: 1,
          factorName: "C-cover height",
          designNominal: -1.94,
          upperTolerance: 0.1,
          lowerTolerance: -0.1,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
          mean: -1.94,
          tolerance: 0.1,
          oneSigma: 0.025,
          contributionPercent: 100,
        }],
        footer: {
          designNominalTotal: -1.94,
          upperWorstCaseTolerance: 0.1,
          lowerWorstCaseTolerance: -0.1,
          meanResponse: -1.94,
          rssTolerance: 0.1,
          rssSigma: 0.025,
          contributionTotalPercent: 100,
          additionalMeanShift: 0,
          adjustedMean: -1.94,
        },
      },
      dimensionChain: {
        status: "generated",
        sourceSignature: JSON.stringify({
          workbookName: "Design 装配.xlsx",
          worksheetName: "TA Result",
          factorIds: [HASH_B],
        }),
        orientation: "horizontal",
        factors: [{
          id: HASH_B,
          itemNumber: 1,
          name: "C-cover height",
          designNominal: -1.94,
          upperTolerance: 0.1,
          lowerTolerance: -0.1,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
        }],
        manualLayout: {
          boundaryOffsets: { [`${HASH_B}::${HASH_B}`]: 0 },
          laneOffsets: { [HASH_B]: 0 },
          closureStartOffset: 0,
          closureEndOffset: 0,
          closureLaneOffset: 0,
        },
        reversedFactorIds: [HASH_B],
        closureDirection: "start-to-end",
      },
      responseDistribution: {
        mean: -1.94,
        standardDeviation: 0.025,
        lowerSpecLimit: -2.04,
        upperSpecLimit: -1.84,
        target: -1.94,
      },
      responseSummary: {
        rssAndWorstCase: {
          sigmaBands: [{ sigma: 1, tolerance: 0.025, upper: -1.915, lower: -1.965 }],
          worstCase: { tolerance: 0.1, upper: -1.84, lower: -2.04 },
        },
        responseAndSpecifications: {
          designNominal: -1.94,
          meanResponse: -1.94,
          additionalMeanShift: 0,
          adjustedMean: -1.94,
          lowerSpecLimit: -2.04,
          upperSpecLimit: -1.84,
          targetSigmaLevel: 4,
          targetCpk: 1.33,
        },
        sigmaLevelAndCapability: {
          lowerZ: { value: 4, status: "PASS" },
          upperZ: { value: 4, status: "PASS" },
          calculatedSigmaLevel: { value: 4, status: "PASS" },
          cp: { value: 1.33, status: "PASS" },
          lowerCpk: { value: 1.33, status: "PASS" },
          upperCpk: { value: 1.33, status: "PASS" },
          calculatedCpk: { value: 1.33, status: "PASS" },
        },
        defectsPerMillion: {
          lowerDpm: 31.67,
          upperDpm: 31.67,
          totalDpm: 63.34,
          outOfSpecPercent: 0.006334,
          yieldPercent: 99.993666,
          volume: 1000,
          failuresOverVolume: 0,
        },
      },
    },
  };
}

function toSessionBoundPdfRequest(snapshot: ReturnType<F7SessionService["getSession"]>): AssumptionResultsPdfRouteRequest {
  const confirmedFactors = snapshot.factors
    .map((factorState) => factorState.evidence)
    .filter((evidence): evidence is NonNullable<typeof evidence> => evidence !== undefined);
  const firstFactor = confirmedFactors[0];
  if (!firstFactor) {
    throw new Error("Session fixture must include at least one confirmed factor evidence.");
  }

  const specification = snapshot.systemSpecification;
  if (
    specification?.status !== "available"
    || specification.lowerSpecLimit.status !== "available"
    || specification.upperSpecLimit.status !== "available"
    || specification.targetSigmaLevel.status !== "available"
  ) {
    throw new Error("Session fixture must include available system specification.");
  }

  const shiftFromFooter = specification.additionalMeanShift.status === "available"
    ? specification.additionalMeanShift.actualValue
    : 0;
  const factors = confirmedFactors.map((evidence) => ({
    source: {
      worksheetName: evidence.worksheetName,
      tableId: evidence.tableId,
      sourceRow: evidence.sourceRow,
    },
    name: evidence.factorName,
    unit: evidence.unit,
    input: {
      nominalValue: evidence.designNominal,
      upperTolerance: evidence.upperTolerance,
      lowerTolerance: evidence.lowerTolerance,
      longTermSafetyFactor: evidence.longTermSafetyFactor,
      sigmaLevel: evidence.sigmaLevel,
      distribution: DISTRIBUTION_BY_LABEL[evidence.distribution],
    },
  }));
  const calculation = calculateToleranceAnalysis({
    factors,
    system: {
      designNominal: factors.reduce((sum, factor) => sum + factor.input.nominalValue, 0),
      lowerSpecLimit: specification.lowerSpecLimit.actualValue,
      upperSpecLimit: specification.upperSpecLimit.actualValue,
      targetSigmaLevel: specification.targetSigmaLevel.actualValue,
      targetCpk: specification.targetSigmaLevel.actualValue / 3,
      shift: shiftFromFooter,
    },
  });
  const factorByKey = new Map(calculation.factors.map((factor) => [
    JSON.stringify([factor.source.worksheetName, factor.source.tableId, factor.source.sourceRow, factor.name]),
    factor,
  ]));
  const volume = specification.volume?.status === "available" ? specification.volume.actualValue : undefined;
  const failuresOverVolume = volume === undefined
    ? undefined
    : calculation.capability.totalDpm / 1_000_000 * volume;

  return {
    ...validAssumptionResultsPdfRequest(),
    sessionId: snapshot.sessionId,
    workbookName: snapshot.workbook.fileName,
    worksheetName: firstFactor.worksheetName,
    engineeringEvidence: {
      ...validAssumptionResultsPdfRequest().engineeringEvidence,
      factorSetup: {
        ...validAssumptionResultsPdfRequest().engineeringEvidence.factorSetup,
        rows: confirmedFactors.map((evidence, index) => ({
          ...(() => {
            const factor = factorByKey.get(JSON.stringify([
              evidence.worksheetName,
              evidence.tableId,
              evidence.sourceRow,
              evidence.factorName,
            ]));
            if (!factor) throw new Error("Session fixture kernel factor missing.");
            return {
              mean: factor.mean,
              tolerance: factor.halfTolerance,
              oneSigma: factor.sigma,
              contributionPercent: factor.contribution * 100,
            };
          })(),
          itemNumber: index + 1,
          factorName: evidence.factorName,
          designNominal: evidence.designNominal,
          upperTolerance: evidence.upperTolerance,
          lowerTolerance: evidence.lowerTolerance,
          longTermSafetyFactor: evidence.longTermSafetyFactor,
          sigmaLevel: evidence.sigmaLevel,
          distribution: evidence.distribution,
        })),
        footer: {
          designNominalTotal: calculation.system.designNominal,
          upperWorstCaseTolerance: calculation.system.responseUpperTolerance,
          lowerWorstCaseTolerance: calculation.system.responseLowerTolerance,
          meanResponse: calculation.system.mean - calculation.system.shift,
          rssTolerance: calculation.system.rssSigma * 3,
          rssSigma: calculation.system.rssSigma,
          contributionTotalPercent: calculation.factors.reduce((sum, factor) => sum + factor.contribution, 0) * 100,
          additionalMeanShift: shiftFromFooter,
          adjustedMean: calculation.system.mean,
        },
      },
      dimensionChain: {
        status: "generated",
        sourceSignature: JSON.stringify(confirmedFactors.map((evidence, index) => ({
          id: evidence.factorId,
          itemNumber: index + 1,
          name: evidence.factorName,
          designNominal: evidence.designNominal,
          upperTolerance: evidence.upperTolerance,
          lowerTolerance: evidence.lowerTolerance,
          longTermSafetyFactor: evidence.longTermSafetyFactor,
          sigmaLevel: evidence.sigmaLevel,
          distribution: evidence.distribution,
        }))),
        orientation: "horizontal",
        factors: confirmedFactors.map((evidence) => ({
          id: evidence.factorId,
          itemNumber: confirmedFactors.findIndex((current) => current.factorId === evidence.factorId) + 1,
          name: evidence.factorName,
          designNominal: evidence.designNominal,
          upperTolerance: evidence.upperTolerance,
          lowerTolerance: evidence.lowerTolerance,
          longTermSafetyFactor: evidence.longTermSafetyFactor,
          sigmaLevel: evidence.sigmaLevel,
          distribution: evidence.distribution,
        })),
        manualLayout: {
          boundaryOffsets: Object.fromEntries(confirmedFactors.slice(1).map((evidence, index) => ([
            `${confirmedFactors[index]!.factorId}::${evidence.factorId}`,
            0,
          ]))),
          laneOffsets: Object.fromEntries(confirmedFactors.map((evidence) => [evidence.factorId, 0])),
          closureStartOffset: 0,
          closureEndOffset: 0,
          closureLaneOffset: 0,
        },
        reversedFactorIds: [],
        closureDirection: "start-to-end",
      },
      responseDistribution: {
        mean: calculation.system.mean,
        standardDeviation: calculation.system.rssSigma,
        lowerSpecLimit: calculation.capability.lowerSpecLimit,
        upperSpecLimit: calculation.capability.upperSpecLimit,
        target: calculation.system.designNominal,
      },
      responseSummary: {
        rssAndWorstCase: {
          sigmaBands: [1, 3, 4, 4.5, 6].map((sigma) => ({
            sigma: sigma as 1 | 3 | 4 | 4.5 | 6,
            tolerance: calculation.system.rssSigma * sigma,
            upper: calculation.system.mean + calculation.system.rssSigma * sigma,
            lower: calculation.system.mean - calculation.system.rssSigma * sigma,
          })),
          worstCase: {
            tolerance: calculation.system.worstCaseTolerance,
            upper: calculation.system.worstCaseUpperBound,
            lower: calculation.system.worstCaseLowerBound,
          },
        },
        responseAndSpecifications: {
          designNominal: calculation.system.designNominal,
          meanResponse: calculation.system.mean - calculation.system.shift,
          additionalMeanShift: calculation.system.shift,
          adjustedMean: calculation.system.mean,
          lowerSpecLimit: calculation.capability.lowerSpecLimit,
          upperSpecLimit: calculation.capability.upperSpecLimit,
          targetSigmaLevel: calculation.capability.targetSigmaLevel,
          targetCpk: calculation.capability.targetCpk,
        },
        sigmaLevelAndCapability: {
          lowerZ: { value: calculation.capability.lowerZ, status: calculation.capability.lowerCpkStatus },
          upperZ: { value: calculation.capability.upperZ, status: calculation.capability.upperCpkStatus },
          calculatedSigmaLevel: { value: calculation.capability.z, status: calculation.capability.status },
          cp: { value: calculation.capability.cp, status: calculation.capability.cpStatus },
          lowerCpk: { value: calculation.capability.lowerCpk, status: calculation.capability.lowerCpkStatus },
          upperCpk: { value: calculation.capability.upperCpk, status: calculation.capability.upperCpkStatus },
          calculatedCpk: { value: calculation.capability.cpk, status: calculation.capability.status },
        },
        defectsPerMillion: {
          lowerDpm: calculation.capability.lowerDpm,
          upperDpm: calculation.capability.upperDpm,
          totalDpm: calculation.capability.totalDpm,
          outOfSpecPercent: calculation.capability.outOfSpecRatio * 100,
          yieldPercent: calculation.capability.yield * 100,
          ...(volume === undefined ? {} : { volume }),
          ...(failuresOverVolume === undefined ? {} : { failuresOverVolume }),
        },
      },
    },
  };
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
    fitDistribution: throwTyped,
    approveDistribution: throwTyped,
    runMonteCarlo: throwTyped,
    generateReport: throwTyped,
    getSession: throwTyped,
  };
}

type HttpResult = {
  readonly status: number;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly rawBytes: Buffer;
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
        const rawBytes = Buffer.concat(chunks);
        const rawBody = rawBytes.toString("utf8");
        let json: unknown = undefined;
        try {
          json = rawBody.length > 0 ? JSON.parse(rawBody) : undefined;
        } catch {
          json = undefined;
        }
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          rawBytes,
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

  it("requires an assumption-results PDF renderer at the server factory boundary", () => {
    const compileOnlyMissingRendererCall = (): void => {
      // @ts-expect-error The application assembly must inject the PDF renderer.
      createProductionF7LocalServer({ service: createRealService() });
    };
    const serverSource = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
    expect(compileOnlyMissingRendererCall).toBeTypeOf("function");
    expect(serverSource).not.toContain("createAssumptionResultsPdfRenderer");
    expect(serverSource).toMatch(
      /readonly assumptionResultsPdfRenderer: AssumptionResultsPdfRenderer;/u,
    );
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

  it("dispatches all eleven routes with strict parsing and safe percent decoding", async () => {
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
        confirmations: factorSetup.factors.map((factor) => ({
          factorCandidateId: factor.factorCandidate.factorCandidateId,
          designNominal: factor.factorCandidate.designNominal,
          upperTolerance: factor.factorCandidate.upperTolerance,
          lowerTolerance: factor.factorCandidate.lowerTolerance,
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
    for (const factor of configured.factors.slice(1)) {
      const baselineFactorId = factor.evidence?.factorId;
      if (!baselineFactorId) continue;
      const baselineMode = await httpJson({
        port: address.port,
        method: "POST",
        path: `/f7/factors/${encodeURIComponent(baselineFactorId)}/mode`,
        body: { sessionId: importJson.sessionId, mode: "BASELINE_ASSUMPTION" },
      });
      expect(baselineMode.status).toBe(200);
    }

    const oversizedPaste = await httpJson({
      port: address.port,
      method: "POST",
      path: `/f7/factors/${encodedFactorPath}/measurements/paste`,
      body: {
        sessionId: importJson.sessionId,
        structure: "UNORDERED_SAMPLE",
        sourceReference: "oversized-paste-route",
        msaStatus: "available",
        text: Array.from({ length: 501 }, (_, index) => String(index + 1)).join("\n"),
      },
    });
    expect(oversizedPaste.status).toBe(400);
    expect(oversizedPaste.json).toMatchObject({
      code: "validation_error",
      affectedInputReferences: ["f7-session-service"],
    });

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

    const encodedFitFactorPath = `%${factorId.charCodeAt(0).toString(16)}${factorId.slice(1)}`;
    const distributionFit = await httpJson({
      port: address.port,
      method: "POST",
      path: `/f7/factors/${encodedFitFactorPath}/distribution-fit`,
      body: { sessionId: importJson.sessionId },
    });
    expect(distributionFit.status).toBe(200);
    const routeFitResult = (distributionFit.json as {
      factors: Array<{
        distributionFitResult?: {
          factorId: string;
          sampleSize: number;
          characteristicKind: string;
          sampleDiagnostics: Record<string, number>;
          selectionDecision: { methodId: string; proposedFinalFamily?: string };
          candidates: Array<{
            modelSpecification: string;
            parameterCount: number;
            bootstrap: { replicates: number; methodId: string; confidenceInterval: { level: number } };
          }>;
          recommendedFamily?: string;
        };
      }>;
    }).factors[0]?.distributionFitResult;
    expect(routeFitResult).toMatchObject({
      factorId,
      sampleSize: 20,
      characteristicKind: "other",
      sampleDiagnostics: {
        mean: expect.any(Number),
        median: expect.any(Number),
      },
      selectionDecision: {
        methodId: "F7_MODEL_SELECTION_V1",
        proposedFinalFamily: expect.any(String),
      },
      candidates: expect.arrayContaining([expect.objectContaining({
        modelSpecification: expect.any(String),
        parameterCount: expect.any(Number),
        bootstrap: expect.objectContaining({
          replicates: 10000,
          methodId: "F7_BOOTSTRAP_V2",
          confidenceInterval: expect.objectContaining({ level: 0.95 }),
        }),
      })]),
    });
    expect((distributionFit.json as {
      factors: Array<{ distributionFitResult?: { recommendedFamily?: string } }>;
    }).factors[0]?.distributionFitResult).not.toHaveProperty("recommendedFamily");
    expect(routeFitResult).toEqual(service.getSession(importJson.sessionId).factors[0]?.distributionFitResult);

    const distributionApproval = await httpJson({
      port: address.port,
      method: "POST",
      path: `/f7/factors/${encodedFactorPath}/distribution-approval`,
      body: {
        sessionId: importJson.sessionId,
        family: routeFitResult?.selectionDecision.proposedFinalFamily,
        confirmed: true,
      },
    });
    expect(distributionApproval.status).toBe(200);

    const monteCarlo = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/monte-carlo",
      body: {
        sessionId: importJson.sessionId,
        lowerSpecLimit: -50,
        upperSpecLimit: 50,
        iterations: 10000,
        runSeed: "d".repeat(64),
        correlationMode: "INDEPENDENT",
        targetSigmaLevel: 4,
      },
    });
    expect(monteCarlo.status).toBe(200);
    expect(monteCarlo.json).toMatchObject({
      monteCarloResult: { methodId: "F7_MONTE_CARLO_V1", iterations: 10000, runSeed: "d".repeat(64) },
    });

    const report = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/report",
      body: { sessionId: importJson.sessionId },
    });
    expect(report.status).toBe(200);
    expect(report.headers["cache-control"]).toBe("no-store");
    expect(f7ReportProjectionSchema.parse(report.json)).toEqual(report.json);

    const reportWithUnknownKey = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/report",
      body: { sessionId: importJson.sessionId, extra: true },
    });
    expectRequestEnvelope(reportWithUnknownKey, 400);

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

    const reportWithoutSimulation = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/report",
      body: { sessionId: importJson.sessionId },
    });
    expect(reportWithoutSimulation.status).toBe(409);
    expect(reportWithoutSimulation.json).toMatchObject({ code: "prerequisite_not_ready" });

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
    const setup = goodWorksheet.json as {
      factors: Array<{
        factorCandidate: {
          factorCandidateId: string;
          designNominal: number;
          upperTolerance: number;
          lowerTolerance: number;
        };
      }>;
    };
    const goodFactors = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/factors/confirm",
      body: {
        sessionId: importJson.sessionId,
        confirmations: setup.factors.map((factor) => ({
          factorCandidateId: factor.factorCandidate.factorCandidateId,
          designNominal: factor.factorCandidate.designNominal,
          upperTolerance: factor.factorCandidate.upperTolerance,
          lowerTolerance: factor.factorCandidate.lowerTolerance,
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

    const fitBodyWithFactor = await httpJson({
      port: address.port,
      method: "POST",
      path: `/f7/factors/${encodeURIComponent(factorId)}/distribution-fit`,
      body: { sessionId: importJson.sessionId, factorId },
    });
    expectRequestEnvelope(fitBodyWithFactor, 400);
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

    const missingSession = await httpJson({
      port: address.port,
      method: "GET",
      path: "/f7/session/abc",
    });
    expect(missingSession.status).toBe(400);
    expect(missingSession.json).toMatchObject({
      code: "validation_error",
      summary: "F7 session state was not found.",
    });
  });

  it("serves the session-bound Dimension Chain image as private binary content", async () => {
    const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10]);
    const service: F7SessionService = {
      ...createRealService(),
      readDimensionChainImage: () => ({ mediaType: "image/png", bytes: imageBytes }),
    };
    const server = createF7LocalServer({ service });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const response = await httpJson({
      port: address.port,
      method: "GET",
      path: "/f7/session/session-fixed/dimension-chain-image",
    });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("image/png");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.rawBytes).toEqual(Buffer.from(imageBytes));
  });

  it("renders assumption results as a private PDF download after validating the session", async () => {
    const calls: string[] = [];
    const pdfBytes = Buffer.from("%PDF-1.7\nroute-test");
    const seededService = createRealService();
    const imported = seededService.importWorkbook({
      contractId: "f7-analysis-request-v1",
      inputClassification: "confidential",
      fileName: "seed.xlsx",
      workbookBytes: buildWorkbook(),
    });
    const worksheet = seededService.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: {
        workbookContentHash: imported.workbook.workbookContentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    });
    seededService.confirmFactorSetup({
      sessionId: imported.sessionId,
      confirmations: worksheet.factors.map((factor) => ({
        factorCandidateId: factor.factorCandidate.factorCandidateId,
        designNominal: factor.factorCandidate.designNominal,
        upperTolerance: factor.factorCandidate.upperTolerance,
        lowerTolerance: factor.factorCandidate.lowerTolerance,
        confirmed: true,
      })),
    });
    const service: F7SessionService = {
      ...seededService,
      getSession: (sessionId) => {
        calls.push(`session:${sessionId}`);
        return seededService.getSession(sessionId);
      },
    };
    const assumptionResultsPdfRenderer: AssumptionResultsPdfRenderer = {
      render: vi.fn(async (routeRequest) => {
        calls.push(`render:${routeRequest.sessionId}`);
        await Promise.resolve();
        return pdfBytes;
      }),
    };
    const events: Array<{ kind: string; status: number }> = [];
    const server = createF7LocalServer({
      service,
      assumptionResultsPdfRenderer,
      onEvent: (event) => events.push({ ...event }),
    });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);
    const body = toSessionBoundPdfRequest(seededService.getSession("session-fixed"));

    const response = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/assumption-results/pdf",
      body,
    });

    const fallbackName = safePdfDownloadFileName(body.workbookName, body.worksheetName);
    const unicodeName = safeUnicodePdfDownloadFileName(body.workbookName, body.worksheetName);
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["content-length"]).toBe(String(pdfBytes.byteLength));
    expect(response.headers["content-disposition"]).toBe(
      `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeRfc5987FileName(unicodeName)}`,
    );
    expect(response.rawBytes).toEqual(pdfBytes);
    expect(calls).toEqual(["session:session-fixed", "render:session-fixed"]);
    expect(assumptionResultsPdfRenderer.render).toHaveBeenCalledWith(body);
    expect(events).toEqual([{ kind: "f7.assumption-results.pdf", status: 200 }]);
  });

  it("rejects invalid assumption-results PDF bodies before session lookup or rendering", async () => {
    const realService = createRealService();
    const getSession = vi.fn((sessionId: string) => realService.getSession(sessionId));
    const service: F7SessionService = { ...realService, getSession };
    const assumptionResultsPdfRenderer: AssumptionResultsPdfRenderer = {
      render: vi.fn(async () => Buffer.from("%PDF-invalid")),
    };
    const server = createF7LocalServer({ service, assumptionResultsPdfRenderer });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const response = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/assumption-results/pdf",
      body: { ...validAssumptionResultsPdfRequest(), unexpected: true },
    });

    expectRequestEnvelope(response, 400);
    expect(getSession).not.toHaveBeenCalled();
    expect(assumptionResultsPdfRenderer.render).not.toHaveBeenCalled();
  });

  it("rejects non-JSON sourceSignature before session lookup or rendering", async () => {
    const realService = createRealService();
    const getSession = vi.fn((sessionId: string) => realService.getSession(sessionId));
    const service: F7SessionService = { ...realService, getSession };
    const assumptionResultsPdfRenderer: AssumptionResultsPdfRenderer = {
      render: vi.fn(async () => Buffer.from("%PDF-invalid")),
    };
    const server = createF7LocalServer({ service, assumptionResultsPdfRenderer });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);
    const request = validAssumptionResultsPdfRequest();

    const response = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/assumption-results/pdf",
      body: {
        ...request,
        engineeringEvidence: {
          ...request.engineeringEvidence,
          dimensionChain: {
            ...request.engineeringEvidence.dimensionChain,
            sourceSignature: "not-json-source-signature",
          },
        },
      },
    });

    expectRequestEnvelope(response, 400);
    expect(getSession).not.toHaveBeenCalled();
    expect(assumptionResultsPdfRenderer.render).not.toHaveBeenCalled();
  });

  it("rejects strict invalid engineeringEvidence payloads before session lookup or rendering", async () => {
    const realService = createRealService();
    const getSession = vi.fn((sessionId: string) => realService.getSession(sessionId));
    const service: F7SessionService = { ...realService, getSession };
    const assumptionResultsPdfRenderer: AssumptionResultsPdfRenderer = {
      render: vi.fn(async () => Buffer.from("%PDF-invalid")),
    };
    const server = createF7LocalServer({ service, assumptionResultsPdfRenderer });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);
    const base = validAssumptionResultsPdfRequest();

    const invalidBodies: unknown[] = [
      {
        ...base,
        engineeringEvidence: {
          ...base.engineeringEvidence,
          factorSetup: {
            ...base.engineeringEvidence.factorSetup,
            rows: Array.from({ length: 101 }, (_, index) => ({
              ...base.engineeringEvidence.factorSetup.rows[0],
              itemNumber: index + 1,
            })),
          },
        },
      },
      {
        ...base,
        engineeringEvidence: {
          ...base.engineeringEvidence,
          responseDistribution: {
            ...base.engineeringEvidence.responseDistribution,
            standardDeviation: Number.NaN,
          },
        },
      },
      {
        ...base,
        engineeringEvidence: {
          ...base.engineeringEvidence,
          responseDistribution: {
            ...base.engineeringEvidence.responseDistribution,
            target: Number.POSITIVE_INFINITY,
          },
        },
      },
      {
        ...base,
        engineeringEvidence: {
          ...base.engineeringEvidence,
          responseDistribution: {
            ...base.engineeringEvidence.responseDistribution,
            html: "<strong>unsafe</strong>",
          },
        },
      },
      {
        ...base,
        engineeringEvidence: {
          ...base.engineeringEvidence,
          dimensionChain: {
            ...base.engineeringEvidence.dimensionChain,
            status: "unknown",
          },
        },
      },
      {
        ...base,
        engineeringEvidence: {
          ...base.engineeringEvidence,
          dimensionChain: {
            ...(base.engineeringEvidence.dimensionChain.status === "generated"
              ? base.engineeringEvidence.dimensionChain
              : {
                status: "generated" as const,
                sourceSignature: HASH_A,
                orientation: "horizontal" as const,
                factors: [],
                manualLayout: { boundaryOffsets: {}, laneOffsets: {} },
                reversedFactorIds: [],
                closureDirection: "start-to-end" as const,
              }),
            manualLayout: {
              ...(base.engineeringEvidence.dimensionChain.status === "generated"
                ? base.engineeringEvidence.dimensionChain.manualLayout
                : { boundaryOffsets: {}, laneOffsets: {} }),
              laneOffsets: { [HASH_B]: -10001 },
            },
          },
        },
      },
      {
        ...base,
        engineeringEvidence: {
          ...base.engineeringEvidence,
          responseSummary: {
            ...base.engineeringEvidence.responseSummary,
            defectsPerMillion: {
              ...base.engineeringEvidence.responseSummary.defectsPerMillion,
              volume: -1,
            },
          },
        },
      },
      {
        ...base,
        engineeringEvidence: {
          ...base.engineeringEvidence,
          responseSummary: {
            ...base.engineeringEvidence.responseSummary,
            defectsPerMillion: {
              ...base.engineeringEvidence.responseSummary.defectsPerMillion,
              volume: 3.14,
            },
          },
        },
      },
      {
        ...base,
        engineeringEvidence: {
          ...base.engineeringEvidence,
          responseSummary: {
            rssAndWorstCase: base.engineeringEvidence.responseSummary.rssAndWorstCase,
          },
        },
      },
      {
        ...base,
        engineeringEvidence: {
          ...base.engineeringEvidence,
          imageUrl: "https://example.invalid/1.png",
        },
      },
      {
        ...base,
        engineeringEvidence: {
          ...base.engineeringEvidence,
          dataUrl: "data:image/png;base64,AA==",
        },
      },
      {
        ...base,
        engineeringEvidence: {
          ...base.engineeringEvidence,
          path: "C:/tmp/unsafe.png",
        },
      },
    ];

    for (const body of invalidBodies) {
      const response = await httpJson({
        port: address.port,
        method: "POST",
        path: "/f7/assumption-results/pdf",
        body,
      });
      expectRequestEnvelope(response, 400);
    }

    expect(getSession).not.toHaveBeenCalled();
    expect(assumptionResultsPdfRenderer.render).not.toHaveBeenCalled();
  });

  it("accepts every structurally valid Web action variant", async () => {
    const service = createRealService();
    const imported = service.importWorkbook({
      contractId: "f7-analysis-request-v1",
      inputClassification: "confidential",
      fileName: "seed.xlsx",
      workbookBytes: buildWorkbook(),
    });
    const worksheet = service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: {
        workbookContentHash: imported.workbook.workbookContentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    });
    service.confirmFactorSetup({
      sessionId: imported.sessionId,
      confirmations: worksheet.factors.map((factor) => ({
        factorCandidateId: factor.factorCandidate.factorCandidateId,
        designNominal: factor.factorCandidate.designNominal,
        upperTolerance: factor.factorCandidate.upperTolerance,
        lowerTolerance: factor.factorCandidate.lowerTolerance,
        confirmed: true,
      })),
    });
    const assumptionResultsPdfRenderer: AssumptionResultsPdfRenderer = {
      render: vi.fn(async () => Buffer.from("%PDF-1.7\nfixture")),
    };
    const server = createF7LocalServer({ service, assumptionResultsPdfRenderer });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);
    const base = toSessionBoundPdfRequest(service.getSession("session-fixed"));

    for (const actionItem of [
      {
        optionId: "improvement-reduce-variation",
        title: "Reduce variation",
        narrative: "Reduce total variation.",
      },
      base.actionItems[0],
      base.actionItems[1],
    ]) {
      const response = await httpJson({
        port: address.port,
        method: "POST",
        path: "/f7/assumption-results/pdf",
        body: { ...base, actionItems: [actionItem] },
      });
      expect(response.status).toBe(200);
    }
  });

  it("rejects assumption-results PDF when workbook or worksheet does not match the current session", async () => {
    const service = createRealService();
    const workbook = buildWorkbook();
    const imported = service.importWorkbook({
      contractId: "f7-analysis-request-v1",
      inputClassification: "confidential",
      fileName: "Session-A.xlsx",
      workbookBytes: workbook,
    });
    const confirmed = service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: {
        workbookContentHash: imported.workbook.workbookContentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    });
    const ready = service.confirmFactorSetup({
      sessionId: imported.sessionId,
      confirmations: confirmed.factors.map((factor) => ({
        factorCandidateId: factor.factorCandidate.factorCandidateId,
        designNominal: factor.factorCandidate.designNominal,
        upperTolerance: factor.factorCandidate.upperTolerance,
        lowerTolerance: factor.factorCandidate.lowerTolerance,
        confirmed: true,
      })),
    });

    const assumptionResultsPdfRenderer: AssumptionResultsPdfRenderer = {
      render: vi.fn(async () => Buffer.from("%PDF-1.7\nfixture")),
    };
    const server = createF7LocalServer({ service, assumptionResultsPdfRenderer });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const validBody = toSessionBoundPdfRequest(ready);
    const workbookMismatch = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/assumption-results/pdf",
      body: {
        ...validBody,
        workbookName: "Session-B.xlsx",
      },
    });
    expect(workbookMismatch.status).toBe(400);
    expect(workbookMismatch.json).toMatchObject({ code: "validation_error" });

    const worksheetMismatch = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/assumption-results/pdf",
      body: {
        ...validBody,
        worksheetName: "Session-B-Worksheet",
      },
    });
    expect(worksheetMismatch.status).toBe(400);
    expect(worksheetMismatch.json).toMatchObject({ code: "validation_error" });

    expect(assumptionResultsPdfRenderer.render).not.toHaveBeenCalled();
  });

  it("rejects assumption-results PDF when engineeringEvidence factors do not match the current session and accepts matching A payload", async () => {
    const service = createF7SessionService({
      createId: (() => {
        let next = 1;
        return () => `session-${next++}`;
      })(),
      now: () => "2026-08-19T08:00:00.000Z",
    });
    const workbook = buildWorkbook();
    const importedA = service.importWorkbook({
      contractId: "f7-analysis-request-v1",
      inputClassification: "confidential",
      fileName: "Session-A.xlsx",
      workbookBytes: workbook,
    });
    const worksheetA = service.confirmWorksheet({
      sessionId: importedA.sessionId,
      confirmation: {
        workbookContentHash: importedA.workbook.workbookContentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    });
    const readyA = service.confirmFactorSetup({
      sessionId: importedA.sessionId,
      confirmations: worksheetA.factors.map((factor) => ({
        factorCandidateId: factor.factorCandidate.factorCandidateId,
        designNominal: factor.factorCandidate.designNominal,
        upperTolerance: factor.factorCandidate.upperTolerance,
        lowerTolerance: factor.factorCandidate.lowerTolerance,
        confirmed: true,
      })),
    });

    const importedB = service.importWorkbook({
      contractId: "f7-analysis-request-v1",
      inputClassification: "confidential",
      fileName: "Session-B.xlsx",
      workbookBytes: buildWorkbook("Fabric thickness B"),
    });
    const worksheetB = service.confirmWorksheet({
      sessionId: importedB.sessionId,
      confirmation: {
        workbookContentHash: importedB.workbook.workbookContentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    });
    const readyB = service.confirmFactorSetup({
      sessionId: importedB.sessionId,
      confirmations: worksheetB.factors.map((factor) => ({
        factorCandidateId: factor.factorCandidate.factorCandidateId,
        designNominal: factor.factorCandidate.designNominal,
        upperTolerance: factor.factorCandidate.upperTolerance,
        lowerTolerance: factor.factorCandidate.lowerTolerance,
        confirmed: true,
      })),
    });

    const assumptionResultsPdfRenderer: AssumptionResultsPdfRenderer = {
      render: vi.fn(async () => Buffer.from("%PDF-1.7\nfixture")),
    };
    const server = createF7LocalServer({ service, assumptionResultsPdfRenderer });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const bodyA = toSessionBoundPdfRequest(readyA);
    const bodyB = toSessionBoundPdfRequest(readyB);
    const crossSessionResponse = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/assumption-results/pdf",
      body: {
        ...bodyA,
        engineeringEvidence: bodyB.engineeringEvidence,
      },
    });
    expect(crossSessionResponse.status).toBe(400);
    expect(crossSessionResponse.json).toMatchObject({ code: "validation_error" });

    const validResponse = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/assumption-results/pdf",
      body: bodyA,
    });
    expect(validResponse.status).toBe(200);
    expect(assumptionResultsPdfRenderer.render).toHaveBeenCalledTimes(1);
  });

  it("uses controlled session error mapping and does not render a missing session", async () => {
    const assumptionResultsPdfRenderer: AssumptionResultsPdfRenderer = {
      render: vi.fn(async () => Buffer.from("%PDF-invalid")),
    };
    const server = createF7LocalServer({ service: createRealService(), assumptionResultsPdfRenderer });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const response = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/assumption-results/pdf",
      body: validAssumptionResultsPdfRequest(),
    });

    expect(response.status).toBe(404);
    expect(response.json).toMatchObject({
      code: "validation_error",
      summary: "F7 session state was not found.",
    });
    expect(assumptionResultsPdfRenderer.render).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", Buffer.alloc(0)],
    ["non-PDF", Buffer.from("not-a-pdf")],
  ])("maps %s assumption-results renderer output to controlled 500 JSON", async (_caseName, pdfBytes) => {
    const service = createRealService();
    const imported = service.importWorkbook({
      contractId: "f7-analysis-request-v1",
      inputClassification: "confidential",
      fileName: "seed.xlsx",
      workbookBytes: buildWorkbook(),
    });
    const worksheet = service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: {
        workbookContentHash: imported.workbook.workbookContentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    });
    service.confirmFactorSetup({
      sessionId: imported.sessionId,
      confirmations: worksheet.factors.map((factor) => ({
        factorCandidateId: factor.factorCandidate.factorCandidateId,
        designNominal: factor.factorCandidate.designNominal,
        upperTolerance: factor.factorCandidate.upperTolerance,
        lowerTolerance: factor.factorCandidate.lowerTolerance,
        confirmed: true,
      })),
    });
    const assumptionResultsPdfRenderer: AssumptionResultsPdfRenderer = {
      render: vi.fn(async () => pdfBytes),
    };
    const events: Array<{ kind: string; status: number }> = [];
    const server = createF7LocalServer({
      service,
      assumptionResultsPdfRenderer,
      onEvent: (event) => events.push({ ...event }),
    });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const response = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/assumption-results/pdf",
      body: toSessionBoundPdfRequest(service.getSession("session-fixed")),
    });

    expect(response.status).toBe(500);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.rawBytes.subarray(0, 5).toString("ascii")).not.toBe("%PDF-");
    expect(response.json).toEqual({
      code: "internal_error",
      summary: "F7 local API request failed.",
      suggestedAction: "Retry the request. If the problem persists, restart the local API.",
      affectedInputReferences: ["f7-local-api"],
    });
    expect(events).toEqual([{ kind: "f7.assumption-results.pdf", status: 500 }]);
  });

  it("maps assumption-results renderer failures to controlled 500 without PDF bytes", async () => {
    const service = createRealService();
    const imported = service.importWorkbook({
      contractId: "f7-analysis-request-v1",
      inputClassification: "confidential",
      fileName: "seed.xlsx",
      workbookBytes: buildWorkbook(),
    });
    const worksheet = service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: {
        workbookContentHash: imported.workbook.workbookContentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    });
    service.confirmFactorSetup({
      sessionId: imported.sessionId,
      confirmations: worksheet.factors.map((factor) => ({
        factorCandidateId: factor.factorCandidate.factorCandidateId,
        designNominal: factor.factorCandidate.designNominal,
        upperTolerance: factor.factorCandidate.upperTolerance,
        lowerTolerance: factor.factorCandidate.lowerTolerance,
        confirmed: true,
      })),
    });
    const assumptionResultsPdfRenderer: AssumptionResultsPdfRenderer = {
      render: vi.fn(async () => {
        throw new Error("private-renderer-detail");
      }),
    };
    const events: Array<{ kind: string; status: number }> = [];
    const server = createF7LocalServer({
      service,
      assumptionResultsPdfRenderer,
      onEvent: (event) => events.push({ ...event }),
    });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const response = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/assumption-results/pdf",
      body: toSessionBoundPdfRequest(service.getSession("session-fixed")),
    });

    expect(response.status).toBe(500);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.rawBytes.subarray(0, 5).toString("ascii")).not.toBe("%PDF-");
    expect(response.rawBody).not.toContain("private-renderer-detail");
    expect(response.json).toEqual({
      code: "internal_error",
      summary: "F7 local API request failed.",
      suggestedAction: "Retry the request. If the problem persists, restart the local API.",
      affectedInputReferences: ["f7-local-api"],
    });
    expect(events).toEqual([{ kind: "f7.assumption-results.pdf", status: 500 }]);
  });

  it("maps assumption-results renderer queue saturation to controlled 503", async () => {
    const service = createRealService();
    const imported = service.importWorkbook({
      contractId: "f7-analysis-request-v1",
      inputClassification: "confidential",
      fileName: "seed.xlsx",
      workbookBytes: buildWorkbook(),
    });
    const worksheet = service.confirmWorksheet({
      sessionId: imported.sessionId,
      confirmation: {
        workbookContentHash: imported.workbook.workbookContentHash,
        selectedWorksheetNames: ["Anonymous_TA"],
        confirmed: true,
      },
    });
    service.confirmFactorSetup({
      sessionId: imported.sessionId,
      confirmations: worksheet.factors.map((factor) => ({
        factorCandidateId: factor.factorCandidate.factorCandidateId,
        designNominal: factor.factorCandidate.designNominal,
        upperTolerance: factor.factorCandidate.upperTolerance,
        lowerTolerance: factor.factorCandidate.lowerTolerance,
        confirmed: true,
      })),
    });
    const assumptionResultsPdfRenderer: AssumptionResultsPdfRenderer = {
      render: vi.fn(async () => {
        throw new AssumptionResultsPdfQueueFullError();
      }),
    };
    const events: Array<{ kind: string; status: number }> = [];
    const server = createF7LocalServer({
      service,
      assumptionResultsPdfRenderer,
      onEvent: (event) => events.push({ ...event }),
    });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const response = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/assumption-results/pdf",
      body: toSessionBoundPdfRequest(service.getSession("session-fixed")),
    });

    expect(response.status).toBe(503);
    expect(response.json).toEqual({
      code: "pdf_renderer_busy",
      summary: "The local PDF renderer is at capacity.",
      suggestedAction: "Wait for an active PDF generation to finish, then retry.",
      affectedInputReferences: ["f7-assumption-results-pdf"],
    });
    expect(events).toEqual([{ kind: "f7.assumption-results.pdf", status: 503 }]);
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

  it("applies body-route transfer framing validation to POST /f7/report", async () => {
    let reportCalls = 0;
    const service = {
      ...createTypedErrorService("prerequisite_not_ready"),
      generateReport: () => {
        reportCalls += 1;
        throw new Error("unexpected dispatch");
      },
    } as F7SessionService;
    const server = createF7LocalServer({ service });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const response = await rawHttpRequest(
      address.port,
      "POST /f7/report HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nTransfer-Encoding: gzip\r\n\r\n{}",
    );

    expect(response.data).toContain("HTTP/1.1 400");
    expect(response.closed).toBe(true);
    expect(reportCalls).toBe(0);
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

  it("rejects malformed Distribution Fit method, path, and transfer framing", async () => {
    const service = createRealService();
    const server = createF7LocalServer({ service });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);
    const route = `/f7/factors/${"a".repeat(64)}/distribution-fit`;

    const wrongMethod = await httpJson({
      port: address.port,
      method: "GET",
      path: route,
    });
    expectRequestEnvelope(wrongMethod, 404);

    const malformedPath = await httpJson({
      port: address.port,
      method: "POST",
      path: `${route}/extra`,
      body: { sessionId: "session-fixed" },
    });
    expectRequestEnvelope(malformedPath, 404);

    const malformedFraming = await rawHttpRequest(
      address.port,
      `POST ${route} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nTransfer-Encoding: gzip\r\n\r\n{}`,
    );
    expect(malformedFraming.data).toContain("HTTP/1.1 400");
    expect(malformedFraming.closed).toBe(true);
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

  it("maps a report prerequisite service error to HTTP 409", async () => {
    const server = createF7LocalServer({ service: createTypedErrorService("prerequisite_not_ready") });
    openServers.push(server);
    const address = await listenF7LocalServer(server, 0);

    const response = await httpJson({
      port: address.port,
      method: "POST",
      path: "/f7/report",
      body: { sessionId: "session-fixed" },
    });

    expect(response.status).toBe(409);
    expect(response.json).toMatchObject({ code: "prerequisite_not_ready" });
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