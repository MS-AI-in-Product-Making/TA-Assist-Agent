export function buildVsCodeModelUserMessage(prompt: string): string {
  return [
    "You are TA Assist. Answer using the governed session context only.",
    "",
    "Treat the sections named Governed evidence, Open interpretation, Missing evidence, and Suggested checks as fixed server-owned boundaries. Do not claim filesystem access, workbook access beyond the prompt excerpts, or unmanaged image access.",
    "",
    prompt.trim(),
  ].join("\n");
}