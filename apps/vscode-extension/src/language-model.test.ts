import { describe, expect, it, vi } from "vitest";

import { createVsCodeLanguageModelAdapter } from "./language-model.js";

describe("createVsCodeLanguageModelAdapter", () => {
  it.each([
    ["请解释当前风险", { languageTag: "en-US", uiCatalogLanguage: "en", lockedAtTurnId: "turn-en", source: "workflow_start", fallbackUsed: false }, "Respond entirely in English"],
    ["Explain the current risk", { languageTag: "zh-CN", uiCatalogLanguage: "zh", lockedAtTurnId: "turn-zh", source: "workflow_start", fallbackUsed: false }, "全部使用中文回答"],
  ] as const)("builds a product-safe prompt for %s using the session lock", async (requestText, interactionLanguage, languageInstruction) => {
    const sendRequest = vi.fn(async () => ({ text: stream("response") }));
    const adapter = createVsCodeLanguageModelAdapter({
      model: { sendRequest } as never,
      createUserMessage: (text) => ({ text }) as never,
      interactionLanguage,
    });

    await adapter.complete({
      text: requestText,
      context: {
        session: {
          sessionId: "session-1",
          revision: 2,
          state: "f6_running",
          pendingActions: [{ featureId: "F6", action: "cancel", blocking: false }],
          f7: { status: "feature_not_available", lifecycle: "in_development", actions: [] },
        },
        turns: [],
      },
      policy: {} as never,
    });

    const prompt = JSON.stringify(sendRequest.mock.calls[0]);
    expect(prompt).toContain(languageInstruction);
    expect(prompt).toContain("Design Optimization");
    expect(prompt).not.toMatch(/\bF[0-7]\b/u);
    expect(prompt).not.toContain("f6_running");
  });
});

async function* stream(text: string) {
  yield text;
}