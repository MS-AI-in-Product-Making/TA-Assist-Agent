import { createHash } from "node:crypto";
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
