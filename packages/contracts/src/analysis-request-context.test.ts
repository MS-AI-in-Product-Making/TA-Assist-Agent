import { describe, expect, it } from "vitest";

import { analysisRequestContextSchema } from "./index.js";

describe("analysis request context contract", () => {
  it("accepts requester instants and UTC offset boundaries", () => {
    expect(analysisRequestContextSchema.parse({
      requestedAt: "2026-09-16T15:30:12.000Z",
      utcOffsetMinutes: -420,
      source: "web",
    })).toEqual(expect.objectContaining({ utcOffsetMinutes: -420 }));

    expect(analysisRequestContextSchema.safeParse({
      requestedAt: "2026-09-16T15:30:12.000Z",
      utcOffsetMinutes: 841,
      source: "web",
    }).success).toBe(false);
  });

  it("rejects unknown fields and invalid instants", () => {
    expect(analysisRequestContextSchema.safeParse({
      requestedAt: "local morning",
      utcOffsetMinutes: 0,
      source: "cli",
      locale: "en-US",
    }).success).toBe(false);
  });
});