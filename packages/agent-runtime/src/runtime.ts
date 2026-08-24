import { conversationTurnSchema, type conversationTurnSchema as conversationTurnSchemaType, type f8SessionSnapshotSchema } from "@ai-assist/contracts";

import { buildAgentContext, projectPendingActions, type AgentContext } from "./context-builder.js";
import { detectAgentIntent } from "./intents.js";
import { createToolPolicy, type ToolPolicy } from "./tool-policy.js";

type RuntimeSnapshot = ReturnType<typeof f8SessionSnapshotSchema.parse>;
type RuntimeTurn = ReturnType<typeof conversationTurnSchemaType.parse>;

export interface AgentTurnRequest {
	readonly text: string;
	readonly sessionId: string;
	readonly commandId: string;
	readonly source: "web" | "vscode" | "cli";
}

export interface AgentAction {
	readonly type: "navigate" | "open_report" | "open_what_if";
	readonly target: string;
	readonly label: string;
}

export interface AgentCommand {
	readonly id: string;
	readonly kind: string;
}

export interface AgentTurnResult {
	readonly responseText: string;
	readonly actions: readonly AgentAction[];
	readonly commands: readonly AgentCommand[];
}

export interface SnapshotReader {
	readSnapshot(sessionId?: string): Promise<RuntimeSnapshot>;
}

export interface ConversationStoreLike {
	appendTurn(turn: RuntimeTurn, commandId: string): Promise<RuntimeTurn>;
	readTurns(sessionId: string, options?: { readonly afterSequence?: number }): Promise<readonly RuntimeTurn[]>;
}

export interface LanguageModelAdapter {
	complete(input: {
		readonly text: string;
		readonly context: AgentContext;
		readonly policy: ToolPolicy;
	}): Promise<{
		readonly responseText: string;
		readonly actions?: readonly AgentAction[];
	}>;
}

export interface AgentRuntimeDependencies {
	readonly snapshotStore: SnapshotReader;
	readonly conversationStore: ConversationStoreLike;
	readonly model?: LanguageModelAdapter;
	readonly now?: () => string;
}

export async function handleAgentTurn(
	request: AgentTurnRequest,
	dependencies: AgentRuntimeDependencies,
): Promise<AgentTurnResult> {
	const snapshot = await dependencies.snapshotStore.readSnapshot(request.sessionId);
	const existingTurns = await dependencies.conversationStore.readTurns(request.sessionId, { afterSequence: 0 });
	const now = dependencies.now ?? (() => new Date().toISOString());

	await dependencies.conversationStore.appendTurn(
		createTurn({
			turnId: `${request.commandId}:user`,
			sessionId: request.sessionId,
			sequence: existingTurns.length + 1,
			source: request.source,
			role: "user",
			text: request.text,
			createdAt: now(),
		}),
		`${request.commandId}:user`,
	);

	const turnsAfterUser = await dependencies.conversationStore.readTurns(request.sessionId, { afterSequence: 0 });
	const intent = detectAgentIntent(request.text);
	const context = buildAgentContext({ snapshot, turns: turnsAfterUser });
	const policy = createToolPolicy({ state: snapshot.state, intent: intent.type });

	const deterministic = buildDeterministicResponse(snapshot, intent.type, intent.wantsWrite);
	const modelResponse = await maybeCompleteWithModel(intent.wantsWrite, dependencies.model, request.text, context, policy);
	const resolved = {
		responseText: sanitizeResponseText(modelResponse?.responseText ?? deterministic.responseText),
		actions: sanitizeActions(modelResponse?.actions ?? deterministic.actions),
		commands: [] as const,
	};

	await dependencies.conversationStore.appendTurn(
		createTurn({
			turnId: `${request.commandId}:assistant`,
			sessionId: request.sessionId,
			sequence: turnsAfterUser.length + 1,
			source: "system",
			role: "assistant",
			text: resolved.responseText,
			createdAt: now(),
		}),
		`${request.commandId}:assistant`,
	);

	return resolved;
}

async function maybeCompleteWithModel(
	wantsWrite: boolean,
	model: LanguageModelAdapter | undefined,
	text: string,
	context: AgentContext,
	policy: ToolPolicy,
): Promise<{ readonly responseText: string; readonly actions?: readonly AgentAction[] } | undefined> {
	if (wantsWrite || model === undefined || !policy.allowModelCompletion) {
		return undefined;
	}

	return model.complete({ text, context, policy });
}

function buildDeterministicResponse(
	snapshot: RuntimeSnapshot,
	intent: string,
	wantsWrite: boolean,
): AgentTurnResult {
	const pendingActions = projectPendingActions(snapshot.state);
	const primaryAction = selectPrimaryAction(snapshot.state, intent, pendingActions);

	if (snapshot.state === "ado_decision_required" && wantsWrite) {
		return {
			responseText: "当前只能查看 ADO 预览，模型不能直接确认、写入或绕过独立门控。请先检查预览后再通过单独确认步骤执行。",
			actions: [{ type: "navigate", target: "/ado/preview", label: "查看 ADO 预览" }],
			commands: [],
		};
	}

	if (snapshot.state === "f7_import_required"
		|| snapshot.state === "f7_preview_required"
		|| snapshot.state === "f7_running"
		|| snapshot.state === "feedback_review_required"
		|| intent === "f7_status") {
		return {
			responseText: "F7 当前不可用，工作台只保留占位状态，不会执行实测闭环。",
			actions: [],
			commands: [],
		};
	}

	if (primaryAction !== undefined) {
		return {
			responseText: `当前阶段为 ${snapshot.state}。下一步请先${primaryAction.label}。`,
			actions: [primaryAction],
			commands: [],
		};
	}

	return {
		responseText: `当前阶段为 ${snapshot.state}。可继续查看状态、证据或报告，模型不会直接生成受治理写入命令。`,
		actions: [],
		commands: [],
	};
}

function selectPrimaryAction(
	state: RuntimeSnapshot["state"],
	intent: string,
	pendingActions: readonly { action: string }[],
): AgentAction | undefined {
	if (state === "review_required" && intent === "open_report") {
		return { type: "open_report", target: "/report/current", label: "打开当前报告" };
	}

	if (state === "review_required" && intent === "what_if_help") {
		return { type: "open_what_if", target: "/what-if", label: "打开 What-if Draft" };
	}

	const action = pendingActions[0]?.action;
	switch (action) {
		case "confirm_initial_scope":
			return { type: "navigate", target: "/scope", label: "选择 Worksheets" };
		case "confirm_downstream_scope":
			return { type: "navigate", target: "/scope/downstream", label: "确认下游 Worksheets" };
		case "confirm_ado_decision":
			return { type: "navigate", target: "/ado/preview", label: "查看 ADO 预览" };
		case "confirm_image_decision":
			return { type: "navigate", target: "/images/decision", label: "确认图片上下文" };
		case "confirm_analysis_context":
			return { type: "navigate", target: "/analysis/context", label: "确认 Analysis Context" };
		case "confirm_optimization_targets":
			return { type: "navigate", target: "/optimization/targets", label: "确认 Optimization Targets" };
		case "complete_review":
			return { type: "navigate", target: "/review", label: "完成评审" };
		case "retry":
			return { type: "navigate", target: "/status", label: "查看失败状态" };
		case "cancel":
			return { type: "navigate", target: "/status", label: "查看运行状态" };
		default:
			return undefined;
	}
}

function createTurn(input: {
	readonly turnId: string;
	readonly sessionId: string;
	readonly sequence: number;
	readonly source: "web" | "vscode" | "cli" | "system";
	readonly role: "user" | "assistant" | "tool";
	readonly text: string;
	readonly createdAt: string;
}): RuntimeTurn {
	return conversationTurnSchema.parse({
		contractVersion: "ta-conversation-turn-v1",
		turnId: input.turnId,
		sessionId: input.sessionId,
		sequence: input.sequence,
		source: input.source,
		role: input.role,
		content: [{ kind: "text", text: sanitizeResponseText(input.text) }],
		createdAt: input.createdAt,
		relatedArtifactIds: [],
	});
}

function sanitizeResponseText(text: string): string {
	return text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 1600);
}

function sanitizeActions(actions: readonly AgentAction[]): readonly AgentAction[] {
	return actions.filter((action) => action.type === "navigate" || action.type === "open_report" || action.type === "open_what_if");
}