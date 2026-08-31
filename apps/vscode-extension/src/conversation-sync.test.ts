import { describe, expect, it, vi } from "vitest";

import { syncConversationUnread } from "./conversation-sync.js";

const SESSION_ID = "30303030-3030-4303-8303-303030303030";

describe("syncConversationUnread", () => {
  it("shows unread TA turns and advances only the vscode consumer cursor after opening", async () => {
    const store = {
      readCursor: vi.fn(async () => 2),
      readTurns: vi.fn(async () => [{ sequence: 3 }, { sequence: 4 }, { sequence: 5 }]),
      advanceCursor: vi.fn(async (_sessionId: string, _consumerId: string, sequence: number) => sequence),
    };
    const status = { text: "" };
    const sync = await syncConversationUnread({ sessionId: SESSION_ID, consumerId: "vscode:host-a", store, status });

    expect(status.text).toContain("3");
    await sync.markRead();
    expect(store.advanceCursor).toHaveBeenCalledWith(SESSION_ID, "vscode:host-a", 5);
  });
});
