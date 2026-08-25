import { mkdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import { resolveManagedWorkbenchPaths } from "@ai-assist/workbench";

export interface StoredSseEvent {
  readonly id: string;
  readonly eventName: string;
  readonly payload: unknown;
}

export interface SqliteEventSource {
  publish(sessionId: string, eventName: string, payload: unknown): void;
  replay(sessionId: string, afterEventId: string | undefined): readonly StoredSseEvent[];
  subscribe(sessionId: string, listener: (event: StoredSseEvent) => void): () => void;
  close(): void;
}

export interface SqliteEventSourceOptions {
  readonly rootDir: string;
  readonly maxEventsPerSession?: number;
  readonly pollIntervalMs?: number;
}

interface Subscriber {
  readonly listener: (event: StoredSseEvent) => void;
  lastEventId: number;
}

export async function createSqliteEventSource(options: SqliteEventSourceOptions): Promise<SqliteEventSource> {
  const paths = resolveManagedWorkbenchPaths(options.rootDir);
  await mkdir(paths.workbenchRoot, { recursive: true });
  const database = new DatabaseSync(paths.databasePath, { timeout: 5_000 });
  try {
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA synchronous = FULL;");
    database.exec(`
      CREATE TABLE IF NOT EXISTS session_sse_sequences (
        session_id TEXT PRIMARY KEY,
        next_event_id INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS session_sse_events (
        session_id TEXT NOT NULL,
        event_id INTEGER NOT NULL,
        event_name TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(session_id, event_id)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS session_sse_events_retention
        ON session_sse_events(session_id, event_id DESC);
    `);
    return new SqliteSseEventSource(database, options);
  } catch (error) {
    database.close();
    throw error;
  }
}

class SqliteSseEventSource implements SqliteEventSource {
  private readonly subscribers = new Map<string, Set<Subscriber>>();

  private readonly poller: NodeJS.Timeout;

  private readonly maxEventsPerSession: number;

  constructor(private readonly database: DatabaseSync, options: SqliteEventSourceOptions) {
    this.maxEventsPerSession = options.maxEventsPerSession ?? 256;
    this.poller = setInterval(() => this.pollSubscribers(), options.pollIntervalMs ?? 50);
    this.poller.unref();
  }

  publish(sessionId: string, eventName: string, payload: unknown): void {
    const payloadJson = JSON.stringify(payload);
    if (payloadJson === undefined) throw new TypeError("SSE payload must be JSON serializable.");
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const sequence = this.database.prepare(`
        INSERT INTO session_sse_sequences(session_id, next_event_id)
        VALUES (?, 2)
        ON CONFLICT(session_id) DO UPDATE SET next_event_id = next_event_id + 1
        RETURNING next_event_id - 1 AS event_id
      `).get(sessionId) as { event_id: number };
      const event: StoredSseEvent = { id: String(sequence.event_id), eventName, payload: JSON.parse(payloadJson) };
      this.database.prepare(`
        INSERT INTO session_sse_events(session_id, event_id, event_name, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, sequence.event_id, eventName, payloadJson, new Date().toISOString());
      this.database.prepare(`
        DELETE FROM session_sse_events
        WHERE session_id = ? AND event_id IN (
          SELECT event_id FROM session_sse_events
          WHERE session_id = ?
          ORDER BY event_id DESC
          LIMIT -1 OFFSET ?
        )
      `).run(sessionId, sessionId, this.maxEventsPerSession);
      this.database.exec("COMMIT");
      this.deliver(sessionId, event);
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  replay(sessionId: string, afterEventId: string | undefined): readonly StoredSseEvent[] {
    const events = this.readEvents(sessionId, 0);
    const afterId = Number(afterEventId ?? 0);
    if (afterEventId !== undefined && (!Number.isSafeInteger(afterId) || afterId < 0)) {
      return [{ id: "0", eventName: "replay_truncated", payload: { reason: "invalid_last_event_id" } }, ...events];
    }
    const firstRetainedId = Number(events[0]?.id ?? 0);
    const replay = events.filter((event) => Number(event.id) > afterId);
    if (afterEventId !== undefined && firstRetainedId > 0 && afterId < firstRetainedId - 1) {
      return [{ id: String(firstRetainedId - 1), eventName: "replay_truncated", payload: { requestedAfter: afterId, retainedFrom: firstRetainedId } }, ...replay];
    }
    return replay;
  }

  subscribe(sessionId: string, listener: (event: StoredSseEvent) => void): () => void {
    const subscribers = this.subscribers.get(sessionId) ?? new Set<Subscriber>();
    const latest = this.database.prepare("SELECT COALESCE(MAX(event_id), 0) AS event_id FROM session_sse_events WHERE session_id = ?").get(sessionId) as { event_id: number };
    const subscriber: Subscriber = { listener, lastEventId: latest.event_id };
    subscribers.add(subscriber);
    this.subscribers.set(sessionId, subscribers);
    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) this.subscribers.delete(sessionId);
    };
  }

  close(): void {
    clearInterval(this.poller);
    this.subscribers.clear();
    if (this.database.isOpen) this.database.close();
  }

  private pollSubscribers(): void {
    for (const [sessionId, subscribers] of this.subscribers) {
      for (const subscriber of subscribers) {
        for (const event of this.readEvents(sessionId, subscriber.lastEventId)) {
          this.deliverToSubscriber(subscriber, event);
        }
      }
    }
  }

  private readEvents(sessionId: string, afterEventId: number): StoredSseEvent[] {
    const rows = this.database.prepare(`
      SELECT event_id, event_name, payload_json
      FROM session_sse_events
      WHERE session_id = ? AND event_id > ?
      ORDER BY event_id ASC
    `).all(sessionId, afterEventId) as Array<{ event_id: number; event_name: string; payload_json: string }>;
    return rows.map((row) => ({ id: String(row.event_id), eventName: row.event_name, payload: JSON.parse(row.payload_json) }));
  }

  private deliver(sessionId: string, event: StoredSseEvent): void {
    for (const subscriber of this.subscribers.get(sessionId) ?? []) this.deliverToSubscriber(subscriber, event);
  }

  private deliverToSubscriber(subscriber: Subscriber, event: StoredSseEvent): void {
    const eventId = Number(event.id);
    if (eventId <= subscriber.lastEventId) return;
    subscriber.lastEventId = eventId;
    subscriber.listener(event);
  }

  private rollback(): void {
    try {
      this.database.exec("ROLLBACK");
    } catch {
      // The transaction either committed or could not be opened.
    }
  }
}

export function formatSseEvent(eventName: string, data: unknown, eventId?: string): string {
  const sanitizedEventName = eventName.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 128) || "message";
  const sanitizedEventId = eventId?.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 128);
  const payload = JSON.stringify(data, (_key, value: unknown) => value === undefined ? null : value);
  return `${sanitizedEventId === undefined ? "" : `id: ${sanitizedEventId}\n`}event: ${sanitizedEventName}\ndata: ${payload}\n\n`;
}

export function sanitizeSsePayload(data: unknown): unknown {
  return JSON.parse(JSON.stringify(data, (_key, value: unknown) => {
    if (typeof value === "string") {
      return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
    }

    return value === undefined ? null : value;
  }));
}