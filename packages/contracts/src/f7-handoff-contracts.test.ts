import { describe, expect, it } from "vitest";
import { f7PlaceholderStatusSchema } from "./index.js";

describe("F7 placeholder contracts", () => {
  it("keeps F7 unavailable without a result payload", () => {
    expect(f7PlaceholderStatusSchema.parse({
      contractVersion: "f7-workbench-placeholder-v1",
      status: "feature_not_available",
      lifecycle: "in_development",
    })).toBeDefined();

    expect(() => f7PlaceholderStatusSchema.parse({
      contractVersion: "f7-workbench-placeholder-v1",
      status: "completed",
      measuredCpk: 1.2,
    })).toThrow();
  });
});