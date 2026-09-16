import { createHash } from "node:crypto";

export type SurfaceMcpCapability =
  | "workItems.create"
  | "workItems.read"
  | "workItems.comments.read"
  | "workItems.comments.update";

export interface SurfaceMcpDrawingGovernanceClient {
  listCapabilities(): Promise<readonly SurfaceMcpCapability[]>;
  createWorkItem(input: { readonly title: string; readonly sponsorEmail: string }): Promise<{ readonly workItemReference: string }>;
  readWorkItem(reference: string): Promise<{
    readonly version: string;
    readonly targetIdentity: TargetIdentity;
    readonly title?: string;
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
  readonly sponsorEmail: string;
  readonly workItemReference?: string | undefined;
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
  readonly reasonCode: "surface_mcp_capability_missing" | "owner_reference_missing" | "sponsor_assignment_mismatch" | "title_readback_mismatch" | "target_identity_mismatch" | "comment_zero_unavailable";
  readonly missingCapabilities?: readonly SurfaceMcpCapability[];
  readonly workItemReference?: string;
};

export interface TargetIdentity {
  readonly organization: string;
  readonly project: string;
  readonly workItemId: number;
}

export interface SurfaceMcpUpdateReceipt {
  readonly operation: "created" | "updated";
  readonly targetIdentity: TargetIdentity;
  readonly verifiedAt: string;
}

const preparedReceipts = new Map<string, Omit<SurfaceMcpUpdateReceipt, "verifiedAt">>();

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

function targetIdentityFromReference(reference: string): TargetIdentity | undefined {
  try {
    const url = new URL(reference);
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const marker = segments.findIndex((segment, index) => segment.toLowerCase() === "_workitems" && segments[index + 1]?.toLowerCase() === "edit");
    const organization = url.hostname.toLowerCase() === "dev.azure.com" ? segments[0] : url.hostname.split(".")[0];
    const project = url.hostname.toLowerCase() === "dev.azure.com" ? segments[1] : segments[0];
    const workItemId = marker < 0 ? Number.NaN : Number(segments[marker + 2]);
    if (url.protocol !== "https:" || !nonempty(organization) || !nonempty(project) || !Number.isInteger(workItemId) || workItemId <= 0) return undefined;
    return { organization, project, workItemId };
  } catch {
    return undefined;
  }
}

function sameTargetIdentity(left: TargetIdentity | undefined, right: TargetIdentity): boolean {
  return left !== undefined
    && left.organization === right.organization
    && left.project === right.project
    && left.workItemId === right.workItemId;
}

function validateRequest(input: SurfaceMcpPrepareRequest): void {
  if (!nonempty(input.nextContent) || !Number.isInteger(input.factorCount) || input.factorCount < 0) {
    throw codedError("validation_error", "Surface MCP prepare request is invalid.");
  }
  if (input.mode === "existing" && !nonempty(input.workItemReference)) {
    throw codedError("validation_error", "An existing Work Item reference is required.");
  }
  if (input.mode === "create" && (!nonempty(input.title) || !isEmail(input.sponsorEmail))) {
    throw codedError("validation_error", "A Work Item title and valid sponsor email are required.");
  }
}

export function createSurfaceMcpDrawingGovernanceAdapter(client: SurfaceMcpDrawingGovernanceClient) {
  return {
    async prepare(input: SurfaceMcpPrepareRequest): Promise<SurfaceMcpPrepareResult> {
      validateRequest(input);
      const capabilities = new Set(await client.listCapabilities());
      const required: SurfaceMcpCapability[] = [
        ...(input.mode === "create" && input.workItemReference === undefined ? ["workItems.create" as const] : []),
        "workItems.read",
        "workItems.comments.read",
        "workItems.comments.update",
      ];
      const missingCapabilities = required.filter((capability) => !capabilities.has(capability));
      if (missingCapabilities.length > 0) {
        return { status: "blocked", reasonCode: "surface_mcp_capability_missing", missingCapabilities };
      }

      let workItemReference: string;
      if (input.mode === "existing") {
        workItemReference = input.workItemReference;
      } else if (input.workItemReference !== undefined) {
        workItemReference = input.workItemReference;
      } else {
        workItemReference = (await client.createWorkItem({ title: input.title, sponsorEmail: input.sponsorEmail })).workItemReference;
      }
      const workItem = await client.readWorkItem(workItemReference);
      if (!sameTargetIdentity(targetIdentityFromReference(workItemReference), workItem.targetIdentity)) {
        return { status: "blocked", reasonCode: "target_identity_mismatch", workItemReference };
      }
      if (input.mode === "create" && workItem.title !== input.title) {
        return { status: "blocked", reasonCode: "title_readback_mismatch", workItemReference };
      }
      if (input.mode === "create" && workItem.ownerReference?.trim().toLowerCase() !== input.sponsorEmail.trim().toLowerCase()) {
        return { status: "blocked", reasonCode: "sponsor_assignment_mismatch", workItemReference };
      }
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
      preparedReceipts.set(confirmationHash, {
        operation: input.mode === "create" ? "created" : "updated",
        targetIdentity: workItem.targetIdentity,
      });
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
      const preparedReceipt = preparedReceipts.get(payload.confirmationHash);
      if (preparedReceipt === undefined) {
        throw codedError("validation_error", "Surface MCP confirmation payload has no verified target identity.");
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

      try {
        await client.updateCommentZero({
          workItemReference: payload.workItemReference,
          commentReference: payload.commentReference,
          expectedVersion: payload.expectedVersion,
          content: payload.nextContent,
        });
      } catch {
        throw codedError("dependency_error", "Comment 0 update failed.");
      }
      preparedReceipts.delete(payload.confirmationHash);
      return {
        ...preparedReceipt,
        verifiedAt: new Date().toISOString(),
      };
    },
  };
}

function isEmail(value: string | undefined): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim());
}