import type { SurfaceMcpCapability, SurfaceMcpDrawingGovernanceClient } from "@ai-assist/adapters";

interface AvailableTool {
  readonly name: string;
  readonly tags: readonly string[];
  readonly description: string;
}

interface ToolInvoker {
  readonly tools: readonly AvailableTool[];
  invoke(name: string, input: object): Promise<{ readonly text: string }>;
}

const CAPABILITIES = ["workItems.create", "workItems.read", "workItems.comments.read", "workItems.comments.update"] as const;
const OPERATIONS = ["listCapabilities", "createWorkItem", "readWorkItem", "readCommentZero", "updateCommentZero"] as const;
type Operation = typeof OPERATIONS[number];

export function createSurfaceHostClient(surface: ToolInvoker): SurfaceMcpDrawingGovernanceClient {
  const tools = Object.fromEntries(OPERATIONS.map((operation) => [operation, resolveTool(surface.tools, operation)])) as Record<Operation, string>;
  const invoke = async (operation: Operation, input: object): Promise<Record<string, unknown>> => {
    const response = await surface.invoke(tools[operation], input);
    const parsed = JSON.parse(response.text) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Surface MCP tool returned invalid structured content.");
    return parsed as Record<string, unknown>;
  };
  return {
    async listCapabilities() {
      const result = await invoke("listCapabilities", {});
      if (!Array.isArray(result.capabilities)) throw new Error("Surface MCP capabilities are invalid.");
      return result.capabilities.filter((value): value is SurfaceMcpCapability => typeof value === "string" && (CAPABILITIES as readonly string[]).includes(value));
    },
    async createWorkItem(input) {
      return { workItemReference: requiredString(await invoke("createWorkItem", input), "workItemReference") };
    },
    async readWorkItem(reference) {
      const result = await invoke("readWorkItem", { workItemReference: reference });
      return {
        version: requiredString(result, "version"),
        ...(optionalString(result, "ownerReference") === undefined ? {} : { ownerReference: optionalString(result, "ownerReference")! }),
        ...(optionalString(result, "requestByReference") === undefined ? {} : { requestByReference: optionalString(result, "requestByReference")! }),
      };
    },
    async readCommentZero(reference) {
      const result = await invoke("readCommentZero", { workItemReference: reference, commentIndex: 0 });
      return { commentReference: requiredString(result, "commentReference"), version: requiredString(result, "version"), content: requiredString(result, "content", true) };
    },
    async updateCommentZero(input) {
      return { version: requiredString(await invoke("updateCommentZero", input), "version") };
    },
  };
}

function resolveTool(tools: readonly AvailableTool[], operation: Operation): string {
  const matches = tools.filter((tool) => (tool.tags.includes("surface-mcp") || tool.name.toLowerCase().includes("surface-mcp")) && tool.name.endsWith(operation));
  if (matches.length !== 1) throw new Error(`Surface MCP ${operation} tool is ${matches.length === 0 ? "missing" : "ambiguous"}.`);
  return matches[0]!.name;
}

function requiredString(value: Record<string, unknown>, key: string, allowEmpty = false): string {
  const candidate = value[key];
  if (typeof candidate !== "string" || (!allowEmpty && candidate.length === 0)) throw new Error(`Surface MCP ${key} is invalid.`);
  return candidate;
}

function optionalString(value: Record<string, unknown>, key: string): string | undefined {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
}
