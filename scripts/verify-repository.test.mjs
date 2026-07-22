import { describe, expect, it } from "vitest";
import { isForbiddenRepositoryPath } from "./verify-repository.mjs";

describe("isForbiddenRepositoryPath", () => {
  it.each([".env", "runtime/projects/a/run.json", "sample.xlsx", "sample.xlsm"])(
    "rejects %s",
    (path) => expect(isForbiddenRepositoryPath(path)).toBe(true),
  );
  it("allows public fixtures", () => {
    expect(isForbiddenRepositoryPath("fixtures/public/smoke-request.json")).toBe(false);
  });
});