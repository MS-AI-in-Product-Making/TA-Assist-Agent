import { createHash } from "node:crypto";

export type SurfaceMcpCapability =
  | "workItems.create"
  | "workItems.read"
  | "workItems.comments.read"
  | "workItems.comments.update";

export interface SurfaceMcpDrawingGovernanceClient {
  listCapabilities(): Promise<readonly SurfaceMcpCapability[]>;
  createWorkItem(input: { readonly title: string }): Promise<{ readonly workItemReference: string }>;
  readWorkItem(reference: string): Promise<{
    readonly version: string;
    readonly ownerReference?: string;
    readonly requestByReference?: string;
  }>;
  readCommentZero(reference: string): Promise<{
    readonly commentReference: string;
    readonly version: string;
    readonly content: string;
  }>;
  updateCommentZero(input: {
    readonly workItemReference: string;
    readonly commentReference: string;
    readonly expectedVersion: string;
    readonly content: string;
  }): Promise<{ readonly version: string }>;
}

export type SurfaceMcpPrepareRequest = {
  readonly mode: "existing";
  readonly workItemReference: string;
  readonly nextContent: string;
  readonly factorCount: number;
} | {
  readonly mode: "create";
  readonly title: string;
  readonly nextContent: string;
  readonly factorCount: number;
};

export interface SurfaceMcpConfirmationPayload {
  readonly status: "confirmation_required";
  readonly workItemReference: string;
  readonly ownerReference: string;
  readonly commentReference: string;
  readonly expectedVersion: string;
  readonly beforeContentHash: string;
  readonly nextContent: string;
  readonly factorCount: number;
  readonly confirmationHash: string;
  readonly diff: readonly {
    readonly before: string | null;
    readonly after: string | null;
    readonly changed: boolean;
  }[];
}

export type SurfaceMcpPrepareResult = SurfaceMcpConfirmationPayload | {
  readonly status: "blocked";
  readonly reasonCode: "surface_mcp_capability_missing" | "owner_reference_missing" | "comment_zero_unavailable";
  readonly missingCapabilities?: readonly SurfaceMcpCapability[];
  readonly workItemReference?: string;
};

export interface SurfaceMcpUpdateReceipt {
  readonly status: "updated";
  readonly workItemReference: string;
  readonly commentReference: string;
  readonly version: string;
  readonly contentHash: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableHash(parts: readonly string[]): string {
  return sha256(JSON.stringify(parts));
}

function createLineDiff(before: string, after: string) {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const length = Math.max(beforeLines.length, afterLines.length);
  return Array.from({ length }, (_, index) => ({
    before: beforeLines[index] ?? null,
    after: afterLines[index] ?? null,
    changed: beforeLines[index] !== afterLines[index],
  }));
}

function codedError(code: "validation_error" | "dependency_error", message: string): Error & { readonly code: typeof code } {
  return Object.assign(new Error(message), { code });
}

function nonempty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateRequest(input: SurfaceMcpPrepareRequest): void {
  if (!nonempty(input.nextContent) || !Number.isInteger(input.factorCount) || input.factorCount < 0) {
    throw codedError("validation_error", "Surface MCP prepare request is invalid.");
  }
  if (input.mode === "existing" && !nonempty(input.workItemReference)) {
    throw codedError("validation_error", "An existing Work Item reference is required.");
  }
  if (input.mode === "create" && !nonempty(input.title)) {
    throw codedError("validation_error", "A Work Item title is required.");
  }
}

export function createSurfaceMcpDrawingGovernanceAdapter(client: SurfaceMcpDrawingGovernanceClient) {
  return {
    async prepare(input: SurfaceMcpPrepareRequest): Promise<SurfaceMcpPrepareResult> {
      validateRequest(input);
      const capabilities = new Set(await client.listCapabilities());
      const required: SurfaceMcpCapability[] = [
        ...(input.mode === "create" ? ["workItems.create" as const] : []),
        "workItems.read",
        "workItems.comments.read",
        "workItems.comments.update",
      ];
      const missingCapabilities = required.filter((capability) => !capabilities.has(capability));
      if (missingCapabilities.length > 0) {
        return { status: "blocked", reasonCode: "surface_mcp_capability_missing", missingCapabilities };
      }

      const workItemReference = input.mode === "create"
        ? (await client.createWorkItem({ title: input.title })).workItemReference
        : input.workItemReference;
      const workItem = await client.readWorkItem(workItemReference);
      const ownerReference = nonempty(workItem.ownerReference)
        ? workItem.ownerReference
        : nonempty(workItem.requestByReference) ? workItem.requestByReference : undefined;
      if (ownerReference === undefined) {
        return { status: "blocked", reasonCode: "owner_reference_missing", workItemReference };
      }

      let comment;
      try {
        comment = await client.readCommentZero(workItemReference);
      } catch {
        return { status: "blocked", reasonCode: "comment_zero_unavailable", workItemReference };
      }
      if (!nonempty(comment.commentReference) || !nonempty(comment.version)) {
        return { status: "blocked", reasonCode: "comment_zero_unavailable", workItemReference };
      }
      const confirmationHash = stableHash([
        workItemReference,
        comment.commentReference,
        comment.version,
        input.nextContent,
      ]);
      return {
        status: "confirmation_required",
        workItemReference,
        ownerReference,
        commentReference: comment.commentReference,
        expectedVersion: comment.version,
        beforeContentHash: sha256(comment.content),
        nextContent: input.nextContent,
        factorCount: input.factorCount,
        confirmationHash,
        diff: createLineDiff(comment.content, input.nextContent),
      };
    },

    async execute(payload: SurfaceMcpConfirmationPayload): Promise<SurfaceMcpUpdateReceipt> {
      const expectedConfirmationHash = stableHash([
        payload.workItemReference,
        payload.commentReference,
        payload.expectedVersion,
        payload.nextContent,
      ]);
      if (payload.status !== "confirmation_required" || payload.confirmationHash !== expectedConfirmationHash) {
        throw codedError("validation_error", "Surface MCP confirmation payload does not match prepared content.");
      }

      let currentComment;
      try {
        currentComment = await client.readCommentZero(payload.workItemReference);
      } catch {
        throw codedError("dependency_error", "Comment 0 could not be read before update.");
      }
      if (currentComment.commentReference !== payload.commentReference
        || currentComment.version !== payload.expectedVersion
        || sha256(currentComment.content) !== payload.beforeContentHash) {
        throw codedError("dependency_error", "Comment 0 changed after confirmation was prepared.");
      }

      let updated;
      try {
        updated = await client.updateCommentZero({
          workItemReference: payload.workItemReference,
          commentReference: payload.commentReference,
          expectedVersion: payload.expectedVersion,
          content: payload.nextContent,
        });
      } catch {
        throw codedError("dependency_error", "Comment 0 update failed.");
      }
      return {
        status: "updated",
        workItemReference: payload.workItemReference,
        commentReference: payload.commentReference,
        version: updated.version,
        contentHash: sha256(payload.nextContent),
      };
    },
  };
}