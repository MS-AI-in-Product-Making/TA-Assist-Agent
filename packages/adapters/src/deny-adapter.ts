import { createTypedError, type TypedError } from "@ai-assist/contracts";

export interface DeniedAdapterError extends Error, TypedError {
  readonly code: "policy_denied";
}

export class DenyAdapter {
  async execute(action: string): Promise<never> {
    void action;
    throw createTypedError({
      code: "policy_denied",
      summary: "External actions are denied by policy.",
      suggestedAction: "Use an explicitly authorized adapter capability.",
      affectedInputReferences: [],
    });
  }
}