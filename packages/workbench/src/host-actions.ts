import { randomUUID, createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

import {
  createTypedError,
  hostActionClaimSchema,
  hostActionRequestSchema,
  hostActionResultSchema,
} from "@ai-assist/contracts";

import { resolveManagedWorkbenchPaths } from "./managed-paths.js";
import { CREATE_SESSION_STORE_SCHEMA_SQL } from "./session-store-schema.js";

type HostActionRequest = ReturnType<typeof hostActionRequestSchema.parse>;
type HostActionClaim = ReturnType<typeof hostActionClaimSchema.parse>;
type HostActionResult = ReturnType<typeof hostActionResultSchema.parse>;

type HostActionStatus = "pending" | "claimed" | "completed" | "blocked" | "failed";

interface HostActionRow {
  readonly session_id: string;
  readonly status: HostActionStatus;
  readonly request_json: string | null;
  readonly claim_json: string | null;
  readonly result_json: string | null;
  readonly expires_at: string | null;
  readonly lease_id: string | null;
  readonly lease_expires_at: string | null;
  readonly expected_revision: number | null;
  readonly confirmation_hash: string | null;
  readonly expected_target_version: string | null;
}

interface SessionRow {
  readonly session_id: string;
}

export interface HostActionStoreOptions {
  readonly rootDir: string;
  readonly sessionId: string;
  readonly leaseDurationMs?: number;
  readonly now?: () => Date;
}

export interface HostActionStore {
  createHostAction(request: HostActionRequest): Promise<HostActionRequest>;
  claimHostAction(actionId: string, hostInstanceId: string): Promise<HostActionClaim>;
  completeHostAction(result: HostActionResult): Promise<HostActionResult>;
  expireHostAction(actionId: string, leaseId: string): Promise<HostActionResult>;
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

  private readonly selectValidationActionStatement;

  private readonly now;

  private readonly leaseDurationMs;

  constructor(
    private readonly database: DatabaseSync,
    private readonly options: HostActionStoreOptions,
  ) {
    this.selectSessionStatement = this.database.prepare(`
      SELECT session_id
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
    this.selectValidationActionStatement = this.database.prepare(`
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
      WHERE session_id = ?
        AND status = 'completed'
        AND confirmation_hash = ?
        AND expected_target_version = ?
      ORDER BY updated_at DESC
    `);
    this.now = options.now ?? (() => new Date());
    this.leaseDurationMs = options.leaseDurationMs ?? 60_000;
    this.assertSessionExists();
  }

  async createHostAction(requestInput: HostActionRequest): Promise<HostActionRequest> {
    const request = hostActionRequestSchema.parse(requestInput);
    assertNonEmpty(request.actionId, "host action id");
    ensureSessionId(request.sessionId, this.options.sessionId, request.actionId);
    validateCreateRequest(request, this.now());

    this.database.exec("BEGIN IMMEDIATE");
    try {
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
        request.confirmationHash ?? null,
        request.expectedTargetVersion ?? null,
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
      enforceClaimable(row, request, this.now());

      if (request.kind === "surface_write") {
        ensureWriteValidationReady(this.selectValidationActionStatement, this.options.sessionId, request, actionId);
      }

      const leaseExpiresAt = new Date(this.now().getTime() + this.leaseDurationMs);
      const claim = hostActionClaimSchema.parse({
        contractVersion: "f8-host-action-claim-v1",
        actionId,
        hostInstanceId,
        leaseId: randomUUID(),
        leaseExpiresAt: toIso(leaseExpiresAt),
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
        confirmationHash: request.confirmationHash,
        expectedTargetVersion: request.expectedTargetVersion,
      }, this.now());

      this.database.exec("COMMIT");
      return claim;
    } catch (error) {
      rollbackQuietly(this.database);
      throw error;
    }
  }

  async completeHostAction(resultInput: HostActionResult): Promise<HostActionResult> {
    const result = hostActionResultSchema.parse(resultInput);

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const row = this.requireHostActionRow(result.actionId);
      const request = parseStoredRequest(row, result.actionId);

      if (isTerminalStatus(row.status)) {
        throw createTypedError({
          code: "policy_denied",
          summary: `Host action ${result.actionId} already reached terminal status ${row.status}.`,
          suggestedAction: "Create a new host action instead of writing a second terminal result.",
          affectedInputReferences: [result.actionId],
        });
      }

      if (row.status !== "claimed") {
        throw createTypedError({
          code: "prerequisite_not_ready",
          summary: `Host action ${result.actionId} must be claimed before completion.`,
          suggestedAction: "Claim the host action from one owner and then submit the terminal result once.",
          affectedInputReferences: [result.actionId],
        });
      }

      if (row.lease_id !== result.leaseId) {
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

      const claim = parseStoredClaim(row, result.actionId);
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
        confirmationHash: request.confirmationHash,
        expectedTargetVersion: request.expectedTargetVersion,
      }, this.now());

      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      rollbackQuietly(this.database);
      throw error;
    }
  }

  async expireHostAction(actionId: string, leaseId: string): Promise<HostActionResult> {
    assertNonEmpty(actionId, "host action id");
    assertNonEmpty(leaseId, "lease id");

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const row = this.requireHostActionRow(actionId);
      const request = parseStoredRequest(row, actionId);

      if (isTerminalStatus(row.status)) {
        throw createTypedError({
          code: "policy_denied",
          summary: `Host action ${actionId} already reached terminal status ${row.status}.`,
          suggestedAction: "Do not expire host actions after they already finished.",
          affectedInputReferences: [actionId],
        });
      }

      if (row.status !== "claimed") {
        throw createTypedError({
          code: "prerequisite_not_ready",
          summary: `Host action ${actionId} is not currently claimed.`,
          suggestedAction: "Only claimed host actions can be expired into a terminal result.",
          affectedInputReferences: [actionId],
        });
      }

      if (row.lease_id !== leaseId) {
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

      const claim = parseStoredClaim(row, actionId);
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
        confirmationHash: request.confirmationHash,
        expectedTargetVersion: request.expectedTargetVersion,
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

  private readHostActionRow(actionId: string): HostActionRow | undefined {
    return this.selectHostActionStatement.get(actionId) as HostActionRow | undefined;
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

function validateCreateRequest(request: HostActionRequest, now: Date): void {
  if (Date.parse(request.expiresAt) <= now.getTime()) {
    throw createTypedError({
      code: "validation_error",
      summary: `Host action ${request.actionId} expires in the past.`,
      suggestedAction: "Provide a future expiresAt for the host action request.",
      affectedInputReferences: [request.actionId],
    });
  }

  if (request.kind === "surface_write") {
    if (request.confirmationHash === undefined || request.expectedTargetVersion === undefined) {
      throw createTypedError({
        code: "validation_error",
        summary: `Surface write action ${request.actionId} requires confirmationHash and expectedTargetVersion.`,
        suggestedAction: "Bind the write request to the exact validated confirmation hash and target version.",
        affectedInputReferences: [request.actionId],
      });
    }
  }
}

function enforceClaimable(row: HostActionRow, request: HostActionRequest, now: Date): void {
  if (isTerminalStatus(row.status)) {
    throw createTypedError({
      code: "policy_denied",
      summary: `Host action ${request.actionId} already reached terminal status ${row.status}.`,
      suggestedAction: "Create a new host action instead of reusing a finished one.",
      affectedInputReferences: [request.actionId],
    });
  }

  if (row.status === "claimed") {
    throw createTypedError({
      code: "prerequisite_not_ready",
      summary: `Host action ${request.actionId} is already owned by another host lease.`,
      suggestedAction: isExpired(row.lease_expires_at, now)
        ? "Expire the claimed host action before attempting any new write or validation action."
        : "Wait for the current host lease to complete or expire.",
      affectedInputReferences: [request.actionId],
    });
  }

  if (isExpired(row.expires_at, now)) {
    throw createTypedError({
      code: "prerequisite_not_ready",
      summary: `Host action ${request.actionId} request expired before a host claimed it.`,
      suggestedAction: "Create a fresh host action request with a new actionId and future expiry.",
      affectedInputReferences: [request.actionId],
    });
  }
}

function ensureWriteValidationReady(
  statement: ReturnType<DatabaseSync["prepare"]>,
  sessionId: string,
  request: HostActionRequest,
  actionId: string,
): void {
  const rows = statement.all(
    sessionId,
    request.confirmationHash ?? null,
    request.expectedTargetVersion ?? null,
  ) as unknown as HostActionRow[];

  const matched = rows.some((row) => {
    if (row.result_json === null || row.request_json === null) {
      return false;
    }

    const candidateRequest = hostActionRequestSchema.parse(parseJson(row.request_json));
    const candidateResult = hostActionResultSchema.parse(parseJson(row.result_json));
    return candidateRequest.kind === "surface_validate"
      && candidateResult.status === "completed";
  });

  if (!matched) {
    throw createTypedError({
      code: "prerequisite_not_ready",
      summary: `Surface write action ${actionId} is missing a completed validation action for the same confirmation hash and target version.`,
      suggestedAction: "Complete the Surface validation action first, then create or claim a distinct write action.",
      affectedInputReferences: [actionId],
    });
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

function parseStoredRequest(row: HostActionRow, actionId: string): HostActionRequest {
  if (row.request_json === null) {
    throw createTypedError({
      code: "internal_error",
      summary: `Host action ${actionId} is missing its request payload.`,
      suggestedAction: "Recreate the host action because its stored request is incomplete.",
      affectedInputReferences: [actionId],
    });
  }
  return hostActionRequestSchema.parse(parseJson(row.request_json));
}

function parseStoredClaim(row: HostActionRow, actionId: string): HostActionClaim {
  if (row.claim_json === null) {
    throw createTypedError({
      code: "internal_error",
      summary: `Host action ${actionId} is missing its claim payload.`,
      suggestedAction: "Reclaim the host action with a fresh lease before continuing.",
      affectedInputReferences: [actionId],
    });
  }
  return hostActionClaimSchema.parse(parseJson(row.claim_json));
}

function createExpiredResult(request: HostActionRequest, claim: HostActionClaim, now: Date): HostActionResult {
  const reason = request.kind === "surface_write"
    ? "Write lease expired; manual reconciliation is required before any new Surface write action."
    : "Host action lease expired before completion.";

  return hostActionResultSchema.parse({
    contractVersion: "f8-host-action-result-v1",
    actionId: request.actionId,
    leaseId: claim.leaseId,
    status: "blocked",
    resultHash: sha256(stableStringify({
      actionId: request.actionId,
      leaseId: claim.leaseId,
      reason,
      expiredAt: toIso(now),
    })),
    payload: {
      status: "blocked",
      reason,
    },
  });
}

function parseJson(json: string): unknown {
  return JSON.parse(json) as unknown;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isTerminalStatus(status: HostActionStatus): status is "completed" | "blocked" | "failed" {
  return status === "completed" || status === "blocked" || status === "failed";
}

function isExpired(timestamp: string | null, now: Date): boolean {
  return timestamp !== null && Date.parse(timestamp) <= now.getTime();
}

function ensureSessionId(actual: string, expected: string, actionId: string): void {
  if (actual !== expected) {
    throw createTypedError({
      code: "validation_error",
      summary: `Host action ${actionId} targets ${actual}, expected ${expected}.`,
      suggestedAction: "Submit the host action against the matching session.",
      affectedInputReferences: [actionId, expected],
    });
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw createTypedError({
      code: "validation_error",
      summary: `${label} must not be empty.`,
      suggestedAction: `Provide a non-empty ${label}.`,
      affectedInputReferences: [label],
    });
  }
}

function toIso(date: Date): string {
  return new Date(date.getTime()).toISOString();
}

function rollbackQuietly(database: DatabaseSync): void {
  try {
    database.exec("ROLLBACK");
  } catch {
    // Ignore rollback failures after the primary error.
  }
}