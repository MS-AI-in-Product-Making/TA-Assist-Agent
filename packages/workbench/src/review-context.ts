import { createHash } from "node:crypto";

import type { ReviewContextId, ReviewContextIdentity } from "./review-context-types.js";

export type { ReviewContextId, ReviewContextIdentity } from "./review-context-types.js";

export function canonicalSelectedWorksheetSetHash(worksheetNames: readonly string[]): string {
  const canonical = [...new Set(worksheetNames)].sort((left, right) => left.localeCompare(right));
  if (canonical.length === 0 || canonical.some((name) => name.length === 0)) {
    throw new Error("Downstream worksheet selection is invalid.");
  }
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function createReviewContextId(identity: ReviewContextIdentity): ReviewContextId {
  return createHash("sha256")
    .update(JSON.stringify({
      workbookHash: identity.workbookHash,
      downstreamSelectionHash: identity.downstreamSelectionHash,
      baselineRunReference: identity.baselineRunReference,
    }))
    .digest("hex") as ReviewContextId;
}