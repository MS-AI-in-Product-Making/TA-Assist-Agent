import { conversationTurnSchema, type conversationTurnSchema as conversationTurnSchemaType, type f8SessionSnapshotSchema } from "@ai-assist/contracts";

import { buildAgentContext, projectPendingActions, type AgentContext } from "./context-builder.js";
import { detectAgentIntent, type AgentIntentType } from "./intents.js";
import { createToolPolicy, type ToolPolicy } from "./tool-policy.js";

type RuntimeSnapshot = ReturnType<typeof f8SessionSnapshotSchema.parse>;
type RuntimeTurn = ReturnType<typeof conversationTurnSchemaType.parse>;
type ModelActionCandidate = {
	readonly type?: string;
	readonly target?: string;
	readonly label?: string;
};

type StoredResultReceipt = {
	readonly actions: readonly AgentAction[];
	readonly commands: readonly AgentCommand[];
};

const inFlightTurnResults = new Map<string, Promise<AgentTurnResult>>();

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

type StoredActionCandidate = {
	readonly type?: unknown;
	readonly target?: unknown;
};

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
		readonly actions?: readonly ModelActionCandidate[];
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
	const intent = detectAgentIntent(request.text);
	const storedResult = readStoredResult(existingTurns, request.commandId, snapshot, intent.type);
	if (storedResult !== undefined) {
		return storedResult;
	}

	const singleFlightKey = `${request.sessionId}:${request.commandId}`;
	const inFlight = inFlightTurnResults.get(singleFlightKey);
	if (inFlight !== undefined) {
		return await inFlight;
	}

	const turnPromise = handleAgentTurnOnce(request, dependencies, snapshot, existingTurns, intent.type, intent.wantsWrite);
	inFlightTurnResults.set(singleFlightKey, turnPromise);

	try {
		return await turnPromise;
	} finally {
		if (inFlightTurnResults.get(singleFlightKey) === turnPromise) {
			inFlightTurnResults.delete(singleFlightKey);
		}
	}
}

async function handleAgentTurnOnce(
	request: AgentTurnRequest,
	dependencies: AgentRuntimeDependencies,
	snapshot: RuntimeSnapshot,
	existingTurns: readonly RuntimeTurn[],
	intentType: AgentIntentType,
	wantsWrite: boolean,
): Promise<AgentTurnResult> {

	const now = dependencies.now ?? (() => new Date().toISOString());
	const existingUserTurn = existingTurns.find((turn) => turn.turnId === `${request.commandId}:user`);

	if (existingUserTurn === undefined) {
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
	}

	const turnsAfterUser = existingUserTurn === undefined
		? await dependencies.conversationStore.readTurns(request.sessionId, { afterSequence: 0 })
		: existingTurns;
	const context = buildAgentContext({ snapshot, turns: turnsAfterUser });
	const policy = createToolPolicy({ state: snapshot.state, intent: intentType });

	const deterministic = buildDeterministicResponse(snapshot, intentType, wantsWrite);
	const modelResponse = await maybeCompleteWithModel(wantsWrite, dependencies.model, request.text, context, policy);
	const resolved = resolveTurnResult(snapshot, intentType, deterministic, modelResponse);

	await dependencies.conversationStore.appendTurn(
		createAssistantTurn({
			turnId: `${request.commandId}:assistant`,
			sessionId: request.sessionId,
			sequence: turnsAfterUser.length + 1,
			source: "system",
			role: "assistant",
			text: resolved.responseText,
			createdAt: now(),
			receipt: {
				actions: resolved.actions,
				commands: resolved.commands,
			},
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
): Promise<{ readonly responseText: string; readonly actions?: readonly ModelActionCandidate[] } | undefined> {
	if (wantsWrite || model === undefined || !policy.allowModelCompletion) {
		return undefined;
	}

	try {
		return await model.complete({ text, context, policy });
	} catch {
		return undefined;
	}
}

function resolveTurnResult(
	snapshot: RuntimeSnapshot,
	intent: AgentIntentType,
	deterministic: AgentTurnResult,
	modelResponse: { readonly responseText: string; readonly actions?: readonly ModelActionCandidate[] } | undefined,
): AgentTurnResult {
	if (modelResponse === undefined || !isSafeResponseText(modelResponse.responseText)) {
		return deterministic;
	}

	const actions = sanitizeActions(snapshot, intent, modelResponse.actions, deterministic.actions);
	return {
		responseText: sanitizeResponseText(modelResponse.responseText),
		actions,
		commands: deterministic.commands,
	};
}

function buildDeterministicResponse(
	snapshot: RuntimeSnapshot,
	intent: AgentIntentType,
	wantsWrite: boolean,
): AgentTurnResult {
	const pendingActions = projectPendingActions(snapshot.state);
	const primaryAction = selectPrimaryAction(snapshot, snapshot.state, intent, pendingActions);

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
	snapshot: RuntimeSnapshot,
	state: RuntimeSnapshot["state"],
	intent: AgentIntentType,
	pendingActions: readonly { action: string }[],
): AgentAction | undefined {
	if (state === "review_required" && intent === "open_report" && hasValidatedReport(snapshot)) {
		return { type: "open_report", target: "/report/current", label: "打开当前报告" };
	}

	if (state === "review_required" && intent === "what_if_help" && hasWhatIfWorksheet(snapshot)) {
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

function createAssistantTurn(input: {
	readonly turnId: string;
	readonly sessionId: string;
	readonly sequence: number;
	readonly source: "web" | "vscode" | "cli" | "system";
	readonly role: "user" | "assistant" | "tool";
	readonly text: string;
	readonly createdAt: string;
	readonly receipt: StoredResultReceipt;
}): RuntimeTurn {
	return conversationTurnSchema.parse({
		contractVersion: "ta-conversation-turn-v1",
		turnId: input.turnId,
		sessionId: input.sessionId,
		sequence: input.sequence,
		source: input.source,
		role: input.role,
		content: [
			{ kind: "text", text: sanitizeResponseText(input.text) },
			{ kind: "tool_result", actions: input.receipt.actions, commands: input.receipt.commands },
		],
		createdAt: input.createdAt,
		relatedArtifactIds: [],
	});
}

function sanitizeResponseText(text: string): string {
	return text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 1600);
}

function sanitizeActions(
	snapshot: RuntimeSnapshot,
	intent: AgentIntentType,
	actions: readonly ModelActionCandidate[] | undefined,
	fallbackActions: readonly AgentAction[],
): readonly AgentAction[] {
	if (actions === undefined || actions.length === 0) {
		return fallbackActions;
	}

	const allowedByKey = new Map(allowedActionsFor(snapshot, intent).map((action) => [actionKey(action), action]));
	const sanitized: AgentAction[] = [];
	for (const candidate of actions) {
		if (typeof candidate?.type !== "string" || typeof candidate?.target !== "string") {
			continue;
		}
		const key = `${candidate.type}:${candidate.target}`;
		const allowed = allowedByKey.get(key);
		if (allowed !== undefined && !sanitized.some((action) => actionKey(action) === key)) {
			sanitized.push(allowed);
		}
	}

	return sanitized.length > 0 ? sanitized : fallbackActions;
}

function allowedActionsFor(snapshot: RuntimeSnapshot, intent: AgentIntentType): readonly AgentAction[] {
	const pendingActions = projectPendingActions(snapshot.state);
	const allowed: AgentAction[] = [];
	const primary = selectPrimaryAction(snapshot, snapshot.state, intent, pendingActions);
	if (primary !== undefined) {
		allowed.push(primary);
	}

	if (snapshot.state === "review_required") {
		allowed.push({ type: "navigate", target: "/review", label: "完成评审" });
	}

	if (hasValidatedReport(snapshot)) {
		allowed.push({ type: "open_report", target: "/report/current", label: "打开当前报告" });
	}

	if (hasWhatIfWorksheet(snapshot)) {
		allowed.push({ type: "open_what_if", target: "/what-if", label: "打开 What-if Draft" });
	}

	return dedupeActions(allowed);
}

function hasValidatedReport(snapshot: RuntimeSnapshot): boolean {
	return (snapshot.artifactRefs ?? []).some((reference) => reference.kind === "f6_report"
		&& reference.validated
		&& reference.revision === snapshot.revision);
}

function hasWhatIfWorksheet(snapshot: RuntimeSnapshot): boolean {
	return (snapshot.worksheetCapabilities ?? []).some((capability) => capability.whatIfAvailable);
}

function dedupeActions(actions: readonly AgentAction[]): readonly AgentAction[] {
	const seen = new Set<string>();
	const deduped: AgentAction[] = [];
	for (const action of actions) {
		const key = actionKey(action);
		if (!seen.has(key)) {
			seen.add(key);
			deduped.push(action);
		}
	}
	return deduped;
}

function actionKey(action: AgentAction): string {
	return `${action.type}:${action.target}`;
}

function readStoredResult(
	turns: readonly RuntimeTurn[],
	commandId: string,
	snapshot: RuntimeSnapshot,
	intent: AgentIntentType,
): AgentTurnResult | undefined {
	const assistantTurn = turns.find((turn) => turn.turnId === `${commandId}:assistant`);
	if (assistantTurn === undefined) {
		return undefined;
	}

	const responseText = readAssistantResponseText(assistantTurn);
	if (responseText.length === 0) {
		return undefined;
	}

	return {
		responseText,
		...(readAssistantReceipt(assistantTurn, snapshot, intent) ?? { actions: [], commands: [] }),
	};
}

function readAssistantResponseText(turn: RuntimeTurn): string {
	return sanitizeResponseText(turn.content
		.filter((part) => part.kind === "text")
		.map((part) => part.text)
		.join(" "));
}

function readAssistantReceipt(turn: RuntimeTurn, snapshot: RuntimeSnapshot, intent: AgentIntentType): StoredResultReceipt | undefined {
	const receiptPart = turn.content.find((part) => part.kind === "tool_result");
	if (receiptPart === undefined || receiptPart.kind !== "tool_result") {
		return undefined;
	}

	return {
		actions: canonicalizeStoredActions(snapshot, intent, receiptPart.actions),
		commands: [],
	};
}

function canonicalizeStoredActions(
	snapshot: RuntimeSnapshot,
	intent: AgentIntentType,
	actions: readonly StoredActionCandidate[] | undefined,
): readonly AgentAction[] {
	if (actions === undefined || actions.length === 0) {
		return [];
	}

	const allowedByKey = new Map(allowedActionsFor(snapshot, intent).map((action) => [actionKey(action), action]));
	const canonical: AgentAction[] = [];
	for (const candidate of actions) {
		if (typeof candidate?.type !== "string" || typeof candidate?.target !== "string") {
			continue;
		}

		const allowed = allowedByKey.get(`${candidate.type}:${candidate.target}`);
		if (allowed !== undefined && !canonical.some((action) => actionKey(action) === actionKey(allowed))) {
			canonical.push(allowed);
		}
	}

	return canonical;
}

function isSafeResponseText(text: string): boolean {
	const sanitized = sanitizeResponseText(text);
	return sanitized.length > 0 && sanitized.length <= 1600 && sanitized === text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}