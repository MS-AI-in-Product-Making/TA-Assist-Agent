import { describe, expect, it } from "vitest";

import { actionDisplay, featureDisplay, projectProductText, projectSourceText, reasonDisplay } from "./web-projection.js";

describe("web-projection", () => {
  it("projects all internal capability identifiers into stable product names", () => {
    const labels = {
      F0: "Knowledge Library",
      F1: "Data Parsing",
      F2: "Data Cleaning",
      F3: "Drawing Governance",
      F4: "TA Calculation",
      F5: "Result Interpretation",
      F6: "Design Optimization",
      F7: "Feedback Application",
    } as const;

    for (const [featureId, expected] of Object.entries(labels)) {
      const displayText = featureDisplay(featureId as keyof typeof labels);
      expect(displayText).toBe(expected);
      expect(displayText.split(/\s+/).length).toBeLessThanOrEqual(2);
      expect(displayText).not.toMatch(/\p{Script=Han}/u);
    }
  });

  it("replaces internal capability identifiers in user-visible system text", () => {
    expect(projectProductText("F2 factor table and Feature6-Report.md")).toBe("Data Cleaning factor table and Design Optimization-Report.md");
    expect(projectProductText("F2 factor table and Feature6-Report.md", "zh")).toBe("数据清洗 factor table and 设计优化-Report.md");
    expect(projectProductText("Ordinary engineering text")).toBe("Ordinary engineering text");
  });

  it("uses the locked Chinese catalog for capability labels", () => {
    expect(featureDisplay("F6", "zh")).toBe("设计优化");
  });

  it("projects internal action values into human-readable labels", () => {
    expect(actionDisplay("confirm_analysis_context")).toBe("Add or confirm analysis context");
    expect(actionDisplay("confirm_optimization_targets")).toBe("Add or confirm optimization targets");
    expect(actionDisplay("complete_review")).toBe("Complete review");
    expect(actionDisplay("cancel")).toBe("Cancel analysis");
  });

  it("projects all fixed reason and state codes into English copy", () => {
    const cases = [
      ["completed", "Completed"],
      ["running", "Running"],
      ["action_required", "Action required"],
      ["failed", "Failed"],
      ["cancelled", "Cancelled"],
      ["pending", "Pending"],
      ["feature_not_available", "In development"],
      ["in_development", "In development"],
      ["transient_error", "Reconnecting"],
      ["evidence_mismatch", "Analysis data updated"],
      ["calculation_not_possible", "Calculation unavailable"],
      ["validation_error", "Workbook needs attention"],
      ["prerequisite_not_ready", "Not ready"],
      ["initial_scope_required", "Action required"],
      ["downstream_scope_required", "Action required"],
      ["ado_decision_required", "Action required"],
      ["image_decision_required", "Action required"],
      ["analysis_context_decision_required", "Action required"],
      ["optimization_targets_decision_required", "Action required"],
      ["review_required", "Action required"],
      ["f7_import_required", "Pending"],
      ["f7_preview_required", "Pending"],
      ["feedback_review_required", "Pending"],
      ["workbook_validating", "Running"],
      ["f0_validating", "Running"],
      ["f1_f2_running", "Running"],
      ["f3_running", "Running"],
      ["ado_action_pending", "Running"],
      ["f4_running", "Running"],
      ["f5_running", "Running"],
      ["f6_running", "Running"],
      ["f7_running", "Running"],
      ["created", "Pending"],
      ["workbook_required", "Pending"],
      ["f0_validated", "Completed"],
    ] as const;

    for (const [reasonCode, expected] of cases) {
      expect(reasonDisplay(reasonCode)).toBe(expected);
      expect(reasonDisplay(reasonCode)).not.toMatch(/\p{Script=Han}/u);
    }
  });

  it("keeps source text available when no trusted translation is provided", () => {
    expect(projectSourceText("原始文本")).toEqual({ displayText: "原始文本", sourceText: "原始文本", translated: false });
    expect(projectSourceText("原始文本", "Translated text")).toEqual({ displayText: "Translated text", sourceText: "原始文本", translated: true });
    expect(projectSourceText("原始文本", "   ")).toEqual({ displayText: "原始文本", sourceText: "原始文本", translated: false });
  });
});