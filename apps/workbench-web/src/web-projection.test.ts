import { describe, expect, it } from "vitest";

import { featureDisplay, projectSourceText, reasonDisplay } from "./web-projection.js";

describe("web-projection", () => {
  it("projects all F0-F7 labels into short English copy", () => {
    const labels = {
      F0: "Load Library",
      F1: "Extract Data",
      F2: "Check Inputs",
      F3: "Drawing Governance",
      F4: "Calculate TA",
      F5: "Interpret Results",
      F6: "Optimize Design",
      F7: "Apply Feedback",
    } as const;

    for (const [featureId, expected] of Object.entries(labels)) {
      const displayText = featureDisplay(featureId as keyof typeof labels);
      expect(displayText).toBe(expected);
      expect(displayText.split(/\s+/).length).toBeLessThanOrEqual(2);
      expect(displayText).not.toMatch(/\p{Script=Han}/u);
    }
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