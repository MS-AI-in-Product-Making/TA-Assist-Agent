import { createHash } from "node:crypto";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { createF5MultimodalFactorSetHash, createF5MultimodalRequestHash } from "@ai-assist/contracts";

import { WorkbenchAuth } from "../auth.js";
import type { WorkbenchServerContext } from "../server.js";
import { hostActionsRoutes } from "./host-actions.js";

const SESSION_ID = "78787878-7878-4787-8787-787878787878";
const PNG_BYTES = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));

describe("multimodal HostAction image route", () => {
  it("discovers a current pending worksheet multimodal action", async () => {
    const auth = new WorkbenchAuth(new Uint8Array(32).fill(6));
    const nestedRequest = multimodalRequest();
    const actionId = `multimodal:${nestedRequest.requestHash}`;
    const context = {
      auth,
      buildWorksheetInterpretationRequests: vi.fn(async () => [nestedRequest]),
      hostActions: { readRecord: vi.fn(async () => ({ status: "pending", request: { kind: "vscode_worksheet_multimodal_request" } })) },
      requireAuthenticated(request: Parameters<WorkbenchServerContext["requireAuthenticated"]>[0]) { return auth.authenticate(request); },
    } as unknown as WorkbenchServerContext;
    const app = Fastify();
    await app.register(hostActionsRoutes, { context });
    await app.ready();
    try {
      const token = auth.issueHostBearer(SESSION_ID, ["sessions:read"]);
      const response = await app.inject({ method: "GET", url: `/api/sessions/${SESSION_ID}/host-actions/pending`, headers: { authorization: `Bearer ${token}` } });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ actionId, kind: "vscode_worksheet_multimodal_request" });
    } finally {
      await app.close();
    }
  });

  it("rebuilds a missing pending action from the canonical worksheet request", async () => {
    const auth = new WorkbenchAuth(new Uint8Array(32).fill(6));
    const nestedRequest = multimodalRequest();
    const actionId = `multimodal:${nestedRequest.requestHash}`;
    const readRecord = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ status: "pending", request: { kind: "vscode_worksheet_multimodal_request" } });
    const create = vi.fn(async () => ({ actionId }));
    const context = {
      auth,
      buildWorksheetInterpretationRequests: vi.fn(async () => [nestedRequest]),
      hostActions: { readRecord, create },
      requireAuthenticated(request: Parameters<WorkbenchServerContext["requireAuthenticated"]>[0]) { return auth.authenticate(request); },
    } as unknown as WorkbenchServerContext;
    const app = Fastify();
    await app.register(hostActionsRoutes, { context });
    await app.ready();
    try {
      const token = auth.issueHostBearer(SESSION_ID, ["sessions:read"]);
      const response = await app.inject({ method: "GET", url: `/api/sessions/${SESSION_ID}/host-actions/pending`, headers: { authorization: `Bearer ${token}` } });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ actionId, kind: "vscode_worksheet_multimodal_request" });
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ actionId, expectedRevision: nestedRequest.revision, request: nestedRequest }));
    } finally {
      await app.close();
    }
  });

  it("serves image bytes only through an action-bound image-read bearer", async () => {
    const auth = new WorkbenchAuth(new Uint8Array(32).fill(7));
    const readClaimedWorksheetImage = vi.fn(async () => ({ bytes: PNG_BYTES, mediaType: "image/png" as const }));
    const context = {
      auth,
      readClaimedWorksheetImage,
      requireAuthenticated(request: Parameters<WorkbenchServerContext["requireAuthenticated"]>[0]) { return auth.authenticate(request); },
    } as unknown as WorkbenchServerContext;
    const app = Fastify();
    await app.register(hostActionsRoutes, { context });
    await app.ready();
    try {
      const token = auth.issueHostBearer(SESSION_ID, ["host-actions:image:read" as never], { actionId: "multimodal:Analysis-A", hostInstanceId: "host-1" });
      const response = await app.inject({
        method: "GET",
        url: `/api/sessions/${SESSION_ID}/host-actions/multimodal%3AAnalysis-A/leases/lease-1/image`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("image/png");
      expect(response.rawPayload).toEqual(Buffer.from(PNG_BYTES));
      expect(readClaimedWorksheetImage).toHaveBeenCalledWith({ sessionId: SESSION_ID, actionId: "multimodal:Analysis-A", hostInstanceId: "host-1", leaseId: "lease-1" });
    } finally {
      await app.close();
    }
  });

  it("rejects a completed model result that is not bound to the claimed worksheet request", async () => {
    const auth = new WorkbenchAuth(new Uint8Array(32).fill(8));
    const nestedRequest = multimodalRequest();
    const actionId = `multimodal:${nestedRequest.requestHash}`;
    const request = { contractVersion: "f8-host-action-request-v1" as const, actionId, sessionId: SESSION_ID, expectedRevision: 4, expiresAt: "2026-09-07T00:15:00.000Z", kind: "vscode_worksheet_multimodal_request" as const, confirmationHash: nestedRequest.requestHash, expectedTargetVersion: "vscode-worksheet-multimodal-v3" as const, request: nestedRequest };
    const complete = vi.fn(async () => "accepted" as const);
    const outcome = { kind: "worksheet_multimodal_response" as const, result: { contractVersion: "f5-multimodal-result-v3" as const, outputClassification: "confidential" as const, requestHash: "f".repeat(64), sessionId: SESSION_ID, revision: 4, inputRevision: 3, workbookContentHash: "a".repeat(64), worksheetName: "Analysis-A", tableId: "table-a", imageContentHash: nestedRequest.image.contentHash, model: { modelId: "vision-model", supportsImage: true as const }, imageTableInterpretation: "Interpreted with the complete table.", rowMappings: [{ worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 11, factorOrdinal: nestedRequest.factorRows[0]!.factorOrdinal, mappingStatus: "matched" as const, visibleStatus: "visible" as const, interpretation: "Ordinal A is visible." }] } };
    const payload = { status: "completed" as const, outcome };
    const context = {
      auth,
      hostActions: { readRecord: vi.fn(async () => ({ request })), complete },
      validateWorksheetInterpretationRequest: vi.fn(async () => true),
      requireAuthenticated(requestValue: Parameters<WorkbenchServerContext["requireAuthenticated"]>[0]) { return auth.authenticate(requestValue); },
    } as unknown as WorkbenchServerContext;
    const app = Fastify();
    await app.register(hostActionsRoutes, { context });
    await app.ready();
    try {
      const token = auth.issueHostBearer(SESSION_ID, ["host-actions:result"], { actionId, hostInstanceId: "host-1" });
      const response = await app.inject({ method: "POST", url: `/api/sessions/${SESSION_ID}/host-actions/${encodeURIComponent(actionId)}/result`, headers: { authorization: `Bearer ${token}` }, payload: { contractVersion: "f8-host-action-result-v1", actionId, hostInstanceId: "host-1", leaseId: "lease-1", status: "completed", resultHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"), payload } });

      expect(response.statusCode).toBe(400);
      expect(complete).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("rejects a duplicate multimodal result from a different lease", async () => {
    const auth = new WorkbenchAuth(new Uint8Array(32).fill(9));
    const nestedRequest = multimodalRequest();
    const actionId = `multimodal:${nestedRequest.requestHash}`;
    const request = { contractVersion: "f8-host-action-request-v1" as const, actionId, sessionId: SESSION_ID, expectedRevision: 4, expiresAt: "2026-09-07T00:15:00.000Z", kind: "vscode_worksheet_multimodal_request" as const, confirmationHash: nestedRequest.requestHash, expectedTargetVersion: "vscode-worksheet-multimodal-v3" as const, request: nestedRequest };
    const payload = { status: "completed" as const, outcome: validOutcome(nestedRequest) };
    const resultHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const storedResult = { contractVersion: "f8-host-action-result-v1" as const, actionId, hostInstanceId: "host-1", leaseId: "lease-1", status: "completed" as const, resultHash, payload };
    const context = {
      auth,
      hostActions: { readRecord: vi.fn(async () => ({ request, result: storedResult })), complete: vi.fn(async () => "duplicate" as const) },
      validateWorksheetInterpretationRequest: vi.fn(async () => true),
      requireAuthenticated(requestValue: Parameters<WorkbenchServerContext["requireAuthenticated"]>[0]) { return auth.authenticate(requestValue); },
    } as unknown as WorkbenchServerContext;
    const app = Fastify();
    await app.register(hostActionsRoutes, { context });
    await app.ready();
    try {
      const token = auth.issueHostBearer(SESSION_ID, ["host-actions:result"], { actionId, hostInstanceId: "host-1" });
      const response = await app.inject({ method: "POST", url: `/api/sessions/${SESSION_ID}/host-actions/${encodeURIComponent(actionId)}/result`, headers: { authorization: `Bearer ${token}` }, payload: { ...storedResult, leaseId: "lease-2" } });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: "host_action_result_replayed" });
    } finally {
      await app.close();
    }
  });

  it("resumes the same persisted multimodal result when completion races", async () => {
    const auth = new WorkbenchAuth(new Uint8Array(32).fill(10));
    const nestedRequest = multimodalRequest();
    const actionId = `multimodal:${nestedRequest.requestHash}`;
    const request = { contractVersion: "f8-host-action-request-v1" as const, actionId, sessionId: SESSION_ID, expectedRevision: 4, expiresAt: "2026-09-07T00:15:00.000Z", kind: "vscode_worksheet_multimodal_request" as const, confirmationHash: nestedRequest.requestHash, expectedTargetVersion: "vscode-worksheet-multimodal-v3" as const, request: nestedRequest };
    const payload = { status: "completed" as const, outcome: validOutcome(nestedRequest) };
    const storedResult = { contractVersion: "f8-host-action-result-v1" as const, actionId, hostInstanceId: "host-1", leaseId: "lease-1", status: "completed" as const, resultHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"), payload };
    const readRecord = vi.fn()
      .mockResolvedValueOnce({ request })
      .mockResolvedValueOnce({ request, result: storedResult });
    const enqueueActiveAttempt = vi.fn(async () => undefined);
    const context = {
      auth,
      hostActions: { readRecord, complete: vi.fn(async () => "duplicate" as const) },
      sessions: { read: vi.fn(async () => ({ state: "f5_running", revision: 4 })) },
      enqueueActiveAttempt,
      validateWorksheetInterpretationRequest: vi.fn(async () => true),
      requireAuthenticated(requestValue: Parameters<WorkbenchServerContext["requireAuthenticated"]>[0]) { return auth.authenticate(requestValue); },
    } as unknown as WorkbenchServerContext;
    const app = Fastify();
    await app.register(hostActionsRoutes, { context });
    await app.ready();
    try {
      const token = auth.issueHostBearer(SESSION_ID, ["host-actions:result"], { actionId, hostInstanceId: "host-1" });
      const response = await app.inject({ method: "POST", url: `/api/sessions/${SESSION_ID}/host-actions/${encodeURIComponent(actionId)}/result`, headers: { authorization: `Bearer ${token}` }, payload: storedResult });

      expect(response.statusCode).toBe(204);
      expect(readRecord).toHaveBeenCalledTimes(2);
      expect(enqueueActiveAttempt).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
});

function validOutcome(request: ReturnType<typeof multimodalRequest>) {
  return { kind: "worksheet_multimodal_response" as const, result: { contractVersion: "f5-multimodal-result-v3" as const, outputClassification: "confidential" as const, requestHash: request.requestHash, sessionId: SESSION_ID, revision: 4, inputRevision: 3, workbookContentHash: "a".repeat(64), worksheetName: "Analysis-A", tableId: "table-a", imageContentHash: request.image.contentHash, model: { modelId: "vision-model", supportsImage: true as const }, imageTableInterpretation: "Interpreted with the complete table.", rowMappings: [{ worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 11, factorOrdinal: request.factorRows[0]!.factorOrdinal, mappingStatus: "matched" as const, visibleStatus: "visible" as const, interpretation: "Ordinal A is visible." }] } };
}

function multimodalRequest() {
  const factorRows = [{ worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 11, factorOrdinal: { value: "A", rawText: "A", sourceCell: "Analysis-A!Z11" }, factorName: "Factor A1", partName: "Part A", partCategory: "CNC", drawingNumber: "DWG-A", dimId: "11", nominal: 11, upperTolerance: 0.1, lowerTolerance: -0.1, longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "normal", sourceCells: { factorName: "Analysis-A!A11" } }];
  const request = { contractVersion: "f5-multimodal-request-v3" as const, inputClassification: "confidential" as const, requestHash: "", sessionId: SESSION_ID, revision: 4, inputRevision: 3, workbook: { fileName: "anonymous.xlsx", contentHash: "a".repeat(64) }, worksheetName: "Analysis-A", tableId: "table-a", activeFactorCount: 1, factorSetHash: createF5MultimodalFactorSetHash(factorRows), image: { mediaType: "image/png" as const, contentHash: createHash("sha256").update(PNG_BYTES).digest("hex"), byteLength: PNG_BYTES.byteLength, artifactPath: "images/analysis-a.png" }, factorRows };
  request.requestHash = createF5MultimodalRequestHash(request);
  return request;
}
