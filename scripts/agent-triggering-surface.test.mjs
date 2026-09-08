import { describe, expect, it } from "vitest";

import { classifyTopLevelWorkflowIntent } from "../packages/product-language/src/index.ts";

describe("agent triggering surface", () => {
  it.each([
    ["Analyze actual measurements for these factors", "measured_analysis"],
    ["请分析这些真实量测数据", "measured_analysis"],
    ["Analyze TA.xlsx", "workbook_analysis"],
    ["Run the complete TA analysis for C:\\TA\\assembly.xlsx", "workbook_analysis"],
    ["请完整分析这个 TA 工作簿", "workbook_analysis"],
    ["Explain what Cpk means", "knowledge_question"],
    ["Write a Monte Carlo simulator in Python", "clarification_required"],
    ["Format this spreadsheet", "unsupported"],
    ["Import reviewed feedback into the prior report", "unsupported"],
    ["Describe this unrelated product image", "unsupported"],
  ])("routes %s to %s", (text, kind) => {
    expect(classifyTopLevelWorkflowIntent(text).kind).toBe(kind);
  });
});