import { createHash } from "node:crypto";
import { createF5MultimodalFactorSetHash, createF5MultimodalRequestHash } from "@ai-assist/contracts";
import { describe, expect, it, vi } from "vitest";

import { pumpOneHostAction, type HostActionTerminalResult } from "./host-action-pump.js";

const SESSION_ID = "30303030-3030-4303-8303-303030303030";

describe("pumpOneHostAction", () => {
  it("claims only a scoped action and submits one hashed terminal result", async () => {
    const action = { contractVersion: "f8-host-action-request-v1" as const, actionId: "action-a", sessionId: SESSION_ID, expectedRevision: 1, expiresAt: "2026-08-25T01:00:00.000Z", kind: "surface_validate" as const, confirmationHash: "a".repeat(64), expectedTargetVersion: "ado-decision-v1", prepareRequest: { mode: "create" as const, title: "TA Drawing Governance", nextContent: "next", factorCount: 1 } };
    const claim = vi.fn(async () => ({ actionId: action.actionId, request: action, hostInstanceId: "vscode-host", leaseId: "lease-a" }));
    const execute = vi.fn(async () => ({ status: "completed" as const }));
    const submitted: HostActionTerminalResult[] = [];
    const submit = vi.fn(async (result: HostActionTerminalResult) => { submitted.push(result); });

    await pumpOneHostAction({ sessionId: SESSION_ID, actionId: action.actionId }, { claim, execute, submit, hostInstanceId: "vscode-host" });

    expect(claim).toHaveBeenCalledWith(SESSION_ID, action.actionId, "vscode-host");
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ request: expect.objectContaining({ sessionId: SESSION_ID, kind: "surface_validate" }) }));
    const result = submitted[0];
    expect(result).toMatchObject({ actionId: "action-a", leaseId: "lease-a", hostInstanceId: "vscode-host", status: "completed", payload: { status: "completed" } });
    expect(result?.resultHash).toBe(createHash("sha256").update(JSON.stringify(result?.payload)).digest("hex"));
    expect(submit).toHaveBeenCalledOnce();
  });

  it("rejects a cross-session or unsupported action before execution", async () => {
    const execute = vi.fn();
    await expect(pumpOneHostAction({ sessionId: SESSION_ID, actionId: "action-b" }, {
      claim: async () => ({ actionId: "action-b", request: { contractVersion: "f8-host-action-request-v1", actionId: "action-b", sessionId: "other", expectedRevision: 1, expiresAt: "2026-08-25T01:00:00.000Z", kind: "vscode_model_request", confirmationHash: "a".repeat(64), expectedTargetVersion: "vscode-model-v1", turnId: "turn-b", prompt: "User request\nquestion\n\nGoverned evidence\n- Session: other\n\nOpen interpretation\n- Use only governed evidence.\n\nMissing evidence\n- None identified in the current governed context.\n\nSuggested checks\n- Confirm the current session binding." }, hostInstanceId: "vscode-host", leaseId: "lease-b" }),
      execute,
      submit: vi.fn(),
      hostInstanceId: "vscode-host",
    })).rejects.toThrow(/scope|unsupported/i);
    expect(execute).not.toHaveBeenCalled();
  });

  it("executes a separately confirmed Surface write action", async () => {
    const confirmation = { status: "confirmation_required" as const, workItemReference: "WI-1", ownerReference: "owner", commentReference: "C0", expectedVersion: "1", beforeContentHash: "b".repeat(64), nextContent: "next", factorCount: 1, confirmationHash: "a".repeat(64), diff: [{ before: "before", after: "next", changed: true }] };
    const request = { contractVersion: "f8-host-action-request-v1" as const, actionId: "write-a", sessionId: SESSION_ID, expectedRevision: 2, expiresAt: "2026-08-25T01:00:00.000Z", kind: "surface_write" as const, validationActionId: "validate-a", confirmationHash: confirmation.confirmationHash, expectedTargetVersion: "ado-decision-v1", confirmation };
    const execute = vi.fn(async () => ({ status: "completed" as const, outcome: { kind: "surface_write" as const, receipt: { status: "updated" as const, workItemReference: "WI-1", commentReference: "C0", version: "2", contentHash: "c".repeat(64) } } }));
    const submit = vi.fn(async () => undefined);
    await expect(pumpOneHostAction({ sessionId: SESSION_ID, actionId: request.actionId }, { hostInstanceId: "vscode-host", claim: async () => ({ actionId: request.actionId, request, hostInstanceId: "vscode-host", leaseId: "lease-write" }), execute, submit })).resolves.toBe("submitted");
    expect(execute).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();
  });

  it("supports a typed surface_reconcile action and submits its terminal result", async () => {
    const confirmation = { status: "confirmation_required" as const, workItemReference: "https://dev.azure.com/MSFTDEVICES/Project%20A/_workitems/edit/42", ownerReference: "owner", commentReference: "C0", expectedVersion: "1", beforeContentHash: "b".repeat(64), nextContent: "next", factorCount: 1, confirmationHash: "a".repeat(64), diff: [{ before: "before", after: "next", changed: true }] };
    const request = {
      contractVersion: "f8-host-action-request-v1" as const,
      actionId: "reconcile-a",
      sessionId: SESSION_ID,
      expectedRevision: 2,
      expiresAt: "2026-08-25T01:00:00.000Z",
      kind: "surface_reconcile" as const,
      writeActionId: "write-a",
      validationActionId: "validate-a",
      confirmationHash: confirmation.confirmationHash,
      expectedTargetVersion: "ado-decision-v1",
      previewIdentity: {
        targetIdentity: { organization: "MSFTDEVICES", project: "Project A", workItemId: 42 },
        previewHash: "c".repeat(64),
        previewMarker: "preview-marker:ado:session-1:3",
      },
      confirmation,
    };
    const execute = vi.fn(async () => ({
      status: "completed" as const,
      outcome: {
        kind: "surface_reconcile" as const,
        state: "absent" as const,
      },
    }));
    const submit = vi.fn(async () => undefined);

    await expect(
      pumpOneHostAction(
        { sessionId: SESSION_ID, actionId: request.actionId },
        { hostInstanceId: "vscode-host", claim: async () => ({ actionId: request.actionId, request, hostInstanceId: "vscode-host", leaseId: "lease-reconcile" }), execute, submit },
      ),
    ).resolves.toBe("submitted");
    expect(execute).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();
  });

  it("supports a typed worksheet multimodal action", async () => {
    const request = multimodalHostActionRequest();
    const execute = vi.fn(async () => ({ status: "blocked" as const, reason: "model_capability_unavailable" }));
    const submit = vi.fn(async () => undefined);

    await expect(pumpOneHostAction({ sessionId: SESSION_ID, actionId: request.actionId }, {
      hostInstanceId: "vscode-host",
      claim: async () => ({ actionId: request.actionId, request, hostInstanceId: "vscode-host", leaseId: "lease-multimodal" }),
      execute,
      submit,
    })).resolves.toBe("submitted");
    expect(execute).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ status: "blocked", payload: { status: "blocked", reason: "model_capability_unavailable" } }));
  });

  it("fails closed when a Surface action target version does not match the supported ADO contract", async () => {
    const execute = vi.fn();
    await expect(pumpOneHostAction({ sessionId: SESSION_ID, actionId: "action-c" }, {
      claim: async () => ({
        actionId: "action-c",
        request: {
          contractVersion: "f8-host-action-request-v1",
          actionId: "action-c",
          sessionId: SESSION_ID,
          expectedRevision: 1,
          expiresAt: "2026-08-25T01:00:00.000Z",
          kind: "surface_validate",
          confirmationHash: "a".repeat(64),
          expectedTargetVersion: "wrong-target-v1",
          prepareRequest: { mode: "create", title: "TA Drawing Governance", nextContent: "next", factorCount: 1 },
        },
        hostInstanceId: "vscode-host",
        leaseId: "lease-c",
      }),
      execute,
      submit: vi.fn(),
      hostInstanceId: "vscode-host",
    })).rejects.toThrow(/unsupported/i);
    expect(execute).not.toHaveBeenCalled();
  });
});

function multimodalHostActionRequest() {
  const factorRows = [{ worksheetName: "Analysis-A", tableId: "table-a", sourceRow: 11, factorOrdinal: { value: "A", rawText: "A", sourceCell: "Analysis-A!Z11" }, factorName: "Factor A", partName: "Part A", partCategory: "CNC", drawingNumber: null, dimId: null, nominal: 0, upperTolerance: 0.1, lowerTolerance: -0.1, longTermSafetyFactor: 1, sigmaLevel: 4, distribution: "normal", sourceCells: { factorName: "Analysis-A!A11" } }];
  const nested = { contractVersion: "f5-multimodal-request-v3" as const, inputClassification: "confidential" as const, requestHash: "", sessionId: SESSION_ID, revision: 1, inputRevision: 0, workbook: { fileName: "anonymous.xlsx", contentHash: "b".repeat(64) }, worksheetName: "Analysis-A", tableId: "table-a", activeFactorCount: 1, factorSetHash: createF5MultimodalFactorSetHash(factorRows), image: { mediaType: "image/png" as const, contentHash: "c".repeat(64), byteLength: 100, artifactPath: "images/analysis-a.png" }, factorRows };
  nested.requestHash = createF5MultimodalRequestHash(nested);
  return { contractVersion: "f8-host-action-request-v1" as const, actionId: `multimodal:${nested.requestHash}`, sessionId: SESSION_ID, expectedRevision: 1, expiresAt: "2026-08-25T01:00:00.000Z", kind: "vscode_worksheet_multimodal_request" as const, confirmationHash: nested.requestHash, expectedTargetVersion: "vscode-worksheet-multimodal-v3" as const, request: nested };
}
