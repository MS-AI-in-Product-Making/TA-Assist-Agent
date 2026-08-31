import type { AgentIntentType } from "./intents.js";

export interface ModelToolDescriptor {
	readonly name: string;
	readonly description: string;
}

export interface ToolPolicy {
	readonly modelTools: readonly ModelToolDescriptor[];
	readonly blockedCapabilities: readonly string[];
	readonly allowModelCompletion: boolean;
}

export interface ToolPolicyOptions {
	readonly state: string;
	readonly intent?: AgentIntentType;
}

const MODEL_TOOLS: readonly ModelToolDescriptor[] = [
	{ name: "read_status", description: "Read the current governed session stage and active gate." },
	{ name: "read_evidence", description: "Summarize validated evidence already attached to the session." },
	{ name: "explain_blocker", description: "Explain why the current stage is blocked without mutating state." },
	{ name: "propose_navigation", description: "Suggest a safe workbench page to open next." },
	{ name: "open_what_if", description: "Suggest opening the WHAT_IF draft surface without promoting it." },
	{ name: "open_report", description: "Suggest opening the current report or preview artifact." },
] as const;

const BLOCKED_CAPABILITIES = [
	"confirm_commands",
	"surface_write",
	"delete",
	"export",
	"host_bypass",
] as const;

export function createToolPolicy(options: ToolPolicyOptions): ToolPolicy {
	return {
		modelTools: MODEL_TOOLS,
		blockedCapabilities: BLOCKED_CAPABILITIES,
		allowModelCompletion: isReadOnlyIntent(options.intent),
	};
}

function isReadOnlyIntent(intent: AgentIntentType | undefined): boolean {
	if (intent === undefined) return true;
	return intent !== "ado_guidance";
}