import { describe, expect, it } from "vitest";

import { classifyTopLevelWorkflowIntent } from "./workflow-intent.js";

describe("classifyTopLevelWorkflowIntent", () => {
  it.each([
    ["Analyze actual measurements for these factors", { kind: "measured_analysis" }],
    ["请分析这些真实量测数据", { kind: "measured_analysis" }],
    ["Analyze TA.xlsx", { kind: "workbook_analysis" }],
    ["Explain what Cpk means", { kind: "knowledge_question" }],
    ["请解释一下 Cpk 是什么意思", { kind: "knowledge_question" }],
    ["What is tolerance analysis?", { kind: "knowledge_question" }],
    ["请解释公差堆叠", { kind: "knowledge_question" }],
    ["Analyze the measured dimensions", { kind: "measured_analysis" }],
    ["分析这些实测尺寸", { kind: "measured_analysis" }],
    ["Analyze measurement results from inspection", { kind: "measured_analysis" }],
    ["Resume the current session", { kind: "session_operation", operation: "resume" }],
    ["Open the current report", { kind: "session_operation", operation: "status" }],
    ["Explain the governed evidence", { kind: "session_operation", operation: "status" }],
    ["切换到中文", { kind: "session_operation", operation: "change_language" }],
    ["Help me with this", {
      kind: "clarification_required",
      candidates: ["knowledge-library", "data-parsing", "ta-real-measurement-analysis", "feedback-application"],
    }],
  ])("classifies %s", (text, expected) => {
    expect(classifyTopLevelWorkflowIntent(text)).toEqual(expected);
  });

  it.each([
    "Write a Monte Carlo simulator in Python",
    "How do I calculate Cpk in Excel?",
    "Analyze these temperature measurements from the lab",
  ])("does not route broad requests into measured analysis: %s", (text) => {
    expect(classifyTopLevelWorkflowIntent(text)).not.toEqual(expect.objectContaining({ kind: "measured_analysis" }));
  });

  it("does not default unknown input to workbook analysis", () => {
    expect(classifyTopLevelWorkflowIntent("Hello there")).toEqual({ kind: "unsupported" });
  });

  it("does not treat a generic TA report reference as workbook evidence", () => {
    expect(classifyTopLevelWorkflowIntent("Analyze this TA report")).not.toEqual({ kind: "workbook_analysis" });
  });
});