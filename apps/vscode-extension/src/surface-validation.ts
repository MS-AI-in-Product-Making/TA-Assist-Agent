import {
  createSurfaceMcpDrawingGovernanceAdapter,
  inspectSurfaceMcpCapabilities,
  type SurfaceMcpDrawingGovernanceClient,
  type SurfaceMcpPrepareRequest,
} from "@ai-assist/adapters";

export async function executeSurfaceValidation(
  surface: SurfaceMcpDrawingGovernanceClient,
  prepareRequest: SurfaceMcpPrepareRequest,
) {
  const capabilities = await inspectSurfaceMcpCapabilities(surface, { mode: prepareRequest.mode });
  if (!capabilities.ready) {
    return { status: "blocked" as const, reason: `Missing Surface MCP capabilities: ${capabilities.missing.join(", ")}` };
  }

  const prepared = await createSurfaceMcpDrawingGovernanceAdapter(surface).prepare(prepareRequest);
  return prepared.status === "blocked"
    ? { status: "blocked" as const, reason: prepared.reasonCode }
    : { status: "completed" as const, outcome: { kind: "surface_validation" as const, confirmation: prepared } };
}