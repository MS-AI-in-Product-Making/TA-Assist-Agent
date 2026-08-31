import { describe, expect, it } from "vitest";
import { inspectSurfaceMcpCapabilities, inspectSurfaceMcpConfig } from "./surface-mcp-config.js";

describe("Surface MCP inspection", () => {
  it("recognizes the configured Surface MCP server", () => {
    expect(inspectSurfaceMcpConfig({
      servers: {
        "surface-mcp": { type: "http", url: "https://surfacemcp.microsoft.com", custom: true },
      },
      inputs: [],
    })).toEqual({ configured: true, serverName: "surface-mcp" });
  });

  it("does not require Azure DevOps MCP", () => {
    expect(inspectSurfaceMcpConfig({ servers: {} })).toEqual({
      configured: false,
      reasonCode: "surface_mcp_missing",
    });
    expect(inspectSurfaceMcpConfig({ servers: { "azure-devops": { type: "http" } } })).toEqual({
      configured: false,
      reasonCode: "surface_mcp_missing",
    });
  });

  it("reports available and missing F3 capabilities exactly", async () => {
    const result = await inspectSurfaceMcpCapabilities({
      async listCapabilities() {
        return ["workItems.read", "workItems.comments.read"];
      },
    });

    expect(result).toEqual({
      ready: false,
      available: ["workItems.read", "workItems.comments.read"],
      missing: ["workItems.create", "workItems.comments.update"],
    });
  });

  it("does not treat unknown capabilities as satisfying F3 requirements", async () => {
    const result = await inspectSurfaceMcpCapabilities({
      async listCapabilities() {
        return ["workItems.read", "unknown.capability"] as never;
      },
    });

    expect(result.ready).toBe(false);
    expect(result.available).toEqual(["workItems.read"]);
    expect(result.missing).toEqual([
      "workItems.create",
      "workItems.comments.read",
      "workItems.comments.update",
    ]);
  });

  it("requires create capability only for create-mode validation", async () => {
    const client = {
      async listCapabilities() {
        return ["workItems.read", "workItems.comments.read", "workItems.comments.update"];
      },
    };

    await expect(inspectSurfaceMcpCapabilities(client, { mode: "existing" })).resolves.toEqual({
      ready: true,
      available: ["workItems.read", "workItems.comments.read", "workItems.comments.update"],
      missing: [],
    });

    await expect(inspectSurfaceMcpCapabilities(client, { mode: "create" })).resolves.toEqual({
      ready: false,
      available: ["workItems.read", "workItems.comments.read", "workItems.comments.update"],
      missing: ["workItems.create"],
    });
  });
});