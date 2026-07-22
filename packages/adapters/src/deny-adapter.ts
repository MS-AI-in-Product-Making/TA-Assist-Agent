export interface DeniedAdapterError extends Error {
  readonly code: "policy_denied";
}

export class DenyAdapter {
  async execute(action: string): Promise<never> {
    void action;
    throw Object.assign(new Error("External actions are denied by policy."), {
      code: "policy_denied" as const,
    });
  }
}