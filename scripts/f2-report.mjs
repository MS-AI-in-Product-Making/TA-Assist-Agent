function mdEscape(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function sourceText(record) {
  return [record.tableId, record.sourceRow, record.sourceCell].filter((value) => value !== undefined).map(mdEscape).join(" / ") || "-";
}

export function renderF2Report(result, workbookFileName) {
  const lines = [
    "# Feature 2 Report",
    "",
    `- Workbook: ${mdEscape(workbookFileName)}`,
    `- Overall status: ${result.status}`,
    `- F0 version: ${result.knowledgeBaseVersion}`,
    `- Mapping rule version: ${result.mappingRuleVersion}`,
    `- Workbook hash: ${result.workbookContentHash}`,
    `- Tolerance unit assumption: ${result.toleranceUnitAssumption}`,
    `- Worksheets checked: ${result.summary.worksheetsChecked}`,
    `- Ready / blocked: ${result.summary.readyForNextFeatureCount} / ${result.summary.blockedWorksheetCount}`,
    `- Blocking / mapping / capability / governance: ${result.summary.blockingIssueCount} / ${result.summary.mappingRecordCount} / ${result.summary.capabilityCheckCount} / ${result.summary.governanceSignalCount}`,
    "",
  ];

  for (const worksheet of result.worksheets) {
    lines.push(`## ${mdEscape(worksheet.worksheetName)}`, "", `Status: ${worksheet.status}`, "");
    lines.push("### Blocking Issues", "", "| Code | Source | Field / Reason |", "|---|---|---|");
    for (const issue of worksheet.blockingIssues) {
      lines.push(`| ${issue.issueCode} | ${sourceText(issue)} | ${mdEscape(issue.field ?? issue.reasonCode ?? "-")} |`);
    }
    if (worksheet.blockingIssues.length === 0) lines.push("| - | - | - |");
    lines.push("", "### Capability Evidence", "", "| Item | Capability | Status | Tolerance | Distribution | Source |", "|---|---|---|---|---|---|");
    for (const check of worksheet.capabilityChecks) {
      lines.push(`| ${mdEscape(check.itemId)} | ${mdEscape(check.capabilityEntryId)} | ${check.status} | ${check.totalTolerance} ${check.unit} | ${mdEscape(check.actualDistribution)} / ${mdEscape(check.recommendedDistribution)} | ${sourceText(check)} |`);
    }
    if (worksheet.capabilityChecks.length === 0) lines.push("| - | - | - | - | - | - |");
    lines.push("", "### Mapping Optimization Records", "", "| Status | Inputs | Candidates / Hits | Source |", "|---|---|---|---|");
    for (const mapping of worksheet.mappingRecords) {
      const candidates = (mapping.candidates ?? []).map((candidate) => `${candidate.itemId}: ${candidate.hitKeywords.join(", ")}`).join("; ");
      lines.push(`| ${mapping.status} | ${mdEscape(`${mapping.partCategory}; ${mapping.factorName}; ${mapping.partName}`)} | ${mdEscape(candidates || "-")} | ${sourceText(mapping)} |`);
    }
    if (worksheet.mappingRecords.length === 0) lines.push("| - | - | - | - |");
    lines.push("", "### Identifier Governance Signals", "", "| Signal | Field | Source | Detail |", "|---|---|---|---|");
    for (const signal of worksheet.governanceSignals) {
      lines.push(`| ${signal.signalKind} | ${signal.field} | ${sourceText(signal)} | ${mdEscape(signal.reasonCode ?? signal.normalizedDimId ?? "-")} |`);
    }
    if (worksheet.governanceSignals.length === 0) lines.push("| - | - | - | - |");
    lines.push("");
  }
  return lines.join("\n");
}