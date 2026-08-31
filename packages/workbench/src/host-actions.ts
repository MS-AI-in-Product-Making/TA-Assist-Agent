import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  createTypedError,
  hostActionClaimSchema,
  hostActionRequestSchema,
  hostActionResultSchema,
} from "@ai-assist/contracts";

import {
  assertNonEmpty,
  createExpiredResult,
  enforceClaimable,
  ensureExpectedRevisionCurrent,
  ensureSessionId,
  ensureWriteValidationMatches,
  HostActionClaim,
  HostActionRequest,
  HostActionResult,
  HostActionRow,
  HostActionStatus,
  isExpired,
  isTerminalStatus,
  parseStoredClaim,
  parseStoredRequest,
  parseStoredResult,
  rollbackQuietly,
  stableStringify,
  toIso,
  validateCreateRequest,
} from "./host-action-support.js";
import { resolveManagedWorkbenchPaths } from "./managed-paths.js";
import { CREATE_SESSION_STORE_SCHEMA_SQL } from "./session-store-schema.js";

interface SessionRow {
  readonly session_id: string;
  readonly revision: number;
}

export interface HostActionStoreOptions {
  readonly rootDir: string;
  readonly sessionId: string;
  readonly leaseDurationMs?: number;
  readonly terminalRetentionMs?: number;
  readonly now?: () => Date;
}

export interface HostActionRecord {
  readonly actionId: string;
  readonly sessionId: string;
  readonly status: HostActionStatus;
  readonly request: HostActionRequest;
  readonly claim: HostActionClaim | undefined;
  readonly result: HostActionResult | undefined;
  readonly expiresAt: string;
  readonly leaseId: string | undefined;
  readonly leaseExpiresAt: string | undefined;
  readonly expectedRevision: number;
  readonly confirmationHash: string | undefined;
  readonly expectedTargetVersion: string | undefined;
}

export interface HostActionStore {
  createHostAction(request: HostActionRequest): Promise<HostActionRequest>;
  getHostAction(actionId: string): Promise<HostActionRecord>;
  claimHostAction(actionId: string, hostInstanceId: string): Promise<HostActionClaim>;
  completeHostAction(result: HostActionResult): Promise<HostActionResult>;
  expireHostAction(actionId: string, hostInstanceId: string, leaseId: string): Promise<HostActionResult>;
  close(): Promise<void>;
}

export async function createHostActionStore(options: HostActionStoreOptions): Promise<HostActionStore> {
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
    return new SqliteHostActionStore(database, options);
  } catch (error) {
    database.close();
    throw error;
  }
}

class SqliteHostActionStore implements HostActionStore {
  private readonly selectSessionStatement;

  private readonly selectHostActionStatement;

  private readonly insertHostActionStatement;

  private readonly updateHostActionStatement;

  private readonly selectSessionHostActionStatement;

  private readonly deleteExpiredTerminalHostActionStatement;

  private readonly now;

  private readonly leaseDurationMs;

  private readonly terminalRetentionMs;

  constructor(
    private readonly database: DatabaseSync,
    private readonly options: HostActionStoreOptions,
  ) {
    this.selectSessionStatement = this.database.prepare(`
      SELECT session_id, revision
      FROM sessions
      WHERE session_id = ?
    `);
    this.selectHostActionStatement = this.database.prepare(`
      SELECT
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
        expected_target_version
      FROM host_actions
      WHERE action_id = ?
    `);
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
    this.updateHostActionStatement = this.database.prepare(`
      UPDATE host_actions
      SET
        status = ?,
        request_json = ?,
        claim_json = ?,
        result_json = ?,
        expires_at = ?,
        lease_id = ?,
        lease_expires_at = ?,
        expected_revision = ?,
        confirmation_hash = ?,
        expected_target_version = ?,
        updated_at = ?
      WHERE action_id = ? AND session_id = ?
    `);
    this.selectSessionHostActionStatement = this.database.prepare(`
      SELECT
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
        expected_target_version
      FROM host_actions
      WHERE action_id = ?
        AND session_id = ?
    `);
    this.deleteExpiredTerminalHostActionStatement = this.database.prepare(`
      DELETE FROM host_actions
      WHERE action_id = ? AND session_id = ?
        AND status IN ('completed', 'failed', 'blocked', 'cancelled')
        AND updated_at <= ?
    `);
    this.now = options.now ?? (() => new Date());
    this.leaseDurationMs = options.leaseDurationMs ?? 60_000;
    this.terminalRetentionMs = options.terminalRetentionMs ?? 24 * 60 * 60 * 1_000;
    this.assertSessionExists();
  }

  async createHostAction(requestInput: HostActionRequest): Promise<HostActionRequest> {
    const request = hostActionRequestSchema.parse(requestInput);
    assertNonEmpty(request.actionId, "host action id");
    ensureSessionId(request.sessionId, this.options.sessionId, request.actionId);
    validateCreateRequest(request, this.now());

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const sessionRow = this.requireSessionRow();
      ensureExpectedRevisionCurrent(request.expectedRevision, sessionRow.revision, request.actionId);

      this.deleteExpiredTerminalHostActionStatement.run(
        request.actionId,
        this.options.sessionId,
        toIso(new Date(this.now().getTime() - this.terminalRetentionMs)),
      );
      const existingRow = this.readHostActionRow(request.actionId);
      const requestJson = stableStringify(request);
      if (existingRow !== undefined) {
        const existingRequest = parseStoredRequest(existingRow, request.actionId);
        if (stableStringify(existingRequest) !== requestJson) {
          throw createTypedError({
            code: "validation_error",
            summary: `Host action ${request.actionId} already exists with different content.`,
            suggestedAction: "Use a distinct actionId for each host action request.",
            affectedInputReferences: [request.actionId],
          });
        }

        this.database.exec("COMMIT");
        return existingRequest;
      }

      this.insertHostActionStatement.run(
        request.actionId,
        this.options.sessionId,
        "pending",
        requestJson,
        null,
        null,
        request.expiresAt,
        null,
        null,
        request.expectedRevision,
        readConfirmationHash(request),
        readExpectedTargetVersion(request),
        toIso(this.now()),
      );

      this.database.exec("COMMIT");
      return request;
    } catch (error) {
      rollbackQuietly(this.database);
      throw error;
    }
  }

  async claimHostAction(actionId: string, hostInstanceId: string): Promise<HostActionClaim> {
    assertNonEmpty(actionId, "host action id");
    assertNonEmpty(hostInstanceId, "host instance id");

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const row = this.requireHostActionRow(actionId);
      const request = parseStoredRequest(row, actionId);
      const sessionRow = this.requireSessionRow();
      ensureExpectedRevisionCurrent(request.expectedRevision, sessionRow.revision, actionId);
      enforceClaimable(row, request, this.now());

      if (request.kind === "surface_write") {
        ensureWriteValidationMatches(this.readSessionHostActionRow(request.validationActionId), request, actionId);
      }

      const leaseExpiresAt = new Date(this.now().getTime() + this.leaseDurationMs);
      const claim = hostActionClaimSchema.parse({
        contractVersion: "f8-host-action-claim-v1",
        actionId,
        hostInstanceId,
        leaseId: randomUUID(),
        leaseExpiresAt: toIso(leaseExpiresAt),
        request,
      });

      persistHostAction(this.updateHostActionStatement, {
        actionId,
        sessionId: this.options.sessionId,
        status: "claimed",
        request,
        claim,
        result: undefined,
        expiresAt: request.expiresAt,
        leaseId: claim.leaseId,
        leaseExpiresAt: claim.leaseExpiresAt,
        expectedRevision: request.expectedRevision,
        confirmationHash: readConfirmationHash(request) ?? undefined,
        expectedTargetVersion: readExpectedTargetVersion(request) ?? undefined,
      }, this.now());

      this.database.exec("COMMIT");
      return claim;
    } catch (error) {
      rollbackQuietly(this.database);
      throw error;
    }
  }

  async getHostAction(actionId: string): Promise<HostActionRecord> {
    assertNonEmpty(actionId, "host action id");

    const row = this.requireHostActionRow(actionId);
    return toHostActionRecord(row, actionId);
  }

  async completeHostAction(resultInput: HostActionResult): Promise<HostActionResult> {
    const result = hostActionResultSchema.parse(resultInput);

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const row = this.requireHostActionRow(result.actionId);
      if (isTerminalStatus(row.status)) {
        throw createTypedError({
          code: "policy_denied",
          summary: `Host action ${result.actionId} already reached terminal status ${row.status}.`,
          suggestedAction: "Create a new host action instead of writing a second terminal result.",
          affectedInputReferences: [result.actionId],
        });
      }

      const request = parseStoredRequest(row, result.actionId);
      const sessionRow = this.requireSessionRow();
      ensureExpectedRevisionCurrent(request.expectedRevision, sessionRow.revision, result.actionId);

      if (row.status !== "claimed") {
        throw createTypedError({
          code: "prerequisite_not_ready",
          summary: `Host action ${result.actionId} must be claimed before completion.`,
          suggestedAction: "Claim the host action from one owner and then submit the terminal result once.",
          affectedInputReferences: [result.actionId],
        });
      }

      const claim = parseStoredClaim(row, result.actionId);
      if (claim.hostInstanceId !== result.hostInstanceId) {
        throw createTypedError({
          code: "validation_error",
          summary: `Host action ${result.actionId} host ${result.hostInstanceId} does not match the active owner ${claim.hostInstanceId}.`,
          suggestedAction: "Submit the completion from the same hostInstanceId that claimed the host action.",
          affectedInputReferences: [result.actionId, result.hostInstanceId],
        });
      }

      if (claim.leaseId !== result.leaseId) {
        throw createTypedError({
          code: "validation_error",
          summary: `Host action ${result.actionId} lease ${result.leaseId} does not match the active owner lease.`,
          suggestedAction: "Submit the completion with the exact leaseId returned by claimHostAction.",
          affectedInputReferences: [result.actionId, result.leaseId],
        });
      }

      if (isExpired(row.lease_expires_at, this.now())) {
        throw createTypedError({
          code: "prerequisite_not_ready",
          summary: `Host action ${result.actionId} lease expired before completion.`,
          suggestedAction: request.kind === "surface_write"
            ? "Expire the write action and reconcile manually before creating a fresh write request."
            : "Expire the action and create a fresh host action if the work should continue.",
          affectedInputReferences: [result.actionId, result.leaseId],
        });
      }

      persistHostAction(this.updateHostActionStatement, {
        actionId: result.actionId,
        sessionId: this.options.sessionId,
        status: result.status,
        request,
        claim,
        result,
        expiresAt: request.expiresAt,
        leaseId: claim.leaseId,
        leaseExpiresAt: claim.leaseExpiresAt,
        expectedRevision: request.expectedRevision,
        confirmationHash: readConfirmationHash(request) ?? undefined,
        expectedTargetVersion: readExpectedTargetVersion(request) ?? undefined,
      }, this.now());

      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      rollbackQuietly(this.database);
      throw error;
    }
  }

  async expireHostAction(actionId: string, hostInstanceId: string, leaseId: string): Promise<HostActionResult> {
    assertNonEmpty(actionId, "host action id");
    assertNonEmpty(hostInstanceId, "host instance id");
    assertNonEmpty(leaseId, "lease id");

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const row = this.requireHostActionRow(actionId);
      if (isTerminalStatus(row.status)) {
        throw createTypedError({
          code: "policy_denied",
          summary: `Host action ${actionId} already reached terminal status ${row.status}.`,
          suggestedAction: "Do not expire host actions after they already finished.",
          affectedInputReferences: [actionId],
        });
      }

      const request = parseStoredRequest(row, actionId);
      const sessionRow = this.requireSessionRow();
      ensureExpectedRevisionCurrent(request.expectedRevision, sessionRow.revision, actionId);

      if (row.status !== "claimed") {
        throw createTypedError({
          code: "prerequisite_not_ready",
          summary: `Host action ${actionId} is not currently claimed.`,
          suggestedAction: "Only claimed host actions can be expired into a terminal result.",
          affectedInputReferences: [actionId],
        });
      }

      const claim = parseStoredClaim(row, actionId);
      if (claim.hostInstanceId !== hostInstanceId) {
        throw createTypedError({
          code: "validation_error",
          summary: `Host action ${actionId} host ${hostInstanceId} does not match the active owner ${claim.hostInstanceId}.`,
          suggestedAction: "Expire the action from the same hostInstanceId that claimed it.",
          affectedInputReferences: [actionId, hostInstanceId],
        });
      }

      if (claim.leaseId !== leaseId) {
        throw createTypedError({
          code: "validation_error",
          summary: `Host action ${actionId} lease ${leaseId} does not match the active owner lease.`,
          suggestedAction: "Expire the action with the exact leaseId returned by claimHostAction.",
          affectedInputReferences: [actionId, leaseId],
        });
      }

      if (!isExpired(row.lease_expires_at, this.now())) {
        throw createTypedError({
          code: "prerequisite_not_ready",
          summary: `Host action ${actionId} lease has not expired yet.`,
          suggestedAction: "Wait until the lease expires before marking the action as expired.",
          affectedInputReferences: [actionId, leaseId],
        });
      }

      const result = createExpiredResult(request, claim, this.now());

      persistHostAction(this.updateHostActionStatement, {
        actionId,
        sessionId: this.options.sessionId,
        status: result.status,
        request,
        claim,
        result,
        expiresAt: request.expiresAt,
        leaseId: claim.leaseId,
        leaseExpiresAt: claim.leaseExpiresAt,
        expectedRevision: request.expectedRevision,
        confirmationHash: readConfirmationHash(request) ?? undefined,
        expectedTargetVersion: readExpectedTargetVersion(request) ?? undefined,
      }, this.now());

      this.database.exec("COMMIT");
      return result;
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

  private assertSessionExists(): void {
    const row = this.selectSessionStatement.get(this.options.sessionId) as SessionRow | undefined;
    if (row === undefined) {
      throw createTypedError({
        code: "validation_error",
        summary: `Session ${this.options.sessionId} does not exist.`,
        suggestedAction: "Create the session before managing host actions.",
        affectedInputReferences: [this.options.sessionId],
      });
    }
  }

  private requireSessionRow(): SessionRow {
    const row = this.selectSessionStatement.get(this.options.sessionId) as SessionRow | undefined;
    if (row === undefined) {
      throw createTypedError({
        code: "validation_error",
        summary: `Session ${this.options.sessionId} does not exist.`,
        suggestedAction: "Create the session before managing host actions.",
        affectedInputReferences: [this.options.sessionId],
      });
    }

    return row;
  }

  private readHostActionRow(actionId: string): HostActionRow | undefined {
    return this.selectHostActionStatement.get(actionId) as HostActionRow | undefined;
  }

  private readSessionHostActionRow(actionId: string): HostActionRow | undefined {
    return this.selectSessionHostActionStatement.get(actionId, this.options.sessionId) as HostActionRow | undefined;
  }

  private requireHostActionRow(actionId: string): HostActionRow {
    const row = this.readHostActionRow(actionId);
    if (row === undefined) {
      throw createTypedError({
        code: "validation_error",
        summary: `Host action ${actionId} does not exist.`,
        suggestedAction: "Create the host action before claiming or completing it.",
        affectedInputReferences: [actionId],
      });
    }
    if (row.session_id !== this.options.sessionId) {
      throw createTypedError({
        code: "validation_error",
        summary: `Host action ${actionId} belongs to ${row.session_id}, expected ${this.options.sessionId}.`,
        suggestedAction: "Open the host action from the correct session.",
        affectedInputReferences: [actionId, this.options.sessionId],
      });
    }

    return row;
  }
}

function persistHostAction(
  statement: ReturnType<DatabaseSync["prepare"]>,
  action: {
    readonly actionId: string;
    readonly sessionId: string;
    readonly status: HostActionStatus;
    readonly request: HostActionRequest;
    readonly claim: HostActionClaim | undefined;
    readonly result: HostActionResult | undefined;
    readonly expiresAt: string;
    readonly leaseId: string | undefined;
    readonly leaseExpiresAt: string | undefined;
    readonly expectedRevision: number;
    readonly confirmationHash: string | undefined;
    readonly expectedTargetVersion: string | undefined;
  },
  now: Date,
): void {
  statement.run(
    action.status,
    stableStringify(action.request),
    action.claim === undefined ? null : stableStringify(action.claim),
    action.result === undefined ? null : stableStringify(action.result),
    action.expiresAt,
    action.leaseId ?? null,
    action.leaseExpiresAt ?? null,
    action.expectedRevision,
    action.confirmationHash ?? null,
    action.expectedTargetVersion ?? null,
    toIso(now),
    action.actionId,
    action.sessionId,
  );
}

function toHostActionRecord(row: HostActionRow, actionId: string): HostActionRecord {
  const request = parseStoredRequest(row, actionId);
  return {
    actionId,
    sessionId: row.session_id,
    status: row.status,
    request,
    claim: row.claim_json === null ? undefined : parseStoredClaim(row, actionId),
    result: row.result_json === null ? undefined : parseStoredResult(row, actionId),
    expiresAt: request.expiresAt,
    leaseId: row.lease_id ?? undefined,
    leaseExpiresAt: row.lease_expires_at ?? undefined,
    expectedRevision: row.expected_revision ?? request.expectedRevision,
    confirmationHash: row.confirmation_hash ?? undefined,
    expectedTargetVersion: row.expected_target_version ?? undefined,
  };
}

function readConfirmationHash(request: HostActionRequest): string | null {
  return request.kind === "model_request" ? null : request.confirmationHash;
}

function readExpectedTargetVersion(request: HostActionRequest): string | null {
  return request.kind === "model_request" ? null : request.expectedTargetVersion;
}
