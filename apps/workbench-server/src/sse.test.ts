import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createSessionStore as createSessionStoreBase } from "@ai-assist/workbench";

import { createSqliteEventSource, formatSseEvent } from "./sse.js";

const tempRoots: string[] = [];
const ENGLISH_LOCK = { languageTag: "en-US", uiCatalogLanguage: "en", lockedAtTurnId: "turn-en", source: "workflow_start", fallbackUsed: false } as const;
const REQUEST_CONTEXT = { requestedAt: "2026-09-16T08:00:00.000Z", utcOffsetMinutes: 0, source: "web" } as const;

function createSessionStore(options: Omit<Parameters<typeof createSessionStoreBase>[0], "interactionLanguage">) {
  return createSessionStoreBase({ ...options, interactionLanguage: ENGLISH_LOCK, analysisRequestContext: options.analysisRequestContext ?? REQUEST_CONTEXT });
}

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

  it("delivers an event published between replay and subscription exactly once", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workbench-sse-"));
    tempRoots.push(rootDir);
    const sessionId = "22222222-2222-4222-8222-222222222222";
    const session = await createSessionStore({ rootDir, sessionId });
    await session.close();
    const source = await createSqliteEventSource({ rootDir, pollIntervalMs: 5 });
    source.publish(sessionId, "progress", { sequence: 1 });

    const replay = source.replay(sessionId, "0");
    source.publish(sessionId, "progress", { sequence: 2 });
    const received: string[] = [];
    const unsubscribe = source.subscribe(sessionId, (event) => received.push(event.id), replay.at(-1)?.id);

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect([...replay.map((event) => event.id), ...received]).toEqual(["1", "2"]);
    unsubscribe();
    source.close();
  });

  it("emits truncation instead of losing events when retention rolls between replay and subscription", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workbench-sse-"));
    tempRoots.push(rootDir);
    const sessionId = "33333333-3333-4333-8333-333333333333";
    const session = await createSessionStore({ rootDir, sessionId });
    await session.close();
    const source = await createSqliteEventSource({ rootDir, maxEventsPerSession: 2, pollIntervalMs: 5 });
    source.publish(sessionId, "progress", { sequence: 1 });
    const initialReplay = source.replay(sessionId, "0");
    source.publish(sessionId, "progress", { sequence: 2 });
    source.publish(sessionId, "progress", { sequence: 3 });
    source.publish(sessionId, "progress", { sequence: 4 });
    const received: Array<{ readonly id: string; readonly eventName: string }> = [];
    const unsubscribe = source.subscribe(sessionId, (event) => received.push({ id: event.id, eventName: event.eventName }), initialReplay.at(-1)?.id);

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(received).toEqual([
      { id: "2", eventName: "replay_truncated" },
      { id: "3", eventName: "progress" },
      { id: "4", eventName: "progress" },
    ]);
    unsubscribe();
    source.close();
  });
});