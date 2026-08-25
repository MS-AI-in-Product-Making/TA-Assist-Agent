import { mkdir } from "node:fs/promises";
import { DatabaseSync, StatementSync } from "node:sqlite";

import {
  createTypedError,
  f8SessionCommandSchema,
  f8SessionEventSchema,
  f8SessionSnapshotSchema,
} from "@ai-assist/contracts";

import { resolveManagedWorkbenchPaths } from "./managed-paths.js";
import { CREATE_SESSION_STORE_SCHEMA_SQL } from "./session-store-schema.js";
import {
  applyArtifactReferenceOps,
  applyHostActionOps,
  normalizeArtifactReferenceOps,
  normalizeHostActionOps,
  replaceScenarioDrafts,
  resolveScenarioDrafts,
  type SessionArtifactReference,
  type SessionDeltaOperations,
  type SessionHostActionRecord,
} from "./session-store-side-tables.js";

export type {
  SessionArtifactReference,
  SessionDeltaOperations,
  SessionHostActionRecord,
} from "./session-store-side-tables.js";

type F8SessionCommand = ReturnType<typeof f8SessionCommandSchema.parse>;
type F8SessionEvent = ReturnType<typeof f8SessionEventSchema.parse>;
type F8SessionSnapshot = ReturnType<typeof f8SessionSnapshotSchema.parse>;
type F8ScenarioDraft = NonNullable<F8SessionSnapshot["scenarioDrafts"]>[number];

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

export interface SessionCommandMutation {
  readonly snapshot: F8SessionSnapshot;
  readonly events?: readonly F8SessionEvent[];
  readonly artifactReferences?: readonly SessionArtifactReference[];
  readonly artifactReferenceOps?: SessionDeltaOperations<SessionArtifactReference>;
  readonly scenarioDrafts?: F8SessionSnapshot["scenarioDrafts"];
  readonly hostActions?: readonly SessionHostActionRecord[];
  readonly hostActionOps?: SessionDeltaOperations<SessionHostActionRecord>;
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
  readonly artifactReferenceOps?: SessionDeltaOperations<SessionArtifactReference>;
  readonly scenarioDrafts?: F8SessionSnapshot["scenarioDrafts"];
  readonly hostActions?: readonly SessionHostActionRecord[];
  readonly hostActionOps?: SessionDeltaOperations<SessionHostActionRecord>;
  readonly endedAt?: string;
}

export interface SessionAttemptResultReceipt {
  readonly accepted: boolean;
  readonly snapshot: F8SessionSnapshot;
}

export interface SessionStore {
  readSnapshot(): Promise<F8SessionSnapshot>;
  readArtifactReference(artifactId: string): Promise<SessionArtifactReference | undefined>;
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

interface PreparedSnapshotTransition {
  readonly snapshot: F8SessionSnapshot;
  readonly scenarioDrafts: readonly F8ScenarioDraft[];
}

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
    database.exec(CREATE_SESSION_STORE_SCHEMA_SQL);
  } catch (error) {
    database.close();
    throw error;
  }

  return new SqliteSessionStore(database, options.sessionId, options.testHooks);
}

class SqliteSessionStore implements SessionStore {
  private readonly selectSessionStatement;

  private readonly selectArtifactReferenceStatement;

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

  private readonly deleteArtifactRefStatement;

  private readonly upsertArtifactRefStatement;

  private readonly deleteHostActionStatement;

  private readonly upsertHostActionStatement;

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
    this.selectArtifactReferenceStatement = this.database.prepare(`
      SELECT artifact_id, session_id, input_revision, kind, relative_path, content_hash, manifest_hash, metadata_json
      FROM artifact_refs
      WHERE artifact_id = ? AND session_id = ?
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
    this.deleteArtifactRefStatement = this.database.prepare("DELETE FROM artifact_refs WHERE artifact_id = ? AND session_id = ?");
    this.upsertArtifactRefStatement = this.database.prepare(`
      INSERT INTO artifact_refs(artifact_id, session_id, input_revision, kind, relative_path, content_hash, manifest_hash, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(artifact_id) DO UPDATE SET
        session_id = excluded.session_id,
        input_revision = excluded.input_revision,
        kind = excluded.kind,
        relative_path = excluded.relative_path,
        content_hash = excluded.content_hash,
        manifest_hash = excluded.manifest_hash,
        metadata_json = excluded.metadata_json
    `);
    this.deleteHostActionStatement = this.database.prepare("DELETE FROM host_actions WHERE action_id = ? AND session_id = ?");
    this.upsertHostActionStatement = this.database.prepare(`
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
      ON CONFLICT(action_id) DO UPDATE SET
        session_id = excluded.session_id,
        status = excluded.status,
        request_json = excluded.request_json,
        claim_json = excluded.claim_json,
        result_json = excluded.result_json,
        expires_at = excluded.expires_at,
        lease_id = excluded.lease_id,
        lease_expires_at = excluded.lease_expires_at,
        expected_revision = excluded.expected_revision,
        confirmation_hash = excluded.confirmation_hash,
        expected_target_version = excluded.expected_target_version,
        updated_at = excluded.updated_at
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

  async readArtifactReference(artifactId: string): Promise<SessionArtifactReference | undefined> {
    const row = this.selectArtifactReferenceStatement.get(artifactId, this.sessionId) as {
      artifact_id: string;
      session_id: string;
      input_revision: number;
      kind: string;
      relative_path: string;
      content_hash: string | null;
      manifest_hash: string | null;
      metadata_json: string | null;
    } | undefined;
    if (row === undefined) return undefined;
    return {
      artifactId: row.artifact_id,
      sessionId: row.session_id,
      inputRevision: row.input_revision,
      kind: row.kind,
      relativePath: row.relative_path,
      ...(row.content_hash === null ? {} : { contentHash: row.content_hash }),
      ...(row.manifest_hash === null ? {} : { manifestHash: row.manifest_hash }),
      ...(row.metadata_json === null ? {} : { metadata: JSON.parse(row.metadata_json) as Record<string, unknown> }),
    };
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
    const snapshotTransition = prepareSnapshotTransition(currentSnapshot, mutation.snapshot, mutation.scenarioDrafts);
    const nextSnapshot = snapshotTransition.snapshot;
    const artifactReferenceOps = normalizeArtifactReferenceOps(
      this.sessionId,
      mutation.artifactReferences,
      mutation.artifactReferenceOps,
    );
    const hostActionOps = normalizeHostActionOps(
      this.sessionId,
      mutation.hostActions,
      mutation.hostActionOps,
    );
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
      persistSideTables({
        deleteScenarioDraftsStatement: this.deleteScenarioDraftsStatement,
        insertScenarioDraftStatement: this.insertScenarioDraftStatement,
        upsertArtifactRefStatement: this.upsertArtifactRefStatement,
        deleteArtifactRefStatement: this.deleteArtifactRefStatement,
        upsertHostActionStatement: this.upsertHostActionStatement,
        deleteHostActionStatement: this.deleteHostActionStatement,
        sessionId: this.sessionId,
        scenarioDrafts: snapshotTransition.scenarioDrafts,
        artifactReferenceOps,
        hostActionOps,
      });

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
    const snapshotTransition = prepareAttemptResultTransition(currentSnapshot, result);
    const nextSnapshot = snapshotTransition?.snapshot ?? currentSnapshot;
    validateAttemptResultSnapshot(currentSnapshot, result, nextSnapshot);
    const artifactReferenceOps = normalizeArtifactReferenceOps(
      this.sessionId,
      result.artifactReferences,
      result.artifactReferenceOps,
    );
    const snapshotWithArtifactReferences = withArtifactReferences(nextSnapshot, artifactReferenceOps);
    const hostActionOps = normalizeHostActionOps(
      this.sessionId,
      result.hostActions,
      result.hostActionOps,
    );
    const events = normalizeEvents(this.sessionId, snapshotWithArtifactReferences.revision, result.events ?? []);

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
          snapshotWithArtifactReferences.revision,
          stringifyJson(snapshotWithArtifactReferences),
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

      persistSideTables({
        deleteScenarioDraftsStatement: this.deleteScenarioDraftsStatement,
        insertScenarioDraftStatement: this.insertScenarioDraftStatement,
        upsertArtifactRefStatement: this.upsertArtifactRefStatement,
        deleteArtifactRefStatement: this.deleteArtifactRefStatement,
        upsertHostActionStatement: this.upsertHostActionStatement,
        deleteHostActionStatement: this.deleteHostActionStatement,
        sessionId: this.sessionId,
        scenarioDrafts: snapshotTransition?.scenarioDrafts,
        artifactReferenceOps,
        hostActionOps,
      });

      this.database.exec("COMMIT");
      return { accepted: true, snapshot: snapshotWithArtifactReferences };
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

function prepareSnapshotTransition(
  currentSnapshot: F8SessionSnapshot,
  candidateSnapshot: F8SessionSnapshot,
  compatibilityScenarioDrafts: F8SessionSnapshot["scenarioDrafts"],
): PreparedSnapshotTransition {
  const normalizedSnapshot = normalizeSnapshot(currentSnapshot, candidateSnapshot);
  const authoritativeDrafts = resolveAuthoritativeScenarioDrafts(
    currentSnapshot.sessionId,
    normalizedSnapshot.scenarioDrafts,
    compatibilityScenarioDrafts,
  );

  return {
    snapshot: withScenarioDrafts(normalizedSnapshot, authoritativeDrafts),
    scenarioDrafts: authoritativeDrafts,
  };
}

function prepareAttemptResultTransition(
  currentSnapshot: F8SessionSnapshot,
  result: SessionAttemptResultRecord,
): PreparedSnapshotTransition | undefined {
  if (result.snapshot === undefined) {
    if (isTerminalAttemptStatus(result.status)) {
      throw createTypedError({
        code: "validation_error",
        summary: `Attempt result for ${result.attemptId} requires a snapshot transition for terminal status ${result.status}.`,
        suggestedAction: "Provide the next snapshot that clears the active attempt or marks the same attemptId terminal in the same transaction.",
        affectedInputReferences: [result.attemptId],
      });
    }

    if (result.scenarioDrafts !== undefined) {
      throw createTypedError({
        code: "validation_error",
        summary: `Attempt result for ${result.attemptId} cannot replace scenario drafts without a snapshot transition.`,
        suggestedAction: "Provide a snapshot transition whose scenarioDrafts field is authoritative for the next revision.",
        affectedInputReferences: [result.attemptId],
      });
    }

    return undefined;
  }

  return prepareSnapshotTransition(currentSnapshot, result.snapshot, result.scenarioDrafts);
}

function resolveAuthoritativeScenarioDrafts(
  sessionId: string,
  snapshotDrafts: F8SessionSnapshot["scenarioDrafts"],
  compatibilityDrafts: F8SessionSnapshot["scenarioDrafts"],
): readonly F8ScenarioDraft[] {
  const normalizedSnapshotDrafts = resolveScenarioDrafts(sessionId, snapshotDrafts, undefined);
  const normalizedCompatibilityDrafts = resolveScenarioDrafts(sessionId, undefined, compatibilityDrafts);

  if (normalizedCompatibilityDrafts !== undefined && normalizedSnapshotDrafts === undefined) {
    throw createTypedError({
      code: "validation_error",
      summary: `Scenario drafts for session ${sessionId} must be authored by the snapshot transition, not the compatibility payload.`,
      suggestedAction: "Either omit compatibility scenarioDrafts when the next snapshot omits them, or provide the same draft list in the snapshot field.",
      affectedInputReferences: [sessionId],
    });
  }

  if (normalizedCompatibilityDrafts !== undefined
    && normalizedSnapshotDrafts !== undefined
    && stableStringify(normalizedCompatibilityDrafts) !== stableStringify(normalizedSnapshotDrafts)) {
    throw createTypedError({
      code: "validation_error",
      summary: `Scenario drafts for session ${sessionId} must not disagree between snapshot and compatibility payloads.`,
      suggestedAction: "Provide one authoritative draft list, or keep both copies byte-equivalent.",
      affectedInputReferences: [sessionId],
    });
  }

  return normalizedSnapshotDrafts ?? [];
}

function withScenarioDrafts(
  snapshot: F8SessionSnapshot,
  scenarioDrafts: readonly F8ScenarioDraft[],
): F8SessionSnapshot {
  const { scenarioDrafts: _ignored, ...baseSnapshot } = snapshot;
  return f8SessionSnapshotSchema.parse(
    scenarioDrafts.length === 0
      ? baseSnapshot
      : { ...baseSnapshot, scenarioDrafts },
  );
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

function persistSideTables(options: {
  deleteScenarioDraftsStatement: StatementSync;
  insertScenarioDraftStatement: StatementSync;
  upsertArtifactRefStatement: StatementSync;
  deleteArtifactRefStatement: StatementSync;
  upsertHostActionStatement: StatementSync;
  deleteHostActionStatement: StatementSync;
  sessionId: string;
  scenarioDrafts: readonly F8ScenarioDraft[] | undefined;
  artifactReferenceOps: SessionDeltaOperations<SessionArtifactReference> | undefined;
  hostActionOps: SessionDeltaOperations<SessionHostActionRecord> | undefined;
}): void {
  if (options.scenarioDrafts !== undefined) {
    replaceScenarioDrafts(
      options.deleteScenarioDraftsStatement,
      options.insertScenarioDraftStatement,
      options.sessionId,
      options.scenarioDrafts,
      stringifyJson,
    );
  }

  if (options.artifactReferenceOps !== undefined) {
    applyArtifactReferenceOps(
      options.upsertArtifactRefStatement,
      options.deleteArtifactRefStatement,
      options.sessionId,
      options.artifactReferenceOps,
      stringifyJson,
    );
  }

  if (options.hostActionOps !== undefined) {
    applyHostActionOps(
      options.upsertHostActionStatement,
      options.deleteHostActionStatement,
      options.sessionId,
      options.hostActionOps,
      stringifyJson,
    );
  }
}

function validateAttemptResultSnapshot(
  currentSnapshot: F8SessionSnapshot,
  result: SessionAttemptResultRecord,
  nextSnapshot: F8SessionSnapshot,
): void {
  if (result.snapshot === undefined || currentSnapshot.activeAttempt === null) {
    return;
  }

  const nextAttempt = nextSnapshot.activeAttempt;
  if (nextAttempt === null) {
    return;
  }

  if (nextAttempt.attemptId !== currentSnapshot.activeAttempt.attemptId) {
    throw createTypedError({
      code: "validation_error",
      summary: `Attempt result for ${result.attemptId} cannot switch the active attempt to ${nextAttempt.attemptId}.`,
      suggestedAction: "Clear the active attempt or keep the same attemptId with a terminal status.",
      affectedInputReferences: [result.attemptId, nextAttempt.attemptId],
    });
  }

  if (nextAttempt.status === "running") {
    throw createTypedError({
      code: "validation_error",
      summary: `Attempt result for ${result.attemptId} cannot keep the active attempt running.`,
      suggestedAction: "Clear the active attempt or mark the same attemptId as completed, failed, or cancelled.",
      affectedInputReferences: [result.attemptId],
    });
  }

  if (result.status !== undefined && nextAttempt.status !== result.status) {
    throw createTypedError({
      code: "validation_error",
      summary: `Attempt result for ${result.attemptId} must keep snapshot status ${nextAttempt.status} consistent with result status ${result.status}.`,
      suggestedAction: "Provide a snapshot whose active attempt uses the same terminal status as the attempt result.",
      affectedInputReferences: [result.attemptId],
    });
  }
}

function isTerminalAttemptStatus(status: SessionAttemptResultRecord["status"]): status is "completed" | "failed" | "cancelled" {
  return status === "completed" || status === "failed" || status === "cancelled";
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

function withArtifactReferences(
  snapshot: F8SessionSnapshot,
  operations: SessionDeltaOperations<SessionArtifactReference> | undefined,
): F8SessionSnapshot {
  if (operations === undefined) return snapshot;
  const references = new Map((snapshot.artifactRefs ?? []).map((reference) => [reference.artifactId, reference]));
  operations.delete?.forEach((artifactId) => references.delete(artifactId));
  operations.upsert?.forEach((reference) => {
    if (!isReviewArtifactKind(reference.kind)) {
      return;
    }
    const reviewContextId = reference.metadata?.reviewContextId;
    if (typeof reviewContextId !== "string" || !/^[a-f0-9]{64}$/.test(reviewContextId)) {
      throw createTypedError({
        code: "evidence_mismatch",
        summary: `Review artifact ${reference.artifactId} has no valid review context ID.`,
        suggestedAction: "Register review artifacts with a validated review context identity.",
        affectedInputReferences: [reference.artifactId],
      });
    }
    references.set(reference.artifactId, {
      artifactId: reference.artifactId,
      kind: reference.kind,
      revision: snapshot.inputRevision,
      validated: true,
      reviewContextId,
    });
  });
  return f8SessionSnapshotSchema.parse({
    ...snapshot,
    ...(references.size === 0 ? {} : { artifactRefs: [...references.values()] }),
  });
}

function isReviewArtifactKind(kind: string): kind is "f1_image" | "f3_report" | "f4_calculation" | "f4_report" | "f5_report" | "f6_optimization" | "f6_report" {
  return ["f1_image", "f3_report", "f4_calculation", "f4_report", "f5_report", "f6_optimization", "f6_report"].includes(kind);
}