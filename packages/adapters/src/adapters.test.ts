import { expect, it } from "vitest";
import { typedErrorSchema } from "@ai-assist/contracts";
import {
  CalculationAdapter,
  CalculationRequestV1,
  DenyAdapter,
  MockAdapter,
} from "./index.js";

it("denies every external action by default", async () => {
  await expect(new DenyAdapter().execute("network")).rejects.toMatchObject({
    code: "policy_denied",
  });

  await expect(new DenyAdapter().execute("network")).rejects.toSatisfy(
    (error: unknown) => typedErrorSchema.safeParse(error).success,
  );
});

it("returns only an explicitly configured mock response", async () => {
  const response = { id: "controlled-response" };
  await expect(new MockAdapter(response).execute("network")).resolves.toEqual(response);
});

it("reports F4 unavailable without accessing a workbook", async () => {
  const request = CalculationRequestV1.parse({
    contractVersion: "v1",
    methodId: "demo-method",
    inputs: { width: 12 },
  });

  await expect(new CalculationAdapter().calculate(request)).rejects.toMatchObject({
    code: "feature_not_available",
    featureId: "F4",
  });
});

it("returns a typed validation error before checking Calculation Worker availability", async () => {
  await expect(
    new CalculationAdapter().calculate({
      contractVersion: "v1",
      methodId: "",
      inputs: { width: "invalid" },
    } as unknown as CalculationRequestV1),
  ).rejects.toSatisfy((error: unknown) => {
    const parsed = typedErrorSchema.safeParse(error);
    return parsed.success && parsed.data.code === "validation_error";
  });
});

it("returns a complete typed contract when the Calculation Worker is unavailable", async () => {
  await expect(
    new CalculationAdapter().calculate({
      contractVersion: "v1",
      methodId: "demo-method",
      inputs: {},
    }),
  ).rejects.toSatisfy((error: unknown) => typedErrorSchema.safeParse(error).success);
});