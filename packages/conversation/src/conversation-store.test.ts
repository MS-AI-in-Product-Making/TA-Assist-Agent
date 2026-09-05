import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { createConversationStore } from "./conversation-store.js";

const SESSION_ID = "session-001";
const COMMAND_ID = "command-001";
const RETRY_COMMAND_ID = "command-002";
const CURSOR_SESSION = "session-002";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("ConversationStore", () => {
  it("shares ordered turns across web, vscode, and cli", async () => {
    const rootDir = await createTempRoot();
    const store = await createConversationStore({ rootDir });
    try {
      await store.appendTurn(turn("web", "user", 1), "web-command-1");
      await store.appendTurn(turn("vscode", "assistant", 2), "vscode-command-1");
      await store.appendTurn(turn("cli", "user", 3), "cli-command-1");

      expect((await store.readTurns(SESSION_ID, { afterSequence: 0 })).map((conversationTurn) => conversationTurn.source))
        .toEqual(["web", "vscode", "cli"]);
    } finally {
      await store.close();
    }
  });

  it("does not duplicate a participant request retry", async () => {
    const rootDir = await createTempRoot();
    const store = await createConversationStore({ rootDir });
    try {
      const original = await store.appendTurn(turn("vscode", "user", 1), COMMAND_ID);
      const retried = await store.appendTurn(turn("vscode", "user", 1), COMMAND_ID);

      expect(retried).toEqual(original);
    } finally {
      await store.close();
    }
  });

  it("keeps cursors monotonic and independent per consumer", async () => {
    const rootDir = await createTempRoot();
    const store = await createConversationStore({ rootDir });
    try {
      await store.appendTurn(turn("web", "user", 1), "web-command-1");
      await store.appendTurn(turn("web", "assistant", 2), "web-command-2");
      await store.appendTurn(turn("cli", "tool", 3), "cli-command-1");

      expect(await store.advanceCursor(CURSOR_SESSION, "web:browser-1", 2)).toBe(2);
      expect(await store.advanceCursor(CURSOR_SESSION, "web:browser-1", 1)).toBe(2);
      expect(await store.advanceCursor(CURSOR_SESSION, "vscode:instance-1", 1)).toBe(1);

      expect(await store.readCursor(CURSOR_SESSION, "web:browser-1")).toBe(2);
      expect(await store.readCursor(CURSOR_SESSION, "vscode:instance-1")).toBe(1);
    } finally {
      await store.close();
    }
  });

  it("persists ordered turns and cursors across reopen", async () => {
    const rootDir = await createTempRoot();
    const store = await createConversationStore({ rootDir });
    try {
      await store.appendTurn(turn("web", "user", 1), "web-command-1");
      await store.appendTurn(turn("vscode", "assistant", 2), "vscode-command-1");
      await store.appendTurn(turn("cli", "tool", 3), "cli-command-1");
      await store.advanceCursor(SESSION_ID, "web:browser-1", 2);
    } finally {
      await store.close();
    }

    const reopened = await createConversationStore({ rootDir });
    try {
      expect((await reopened.readTurns(SESSION_ID, { afterSequence: 0 })).map((conversationTurn) => conversationTurn.source))
        .toEqual(["web", "vscode", "cli"]);
      expect(await reopened.readCursor(SESSION_ID, "web:browser-1")).toBe(2);
    } finally {
      await reopened.close();
    }
  });

  it("rejects native chat history payloads before persistence", async () => {
    const rootDir = await createTempRoot();
    const store = await createConversationStore({ rootDir });
    try {
      await expect(store.appendTurn({
        ...turn("web", "user", 1),
        history: [{ role: "user", content: "native chat turn" }],
      } as never, RETRY_COMMAND_ID)).rejects.toMatchObject({
        code: "validation_error",
      });
    } finally {
      await store.close();
    }
  });

  it("round-trips assistant report references and canonical open_report actions", async () => {
    const rootDir = await createTempRoot();
    const store = await createConversationStore({ rootDir });
    try {
      await store.appendTurn({
        ...turn("web", "assistant", 1),
        turnId: "assistant-report-1",
        content: [
          { kind: "text", text: "当前分析已同步。" },
          { kind: "artifact_reference", artifactId: "f6-report:7", label: "Feature6-Report.md" },
          { kind: "tool_result", actions: [{ type: "open_report", target: "/report/current", label: "打开当前报告" }], commands: [] },
        ],
        relatedArtifactIds: ["f6-report:7"],
      }, "assistant-report-command-1");

      const stored = await store.readTurns(SESSION_ID, { afterSequence: 0 });
      expect(stored).toHaveLength(1);
      expect(stored[0]?.content).toContainEqual({
        kind: "artifact_reference",
        artifactId: "f6-report:7",
        label: "Feature6-Report.md",
      });
      expect(stored[0]?.relatedArtifactIds).toEqual(["f6-report:7"]);
    } finally {
      await store.close();
    }
  });
});

function turn(source: "web" | "vscode" | "cli", role: "user" | "assistant" | "tool", sequence: number) {
  return {
    contractVersion: "ta-conversation-turn-v1",
    turnId: `${source}-${sequence}`,
    sessionId: SESSION_ID,
    sequence,
    source,
    role,
    content: [{ kind: "text", text: `${source}-${sequence}` }],
    createdAt: new Date(Date.UTC(2026, 7, 24, 0, 0, sequence)).toISOString(),
    relatedArtifactIds: [],
  };
}

async function createTempRoot(): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), "conversation-store-"));
  tempRoots.push(rootDir);
  return rootDir;
}