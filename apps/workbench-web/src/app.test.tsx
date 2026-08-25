import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "./app.js";
import type { WorkbenchApi } from "./api.js";
import type { F8SessionSnapshot } from "./workbench-session.js";

function snapshot(overrides: Partial<F8SessionSnapshot>): F8SessionSnapshot {
  return {
    contractVersion: "f8-session-snapshot-v1",
    sessionId: "session-1",
    revision: 1,
    inputRevision: 1,
    state: "initial_scope_required",
    activeAttempt: null,
    priorRunReferences: [],
    worksheetCapabilities: [
      { worksheetName: "AJ_GAP", whatIfAvailable: false },
      { worksheetName: "B_STACK", whatIfAvailable: false },
    ],
    ...overrides,
  };
}

function createApi(currentSnapshot: F8SessionSnapshot, pendingWorkbookHash: string, commands: Array<{ command: string; worksheetNames: string[] }>): WorkbenchApi {
  return {
    async bootstrap() {
      return {
        sessionId: currentSnapshot.sessionId,
        snapshot: currentSnapshot,
        conversation: [],
        pendingWorkbookHash,
      };
    },
    subscribe() {
      return () => undefined;
    },
    async uploadWorkbook() {
      throw new Error("not implemented in test");
    },
    async submitCommand(_sessionId, _expectedRevision, command, payload) {
      if (command === "confirm_initial_scope" || command === "confirm_downstream_scope") {
        commands.push({ command, worksheetNames: [...payload.worksheetNames] });
      }

      return currentSnapshot;
    },
    async appendConversationTurn() {
      throw new Error("not implemented in test");
    },
    async loadArtifactJson() {
      return undefined;
    },
  };
}

describe("App", () => {
  it("keeps the two worksheet confirmations separate", async () => {
    const user = userEvent.setup();
    const commands: Array<{ command: string; worksheetNames: string[] }> = [];
    const initialSnapshot = snapshot({ state: "initial_scope_required" });

    const initialApi = createApi(initialSnapshot, "a".repeat(64), commands);
    const { rerender } = render(
      <App
        api={initialApi}
        preloadedState={{
          snapshot: initialSnapshot,
          sessionId: initialSnapshot.sessionId,
          pendingWorkbookHash: "a".repeat(64),
          conversation: [],
          connected: true,
          loading: false,
        }}
        initialWorksheetOptions={[
          { worksheetName: "AJ_GAP", status: "available" },
          { worksheetName: "B_STACK", status: "available" },
        ]}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "AJ_GAP" }));
    await user.click(screen.getByRole("button", { name: "确认初始分析范围" }));

    expect(commands.at(-1)).toEqual({ command: "confirm_initial_scope", worksheetNames: ["AJ_GAP"] });

    const downstreamSnapshot = snapshot({
      state: "downstream_scope_required",
      revision: 2,
      initialScopeSelection: {
        workbookContentHash: "a".repeat(64),
        selectedWorksheetNames: ["AJ_GAP"],
        confirmed: true,
      },
    });

    rerender(
      <App
        api={createApi(downstreamSnapshot, "a".repeat(64), commands)}
        preloadedState={{
          snapshot: downstreamSnapshot,
          sessionId: downstreamSnapshot.sessionId,
          pendingWorkbookHash: "a".repeat(64),
          conversation: [],
          connected: true,
          loading: false,
        }}
        downstreamWorksheetOptions={[
          { worksheetName: "AJ_GAP", status: "ready" },
          { worksheetName: "B_STACK", status: "blocked", disabled: true },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "确认进入工程分析" })).toBeVisible();
  });
});