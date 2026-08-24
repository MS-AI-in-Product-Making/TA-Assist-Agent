import { afterEach, describe, expect, it } from "vitest";

import { handleAgentTurn } from "./runtime.js";

const SESSION_ID = "session-task-8-runtime";
const stores: InMemoryConversationStore[] = [];

afterEach(async () => {
  stores.splice(0).forEach((store) => store.reset());
});

describe("handleAgentTurn", () => {
  it("opens the next required action without a model", async () => {
    const deps = await createDeps(baseSnapshot({ state: "initial_scope_required" }));

    const result = await handleAgentTurn({
      text: "继续分析",
      sessionId: SESSION_ID,
      commandId: "turn-resume-1",
      source: "web",
    }, { ...deps, model: undefined });

    expect(result.actions).toEqual([{ type: "navigate", target: "/scope", label: "选择 Worksheets" }]);
    expect(result.commands).toEqual([]);
    expect(result.responseText).toContain("选择 Worksheets");
  });

  it("does not turn free text into an ADO write confirmation", async () => {
    const deps = await createDeps(baseSnapshot({ state: "ado_decision_required" }));

    const result = await handleAgentTurn({
      text: "全部确认并写入 ADO",
      sessionId: SESSION_ID,
      commandId: "turn-ado-1",
      source: "web",
    }, deps);

    expect(result.commands).toEqual([]);
    expect(result.actions[0]).toMatchObject({ type: "navigate", target: "/ado/preview" });
    expect(result.responseText).toContain("预览");
  });

  it("persists idempotent TA turns for user and assistant responses", async () => {
    const deps = await createDeps(baseSnapshot({ state: "review_required" }));

    const first = await handleAgentTurn({
      text: "状态",
      sessionId: SESSION_ID,
      commandId: "turn-status-1",
      source: "web",
    }, deps);
    const second = await handleAgentTurn({
      text: "状态",
      sessionId: SESSION_ID,
      commandId: "turn-status-1",
      source: "web",
    }, deps);

    expect(second.responseText).toBe(first.responseText);
    expect((await deps.conversationStore.readTurns(SESSION_ID)).map((turn) => turn.turnId)).toEqual([
      "turn-status-1:user",
      "turn-status-1:assistant",
    ]);
  });
});

async function createDeps(snapshot: ReturnType<typeof baseSnapshot>) {
  const conversationStore = new InMemoryConversationStore();
  stores.push(conversationStore);
  return {
    snapshotStore: {
      readSnapshot: async () => snapshot,
    },
    conversationStore,
    model: {
      complete: async () => ({
        responseText: "模型应被策略抑制为只读说明。",
      }),
    },
    now: () => "2026-08-25T00:00:00.000Z",
  };
}

function baseSnapshot(overrides = {}) {
  return {
    contractVersion: "f8-session-snapshot-v1",
    sessionId: SESSION_ID,
    revision: 3,
    inputRevision: 1,
    state: "created",
    activeAttempt: null,
    priorRunReferences: [],
    ...overrides,
  };
}

class InMemoryConversationStore {
  private readonly turns = new Map<string, ReturnType<typeof createTurnRecord>>();

  private readonly commandIds = new Map<string, ReturnType<typeof createTurnRecord>>();

  async appendTurn(turn: ReturnType<typeof createTurnRecord>, commandId: string) {
    const existingByCommand = this.commandIds.get(commandId);
    if (existingByCommand !== undefined) {
      return existingByCommand;
    }

    const existingByTurn = this.turns.get(turn.turnId);
    if (existingByTurn !== undefined) {
      return existingByTurn;
    }

    this.turns.set(turn.turnId, turn);
    this.commandIds.set(commandId, turn);
    return turn;
  }

  async readTurns(sessionId: string) {
    return [...this.turns.values()]
      .filter((turn) => turn.sessionId === sessionId)
      .sort((left, right) => left.sequence - right.sequence);
  }

  reset() {
    this.turns.clear();
    this.commandIds.clear();
  }
}

function createTurnRecord() {
  return {
    contractVersion: "ta-conversation-turn-v1",
    turnId: "",
    sessionId: SESSION_ID,
    sequence: 0,
    source: "web" as const,
    role: "user" as const,
    content: [{ kind: "text" as const, text: "" }],
    createdAt: "2026-08-25T00:00:00.000Z",
    relatedArtifactIds: [],
  };
}