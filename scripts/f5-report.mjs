import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { f5DataInterpretationResultSchema } from "../packages/contracts/dist/contracts.js";
import { evidenceLabel } from "./engineering-format.mjs";

const WINDOWS_ABSOLUTE_PATH_PATTERN = /[A-Za-z]:[\\/][^;|\r\n<>"'`]+/g;
const UNC_PATH_PATTERN = /\\\\[^;|\r\n<>"'`]+/g;
const POSIX_ABSOLUTE_PATH_PATTERN = /(^|[\s=:])\/(?!\/)[^;|\r\n<>"'`]+/gm;
const CREDENTIAL_PATTERN = /\b(Authorization\s*[:=]\s*)(?:Bearer\s+)?[^;|\r\n<>"'`]+/gi;
const SENSITIVE_FIELD_PATTERN = /\b(?:workbookBytes|bytes|hiddenReasoning|hidden reasoning|chainOfThought|chain of thought|credential|password|api[_ -]?key|token)\s*[:=]\s*[^;|\r\n<>"'`]+/gi;
const MARKDOWN_CONTROL_CHARACTERS = ["\\", "`", "|", "[", "]", "(", ")", "!", "*", "#", "+"];
const CONTROLLED_REDACTION_PLACEHOLDERS = [
  "redacted-local-path",
  "redacted",
  "redacted-sensitive-field",
];

const CHAPTERS = [
  { key: "toleranceChainValidity", title: "## 1. 公差链有效性" },
  { key: "capabilityVsSpecification", title: "## 2. 能力与规格对比" },
  { key: "majorContributors", title: "## 3. 主要贡献因子" },
  { key: "reasonableToleranceRange", title: "## 4. 合理公差范围" },
  { key: "designOptimizationAndParallelOptions", title: "## 5. 设计优化与并列方案" },
];
const CORE_SCOPES = new Set([
  "tolerance_loop_closure",
  "datum_chain",
  "assembly_datum_face",
  "stack_start",
  "direction",
]);

function redact(value) {
  return String(value)
    .replace(UNC_PATH_PATTERN, "[redacted-local-path]")
    .replace(WINDOWS_ABSOLUTE_PATH_PATTERN, "[redacted-local-path]")
    .replace(POSIX_ABSOLUTE_PATH_PATTERN, "$1[redacted-local-path]")
    .replace(CREDENTIAL_PATTERN, "$1[redacted]")
    .replace(SENSITIVE_FIELD_PATTERN, "[redacted-sensitive-field]");
}

function safeText(value) {
  let escaped = redact(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  for (const character of MARKDOWN_CONTROL_CHARACTERS) {
    escaped = escaped.replaceAll(character, `\\${character}`);
  }
  for (const placeholder of CONTROLLED_REDACTION_PLACEHOLDERS) {
    escaped = escaped.replaceAll(`\\[${placeholder}\\]`, `[${placeholder}]`);
  }
  return escaped;
}

function cell(value) {
  if (value === null || value === undefined || value === "") return "（缺失）";
  return safeText(value).replaceAll(/\r?\n/g, "<br>");
}

function inline(value) {
  if (value === null || value === undefined || value === "") return "（缺失）";
  return safeText(value).replaceAll(/\r?\n/g, " ");
}

function code(value) {
  return `\`${inline(value)}\``;
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function encodeRelativeHref(relativePath) {
  return relativePath
    .split(/[\\/]/)
    .map((segment) => segment === "." || segment === ".."
      ? segment
      : encodeURIComponent(segment).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");
}

function imageHref(imageReference, { outputRoot, f1ArtifactRoot, publishRoot }) {
  if (typeof outputRoot !== "string" || outputRoot.length === 0
    || typeof f1ArtifactRoot !== "string" || f1ArtifactRoot.length === 0
    || typeof publishRoot !== "string" || publishRoot.length === 0) {
    return undefined;
  }

  try {
    const controlledPublishRoot = realpathSync(publishRoot);
    const controlledRoot = realpathSync(f1ArtifactRoot);
    const controlledOutputRoot = realpathSync(outputRoot);
    const lexicalTarget = path.resolve(controlledRoot, imageReference.relativePath);
    if (!isContained(controlledRoot, lexicalTarget) || !existsSync(lexicalTarget)) {
      throw new Error("invalid image target");
    }
    const controlledTarget = realpathSync(lexicalTarget);
    if (!isContained(controlledRoot, controlledTarget)) throw new Error("invalid image target");
    if (!isContained(controlledPublishRoot, controlledOutputRoot)
      || !isContained(controlledPublishRoot, controlledTarget)) {
      throw new Error("image link escapes publish root");
    }
    const relative = path.relative(controlledOutputRoot, controlledTarget);
    if (path.isAbsolute(relative)) throw new Error("invalid relative image link");
    return encodeRelativeHref(relative);
  } catch {
    return undefined;
  }
}

function imageLink(imageReference, options) {
  const href = imageHref(imageReference, options);
  return href === undefined ? "F1 图片证据链接不可用" : `[F1 图片](${href})`;
}

function sourceText(source) {
  return `Worksheet=${inline(source.worksheetName)}; Table=${inline(source.tableId)}; Row=${source.sourceRow}`;
}

function applicabilityText(applicability) {
  const fields = [`analysisDimension=${inline(applicability.analysisDimension)}`];
  if (applicability.method !== undefined) fields.push(`method=${inline(applicability.method)}`);
  return fields.join("; ");
}

function evidenceText(evidence) {
  return [
    `classification=${inline(evidence.classification)}`,
    `sourceAlias=${inline(evidence.sourceAlias)}`,
    `sourceVersion=${inline(evidence.sourceVersion)}`,
    `sheetName=${inline(evidence.sheetName)}`,
    `sourceRange=${inline(evidence.sourceRange)}`,
    `sourceFileHash=${inline(evidence.sourceFileHash)}`,
    `owner=${inline(evidence.owner)}`,
    `confidence=${inline(evidence.confidence)}`,
    `effectiveVersion=${inline(evidence.effectiveVersion)}`,
    `changeSummary=${inline(evidence.changeSummary)}`,
  ].join("; ");
}

function traceText(trace) {
  return [
    `outputField=${trace.outputField}`,
    `formulaId=${trace.formulaId}`,
    `formulaVersion=${trace.formulaVersion}`,
    `sourceCells=${trace.sourceCells.join(", ")}`,
  ].join("; ");
}

function factProvenanceDetail(content) {
  if (content.provenanceKind === "formula_output") {
    return [`outputField=${content.outputField}`, ...content.traceRecords.map(traceText)].join("; ");
  }
  if (content.provenanceKind === "derived_from_formula_outputs") {
    return [
      `sourceOutputFields=${content.sourceOutputFields.join(", ")}`,
      ...content.traceRecords.map(traceText),
    ].join("; ");
  }
  if (content.metric === "recommended_method") {
    return `method=${content.method}; reason=${content.reason}; inputField=${content.inputField}`;
  }
  return `inputField=${content.inputField}`;
}

function renderRejectedWorksheet(lines, worksheet) {
  lines.push(`### Worksheet: ${cell(worksheet.worksheetName)}`, "", "页状态：`input_rejected`", "");
  lines.push("| reasonCode | artifactReference |", "| --- | --- |", `| ${cell(worksheet.reasonCode)} | ${cell(worksheet.artifactReference)} |`);
}

function renderSupportCards(lines, worksheet, section) {
  const clarifications = worksheet.clarifications.filter((item) => item.section === section);
  if (clarifications.length > 0) {
    lines.push("", "#### 澄清卡片");
    for (const item of clarifications) {
      lines.push(
        "",
        `- clarificationId: ${code(item.clarificationId)}`,
        `- reasonCode: ${code(item.reasonCode)}`,
        `- missingEvidence: ${item.missingEvidence.length > 0 ? item.missingEvidence.map(inline).join("; ") : "（无）"}`,
        `- affectedConclusionIds: ${item.affectedConclusionIds.length > 0 ? item.affectedConclusionIds.map(inline).join("; ") : "（无）"}`,
        `- blockingScope: ${code(item.blockingScope)}`,
        `- questionForReviewer: ${inline(item.questionForReviewer)}`,
      );
    }
  }

  const assumptions = worksheet.assumptions.filter((item) => item.affectedSections.includes(section));
  if (assumptions.length > 0) {
    lines.push("", "#### 假设");
    for (const item of assumptions) {
      const status = item.status === "proposed" ? "proposed（仅提议，未采用）" : item.status;
      lines.push(
        "",
        `- assumptionId: ${code(item.assumptionId)}`,
        `- source: ${inline(item.source)}`,
        `- statement: ${inline(item.statement)}`,
        `- status: ${status}`,
      );
      if (item.status === "confirmed") {
        lines.push(`- confirmedBy: ${inline(item.confirmedBy)}`, `- confirmedAt: ${inline(item.confirmedAt)}`);
      }
    }
  }
}

function renderScopeMatrix(lines, worksheet, contextSignals) {
  const signalByScope = new Map(contextSignals.map((signal) => [signal.content.scope, signal]));
  lines.push(
    "#### 五项状态矩阵",
    "",
    "| scope | visualStatus | contextSignal | requiresEngineeringReview |",
    "| --- | --- | --- | --- |",
  );
  for (const item of worksheet.sections.toleranceChainValidity.items.filter(({ scope }) => CORE_SCOPES.has(scope))) {
    const signal = signalByScope.get(item.scope);
    lines.push(`| ${cell(item.scope)} | ${cell(item.status)} | ${cell(signal?.content.signalValue)} | ${cell(signal?.content.requiresEngineeringReview)} |`);
  }
}

function renderVisualFacts(lines, facts, options, contextual) {
  if (contextual) {
    if (facts.length === 0) {
      lines.push("", "#### Visual FACT", "", "无满足 FACT gate 的视觉观察");
      return;
    }
    lines.push(
      "",
      "#### Visual FACT",
      "",
      "| scope | observedValue | confidence | reviewStatus | image | visibleBasis | visibleLabels |",
      "| --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const fact of facts) {
      lines.push(`| ${cell(fact.content.scope)} | ${cell(fact.content.observedValue)} | ${cell(fact.content.confidence)} | ${cell(fact.content.reviewStatus)} | ${imageLink(fact.content.imageReference, options)} | ${cell(fact.content.visibleBasis)} | ${cell((fact.content.visibleLabels ?? []).join("; "))} |`);
    }
    return;
  }
  if (facts.length === 0) return;

  lines.push("", "| 类型 | statementId | scope | observedValue | confidence | reviewStatus | image | visibleBasis |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const fact of facts) {
    lines.push(`| FACT | ${cell(fact.statementId)} | ${cell(fact.content.scope)} | ${cell(fact.content.observedValue)} | ${cell(fact.content.confidence)} | ${cell(fact.content.reviewStatus)} | ${imageLink(fact.content.imageReference, options)} | ${cell(fact.content.visibleBasis)} |`);
  }
}

function renderContextSignals(lines, signals) {
  lines.push(
    "",
    "#### Worksheet context SIGNAL",
    "",
    "图文联合提示，非工程结论。",
    "",
    "| scope | signalValue | textBasis | linkedSourceRows | linkedVisualLabels | requiresEngineeringReview |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const signal of signals) {
    const linkedSourceRows = signal.content.linkedSourceRows
      .map(({ tableId, sourceRow }) => `${tableId}:${sourceRow}`)
      .join("; ");
    const linkedVisualLabels = signal.content.linkedVisualLabels
      .map(({ label, tableId, sourceRow }) => `${label} -> ${tableId}:${sourceRow}`)
      .join("; ");
    lines.push(`| ${cell(signal.content.scope)} | ${cell(signal.content.signalValue)} | ${cell(signal.content.textBasis)} | ${cell(linkedSourceRows)} | ${cell(linkedVisualLabels)} | ${cell(signal.content.requiresEngineeringReview)} |`);
  }
}

function renderModelReferenceInterpretation(lines, worksheet, signals) {
  const snapshotRowBySource = new Map(worksheet.contextSnapshot.rows.map((row) => [
    `${row.tableId}\u0000${row.sourceRow}`,
    row,
  ]));
  const contributorBySource = new Map(worksheet.sections.majorContributors.items.map((item) => [
    `${item.source.tableId}\u0000${item.source.sourceRow}`,
    item,
  ]));

  lines.push(
    "",
    "#### 模型图文联合参考解读",
    "",
    "> 本区域由模型生成，可能存在幻觉、标签误配或遗漏；不能替代工程结论，必须由 ME 复核。",
    "",
    "| scope | 模型参考解读 | 关联 Factor | evidenceStatus |",
    "| --- | --- | --- | --- |",
  );
  for (const signal of signals) {
    const linkedFactors = signal.content.linkedSourceRows.map(({ tableId, sourceRow }) => {
      const row = snapshotRowBySource.get(`${tableId}\u0000${sourceRow}`);
      return row?.factorName ?? `${tableId}:${sourceRow}`;
    });
    lines.push(`| ${cell(signal.content.scope)} | ${cell(signal.content.textBasis)} | ${cell(linkedFactors.join("; "))} | ${cell(signal.content.signalValue)} |`);
  }

  lines.push(
    "",
    "受控 Factor 依据（来自确定性计算，不由模型重算）：",
    "",
    "| factor | contribution | nominal | upperTolerance | lowerTolerance | sigmaLevel | source |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
  );
  for (const row of [...worksheet.contextSnapshot.rows].sort((left, right) => {
    const leftContribution = contributorBySource.get(`${left.tableId}\u0000${left.sourceRow}`)?.contributionPercent ?? -1;
    const rightContribution = contributorBySource.get(`${right.tableId}\u0000${right.sourceRow}`)?.contributionPercent ?? -1;
    return rightContribution - leftContribution || left.sourceRow - right.sourceRow;
  })) {
    const contributor = contributorBySource.get(`${row.tableId}\u0000${row.sourceRow}`);
    lines.push(`| ${cell(row.factorName)} | ${cell(contributor === undefined ? null : `${contributor.contributionPercent}%`)} | ${cell(row.nominal)} | ${cell(row.upperTolerance)} | ${cell(row.lowerTolerance)} | ${cell(row.sigmaLevel)} | ${cell(`${row.tableId}:${row.sourceRow}`)} |`);
  }
}

function renderContextSnapshot(lines, worksheet) {
  const rows = [...worksheet.contextSnapshot.rows]
    .sort((left, right) => (
      left.sourceRow - right.sourceRow || left.tableId.localeCompare(right.tableId)
    ));
  lines.push(
    "",
    "#### 分析上下文快照",
    "",
    `dimensionDescription: ${inline(worksheet.contextSnapshot.dimensionDescription)}`,
    "",
    "| tableId | sourceRow | partName | partSubsystem | partCategory | factorName | factorDescription | nominal | upperTolerance | lowerTolerance | sigmaLevel | sourceCells |",
    "| --- | ---: | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |",
  );
  for (const row of rows) {
    const sourceCells = Object.values(row.sourceCells).sort().join("; ");
    lines.push(`| ${cell(row.tableId)} | ${cell(row.sourceRow)} | ${cell(row.partName)} | ${cell(row.partSubsystem)} | ${cell(row.partCategory)} | ${cell(row.factorName)} | ${cell(row.factorDescription)} | ${cell(row.nominal)} | ${cell(row.upperTolerance)} | ${cell(row.lowerTolerance)} | ${cell(row.sigmaLevel)} | ${cell(sourceCells)} |`);
  }
}

function renderTolerance(lines, worksheet, options) {
  const section = worksheet.sections.toleranceChainValidity;
  const facts = worksheet.statements.filter((statement) => (
    statement.type === "FACT" && statement.section === "tolerance-chain-validity"
  ));
  const signals = worksheet.statements.filter((statement) => (
    statement.type === "SIGNAL" && statement.section === "tolerance-chain-validity"
  ));
  const contextSignals = signals.filter((statement) => (
    "signalKind" in statement.content && statement.content.signalKind === "image_text_context_review"
  ));
  const contextual = worksheet.observationVersion === "f5-image-observation-v2";

  lines.push(`章节状态：${code(section.status)}`);
  if (contextual) {
    lines.push("");
    renderScopeMatrix(lines, worksheet, contextSignals);
  } else {
    lines.push(
      "",
      "| scope | status | relatedStatementIds | clarificationIds |",
      "| --- | --- | --- | --- |",
    );
    for (const item of section.items) {
      lines.push(`| ${cell(item.scope)} | ${cell(item.status)} | ${cell(item.relatedStatementIds.join("; "))} | ${cell(item.clarificationIds.join("; "))} |`);
    }
  }

  renderVisualFacts(lines, facts, options, contextual);
  if (contextual) {
    renderModelReferenceInterpretation(lines, worksheet, contextSignals);
    renderContextSignals(lines, contextSignals);
    renderContextSnapshot(lines, worksheet);
  }

  for (const signal of signals.filter((statement) => !contextSignals.includes(statement))) {
    lines.push("", `- SIGNAL ${code(signal.statementId)}：需要 ME 评审`);
    if (signal.content.triggerFactReferences !== undefined) {
      lines.push(`- triggerFactReferences: ${signal.content.triggerFactReferences.map(inline).join("; ")}`);
    }
    for (const evidence of signal.content.observationEvidence ?? []) {
      const reviewLabel = evidence.confidence === "medium" ? "需要 ME 评审；观察证据，非确认事实" : "需要 ME 评审";
      lines.push(`- observationEvidence: scope=${inline(evidence.scope)}; observedValue=${inline(evidence.observedValue)}; confidence=${inline(evidence.confidence)}; reviewStatus=${inline(evidence.reviewStatus)}; ${reviewLabel}; ${imageLink(evidence.imageReference, options)}; visibleBasis=${inline(evidence.visibleBasis)}`);
    }
  }
  renderSupportCards(lines, worksheet, "toleranceChainValidity");
}

function renderCapability(lines, worksheet) {
  const section = worksheet.sections.capabilityVsSpecification;
  lines.push(`章节状态：${code(section.status)}`);
  const statementById = new Map(worksheet.statements.map((statement) => [statement.statementId, statement]));
  const statements = section.statementIds.map((statementId) => statementById.get(statementId));
  const facts = statements.filter((statement) => statement?.type === "FACT");
  const rules = statements.filter((statement) => statement?.type === "RULE");

  if (facts.length > 0) {
    lines.push("", "| 类型 | statementId | metric | value | unit | provenance | detail |", "| --- | --- | --- | ---: | --- | --- | --- |");
    for (const fact of facts) {
      const value = "value" in fact.content ? fact.content.value : fact.content.method;
      lines.push(`| FACT | ${cell(fact.statementId)} | ${cell(fact.content.metric)} | ${cell(value)} | ${cell(fact.content.unit)} | ${cell(fact.content.provenanceKind)} | ${cell(factProvenanceDetail(fact.content))} |`);
    }
  }
  for (const rule of rules) {
    lines.push(
      "",
      `#### RULE ${inline(rule.statementId)}`,
      "",
      "| 字段 | 结构化值 |",
      "| --- | --- |",
      `| entryId | ${cell(rule.content.entryId)} |`,
      `| effectiveVersion | ${cell(rule.content.effectiveVersion)} |`,
      `| applicability | ${cell(applicabilityText(rule.content.applicability))} |`,
      `| evidence | ${cell(evidenceText(rule.content.evidence))} |`,
    );
  }
  renderSupportCards(lines, worksheet, "capabilityVsSpecification");
}

function sourceKey(source) {
  return `${source.worksheetName}\u0000${source.tableId}\u0000${source.sourceRow}`;
}

function renderContributors(lines, worksheet) {
  const section = worksheet.sections.majorContributors;
  lines.push(
    `章节状态：${code(section.status)}`,
    "",
    "| factorReference | factor | contribution | halfTolerance | sigma | unit | drawing | dim | governance | reasonCodes | relatedStatementIds | source | 治理证据 |",
    "| --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  const governanceFacts = worksheet.statements.filter((statement) => (
    statement.type === "FACT" && statement.section === "major-contributors"
      && statement.content.provenanceKind === "f3_governance"
  ));
  const contributorSignals = worksheet.statements.filter((statement) => (
    statement.type === "SIGNAL" && statement.section === "major-contributors"
  ));
  const governanceSignals = contributorSignals.filter((statement) => (
    "signalKind" in statement.content && statement.content.signalKind === "identifier_governance_gap"
  ));
  for (const item of section.items) {
    const governanceFact = governanceFacts.find((fact) => sourceKey(fact.content.source) === sourceKey(item.source));
    const signalIds = governanceFact === undefined ? [] : governanceSignals
      .filter((signal) => signal.content.triggerFactReferences.includes(governanceFact.statementId))
      .map((signal) => signal.statementId);
    const governanceEvidence = governanceFact === undefined
      ? "governance FACT=（缺失）; SIGNAL=（无）"
      : `governance FACT=${inline(governanceFact.statementId)}; SIGNAL=${signalIds.length > 0 ? signalIds.map(inline).join(", ") : "（无）"}`;
    lines.push(`| ${cell(item.factorReference)} | ${cell(item.factorName)} | ${cell(item.contributionPercent)}% | ${cell(item.halfTolerance)} | ${cell(item.sigma)} | ${cell(item.unit)} | ${cell(item.drawingNumber)} | ${cell(item.dimId)} | ${cell(item.governanceStatus)} | ${cell(item.reasonCodes.join("; "))} | ${cell(item.relatedStatementIds.join("; "))} | ${cell(sourceText(item.source))} | ${cell(governanceEvidence)} |`);
  }
  for (const signal of contributorSignals) {
    if ("signalKind" in signal.content) {
      lines.push(
        "",
        `- SIGNAL ${code(signal.statementId)}：需要 ME 评审`,
        `- signalKind: ${code(signal.content.signalKind)}`,
        `- requiresEngineeringReview: ${inline(signal.content.requiresEngineeringReview)}`,
        `- triggerFactReferences: ${signal.content.triggerFactReferences.map(inline).join("; ")}`,
      );
      continue;
    }
    lines.push(
      "",
      `#### SIGNAL ${inline(signal.statementId)}`,
      "",
      "| 字段 | 结构化值 |",
      "| --- | --- |",
      `| entryId | ${cell(signal.content.entryId)} |`,
      `| effectiveVersion | ${cell(signal.content.effectiveVersion)} |`,
      `| applicability | ${cell(applicabilityText(signal.content.applicability))} |`,
      `| evidence | ${cell(evidenceText(signal.content.evidence))} |`,
      `| requiresEngineeringReview | ${cell(signal.content.requiresEngineeringReview)} |`,
      `| relatedFactReferences | ${cell(signal.content.relatedFactReferences.join("; "))} |`,
    );
  }
  renderSupportCards(lines, worksheet, "majorContributors");
}

function renderDelegated(lines, worksheet, section) {
  lines.push(`章节状态：${code(worksheet.sections[section].status)}`, "", "本章节明确 delegated_to_f6；F5 不提供量化结论。" );
  renderSupportCards(lines, worksheet, section);
}

function renderOptions(lines, worksheet) {
  renderDelegated(lines, worksheet, "designOptimizationAndParallelOptions");
  const options = worksheet.statements.filter((statement) => statement.type === "OPTION");
  for (const option of options) {
    lines.push(
      "",
      `#### OPTION ${inline(option.statementId)}：未排序`,
      "",
      "| 字段 | 结构化值 |",
      "| --- | --- |",
      `| entryId | ${cell(option.content.entryId)} |`,
      `| effectiveVersion | ${cell(option.content.effectiveVersion)} |`,
      `| applicability | ${cell(applicabilityText(option.content.applicability))} |`,
      `| evidence | ${cell(evidenceText(option.content.evidence))} |`,
      "| rank | 未排序 |",
    );
  }
}

function renderCompletedWorksheet(lines, worksheet, chapterKey, options) {
  lines.push(`### Worksheet: ${cell(worksheet.worksheetName)}`, "", "页状态：`completed`", "");
  if (chapterKey === "toleranceChainValidity") renderTolerance(lines, worksheet, options);
  if (chapterKey === "capabilityVsSpecification") renderCapability(lines, worksheet);
  if (chapterKey === "majorContributors") renderContributors(lines, worksheet);
  if (chapterKey === "reasonableToleranceRange") renderDelegated(lines, worksheet, chapterKey);
  if (chapterKey === "designOptimizationAndParallelOptions") renderOptions(lines, worksheet);
}

function capabilityMetricValue(worksheet, metric) {
  const statement = worksheet.statements.find((candidate) => (
    candidate.type === "FACT"
    && candidate.content.metric === metric
  ));
  if (statement === undefined) return undefined;
  if ("value" in statement.content) return statement.content.value;
  return statement.content.method;
}

function topContributorName(worksheet) {
  if (worksheet.sections.majorContributors.items.length === 0) return undefined;
  const [top] = [...worksheet.sections.majorContributors.items]
    .sort((left, right) => right.contributionPercent - left.contributionPercent);
  return `${top.factorName} (${top.contributionPercent}%)`;
}

function governanceMissingCount(worksheet) {
  return worksheet.sections.majorContributors.items
    .filter((item) => item.governanceStatus !== "complete")
    .length;
}

function highConfidenceVisualFactCount(worksheet) {
  return worksheet.statements
    .filter((statement) => (
      statement.type === "FACT"
      && statement.section === "tolerance-chain-validity"
      && statement.content.provenanceKind === "image_observation"
      && statement.content.confidence === "high"
    ))
    .length;
}

function meReviewSignals(worksheet) {
  return worksheet.statements
    .filter((statement) => statement.type === "SIGNAL")
    .filter((statement) => {
      if ("requiresEngineeringReview" in statement.content) {
        return statement.content.requiresEngineeringReview === true;
      }
      if (statement.content.observationEvidence !== undefined) {
        return statement.content.observationEvidence.some((item) => item.reviewStatus === "unreviewed");
      }
      return false;
    });
}

function signalKeyText(signal) {
  if ("signalValue" in signal.content) return signal.content.signalValue;
  if ("signalKind" in signal.content) return signal.content.signalKind;
  return signal.statementId;
}

function worksheetNextStep(worksheet) {
  if (worksheet.status === "input_rejected") return "Repair upstream artifact identity and rerun F5.";
  const governanceMissing = governanceMissingCount(worksheet);
  const clarifications = worksheet.clarifications.length;
  if (governanceMissing > 0 || clarifications > 0) {
    return "ME review governance gaps and open clarifications before F6.";
  }
  return "Pass worksheet package to F6 quantitative decision flow.";
}

function renderWorksheetSummaryRow(lines, worksheet, options) {
  if (worksheet.status === "input_rejected") {
    lines.push(`| ${cell(worksheet.worksheetName)} | ${cell(worksheet.status)} | （缺失） | （缺失） | （缺失） | （缺失） | （缺失） | ${cell(worksheetNextStep(worksheet))} |`);
    return;
  }
  const cpk = capabilityMetricValue(worksheet, "cpk");
  const targetCpk = capabilityMetricValue(worksheet, "target_cpk");
  lines.push(`| ${cell(worksheet.worksheetName)} | ${cell(worksheet.status)} | ${cell(cpk)} | ${cell(targetCpk)} | ${cell(topContributorName(worksheet))} | ${imageLink(worksheet.imageReference, options)} | ${cell(`missing=${governanceMissingCount(worksheet)}`)} | ${cell(worksheetNextStep(worksheet))} |`);
}

function renderWorksheetCompactCard(lines, worksheet, options) {
  lines.push("", `### Worksheet: ${cell(worksheet.worksheetName)}`);
  if (worksheet.status === "input_rejected") {
    lines.push(
      "",
      `- status: ${code(worksheet.status)}`,
      `- image evidence: （缺失）`,
      `- capability/spec: （缺失）`,
      `- top contributors: （缺失）`,
      `- high-confidence visual FACT: 0`,
      `- ME-review SIGNAL count/key text: 0 / （无）`,
      `- governance missing count: （缺失）`,
      `- clarification count: 0`,
      `- next step: ${inline(worksheetNextStep(worksheet))}`,
    );
    return;
  }

  const cpk = capabilityMetricValue(worksheet, "cpk");
  const targetCpk = capabilityMetricValue(worksheet, "target_cpk");
  const topContributor = topContributorName(worksheet);
  const highConfidenceFacts = highConfidenceVisualFactCount(worksheet);
  const signals = meReviewSignals(worksheet);
  const signalText = signals.length > 0
    ? signals.slice(0, 2).map(signalKeyText).map(inline).join("; ")
    : "（无）";

  lines.push(
    "",
    `- status: ${code(worksheet.status)}`,
    `- image evidence: ${imageLink(worksheet.imageReference, options)}`,
    `- capability/spec: cpk=${inline(cpk)}; target_cpk=${inline(targetCpk)}`,
    `- top contributors: ${inline(topContributor)}`,
    `- high-confidence visual FACT: ${highConfidenceFacts}`,
    `- ME-review SIGNAL count/key text: ${signals.length} / ${signalText}`,
    `- governance missing count: ${governanceMissingCount(worksheet)}`,
    `- clarification count: ${worksheet.clarifications.length}`,
    `- next step: ${inline(worksheetNextStep(worksheet))}`,
  );
}

function renderEngineeringSummary(lines, parsed, options) {
  lines.push(
    "",
    "## 工程审查摘要",
    "",
    "- F5 owned: image evidence, capability/spec interpretation, contributors",
    "- Delegated to F6: quantified tolerance range, optimization scenarios, ROI, final engineering decision",
    "",
    "| Worksheet | Status | Cpk | Target Cpk | Top Contributor | Image Evidence | Governance | Next Step |",
    "| --- | --- | ---: | ---: | --- | --- | --- | --- |",
  );
  for (const worksheet of parsed.worksheets) {
    renderWorksheetSummaryRow(lines, worksheet, options);
  }
  for (const worksheet of parsed.worksheets) {
    renderWorksheetCompactCard(lines, worksheet, options);
  }
}

function contextSignalsForWorksheet(worksheet) {
  return worksheet.statements.filter((statement) => (
    statement.type === "SIGNAL"
    && "signalKind" in statement.content
    && statement.content.signalKind === "image_text_context_review"
  ));
}

function linkedFactorNames(worksheet, signal) {
  if (worksheet.contextSnapshot === undefined) return [];
  const rows = new Map(worksheet.contextSnapshot.rows.map((row) => [
    `${row.tableId}\u0000${row.sourceRow}`,
    row.factorName,
  ]));
  return signal.content.linkedSourceRows.map(({ tableId, sourceRow }) => (
    rows.get(`${tableId}\u0000${sourceRow}`) ?? `${tableId}:${sourceRow}`
  ));
}

function isInternalOnlyClarification(clarification) {
  const controlledText = [
    clarification.clarificationId,
    ...(clarification.missingEvidence ?? []),
  ].join(" ");
  return controlledText.includes("datum_chain") || controlledText.includes("stack_start");
}

function renderInterpretationWorksheet(lines, worksheet) {
  lines.push("", `## Worksheet 解读：${cell(worksheet.worksheetName)}`);
  if (worksheet.status === "input_rejected") {
    lines.push("", "输入证据未通过验证，无法生成工程解读。" );
    return;
  }

  const contextSignals = contextSignalsForWorksheet(worksheet);
  const signalByScope = new Map(contextSignals.map((signal) => [signal.content.scope, signal]));
  const loopSignal = signalByScope.get("tolerance_loop_closure");
  const directionSignal = signalByScope.get("direction");
  const cpk = capabilityMetricValue(worksheet, "cpk");
  const targetCpk = capabilityMetricValue(worksheet, "target_cpk");
  const rssSigma = capabilityMetricValue(worksheet, "rss_sigma");
  const yieldValue = capabilityMetricValue(worksheet, "yield");
  const contributors = [...worksheet.sections.majorContributors.items]
    .sort((left, right) => right.contributionPercent - left.contributionPercent)
    .slice(0, 3);
  const conflicts = contextSignals.filter((signal) => signal.content.signalValue === "indicated_conflict");
  const reviewSignals = [loopSignal, directionSignal]
    .filter((signal) => signal !== undefined && signal.content.signalValue !== "indicated_conflict");

  lines.push(
    "",
    "### 1. 公差链与 Target 理解",
    "",
    worksheet.contextSnapshot === undefined
      ? "未提供可验证的图文上下文，公差链图片关系未评估。"
      : `本分析对象为 ${inline(worksheet.contextSnapshot.dimensionDescription)}。${loopSignal === undefined ? "未形成公差链闭合观察。" : inline(loopSignal.content.textBasis)}`,
    "",
    "### 2. 统计与能力结果",
    "",
    `确定性计算结果：Cpk=${inline(cpk)}，Target Cpk=${inline(targetCpk)}，RSS 1σ=${inline(rssSigma)}，预测 Yield=${inline(yieldValue)}。`,
    Number.isFinite(cpk) && Number.isFinite(targetCpk)
      ? `Cpk ${cpk >= targetCpk ? "达到" : "未达到"}当前 Target Cpk；该判断来自受控规格与计算结果，不由图片推断。`
      : "缺少完整规格或能力结果，不能给出 Cpk 达标判断。",
    "",
    "### 3. 主要贡献与工程风险",
    "",
  );
  if (contributors.length === 0) {
    lines.push("未形成可验证的主要贡献因子排序。" );
  } else {
    lines.push(`主要贡献集中在 ${contributors.map((item) => `${inline(item.factorName)} (${inline(item.contributionPercent)}%)`).join("、")}。贡献率表示方差占比，不等于已确认的物理根因或供应商责任。`);
  }

  lines.push("", "### 4. 图片与 Table 一致性异常", "");
  if (worksheet.observationVersion !== "f5-image-observation-v2") {
    lines.push("图片与 Table 的一致性未评估。" );
  } else if (conflicts.length === 0) {
    lines.push("未发现由当前受控图文证据直接证明的冲突；这不代表图片已完成工程确认。" );
  } else {
    lines.push(`发现 ${conflicts.length} 项直接可比异常：`);
    for (const signal of conflicts) {
      const factors = linkedFactorNames(worksheet, signal);
      lines.push(`- ${inline(signal.content.textBasis)} 关联 Factor：${factors.length > 0 ? factors.map(inline).join("；") : "未可靠映射"}。证据状态：${code(signal.content.signalValue)}；需要 ME 复核。`);
    }
  }

  lines.push("", "### 5. 必须澄清的问题", "");
  const questions = [
    ...reviewSignals.map((signal) => `${signal.content.textBasis}（${signal.content.signalValue}）`),
    ...worksheet.clarifications
      .filter((item) => !isInternalOnlyClarification(item))
      .map((item) => item.questionForReviewer),
  ];
  if (questions.length === 0) {
    lines.push("当前没有新增澄清项。" );
  } else {
    for (const question of [...new Set(questions)]) lines.push(`- ${inline(question)}`);
  }
  if (worksheet.observationVersion === "f5-image-observation-v2") {
    lines.push("", "> 模型图文解读可能存在幻觉、标签误配或遗漏；不能替代工程结论，必须由 ME 复核。" );
  }
}

function renderInterpretationNarrative(lines, parsed) {
  lines.push("", "## TA 解读总结与异常发现");
  for (const worksheet of parsed.worksheets) renderInterpretationWorksheet(lines, worksheet);
}

export function renderF5Report(report, { outputRoot, f1ArtifactRoot, publishRoot } = {}) {
  let parsed;
  try {
    parsed = f5DataInterpretationResultSchema.parse(report);
  } catch {
    throw new Error("Invalid F5 report.");
  }

  const options = { outputRoot, f1ArtifactRoot, publishRoot };
  const lines = [
    "# Feature 5 数据解释报告",
    "",
    `根状态：${code(parsed.status)}`,
    `Worksheet 数量：${parsed.summary.worksheetCount}`,
    "",
    "证据分类：",
    ...["INPUT_FACT", "CALCULATED", "DERIVED", "ASSUMPTION", "INFERENCE", "MISSING"]
      .map((type) => `- ${evidenceLabel(type)}`),
  ];

  renderEngineeringSummary(lines, parsed, options);
  renderInterpretationNarrative(lines, parsed);
  lines.push("", "## 审计附录");

  for (const chapter of CHAPTERS) {
    lines.push("", chapter.title, "");
    for (const worksheet of parsed.worksheets) {
      if (worksheet.status === "input_rejected") renderRejectedWorksheet(lines, worksheet);
      else renderCompletedWorksheet(lines, worksheet, chapter.key, options);
      lines.push("");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}