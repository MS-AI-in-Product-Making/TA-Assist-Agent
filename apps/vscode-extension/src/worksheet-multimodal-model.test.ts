import { createHash } from "node:crypto";

import { createF5MultimodalFactorSetHash, createF5MultimodalRequestHash } from "@ai-assist/contracts";
import { describe, expect, it, vi } from "vitest";

import { executeWorksheetMultimodalModel } from "./worksheet-multimodal-model.js";

const SESSION_ID = "89898989-8989-4989-8989-898989898989";
const IMAGE_BYTES = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));

describe("executeWorksheetMultimodalModel", () => {
  it.each(["missing", "incomplete", "duplicate", "not_evaluated"])("fails a %s five-scope evaluation", async (variant) => {
    const request = multimodalRequest();
    const candidate: Record<string, unknown> = { result: validResult(request), scopeEvaluations: scopeEvaluations() };
    if (variant === "missing") delete candidate.scopeEvaluations;
    if (variant === "incomplete") candidate.scopeEvaluations = scopeEvaluations().slice(1);
    if (variant === "duplicate") candidate.scopeEvaluations = [...scopeEvaluations().slice(1), scopeEvaluations()[1]];
    if (variant === "not_evaluated") candidate.scopeEvaluations = scopeEvaluations().map((scope) => ({ ...scope, status: "not_evaluated" }));
    expect(await executeWorksheetMultimodalModel(dependencies(request, JSON.stringify(candidate))))
      .toMatchObject({ status: "failed", error: { code: "evaluation_incomplete" } });
  });

  it("returns exactly five assessed scopes without modifying the v3 pair", async () => {
    const request = multimodalRequest();
    const result = validResult(request);
    const execution = await executeWorksheetMultimodalModel(dependencies(request, JSON.stringify({ result, scopeEvaluations: scopeEvaluations() })));
    expect(execution).toEqual({ status: "completed", outcome: { kind: "worksheet_multimodal_response", result, scopeEvaluations: scopeEvaluations() } });
  });

  it("sends exactly one binary image part and one complete Factor-table text part", async () => {
    const request = multimodalRequest();
    const sendRequest = vi.fn(async (messages: unknown[]) => {
      const result = validResult(request);
      return { text: stream(JSON.stringify({ result, scopeEvaluations: scopeEvaluations() })), messages };
    });
    const parts: unknown[] = [];

    const execution = await executeWorksheetMultimodalModel({
      request,
      fetchImage: async () => ({ bytes: IMAGE_BYTES, mediaType: "image/png" }),
      models: [{ id: "vision-model", supportsImage: true, sendRequest }],
      createImagePart(bytes, mediaType) { const part = { kind: "image", bytes, mediaType }; parts.push(part); return part; },
      createTextPart(text) { const part = { kind: "text", text }; parts.push(part); return part; },
      createUserMessage: (content) => ({ content }),
    });

    expect(execution).toMatchObject({ status: "completed", outcome: { kind: "worksheet_multimodal_response", result: { requestHash: request.requestHash } } });
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ kind: "image", bytes: IMAGE_BYTES, mediaType: "image/png" });
    expect(parts[1]).toMatchObject({ kind: "text" });
    expect(JSON.stringify(parts[1])).toContain("Factor A1");
    expect(JSON.stringify(parts[1])).toContain("Factor A2");
    expect(sendRequest).toHaveBeenCalledOnce();
  });

  it("fails before model dispatch when image bytes do not match the descriptor", async () => {
    const sendRequest = vi.fn();
    const execution = await executeWorksheetMultimodalModel({
      request: multimodalRequest(),
      fetchImage: async () => ({ bytes: new Uint8Array([1, 2, 3]), mediaType: "image/png" }),
      models: [{ id: "vision-model", supportsImage: true, sendRequest }],
      createImagePart: vi.fn(),
      createTextPart: vi.fn(),
      createUserMessage: vi.fn(),
    });

    expect(execution).toMatchObject({ status: "failed", error: { code: "image_identity_mismatch" } });
    expect(sendRequest).not.toHaveBeenCalled();
  });

  it("blocks without dispatch when no model is available", async () => {
    const execution = await executeWorksheetMultimodalModel({
      request: multimodalRequest(),
      fetchImage: async () => ({ bytes: IMAGE_BYTES, mediaType: "image/png" }),
      models: [],
      createImagePart: vi.fn(),
      createTextPart: vi.fn(),
      createUserMessage: vi.fn(),
    });

    expect(execution).toEqual({ status: "blocked", reason: "model_capability_unavailable" });
  });

  it("blocks without dispatch when host image capability is unknown", async () => {
    const sendRequest = vi.fn();
    const execution = await executeWorksheetMultimodalModel({
      ...dependencies(multimodalRequest(), "unused"),
      models: [{ id: "unknown-model", sendRequest }],
    });

    expect(execution).toEqual({ status: "blocked", reason: "model_capability_unavailable" });
    expect(sendRequest).not.toHaveBeenCalled();
  });

  it("skips an explicitly text-only model and uses an image-capable model once", async () => {
    const request = multimodalRequest();
    const textOnly = vi.fn();
    const imageCapable = vi.fn(async () => ({ text: stream(JSON.stringify({ result: validResult(request), scopeEvaluations: scopeEvaluations() })) }));
    const execution = await executeWorksheetMultimodalModel({
      ...dependencies(request, "unused"),
      models: [
        { id: "text-model", supportsImage: false, sendRequest: textOnly },
        { id: "vision-model", supportsImage: true, sendRequest: imageCapable },
      ],
    });

    expect(execution.status).toBe("completed");
    expect(textOnly).not.toHaveBeenCalled();
    expect(imageCapable).toHaveBeenCalledOnce();
  });

  it("returns governed terminal diagnostics for ordinal and image-read blockers", async () => {
    const request = multimodalRequest();
    const ordinal = await executeWorksheetMultimodalModel(dependencies(request, JSON.stringify({ status: "blocked", reason: "ordinal_mapping_unavailable" })));
    expect(ordinal).toEqual({ status: "blocked", reason: "ordinal_mapping_unavailable" });

    const imageRead = await executeWorksheetMultimodalModel({ ...dependencies(request, "unused"), fetchImage: async () => { throw new Error("lease expired"); } });
    expect(imageRead).toEqual({ status: "failed", error: { code: "image_read_failed" } });
  });

  it("rejects malformed model JSON and ambiguous ordinal mappings", async () => {
    const request = multimodalRequest();
    const malformed = await executeWorksheetMultimodalModel(dependencies(request, "not-json"));
    expect(malformed).toMatchObject({ status: "failed", error: { code: "model_result_invalid" } });

    const ambiguous = validResult(request);
    ambiguous.rowMappings[1]!.factorOrdinal.value = "A";
    const invalidMapping = await executeWorksheetMultimodalModel(dependencies(request, JSON.stringify({ result: ambiguous, scopeEvaluations: scopeEvaluations() })));
    expect(invalidMapping).toMatchObject({ status: "failed", error: { code: "model_result_invalid" } });
  });
});

function dependencies(request: ReturnType<typeof multimodalRequest>, responseText: string) {
  return {
    request,
    fetchImage: async () => ({ bytes: IMAGE_BYTES, mediaType: "image/png" as const }),
    models: [{ id: "vision-model", supportsImage: true, sendRequest: async () => ({ text: stream(responseText) }) }],
    createImagePart: (bytes: Uint8Array, mediaType: string) => ({ bytes, mediaType }),
    createTextPart: (text: string) => ({ text }),
    createUserMessage: (content: readonly unknown[]) => ({ content }),
  };
}

function multimodalRequest() {
  const factorRows = [11, 12].map((sourceRow, index) => ({ worksheetName: "Analysis-A", tableId: "table-a", sourceRow, factorOrdinal: { value: index === 0 ? "A" : "B", rawText: index === 0 ? "A" : "B", sourceCell: `Analysis-A!Z${sourceRow}` }, factorName: `Factor A${index + 1}`, partName: "Part A", partCategory: "CNC", drawingNumber: "DWG-A", dimId: String(sourceRow), nominal: sourceRow, upperTolerance: 0.1, lowerTolerance: -0.1, longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "normal", sourceCells: { factorName: `Analysis-A!A${sourceRow}` } }));
  const request = { contractVersion: "f5-multimodal-request-v3" as const, inputClassification: "confidential" as const, requestHash: "", sessionId: SESSION_ID, revision: 4, inputRevision: 3, workbook: { fileName: "anonymous.xlsx", contentHash: "a".repeat(64) }, worksheetName: "Analysis-A", tableId: "table-a", activeFactorCount: factorRows.length, factorSetHash: createF5MultimodalFactorSetHash(factorRows), image: { mediaType: "image/png" as const, contentHash: createHash("sha256").update(IMAGE_BYTES).digest("hex"), byteLength: IMAGE_BYTES.byteLength, artifactPath: "images/analysis-a.png" }, factorRows };
  request.requestHash = createF5MultimodalRequestHash(request);
  return request;
}

function validResult(request: ReturnType<typeof multimodalRequest>) {
  return { contractVersion: "f5-multimodal-result-v3" as const, outputClassification: "confidential" as const, requestHash: request.requestHash, sessionId: request.sessionId, revision: request.revision, inputRevision: request.inputRevision, workbookContentHash: request.workbook.contentHash, worksheetName: request.worksheetName, tableId: request.tableId, imageContentHash: request.image.contentHash, model: { modelId: "vision-model", supportsImage: true as const }, imageTableInterpretation: "The image and complete Factor table were interpreted together.", rowMappings: request.factorRows.map((row) => ({ worksheetName: row.worksheetName, tableId: row.tableId, sourceRow: row.sourceRow, factorOrdinal: { ...row.factorOrdinal }, mappingStatus: "matched" as const, visibleStatus: "visible" as const, interpretation: `${row.factorOrdinal.value} is visible.` })) };
}

async function* stream(value: string) {
  yield value;
}

function scopeEvaluations() {
  return ["tolerance_loop_closure", "datum_chain", "assembly_datum_face", "stack_start", "direction"].map((scope) => ({
    scope, status: "insufficient_evidence", observedValue: "ambiguous", confidence: "low", visibleBasis: "The supplied image does not establish this geometry.",
  }));
}
