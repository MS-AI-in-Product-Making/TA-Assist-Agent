import { describe, expect, it } from "vitest";
import {
  detectUserLanguage,
  productCapabilityLabel,
  projectProductCapabilityReferences,
  resolveProductCapabilityReference,
  TA_PRODUCT_CAPABILITIES,
  projectTaWorkbookStage,
  TA_WORKBOOK_STAGES,
  TA_WORKBOOK_WORKFLOW,
} from "./ta-workbook-language.js";

describe("TA workbook language", () => {
  it("provides stable workflow stages for product surfaces", () => {
    expect(TA_WORKBOOK_WORKFLOW).toBe("TA Workbook Analysis");
    expect(TA_WORKBOOK_STAGES).toEqual([
      "prepare_workbook",
      "validate_analysis_inputs",
      "review_dimension_traceability",
      "calculate_and_interpret",
      "evaluate_and_publish",
    ]);
    expect(projectTaWorkbookStage("f3_running")).toBe("review_dimension_traceability");
    expect(projectTaWorkbookStage("completed")).toBe("evaluate_and_publish");
  });
});

describe("TA product capabilities", () => {
  it("projects every internal feature identifier to stable bilingual product language", () => {
    expect(TA_PRODUCT_CAPABILITIES).toEqual([
      { internalId: "F0", skillName: "knowledge-library", englishLabel: "Knowledge Library", chineseLabel: "知识库" },
      { internalId: "F1", skillName: "data-parsing", englishLabel: "Data Parsing", chineseLabel: "数据解析" },
      { internalId: "F2", skillName: "data-cleaning", englishLabel: "Data Cleaning", chineseLabel: "数据清洗" },
      { internalId: "F3", skillName: "drawing-governance", englishLabel: "Drawing Governance", chineseLabel: "图纸治理" },
      { internalId: "F4", skillName: "ta-calculation", englishLabel: "TA Calculation", chineseLabel: "TA 计算" },
      { internalId: "F5", skillName: "result-interpretation", englishLabel: "Result Interpretation", chineseLabel: "结果解读" },
      { internalId: "F6", skillName: "design-optimization", englishLabel: "Design Optimization", chineseLabel: "设计优化" },
      { internalId: "F7", skillName: "feedback-application", englishLabel: "Feedback Application", chineseLabel: "反馈应用" },
    ]);

    expect(productCapabilityLabel("F3", "en")).toBe("Drawing Governance");
    expect(productCapabilityLabel("F3", "zh")).toBe("图纸治理");
  });

  it("uses Chinese for messages containing Han characters and English otherwise", () => {
    expect(detectUserLanguage("请分析 this workbook")).toBe("zh");
    expect(detectUserLanguage("Analyze this workbook")).toBe("en");
    expect(detectUserLanguage("123 Cpk 1.33")).toBe("en");
  });

  it("resolves legacy stage references without exposing them as product labels", () => {
    expect(resolveProductCapabilityReference("请使用 F5 分析报告")).toBe("F5");
    expect(resolveProductCapabilityReference("Open the Feature 6 report")).toBe("F6");
    expect(resolveProductCapabilityReference("Explain Cpk risk")).toBeUndefined();

    expect(projectProductCapabilityReferences("请使用 F5 分析报告", "zh")).toBe("请使用 结果解读 分析报告");
    expect(projectProductCapabilityReferences("Open the Feature 6 report", "en")).toBe("Open the Design Optimization report");
  });
});
