import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { DrawingGovernanceResultV2, F8AdoProjection, F8AdoWriteConfirmation } from "@ai-assist/contracts";
import type { ConversationTurn } from "@ai-assist/conversation";
import type { WorkbenchApi } from "./api.js";
import { App } from "./app.js";
import type { F8SessionSnapshot } from "./workbench-session.js";

const SESSION_ID = "session-app-test";
const KNOWN_CHINESE_UI_TEXT = [
  "确认初始分析范围",
  "确认进入工程分析",
  "保存 Scenario",
  "正在准备 TA 工作区",
  "分析进度",
  "当前 Worksheet",
  "尺寸链堆叠图",
  "会话面板",
  "上传 workbook",
  "只读源文件",
  "撤销",
  "导出",
  "优化结论",
  "缺失信息与数据健康",
  "ADO 治理验收",
  "关闭 TA Assistant",
  "打开 TA Assistant",
  "已连接",
  "连接恢复中",
];
const FEATURE_LABELS = ["Load Library", "Extract Data", "Check Inputs", "Drawing Governance", "Calculate TA", "Interpret Results", "Optimize Design", "Apply Feedback"];

afterEach(cleanup);

describe("App", () => {
  it("keeps the two worksheet confirmations separate", async () => {
    const commands: Array<{ command: string; worksheetNames: string[]; workbookHash: string | undefined }> = [];
    const submitCommand = async (command: string, payload: Record<string, unknown>) => {
      commands.push({
        command,
        worksheetNames: [...((payload.worksheetNames as string[] | undefined) ?? [])],
        workbookHash: payload.workbookHash as string | undefined,
      });
    };

    const { rerender } = render(
      <App
        preloadedState={{
          snapshot: snapshot("initial_scope_required"),
          pendingWorkbookHash: "a".repeat(64),
          submitCommand,
          conversation: [],
          loading: false,
          connected: true,
        }}
        initialWorksheetOptions={[
          { worksheetName: "AJ_GAP", status: "available" },
          { worksheetName: "B_STACK", status: "available" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "AJ_GAP" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm initial scope" }));

    expect(commands).toEqual([
      { command: "confirm_initial_scope", worksheetNames: ["AJ_GAP"], workbookHash: "a".repeat(64) },
    ]);

    rerender(
      <App
        preloadedState={{
          snapshot: snapshot("downstream_scope_required", {
            revision: 2,
            initialScopeSelection: {
              workbookContentHash: "b".repeat(64),
              selectedWorksheetNames: ["AJ_GAP"],
              confirmed: true,
            },
          }),
          submitCommand,
          conversation: [],
          loading: false,
          connected: true,
        }}
        downstreamWorksheetOptions={[
          { worksheetName: "AJ_GAP", status: "ready" },
          { worksheetName: "B_STACK", status: "ready" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "B_STACK" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm engineering scope" }));

    expect(commands).toEqual([
      { command: "confirm_initial_scope", worksheetNames: ["AJ_GAP"], workbookHash: "a".repeat(64) },
      { command: "confirm_downstream_scope", worksheetNames: ["B_STACK"], workbookHash: "b".repeat(64) },
    ]);
  }, 15_000);

  it("opens the review What-if editor and keeps save separate from promotion", async () => {
    const reviewSnapshot = snapshot("review_required", {
      revision: 7,
      downstreamScopeSelection: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["AJ_GAP"], confirmed: true },
    });
    const submitted: string[] = [];
    const calculatedPatches: unknown[] = [];
    const api = createApi(reviewSnapshot, "a".repeat(64), []);
    api.calculateWorksheetWhatIf = async (_sessionId, input) => {
      calculatedPatches.push(input.factorOverrides);
      expect(input).toMatchObject({ worksheetName: "AJ_GAP", factorOverrides: [{ tableId: "table-a", sourceRow: 2, upperTolerance: 0.04 }] });
      return {
        contractVersion: "f8-scenario-draft-v1",
        draftId: "draft-a",
        sessionId: reviewSnapshot.sessionId,
        worksheetName: input.worksheetName,
        inputRevision: input.inputRevision,
        status: "calculated",
        mode: "WHAT_IF",
        baselineWorkbookHash: "a".repeat(64),
        baselineRunReference: "f4-run-a",
        change: { upperTolerance: 0.04 },
        calculationReference: "what-if:draft-a",
        calculationMetrics: { mean: 0, rssSigma: 0.018, cp: 1.6, cpkL: 1.5, cpkU: 1.7, cpk: 1.5, statisticalMargin: 0.1, worstCaseMargin: 0.05 },
        factorResults: [],
      };
    };
    render(
      <App
        api={api}
        preloadedState={{
          snapshot: reviewSnapshot,
          sessionId: reviewSnapshot.sessionId,
          submitCommand: async (command) => {
            submitted.push(command);
          },
          f4Report: {
            source: { workbookFileName: "anonymous.xlsx" },
            calculations: [{
              worksheetSelection: { worksheetName: "AJ_GAP" },
              runReference: "f4-run-a",
              workbookContentHash: "a".repeat(64),
              projectReference: "project-a",
              calculationVersion: "excel-ta-v1",
              factors: [{
                factorName: "AJ center to C-bucket",
                unit: "mm",
                source: { worksheetName: "AJ_GAP", tableId: "table-a", sourceRow: 2 },
                input: { nominalValue: 0, upperTolerance: 0.05, lowerTolerance: -0.05 },
                mean: 0,
              }],
              system: { mean: 0, rssSigma: 0.02, additionalMeanShift: 0, worstCaseLower: -0.05, worstCaseUpper: 0.05 },
              capability: { lowerSpecLimit: -0.1, upperSpecLimit: 0.1, cp: 1.5, lowerCpk: 1.4, upperCpk: 1.6, cpk: 1.4, status: "PASS" },
            }],
          } as never,
          f2Report: {
            status: "completed",
            worksheets: [{
              worksheetName: "AJ_GAP",
              status: "ready",
              toleranceLoopDescription: "Gap",
              tolerancePathImageStatus: "available",
              systemSpecification: { status: "available" },
              systemSpecificationIssues: [],
              missingFieldSummary: [],
              rows: [{
                worksheetName: "AJ_GAP",
                tableId: "table-a",
                sourceRow: 2,
                actualFields: {
                  factorName: "AJ center to C-bucket",
                  partName: "Part",
                  drawingNumber: null,
                  dimCharacteristicId: null,
                  partCategory: "CNC",
                  nominalValue: 0,
                  upperTolerance: 0.05,
                  lowerTolerance: -0.05,
                  longTermSafetyFactor: 1,
                  sigmaLevel: 3,
                  distribution: "Normal",
                  mean: 0,
                  tolerance: 0.1,
                  oneSigma: 0.02,
                  percentContributionToSigma: 0.1,
                  notes: null,
                },
                displayFields: {
                  factorName: "AJ center to C-bucket",
                  partName: "Part",
                  drawingNumber: null,
                  dimCharacteristicId: null,
                  partCategory: "CNC",
                  nominalValue: "0",
                  upperTolerance: "0.05",
                  lowerTolerance: "-0.05",
                  longTermSafetyFactor: "1",
                  sigmaLevel: "3",
                  distribution: "Normal",
                  mean: "0",
                  tolerance: "0.1",
                  oneSigma: "0.02",
                  percentContributionToSigma: "10.0%",
                  notes: null,
                },
                sourceCells: {},
                missingRequiredFields: [],
                missingIdentifiers: [],
                capabilityStatus: "in_library_tolerance_and_distribution_differ",
                f0KnowledgeBaseVersion: "v1",
                recommendation: { kind: "public", toleranceMin: 0.1, toleranceMax: 0.3, unit: "mm", distribution: "normal", capabilityEntryId: "cap-demo" },
                adoReminderRequested: false,
              }],
              f4CalculabilityIssues: [],
            }],
            summary: {
              worksheetsChecked: 1,
              readyWorksheetCount: 1,
              blockedWorksheetCount: 0,
              requiredMissingFieldCount: 0,
              missingImageWorksheetCount: 0,
              missingDimIdCount: 0,
              missingPartNumberCount: 0,
              f0InformationInsufficientCount: 0,
              nonF0ProcessCategoryCount: 0,
            },
            f4Handoffs: [],
            adoEvents: [],
          } as never,
          conversation: [],
          loading: false,
          connected: true,
        }}
      />,
    );

    const upper = screen.getByRole("spinbutton", { name: "AJ center to C-bucket upperTolerance" });
  fireEvent.click(upper);
    fireEvent.change(upper, { target: { value: "0.04" } });
    fireEvent.blur(upper);

    await waitFor(() => expect(calculatedPatches).toEqual([[{ worksheetName: "AJ_GAP", tableId: "table-a", sourceRow: 2, upperTolerance: 0.04 }]]));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Save scenario" }).some((button) => !button.hasAttribute("disabled"))).toBe(true));
    const saveButton = screen.getAllByRole("button", { name: "Save scenario" }).find((button) => !button.hasAttribute("disabled"));
    expect(saveButton).toBeDefined();
    fireEvent.click(saveButton!);
    expect(submitted).toEqual(["save_what_if_draft"]);
  }, 15_000);

  it("presents one business preparation state without workflow process labels", () => {
    render(<App preloadedState={{ snapshot: snapshot("f1_f2_running"), conversation: [], loading: false, connected: true, runnerProgress: { kind: "stage_started", featureId: "F2", stage: "report", timestamp: "2026-08-28T00:00:00.000Z" } }} />);

    expect(screen.getByText("Preparing TA workspace...")).toBeVisible();
    expect(screen.getByRole("region", { name: "Analysis progress" })).toBeVisible();
    for (const featureId of ["F0", "F1", "F2", "F3", "F4", "F5", "F6", "F7"]) expect(screen.getByText(featureId)).toBeVisible();
    for (const label of FEATURE_LABELS) expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText("Generating user report")).toBeVisible();
    expect(screen.getByText("F1").closest("li")).toHaveTextContent("Completed");
    expect(screen.getByText("F2").closest("li")).toHaveTextContent("Running");
  }, 15_000);

  it("keeps visible shell copy in English while allowing source text tooltips", () => {
    const { container } = render(<App preloadedState={{
      snapshot: snapshot("review_required"),
      conversation: [],
      loading: false,
      connected: true,
      f4Report: {
        source: { workbookFileName: "anonymous.xlsx" },
        calculations: [{
          worksheetSelection: { worksheetName: "AJ_GAP" },
          factors: [],
          system: { mean: 0, rssSigma: 0.05, additionalMeanShift: 0, worstCaseLower: -0.1, worstCaseUpper: 0.1 },
          capability: { lowerSpecLimit: -0.2, upperSpecLimit: 0.2, cp: 1.33, lowerCpk: 1.2, upperCpk: 1.3, cpk: 1.2, status: "PASS" },
        }],
      } as never,
      f2Report: {
        status: "partiallyBlocked",
        worksheets: [{
          worksheetName: "AJ_GAP",
          status: "ready",
          toleranceLoopDescription: "Gap",
          tolerancePathImageStatus: "available",
          systemSpecification: { status: "available" },
          systemSpecificationIssues: [],
          missingFieldSummary: [],
          rows: [{
            worksheetName: "AJ_GAP",
            tableId: "table-a",
            sourceRow: 2,
            actualFields: {
              factorName: "间隙",
              partName: "支架",
              drawingNumber: null,
              dimCharacteristicId: null,
              partCategory: "CNC",
              nominalValue: 0,
              upperTolerance: 0.05,
              lowerTolerance: -0.05,
              longTermSafetyFactor: 1,
              sigmaLevel: 3,
              distribution: "Normal",
              mean: 0,
              tolerance: 0.1,
              oneSigma: 0.02,
              percentContributionToSigma: 0.1,
              notes: null,
            },
            displayFields: {
              factorName: "Gap",
              partName: "Bracket",
              drawingNumber: null,
              dimCharacteristicId: null,
              partCategory: "CNC",
              nominalValue: "0",
              upperTolerance: "0.05",
              lowerTolerance: "-0.05",
              longTermSafetyFactor: "1",
              sigmaLevel: "3",
              distribution: "Normal",
              mean: "0",
              tolerance: "0.1",
              oneSigma: "0.02",
              percentContributionToSigma: "10.0%",
              notes: null,
            },
            sourceCells: {},
            missingRequiredFields: [],
            missingIdentifiers: [],
            capabilityStatus: "in_library_tolerance_and_distribution_differ",
            f0KnowledgeBaseVersion: "v1",
            recommendation: { kind: "public", toleranceMin: 0.1, toleranceMax: 0.3, unit: "mm", distribution: "normal", capabilityEntryId: "cap-demo" },
            adoReminderRequested: false,
          }],
          f4CalculabilityIssues: [],
        }],
        summary: {
          worksheetsChecked: 1,
          readyWorksheetCount: 1,
          blockedWorksheetCount: 0,
          requiredMissingFieldCount: 0,
          missingImageWorksheetCount: 0,
          missingDimIdCount: 0,
          missingPartNumberCount: 0,
          f0InformationInsufficientCount: 0,
          nonF0ProcessCategoryCount: 0,
        },
        f4Handoffs: [],
        adoEvents: [],
      } as never,
    }} />);

    const visibleText = collectVisibleText(container);
    expect(visibleText).toContain("Gap");
    expect(visibleText).toContain("Bracket");
    for (const label of FEATURE_LABELS) expect(visibleText).toContain(label);
    for (const blocked of KNOWN_CHINESE_UI_TEXT) expect(visibleText).not.toContain(blocked);
    expect(screen.getAllByText("Gap").find((element) => element.getAttribute("title") === "间隙")).toBeDefined();
    expect(screen.getAllByText("Bracket").find((element) => element.getAttribute("title") === "支架")).toBeDefined();
  }, 15_000);

  it("submits governed factor identity and only the current saved Scenario reference", async () => {
    const submitted: Array<{ message: string; selection: unknown }> = [];

    render(<App preloadedState={{
      snapshot: snapshot("review_required", {
        downstreamScopeSelection: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["AJ_GAP"], confirmed: true },
        scenarioDrafts: [{
          contractVersion: "f8-scenario-draft-v1",
          draftId: "draft-unsaved",
          sessionId: SESSION_ID,
          worksheetName: "AJ_GAP",
          inputRevision: 1,
          status: "calculated",
          mode: "WHAT_IF",
          baselineWorkbookHash: "a".repeat(64),
          baselineRunReference: "f4-run-a",
          calculationReference: "what-if:unsaved",
          calculationMetrics: { mean: 0.02, rssSigma: 0.045, cp: 1.48, cpkL: 1.25, cpkU: 1.71, cpk: 1.25, statisticalMargin: 0.12, worstCaseMargin: 0.08 },
          factorOverrides: [],
        }, {
          contractVersion: "f8-scenario-draft-v1",
          draftId: "draft-saved",
          sessionId: SESSION_ID,
          worksheetName: "AJ_GAP",
          inputRevision: 1,
          status: "saved",
          mode: "WHAT_IF",
          baselineWorkbookHash: "a".repeat(64),
          baselineRunReference: "f4-run-a",
          calculationReference: "what-if:saved",
          calculationMetrics: { mean: 0.01, rssSigma: 0.04, cp: 1.5, cpkL: 1.3, cpkU: 1.7, cpk: 1.3, statisticalMargin: 0.13, worstCaseMargin: 0.09 },
          factorOverrides: [],
        }, {
          contractVersion: "f8-scenario-draft-v1",
          draftId: "draft-stale-lineage",
          sessionId: SESSION_ID,
          worksheetName: "AJ_GAP",
          inputRevision: 1,
          status: "saved",
          mode: "WHAT_IF",
          baselineWorkbookHash: "b".repeat(64),
          baselineRunReference: "f4-run-stale",
          calculationReference: "what-if:stale",
          calculationMetrics: { mean: 0.03, rssSigma: 0.05, cp: 1.3, cpkL: 1.1, cpkU: 1.5, cpk: 1.1, statisticalMargin: 0.1, worstCaseMargin: 0.06 },
          factorOverrides: [],
        }],
      }),
      conversation: [],
      loading: false,
      connected: true,
      appendConversation: async (message, selection) => {
        submitted.push({ message, selection });
      },
      f4Report: {
        source: { workbookFileName: "anonymous.xlsx" },
        calculations: [{
          worksheetSelection: { worksheetName: "AJ_GAP", tableId: "table-a" },
          runReference: "f4-run-a",
          workbookContentHash: "a".repeat(64),
          factors: [{
            factorName: "Gap",
            unit: "mm",
            source: { worksheetName: "AJ_GAP", tableId: "table-a", sourceRow: 2 },
            input: { nominalValue: 0, upperTolerance: 0.05, lowerTolerance: -0.05 },
            mean: 0,
          }],
          system: { mean: 0, rssSigma: 0.05, additionalMeanShift: 0, worstCaseLower: -0.1, worstCaseUpper: 0.1 },
          capability: { lowerSpecLimit: -0.2, upperSpecLimit: 0.2, cp: 1.33, lowerCpk: 1.2, upperCpk: 1.3, cpk: 1.2, status: "PASS" },
        }],
      } as never,
      f2Report: {
        status: "completed",
        worksheets: [{
          worksheetName: "AJ_GAP",
          status: "ready",
          toleranceLoopDescription: "Gap",
          tolerancePathImageStatus: "available",
          systemSpecification: { status: "available" },
          systemSpecificationIssues: [],
          missingFieldSummary: [],
          rows: [{
            worksheetName: "AJ_GAP",
            tableId: "table-a",
            sourceRow: 2,
            actualFields: {
              factorName: "中心间隙",
              partName: "支架",
              drawingNumber: null,
              dimCharacteristicId: null,
              partCategory: "CNC",
              nominalValue: 0,
              upperTolerance: 0.05,
              lowerTolerance: -0.05,
              longTermSafetyFactor: 1,
              sigmaLevel: 3,
              distribution: "Normal",
              mean: 0,
              tolerance: 0.1,
              oneSigma: 0.02,
              percentContributionToSigma: 0.1,
              notes: null,
            },
            displayFields: {
              factorName: "Gap",
              partName: "Bracket",
              drawingNumber: null,
              dimCharacteristicId: null,
              partCategory: "CNC",
              nominalValue: "0",
              upperTolerance: "0.05",
              lowerTolerance: "-0.05",
              longTermSafetyFactor: "1",
              sigmaLevel: "3",
              distribution: "Normal",
              mean: "0",
              tolerance: "0.1",
              oneSigma: "0.02",
              percentContributionToSigma: "10.0%",
              notes: null,
            },
            sourceCells: {},
            imageReference: { artifact: "f1", relativePath: "images/AJ_GAP.png", contentHash: "b".repeat(64), worksheetName: "AJ_GAP" },
            missingRequiredFields: [],
            missingIdentifiers: [],
            capabilityStatus: "in_library_recommended",
            f0KnowledgeBaseVersion: "v1",
            recommendation: { kind: "public", toleranceMin: 0.1, toleranceMax: 0.3, unit: "mm", distribution: "normal", capabilityEntryId: "cap-demo" },
            adoReminderRequested: false,
          }],
          f4CalculabilityIssues: [],
        }],
        summary: {
          worksheetsChecked: 1,
          readyWorksheetCount: 1,
          blockedWorksheetCount: 0,
          requiredMissingFieldCount: 0,
          missingImageWorksheetCount: 0,
          missingDimIdCount: 0,
          missingPartNumberCount: 0,
          f0InformationInsufficientCount: 0,
          nonF0ProcessCategoryCount: 0,
        },
        f4Handoffs: [],
        adoEvents: [],
      } as never,
    }} />);

    fireEvent.click(screen.getByRole("button", { name: "Gap", description: "中心间隙" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Ask TA Assist from governed evidence" }), { target: { value: "Explain the current tolerance risk." } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(submitted).toHaveLength(1));
    expect(submitted[0]).toEqual({
      message: "Explain the current tolerance risk.",
      selection: {
        worksheetName: "AJ_GAP",
        tableId: "table-a",
        sourceRow: 2,
        factorName: "中心间隙",
        calculationReference: "what-if:saved",
      },
    });
  }, 15_000);

  it("renders the engineering workspace and assistant for a ready worksheet", () => {
    render(<App preloadedState={{
      snapshot: snapshot("review_required"),
      conversation: [],
      loading: false,
      connected: true,
      f4Report: {
        source: { workbookFileName: "anonymous.xlsx" },
        calculations: [{
          worksheetSelection: { worksheetName: "AJ_GAP" },
          factors: [],
          system: { mean: 0, rssSigma: 0.05, additionalMeanShift: 0, worstCaseLower: -0.1, worstCaseUpper: 0.1 },
          capability: { lowerSpecLimit: -0.2, upperSpecLimit: 0.2, cp: 1.33, lowerCpk: 1.2, upperCpk: 1.3, cpk: 1.2, status: "PASS" },
        }],
      } as never,
    }} />);

    expect(screen.getByRole("heading", { name: "AJ_GAP" })).toBeVisible();
    expect(screen.getByRole("region", { name: "TA Factor Table" })).toBeVisible();
    const assistant = screen.getByRole("complementary");
    expect(within(assistant).getByRole("region", { name: "TA Assistant" })).toBeVisible();
  }, 15_000);

  it("shows next-request context chips from current governed evidence instead of unsaved client scenario state", () => {
    const { rerender } = render(<App preloadedState={{
      snapshot: snapshot("review_required", {
        downstreamScopeSelection: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["AJ_GAP"], confirmed: true },
        artifactRefs: [{ artifactId: "f1-image-current", kind: "f1_image", revision: 1, validated: true, reviewContextId: "c".repeat(64) }],
        scenarioDrafts: [{
          contractVersion: "f8-scenario-draft-v1",
          draftId: "draft-unsaved",
          sessionId: SESSION_ID,
          worksheetName: "AJ_GAP",
          inputRevision: 1,
          status: "calculated",
          mode: "WHAT_IF",
          baselineWorkbookHash: "a".repeat(64),
          baselineRunReference: "f4-run-a",
          calculationReference: "what-if:unsaved",
          calculationMetrics: { mean: 0.02, rssSigma: 0.045, cp: 1.48, cpkL: 1.25, cpkU: 1.71, cpk: 1.25, statisticalMargin: 0.12, worstCaseMargin: 0.08 },
          factorOverrides: [],
        }],
      }),
      conversation: [{
        contractVersion: "ta-conversation-turn-v1",
        turnId: "turn-assistant-pending",
        sessionId: SESSION_ID,
        sequence: 0,
        source: "system",
        role: "assistant",
        content: [{ kind: "text", text: "等待 VS Code 模型回答…" }],
        createdAt: "2026-08-31T00:00:00.000Z",
        relatedArtifactIds: [],
      }],
      loading: false,
      connected: true,
      f4Report: {
        source: { workbookFileName: "anonymous.xlsx" },
        calculations: [{
          worksheetSelection: { worksheetName: "AJ_GAP", tableId: "table-a" },
          runReference: "f4-run-a",
          workbookContentHash: "a".repeat(64),
          factors: [{
            factorName: "Gap",
            unit: "mm",
            source: { worksheetName: "AJ_GAP", tableId: "table-a", sourceRow: 2 },
            input: { nominalValue: 0, upperTolerance: 0.05, lowerTolerance: -0.05 },
            mean: 0,
          }],
          system: { mean: 0, rssSigma: 0.05, additionalMeanShift: 0, worstCaseLower: -0.1, worstCaseUpper: 0.1 },
          capability: { lowerSpecLimit: -0.2, upperSpecLimit: 0.2, cp: 1.33, lowerCpk: 1.2, upperCpk: 1.3, cpk: 1.2, status: "PASS" },
        }],
      } as never,
      f2Report: {
        status: "completed",
        worksheets: [{
          worksheetName: "AJ_GAP",
          status: "ready",
          toleranceLoopDescription: "Gap",
          tolerancePathImageStatus: "available",
          systemSpecification: { status: "available" },
          systemSpecificationIssues: [],
          missingFieldSummary: [],
          rows: [{
            worksheetName: "AJ_GAP",
            tableId: "table-a",
            sourceRow: 2,
            actualFields: {
              factorName: "Gap",
              partName: "Bracket",
              drawingNumber: null,
              dimCharacteristicId: null,
              partCategory: "CNC",
              nominalValue: 0,
              upperTolerance: 0.05,
              lowerTolerance: -0.05,
              longTermSafetyFactor: 1,
              sigmaLevel: 3,
              distribution: "Normal",
              mean: 0,
              tolerance: 0.1,
              oneSigma: 0.02,
              percentContributionToSigma: 0.1,
              notes: null,
            },
            displayFields: {
              factorName: "Gap",
              partName: "Bracket",
              drawingNumber: null,
              dimCharacteristicId: null,
              partCategory: "CNC",
              nominalValue: "0",
              upperTolerance: "0.05",
              lowerTolerance: "-0.05",
              longTermSafetyFactor: "1",
              sigmaLevel: "3",
              distribution: "Normal",
              mean: "0",
              tolerance: "0.1",
              oneSigma: "0.02",
              percentContributionToSigma: "10.0%",
              notes: null,
            },
            sourceCells: {},
            imageReference: { artifact: "f1", relativePath: "images/AJ_GAP.png", contentHash: "b".repeat(64), worksheetName: "AJ_GAP" },
            missingRequiredFields: [],
            missingIdentifiers: [],
            capabilityStatus: "in_library_recommended",
            f0KnowledgeBaseVersion: "v1",
            recommendation: { kind: "public", toleranceMin: 0.1, toleranceMax: 0.3, unit: "mm", distribution: "normal", capabilityEntryId: "cap-demo" },
            adoReminderRequested: false,
          }],
          f4CalculabilityIssues: [],
        }],
        summary: {
          worksheetsChecked: 1,
          readyWorksheetCount: 1,
          blockedWorksheetCount: 0,
          requiredMissingFieldCount: 0,
          missingImageWorksheetCount: 0,
          missingDimIdCount: 0,
          missingPartNumberCount: 0,
          f0InformationInsufficientCount: 0,
          nonF0ProcessCategoryCount: 0,
        },
        f4Handoffs: [],
        adoEvents: [],
      } as never,
    }} />);

    const assistant = within(screen.getByRole("complementary")).getByRole("region", { name: "TA Assistant" });
    expect(within(assistant).getByText("Knowledge: 1 item")).toBeVisible();
    expect(within(assistant).getByText("Loop image: Requested")).toBeVisible();
    expect(within(assistant).getByText("Factor table: 1 row")).toBeVisible();
    expect(within(assistant).getByText("Baseline: Available for validation")).toBeVisible();
    expect(within(assistant).getByText("Scenario: Not requested")).toBeVisible();
    expect(within(assistant).queryByText("Loop image: included")).toBeNull();
    expect(within(assistant).getByText("Waiting for VS Code model response...")).toBeVisible();

    rerender(<App preloadedState={{
      snapshot: snapshot("review_required", {
        downstreamScopeSelection: { workbookContentHash: "a".repeat(64), selectedWorksheetNames: ["AJ_GAP"], confirmed: true },
        artifactRefs: [{ artifactId: "f1-image-current", kind: "f1_image", revision: 1, validated: true, reviewContextId: "c".repeat(64) }],
        scenarioDrafts: [{
          contractVersion: "f8-scenario-draft-v1",
          draftId: "draft-saved",
          sessionId: SESSION_ID,
          worksheetName: "AJ_GAP",
          inputRevision: 1,
          status: "saved",
          mode: "WHAT_IF",
          baselineWorkbookHash: "a".repeat(64),
          baselineRunReference: "f4-run-a",
          calculationReference: "what-if:saved",
          calculationMetrics: { mean: 0.02, rssSigma: 0.045, cp: 1.48, cpkL: 1.25, cpkU: 1.71, cpk: 1.25, statisticalMargin: 0.12, worstCaseMargin: 0.08 },
          factorOverrides: [],
        }],
      }),
      conversation: [],
      loading: false,
      connected: true,
      f4Report: {
        source: { workbookFileName: "anonymous.xlsx" },
        calculations: [{
          worksheetSelection: { worksheetName: "AJ_GAP", tableId: "table-a" },
          runReference: "f4-run-a",
          workbookContentHash: "a".repeat(64),
          factors: [{
            factorName: "Gap",
            unit: "mm",
            source: { worksheetName: "AJ_GAP", tableId: "table-a", sourceRow: 2 },
            input: { nominalValue: 0, upperTolerance: 0.05, lowerTolerance: -0.05 },
            mean: 0,
          }],
          system: { mean: 0, rssSigma: 0.05, additionalMeanShift: 0, worstCaseLower: -0.1, worstCaseUpper: 0.1 },
          capability: { lowerSpecLimit: -0.2, upperSpecLimit: 0.2, cp: 1.33, lowerCpk: 1.2, upperCpk: 1.3, cpk: 1.2, status: "PASS" },
        }],
      } as never,
      f2Report: {
        status: "completed",
        worksheets: [{
          worksheetName: "AJ_GAP",
          status: "ready",
          toleranceLoopDescription: "Gap",
          tolerancePathImageStatus: "available",
          systemSpecification: { status: "available" },
          systemSpecificationIssues: [],
          missingFieldSummary: [],
          rows: [{
            worksheetName: "AJ_GAP",
            tableId: "table-a",
            sourceRow: 2,
            actualFields: {
              factorName: "Gap",
              partName: "Bracket",
              drawingNumber: null,
              dimCharacteristicId: null,
              partCategory: "CNC",
              nominalValue: 0,
              upperTolerance: 0.05,
              lowerTolerance: -0.05,
              longTermSafetyFactor: 1,
              sigmaLevel: 3,
              distribution: "Normal",
              mean: 0,
              tolerance: 0.1,
              oneSigma: 0.02,
              percentContributionToSigma: 0.1,
              notes: null,
            },
            displayFields: {
              factorName: "Gap",
              partName: "Bracket",
              drawingNumber: null,
              dimCharacteristicId: null,
              partCategory: "CNC",
              nominalValue: "0",
              upperTolerance: "0.05",
              lowerTolerance: "-0.05",
              longTermSafetyFactor: "1",
              sigmaLevel: "3",
              distribution: "Normal",
              mean: "0",
              tolerance: "0.1",
              oneSigma: "0.02",
              percentContributionToSigma: "10.0%",
              notes: null,
            },
            sourceCells: {},
            imageReference: { artifact: "f1", relativePath: "images/AJ_GAP.png", contentHash: "b".repeat(64), worksheetName: "AJ_GAP" },
            missingRequiredFields: [],
            missingIdentifiers: [],
            capabilityStatus: "in_library_recommended",
            f0KnowledgeBaseVersion: "v1",
            recommendation: { kind: "public", toleranceMin: 0.1, toleranceMax: 0.3, unit: "mm", distribution: "normal", capabilityEntryId: "cap-demo" },
            adoReminderRequested: false,
          }],
          f4CalculabilityIssues: [],
        }],
        summary: {
          worksheetsChecked: 1,
          readyWorksheetCount: 1,
          blockedWorksheetCount: 0,
          requiredMissingFieldCount: 0,
          missingImageWorksheetCount: 0,
          missingDimIdCount: 0,
          missingPartNumberCount: 0,
          f0InformationInsufficientCount: 0,
          nonF0ProcessCategoryCount: 0,
        },
        f4Handoffs: [],
        adoEvents: [],
      } as never,
    }} />);

    expect(within(assistant).getByText("Scenario: Requested")).toBeVisible();
  }, 15_000);

  it("projects ADO decisions only inside the F3 workspace during ADO review", () => {
    const commands: Array<{ command: string; payload: Record<string, unknown> }> = [];
    render(<App preloadedState={{
      snapshot: snapshot("ado_decision_required"),
      submitCommand: async (command, payload) => {
        commands.push({ command, payload });
      },
      conversation: [],
      loading: false,
      connected: true,
      f3Report: appGovernanceReport(),
      f4Report: {
        source: { workbookFileName: "anonymous.xlsx" },
        calculations: [{
          worksheetSelection: { worksheetName: "AJ_GAP" },
          factors: [],
          system: { mean: 0, rssSigma: 0.05, additionalMeanShift: 0, worstCaseLower: -0.1, worstCaseUpper: 0.1 },
          capability: { lowerSpecLimit: -0.2, upperSpecLimit: 0.2, cp: 1.33, lowerCpk: 1.2, upperCpk: 1.3, cpk: 1.2, status: "PASS" },
        }],
      } as never,
    }} />);

    expect(screen.getByRole("heading", { name: "AJ_GAP" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: /ADO/i })).not.toBeInTheDocument();
    const adoWorkspace = screen.getByRole("region", { name: "ADO workspace" });
    expect(within(adoWorkspace).getAllByText("Bracket").length).toBeGreaterThan(0);
    fireEvent.click(within(adoWorkspace).getByRole("button", { name: "Create work item" }));

    expect(commands).toEqual([{ command: "confirm_ado_decision", payload: { decision: "create_new" } }]);
    expect(screen.getAllByRole("button", { name: "Create work item" })).toHaveLength(1);
  }, 15_000);

  it("rehydrates a saved current-revision system specification Scenario into visible values after reload", () => {
    render(<App preloadedState={{
      snapshot: snapshot("review_required", {
        scenarioDrafts: [{
          contractVersion: "f8-scenario-draft-v1",
          draftId: "draft-system-spec",
          sessionId: SESSION_ID,
          worksheetName: "AJ_GAP",
          inputRevision: 1,
          status: "saved",
          mode: "WHAT_IF",
          baselineWorkbookHash: "a".repeat(64),
          baselineRunReference: "f4-run-a",
          calculationReference: "what-if:system-spec",
          calculationMetrics: { mean: 0.02, rssSigma: 0.045, cp: 1.48, cpkL: 1.25, cpkU: 1.71, cpk: 1.25, statisticalMargin: 0.12, worstCaseMargin: 0.08, lowerSpecLimit: -0.18, upperSpecLimit: 0.24, statisticalLower: -0.115, statisticalUpper: 0.155, worstCaseLower: -0.12, worstCaseUpper: 0.16 },
          factorOverrides: [],
          systemSpecification: { lowerSpecLimit: -0.18, upperSpecLimit: 0.24 },
          factorResults: [],
        }],
      }),
      conversation: [],
      loading: false,
      connected: true,
      f4Report: {
        source: { workbookFileName: "anonymous.xlsx" },
        calculations: [{
          worksheetSelection: { worksheetName: "AJ_GAP" },
          factors: [],
          system: { mean: 0, rssSigma: 0.05, additionalMeanShift: 0, worstCaseLower: -0.1, worstCaseUpper: 0.1 },
          capability: { lowerSpecLimit: -0.2, upperSpecLimit: 0.2, cp: 1.33, lowerCpk: 1.2, upperCpk: 1.3, cpk: 1.2, status: "PASS" },
        }],
      } as never,
      f2Report: readyF2Report(),
    }} />);

    expect(screen.getByRole("spinbutton", { name: "Lower Spec Limit" })).toHaveValue(-0.18);
    expect(screen.getByRole("spinbutton", { name: "Upper Spec Limit" })).toHaveValue(0.24);
    expect(screen.getByText(/Scenario mean 0\.020/)).toBeVisible();
    expect(screen.getByText(/statistical range -0\.115 to 0\.155/)).toBeVisible();
  }, 15_000);
});

function snapshot(state: F8SessionSnapshot["state"], overrides: Partial<F8SessionSnapshot> = {}): F8SessionSnapshot {
  return {
    contractVersion: "f8-session-snapshot-v1",
    sessionId: SESSION_ID,
    revision: 1,
    inputRevision: 1,
    state,
    activeAttempt: state === "f1_f2_running" ? { attemptId: "attempt-1", stage: "f1_f2_running", status: "running", startedAt: "2026-08-26T00:00:00.000Z" } : null,
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
    artifactUrl(sessionId, artifactId, disposition = "attachment") {
      return `/api/sessions/${sessionId}/artifacts/${encodeURIComponent(artifactId)}?disposition=${disposition}`;
    },
    async uploadWorkbook() {
      throw new Error("not implemented in test");
    },
    async submitCommand(_sessionId, _expectedRevision, command, payload) {
      if ((command === "confirm_initial_scope" || command === "confirm_downstream_scope") && "worksheetNames" in payload) {
        const worksheetNames = payload.worksheetNames;
        commands.push({ command, worksheetNames: Array.isArray(worksheetNames) ? [...worksheetNames] : [] });
      }

      return currentSnapshot;
    },
    async calculateWhatIf() {
      throw new Error("not implemented in test");
    },
    async calculateWorksheetWhatIf() {
      throw new Error("not implemented in test");
    },
    async appendConversationTurn() {
      throw new Error("not implemented in test");
    },
    async readConversation(): Promise<readonly ConversationTurn[]> {
      return [];
    },
    async readAdoProjection(): Promise<F8AdoProjection> {
      throw new Error("not implemented in test");
    },
    async confirmAdoWrite(_sessionId: string, _confirmation: F8AdoWriteConfirmation): Promise<void> {
      return undefined;
    },
    async loadArtifactJson() {
      return undefined;
    },
  };
}

function readyF2Report() {
  return {
    status: "completed",
    worksheets: [{
      worksheetName: "AJ_GAP",
      status: "ready",
      toleranceLoopDescription: "Gap",
      tolerancePathImageStatus: "available",
      systemSpecification: { status: "available", lowerSpecLimit: { status: "available", actualValue: -0.2 }, upperSpecLimit: { status: "available", actualValue: 0.2 } },
      systemSpecificationIssues: [],
      missingFieldSummary: [],
      rows: [],
      f4CalculabilityIssues: [],
    }],
    summary: {
      worksheetsChecked: 1,
      readyWorksheetCount: 1,
      blockedWorksheetCount: 0,
      requiredMissingFieldCount: 0,
      missingImageWorksheetCount: 0,
      missingDimIdCount: 0,
      missingPartNumberCount: 0,
      f0InformationInsufficientCount: 0,
      nonF0ProcessCategoryCount: 0,
    },
    f4Handoffs: [],
    adoEvents: [],
  } as never;
}

function appGovernanceReport(): DrawingGovernanceResultV2 {
  return {
    contractVersion: "v1",
    modelVersion: "drawing-governance-v2",
    outputClassification: "confidential",
    featureId: "F3",
    status: "governance_required",
    artifactRoot: "runtime/session/f3",
    workbook: { fileName: "anonymous.xlsx", contentHash: "a".repeat(64) },
    worksheets: [{ worksheetName: "AJ_GAP", toleranceLoopDescription: "Gap", rows: [{
      factorInstanceId: "5".repeat(64),
      deviceLevelDim: "Gap",
      dimensionDescription: "Gap factor dimension",
      partCategory: "CNC",
      partSubsystem: "Bracket",
      drawingNumber: null,
      dimId: null,
      factorDescription: "Gap factor",
      nominal: 0,
      upperTolerance: 0.05,
      lowerTolerance: -0.05,
      sigmaLevel: 3,
      dimIdStatus: "missing",
      qualitySignals: ["drawing_number_missing", "dim_id_missing"],
      governanceStatus: "needs_governance",
      imageReference: { artifact: "f1", worksheetName: "AJ_GAP", relativePath: "images/AJ_GAP.png", contentHash: "b".repeat(64) },
      source: { worksheetName: "AJ_GAP", tableId: "table-a", sourceRow: 2, sourceCells: {} },
    }] }],
    ado: { status: "draft_ready" },
    summary: { worksheetCount: 1, factorCount: 1, completeCount: 0, governanceRequiredCount: 1, duplicateConflictCount: 0 },
  };
}

function collectVisibleText(container: HTMLElement): string {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (parent === null) return NodeFilter.FILTER_REJECT;
      if (parent.closest("script, style, [aria-hidden='true'], .sr-only, .visually-hidden") !== null) return NodeFilter.FILTER_REJECT;
      const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
      return text.length === 0 ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });

  const parts: string[] = [];
  while (walker.nextNode()) {
    parts.push(walker.currentNode.textContent!.replace(/\s+/g, " ").trim());
  }
  return parts.join(" ");
}
