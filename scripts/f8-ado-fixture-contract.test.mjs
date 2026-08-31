import { describe, expect, it } from "vitest";

import { hostActionRequestSchema } from "@ai-assist/contracts";
import { createSeededAdoValidationHostAction } from "../test/f8-e2e/ado-fixture-contract.mjs";

describe("F8 ADO E2E fixture contract", () => {
  it("uses the production ADO HostAction target version and parses through the real contract", () => {
    const action = createSeededAdoValidationHostAction({
      actionId: "ado-validation:fixture:2",
      sessionId: "80808080-8080-4808-8808-808080808080",
      expectedRevision: 2,
      confirmationHash: "a".repeat(64),
      prepareRequest: {
        mode: "existing",
        workItemReference: "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/42",
        nextContent: "## F3 DIM ID / Drawing Governance Reminder\n",
        factorCount: 1,
      },
      expiresAt: "2026-08-31T00:15:00.000Z",
    });

    expect(hostActionRequestSchema.parse(action)).toEqual(action);
    expect(action.expectedTargetVersion).toBe("ado-decision-v1");
  });
});