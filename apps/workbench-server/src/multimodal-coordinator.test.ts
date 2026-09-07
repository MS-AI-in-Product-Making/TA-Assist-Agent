import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { createF5MultimodalFactorSetHash, createF5MultimodalRequestHash } from "@ai-assist/contracts";
import type { F8SessionSnapshot } from "@ai-assist/workbench";
import { afterEach, describe, expect, it, vi } from "vitest";

import { assertF5MultimodalRunnerReference, materializeCompletedMultimodalArtifact, reconcileActiveMultimodalAttempt, type WorkbenchServerContext } from "./server.js";

const SESSION_ID = "91919191-9191-4191-8191-919191919191";
const roots: string[] = [];

afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("materializeCompletedMultimodalArtifact", () => {
  it("writes no artifact until every selected worksheet has one valid terminal result", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ta-multimodal-gate-"));
    roots.push(rootDir);
    const requests = [request("Analysis-B", "table-b", "B", 21), request("Analysis-A", "table-a", "A", 11)];
    const records = new Map([[`multimodal:${requests[0]!.requestHash}`, completedRecord(requests[0]!)]]);
    const context = {
      buildWorksheetInterpretationRequests: async () => requests,
      hostActions: { readRecord: async (_sessionId: string, actionId: string) => records.get(actionId) },
    } as unknown as Pick<WorkbenchServerContext, "buildWorksheetInterpretationRequests" | "hostActions">;

    await expect(materializeCompletedMultimodalArtifact(rootDir, snapshot(), context)).resolves.toBe(false);
    expect(await readdir(rootDir)).toEqual([]);

    records.set(`multimodal:${requests[1]!.requestHash}`, completedRecord(requests[1]!));
    await expect(materializeCompletedMultimodalArtifact(rootDir, snapshot(), context)).resolves.toBe(true);
    const files = (await readdir(join(rootDir, "runtime", "workbench", "multimodal", SESSION_ID, "7"))).filter((name) => name.endsWith(".json"));
    expect(files).toHaveLength(1);
    const artifact = JSON.parse(await readFile(join(rootDir, "runtime", "workbench", "multimodal", SESSION_ID, "7", files[0]!), "utf8"));
    expect(artifact.selectedWorksheetNames).toEqual(["Analysis-B", "Analysis-A"]);
    expect(artifact.worksheets.map((pair: { request: { worksheetName: string } }) => pair.request.worksheetName)).toEqual(["Analysis-B", "Analysis-A"]);

    const registry = JSON.parse(await readFile(join(rootDir, "runtime", "workbench", "registries", "multimodal-artifacts", `${SESSION_ID}.json`), "utf8"));
    const relativePath = relative(rootDir, registry.path);
    expect(() => assertF5MultimodalRunnerReference(rootDir, snapshot(), [{ artifactId: "f5-multimodal:3", kind: "f5_multimodal", relativePath, contentHash: "f".repeat(64) }])).toThrow(/server-owned aggregate/i);
    expect(() => assertF5MultimodalRunnerReference(rootDir, snapshot(), [{ artifactId: "f5-multimodal:3", kind: "f5_multimodal", relativePath, contentHash: registry.contentHash }])).not.toThrow();
  });

  it("replays a persisted terminal failure instead of starting the F5 runner", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ta-multimodal-recovery-"));
    roots.push(rootDir);
    const requestValue = request("Analysis-A", "table-a", "A", 11);
    const failActiveMultimodalAttempt = vi.fn(async () => undefined);
    const actionRequest = completedRecord(requestValue).request;
    const context = {
      buildWorksheetInterpretationRequests: async () => [requestValue],
      hostActions: {
        readRecord: async () => ({
          status: "blocked",
          request: actionRequest,
          result: { payload: { status: "blocked", reason: "model_capability_unavailable" } },
        }),
      },
      failActiveMultimodalAttempt,
    } as unknown as Pick<WorkbenchServerContext, "buildWorksheetInterpretationRequests" | "hostActions" | "failActiveMultimodalAttempt">;

    await expect(reconcileActiveMultimodalAttempt(rootDir, snapshot(), context)).resolves.toBe(false);
    expect(failActiveMultimodalAttempt).toHaveBeenCalledWith(snapshot(), "model_capability_unavailable");
  });

  it("keeps F5 waiting while a required HostAction is pending", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ta-multimodal-pending-"));
    roots.push(rootDir);
    const requestValue = request("Analysis-A", "table-a", "A", 11);
    const failActiveMultimodalAttempt = vi.fn();
    const context = {
      buildWorksheetInterpretationRequests: async () => [requestValue],
      hostActions: { readRecord: async () => ({ status: "pending", request: completedRecord(requestValue).request }) },
      failActiveMultimodalAttempt,
    } as unknown as Pick<WorkbenchServerContext, "buildWorksheetInterpretationRequests" | "hostActions" | "failActiveMultimodalAttempt">;

    await expect(reconcileActiveMultimodalAttempt(rootDir, snapshot(), context)).resolves.toBe(false);
    expect(failActiveMultimodalAttempt).not.toHaveBeenCalled();
  });
});

function snapshot(): F8SessionSnapshot {
  return { contractVersion: "f8-session-snapshot-v1", sessionId: SESSION_ID, revision: 7, inputRevision: 3, state: "f5_running", activeAttempt: { attemptId: "attempt-f5", stage: "f5_running", status: "running", startedAt: "2026-09-07T00:00:00.000Z" }, priorRunReferences: [] };
}

function request(worksheetName: string, tableId: string, ordinal: string, sourceRow: number) {
  const factorRows = [{ worksheetName, tableId, sourceRow, factorOrdinal: { value: ordinal, rawText: ordinal, sourceCell: `${worksheetName}!Z${sourceRow}` }, factorName: `Factor ${ordinal}`, partName: `Part ${ordinal}`, partCategory: "CNC", drawingNumber: null, dimId: null, nominal: sourceRow, upperTolerance: 0.1, lowerTolerance: -0.1, longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "normal", sourceCells: { factorName: `${worksheetName}!A${sourceRow}` } }];
  const value = { contractVersion: "f5-multimodal-request-v3" as const, inputClassification: "confidential" as const, requestHash: "", sessionId: SESSION_ID, revision: 7, inputRevision: 3, workbook: { fileName: "anonymous.xlsx", contentHash: "a".repeat(64) }, worksheetName, tableId, activeFactorCount: 1, factorSetHash: createF5MultimodalFactorSetHash(factorRows), image: { mediaType: "image/png" as const, contentHash: createHash("sha256").update(worksheetName).digest("hex"), byteLength: 100, artifactPath: `images/${worksheetName}.png` }, factorRows };
  value.requestHash = createF5MultimodalRequestHash(value);
  return value;
}

function completedRecord(requestValue: ReturnType<typeof request>) {
  const actionId = `multimodal:${requestValue.requestHash}`;
  const request = { contractVersion: "f8-host-action-request-v1" as const, actionId, sessionId: SESSION_ID, expectedRevision: 7, expiresAt: "2026-09-08T00:00:00.000Z", kind: "vscode_worksheet_multimodal_request" as const, confirmationHash: requestValue.requestHash, expectedTargetVersion: "vscode-worksheet-multimodal-v3" as const, request: requestValue };
  const result = { contractVersion: "f5-multimodal-result-v3" as const, outputClassification: "confidential" as const, requestHash: requestValue.requestHash, sessionId: SESSION_ID, revision: 7, inputRevision: 3, workbookContentHash: "a".repeat(64), worksheetName: requestValue.worksheetName, tableId: requestValue.tableId, imageContentHash: requestValue.image.contentHash, model: { modelId: "vision-model", supportsImage: true as const }, imageTableInterpretation: "Image and complete table interpreted.", rowMappings: requestValue.factorRows.map((row) => ({ worksheetName: row.worksheetName, tableId: row.tableId, sourceRow: row.sourceRow, factorOrdinal: row.factorOrdinal, mappingStatus: "matched" as const, visibleStatus: "visible" as const, interpretation: `${row.factorOrdinal.value} is visible.` })) };
  return { actionId, sessionId: SESSION_ID, status: "completed", request, result: { payload: { status: "completed", outcome: { kind: "worksheet_multimodal_response", result } } } } as never;
}
