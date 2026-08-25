import { createHash } from "node:crypto";

export interface ReviewContextIdentity {
  readonly workbookHash: string;
  readonly downstreamSelectionHash: string;
  readonly baselineRunReference: string;
}

export function createReviewContextId(identity: ReviewContextIdentity): string {
  return createHash("sha256")
    .update(JSON.stringify({
      workbookHash: identity.workbookHash,
      downstreamSelectionHash: identity.downstreamSelectionHash,
      baselineRunReference: identity.baselineRunReference,
    }))
    .digest("hex");
}