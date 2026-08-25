import { describe, expect, it } from "vitest";

import { formatSseEvent } from "./sse.js";

describe("SSE sanitization", () => {
  it("removes control characters from event names and serializes data as JSON lines", () => {
    const event = formatSseEvent("stage\r\nevent", { text: "line1\nline2", secret: undefined });

    expect(event).toMatch(/^event: stageevent\n/);
    expect(event).toContain("data: ");
    expect(event).not.toContain("line1\nline2");
    expect(event.endsWith("\n\n")).toBe(true);
  });
});