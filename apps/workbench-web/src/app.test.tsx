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
    async calculateWhatIf() {
      throw new Error("not implemented in test");
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

  it("opens the review What-if editor and keeps save separate from promotion", async () => {
    const user = userEvent.setup();
    const reviewSnapshot = snapshot({
      state: "review_required",
      revision: 7,
      downstreamScopeSelection: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["AJ_GAP"], confirmed: true },
    });
    const submitted: string[] = [];
    const calculatedPatches: unknown[] = [];
    const api = createApi(reviewSnapshot, "a".repeat(64), []);
    api.calculateWhatIf = async (_sessionId, input) => {
      calculatedPatches.push(input.patch);
      expect(input).toMatchObject({ tableId: "table-a", sourceRow: 2 });
      return ({
      contractVersion: "f8-scenario-draft-v1", draftId: input.draftId, sessionId: reviewSnapshot.sessionId, worksheetName: input.worksheetName, inputRevision: 1, status: "calculated", mode: "WHAT_IF", baselineWorkbookHash: "a".repeat(64), baselineRunReference: "f4-run-a", change: input.patch, calculationReference: `what-if:${input.draftId}`,
      calculationMetrics: { mean: 0, rssSigma: 0.018, cp: 1.6, cpkL: 1.5, cpkU: 1.7, cpk: 1.5, statisticalMargin: 0.1, worstCaseMargin: 0.05 },
      });
    };
    api.submitCommand = async (_sessionId, _revision, command) => { submitted.push(command); return reviewSnapshot; };
    render(<App api={api} preloadedState={{ snapshot: reviewSnapshot, sessionId: reviewSnapshot.sessionId, f4Report: {
      calculations: [{ worksheetSelection: { worksheetName: "AJ_GAP", tableId: "table-a" }, runReference: "f4-run-a", workbookContentHash: "a".repeat(64), projectReference: "project-a", calculationVersion: "excel-ta-v1", factors: [{ factorName: "AJ center to C-bucket", unit: "mm", source: { worksheetName: "AJ_GAP", tableId: "table-a", sourceRow: 2 }, input: { nominalValue: 0, upperTolerance: 0.05, lowerTolerance: -0.05 }, mean: 0 }], system: { mean: 0, rssSigma: 0.02, additionalMeanShift: 0, worstCaseLower: -0.05, worstCaseUpper: 0.05 }, capability: { lowerSpecLimit: -0.1, upperSpecLimit: 0.1, cp: 1.5, lowerCpk: 1.4, upperCpk: 1.6, cpk: 1.4 } }],
    } as never }} />);

    await user.click(screen.getByRole("button", { name: "打开公差试算" }));
    const upper = screen.getByLabelText("AJ center to C-bucket +Tol");
    await user.clear(upper);
    await user.type(upper, "0.04{Enter}");
    expect(await screen.findByTestId("draft-cpk")).toHaveTextContent("1.500");
    expect(calculatedPatches).toEqual([{ upperTolerance: 0.04 }]);
    await user.click(screen.getByRole("button", { name: "保存 Draft" }));
    expect(submitted).toEqual(["save_what_if_draft"]);
  });
});