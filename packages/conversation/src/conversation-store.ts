import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync, StatementSync } from "node:sqlite";

import { createTypedError, conversationTurnSchema } from "@ai-assist/contracts";

export type ConversationTurn = ReturnType<typeof conversationTurnSchema.parse>;

export interface ConversationStoreOptions {
  readonly rootDir: string;
}

export interface ConversationStore {
  appendTurn(turn: ConversationTurn, commandId: string): Promise<ConversationTurn>;
  readTurns(sessionId: string, options?: { readonly afterSequence?: number }): Promise<readonly ConversationTurn[]>;
  advanceCursor(sessionId: string, consumerId: string, sequence: number): Promise<number>;
  readCursor(sessionId: string, consumerId: string): Promise<number | null>;
  close(): Promise<void>;
}

const CONVERSATION_DIRECTORY = "conversation";
const DATABASE_FILENAME = "conversation.sqlite";
const SAFE_CONSUMER_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export const CREATE_CONVERSATION_STORE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS conversation_turns (
  turn_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  source TEXT NOT NULL,
  role TEXT NOT NULL,
  turn_json TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  related_stage TEXT,
  related_artifact_ids_json TEXT NOT NULL,
  decision_reference TEXT,
  command_id TEXT NOT NULL UNIQUE
) STRICT;

CREATE INDEX IF NOT EXISTS conversation_turns_by_session_sequence
ON conversation_turns(session_id, sequence, turn_id);

CREATE TABLE IF NOT EXISTS conversation_cursors (
  session_id TEXT NOT NULL,
  consumer_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(session_id, consumer_id)
) STRICT;
`;

type ConversationTurnRow = {
  readonly turn_json: string;
  readonly command_id: string;
};

type ConversationCursorRow = {
  readonly sequence: number;
};

export async function createConversationStore(options: ConversationStoreOptions): Promise<ConversationStore> {
  const store = await initializeStore(options.rootDir);
  return store;
}

async function initializeStore(rootDir: string): Promise<SqliteConversationStore> {
  const conversationRoot = join(rootDir, CONVERSATION_DIRECTORY);
  await mkdir(conversationRoot, { recursive: true });

  const database = new DatabaseSync(join(conversationRoot, DATABASE_FILENAME), {
    enableForeignKeyConstraints: true,
    timeout: 5_000,
  });

  try {
    database.exec("PRAGMA journal_mode = WAL;");
    database.exec("PRAGMA synchronous = FULL;");
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec(CREATE_CONVERSATION_STORE_SCHEMA_SQL);
    return new SqliteConversationStore(database);
  } catch (error) {
    database.close();
    throw error;
  }
}

class SqliteConversationStore implements ConversationStore {
  private readonly selectTurnByCommandStatement: StatementSync;

  private readonly selectTurnByTurnIdStatement: StatementSync;

  private readonly insertTurnStatement: StatementSync;

  private readonly selectTurnsBySessionStatement: StatementSync;

  private readonly selectMaxSequenceStatement: StatementSync;

  private readonly selectCursorStatement: StatementSync;

  private readonly upsertCursorStatement: StatementSync;

  constructor(private readonly database: DatabaseSync) {
    this.selectTurnByCommandStatement = this.database.prepare(`
      SELECT turn_json, command_id
      FROM conversation_turns
      WHERE command_id = ?
    `);
    this.selectTurnByTurnIdStatement = this.database.prepare(`
      SELECT turn_json, command_id
      FROM conversation_turns
      WHERE turn_id = ?
    `);
    this.insertTurnStatement = this.database.prepare(`
      INSERT INTO conversation_turns(
        turn_id,
        session_id,
        sequence,
        source,
        role,
        turn_json,
        content_json,
        created_at,
        related_stage,
        related_artifact_ids_json,
        decision_reference,
        command_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.selectTurnsBySessionStatement = this.database.prepare(`
      SELECT turn_json
      FROM conversation_turns
      WHERE session_id = ? AND sequence > ?
      ORDER BY sequence ASC, turn_id ASC
    `);
    this.selectMaxSequenceStatement = this.database.prepare(`
      SELECT COALESCE(MAX(sequence), 0) AS sequence
      FROM conversation_turns
      WHERE session_id = ?
    `);
    this.selectCursorStatement = this.database.prepare(`
      SELECT sequence
      FROM conversation_cursors
      WHERE session_id = ? AND consumer_id = ?
    `);
    this.upsertCursorStatement = this.database.prepare(`
      INSERT INTO conversation_cursors(session_id, consumer_id, sequence, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(session_id, consumer_id) DO UPDATE SET
        sequence = excluded.sequence,
        updated_at = excluded.updated_at
    `);
  }

  async appendTurn(turnInput: ConversationTurn, commandId: string): Promise<ConversationTurn> {
    const turn = parseConversationTurn(turnInput);
    ensureNonEmptyString(commandId, "command id");

    this.database.exec("BEGIN IMMEDIATE");

    try {
      const existingCommandTurn = this.readTurnByCommandId(commandId);
      if (existingCommandTurn !== undefined) {
        ensureSameTurn(existingCommandTurn, turn, `Command ${commandId} already recorded a different turn.`);
        this.database.exec("COMMIT");
        return existingCommandTurn;
      }

      const existingTurn = this.readTurnByTurnId(turn.turnId);
      if (existingTurn !== undefined) {
        ensureSameTurn(existingTurn, turn, `Turn ${turn.turnId} already exists.`);
        throw createConversationValidationError(
          `Turn ${turn.turnId} already exists with a different command receipt.`,
          turn.turnId,
        );
      }

      const maxSequence = this.readMaxSequence(turn.sessionId);
      if (turn.sequence <= maxSequence) {
        throw createConversationValidationError(
          `Turn ${turn.turnId} has sequence ${turn.sequence}, which is not greater than the current maximum ${maxSequence}.`,
          turn.turnId,
        );
      }

      this.insertTurnStatement.run(
        turn.turnId,
        turn.sessionId,
        turn.sequence,
        turn.source,
        turn.role,
        stringifyJson(turn),
        stringifyJson(turn.content),
        turn.createdAt,
        turn.relatedStage ?? null,
        stringifyJson(turn.relatedArtifactIds),
        turn.decisionReference ?? null,
        commandId,
      );

      this.database.exec("COMMIT");
      return turn;
    } catch (error) {
      rollbackQuietly(this.database);
      throw error;
    }
  }

  async readTurns(sessionId: string, options?: { readonly afterSequence?: number }): Promise<readonly ConversationTurn[]> {
    ensureNonEmptyString(sessionId, "session id");
    const afterSequence = normalizeSequence(options?.afterSequence ?? 0, "afterSequence");
    const turns: ConversationTurn[] = [];
    for (const row of this.selectTurnsBySessionStatement.iterate(sessionId, afterSequence) as Iterable<ConversationTurnRow>) {
      turns.push(parseTurnRow(row));
    }

    return turns;
  }

  async advanceCursor(sessionId: string, consumerId: string, sequence: number): Promise<number> {
    ensureNonEmptyString(sessionId, "session id");
    ensureSafeConsumerId(consumerId);
    const targetSequence = normalizeSequence(sequence, "sequence");

    this.database.exec("BEGIN IMMEDIATE");

    try {
      const current = this.readCursorRow(sessionId, consumerId);
      const nextSequence = current === undefined || targetSequence > current.sequence ? targetSequence : current.sequence;

      if (current === undefined || nextSequence !== current.sequence) {
        this.upsertCursorStatement.run(sessionId, consumerId, nextSequence, new Date().toISOString());
      }

      this.database.exec("COMMIT");
      return nextSequence;
    } catch (error) {
      rollbackQuietly(this.database);
      throw error;
    }
  }

  async readCursor(sessionId: string, consumerId: string): Promise<number | null> {
    ensureNonEmptyString(sessionId, "session id");
    ensureSafeConsumerId(consumerId);
    return this.readCursorRow(sessionId, consumerId)?.sequence ?? null;
  }

  async close(): Promise<void> {
    this.database.close();
  }

  private readTurnByCommandId(commandId: string): ConversationTurn | undefined {
    const row = this.selectTurnByCommandStatement.get(commandId) as ConversationTurnRow | undefined;
    return row === undefined ? undefined : parseTurnRow(row);
  }

  private readTurnByTurnId(turnId: string): ConversationTurn | undefined {
    const row = this.selectTurnByTurnIdStatement.get(turnId) as ConversationTurnRow | undefined;
    return row === undefined ? undefined : parseTurnRow(row);
  }

  private readMaxSequence(sessionId: string): number {
    const row = this.selectMaxSequenceStatement.get(sessionId) as ConversationCursorRow | undefined;
    return row?.sequence ?? 0;
  }

  private readCursorRow(sessionId: string, consumerId: string): ConversationCursorRow | undefined {
    return this.selectCursorStatement.get(sessionId, consumerId) as ConversationCursorRow | undefined;
  }
}

function parseConversationTurn(turnInput: ConversationTurn): ConversationTurn {
  const parsed = conversationTurnSchema.safeParse(turnInput);
  if (!parsed.success) {
    throw createConversationValidationError("Conversation turn is invalid.", getTurnReference(turnInput));
  }

  return parsed.data;
}

function parseTurnRow(row: ConversationTurnRow): ConversationTurn {
  const parsedJson = safeJsonParse(row.turn_json);
  const parsed = conversationTurnSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw createTypedError({
      code: "internal_error",
      summary: `Persisted conversation turn for command ${row.command_id} is invalid.`,
      suggestedAction: "Repair the conversation store or recreate the session database.",
      affectedInputReferences: [row.command_id],
    });
  }

  return parsed.data;
}

function ensureSameTurn(existing: ConversationTurn, candidate: ConversationTurn, summary: string): void {
  if (stringifyJson(existing) !== stringifyJson(candidate)) {
    throw createConversationValidationError(summary, candidate.turnId);
  }
}

function normalizeSequence(sequence: number, label: string): number {
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw createConversationValidationError(`${label} must be a non-negative integer.`, label);
  }

  return sequence;
}

function ensureSafeConsumerId(consumerId: string): void {
  ensureNonEmptyString(consumerId, "consumer id");
  if (!SAFE_CONSUMER_ID_PATTERN.test(consumerId)) {
    throw createConversationValidationError(
      "consumer id must use only letters, numbers, dots, underscores, colons, or dashes.",
      consumerId,
    );
  }
}

function ensureNonEmptyString(value: string, label: string): void {
  if (value.length === 0) {
    throw createConversationValidationError(`${label} must not be empty.`, label);
  }
}

function createConversationValidationError(summary: string, reference: string) {
  return createTypedError({
    code: "validation_error",
    summary,
    suggestedAction: "Submit a schema-valid conversation turn, command receipt, or cursor update and retry.",
    affectedInputReferences: [reference],
  });
}

function rollbackQuietly(database: DatabaseSync): void {
  try {
    database.exec("ROLLBACK");
  } catch {
    // Ignore rollback failures when the transaction already ended.
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw createTypedError({
      code: "internal_error",
      summary: "Persisted conversation payload is not valid JSON.",
      suggestedAction: "Repair or recreate the conversation store.",
      affectedInputReferences: [value.slice(0, 64)],
    });
  }
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value);
}

function getTurnReference(turn: ConversationTurn | unknown): string {
  if (typeof turn === "object" && turn !== null && "turnId" in turn && typeof turn.turnId === "string") {
    return turn.turnId;
  }

  return "<unknown-turn>";
}