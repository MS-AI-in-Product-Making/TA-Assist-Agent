export function createSeededAdoValidationHostAction({ actionId, sessionId, expectedRevision, confirmationHash, prepareRequest, expiresAt }) {
  return {
    contractVersion: "f8-host-action-request-v1",
    actionId,
    sessionId,
    expectedRevision,
    kind: "surface_validate",
    confirmationHash,
    expectedTargetVersion: "ado-decision-v1",
    prepareRequest,
    expiresAt,
  };
}