import type { UiCatalogLanguage } from "./interaction-language.js";

export type UserInputKind = "text" | "number" | "file" | "radio" | "checkbox" | "combobox";

export interface LocalizedInputMetadata {
  readonly kind: UserInputKind;
  readonly title: string;
  readonly whatToEnter: string;
  readonly purpose: string;
  readonly example: string;
  readonly validationHint: string;
  readonly consequence?: string;
  readonly nextStep?: string;
  readonly recovery?: string;
}

export type UserInputId =
  | "ado_task_title"
  | "existing_work_item"
  | "analysis_context"
  | "optimization_target"
  | "workbook_file"
  | "worksheet_scope"
  | "missing_item_decision"
  | "session_recovery"
  | "conversation_input";

const INPUT_METADATA_BY_LANGUAGE = {
  en: {
    ado_task_title: {
      kind: "text",
      title: "ADO task title",
      whatToEnter: "Enter the work item title that should be created or updated.",
      purpose: "Gives the workflow a concise human-readable task label.",
      example: "Issue #106 language triggering inputs",
      validationHint: "Use a short title that matches the work item being changed.",
      consequence: "This becomes the visible title for the linked ADO task.",
      nextStep: "Continue with the work item link or workbook selection.",
      recovery: "If the title is wrong, edit it before continuing.",
    },
    existing_work_item: {
      kind: "combobox",
      title: "Existing work item",
      whatToEnter: "Choose the existing item that should receive updates.",
      purpose: "Targets an already-tracked work item instead of creating a new one.",
      example: "Work item 12345",
      validationHint: "Select one existing item before submitting updates.",
      consequence: "The workflow will attach changes to the selected item.",
      nextStep: "After selection, confirm the workbook or analysis scope.",
      recovery: "If you picked the wrong item, clear the selection and choose again.",
    },
    analysis_context: {
      kind: "text",
      title: "Analysis context",
      whatToEnter: "Describe the analysis goal, assumptions, or problem statement.",
      purpose: "Gives the agent the background needed to interpret the workbook.",
      example: "Analyze the bracket gap stack-up for the 2026 prototype build.",
      validationHint: "State the product, scenario, or decision question in one or two sentences.",
      consequence: "This context shapes the prompts, calculations, and report framing.",
      nextStep: "Then provide the workbook file and worksheet scope.",
      recovery: "If the context is off, replace it before running the workflow.",
    },
    optimization_target: {
      kind: "text",
      title: "Optimization target",
      whatToEnter: "State the metric, limit, or outcome you want to improve.",
      purpose: "Defines what success looks like for the optimization phase.",
      example: "Reduce stack-up variation while keeping the nominal fit unchanged.",
      validationHint: "Use a measurable target or a clearly bounded design objective.",
      consequence: "The recommendation set will be judged against this target.",
      nextStep: "Proceed to workbook validation or later optimization inputs.",
      recovery: "If the target changes, update it before publishing the report.",
    },
    workbook_file: {
      kind: "file",
      title: "Workbook file",
      whatToEnter: "Select the Excel workbook to analyze.",
      purpose: "Provides the source file for the current workflow session.",
      example: "TA.xlsx",
      validationHint: "Choose a readable local file or workspace-accessible workbook.",
      consequence: "The analysis will be anchored to this workbook and its sheets.",
      nextStep: "After upload, choose the worksheet scope.",
      recovery: "If the wrong file is chosen, replace it before continuing.",
    },
    worksheet_scope: {
      kind: "combobox",
      title: "Worksheet scope",
      whatToEnter: "Choose the worksheet or worksheet set to include in the analysis.",
      purpose: "Limits the workflow to the relevant workbook surface.",
      example: "gap wo rubber_static",
      validationHint: "Pick one worksheet scope that exists in the workbook.",
      consequence: "Only the selected worksheets will be parsed and validated.",
      nextStep: "Continue with missing-item decisions or actual calculations.",
      recovery: "If the scope is wrong, select the correct worksheet group.",
    },
    missing_item_decision: {
      kind: "radio",
      title: "Missing item decision",
      whatToEnter: "Choose how to handle a missing worksheet field or required value.",
      purpose: "Controls whether the workflow pauses, continues, or requests more data.",
      example: "Pause and request the missing source row.",
      validationHint: "Pick exactly one decision for each missing requirement.",
      consequence: "This determines the next workflow branch.",
      nextStep: "Follow the prompt that matches the selected decision.",
      recovery: "If the decision was premature, reopen the worksheet check.",
    },
    session_recovery: {
      kind: "radio",
      title: "Session recovery",
      whatToEnter: "Choose whether to resume the existing session or start fresh.",
      purpose: "Preserves the authoritative language lock and analysis state.",
      example: "Resume the saved session.",
      validationHint: "Select the option that matches the current session state.",
      consequence: "The chosen path determines whether the workflow reuses prior context.",
      nextStep: "Continue with the recovered language lock or a new workflow.",
      recovery: "If you need a different run, start a new session instead.",
    },
    conversation_input: {
      kind: "text",
      title: "Conversation input",
      whatToEnter: "Type the user request or follow-up question in plain language.",
      purpose: "Captures the instruction that drives the workflow router.",
      example: "Analyze this workbook in Chinese.",
      validationHint: "Enter the request as a complete sentence when possible.",
      consequence: "The agent will classify the request and lock the workflow language.",
      nextStep: "Send the message to start or continue the conversation.",
      recovery: "If the message was unclear, rewrite it before sending.",
    },
  },
  zh: {
    ado_task_title: {
      kind: "text",
      title: "ADO 任务标题",
      whatToEnter: "输入要创建或更新的工作项标题。",
      purpose: "为流程提供一个简洁的人类可读任务名称。",
      example: "Issue #106 语言触发输入",
      validationHint: "请使用与目标工作项一致的简短标题。",
      consequence: "该标题会成为关联 ADO 任务的可见名称。",
      nextStep: "继续关联工作项或选择工作簿。",
      recovery: "如果标题不对，请先修改后再继续。",
    },
    existing_work_item: {
      kind: "combobox",
      title: "已有工作项",
      whatToEnter: "选择需要接收更新的现有工作项。",
      purpose: "让流程更新已跟踪的工作项，而不是新建。",
      example: "工作项 12345",
      validationHint: "提交更新前必须选择一个现有工作项。",
      consequence: "流程会把变更附加到所选工作项。",
      nextStep: "选择后继续确认工作簿或分析范围。",
      recovery: "如果选错了，请清空后重新选择。",
    },
    analysis_context: {
      kind: "text",
      title: "分析上下文",
      whatToEnter: "描述分析目标、假设或问题陈述。",
      purpose: "为模型解释工作簿提供必要背景。",
      example: "分析 2026 样机装配中的支架间隙堆栈。",
      validationHint: "请用一两句话说明产品、场景或决策问题。",
      consequence: "这些上下文会影响提示、计算和报告结构。",
      nextStep: "随后提供工作簿文件和工作表范围。",
      recovery: "如果上下文错误，请在运行前替换。",
    },
    optimization_target: {
      kind: "text",
      title: "优化目标",
      whatToEnter: "说明你希望改善的指标、限制或结果。",
      purpose: "定义优化阶段的成功标准。",
      example: "在保持名义配合不变的情况下减少堆栈波动。",
      validationHint: "请使用可度量目标或明确受限的设计目标。",
      consequence: "建议结果会以该目标为准进行判断。",
      nextStep: "继续进行工作簿验证或后续优化输入。",
      recovery: "如果目标变化，请在发布报告前更新。",
    },
    workbook_file: {
      kind: "file",
      title: "工作簿文件",
      whatToEnter: "选择要分析的 Excel 工作簿文件。",
      purpose: "提供当前会话的分析源文件。",
      example: "选择 TA.xlsx 或对应该工作流的 .xlsx 文件。",
      validationHint: "请提供可读取的本地文件或工作区中可访问的文件。",
      consequence: "分析将基于此工作簿建立后续输入和输出。",
      nextStep: "上传后继续选择要分析的工作表范围。",
      recovery: "如果选错文件，请重新选择正确的工作簿。",
    },
    worksheet_scope: {
      kind: "combobox",
      title: "工作表范围",
      whatToEnter: "选择要纳入分析的工作表或工作表集合。",
      purpose: "将流程限制在相关的工作簿内容上。",
      example: "gap wo rubber_static",
      validationHint: "请选择工作簿中实际存在的一个工作表范围。",
      consequence: "只有所选工作表会被解析和校验。",
      nextStep: "继续处理缺失项决策或后续计算。",
      recovery: "如果范围不对，请改选正确的工作表组。",
    },
    missing_item_decision: {
      kind: "radio",
      title: "缺失项决策",
      whatToEnter: "选择如何处理缺失的工作表字段或必填值。",
      purpose: "控制流程暂停、继续还是请求更多数据。",
      example: "暂停并请求缺失的源行。",
      validationHint: "每个缺失要求只能选择一个决策。",
      consequence: "这会决定下一步流程分支。",
      nextStep: "按照所选决策继续操作。",
      recovery: "如果决策过早，请重新打开工作表检查。",
    },
    session_recovery: {
      kind: "radio",
      title: "会话恢复",
      whatToEnter: "选择恢复现有会话还是重新开始。",
      purpose: "保留权威语言锁定和分析状态。",
      example: "恢复已保存的会话。",
      validationHint: "请选择与当前会话状态一致的选项。",
      consequence: "该选择决定流程是否复用先前上下文。",
      nextStep: "继续使用恢复后的语言锁定或新工作流。",
      recovery: "如果需要不同的运行，请改为新建会话。",
    },
    conversation_input: {
      kind: "text",
      title: "对话输入",
      whatToEnter: "用自然语言输入用户请求或后续问题。",
      purpose: "捕获驱动流程路由的指令。",
      example: "请用中文分析这个工作簿。",
      validationHint: "如果可以，请输入完整句子。",
      consequence: "代理会据此分类请求并锁定工作流语言。",
      nextStep: "发送消息以开始或继续对话。",
      recovery: "如果表达不清楚，请先重写再发送。",
    },
  },
} satisfies Record<UiCatalogLanguage, Record<UserInputId, LocalizedInputMetadata>>;

export function inputMetadata(language: UiCatalogLanguage = "en"): Record<UserInputId, LocalizedInputMetadata> {
  return INPUT_METADATA_BY_LANGUAGE[language];
}