import { createHash } from "node:crypto";
import { hostActionRequestSchema, type F5MultimodalWorksheetResultV3 } from "@ai-assist/contracts";
import type { SurfaceMcpConfirmationPayload, SurfaceMcpUpdateReceipt } from "@ai-assist/adapters";

type BoundHostActionRequest = ReturnType<typeof hostActionRequestSchema.parse>;

export interface ClaimedHostAction {
  readonly actionId: string;
  readonly hostInstanceId: string;
  readonly leaseId: string;
  readonly request: BoundHostActionRequest;
}

export type HostExecutionPayload = { readonly status: "completed"; readonly outcome?: {
  readonly kind: "surface_validation";
  readonly confirmation: SurfaceMcpConfirmationPayload;
} | {
  readonly kind: "surface_write";
  readonly receipt: SurfaceMcpUpdateReceipt;
} | {
  readonly kind: "surface_reconcile";
  readonly state: "matching";
  readonly receipt: SurfaceMcpUpdateReceipt;
  readonly observedCommentReference: string;
  readonly observedCommentVersion: string;
} | {
  readonly kind: "surface_reconcile";
  readonly state: "absent";
} | {
  readonly kind: "model_response";
  readonly turnId: string;
  readonly responseText: string;
} | {
  readonly kind: "worksheet_multimodal_response";
  readonly result: F5MultimodalWorksheetResultV3;
} }
  | { readonly status: "blocked"; readonly reason?: string }
  | { readonly status: "failed"; readonly error: unknown };

export interface HostActionTerminalResult {
  readonly actionId: string;
  readonly hostInstanceId: string;
  readonly leaseId: string;
  readonly status: HostExecutionPayload["status"];
  readonly resultHash: string;
  readonly payload: HostExecutionPayload;
}

export interface HostActionPumpDependencies {
  readonly hostInstanceId: string;
  claim(sessionId: string, actionId: string, hostInstanceId: string): Promise<ClaimedHostAction | undefined>;
  execute(action: ClaimedHostAction): Promise<HostExecutionPayload>;
  submit(result: HostActionTerminalResult): Promise<void>;
}

export async function pumpOneHostAction(
  target: { readonly sessionId: string; readonly actionId: string },
  dependencies: HostActionPumpDependencies,
): Promise<"none" | "submitted"> {
  const claimed = await dependencies.claim(target.sessionId, target.actionId, dependencies.hostInstanceId);
  if (claimed === undefined) return "none";
  if (claimed.request.sessionId !== target.sessionId || claimed.actionId !== target.actionId || claimed.request.actionId !== target.actionId || claimed.hostInstanceId !== dependencies.hostInstanceId) {
    throw new Error("Host action scope does not match the claimed target.");
  }
  const supportedSurface = (claimed.request.kind === "surface_validate" || claimed.request.kind === "surface_write" || claimed.request.kind === "surface_reconcile") && claimed.request.expectedTargetVersion === "ado-decision-v1";
  const supportedModel = claimed.request.kind === "vscode_model_request" && claimed.request.expectedTargetVersion === "vscode-model-v1";
  const supportedMultimodal = claimed.request.kind === "vscode_worksheet_multimodal_request" && claimed.request.expectedTargetVersion === "vscode-worksheet-multimodal-v3";
  if (!supportedSurface && !supportedModel && !supportedMultimodal) {
    throw new Error("Host action kind or target version is unsupported.");
  }
  if (claimed.leaseId.length === 0 || !/^[a-f0-9]{64}$/.test(claimed.request.confirmationHash ?? "")) {
    throw new Error("Host action lease or confirmation binding is invalid.");
  }
  const payload = await dependencies.execute(claimed);
  const resultHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  await dependencies.submit({
    actionId: claimed.actionId,
    hostInstanceId: claimed.hostInstanceId,
    leaseId: claimed.leaseId,
    status: payload.status,
    resultHash,
    payload,
  });
  return "submitted";
}
