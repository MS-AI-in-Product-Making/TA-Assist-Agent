import { detectUserLanguage } from "./ta-workbook-language.js";

export const PRODUCT_WORKFLOWS = [
  { id: "knowledge-library", englishLabel: "Knowledge Library", chineseLabel: "知识库" },
  { id: "data-parsing", englishLabel: "Data Parsing", chineseLabel: "数据解析" },
  { id: "ta-real-measurement-analysis", englishLabel: "TA Real-Measurement Analysis", chineseLabel: "真实量测分析" },
  { id: "feedback-application", englishLabel: "Feedback Application", chineseLabel: "反馈应用" },
] as const;

export type ProductWorkflowId = (typeof PRODUCT_WORKFLOWS)[number]["id"];

export type TopLevelWorkflowIntent =
  | { readonly kind: "workbook_analysis" }
  | { readonly kind: "measured_analysis" }
  | { readonly kind: "session_operation"; readonly operation: "resume" | "status" | "change_language" }
  | { readonly kind: "knowledge_question" }
  | { readonly kind: "clarification_required"; readonly candidates: readonly ProductWorkflowId[] }
  | { readonly kind: "unsupported" };

const ANALYZE_VERB = /(分析|analy[sz]e)/i;
const WORKBOOK_CONTEXT = /(工作簿|\bworkbook\b|\bexcel\b|\.xlsx\b|[A-Za-z]:\\)/i;
const SESSION_RESUME = /(继续|resume|continue|恢复|回到).*(session|会话|分析)|\bresume\b/i;
const SESSION_STATUS = /(当前.*(状态|进度)|status|progress|blocker|阻塞|卡住)/i;
const LANGUAGE_CHANGE = /(切换.*(中文|英文|英语|English|Chinese)|change\s+language|switch\s+to\s+(english|chinese))/i;
const KNOWLEDGE_QUESTION = /(解释|说明|什么是|what\s+is|explain|how\s+does|how\s+to).*(cpk|能力指数|蒙特卡洛|monte\s+carlo|ta|公差|tolerance(?:\s+(?:analysis|stack(?:-?up)?))?|capability|distribution)/i;
const EXPLICIT_MEASURED = /(真实量测|实际量测|实测(?:数据|尺寸|结果|值|样本)?|actual measurements?|real measurements?|measured (?:values|samples|data|dimensions?)|measurement results?(?: from inspection)?|inspection measurements?|量测数据)/i;
const MONTE_CARLO_PROGRAMMING = /(write|build|create|implement|program).*(monte\s+carlo)|(python|javascript|typescript|excel).*(monte\s+carlo)/i;
const AMBIGUOUS_HELP = /^(?:help(?:\s+me)?(?:\s+with\s+this)?|帮帮我|帮我|需要帮助|hello|hi|你好)[.!?\s]*$/i;

const DEFAULT_CLARIFICATION_CANDIDATES = [
  "knowledge-library",
  "data-parsing",
  "ta-real-measurement-analysis",
  "feedback-application",
] as const satisfies readonly ProductWorkflowId[];

export function classifyTopLevelWorkflowIntent(text: string): TopLevelWorkflowIntent {
  const normalized = text.trim();
  if (normalized.length === 0) {
    return { kind: "clarification_required", candidates: DEFAULT_CLARIFICATION_CANDIDATES };
  }
  if (LANGUAGE_CHANGE.test(normalized)) return { kind: "session_operation", operation: "change_language" };
  if (SESSION_RESUME.test(normalized)) return { kind: "session_operation", operation: "resume" };
  if (SESSION_STATUS.test(normalized)) return { kind: "session_operation", operation: "status" };
  if (KNOWLEDGE_QUESTION.test(normalized)) return { kind: "knowledge_question" };
  if (!MONTE_CARLO_PROGRAMMING.test(normalized) && EXPLICIT_MEASURED.test(normalized)) return { kind: "measured_analysis" };
  if (ANALYZE_VERB.test(normalized) && WORKBOOK_CONTEXT.test(normalized)) return { kind: "workbook_analysis" };
  if (MONTE_CARLO_PROGRAMMING.test(normalized) || AMBIGUOUS_HELP.test(normalized)) {
    return { kind: "clarification_required", candidates: DEFAULT_CLARIFICATION_CANDIDATES };
  }
  return { kind: "unsupported" };
}

export function productWorkflowLabel(identifier: ProductWorkflowId, language = detectUserLanguage(identifier)): string {
  const workflow = PRODUCT_WORKFLOWS.find((entry) => entry.id === identifier);
  if (workflow === undefined) return identifier;
  return language === "zh" ? workflow.chineseLabel : workflow.englishLabel;
}