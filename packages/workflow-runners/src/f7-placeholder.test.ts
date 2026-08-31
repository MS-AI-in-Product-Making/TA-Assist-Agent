import { describe, expect, it, vi } from "vitest";

import { getF7PlaceholderStatus } from "./index.js";

describe("getF7PlaceholderStatus", () => {
  it("returns F7 unavailable and never calls a runner", async () => {
    const execute = vi.fn();

    expect(await getF7PlaceholderStatus({ execute })).toMatchObject({ status: "feature_not_available" });
    expect(execute).not.toHaveBeenCalled();
  });
});