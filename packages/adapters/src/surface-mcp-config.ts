import { z } from "zod";
import type {
  SurfaceMcpCapability,
  SurfaceMcpDrawingGovernanceClient,
} from "./surface-mcp-drawing-governance-adapter.js";

const mcpServerSchema = z.object({
  type: z.string().min(1),
  url: z.string().url().optional(),
  command: z.string().min(1).optional(),
}).passthrough();

const mcpConfigSchema = z.object({
  servers: z.record(z.string(), mcpServerSchema),
}).passthrough();

export const REQUIRED_F3_CAPABILITIES = [
  "workItems.create",
  "workItems.read",
  "workItems.comments.read",
  "workItems.comments.update",
] as const satisfies readonly SurfaceMcpCapability[];

const REQUIRED_F3_UPDATE_CAPABILITIES = [
  "workItems.read",
  "workItems.comments.read",
  "workItems.comments.update",
] as const satisfies readonly SurfaceMcpCapability[];

export type SurfaceMcpConfigInspection = {
  readonly configured: true;
  readonly serverName: "surface-mcp";
} | {
  readonly configured: false;
  readonly reasonCode: "surface_mcp_missing";
};

export interface SurfaceMcpCapabilityReport {
  readonly ready: boolean;
  readonly available: readonly SurfaceMcpCapability[];
  readonly missing: readonly SurfaceMcpCapability[];
}

export function inspectSurfaceMcpConfig(config: unknown): SurfaceMcpConfigInspection {
  const parsed = mcpConfigSchema.safeParse(config);
  if (!parsed.success || parsed.data.servers["surface-mcp"] === undefined) {
    return { configured: false, reasonCode: "surface_mcp_missing" };
  }
  return { configured: true, serverName: "surface-mcp" };
}

export async function inspectSurfaceMcpCapabilities(
  client: Pick<SurfaceMcpDrawingGovernanceClient, "listCapabilities">,
  target: { readonly mode: "create" | "existing" } = { mode: "create" },
): Promise<SurfaceMcpCapabilityReport> {
  const reported = new Set<string>(await client.listCapabilities());
  const required = target.mode === "create" ? REQUIRED_F3_CAPABILITIES : REQUIRED_F3_UPDATE_CAPABILITIES;
  const available = required.filter((capability) => reported.has(capability));
  const missing = required.filter((capability) => !reported.has(capability));
  return { ready: missing.length === 0, available, missing };
}