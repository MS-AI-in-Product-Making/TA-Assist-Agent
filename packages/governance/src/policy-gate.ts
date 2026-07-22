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

function parsePolicyRequest(request: unknown): PolicyRequest | undefined {
  try {
    if (typeof request !== "object" || request === null) {
      return undefined;
    }

    const { inputClassification, permission } = request as Record<string, unknown>;

    if (
      typeof inputClassification !== "string" ||
      !dataClassifications.has(inputClassification as DataClassification) ||
      typeof permission !== "string" ||
      !policyPermissions.has(permission as PolicyPermission)
    ) {
      return undefined;
    }

    return {
      inputClassification: inputClassification as DataClassification,
      permission: permission as PolicyPermission,
    };
  } catch {
    return undefined;
  }
}

export function evaluatePolicy(request: unknown): PolicyDecision {
  const policyRequest = parsePolicyRequest(request);

  if (policyRequest === undefined) {
    return { allowed: false, reason: "policy_denied" };
  }

  if (
    policyRequest.inputClassification === "public" &&
    policyRequest.permission === "read"
  ) {
    return { allowed: true };
  }

  return { allowed: false, reason: "policy_denied" };
}