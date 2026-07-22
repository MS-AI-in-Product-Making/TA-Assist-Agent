import { expect, it } from "vitest";
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