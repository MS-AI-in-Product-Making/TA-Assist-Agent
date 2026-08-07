import {
  f4ExcelComparisonResultSchema,
  f4WorkflowCalculationResultSchema,
} from "../packages/contracts/dist/contracts.js";

const EPSILON = 1e-12;

function redactSensitiveText(value) {
  return String(value)
    .replace(/(Authorization\s*[:=]\s*)([^\r\n|]+)/gi, "$1[redacted]")
    .replace(/\b(Bearer)\s+([^\r\n|]+)/gi, "$1 [redacted]")
    .replace(/\b(token|api[-_]?key|secret|password)\s*[:=]\s*([^\r\n|]+)/gi, "$1=[redacted]")
    .replace(/(^|[\s(])([A-Za-z]:[\\/](?:[^\\/\s\r\n|]+[\\/])*[^\\/\s\r\n|]+)(?=$|[\s),;])/g, "$1[redacted-local-path]")
    .replace(/(^|[\s(])((?:\\\\|\/\/)[^\\/\s\r\n|]+(?:[\\/][^\\/\s\r\n|]+)+)(?=$|[\s),;])/g, "$1[redacted-local-path]")
    .replace(/(^|[\s(])(\/(?:[^/\s\r\n|]+\/)+[^/\s\r\n|]+)(?=$|[\s),;])/g, "$1[redacted-local-path]");
}

function neutralizeMarkdownText(value) {
  const withoutControls = Array.from(String(value), (character) => {
    const code = character.charCodeAt(0);
    return (code < 32 || code === 127) ? " " : character;
  }).join("");

  return withoutControls
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]*)\)/g, "$1")
    .replace(/`/g, "\\`")
    .replace(/(^|\n)\s*#+\s*/g, "$1")
    .replace(/\\/g, "&#92;")
    .replace(/\|/g, "&#124;")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeText(value) {
  return neutralizeMarkdownText(redactSensitiveText(value));
}

function cell(value) {
  if (value === null || value === undefined || value === "") return "—";
  return sanitizeText(value);
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
  const worksheetName = cell(calculation.worksheetSelection.worksheetName);
  const lines = [
    `## ${worksheetName}`,
    "",
    "### 系统计算",
    "",
    "| 字段 | 值 |",
    "| --- | --- |",
    `| worksheetName | ${worksheetName} |`,
    `| tableId | ${cell(calculation.worksheetSelection.tableId)} |`,
    `| factorCount | ${cell(calculation.factorCount)} |`,
    `| method | ${cell(calculation.recommendation.method)} |`,
    `| reason | ${cell(calculation.recommendation.reason)} |`,
    `| refer3d | ${cell(calculation.recommendation.refer3d)} |`,
    `| criticality | ${cell(calculation.recommendation.criticality)} |`,
    `| criticalityRisk | ${cell(calculation.recommendation.criticalityRisk)} |`,
    "",
  ];

  lines.push(...renderKeyValueTable("### 系统计算", calculation.system));
  lines.push(...renderKeyValueTable("### 能力指标", calculation.capability));

  lines.push(
    "### Factor 结果",
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
    "### Excel 回归",
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

function resolveMetricPath(calculation, metricPath) {
  if (metricPath.startsWith("factors[")) {
    const matched = /^factors\[(\d+)\]\.(mean|halfTolerance|sigma|contribution)$/.exec(metricPath);
    if (!matched) {
      throw new Error(`Feature 4 comparison metric path is unsupported: ${metricPath}`);
    }
    const factorIndex = Number(matched[1]);
    const field = matched[2];
    const factorFormulaByField = {
      mean: "factor-mean-v1",
      halfTolerance: "factor-half-tolerance-v1",
      sigma: "factor-sigma-v1",
      contribution: "contribution-v1",
    };
    const factor = calculation.factors[factorIndex];
    if (!factor) {
      throw new Error(`Feature 4 comparison factor index is out of range: ${metricPath}`);
    }
    const expectedFormulaId = factorFormulaByField[field];
    return {
      value: factor[field],
      formulaMatches: (formulaId) => formulaId === expectedFormulaId && factor.trace.formulaIds.includes(expectedFormulaId),
    };
  }

  const [scope, field] = metricPath.split(".");
  if ((scope !== "system" && scope !== "capability") || !field) {
    throw new Error(`Feature 4 comparison metric path is unsupported: ${metricPath}`);
  }
  const scopeValue = calculation[scope];
  const resolved = scopeValue[field];
  if (typeof resolved !== "number" || !Number.isFinite(resolved)) {
    throw new Error(`Feature 4 comparison metric is unknown or non-numeric: ${metricPath}`);
  }
  return {
    value: resolved,
    formulaMatches: (formulaId) => calculation.traceRecords.some((record) => record.outputField === metricPath && record.formulaId === formulaId),
  };
}

function nearlyEqual(left, right) {
  return Math.abs(left - right) <= EPSILON * Math.max(1, Math.abs(left), Math.abs(right));
}

function assertComparisonAssociation(calculationResult, comparisonResult) {
  if (comparisonResult.runId !== calculationResult.runId) {
    throw new Error("Feature 4 comparison runId must match workflow calculation runId.");
  }

  if (comparisonResult.status !== "passed" && comparisonResult.status !== "mismatch") {
    return;
  }

  if (comparisonResult.source.workbookContentHash !== calculationResult.source.workbookContentHash) {
    throw new Error("Feature 4 comparison workbook content hash must match workflow calculation source hash.");
  }

  const calcByWorksheet = new Map(
    calculationResult.calculations.map((item) => [item.worksheetSelection.worksheetName, item]),
  );
  const calcWorksheets = new Set(calcByWorksheet.keys());
  const comparisonWorksheets = new Set(comparisonResult.worksheets.map((item) => item.worksheetName));
  if (calcWorksheets.size !== comparisonWorksheets.size) {
    throw new Error("Feature 4 comparison worksheet set must equal calculation worksheet set.");
  }
  for (const worksheetName of calcWorksheets) {
    if (!comparisonWorksheets.has(worksheetName)) {
      throw new Error("Feature 4 comparison worksheet set must equal calculation worksheet set.");
    }
  }

  for (const worksheet of comparisonResult.worksheets) {
    const calculation = calcByWorksheet.get(worksheet.worksheetName);
    if (!calculation) {
      throw new Error(`Feature 4 comparison worksheet is unknown: ${worksheet.worksheetName}`);
    }

    for (const metric of worksheet.metrics) {
      const resolved = resolveMetricPath(calculation, metric.metric);
      if (!nearlyEqual(metric.f4Value, resolved.value)) {
        throw new Error(`Feature 4 comparison f4Value mismatch for metric ${metric.metric}.`);
      }
      if (!resolved.formulaMatches(metric.f4FormulaId)) {
        throw new Error(`Feature 4 comparison formula evidence mismatch for metric ${metric.metric}.`);
      }
    }
  }
}

export function renderF4Report(workflowCalculationResult, options = {}) {
  const calculation = f4WorkflowCalculationResultSchema.parse(workflowCalculationResult);
  const comparison = options.comparisonResult === undefined
    ? undefined
    : f4ExcelComparisonResultSchema.parse(options.comparisonResult);

  if (comparison) {
    assertComparisonAssociation(calculation, comparison);
  }

  const lines = [
    "# Feature 4 TA 计算报告",
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
