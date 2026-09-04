import type { LanguageModelAdapter } from "@ai-assist/agent-runtime";
import type { CancellationToken, LanguageModelChat, LanguageModelChatMessage } from "vscode";

export function createVsCodeLanguageModelAdapter(input: {
  readonly model: LanguageModelChat;
  readonly token?: CancellationToken;
  readonly createUserMessage: (text: string) => LanguageModelChatMessage;
}): LanguageModelAdapter {
  return {
    async complete(request) {
      const chinese = /\p{Script=Han}/u.test(request.text);
      const capabilityNames: Readonly<Record<string, string>> = {
        F0: "Knowledge Library",
        F1: "Data Parsing",
        F2: "Data Cleaning",
        F3: "Drawing Governance",
        F4: "TA Calculation",
        F5: "Result Interpretation",
        F6: "Design Optimization",
        F7: "Feedback Application",
      };
      const governedContext = {
        session: {
          sessionId: request.context.session.sessionId,
          revision: request.context.session.revision,
          pendingActions: request.context.session.pendingActions.map((action) => ({
            capability: capabilityNames[action.featureId] ?? "TA Workbook Analysis",
            action: action.action.replaceAll("_", " "),
            blocking: action.blocking,
          })),
        },
        turns: request.context.turns,
      };
      const languageInstruction = chinese
        ? "全部使用中文回答，包括解释、建议、进度和操作说明。"
        : "Respond entirely in English, including explanations, recommendations, progress, and action text.";
      const response = await input.model.sendRequest([
        input.createUserMessage(`You are TA Assist. Answer concisely using only this governed context. ${languageInstruction} Use product capability names only and never expose internal feature identifiers.\n${JSON.stringify(governedContext)}\n\nUser: ${request.text}`),
      ], {}, input.token);
      let responseText = "";
      for await (const chunk of response.text) responseText += chunk;
      return { responseText };
    },
  };
}
