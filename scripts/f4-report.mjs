import {
  f4ExcelComparisonResultSchema,
  f4WorkflowCalculationResultSchema,
} from "../packages/contracts/dist/contracts.js";

function redactSensitiveText(value) {
  return String(value)
    .replace(/\b[A-Za-z]:\\[^\s|)]+/g, "[redacted-local-path]")
    .replace(/(Authorization\s*[:=]\s*)([^\s|]+)/gi, "$1[redacted]")
    .replace(/\b(Bearer)\s+[^\s|]+/gi, "$1 [redacted]")
    .replace(/\b(token|api[-_]?key|secret|password)\s*[:=]\s*[^\s|]+/gi, "$1=[redacted]");
}

function cell(value) {
  if (value === null || value === undefined || value === "") return "—";
  return redactSensitiveText(value).replaceAll("|", "\\|").replaceAll(/\r?\n/g, "<br>");
}

function renderKeyValueTable(title, objectValue) {
  const lines = [title, "", "| 字段 | 值 |", "| --- | --- |"];
  for (const [key, value] of Object.entries(objectValue)) {
    lines.push(`| ${cell(key)} | ${cell(value)} |`);
  }
  lines.push("");
  return lines;
}

function renderCalculationSection(calculation) {
  const lines = [
    `### 工作表 ${cell(calculation.worksheetSelection.worksheetName)}`,
    "",
    "#### 计算方法",
    "",
    "| 字段 | 值 |",
    "| --- | --- |",
    `| worksheetName | ${cell(calculation.worksheetSelection.worksheetName)} |`,
    `| tableId | ${cell(calculation.worksheetSelection.tableId)} |`,
    `| factorCount | ${cell(calculation.factorCount)} |`,
    `| method | ${cell(calculation.recommendation.method)} |`,
    `| reason | ${cell(calculation.recommendation.reason)} |`,
    `| refer3d | ${cell(calculation.recommendation.refer3d)} |`,
    `| criticality | ${cell(calculation.recommendation.criticality)} |`,
    `| criticalityRisk | ${cell(calculation.recommendation.criticalityRisk)} |`,
    "",
  ];

  lines.push(...renderKeyValueTable("#### 系统结果", calculation.system));
  lines.push(...renderKeyValueTable("#### 能力结果", calculation.capability));

  lines.push(
    "#### 因子结果",
    "",
    "| worksheetName | tableId | sourceRow | factorName | method | mean | halfTolerance | sigma | contribution |",
    "| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: |",
  );
  for (const factor of calculation.factors) {
    lines.push(
      `| ${cell(factor.source.worksheetName)} | ${cell(factor.source.tableId)} | ${cell(factor.source.sourceRow)} | ${cell(factor.factorName)} | ${cell(calculation.recommendation.method)} | ${cell(factor.mean)} | ${cell(factor.halfTolerance)} | ${cell(factor.sigma)} | ${cell(factor.contribution)} |`,
    );
  }
  lines.push("");
  return lines;
}

function renderComparisonSection(comparisonResult) {
  const lines = [
    "## Excel 回归",
    "",
    `状态：${cell(comparisonResult.status)}`,
    "",
  ];

  if (comparisonResult.status === "passed" || comparisonResult.status === "mismatch") {
    lines.push(
      "| 指标 | F4 | Excel | 绝对差值 | 相对差值 | 容差 | 通过 | Worksheet | Source cell | Excel 公式 | F4 公式 ID |",
      "| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |",
    );
    for (const worksheet of comparisonResult.worksheets) {
      for (const metric of worksheet.metrics) {
        lines.push(`| ${cell(metric.metric)} | ${cell(metric.f4Value)} | ${cell(metric.excelValue)} | ${cell(metric.absoluteDifference)} | ${cell(metric.relativeDifference)} | ${cell(metric.tolerance)} | ${cell(metric.passed)} | ${cell(worksheet.worksheetName)} | ${cell(metric.sourceCell)} | ${cell(metric.excelFormula)} | ${cell(metric.f4FormulaId)} |`);
      }
    }
    lines.push("");
    lines.push(...renderKeyValueTable("### 回归汇总", comparisonResult.summary));
    return lines;
  }

  lines.push(`原因：${cell(comparisonResult.reasonCode)}`, "");
  return lines;
}

export function renderF4Report(workflowCalculationResult, options = {}) {
  const calculation = f4WorkflowCalculationResultSchema.parse(workflowCalculationResult);
  const comparison = options.comparisonResult === undefined
    ? undefined
    : f4ExcelComparisonResultSchema.parse(options.comparisonResult);

  const lines = [
    "# Feature 4 工作流计算报告",
    "",
    "## 执行摘要",
    "",
    `- runId：${cell(calculation.runId)}`,
    `- generatedAt：${cell(calculation.generatedAt)}`,
    `- workbook：${cell(calculation.source.workbookFileName)}`,
    `- workbookContentHash：${cell(calculation.source.workbookContentHash)}`,
    `- selectedWorksheetCount：${cell(calculation.summary.selectedWorksheetCount)}`,
    `- completedWorksheetCount：${cell(calculation.summary.completedWorksheetCount)}`,
    "",
  ];

  for (const item of calculation.calculations) {
    lines.push(...renderCalculationSection(item));
  }

  if (comparison) {
    lines.push(...renderComparisonSection(comparison));
  }

  return `${lines.join("\n")}\n`;
}
