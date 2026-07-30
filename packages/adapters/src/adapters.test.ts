import { expect, it } from "vitest";
import { typedErrorSchema } from "@ai-assist/contracts";
import { DenyAdapter, MockAdapter } from "./index.js";

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