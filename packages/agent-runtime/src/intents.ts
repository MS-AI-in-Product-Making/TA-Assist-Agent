export type AgentIntentType =
	| "analyze"
	| "resume"
	| "status"
	| "explain_blocker"
	| "show_evidence"
	| "navigate"
	| "what_if_help"
	| "ado_guidance"
	| "open_report"
	| "f7_status";

export interface AgentIntent {
	readonly type: AgentIntentType;
	readonly executable: boolean;
	readonly wantsWrite: boolean;
	readonly matchedPhrases: readonly string[];
}

const WRITE_PATTERN = /(确认|写入|发布|delete|export|confirm|write|publish)/i;
const CURRENT_SESSION_PATTERN = /current[-\s]*session|当前\s*session|当前会话/i;

export function detectAgentIntent(text: string): AgentIntent {
	const normalized = text.trim();
	const lowered = normalized.toLowerCase();
	const matchedPhrases: string[] = [];
	const wantsWrite = WRITE_PATTERN.test(normalized);

	if (matchAny(normalized, ["继续", "resume", "continue"]) || CURRENT_SESSION_PATTERN.test(normalized)) {
		matchedPhrases.push("resume");
		return { type: "resume", executable: false, wantsWrite, matchedPhrases };
	}

	if (matchAny(normalized, ["状态", "status", "进度"])) {
		matchedPhrases.push("status");
		return { type: "status", executable: false, wantsWrite, matchedPhrases };
	}

	if (matchAny(normalized, ["blocker", "卡住", "阻塞", "问题"])) {
		matchedPhrases.push("explain_blocker");
		return { type: "explain_blocker", executable: false, wantsWrite, matchedPhrases };
	}

	if (matchAny(normalized, ["证据", "evidence"])) {
		matchedPhrases.push("show_evidence");
		return { type: "show_evidence", executable: false, wantsWrite, matchedPhrases };
	}

	if (matchAny(normalized, ["what if", "what-if", "试算", "scenario"])) {
		matchedPhrases.push("what_if_help");
		return { type: "what_if_help", executable: false, wantsWrite, matchedPhrases };
	}

	if (matchAny(normalized, ["报告", "report"])) {
		matchedPhrases.push("open_report");
		return { type: "open_report", executable: false, wantsWrite, matchedPhrases };
	}

	if (matchAny(normalized, ["f7", "实测", "feedback"])) {
		matchedPhrases.push("f7_status");
		return { type: "f7_status", executable: false, wantsWrite, matchedPhrases };
	}

	if (matchAny(normalized, ["ado", "发布", "work item"])) {
		matchedPhrases.push("ado_guidance");
		return { type: "ado_guidance", executable: false, wantsWrite: wantsWrite || lowered.includes("ado"), matchedPhrases };
	}

	if (matchAny(normalized, ["打开", "前往", "navigate", "go to"])) {
		matchedPhrases.push("navigate");
		return { type: "navigate", executable: false, wantsWrite, matchedPhrases };
	}

	return {
		type: "analyze",
		executable: false,
		wantsWrite,
		matchedPhrases,
	};
}

function matchAny(text: string, phrases: readonly string[]): boolean {
	const lowered = text.toLowerCase();
	return phrases.some((phrase) => lowered.includes(phrase.toLowerCase()));
}