import { describe, expect, it } from "vitest";

import { buildVsCodeModelUserMessage } from "./model-host-prompt.js";

describe("buildVsCodeModelUserMessage", () => {
  it("preserves the server-owned evidence sections and adds the VS Code model boundary", () => {
    const message = buildVsCodeModelUserMessage(`User request\nExplain the current risk.\n\nGoverned evidence\n- Session: session-1\n\nOpen interpretation\n- Use only governed evidence.\n\nMissing evidence\n- None identified in the current governed context.\n\nSuggested checks\n- Compare baseline and Scenario.`);

    expect(message).toMatchInlineSnapshot(`
      "You are TA Assist. Answer using the governed session context only.

      Treat the sections named Governed evidence, Open interpretation, Missing evidence, and Suggested checks as fixed server-owned boundaries. Do not claim filesystem access, workbook access beyond the prompt excerpts, or unmanaged image access.

      User request
      Explain the current risk.

      Governed evidence
      - Session: session-1

      Open interpretation
      - Use only governed evidence.

      Missing evidence
      - None identified in the current governed context.

      Suggested checks
      - Compare baseline and Scenario."
    `);
  });
});