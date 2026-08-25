import { describe, expect, it, vi } from "vitest";

import { createSurfaceHostClient } from "./surface-host-client.js";

function tool(name: string) {
  return { name, tags: ["surface-mcp"], description: name };
}

describe("createSurfaceHostClient", () => {
  it("maps only unique surface-mcp tools to the approved client interface", async () => {
    const invoke = vi.fn(async (name: string, input: object) => ({ text: JSON.stringify(
      name.endsWith("listCapabilities") ? { capabilities: ["workItems.read"] }
        : name.endsWith("createWorkItem") ? { workItemReference: "WI-1" }
          : name.endsWith("readWorkItem") ? { version: "1", ownerReference: "owner" }
            : name.endsWith("readCommentZero") ? { commentReference: "C0", version: "2", content: "before" }
              : { version: "3" },
    ), input }));
    const client = createSurfaceHostClient({
      tools: [tool("surface-mcp_listCapabilities"), tool("surface-mcp_createWorkItem"), tool("surface-mcp_readWorkItem"), tool("surface-mcp_readCommentZero"), tool("surface-mcp_updateCommentZero")],
      invoke,
    });

    await expect(client.listCapabilities()).resolves.toEqual(["workItems.read"]);
    await expect(client.createWorkItem({ title: "TA Drawing Governance" })).resolves.toEqual({ workItemReference: "WI-1" });
    await expect(client.readWorkItem("WI-1")).resolves.toEqual({ version: "1", ownerReference: "owner" });
    await expect(client.readCommentZero("WI-1")).resolves.toEqual({ commentReference: "C0", version: "2", content: "before" });
    await expect(client.updateCommentZero({ workItemReference: "WI-1", commentReference: "C0", expectedVersion: "2", content: "after" })).resolves.toEqual({ version: "3" });
  });

  it("fails closed when a capability tool is missing or ambiguous", async () => {
    const invoke = vi.fn();
    expect(() => createSurfaceHostClient({ tools: [], invoke })).toThrow(/missing/i);
    expect(() => createSurfaceHostClient({ tools: [tool("surface-mcp_readWorkItem"), tool("other-surface-mcp_readWorkItem")], invoke })).toThrow(/ambiguous|missing/i);
  });
});
