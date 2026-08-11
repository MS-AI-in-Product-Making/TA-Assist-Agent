import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { f5DataInterpretationResultSchema } from "../packages/contracts/dist/contracts.js";

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
    `sourceAlias=${inline(evidence.sourceAlias)}`,
    `sheetName=${inline(evidence.sheetName)}`,
    `sourceRange=${inline(evidence.sourceRange)}`,
    `sourceFileHash=${inline(evidence.sourceFileHash)}`,
  ].join("; ");
}

function renderRejectedWorksheet(lines, worksheet) {
  lines.push(`### Worksheet: ${cell(worksheet.worksheetName)}`, "", "页状态：`input_rejected`", "");
  lines.push("| reasonCode | message |", "| --- | --- |");
  for (const issue of worksheet.issues) {
    lines.push(`| ${cell(issue.reasonCode)} | ${cell(issue.message)} |`);
  }
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

function renderTolerance(lines, worksheet, options) {
  lines.push(`章节状态：${code(worksheet.sections.toleranceChainValidity.status)}`);
  const facts = worksheet.statements.filter((statement) => (
    statement.type === "FACT" && statement.section === "tolerance-chain-validity"
  ));
  const signals = worksheet.statements.filter((statement) => (
    statement.type === "SIGNAL" && statement.section === "tolerance-chain-validity"
  ));

  if (facts.length > 0) {
    lines.push("", "| 类型 | statementId | scope | observedValue | confidence | reviewStatus | image | visibleBasis |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const fact of facts) {
      lines.push(`| FACT | ${cell(fact.statementId)} | ${cell(fact.content.scope)} | ${cell(fact.content.observedValue)} | ${cell(fact.content.confidence)} | ${cell(fact.content.reviewStatus)} | ${imageLink(fact.content.imageReference, options)} | ${cell(fact.content.visibleBasis)} |`);
    }
  }

  for (const signal of signals) {
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
    lines.push("", "| 类型 | statementId | metric | value | unit | provenance |", "| --- | --- | --- | ---: | --- | --- |");
    for (const fact of facts) {
      const value = "value" in fact.content ? fact.content.value : "（缺失）";
      lines.push(`| FACT | ${cell(fact.statementId)} | ${cell(fact.content.metric)} | ${cell(value)} | ${cell(fact.content.unit)} | ${cell(fact.content.provenanceKind)} |`);
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
  lines.push(`章节状态：${code(section.status)}`, "", "| factorReference | factor | contribution | drawing | dim | governance | source | 治理证据 |", "| --- | --- | ---: | --- | --- | --- | --- | --- |");
  const governanceFacts = worksheet.statements.filter((statement) => (
    statement.type === "FACT" && statement.section === "major-contributors"
      && statement.content.provenanceKind === "f3_governance"
  ));
  const governanceSignals = worksheet.statements.filter((statement) => (
    statement.type === "SIGNAL" && statement.section === "major-contributors"
      && "signalKind" in statement.content && statement.content.signalKind === "identifier_governance_gap"
  ));
  for (const item of section.items) {
    const governanceFact = governanceFacts.find((fact) => sourceKey(fact.content.source) === sourceKey(item.source));
    const signalIds = governanceFact === undefined ? [] : governanceSignals
      .filter((signal) => signal.content.triggerFactReferences.includes(governanceFact.statementId))
      .map((signal) => signal.statementId);
    const governanceEvidence = governanceFact === undefined
      ? "governance FACT=（缺失）; SIGNAL=（无）"
      : `governance FACT=${inline(governanceFact.statementId)}; SIGNAL=${signalIds.length > 0 ? signalIds.map(inline).join(", ") : "（无）"}`;
    lines.push(`| ${cell(item.factorReference)} | ${cell(item.factorName)} | ${cell(item.contributionPercent)}% | ${cell(item.drawingNumber)} | ${cell(item.dimId)} | ${cell(item.governanceStatus)} | ${cell(sourceText(item.source))} | ${cell(governanceEvidence)} |`);
  }
  for (const signal of governanceSignals) {
    lines.push(
      "",
      `- SIGNAL ${code(signal.statementId)}：需要 ME 评审`,
      `- triggerFactReferences: ${signal.content.triggerFactReferences.map(inline).join("; ")}`,
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
  ];
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