import { describe, expect, it, vi } from "vitest";

import { createSurfaceHostClient } from "./surface-host-client.js";

function tool(name: string) {
  return { name, tags: ["surface-mcp"], description: name };
}

describe("createSurfaceHostClient", () => {
  const canonicalMarkdown = [
    "# Missing Drawing Number / DIM ID Governance",
    "",
    "| Part / Subsystem | Drawing Number | DIM ID | Factor Description | Source Location |",
    "| --- | --- | --- | --- | --- |",
    "| Camera | DRAW-001 | DIM-007 | Escaped pipe \\| cell | Worksheet A · Table 1 · Row 4 |",
    "| Hinge |  | DIM-008 | Keeps heading order | Worksheet B · Table 2 · Row 9 |",
  ].join("\n");

  it("maps real Surface MCP tools and verifies a System.History write by readback", async () => {
    let comments = [{ id: 10, version: 1, text: "before" }];
    const invoke = vi.fn(async (name: string, input: object) => {
      if (name.endsWith("p_get_work_item")) return { text: JSON.stringify({ id: 42, rev: 7, fields: { "System.AssignedTo": { uniqueName: "owner@example.com" } } }) };
      if (name.endsWith("p_list_work_item_comments")) return { text: JSON.stringify({ comments }) };
      if (name.endsWith("p_update_work_item")) { comments = [...comments, { id: 11, version: 1, text: "after" }]; return { text: JSON.stringify({ rev: 8 }) }; }
      throw new Error(`Unexpected tool ${name}`);
    });
    const client = createSurfaceHostClient({
      tools: [tool("mcp_surface_mcp_p_get_work_item"), tool("mcp_surface_mcp_p_list_work_item_comments"), tool("mcp_surface_mcp_p_update_work_item")],
      invoke,
    });

    const url = "https://dev.azure.com/MSFTDEVICES/Project%20A/_workitems/edit/42";
    await expect(client.listCapabilities()).resolves.toEqual(["workItems.read", "workItems.comments.read", "workItems.comments.update"]);
    await expect(client.readWorkItem(url)).resolves.toEqual({ version: "7", ownerReference: "owner@example.com" });
    await expect(client.readCommentZero(url)).resolves.toEqual({ commentReference: "10", version: "1", content: "before" });
    await expect(client.updateCommentZero({ workItemReference: url, commentReference: "10", expectedVersion: "1", content: "after" })).resolves.toEqual({ version: "1" });
    expect(invoke).toHaveBeenCalledWith("mcp_surface_mcp_p_update_work_item", { organization: "MSFTDEVICES", work_item_id: 42, requestBody: [{ op: "add", path: "/fields/System.History", value: "after" }] });
  });

  it("fails closed when a capability tool is missing or ambiguous", async () => {
    const invoke = vi.fn();
    expect(() => createSurfaceHostClient({ tools: [], invoke })).toThrow(/missing/i);
    expect(() => createSurfaceHostClient({ tools: [tool("mcp_surface_mcp_p_get_work_item"), tool("other-surface-mcp_p_get_work_item")], invoke })).toThrow(/ambiguous|missing/i);
  });

  it("supports create mode and preserves canonical markdown content through write readback", async () => {
    let comments = [{ id: 10, version: 1, text: "before" }];
    const invoke = vi.fn(async (name: string, input: any) => {
      if (name.endsWith("p_create_work_item")) {
        expect(input).toEqual({
          organization: "MSFTDEVICES",
          project: "Project A",
          workItemType: "Task",
          requestBody: [{ name: "System.Title", value: "TA Drawing Governance - Anonymous.xlsx" }],
        });
        return { text: JSON.stringify({ id: 42 }) };
      }
      if (name.endsWith("p_get_work_item")) return { text: JSON.stringify({ id: 42, rev: 7, fields: { "System.CreatedBy": { uniqueName: "requester@example.com" } } }) };
      if (name.endsWith("p_list_work_item_comments")) return { text: JSON.stringify({ comments }) };
      if (name.endsWith("p_update_work_item")) {
        comments = [...comments, { id: 11, version: 2, text: canonicalMarkdown }];
        return { text: JSON.stringify({ rev: 8 }) };
      }
      throw new Error(`Unexpected tool ${name}`);
    });
    const client = createSurfaceHostClient({
      tools: [
        tool("mcp_surface_mcp_p_create_work_item"),
        tool("mcp_surface_mcp_p_get_work_item"),
        tool("mcp_surface_mcp_p_list_work_item_comments"),
        tool("mcp_surface_mcp_p_update_work_item"),
      ],
      invoke,
    });

    await expect(client.listCapabilities()).resolves.toEqual([
      "workItems.create",
      "workItems.read",
      "workItems.comments.read",
      "workItems.comments.update",
    ]);
    const created = await client.createWorkItem({ title: "TA Drawing Governance - Anonymous.xlsx" });
    expect(created).toEqual({ workItemReference: "https://dev.azure.com/MSFTDEVICES/Project%20A/_workitems/edit/42" });
    await expect(client.readWorkItem(created.workItemReference)).resolves.toEqual({ version: "7", requestByReference: "requester@example.com" });
    await expect(client.updateCommentZero({ workItemReference: created.workItemReference, commentReference: "10", expectedVersion: "1", content: canonicalMarkdown })).resolves.toEqual({ version: "2" });
    expect(invoke).toHaveBeenCalledWith("mcp_surface_mcp_p_update_work_item", {
      organization: "MSFTDEVICES",
      work_item_id: 42,
      requestBody: [{ op: "add", path: "/fields/System.History", value: canonicalMarkdown }],
    });
  });

  it("fails closed when create support is unavailable or returns an invalid work item id", async () => {
    const invoke = vi.fn(async (name: string) => {
      if (name.endsWith("p_create_work_item")) return { text: JSON.stringify({ id: 0 }) };
      throw new Error(`Unexpected tool ${name}`);
    });
    const withCreate = createSurfaceHostClient({
      tools: [
        tool("mcp_surface_mcp_p_create_work_item"),
        tool("mcp_surface_mcp_p_get_work_item"),
        tool("mcp_surface_mcp_p_list_work_item_comments"),
        tool("mcp_surface_mcp_p_update_work_item"),
      ],
      invoke,
    });
    await expect(withCreate.createWorkItem({ title: "TA Drawing Governance - Anonymous.xlsx" })).rejects.toThrow(/invalid/i);

    const withoutCreate = createSurfaceHostClient({
      tools: [tool("mcp_surface_mcp_p_get_work_item"), tool("mcp_surface_mcp_p_list_work_item_comments"), tool("mcp_surface_mcp_p_update_work_item")],
      invoke: vi.fn(),
    });
    await expect(withoutCreate.createWorkItem({ title: "TA Drawing Governance - Anonymous.xlsx" })).rejects.toThrow(/unavailable|missing/i);
  });
});
