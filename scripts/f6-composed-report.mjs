import { f6ComposedEngineeringReportSchema } from "../packages/contracts/dist/contracts.js";

const WINDOWS_PATH = /[A-Za-z]:[\\/][^;|\r\n<>"'`]+/g;
const UNC_PATH = /\\\\[^;|\r\n<>"'`]+/g;
const POSIX_PATH = /(^|[\s=:])\/(?!\/)[^;|\r\n<>"'`]+/gm;
const MARKDOWN_CHARACTERS = ["\\", "`", "|", "[", "]", "(", ")", "!", "*", "#", "+", "_"];

function safeText(value) {
  let escaped = String(value)
    .replace(UNC_PATH, "[redacted-local-path]")
    .replace(WINDOWS_PATH, "[redacted-local-path]")
    .replace(POSIX_PATH, "$1[redacted-local-path]")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  for (const character of MARKDOWN_CHARACTERS) escaped = escaped.replaceAll(character, `\\${character}`);
  return escaped
    .replaceAll("\\[redacted-local-path\\]", "[redacted-local-path]")
    .replaceAll(/\r?\n/g, "<br>");
}

function cell(value) {
  return value === null || value === undefined || value === "" ? "（缺失）" : safeText(value);
}

function scenarioName(kind) {
  return {
    reduce_top_contributor_20: "Reduce Top Contributor 20%",
    reduce_top_3_contributors_30: "Reduce Top 3 Contributors 30%",
    improve_supplier_capability: "Improve Supplier Capability",
    tighten_datum_strategy: "Tighten Datum Strategy",
  }[kind] ?? kind;
}

function predictedImprovement(option) {
  if (option.status === "completed") return `${option.predictedImprovement}; ${option.summary}`;
  if (option.status === "insufficient_evidence") {
    return `insufficient_evidence; required inputs: ${option.requiredInputs.join(", ")}`;
  }
  return `calculation_failed; reason: ${option.reasonCode}`;
}

function renderWorkbook(lines, report) {
  lines.push("## Workbook Executive Summary", "");
  for (const bullet of report.workbookExecutiveSummary) lines.push(`- ${cell(bullet)}`);
  lines.push("", "## Workbook Input Validation", "", "| Item | Value |", "|---|---|");
  if (report.blockedWorksheets.length === 0) lines.push("| Blocked Worksheets | None | ");
  for (const worksheet of report.blockedWorksheets) {
    for (const finding of worksheet.findings) {
      lines.push(`| ${cell(worksheet.worksheetName)} | ${cell(`${finding.severity}: ${finding.findingCode}; ${finding.message}`)} |`);
    }
  }
}

function renderExecutiveSummary(lines, section) {
  lines.push("### Executive Summary", "");
  for (const bullet of section) lines.push(`- ${cell(bullet)}`);
}

function renderRequirementReview(lines, section) {
  lines.push(
    "### Requirement Review",
    "",
    "| Item | Value |",
    "|---|---|",
    `| CTQ | ${cell(section.ctq)} |`,
    `| Nominal | ${section.nominal} |`,
    `| LSL | ${section.lowerSpecLimit} |`,
    `| USL | ${section.upperSpecLimit} |`,
    `| Spec Width | ${section.specWidth} |`,
    `| Assessment | ${cell(section.assessment)} |`,
    `| Risk Level | ${cell(section.riskLevel)} |`,
  );
}

function renderInputValidation(lines, findings) {
  lines.push("### Input Validation", "", "| Item | Value |", "|---|---|");
  if (findings.length === 0) lines.push("| Findings | None | ");
  for (const finding of findings) {
    lines.push(`| ${cell(finding.findingCode)} | ${cell(`${finding.severity}: ${finding.message}`)} |`);
  }
}

function renderCapability(lines, section, worksheetStatus) {
  lines.push(
    "### Capability Assessment",
    "",
    "| Metric | Result | Status |",
    "|---|---:|---|",
    `| Mean | ${section.metrics.mean} | reported |`,
    `| Sigma | ${section.metrics.rssSigma} | reported |`,
    `| Cp | ${section.metrics.cp} | reported |`,
    `| Cpk | ${section.metrics.cpk} | ${cell(worksheetStatus)} |`,
    `| Yield | ${section.metrics.yield} | reported |`,
    `| DPMO | ${section.metrics.dpm} | reported |`,
    `| OOS Rate | ${section.oosRate} | reported |`,
    `| OOS ppm | ${section.oosPpm} | reported |`,
  );
  for (const finding of section.findings) lines.push(`- ${cell(finding)}`);
}

function renderContributors(lines, section) {
  lines.push(
    "### Contributor Analysis",
    "",
    "| Rank | Contributor | Contribution |",
    "|---:|---|---:|",
  );
  for (const [index, contributor] of section.topContributors.entries()) {
    lines.push(`| ${index + 1} | ${cell(contributor.factorName)} | ${contributor.contributionPercent}% |`);
  }
  if (section.topContributors.length === 0) lines.push("| — | insufficient_evidence | — | ");
  lines.push(
    "",
    `- Top 1 concentration: ${section.top1Concentration}%`,
    `- Top 3 concentration: ${section.top3Concentration}%`,
    `- Assessment: ${cell(section.concentrationAssessment)} (${cell(section.policyVersion)})`,
  );
}

function renderRootCause(lines, section) {
  lines.push("### Root Cause Analysis", "", `- Evidence status: ${cell(section.evidenceStatus)}`);
  for (const finding of section.factBasedFindings) lines.push(`- ${cell(finding)}`);
  for (const signal of section.signals) lines.push(`- ${cell(signal)}`);
}

function renderRisks(lines, risks) {
  lines.push(
    "### Risk Assessment",
    "",
    "| Risk Area | Rating | Reason |",
    "|---|---|---|",
  );
  if (risks.length === 0) lines.push("| — | — | No governed risks recorded. | ");
  for (const risk of risks) {
    lines.push(`| ${cell(risk.category)} | ${cell(risk.rating)} | ${cell(`${risk.status}: ${risk.reason}`)} |`);
  }
}

function renderRecommendations(lines, recommendations) {
  lines.push(
    "### Recommendations",
    "",
    "| Priority | Recommendation | Expected Benefit |",
    "|---:|---|---|",
  );
  if (recommendations.length === 0) lines.push("| — | No supported recommendation | insufficient_evidence | ");
  for (const [index, recommendation] of recommendations.entries()) {
    const benefit = recommendation.optionId === undefined
      ? "Evidence closure"
      : `Verified option ${recommendation.optionId}`;
    lines.push(`| ${index + 1} | ${cell(recommendation.text)} | ${cell(benefit)} |`);
  }
}

function renderWhatIf(lines, section) {
  lines.push(
    "### What-If Analysis",
    "",
    "| Scenario | Predicted Improvement |",
    "|---|---|",
  );
  for (const option of section.options) {
    lines.push(`| ${cell(scenarioName(option.optionKind))} | ${cell(predictedImprovement(option))} |`);
  }
  lines.push(
    "",
    `- ${cell(section.highestImpactAction)}`,
    `- ROI: ${cell(section.roiStatus)}`,
  );
}

function renderFinalConclusion(lines, section) {
  lines.push("### Final Conclusion", "");
  for (const bullet of section) lines.push(`- ${cell(bullet)}`);
}

function renderWorksheet(lines, worksheet) {
  const sections = worksheet.sections;
  lines.push("", `## Worksheet: ${cell(worksheet.worksheetName)}`, "");
  renderExecutiveSummary(lines, sections.executiveSummary);
  lines.push("");
  renderRequirementReview(lines, sections.requirementReview);
  lines.push("");
  renderInputValidation(lines, sections.inputValidation);
  lines.push("");
  renderCapability(lines, sections.capabilityAssessment, worksheet.status);
  lines.push("");
  renderContributors(lines, sections.contributorAnalysis);
  lines.push("");
  renderRootCause(lines, sections.rootCauseAnalysis);
  lines.push("");
  renderRisks(lines, sections.riskAssessment);
  lines.push("");
  renderRecommendations(lines, sections.recommendations);
  lines.push("");
  renderWhatIf(lines, sections.whatIfAnalysis);
  lines.push("");
  renderFinalConclusion(lines, sections.finalConclusion);
}

export function renderComposedEngineeringReport(report, options = {}) {
  void options;
  let parsed;
  try {
    parsed = f6ComposedEngineeringReportSchema.parse(report);
  } catch {
    throw new Error("Invalid F6 composed engineering report.");
  }
  const lines = ["# F5 + F6 联合工程报告", ""];
  renderWorkbook(lines, parsed);
  for (const worksheet of parsed.worksheets) renderWorksheet(lines, worksheet);
  return `${lines.join("\n").trimEnd()}\n`;
}
