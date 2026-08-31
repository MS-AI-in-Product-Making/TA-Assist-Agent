import { describe, expect, it, vi } from "vitest";

import { launchNewWorkbench, launchWorkbench, resumeWorkbench } from "./workbench-launcher.js";

const SESSION_ID = "30303030-3030-4303-8303-303030303030";

describe("workbench launcher", () => {
  it("returns the real session ID created by analyze launch", async () => {
    const process = {
      launch: vi.fn(async () => ({ sessionId: SESSION_ID, url: `http://127.0.0.1:4317/?session=${SESSION_ID}` })),
    };

    const launched = await launchNewWorkbench("repo", process);

    expect(process.launch).toHaveBeenCalledWith(["agent", "analyze", "--root", "repo"]);
    expect(launched).toEqual({ sessionId: SESSION_ID, url: `http://127.0.0.1:4317/?session=${SESSION_ID}` });
  });

  it("rejects analyze launches that still return a pending browser-created session", async () => {
    const process = {
      launch: vi.fn(async () => ({ sessionId: "pending", url: "http://127.0.0.1:4317/" })),
    };

    await expect(launchNewWorkbench("repo", process)).rejects.toThrow("real session");
    });

    it("preserves pure workbench launch without requiring a session", async () => {
      const process = {
        launch: vi.fn(async () => ({ sessionId: "pending", url: "http://127.0.0.1:4317/" })),
      };

      const launched = await launchWorkbench("repo", process);

      expect(process.launch).toHaveBeenCalledWith(["agent", "workbench", "--root", "repo"]);
      expect(launched).toEqual({ url: "http://127.0.0.1:4317/" });
  });

  it("preserves resume binding validation", async () => {
    const process = {
      launch: vi.fn(async () => ({ sessionId: SESSION_ID, url: `http://127.0.0.1:4317/?session=${SESSION_ID}` })),
    };

    const launched = await resumeWorkbench("repo", SESSION_ID, process);

    expect(process.launch).toHaveBeenCalledWith(["agent", "resume", "--root", "repo", "--session", SESSION_ID]);
    expect(launched).toEqual({ sessionId: SESSION_ID, url: `http://127.0.0.1:4317/?session=${SESSION_ID}` });
  });
});