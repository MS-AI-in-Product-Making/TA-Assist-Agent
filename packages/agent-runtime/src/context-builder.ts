import { f7PlaceholderStatusSchema, type conversationTurnSchema, type f8SessionSnapshotSchema } from "@ai-assist/contracts";

export type RuntimeSnapshot = ReturnType<typeof f8SessionSnapshotSchema.parse>;
export type RuntimeTurn = ReturnType<typeof conversationTurnSchema.parse>;

export interface AgentContext {
	readonly session: {
		readonly sessionId: string;
		readonly revision: number;
		readonly state: RuntimeSnapshot["state"];
		readonly pendingActions: readonly PendingAction[];
		readonly f7: {
			readonly status: string;
			readonly lifecycle: string;
			readonly actions: readonly string[];
		};
	};
	readonly turns: readonly SanitizedTurn[];
}

export interface PendingAction {
	readonly featureId: string;
	readonly action: string;
	readonly blocking: boolean;
}

export interface SanitizedTurn {
	readonly turnId: string;
	readonly role: RuntimeTurn["role"];
	readonly text: string;
}

export interface AgentContextInput {
	readonly snapshot: RuntimeSnapshot;
	readonly turns: readonly RuntimeTurn[];
}

export function buildAgentContext(input: AgentContextInput): AgentContext {
	const f7 = f7PlaceholderStatusSchema.parse({
		contractVersion: "f7-workbench-placeholder-v1",
		status: "feature_not_available",
		lifecycle: "in_development",
	});

	return {
		session: {
			sessionId: input.snapshot.sessionId,
			revision: input.snapshot.revision,
			state: input.snapshot.state,
			pendingActions: projectPendingActions(input.snapshot.state),
			f7: {
				status: f7.status,
				lifecycle: f7.lifecycle,
				actions: [],
			},
		},
		turns: input.turns.map(sanitizeTurn),
	};
}

export function projectPendingActions(state: RuntimeSnapshot["state"]): readonly PendingAction[] {
	switch (state) {
		case "initial_scope_required":
			return [{ featureId: "F1", action: "confirm_initial_scope", blocking: true }];
		case "downstream_scope_required":
			return [{ featureId: "F2", action: "confirm_downstream_scope", blocking: true }];
		case "ado_decision_required":
			return [{ featureId: "F3", action: "confirm_ado_decision", blocking: true }];
		case "image_decision_required":
			return [{ featureId: "F4", action: "confirm_image_decision", blocking: true }];
		case "analysis_context_decision_required":
			return [{ featureId: "F5", action: "confirm_analysis_context", blocking: true }];
		case "optimization_targets_decision_required":
			return [{ featureId: "F6", action: "confirm_optimization_targets", blocking: true }];
		case "review_required":
			return [{ featureId: "F6", action: "complete_review", blocking: false }];
		case "failed":
		case "cancelled":
			return [{ featureId: featureForState(state), action: "retry", blocking: true }];
		case "workbook_validating":
		case "f0_validating":
		case "f1_f2_running":
		case "f3_running":
		case "ado_action_pending":
		case "f4_running":
		case "f5_running":
		case "f6_running":
		case "f7_running":
			return [{ featureId: featureForState(state), action: "cancel", blocking: false }];
		default:
			return [];
	}
}

function featureForState(state: RuntimeSnapshot["state"]): string {
	switch (state) {
		case "workbook_validating":
		case "f0_validating":
			return "F0";
		case "initial_scope_required":
		case "f1_f2_running":
			return "F1";
		case "downstream_scope_required":
			return "F2";
		case "f3_running":
		case "ado_decision_required":
		case "ado_action_pending":
			return "F3";
		case "f4_running":
		case "image_decision_required":
			return "F4";
		case "f5_running":
		case "analysis_context_decision_required":
			return "F5";
		case "optimization_targets_decision_required":
		case "f6_running":
		case "review_required":
			return "F6";
		case "f7_import_required":
		case "f7_preview_required":
		case "f7_running":
		case "feedback_review_required":
		case "completed":
			return "F7";
		default:
			return "F0";
	}
}

function sanitizeTurn(turn: RuntimeTurn): SanitizedTurn {
	return {
		turnId: turn.turnId,
		role: turn.role,
		text: sanitizeText(turn.content.map((part) => {
			switch (part.kind) {
				case "text":
					return part.text;
				case "markdown":
					return part.markdown;
				case "artifact_reference":
					return part.label ?? part.artifactId;
				case "decision_reference":
					return part.decisionReference;
				case "command":
					return "governed command receipt";
				case "error":
					return part.error.summary;
				default:
					return "";
			}
		}).filter(Boolean).join("\n")),
	};
}

function sanitizeText(text: string): string {
	return text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200);
}