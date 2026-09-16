import { mkdir } from "node:fs/promises";
import { DatabaseSync, StatementSync } from "node:sqlite";

import {
  type AnalysisRequestContext,
  createTypedError,
  f8SessionCommandSchema,
  f8SessionEventSchema,
} from "@ai-assist/contracts";
import { f8SessionSnapshotSchema } from "../../contracts/src/f8-contracts.js";

import { resolveManagedWorkbenchPaths } from "./managed-paths.js";
import { acceptAttemptResult } from "./state-machine.js";
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
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

type StageAttempt = NonNullable<F8SessionSnapshot["activeAttempt"]>;

export interface SessionStoreTestHooks {
  readonly afterCommandInsert?: () => void;
  readonly afterSnapshotUpdate?: () => void;
  readonly afterResultUpdate?: () => void;
}

export interface SessionStoreOptions {
  readonly rootDir: string;
  readonly sessionId: string;
  readonly interactionLanguage?: F8SessionSnapshot["interactionLanguage"];
  readonly analysisRequestContext?: AnalysisRequestContext;
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

export interface SessionSnapshotMutation {
  readonly snapshot: F8SessionSnapshot;
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

export type SessionSnapshotReducer = (
  snapshot: F8SessionSnapshot,
) => SessionSnapshotMutation | Promise<SessionSnapshotMutation>;

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
  readCommittedCommand(commandId: string): Promise<F8SessionCommand | undefined>;
  applyCommand(command: F8SessionCommand, reducer: SessionCommandReducer): Promise<F8SessionSnapshot>;
  applySnapshotMutation(expectedRevision: number, reducer: SessionSnapshotReducer): Promise<F8SessionSnapshot>;
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

interface CommittedScopeCommandRow {
  readonly command_id: string;
  readonly command_json: string;
  readonly committed_revision: number;
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

  return new SqliteSessionStore(
    database,
    options.sessionId,
    options.interactionLanguage,
    options.analysisRequestContext,
    options.testHooks,
  );
}

class SqliteSessionStore implements SessionStore {
  private readonly selectSessionStatement;

  private readonly selectArtifactReferenceStatement;

  private readonly insertSessionStatement;

  private readonly selectCommandStatement;

  private readonly insertCommandStatement;

  private readonly selectCommittedScopeCommandsStatement;

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
    private readonly interactionLanguage: F8SessionSnapshot["interactionLanguage"] | undefined,
    private readonly analysisRequestContext: AnalysisRequestContext | undefined,
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
    this.selectCommittedScopeCommandsStatement = this.database.prepare(`
      SELECT command_id, command_json, committed_revision
      FROM commands
      WHERE session_id = ?
        AND committed_revision IS NOT NULL
      ORDER BY committed_revision ASC, command_id ASC
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
    const snapshot = createInitialSnapshot(this.sessionId, this.interactionLanguage, this.analysisRequestContext);

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

  async readCommittedCommand(commandId: string): Promise<F8SessionCommand | undefined> {
    const row = this.readCommandRow(commandId);
    if (row?.result_json === null || row === undefined) return undefined;
    return f8SessionCommandSchema.parse(parseStoredCommand(row.command_json));
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
    assertNoNewLegacyDownstreamSelection(currentSnapshot, nextSnapshot);
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
    assertNoNewLegacyDownstreamSelection(currentSnapshot, snapshotWithArtifactReferences);
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

  async applySnapshotMutation(expectedRevision: number, reducer: SessionSnapshotReducer): Promise<F8SessionSnapshot> {
    const currentSnapshot = this.readCommittedSnapshot();
    if (currentSnapshot.revision !== expectedRevision) {
      throw createRevisionError(`Expected revision ${expectedRevision}, found ${currentSnapshot.revision}.`);
    }

    const mutation = await reducer(currentSnapshot);
    const snapshotTransition = prepareSnapshotTransition(currentSnapshot, mutation.snapshot, mutation.scenarioDrafts);
    const artifactReferenceOps = normalizeArtifactReferenceOps(
      this.sessionId,
      mutation.artifactReferences,
      mutation.artifactReferenceOps,
    );
    const nextSnapshot = withArtifactReferences(snapshotTransition.snapshot, artifactReferenceOps);
    if (stableStringify(nextSnapshot.activeAttempt) !== stableStringify(currentSnapshot.activeAttempt)) {
      throw createTypedError({
        code: "validation_error",
        summary: `Snapshot mutation for session ${this.sessionId} must not modify activeAttempt.`,
        suggestedAction: "Use applyCommand or recordAttemptResult when attempt state changes are required.",
        affectedInputReferences: [this.sessionId],
      });
    }
    const hostActionOps = normalizeHostActionOps(
      this.sessionId,
      mutation.hostActions,
      mutation.hostActionOps,
    );
    const timestamp = new Date().toISOString();

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const sessionRow = this.readSessionRow();
      if (sessionRow === undefined) {
        throw createTypedError({
          code: "validation_error",
          summary: `Session ${this.sessionId} does not exist.`,
          suggestedAction: "Create the session before applying snapshot mutations.",
          affectedInputReferences: [this.sessionId],
        });
      }
      if (sessionRow.revision !== expectedRevision) {
        throw createRevisionError(`Expected revision ${expectedRevision}, found ${sessionRow.revision}.`);
      }

      const sessionUpdate = this.updateSessionStatement.run(
        nextSnapshot.revision,
        stringifyJson(nextSnapshot),
        timestamp,
        this.sessionId,
        expectedRevision,
      );
      if (toNumber(sessionUpdate.changes) !== 1) {
        throw createRevisionError(`Revision ${expectedRevision} was not current during commit.`);
      }

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

      this.database.exec("COMMIT");
      return nextSnapshot;
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

    const snapshot = parseSnapshotJson(row.snapshot_json);
    return this.backfillHistoricalCompatibility(row, snapshot);
  }

  private backfillHistoricalCompatibility(row: SessionRow, snapshot: F8SessionSnapshot): F8SessionSnapshot {
    const commandRows = parseCommittedScopeCommandRows(this.selectCommittedScopeCommandsStatement.all(this.sessionId) as unknown);
    const migratedSelections = migrateLegacyWorksheetSelectionProvenance(
      snapshot,
      commandRows,
      row.revision,
    );
    const persistedSnapshot = JSON.parse(row.snapshot_json) as Record<string, unknown>;
    const migrated = "interactionLanguage" in persistedSnapshot
      ? migratedSelections
      : { ...migratedSelections, interactionLanguage: snapshot.interactionLanguage };
    if (migrated === snapshot) return snapshot;

    this.updateSessionStatement.run(
      row.revision,
      stringifyJson(migrated),
      new Date().toISOString(),
      this.sessionId,
      row.revision,
    );
    return migrated;
  }

  private readSessionRow(): SessionRow | undefined {
    const row = this.selectSessionStatement.get(this.sessionId) as SessionRow | undefined;
    return row;
  }

  private readCommandRow(commandId: string): CommandRow | undefined {
    return this.selectCommandStatement.get(commandId) as CommandRow | undefined;
  }
}

function createInitialSnapshot(
  sessionId: string,
  interactionLanguage: F8SessionSnapshot["interactionLanguage"] | undefined,
  analysisRequestContext: AnalysisRequestContext | undefined,
): F8SessionSnapshot {
  if (interactionLanguage === undefined) {
    throw createTypedError({
      code: "validation_error",
      summary: `Session ${sessionId} requires an interaction language lock when it is first created.`,
      suggestedAction: "Provide the workflow-start interaction language when creating a new session, or open an existing persisted session to backfill legacy data.",
      affectedInputReferences: [sessionId],
    });
  }

  if (analysisRequestContext === undefined) {
    throw createTypedError({
      code: "validation_error",
      summary: `Session ${sessionId} requires request context when it is first created.`,
      suggestedAction: "Provide the requester UTC offset and authority-stamped request instant when creating a new session, or open an existing persisted session to read legacy data.",
      affectedInputReferences: [sessionId],
    });
  }

  return f8SessionSnapshotSchema.parse({
    contractVersion: "f8-session-snapshot-v1",
    sessionId,
    revision: 0,
    inputRevision: 0,
    state: "created",
    activeAttempt: null,
    interactionLanguage,
    analysisRequestContext,
    priorRunReferences: [],
  });
}

function normalizeSnapshot(currentSnapshot: F8SessionSnapshot, candidateSnapshot: F8SessionSnapshot): F8SessionSnapshot {
  return f8SessionSnapshotSchema.parse({
    ...candidateSnapshot,
    contractVersion: "f8-session-snapshot-v1",
    sessionId: currentSnapshot.sessionId,
    revision: currentSnapshot.revision + 1,
    analysisRequestContext: candidateSnapshot.analysisRequestContext ?? currentSnapshot.analysisRequestContext,
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
  const baseSnapshot = { ...snapshot };
  delete baseSnapshot.scenarioDrafts;
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
    const automaticSuccessors: Partial<Record<F8SessionSnapshot["state"], F8SessionSnapshot["state"]>> = {
      workbook_validating: "f0_validating",
      f3_running: "f4_running",
      f4_running: "f5_running",
      f5_running: "f6_running",
    };
    const currentCommandId = currentSnapshot.activeAttempt.commandId;
    const expectedNextCommandId = currentCommandId === undefined ? undefined : `${currentCommandId}:next`;
    const expectedNextAttemptId = expectedNextCommandId === undefined
      ? undefined
      : `${expectedNextCommandId}:${nextAttempt.stage}`;
    if (result.status === "completed"
      && currentSnapshot.state === currentSnapshot.activeAttempt.stage
      && automaticSuccessors[currentSnapshot.activeAttempt.stage] === nextAttempt.stage
      && nextAttempt.status === "running"
      && nextSnapshot.state === nextAttempt.stage
      && nextAttempt.commandId === expectedNextCommandId
      && nextAttempt.attemptId === expectedNextAttemptId) {
      acceptAttemptResult(currentSnapshot, result);
      return;
    }
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
  const parsed = JSON.parse(value) as Record<string, unknown>;
  const candidate = materializeLegacyInteractionLanguage(parsed) ?? parsed;
  try {
    return f8SessionSnapshotSchema.parse(candidate);
  } catch (error) {
    const normalized = normalizeLegacySelectionProvenanceForValidation(candidate);
    if (normalized === undefined) {
      throw error;
    }
    f8SessionSnapshotSchema.parse(normalized);
    return candidate as F8SessionSnapshot;
  }
}

function materializeLegacyInteractionLanguage(snapshot: Record<string, unknown>): Record<string, unknown> | undefined {
  if (snapshot.interactionLanguage !== undefined) {
    return undefined;
  }

  const sessionId = typeof snapshot.sessionId === "string" && snapshot.sessionId.length > 0
    ? snapshot.sessionId
    : "legacy-session";
  const revision = typeof snapshot.revision === "number" && Number.isInteger(snapshot.revision) && snapshot.revision >= 0
    ? snapshot.revision
    : 0;

  return {
    ...snapshot,
    interactionLanguage: createLegacyFallbackInteractionLanguage(sessionId, revision, undefined),
  };
}

function createLegacyFallbackInteractionLanguage(
  sessionId: string,
  revision: number,
  turnId: string | undefined,
): F8SessionSnapshot["interactionLanguage"] {
  return {
    languageTag: "und",
    uiCatalogLanguage: "en",
    lockedAtTurnId: turnId ?? `legacy:${sessionId}:revision-${revision}`,
    source: "legacy_fallback",
    fallbackUsed: true,
  };
}

function normalizeLegacySelectionProvenanceForValidation(
  snapshot: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const normalized = { ...snapshot };
  let changed = false;
  const updateSelection = (key: "initialScopeSelection" | "downstreamScopeSelection") => {
    const selection = normalized[key];
    if (typeof selection !== "object" || selection === null) return;
    const selectionRecord = { ...(selection as Record<string, unknown>) };
    if (selectionRecord.provenance === "legacy_unverified") {
      selectionRecord.provenance = "user";
      normalized[key] = selectionRecord;
      changed = true;
    }
  };
  updateSelection("initialScopeSelection");
  updateSelection("downstreamScopeSelection");
  return changed ? normalized : undefined;
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
  return JSON.stringify(value, (_key, candidate: unknown) => candidate instanceof Uint8Array
    ? { $type: "Uint8Array", data: Array.from(candidate) }
    : candidate);
}

function parseStoredCommand(value: string): unknown {
  const parsed = JSON.parse(value) as unknown;
  if (typeof parsed !== "object" || parsed === null || !("payload" in parsed)) return parsed;
  const payload = (parsed as { readonly payload?: unknown }).payload;
  if (typeof payload !== "object" || payload === null || !("workbookBytes" in payload)) return parsed;
  const workbookBytes = (payload as { readonly workbookBytes?: unknown }).workbookBytes;
  const byteValues = storedByteValues(workbookBytes);
  return byteValues === undefined ? parsed : { ...parsed, payload: { ...payload, workbookBytes: Uint8Array.from(byteValues) } };
}

function storedByteValues(value: unknown): number[] | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  if ("$type" in value && "data" in value) {
    const tagged = value as { readonly $type?: unknown; readonly data?: unknown };
    return tagged.$type === "Uint8Array" && Array.isArray(tagged.data) && tagged.data.every(isByte) ? tagged.data : undefined;
  }
  if ("type" in value && "data" in value) {
    const buffer = value as { readonly type?: unknown; readonly data?: unknown };
    return buffer.type === "Buffer" && Array.isArray(buffer.data) && buffer.data.every(isByte) ? buffer.data : undefined;
  }
  const entries = Object.entries(value);
  if (!entries.every(([key, byte]) => /^(0|[1-9]\d*)$/.test(key) && isByte(byte))) return undefined;
  const sorted = entries.sort(([left], [right]) => Number(left) - Number(right));
  if (!sorted.every(([key], index) => Number(key) === index)) return undefined;
  return sorted.map(([, byte]) => byte as number);
}

function isByte(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0 && value <= 255;
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
      if (
        reference.kind === "f2_report"
        || reference.kind === "what_if_draft"
        || reference.kind === "f6_optimization_markdown"
        || reference.kind === "f6_run_summary"
        || reference.kind === "f6_manifest"
      ) {
        references.set(reference.artifactId, {
          artifactId: reference.artifactId,
          kind: reference.kind,
          revision: snapshot.inputRevision,
          validated: true,
        });
      }
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
    if (reference.kind === "f5_multimodal") {
      if (reference.contentHash === undefined) {
        throw createTypedError({
          code: "evidence_mismatch",
          summary: `Multimodal artifact ${reference.artifactId} has no content hash.`,
          suggestedAction: "Register the immutable multimodal artifact with its validated SHA-256 identity.",
          affectedInputReferences: [reference.artifactId],
        });
      }
      references.set(reference.artifactId, {
        artifactId: reference.artifactId,
        kind: reference.kind,
        revision: snapshot.inputRevision,
        validated: true,
        reviewContextId,
        relativePath: reference.relativePath,
        contentHash: reference.contentHash,
      });
      return;
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

function isReviewArtifactKind(kind: string): kind is "f1_image" | "f3_report" | "f4_calculation" | "f4_report" | "f5_multimodal" | "f5_report" | "f6_optimization" | "f6_report" {
  return ["f1_image", "f3_report", "f4_calculation", "f4_report", "f5_multimodal", "f5_report", "f6_optimization", "f6_report"].includes(kind);
}

function migrateLegacyWorksheetSelectionProvenance(
  snapshot: F8SessionSnapshot,
  commandRows: readonly CommittedScopeCommandRow[],
  committedSnapshotRevision: number,
): F8SessionSnapshot {
  const nextInitial = withInferredSelectionProvenance(snapshot.initialScopeSelection, "initial", commandRows, committedSnapshotRevision);
  const nextDownstream = withInferredSelectionProvenance(snapshot.downstreamScopeSelection, "downstream", commandRows, committedSnapshotRevision);
  if (nextInitial === snapshot.initialScopeSelection && nextDownstream === snapshot.downstreamScopeSelection) {
    return snapshot;
  }
  return {
    ...snapshot,
    ...(nextInitial === undefined ? {} : { initialScopeSelection: nextInitial }),
    ...(nextDownstream === undefined ? {} : { downstreamScopeSelection: nextDownstream }),
  };
}

function withInferredSelectionProvenance(
  selection: F8SessionSnapshot["initialScopeSelection"] | undefined,
  kind: "initial" | "downstream",
  commandRows: readonly CommittedScopeCommandRow[],
  committedSnapshotRevision: number,
): F8SessionSnapshot["initialScopeSelection"] | undefined {
  if (selection === undefined || selection.provenance !== undefined) return selection;
  const inferred = inferSelectionProvenance(selection.workbookContentHash, selection.selectedWorksheetNames, kind, commandRows, committedSnapshotRevision);
  return { ...selection, provenance: inferred } as unknown as F8SessionSnapshot["initialScopeSelection"];
}

function inferSelectionProvenance(
  workbookHash: string,
  worksheetNames: readonly string[],
  kind: "initial" | "downstream",
  commandRows: readonly CommittedScopeCommandRow[],
  committedSnapshotRevision: number,
): "user" | "internal_fixture" | "legacy_unverified" {
  const commandMatches = commandRows
    .filter((row) => row.committed_revision <= committedSnapshotRevision)
    .flatMap((row) => {
      const parsed = parseCommittedScopeCommandRow(row);
      if (parsed === undefined || parsed.payload.workbookHash !== workbookHash) return [];
      if (!sameWorksheetSet(parsed.payload.worksheetNames, worksheetNames)) return [];
      if (kind === "initial" && (parsed.command === "confirm_initial_scope" || parsed.command === "auto_confirm_initial_scope")) {
        return [parsed.command === "auto_confirm_initial_scope" ? "internal_fixture" as const : "user" as const];
      }
      if (kind === "downstream" && parsed.command === "confirm_downstream_scope") {
        return [parsed.commandId.endsWith(":auto-downstream") ? "internal_fixture" as const : "user" as const];
      }
      return [];
    });

  const unique = [...new Set(commandMatches)];
  return unique.length === 1 ? unique[0]! : "legacy_unverified";
}

function parseCommittedScopeCommandRow(row: CommittedScopeCommandRow): {
  readonly commandId: string;
  readonly command: "confirm_initial_scope" | "auto_confirm_initial_scope" | "confirm_downstream_scope";
  readonly payload: { readonly workbookHash: string; readonly worksheetNames: string[] };
} | undefined {
  try {
    const stored = JSON.parse(row.command_json) as unknown;
    const current = f8SessionCommandSchema.safeParse(stored);
    const parsed = current.success ? current.data : stored;
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const candidate = parsed as { readonly contractVersion?: unknown; readonly commandId?: unknown; readonly expectedRevision?: unknown; readonly command?: unknown; readonly payload?: unknown };
    if (!current.success && (candidate.contractVersion !== "f8-session-command-v1"
      || candidate.commandId !== row.command_id
      || typeof candidate.expectedRevision !== "number"
      || !Number.isInteger(candidate.expectedRevision)
      || candidate.expectedRevision < 0)) return undefined;
    if (!isWorksheetScopeCommand(candidate.command) || !isWorksheetScopePayload(candidate.payload)) {
      return undefined;
    }
    return {
      commandId: row.command_id,
      command: candidate.command,
      payload: candidate.payload,
    };
  } catch {
    return undefined;
  }
}

function parseCommittedScopeCommandRows(rows: unknown): CommittedScopeCommandRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (typeof row !== "object" || row === null) return [];
    const candidate = row as Record<string, unknown>;
    if (typeof candidate.command_id !== "string" || typeof candidate.command_json !== "string") return [];
    if (typeof candidate.committed_revision !== "number" && typeof candidate.committed_revision !== "bigint") return [];
    return [{
      command_id: candidate.command_id,
      command_json: candidate.command_json,
      committed_revision: toNumber(candidate.committed_revision),
    }];
  });
}

function isWorksheetScopeCommand(command: unknown): command is "confirm_initial_scope" | "auto_confirm_initial_scope" | "confirm_downstream_scope" {
  return command === "confirm_initial_scope"
    || command === "auto_confirm_initial_scope"
    || command === "confirm_downstream_scope";
}

function isWorksheetScopePayload(payload: unknown): payload is { readonly workbookHash: string; readonly worksheetNames: string[] } {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as { readonly workbookHash?: unknown; readonly worksheetNames?: unknown };
  return typeof candidate.workbookHash === "string"
    && SHA256_PATTERN.test(candidate.workbookHash)
    && Array.isArray(candidate.worksheetNames)
    && candidate.worksheetNames.length > 0
    && candidate.worksheetNames.every((name) => typeof name === "string")
    && new Set(candidate.worksheetNames).size === candidate.worksheetNames.length;
}

function sameWorksheetSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  if (rightSet.size !== right.length) return false;
  return left.every((name) => rightSet.has(name));
}

function assertNoNewLegacyDownstreamSelection(current: F8SessionSnapshot, next: F8SessionSnapshot): void {
  const nextSelection = next.downstreamScopeSelection;
  if (nextSelection === undefined || "decision" in nextSelection) return;
  const currentSelection = current.downstreamScopeSelection;
  const preservesHistoricalSelection = currentSelection !== undefined
    && !("decision" in currentSelection)
    && stringifyJson(currentSelection) === stringifyJson(nextSelection);
  if (!preservesHistoricalSelection) {
    throw createTypedError({
      code: "evidence_mismatch",
      summary: "New downstream selections require revision-bound evidence.",
      suggestedAction: "Materialize the downstream decision from the current validated Data Cleaning report.",
      affectedInputReferences: [next.sessionId],
    });
  }
}