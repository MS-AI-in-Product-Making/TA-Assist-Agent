import { describe, expect, it } from "vitest";
import { inputMetadata } from "./input-metadata.js";

describe("input metadata", () => {
  it("exposes the governed registry entries in a stable order", () => {
    expect(Object.keys(inputMetadata("en"))).toEqual([
      "ado_task_title",
      "existing_work_item",
      "analysis_context",
      "optimization_target",
      "workbook_file",
      "worksheet_scope",
      "missing_item_decision",
      "session_recovery",
      "conversation_input",
    ]);
  });

  it("localizes the registry while keeping selection guidance explicit", () => {
    expect(inputMetadata("zh").workbook_file).toEqual({
      kind: "file",
      title: "工作簿文件",
      whatToEnter: "选择要分析的 Excel 工作簿文件。",
      purpose: "提供当前会话的分析源文件。",
      example: "选择 TA.xlsx 或对应该工作流的 .xlsx 文件。",
      validationHint: "请提供可读取的本地文件或工作区中可访问的文件。",
      consequence: "分析将基于此工作簿建立后续输入和输出。",
      nextStep: "上传后继续选择要分析的工作表范围。",
      recovery: "如果选错文件，请重新选择正确的工作簿。",
    });
  });
});