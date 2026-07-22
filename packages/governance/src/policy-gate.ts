import type { DataClassification } from "@ai-assist/contracts";

export type PolicyPermission = "persist" | "network" | "adapter" | "read";

export interface PolicyRequest {
  inputClassification: DataClassification;
  permission: PolicyPermission;
}

export type PolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: "policy_denied" };

const dataClassifications = new Set<DataClassification>([
  "public",
  "internal",
  "confidential",
  "secret",
]);

const policyPermissions = new Set<PolicyPermission>([
  "persist",
  "network",
  "adapter",
  "read",
]);

function isPolicyRequest(request: unknown): request is PolicyRequest {
  if (typeof request !== "object" || request === null) {
    return false;
  }

  const { inputClassification, permission } = request as Record<string, unknown>;

  return (
    typeof inputClassification === "string" &&
    dataClassifications.has(inputClassification as DataClassification) &&
    typeof permission === "string" &&
    policyPermissions.has(permission as PolicyPermission)
  );
}

export function evaluatePolicy(request: unknown): PolicyDecision {
  if (!isPolicyRequest(request)) {
    return { allowed: false, reason: "policy_denied" };
  }

  if (
    request.inputClassification === "public" &&
    request.permission === "read"
  ) {
    return { allowed: true };
  }

  return { allowed: false, reason: "policy_denied" };
}