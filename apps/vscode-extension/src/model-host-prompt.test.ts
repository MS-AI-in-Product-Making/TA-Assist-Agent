import { describe, expect, it } from "vitest";

import { buildVsCodeModelUserMessage } from "./model-host-prompt.js";

describe("buildVsCodeModelUserMessage", () => {
  it("enforces the language declared by the server prompt and hides internal feature identifiers", () => {
    const message = buildVsCodeModelUserMessage("User request\n请解释当前风险。\n\nResponse language\n- 全部使用中文回答。\n\nGoverned evidence\n- Knowledge Library excerpts: none");

    expect(message).toContain("严格遵循 Response language");
    expect(message).toContain("不得在回答中出现内部功能代号");
    expect(message).not.toMatch(/\bF[0-7]\b/u);
  });

  it("preserves the server-owned evidence sections and adds the VS Code model boundary", () => {
    const message = buildVsCodeModelUserMessage(`User request\nExplain the current risk.\n\nGoverned evidence\n- Session: session-1\n\nOpen interpretation\n- Use only governed evidence.\n\nMissing evidence\n- None identified in the current governed context.\n\nSuggested checks\n- Compare baseline and Scenario.`);

    expect(message).toContain("Follow Response language exactly.");
    expect(message).toContain("Never expose internal feature identifiers.");
    expect(message).toContain("Governed evidence\n- Session: session-1");
    expect(message).toContain("Suggested checks\n- Compare baseline and Scenario.");
  });
});