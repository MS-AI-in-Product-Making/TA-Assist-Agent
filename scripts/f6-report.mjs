import { f6OptimizationResultSchema } from "../packages/contracts/dist/contracts.js";
import { cell } from "./f6-markdown-sanitizer.mjs";

function optionName(kind) {
  return {
    reduce_top_contributor_20: "Reduce Top Contributor 20%",
    reduce_top_3_contributors_30: "Reduce Top 3 Contributors 30%",
    mean_shift_centering: "Mean Shift Centering",
    reverse_solve_single_factor: "Reverse Solve Single Factor",
    reverse_solve_top_3: "Reverse Solve Top 3",
    rss_apportionment: "RSS Apportionment",
    centering_plus_tighten: "Centering Plus Tighten",
    improve_supplier_capability: "Improve Supplier Capability",
    tighten_datum_strategy: "Tighten Datum Strategy",
    requirement_change: "Requirement Change",
  }[kind] ?? kind;
}

function optionResult(option) {
  if (option.status === "completed") {
    return `Cpk ${option.resultMetrics.cpk}; delta Cpk ${option.deltaCpk}; feasibility ${option.feasibility.status}`;
  }
  if (option.status === "insufficient_evidence") {
    return `insufficient_evidence; required inputs: ${option.requiredInputs.join(", ")}`;
  }
  return `calculation_failed; reason: ${option.reasonCode}`;
}

function capabilityStatus(worksheet) {
  if (worksheet.baselineMetrics.cpk < 1) return "FAIL";
  if (worksheet.baselineMetrics.cpk < worksheet.targetCapability.targetCpk) return "RISK";
  return "PASS";
}

function renderReadyWorksheet(lines, worksheet) {
  lines.push(
    `## Worksheet: ${cell(worksheet.worksheetName)}`,
    "",
    "### Executive Summary",
    "",
    `- Status: ${cell(worksheet.status)}`,
    `- Optimization Status: ${cell(worksheet.status)}`,
    `- Target Cpk: ${worksheet.targetCapability.targetCpk} (${cell(worksheet.targetCapability.source)})`,
    `- Highest Impact Action: ${cell(worksheet.highestImpactAction?.optionId ?? "insufficient_evidence")}`,
    `- ROI: ${cell(worksheet.roiStatus)}`,
    "",
    "### Capability",
    "",
    "| Metric | Result | Status |",
    "|---|---:|---|",
    `| Mean | ${worksheet.baselineMetrics.mean} | baseline |`,
    `| Sigma | ${worksheet.baselineMetrics.rssSigma} | baseline |`,
    `| Cp | ${worksheet.baselineMetrics.cp} | baseline |`,
    `| Cpk | ${worksheet.baselineMetrics.cpk} | ${capabilityStatus(worksheet)} |`,
    `| Yield | ${worksheet.baselineMetrics.yield} | baseline |`,
    `| DPMO | ${worksheet.baselineMetrics.dpm} | baseline |`,
    "",
    "### Risk Assessment",
    "",
    "| Risk Area | Rating | Reason |",
    "|---|---|---|",
  );
  if (worksheet.risks.length === 0) lines.push("| — | — | No governed risks recorded. |");
  for (const risk of worksheet.risks) {
    lines.push(`| ${cell(risk.category)} | ${cell(risk.rating)} | ${cell(`${risk.status}: ${risk.reason}`)} |`);
  }
  lines.push(
    "",
    "### Options",
    "",
    "| Scenario | Predicted Improvement |",
    "|---|---|",
  );
  for (const option of worksheet.options) {
    lines.push(`| ${cell(optionName(option.optionKind))} | ${cell(optionResult(option))} |`);
  }
  lines.push("", "### Recommendations", "");
  if (worksheet.recommendations.length === 0) lines.push("- No supported verified option recommendation is available.");
  for (const recommendation of worksheet.recommendations) {
    lines.push(`- ${cell(recommendation.text)}${recommendation.optionId === undefined ? "" : ` (option: ${cell(recommendation.optionId)})`}`);
  }
  for (const clarification of worksheet.clarifications) {
    lines.push(`- Evidence closure ${cell(clarification.clarificationId)}: ${cell(clarification.questionForReviewer)} Required inputs: ${cell(clarification.requiredInputs.join(", "))}.`);
  }
}

function renderRejectedWorksheet(lines, worksheet) {
  lines.push(
    `## Worksheet: ${cell(worksheet.worksheetName)}`,
    "",
    "### Input Validation",
    "",
  );
  for (const finding of worksheet.inputFindings) {
    lines.push(`- ${cell(finding.severity)}: ${cell(finding.message)}`);
  }
}

export function renderF6Report(result, options = {}) {
  void options;
  let parsed;
  try {
    parsed = f6OptimizationResultSchema.parse(result);
  } catch {
    throw new Error("Invalid F6 result.");
  }
  const lines = [
    "# Feature 6 优化工程报告",
    "",
    "## Workbook Executive Summary",
    "",
    `- Status: ${cell(parsed.status)}`,
    `- Workbook: ${cell(parsed.workbook.fileName)}`,
    `- Worksheets: ${parsed.summary.worksheetCount}`,
    `- Completed options: ${parsed.summary.completedOptionCount}`,
  ];
  for (const worksheet of parsed.worksheets) {
    lines.push("");
    if (worksheet.status === "input_rejected") renderRejectedWorksheet(lines, worksheet);
    else renderReadyWorksheet(lines, worksheet);
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
