import type { LanguageModelAdapter } from "@ai-assist/agent-runtime";
import type { CancellationToken, LanguageModelChat, LanguageModelChatMessage } from "vscode";

export function createVsCodeLanguageModelAdapter(input: {
  readonly model: LanguageModelChat;
  readonly token?: CancellationToken;
  readonly createUserMessage: (text: string) => LanguageModelChatMessage;
}): LanguageModelAdapter {
  return {
    async complete(request) {
      const response = await input.model.sendRequest([
        input.createUserMessage(`You are TA Assist. Answer concisely using only this governed context:\n${JSON.stringify(request.context)}\n\nUser: ${request.text}`),
      ], {}, input.token);
      let responseText = "";
      for await (const chunk of response.text) responseText += chunk;
      return { responseText };
    },
  };
}
