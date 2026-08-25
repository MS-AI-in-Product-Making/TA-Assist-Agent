import { describe, expect, it, vi } from "vitest";

import { runAgentCommand } from "./agent.js";

const SESSION_ID = "30303030-3030-4303-8303-303030303030";

describe("runAgentCommand", () => {
  it("resumes the same Workbench session without printing bootstrap credentials", async () => {
    const resume = vi.fn(async () => ({ sessionId: SESSION_ID, url: `http://127.0.0.1:4317/?session=${SESSION_ID}` }));
    const result = await runAgentCommand({ action: "resume", rootDir: "repo", sessionId: SESSION_ID }, { resume });

    expect(resume).toHaveBeenCalledWith("repo", SESSION_ID);
    expect(result).toContain(`session: ${SESSION_ID}`);
    expect(result).toContain(`http://127.0.0.1:4317/?session=${SESSION_ID}`);
    expect(result).not.toMatch(/bootstrap|token|nonce/i);
  });

  it("starts analyze and workbench through the shared launcher", async () => {
    const analyze = vi.fn(async () => ({ sessionId: SESSION_ID, url: "http://127.0.0.1:4317/" }));
    const workbench = vi.fn(async () => ({ sessionId: SESSION_ID, url: "http://127.0.0.1:4317/" }));

    await runAgentCommand({ action: "analyze", rootDir: "repo" }, { analyze, workbench });
    await runAgentCommand({ action: "workbench", rootDir: "repo" }, { analyze, workbench });

    expect(analyze).toHaveBeenCalledWith("repo");
    expect(workbench).toHaveBeenCalledWith("repo");
  });
});
