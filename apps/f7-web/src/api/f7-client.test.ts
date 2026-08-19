import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createF7Client } from "./f7-client";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

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
        standardDeviation: 0.2,
        distribution: "Normal",
        lowerSpecLimit: 0,
        upperSpecLimit: 10,
      },
    },
  ],
} as const;

describe("createF7Client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses exact routes/methods for all seven APIs and JSON body rules", async () => {
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
      confirmations: [{ factorCandidateId: HASH_B, loopCoefficient: -1, unit: "mm", confirmed: true }],
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

    await client.getSession("session id/01");

    expect(fetchMock).toHaveBeenCalledTimes(6);

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

    expect(fetchMock.mock.calls[5]?.[0]).toBe("http://localhost:3017/f7/session/session%20id%2F01");
    expect(fetchMock.mock.calls[5]?.[1]).toBeUndefined();
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
