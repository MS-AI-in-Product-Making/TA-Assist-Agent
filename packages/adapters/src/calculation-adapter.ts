import { z } from "zod";

export const CalculationRequestV1 = z.object({
  contractVersion: z.literal("v1"),
  methodId: z.string().min(1),
  inputs: z.record(z.string(), z.number()),
});

export const CalculationResultV1 = z.object({
  contractVersion: z.literal("v1"),
  methodId: z.string().min(1),
  values: z.record(z.string(), z.number()),
});

export type CalculationRequestV1 = z.infer<typeof CalculationRequestV1>;
export type CalculationResultV1 = z.infer<typeof CalculationResultV1>;

export interface CalculationAdapterError extends Error {
  readonly code: "feature_not_available";
  readonly featureId: "F4";
  readonly dependencies: readonly string[];
  readonly enablementRequirements: readonly string[];
}

export class CalculationAdapter {
  async calculate(request: CalculationRequestV1): Promise<never> {
    void request;
    throw Object.assign(new Error("Calculation Worker is not configured."), {
      code: "feature_not_available" as const,
      featureId: "F4" as const,
      dependencies: ["calculation-worker-v1"],
      enablementRequirements: ["approved-windows-excel-worker"],
    });
  }
}