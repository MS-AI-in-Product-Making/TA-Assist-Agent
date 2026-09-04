export function buildVsCodeModelUserMessage(prompt: string): string {
  const chinese = prompt.includes("全部使用中文回答");
  return [
    chinese
      ? "你是 TA Assist。仅使用受治理的当前会话上下文回答。"
      : "You are TA Assist. Answer using the governed session context only.",
    "",
    chinese
      ? "严格遵循 Response language。不得在回答中出现内部功能代号。将 Governed evidence、Open interpretation、Missing evidence 和 Suggested checks 视为服务端固定边界。不得声称可访问文件系统、提示摘录之外的工作簿内容或未受治理的图片。"
      : "Follow Response language exactly. Never expose internal feature identifiers. Treat the sections named Governed evidence, Open interpretation, Missing evidence, and Suggested checks as fixed server-owned boundaries. Do not claim filesystem access, workbook access beyond the prompt excerpts, or unmanaged image access.",
    "",
    prompt.trim(),
  ].join("\n");
}