export interface ConversationCursorStore {
  readCursor(sessionId: string, consumerId: string): Promise<number | null>;
  readTurns(sessionId: string, options?: { readonly afterSequence?: number }): Promise<readonly { readonly sequence: number }[]>;
  advanceCursor(sessionId: string, consumerId: string, sequence: number): Promise<number>;
}

export async function syncConversationUnread(input: {
  readonly sessionId: string;
  readonly consumerId: `vscode:${string}`;
  readonly store: ConversationCursorStore;
  readonly status: { text: string };
}): Promise<{ readonly unreadCount: number; markRead(): Promise<void> }> {
  const cursor = await input.store.readCursor(input.sessionId, input.consumerId) ?? 0;
  const turns = await input.store.readTurns(input.sessionId, { afterSequence: cursor });
  const latest = turns.reduce((maximum, turn) => Math.max(maximum, turn.sequence), cursor);
  input.status.text = turns.length === 0 ? "TA Assist" : `TA Assist (${turns.length})`;
  return {
    unreadCount: turns.length,
    async markRead() {
      if (latest > cursor) await input.store.advanceCursor(input.sessionId, input.consumerId, latest);
      input.status.text = "TA Assist";
    },
  };
}
