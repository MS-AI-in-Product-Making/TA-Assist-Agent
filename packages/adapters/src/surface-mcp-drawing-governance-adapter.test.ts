import { describe, expect, it } from "vitest";
import {
  createSurfaceMcpDrawingGovernanceAdapter,
  type SurfaceMcpCapability,
  type SurfaceMcpDrawingGovernanceClient,
} from "./surface-mcp-drawing-governance-adapter.js";

function createClient(options: {
  capabilities?: SurfaceMcpCapability[];
  ownerReference?: string;
  requestByReference?: string;
} = {}) {
  let commentVersion = "comment-v1";
  let commentContent = "Existing Comment 0";
  const invocations: string[] = [];
  const client: SurfaceMcpDrawingGovernanceClient = {
    async listCapabilities() {
      invocations.push("listCapabilities");
      return options.capabilities ?? ["workItems.create", "workItems.read", "workItems.comments.read", "workItems.comments.update"];
    },
    async createWorkItem() {
      invocations.push("createWorkItem");
      return { workItemReference: "WI-created" };
    },
    async readWorkItem() {
      invocations.push("readWorkItem");
      return {
        version: "work-item-v1",
        ownerReference: options.ownerReference,
        requestByReference: options.requestByReference ?? "request-by-ref",
      };
    },
    async readCommentZero() {
      invocations.push("readCommentZero");
      return { commentReference: "comment-0", version: commentVersion, content: commentContent };
    },
    async updateCommentZero(input) {
      invocations.push("updateCommentZero");
      commentVersion = "comment-v2";
      commentContent = input.content;
      return { version: commentVersion };
    },
  };
  return {
    client,
    invocations,
    changeComment(version: string, content = commentContent) {
      commentVersion = version;
      commentContent = content;
    },
  };
}

function linkRequest() {
  return {
    mode: "existing" as const,
    workItemReference: "WI-1102392",
    nextContent: "Existing Comment 0\n\n| Drawing | DIM ID |\n| --- | --- |\n| DRAW-A | 307 |",
    factorCount: 1,
  };
}

describe("createSurfaceMcpDrawingGovernanceAdapter", () => {
  it("blocks prepare when required Surface MCP capabilities are missing", async () => {
    const fake = createClient({ capabilities: ["workItems.read"] });
    const adapter = createSurfaceMcpDrawingGovernanceAdapter(fake.client);

    await expect(adapter.prepare(linkRequest())).resolves.toMatchObject({
      status: "blocked",
      reasonCode: "surface_mcp_capability_missing",
    });
    expect(fake.invocations).not.toContain("readWorkItem");
  });

  it("falls back from Owner to Request By", async () => {
    const adapter = createSurfaceMcpDrawingGovernanceAdapter(createClient({
      requestByReference: "controlled-user-reference",
    }).client);

    await expect(adapter.prepare(linkRequest())).resolves.toMatchObject({
      status: "confirmation_required",
      ownerReference: "controlled-user-reference",
      factorCount: 1,
    });
  });

  it("blocks prepare without Owner or Request By", async () => {
    const fake = createClient({ requestByReference: "" });
    const adapter = createSurfaceMcpDrawingGovernanceAdapter(fake.client);

    await expect(adapter.prepare(linkRequest())).resolves.toMatchObject({
      status: "blocked",
      reasonCode: "owner_reference_missing",
    });
    expect(fake.invocations).not.toContain("updateCommentZero");
  });

  it("prepares a version-bound line diff without writing", async () => {
    const fake = createClient({ ownerReference: "owner-ref" });
    const adapter = createSurfaceMcpDrawingGovernanceAdapter(fake.client);

    const prepared = await adapter.prepare(linkRequest());

    expect(prepared).toMatchObject({
      status: "confirmation_required",
      workItemReference: "WI-1102392",
      commentReference: "comment-0",
      expectedVersion: "comment-v1",
      beforeContentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      confirmationHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      diff: expect.arrayContaining([expect.objectContaining({ changed: true })]),
    });
    expect(fake.invocations).not.toContain("updateCommentZero");
  });

  it("rejects execute when confirmation hash does not match", async () => {
    const fake = createClient({ ownerReference: "owner-ref" });
    const adapter = createSurfaceMcpDrawingGovernanceAdapter(fake.client);
    const prepared = await adapter.prepare(linkRequest());
    if (prepared.status !== "confirmation_required") throw new Error("Expected confirmation payload.");

    await expect(adapter.execute({ ...prepared, confirmationHash: "0".repeat(64) }))
      .rejects.toMatchObject({ code: "validation_error" });
    expect(fake.invocations).not.toContain("updateCommentZero");
  });

  it("rejects execute when Comment 0 changed after prepare", async () => {
    const fake = createClient({ ownerReference: "owner-ref" });
    const adapter = createSurfaceMcpDrawingGovernanceAdapter(fake.client);
    const prepared = await adapter.prepare(linkRequest());
    if (prepared.status !== "confirmation_required") throw new Error("Expected confirmation payload.");
    fake.changeComment("comment-v2", "Concurrent edit");

    await expect(adapter.execute(prepared)).rejects.toMatchObject({ code: "dependency_error" });
    expect(fake.invocations).not.toContain("updateCommentZero");
  });

  it("updates Comment 0 once and returns a content-free receipt", async () => {
    const fake = createClient({ ownerReference: "owner-ref" });
    const adapter = createSurfaceMcpDrawingGovernanceAdapter(fake.client);
    const prepared = await adapter.prepare(linkRequest());
    if (prepared.status !== "confirmation_required") throw new Error("Expected confirmation payload.");

    const receipt = await adapter.execute(prepared);

    expect(receipt).toEqual({
      status: "updated",
      workItemReference: "WI-1102392",
      commentReference: "comment-0",
      version: "comment-v2",
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(fake.invocations.filter((name) => name === "updateCommentZero")).toHaveLength(1);
    expect(receipt).not.toHaveProperty("content");
  });
});