import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createSessionStore } from "@ai-assist/workbench";

import { createSqliteEventSource, formatSseEvent } from "./sse.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((rootDir) => rm(rootDir, { recursive: true, force: true })));
});

describe("SSE sanitization", () => {
  it("removes control characters from event names and serializes data as JSON lines", () => {
    const event = formatSseEvent("stage\r\nevent", { text: "line1\nline2", secret: undefined });

    expect(event).toMatch(/^event: stageevent\n/);
    expect(event).toContain("data: ");
    expect(event).not.toContain("line1\nline2");
    expect(event.endsWith("\n\n")).toBe(true);
  });

  it("persists retained events and allocates unique monotonic IDs across restarts and publishers", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workbench-sse-"));
    tempRoots.push(rootDir);
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const session = await createSessionStore({ rootDir, sessionId });
    await session.close();

    const beforeRestart = await createSqliteEventSource({ rootDir, maxEventsPerSession: 2 });
    beforeRestart.publish(sessionId, "progress", { sequence: 1 });
    beforeRestart.publish(sessionId, "progress", { sequence: 2 });
    beforeRestart.close();

    const firstPublisher = await createSqliteEventSource({ rootDir, maxEventsPerSession: 2 });
    const secondPublisher = await createSqliteEventSource({ rootDir, maxEventsPerSession: 2 });
    await Promise.all([
      Promise.resolve().then(() => firstPublisher.publish(sessionId, "progress", { sequence: 3 })),
      Promise.resolve().then(() => secondPublisher.publish(sessionId, "progress", { sequence: 4 })),
    ]);

    const replay = secondPublisher.replay(sessionId, "1");
    expect(replay).toEqual([
      expect.objectContaining({ eventName: "replay_truncated", payload: { requestedAfter: 1, retainedFrom: 3 } }),
      expect.objectContaining({ id: "3", eventName: "progress", payload: { sequence: 3 } }),
      expect.objectContaining({ id: "4", eventName: "progress", payload: { sequence: 4 } }),
    ]);

    firstPublisher.close();
    secondPublisher.close();
  });
});