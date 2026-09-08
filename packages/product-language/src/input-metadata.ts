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
  | "worksheet_search"
  | "factor_nominal_value"
  | "factor_upper_tolerance"
  | "factor_lower_tolerance"
  | "lower_spec_limit"
  | "upper_spec_limit"
  | "what_if_factor"
  | "what_if_nominal_value"
  | "what_if_upper_tolerance"
  | "what_if_lower_tolerance"
  | "what_if_additional_mean_shift"
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
      kind: "checkbox",
      title: "Worksheet scope",
      whatToEnter: "Choose the worksheet or worksheet set to include in the analysis.",
      purpose: "Limits the workflow to the relevant workbook surface.",
      example: "gap wo rubber_static",
      validationHint: "Pick one worksheet scope that exists in the workbook.",
      consequence: "Only the selected worksheets will be parsed and validated.",
      nextStep: "Continue with missing-item decisions or actual calculations.",
      recovery: "If the scope is wrong, select the correct worksheet group.",
    },
    worksheet_search: {
      kind: "combobox", title: "Worksheet search", whatToEnter: "Search for the worksheet to review.", purpose: "Moves the engineering workspace to one governed worksheet without changing analysis scope.", example: "AJ_GAP", validationHint: "Choose a worksheet from the available list.", consequence: "The table, image, and metrics switch to that worksheet.", nextStep: "Review its evidence or edit an allowed scenario input.", recovery: "Clear the search or choose another worksheet.",
    },
    factor_nominal_value: {
      kind: "number", title: "Factor nominal value", whatToEnter: "Enter the proposed nominal value for this Factor.", purpose: "Previews a governed scenario without changing the source workbook.", example: "1.25", validationHint: "Enter a finite number in the Factor table unit.", consequence: "Scenario metrics are recalculated from this value.", nextStep: "Review the updated metrics before saving a draft.", recovery: "Restore the baseline value to discard the edit.",
    },
    factor_upper_tolerance: {
      kind: "number", title: "Factor upper tolerance", whatToEnter: "Enter the proposed positive tolerance for this Factor.", purpose: "Tests the upper tolerance contribution in a governed scenario.", example: "0.10", validationHint: "Enter a finite non-negative value in the Factor unit.", consequence: "Scenario variation and capability are recalculated.", nextStep: "Review the result before saving a draft.", recovery: "Restore the baseline tolerance to discard the edit.",
    },
    factor_lower_tolerance: {
      kind: "number", title: "Factor lower tolerance", whatToEnter: "Enter the proposed negative-side tolerance magnitude for this Factor.", purpose: "Tests the lower tolerance contribution in a governed scenario.", example: "-0.10", validationHint: "Use the sign convention shown in the Factor table.", consequence: "Scenario variation and capability are recalculated.", nextStep: "Review the result before saving a draft.", recovery: "Restore the baseline tolerance to discard the edit.",
    },
    lower_spec_limit: {
      kind: "number", title: "Lower specification limit", whatToEnter: "Enter or drag the proposed lower specification limit.", purpose: "Evaluates a governed specification scenario without modifying the workbook.", example: "0.50", validationHint: "LSL must be a finite number below USL.", consequence: "Capability metrics are recalculated against the proposed limit.", nextStep: "Review the scenario result and approval warning.", recovery: "Restore the baseline specification to discard the edit.",
    },
    upper_spec_limit: {
      kind: "number", title: "Upper specification limit", whatToEnter: "Enter or drag the proposed upper specification limit.", purpose: "Evaluates a governed specification scenario without modifying the workbook.", example: "1.50", validationHint: "USL must be a finite number above LSL.", consequence: "Capability metrics are recalculated against the proposed limit.", nextStep: "Review the scenario result and approval warning.", recovery: "Restore the baseline specification to discard the edit.",
    },
    what_if_factor: {
      kind: "combobox", title: "What-if Factor", whatToEnter: "Choose the Factor to modify in this draft.", purpose: "Keeps each scenario edit bound to one structured Factor identity.", example: "A - Bracket thickness", validationHint: "Choose one Factor from the governed worksheet table.", consequence: "The editor loads that Factor's baseline values.", nextStep: "Enter proposed values and review the recalculation.", recovery: "Choose another Factor or restore the baseline.",
    },
    what_if_nominal_value: {
      kind: "number", title: "What-if nominal value", whatToEnter: "Enter the proposed nominal or mean for the selected Factor.", purpose: "Tests a center shift in the saved scenario draft.", example: "1.25", validationHint: "Enter a finite number in the Factor unit.", consequence: "The preview recalculates after the edit.", nextStep: "Review metrics before saving the draft.", recovery: "Use Restore baseline to discard the proposal.",
    },
    what_if_upper_tolerance: {
      kind: "number", title: "What-if upper tolerance", whatToEnter: "Enter the proposed upper tolerance for the selected Factor.", purpose: "Tests a tolerance change in the saved scenario draft.", example: "0.10", validationHint: "Enter a finite value using the table convention.", consequence: "The preview recalculates after the edit.", nextStep: "Review metrics before saving the draft.", recovery: "Use Restore baseline to discard the proposal.",
    },
    what_if_lower_tolerance: {
      kind: "number", title: "What-if lower tolerance", whatToEnter: "Enter the proposed lower tolerance for the selected Factor.", purpose: "Tests a tolerance change in the saved scenario draft.", example: "-0.10", validationHint: "Enter a finite value using the table sign convention.", consequence: "The preview recalculates after the edit.", nextStep: "Review metrics before saving the draft.", recovery: "Use Restore baseline to discard the proposal.",
    },
    what_if_additional_mean_shift: {
      kind: "number", title: "What-if additional mean shift", whatToEnter: "Enter an additional process mean shift for the selected Factor.", purpose: "Separates an assumed process shift from the design nominal.", example: "0.02", validationHint: "Enter a finite signed value in the Factor unit.", consequence: "The preview includes the additional shift.", nextStep: "Review metrics before saving the draft.", recovery: "Set the shift to zero or restore the baseline.",
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
      kind: "checkbox",
      title: "工作表范围",
      whatToEnter: "选择要纳入分析的工作表或工作表集合。",
      purpose: "将流程限制在相关的工作簿内容上。",
      example: "gap wo rubber_static",
      validationHint: "请选择工作簿中实际存在的一个工作表范围。",
      consequence: "只有所选工作表会被解析和校验。",
      nextStep: "继续处理缺失项决策或后续计算。",
      recovery: "如果范围不对，请改选正确的工作表组。",
    },
    worksheet_search: {
      kind: "combobox", title: "工作表搜索", whatToEnter: "搜索要查看的工作表。", purpose: "在不改变分析范围的情况下切换工程工作区。", example: "AJ_GAP", validationHint: "请从可用列表中选择工作表。", consequence: "表格、图片和指标会切换到该工作表。", nextStep: "查看证据或编辑允许的场景输入。", recovery: "清空搜索或选择其他工作表。",
    },
    factor_nominal_value: {
      kind: "number", title: "Factor 名义值", whatToEnter: "输入该 Factor 的建议名义值。", purpose: "在不修改源工作簿的情况下预览受治理场景。", example: "1.25", validationHint: "请输入使用 Factor 单位的有限数字。", consequence: "系统会据此重算场景指标。", nextStep: "保存草稿前检查更新后的指标。", recovery: "恢复 baseline 值即可放弃编辑。",
    },
    factor_upper_tolerance: {
      kind: "number", title: "Factor 上公差", whatToEnter: "输入该 Factor 的建议正公差。", purpose: "测试受治理场景中的上公差贡献。", example: "0.10", validationHint: "请输入使用 Factor 单位的有限非负值。", consequence: "系统会重算场景波动和能力。", nextStep: "保存草稿前检查结果。", recovery: "恢复 baseline 公差即可放弃编辑。",
    },
    factor_lower_tolerance: {
      kind: "number", title: "Factor 下公差", whatToEnter: "输入该 Factor 的建议负侧公差幅值。", purpose: "测试受治理场景中的下公差贡献。", example: "-0.10", validationHint: "请使用 Factor 表中显示的符号约定。", consequence: "系统会重算场景波动和能力。", nextStep: "保存草稿前检查结果。", recovery: "恢复 baseline 公差即可放弃编辑。",
    },
    lower_spec_limit: {
      kind: "number", title: "规格下限", whatToEnter: "输入或拖动建议的规格下限。", purpose: "在不修改工作簿的情况下评估规格场景。", example: "0.50", validationHint: "LSL 必须是小于 USL 的有限数字。", consequence: "系统会按建议下限重算能力指标。", nextStep: "检查场景结果和审批提醒。", recovery: "恢复 baseline 规格即可放弃编辑。",
    },
    upper_spec_limit: {
      kind: "number", title: "规格上限", whatToEnter: "输入或拖动建议的规格上限。", purpose: "在不修改工作簿的情况下评估规格场景。", example: "1.50", validationHint: "USL 必须是大于 LSL 的有限数字。", consequence: "系统会按建议上限重算能力指标。", nextStep: "检查场景结果和审批提醒。", recovery: "恢复 baseline 规格即可放弃编辑。",
    },
    what_if_factor: {
      kind: "combobox", title: "What-if Factor", whatToEnter: "选择要在草稿中修改的 Factor。", purpose: "将每次场景编辑绑定到唯一结构化 Factor。", example: "A - 支架厚度", validationHint: "请从受治理工作表中选择一个 Factor。", consequence: "编辑器会载入该 Factor 的 baseline 值。", nextStep: "输入建议值并检查重算结果。", recovery: "选择其他 Factor 或恢复 baseline。",
    },
    what_if_nominal_value: {
      kind: "number", title: "What-if 名义值", whatToEnter: "输入所选 Factor 的建议名义值或均值。", purpose: "在已保存场景草稿中测试中心偏移。", example: "1.25", validationHint: "请输入使用 Factor 单位的有限数字。", consequence: "编辑后系统会重新计算预览。", nextStep: "保存草稿前检查指标。", recovery: "使用恢复 baseline 放弃建议。",
    },
    what_if_upper_tolerance: {
      kind: "number", title: "What-if 上公差", whatToEnter: "输入所选 Factor 的建议上公差。", purpose: "在已保存场景草稿中测试公差变更。", example: "0.10", validationHint: "请按表格约定输入有限数字。", consequence: "编辑后系统会重新计算预览。", nextStep: "保存草稿前检查指标。", recovery: "使用恢复 baseline 放弃建议。",
    },
    what_if_lower_tolerance: {
      kind: "number", title: "What-if 下公差", whatToEnter: "输入所选 Factor 的建议下公差。", purpose: "在已保存场景草稿中测试公差变更。", example: "-0.10", validationHint: "请按表格符号约定输入有限数字。", consequence: "编辑后系统会重新计算预览。", nextStep: "保存草稿前检查指标。", recovery: "使用恢复 baseline 放弃建议。",
    },
    what_if_additional_mean_shift: {
      kind: "number", title: "What-if 附加均值偏移", whatToEnter: "输入所选 Factor 的附加工艺均值偏移。", purpose: "将假设的工艺偏移与设计名义值分开。", example: "0.02", validationHint: "请输入使用 Factor 单位的有限有符号数字。", consequence: "预览会包含该附加偏移。", nextStep: "保存草稿前检查指标。", recovery: "将偏移设为零或恢复 baseline。",
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