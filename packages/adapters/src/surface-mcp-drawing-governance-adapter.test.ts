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
  title?: string;
  targetIdentity?: { readonly organization: string; readonly project: string; readonly workItemId: number };
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
      return { workItemReference: "https://dev.azure.com/contoso/Devices/_workitems/edit/1119604" };
    },
    async readWorkItem() {
      invocations.push("readWorkItem");
      return {
        version: "work-item-v1",
        targetIdentity: options.targetIdentity ?? { organization: "contoso", project: "Devices", workItemId: 1119604 },
        title: options.title,
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
    workItemReference: "https://dev.azure.com/contoso/Devices/_workitems/edit/1119604",
    nextContent: "Existing Comment 0\n\n| Drawing | DIM ID |\n| --- | --- |\n| DRAW-A | 307 |",
    factorCount: 1,
  };
}

function createRequest() {
  return {
    mode: "create" as const,
    title: "[TA Requirement][Project][Phase] Update Drawing Requirements for Gearbox.xlsx",
    sponsorEmail: "sponsor@example.com",
    nextContent: "Governed drawing requirements",
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

  it("requires the created Work Item to be assigned to the requested sponsor", async () => {
    const matching = createSurfaceMcpDrawingGovernanceAdapter(createClient({ ownerReference: "Sponsor@Example.com", title: createRequest().title }).client);
    await expect(matching.prepare(createRequest())).resolves.toMatchObject({
      status: "confirmation_required",
      ownerReference: "Sponsor@Example.com",
    });

    const mismatched = createSurfaceMcpDrawingGovernanceAdapter(createClient({ ownerReference: "other@example.com", title: createRequest().title }).client);
    await expect(mismatched.prepare(createRequest())).resolves.toMatchObject({
      status: "blocked",
      reasonCode: "sponsor_assignment_mismatch",
    });
  });

  it("requires the created Work Item title readback to match the requested title", async () => {
    const adapter = createSurfaceMcpDrawingGovernanceAdapter(createClient({ ownerReference: "sponsor@example.com", title: "Unexpected title" }).client);

    await expect(adapter.prepare(createRequest())).resolves.toMatchObject({
      status: "blocked",
      reasonCode: "title_readback_mismatch",
    });
  });

  it("revalidates an already-created target without creating a duplicate Work Item", async () => {
    const fake = createClient({ ownerReference: "sponsor@example.com", title: createRequest().title });
    const adapter = createSurfaceMcpDrawingGovernanceAdapter(fake.client);

    const workItemReference = "https://dev.azure.com/contoso/Devices/_workitems/edit/1119604";
    await expect(adapter.prepare({ ...createRequest(), workItemReference })).resolves.toMatchObject({
      status: "confirmation_required",
      workItemReference,
    });
    expect(fake.invocations).not.toContain("createWorkItem");
  });

  it.each([
    ["organization", { organization: "fabrikam", project: "Devices", workItemId: 1119604 }],
    ["project", { organization: "contoso", project: "Other Project", workItemId: 1119604 }],
    ["id", { organization: "contoso", project: "Devices", workItemId: 1119605 }],
  ] as const)("blocks prepare when Surface readback identity differs by %s", async (_field, targetIdentity) => {
    const adapter = createSurfaceMcpDrawingGovernanceAdapter(createClient({
      ownerReference: "owner-ref",
      targetIdentity,
    }).client);

    await expect(adapter.prepare(linkRequest())).resolves.toMatchObject({
      status: "blocked",
      reasonCode: "target_identity_mismatch",
      workItemReference: "https://dev.azure.com/contoso/Devices/_workitems/edit/1119604",
    });
  });

  it("prepares a version-bound line diff without writing", async () => {
    const fake = createClient({ ownerReference: "owner-ref" });
    const adapter = createSurfaceMcpDrawingGovernanceAdapter(fake.client);

    const prepared = await adapter.prepare(linkRequest());

    expect(prepared).toMatchObject({
      status: "confirmation_required",
      workItemReference: "https://dev.azure.com/contoso/Devices/_workitems/edit/1119604",
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
      operation: "updated",
      targetIdentity: { organization: "contoso", project: "Devices", workItemId: 1119604 },
      verifiedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(fake.invocations.filter((name) => name === "updateCommentZero")).toHaveLength(1);
    expect(receipt).not.toHaveProperty("content");
  });

  it("returns structured readback identity without the validation URL", async () => {
    const validatedTargetUrl = "https://dev.azure.com/contoso/Devices/_workitems/edit/1119604";
    const fake = createClient({ ownerReference: "owner-ref" });
    const adapter = createSurfaceMcpDrawingGovernanceAdapter(fake.client);
    const prepared = await adapter.prepare({ ...linkRequest(), workItemReference: validatedTargetUrl });
    if (prepared.status !== "confirmation_required") throw new Error("Expected confirmation payload.");

    const receipt = await adapter.execute(prepared);

    expect(receipt).toMatchObject({
      operation: "updated",
      targetIdentity: {
        organization: "contoso",
        project: "Devices",
        workItemId: 1119604,
      },
      verifiedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(receipt).not.toHaveProperty("url");
    expect(receipt).not.toHaveProperty("workItemReference");
  });

  it("executes a confirmed write with a fresh adapter instance", async () => {
    const fake = createClient({ ownerReference: "owner-ref" });
    const prepared = await createSurfaceMcpDrawingGovernanceAdapter(fake.client).prepare(linkRequest());
    if (prepared.status !== "confirmation_required") throw new Error("Expected confirmation payload.");

    const receipt = await createSurfaceMcpDrawingGovernanceAdapter(fake.client).execute(prepared);

    expect(receipt).toMatchObject({
      operation: "updated",
      targetIdentity: { organization: "contoso", project: "Devices", workItemId: 1119604 },
    });
    expect(fake.invocations.filter((name) => name === "updateCommentZero")).toHaveLength(1);
  });
});