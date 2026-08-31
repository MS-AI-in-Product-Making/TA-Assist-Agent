import { describe, expect, it, vi } from "vitest";

import { executeSurfaceValidation } from "./surface-validation.js";

describe("executeSurfaceValidation", () => {
  it("prepares an existing-work-item validation without requiring create capability", async () => {
    const createWorkItem = vi.fn(async () => ({ workItemReference: "should-not-run" }));
    const surface = {
      async listCapabilities() {
        return ["workItems.read", "workItems.comments.read", "workItems.comments.update"] as const;
      },
      createWorkItem,
      async readWorkItem() {
        return { version: "7", ownerReference: "owner@example.com" };
      },
      async readCommentZero() {
        return { commentReference: "10", version: "4", content: "before" };
      },
      async updateCommentZero() {
        return { version: "5" };
      },
    };

    await expect(executeSurfaceValidation(surface, {
      mode: "existing",
      workItemReference: "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/42",
      nextContent: "## F3 DIM ID / Drawing Governance Reminder\n",
      factorCount: 1,
    })).resolves.toMatchObject({
      status: "completed",
      outcome: {
        kind: "surface_validation",
        confirmation: {
          status: "confirmation_required",
          workItemReference: "https://dev.azure.com/MSFTDEVICES/Project/_workitems/edit/42",
          ownerReference: "owner@example.com",
          commentReference: "10",
          expectedVersion: "4",
          factorCount: 1,
        },
      },
    });
    expect(createWorkItem).not.toHaveBeenCalled();
  });

  it("blocks create-mode validation when create capability is missing", async () => {
    const createWorkItem = vi.fn(async () => ({ workItemReference: "should-not-run" }));
    const surface = {
      async listCapabilities() {
        return ["workItems.read", "workItems.comments.read", "workItems.comments.update"] as const;
      },
      createWorkItem,
      async readWorkItem() {
        return { version: "7", ownerReference: "owner@example.com" };
      },
      async readCommentZero() {
        return { commentReference: "10", version: "4", content: "before" };
      },
      async updateCommentZero() {
        return { version: "5" };
      },
    };

    await expect(executeSurfaceValidation(surface, {
      mode: "create",
      title: "TA Drawing Governance - Anonymous.xlsx",
      nextContent: "## F3 DIM ID / Drawing Governance Reminder\n",
      factorCount: 1,
    })).resolves.toEqual({
      status: "blocked",
      reason: "Missing Surface MCP capabilities: workItems.create",
    });
    expect(createWorkItem).not.toHaveBeenCalled();
  });
});