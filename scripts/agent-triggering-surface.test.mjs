import { describe, expect, it } from "vitest";

import { classifyTopLevelWorkflowIntent } from "../packages/product-language/src/index.ts";

describe("agent triggering surface", () => {
  it.each([
    ["Analyze actual measurements for these factors", "measured_analysis"],
    ["请分析这些真实量测数据", "measured_analysis"],
    ["Analyze TA.xlsx", "workbook_analysis"],
    ["Explain what Cpk means", "knowledge_question"],
    ["Write a Monte Carlo simulator in Python", "clarification_required"],
  ])("routes %s to %s", (text, kind) => {
    expect(classifyTopLevelWorkflowIntent(text).kind).toBe(kind);
  });
});