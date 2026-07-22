import type { DataClassification } from "@ai-assist/contracts";

export type PolicyPermission = "persist" | "network" | "adapter" | "read";

export interface PolicyRequest {
  inputClassification: DataClassification;
  permission: PolicyPermission;
}

export type PolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: "policy_denied" };

export function evaluatePolicy(request: PolicyRequest): PolicyDecision {
  if (
    request.inputClassification === "public" &&
    request.permission === "read"
  ) {
    return { allowed: true };
  }

  return { allowed: false, reason: "policy_denied" };
}