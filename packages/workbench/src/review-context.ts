import { createHash } from "node:crypto";

import type { ReviewContextId, ReviewContextIdentity } from "./review-context-types.js";

export type { ReviewContextId, ReviewContextIdentity } from "./review-context-types.js";

export function createReviewContextId(identity: ReviewContextIdentity): ReviewContextId {
  return createHash("sha256")
    .update(JSON.stringify({
      workbookHash: identity.workbookHash,
      downstreamSelectionHash: identity.downstreamSelectionHash,
      baselineRunReference: identity.baselineRunReference,
    }))
    .digest("hex") as ReviewContextId;
}