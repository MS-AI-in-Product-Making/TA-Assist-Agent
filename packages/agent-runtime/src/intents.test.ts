import { describe, expect, it } from "vitest";

import { detectAgentIntent } from "./intents.js";

describe("detectAgentIntent", () => {
  it("prefers resume for continue-analysis requests", () => {
    expect(detectAgentIntent("继续分析")).toMatchObject({
      type: "resume",
      wantsWrite: false,
    });
  });

  it("keeps current-session continuation on resume intent", () => {
    expect(detectAgentIntent("continue analyzing current session factor table")).toMatchObject({
      type: "resume",
      wantsWrite: false,
    });
  });

  it("keeps free text write language out of executable intents", () => {
    expect(detectAgentIntent("全部确认并写入 ADO")).toMatchObject({
      type: "ado_guidance",
      wantsWrite: true,
      executable: false,
    });
  });
});