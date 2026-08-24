import { mkdir } from "node:fs/promises";
import { DatabaseSync, StatementSync } from "node:sqlite";

import {
  createTypedError,
  f8ScenarioDraftSchema,
  f8SessionCommandSchema,
  f8SessionEventSchema,
  f8SessionSnapshotSchema,
} from "@ai-assist/contracts";

import { resolveManagedWorkbenchPaths } from "./managed-paths.js";

type F8ScenarioDraft = ReturnType<typeof f8ScenarioDraftSchema.parse>;
type F8SessionCommand = ReturnType<typeof f8SessionCommandSchema.parse>;
type F8SessionEvent = ReturnType<typeof f8SessionEventSchema.parse>;
type F8SessionSnapshot = ReturnType<typeof f8SessionSnapshotSchema.parse>;

type StageAttempt = NonNullable<F8SessionSnapshot["activeAttempt"]>;

export interface SessionStoreTestHooks {
  readonly afterCommandInsert?: () => void;
  readonly afterSnapshotUpdate?: () => void;
  readonly afterResultUpdate?: () => void;
}

export interface SessionStoreOptions {
  readonly rootDir: string;
  readonly sessionId: string;
  readonly testHooks?: SessionStoreTestHooks;
}

export interface SessionArtifactReference {
  readonly artifactId: string;
  readonly sessionId: string;
  readonly inputRevision: number;
  readonly kind: string;
  readonly relativePath: string;
  readonly contentHash?: string;
  readonly manifestHash?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface SessionHostActionRecord {
  readonly actionId: string;
  readonly sessionId: string;
  readonly status: "pending" | "claimed" | "completed" | "blocked" | "failed";
  readonly request?: unknown;
  readonly claim?: unknown;
  readonly result?: unknown;
  readonly expiresAt?: string;
  readonly leaseId?: string;
  readonly leaseExpiresAt?: string;
  readonly expectedRevision?: number;
  readonly confirmationHash?: string;
  readonly expectedTargetVersion?: string;
}

export interface SessionCommandMutation {
  readonly snapshot: F8SessionSnapshot;
  readonly events?: readonly F8SessionEvent[];
  readonly artifactReferences?: readonly SessionArtifactReference[];
  readonly scenarioDrafts?: readonly F8ScenarioDraft[];
  readonly hostActions?: readonly SessionHostActionRecord[];
}

export type SessionCommandReducer = (
  snapshot: F8SessionSnapshot,
  command: F8SessionCommand,
) => SessionCommandMutation | Promise<SessionCommandMutation>;

export interface SessionAttemptResultRecord {
  readonly attemptId: string;
  readonly status?: "completed" | "failed" | "cancelled";
  readonly result: unknown;
  readonly snapshot?: F8SessionSnapshot;
  readonly events?: readonly F8SessionEvent[];
  readonly runReference?: string;
  readonly manifestHash?: string;
  readonly artifactReferences?: readonly SessionArtifactReference[];
  readonly scenarioDrafts?: readonly F8ScenarioDraft[];
  readonly hostActions?: readonly SessionHostActionRecord[];
  readonly endedAt?: string;
}

export interface SessionAttemptResultReceipt {
  readonly accepted: boolean;
  readonly snapshot: F8SessionSnapshot;
}

export interface SessionStore {
  readSnapshot(): Promise<F8SessionSnapshot>;
  readCommandReceipt(commandId: string): Promise<F8SessionSnapshot | null>;
  applyCommand(command: F8SessionCommand, reducer: SessionCommandReducer): Promise<F8SessionSnapshot>;
  recordAttemptResult(result: SessionAttemptResultRecord): Promise<SessionAttemptResultReceipt>;
  close(): Promise<void>;
}

interface SessionRow {
  readonly revision: number;
  readonly snapshot_json: string;
}

interface CommandRow {
  readonly command_json: string;
  readonly result_json: string | null;
}

const CREATE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS commands (
  command_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  expected_revision INTEGER NOT NULL,
  command_json TEXT NOT NULL,
  result_json TEXT,
  committed_revision INTEGER,
  created_at TEXT NOT NULL,
  committed_at TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  kind TEXT NOT NULL,
  event_json TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS events_by_session_revision ON events(session_id, revision, created_at);

CREATE TABLE IF NOT EXISTS stage_attempts (
  attempt_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  command_id TEXT,
  run_reference TEXT,
  manifest_hash TEXT,
  artifact_refs_json TEXT,
  result_json TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS stage_attempts_by_session ON stage_attempts(session_id, started_at);

CREATE TABLE IF NOT EXISTS artifact_refs (
  artifact_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  input_revision INTEGER NOT NULL,
  kind TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  content_hash TEXT,
  manifest_hash TEXT,
  metadata_json TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS scenario_drafts (
  draft_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  draft_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS host_actions (
  action_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  request_json TEXT,
  claim_json TEXT,
  result_json TEXT,
  expires_at TEXT,
  lease_id TEXT,
  lease_expires_at TEXT,
  expected_revision INTEGER,
  confirmation_hash TEXT,
  expected_target_version TEXT,
  updated_at TEXT NOT NULL
) STRICT;
`;

export async function createSessionStore(options: SessionStoreOptions): Promise<SessionStore> {
  const store = await initializeStore(options);
  try {
    store.createSession();
    return store;
  } catch (error) {
    await store.close();
    throw error;
  }
}

export async function openSessionStore(options: SessionStoreOptions): Promise<SessionStore> {
  const store = await initializeStore(options);
  try {
    store.assertSessionExists();
    return store;
  } catch (error) {
    await store.close();
    throw error;
  }
}

async function initializeStore(options: SessionStoreOptions): Promise<SqliteSessionStore> {
  const paths = resolveManagedWorkbenchPaths(options.rootDir);
  await mkdir(paths.workbenchRoot, { recursive: true });

  const database = new DatabaseSync(paths.databasePath, {
    enableForeignKeyConstraints: true,
    timeout: 5_000,
  });

  try {
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA synchronous = FULL;");
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec(CREATE_SCHEMA_SQL);
  } catch (error) {
    database.close();
    throw error;
  }

  return new SqliteSessionStore(database, options.sessionId, options.testHooks);
}

class SqliteSessionStore implements SessionStore {
  private readonly selectSessionStatement;

  private readonly insertSessionStatement;

  private readonly selectCommandStatement;

  private readonly insertCommandStatement;

  private readonly updateSessionStatement;

  private readonly updateCommandResultStatement;

  private readonly insertEventStatement;

  private readonly upsertStageAttemptStatement;

  private readonly updateStageAttemptResultStatement;

  private readonly deleteScenarioDraftsStatement;

  private readonly insertScenarioDraftStatement;

  private readonly deleteArtifactRefsStatement;

  private readonly insertArtifactRefStatement;

  private readonly deleteHostActionsStatement;

  private readonly insertHostActionStatement;

  constructor(
    private readonly database: DatabaseSync,
    private readonly sessionId: string,
    private readonly testHooks: SessionStoreTestHooks | undefined,
  ) {
    this.selectSessionStatement = this.database.prepare(`
      SELECT revision, snapshot_json
      FROM sessions
      WHERE session_id = ?
    `);
    this.insertSessionStatement = this.database.prepare(`
      INSERT INTO sessions(session_id, revision, snapshot_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    this.selectCommandStatement = this.database.prepare(`
      SELECT command_json, result_json
      FROM commands
      WHERE command_id = ?
    `);
    this.insertCommandStatement = this.database.prepare(`
      INSERT INTO commands(command_id, session_id, expected_revision, command_json, result_json, committed_revision, created_at, committed_at)
      VALUES (?, ?, ?, ?, NULL, NULL, ?, NULL)
    `);
    this.updateSessionStatement = this.database.prepare(`
      UPDATE sessions
      SET revision = ?, snapshot_json = ?, updated_at = ?
      WHERE session_id = ? AND revision = ?
    `);
    this.updateCommandResultStatement = this.database.prepare(`
      UPDATE commands
      SET result_json = ?, committed_revision = ?, committed_at = ?
      WHERE command_id = ?
    `);
    this.insertEventStatement = this.database.prepare(`
      INSERT INTO events(event_id, session_id, revision, kind, event_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.upsertStageAttemptStatement = this.database.prepare(`
      INSERT INTO stage_attempts(
        attempt_id,
        session_id,
        stage,
        status,
        command_id,
        run_reference,
        manifest_hash,
        artifact_refs_json,
        result_json,
        started_at,
        ended_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(attempt_id) DO UPDATE SET
        stage = excluded.stage,
        status = excluded.status,
        command_id = excluded.command_id,
        run_reference = excluded.run_reference,
        manifest_hash = excluded.manifest_hash,
        artifact_refs_json = excluded.artifact_refs_json,
        result_json = excluded.result_json,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at
    `);
    this.updateStageAttemptResultStatement = this.database.prepare(`
      UPDATE stage_attempts
      SET status = ?, run_reference = ?, manifest_hash = ?, artifact_refs_json = ?, result_json = ?, ended_at = ?
      WHERE attempt_id = ? AND session_id = ?
    `);
    this.deleteScenarioDraftsStatement = this.database.prepare("DELETE FROM scenario_drafts WHERE session_id = ?");
    this.insertScenarioDraftStatement = this.database.prepare(`
      INSERT INTO scenario_drafts(draft_id, session_id, draft_json, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    this.deleteArtifactRefsStatement = this.database.prepare("DELETE FROM artifact_refs WHERE session_id = ?");
    this.insertArtifactRefStatement = this.database.prepare(`
      INSERT INTO artifact_refs(artifact_id, session_id, input_revision, kind, relative_path, content_hash, manifest_hash, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.deleteHostActionsStatement = this.database.prepare("DELETE FROM host_actions WHERE session_id = ?");
    this.insertHostActionStatement = this.database.prepare(`
      INSERT INTO host_actions(
        action_id,
        session_id,
        status,
        request_json,
        claim_json,
        result_json,
        expires_at,
        lease_id,
        lease_expires_at,
        expected_revision,
        confirmation_hash,
        expected_target_version,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  createSession(): void {
    if (this.readSessionRow() !== undefined) {
      throw createTypedError({
        code: "validation_error",
        summary: `Session ${this.sessionId} already exists.`,
        suggestedAction: "Open the existing session instead of creating it again.",
        affectedInputReferences: [this.sessionId],
      });
    }

    const now = new Date().toISOString();
    const snapshot = createInitialSnapshot(this.sessionId);

    this.insertSessionStatement.run(
      this.sessionId,
      snapshot.revision,
      stringifyJson(snapshot),
      now,
      now,
    );
  }

  assertSessionExists(): void {
    if (this.readSessionRow() === undefined) {
      throw createTypedError({
        code: "validation_error",
        summary: `Session ${this.sessionId} does not exist.`,
        suggestedAction: "Create the session before opening it.",
        affectedInputReferences: [this.sessionId],
      });
    }
  }

  async readSnapshot(): Promise<F8SessionSnapshot> {
    return this.readCommittedSnapshot();
  }

  async readCommandReceipt(commandId: string): Promise<F8SessionSnapshot | null> {
    const row = this.readCommandRow(commandId);
    if (row?.result_json === null || row === undefined) {
      return null;
    }

    return parseSnapshotJson(row.result_json);
  }

  async applyCommand(commandInput: F8SessionCommand, reducer: SessionCommandReducer): Promise<F8SessionSnapshot> {
    const command = f8SessionCommandSchema.parse(commandInput);

    if (command.sessionId !== this.sessionId) {
      throw createRevisionError(`Command ${command.commandId} targets ${command.sessionId}, expected ${this.sessionId}.`);
    }

    const currentSnapshot = this.readCommittedSnapshot();
    const mutation = await reducer(currentSnapshot, command);
    const nextSnapshot = normalizeSnapshot(currentSnapshot, mutation.snapshot);
    const revision = nextSnapshot.revision;
    const timestamp = new Date().toISOString();
    const resultJson = stringifyJson(nextSnapshot);
    const commandJson = stringifyJson(command);
    const events = normalizeEvents(this.sessionId, revision, [
      createCommandAcceptedEvent(command, nextSnapshot.activeAttempt, revision, timestamp),
      ...(mutation.events ?? []),
      createSnapshotUpdatedEvent(nextSnapshot, revision, timestamp),
    ]);

    this.database.exec("BEGIN IMMEDIATE");

    try {
      const existingCommand = this.readCommandRow(command.commandId);

      if (existingCommand !== undefined) {
        ensureReceiptMatches(commandJson, existingCommand.command_json, command.commandId);

        if (existingCommand.result_json === null) {
          throw createTypedError({
            code: "internal_error",
            summary: `Command ${command.commandId} has an incomplete receipt.`,
            suggestedAction: "Retry the command after reopening the session store.",
            affectedInputReferences: [command.commandId],
          });
        }

        this.database.exec("COMMIT");
        return parseSnapshotJson(existingCommand.result_json);
      }

      const sessionRow = this.readSessionRow();
      if (sessionRow === undefined) {
        throw createTypedError({
          code: "validation_error",
          summary: `Session ${this.sessionId} does not exist.`,
          suggestedAction: "Create the session before applying commands.",
          affectedInputReferences: [this.sessionId],
        });
      }

      if (sessionRow.revision !== command.expectedRevision) {
        throw createRevisionError(`Expected revision ${command.expectedRevision}, found ${sessionRow.revision}.`);
      }

      this.insertCommandStatement.run(
        command.commandId,
        this.sessionId,
        command.expectedRevision,
        commandJson,
        timestamp,
      );
      this.testHooks?.afterCommandInsert?.();

      const sessionUpdate = this.updateSessionStatement.run(
        revision,
        resultJson,
        timestamp,
        this.sessionId,
        command.expectedRevision,
      );

      if (toNumber(sessionUpdate.changes) !== 1) {
        throw createRevisionError(`Revision ${command.expectedRevision} was not current during commit.`);
      }

      this.testHooks?.afterSnapshotUpdate?.();

      persistEvents(this.insertEventStatement, events);
      persistActiveAttempt(this.upsertStageAttemptStatement, nextSnapshot.activeAttempt, this.sessionId);
      persistScenarioDrafts(this.deleteScenarioDraftsStatement, this.insertScenarioDraftStatement, this.sessionId, mutation.scenarioDrafts ?? nextSnapshot.scenarioDrafts ?? []);

      if (mutation.artifactReferences !== undefined) {
        persistArtifactReferences(this.deleteArtifactRefsStatement, this.insertArtifactRefStatement, this.sessionId, mutation.artifactReferences);
      }

      if (mutation.hostActions !== undefined) {
        persistHostActions(this.deleteHostActionsStatement, this.insertHostActionStatement, this.sessionId, mutation.hostActions);
      }

      this.updateCommandResultStatement.run(
        resultJson,
        revision,
        timestamp,
        command.commandId,
      );
      this.testHooks?.afterResultUpdate?.();

      this.database.exec("COMMIT");
      return nextSnapshot;
    } catch (error) {
      rollbackQuietly(this.database);
      throw error;
    }
  }

  async recordAttemptResult(result: SessionAttemptResultRecord): Promise<SessionAttemptResultReceipt> {
    const currentSnapshot = this.readCommittedSnapshot();
    if (currentSnapshot.activeAttempt?.attemptId !== result.attemptId) {
      return { accepted: false, snapshot: currentSnapshot };
    }

    const timestamp = result.endedAt ?? new Date().toISOString();
    const nextSnapshot = result.snapshot === undefined
      ? currentSnapshot
      : normalizeSnapshot(currentSnapshot, result.snapshot);
    const events = normalizeEvents(this.sessionId, nextSnapshot.revision, result.events ?? []);

    this.database.exec("BEGIN IMMEDIATE");

    try {
      const sessionRow = this.readSessionRow();
      if (sessionRow === undefined) {
        throw createTypedError({
          code: "validation_error",
          summary: `Session ${this.sessionId} does not exist.`,
          suggestedAction: "Create the session before recording attempt results.",
          affectedInputReferences: [this.sessionId],
        });
      }

      const activeAttempt = parseSnapshotJson(sessionRow.snapshot_json).activeAttempt;
      if (activeAttempt?.attemptId !== result.attemptId) {
        this.database.exec("COMMIT");
        return { accepted: false, snapshot: parseSnapshotJson(sessionRow.snapshot_json) };
      }

      this.updateStageAttemptResultStatement.run(
        result.status ?? activeAttempt.status,
        result.runReference ?? null,
        result.manifestHash ?? null,
        result.artifactReferences === undefined ? null : stringifyJson(result.artifactReferences),
        stringifyJson(result.result),
        timestamp,
        result.attemptId,
        this.sessionId,
      );

      if (result.snapshot !== undefined) {
        const updateResult = this.updateSessionStatement.run(
          nextSnapshot.revision,
          stringifyJson(nextSnapshot),
          timestamp,
          this.sessionId,
          sessionRow.revision,
        );

        if (toNumber(updateResult.changes) !== 1) {
          throw createRevisionError(`Attempt ${result.attemptId} could not update revision ${sessionRow.revision}.`);
        }
      }

      if (events.length > 0) {
        persistEvents(this.insertEventStatement, events);
      }

      if (result.scenarioDrafts !== undefined) {
        persistScenarioDrafts(this.deleteScenarioDraftsStatement, this.insertScenarioDraftStatement, this.sessionId, result.scenarioDrafts);
      }

      if (result.artifactReferences !== undefined) {
        persistArtifactReferences(this.deleteArtifactRefsStatement, this.insertArtifactRefStatement, this.sessionId, result.artifactReferences);
      }

      if (result.hostActions !== undefined) {
        persistHostActions(this.deleteHostActionsStatement, this.insertHostActionStatement, this.sessionId, result.hostActions);
      }

      this.database.exec("COMMIT");
      return { accepted: true, snapshot: nextSnapshot };
    } catch (error) {
      rollbackQuietly(this.database);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.database.isOpen) {
      this.database.close();
    }
  }

  private readCommittedSnapshot(): F8SessionSnapshot {
    const row = this.readSessionRow();
    if (row === undefined) {
      throw createTypedError({
        code: "validation_error",
        summary: `Session ${this.sessionId} does not exist.`,
        suggestedAction: "Create the session before reading it.",
        affectedInputReferences: [this.sessionId],
      });
    }

    return parseSnapshotJson(row.snapshot_json);
  }

  private readSessionRow(): SessionRow | undefined {
    const row = this.selectSessionStatement.get(this.sessionId) as SessionRow | undefined;
    return row;
  }

  private readCommandRow(commandId: string): CommandRow | undefined {
    return this.selectCommandStatement.get(commandId) as CommandRow | undefined;
  }
}

function createInitialSnapshot(sessionId: string): F8SessionSnapshot {
  return f8SessionSnapshotSchema.parse({
    contractVersion: "f8-session-snapshot-v1",
    sessionId,
    revision: 0,
    inputRevision: 0,
    state: "created",
    activeAttempt: null,
    priorRunReferences: [],
  });
}

function normalizeSnapshot(currentSnapshot: F8SessionSnapshot, candidateSnapshot: F8SessionSnapshot): F8SessionSnapshot {
  return f8SessionSnapshotSchema.parse({
    ...candidateSnapshot,
    contractVersion: "f8-session-snapshot-v1",
    sessionId: currentSnapshot.sessionId,
    revision: currentSnapshot.revision + 1,
  });
}

function createCommandAcceptedEvent(
  command: F8SessionCommand,
  activeAttempt: StageAttempt | null,
  revision: number,
  timestamp: string,
): F8SessionEvent {
  return f8SessionEventSchema.parse({
    contractVersion: "f8-session-event-v1",
    sessionId: command.sessionId,
    revision,
    eventId: crypto.randomUUID(),
    kind: "command_accepted",
    timestamp,
    command,
    activeAttempt: activeAttempt ?? undefined,
  });
}

function createSnapshotUpdatedEvent(snapshot: F8SessionSnapshot, revision: number, timestamp: string): F8SessionEvent {
  return f8SessionEventSchema.parse({
    contractVersion: "f8-session-event-v1",
    sessionId: snapshot.sessionId,
    revision,
    eventId: crypto.randomUUID(),
    kind: "snapshot_updated",
    timestamp,
    snapshot,
  });
}

function normalizeEvents(sessionId: string, revision: number, events: readonly F8SessionEvent[]): F8SessionEvent[] {
  return events.map((event) => f8SessionEventSchema.parse({
    ...event,
    sessionId,
    revision,
  }));
}

function persistEvents(statement: StatementSync, events: readonly F8SessionEvent[]): void {
  events.forEach((event) => {
    statement.run(
      event.eventId,
      event.sessionId,
      event.revision,
      event.kind,
      stringifyJson(event),
      event.timestamp,
    );
  });
}

function persistActiveAttempt(
  statement: StatementSync,
  attempt: StageAttempt | null,
  sessionId: string,
): void {
  if (attempt === null) {
    return;
  }

  statement.run(
    attempt.attemptId,
    sessionId,
    attempt.stage,
    attempt.status,
    attempt.commandId ?? null,
    attempt.runReference ?? null,
    null,
    null,
    null,
    attempt.startedAt,
    attempt.endedAt ?? null,
  );
}

function persistScenarioDrafts(
  deleteStatement: StatementSync,
  insertStatement: StatementSync,
  sessionId: string,
  drafts: readonly F8ScenarioDraft[],
): void {
  deleteStatement.run(sessionId);
  drafts.forEach((draft) => {
    insertStatement.run(
      draft.draftId,
      sessionId,
      stringifyJson(draft),
      draft.updatedAt ?? new Date().toISOString(),
    );
  });
}

function persistArtifactReferences(
  deleteStatement: StatementSync,
  insertStatement: StatementSync,
  sessionId: string,
  references: readonly SessionArtifactReference[],
): void {
  deleteStatement.run(sessionId);
  references.forEach((reference) => {
    insertStatement.run(
      reference.artifactId,
      sessionId,
      reference.inputRevision,
      reference.kind,
      reference.relativePath,
      reference.contentHash ?? null,
      reference.manifestHash ?? null,
      reference.metadata === undefined ? null : stringifyJson(reference.metadata),
    );
  });
}

function persistHostActions(
  deleteStatement: StatementSync,
  insertStatement: StatementSync,
  sessionId: string,
  actions: readonly SessionHostActionRecord[],
): void {
  deleteStatement.run(sessionId);
  const now = new Date().toISOString();
  actions.forEach((action) => {
    insertStatement.run(
      action.actionId,
      sessionId,
      action.status,
      action.request === undefined ? null : stringifyJson(action.request),
      action.claim === undefined ? null : stringifyJson(action.claim),
      action.result === undefined ? null : stringifyJson(action.result),
      action.expiresAt ?? null,
      action.leaseId ?? null,
      action.leaseExpiresAt ?? null,
      action.expectedRevision ?? null,
      action.confirmationHash ?? null,
      action.expectedTargetVersion ?? null,
      now,
    );
  });
}

function parseSnapshotJson(value: string): F8SessionSnapshot {
  return f8SessionSnapshotSchema.parse(JSON.parse(value));
}

function ensureReceiptMatches(expectedJson: string, actualJson: string, commandId: string): void {
  if (canonicalizeJson(expectedJson) !== canonicalizeJson(actualJson)) {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: `Command receipt mismatch for ${commandId}.`,
      suggestedAction: "Retry with a new commandId for changed command contents.",
      affectedInputReferences: [commandId],
    });
  }
}

function createRevisionError(summary: string) {
  return createTypedError({
    code: "evidence_mismatch",
    summary,
    suggestedAction: "Refresh the session snapshot and retry the command with the latest revision.",
    affectedInputReferences: [],
  });
}

function rollbackQuietly(database: DatabaseSync): void {
  if (database.isTransaction) {
    database.exec("ROLLBACK");
  }
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value);
}

function canonicalizeJson(value: string): string {
  return stableStringify(JSON.parse(value));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function toNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}