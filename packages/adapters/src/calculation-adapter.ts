import { createTypedError, type TypedError } from "@ai-assist/contracts";
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

export interface CalculationAdapterError extends Error, TypedError {
  readonly code: "feature_not_available";
  readonly featureId: "F4";
  readonly dependencies: readonly string[];
  readonly enablementRequirements: readonly string[];
}

export class CalculationAdapter {
  async calculate(request: unknown): Promise<never> {
    if (!CalculationRequestV1.safeParse(request).success) {
      throw createTypedError({
        code: "validation_error",
        summary: "Calculation request does not match CalculationRequestV1.",
        suggestedAction: "Provide a valid CalculationRequestV1 payload.",
        affectedInputReferences: [],
      });
    }

    throw createTypedError({
      code: "feature_not_available",
      summary: "Calculation Worker is not configured.",
      suggestedAction: "Configure the approved Windows Excel Worker.",
      affectedInputReferences: [],
      details: {
        featureId: "F4",
        dependencies: ["calculation-worker-v1"],
        enablementRequirements: ["approved-windows-excel-worker"],
      },
    });
  }
}