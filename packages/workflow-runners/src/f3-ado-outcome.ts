import { existsSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import {
  drawingGovernanceResultV2Schema,
  drawingGovernanceResultV3Schema,
  type DrawingGovernanceResultV2,
  type DrawingGovernanceResultV3,
} from "@ai-assist/contracts";

import { renderF3AdoHistoryHtml } from "./f3-ado-html.js";
import { renderF3AdoReminder } from "./f3.js";

const SUPPORTED_STATUSES = new Set(["not_requested", "blocked", "failed", "updated"]);
const CONTROLLED_REASON_CODES = new Set([
  "organization_not_found",
  "project_not_found",
  "work_item_type_not_found",
  "work_item_not_found",
  "surface_mcp_capability_missing",
  "surface_mcp_unavailable",
  "surface_mcp_authentication_failed",
  "surface_mcp_comment_body_unsupported",
  "user_declined_write",
  "write_verification_failed",
]);
const LOCK_FILE_NAME = ".f3-ado-reminder.lock";

interface F3AdoFsOps {
  readonly existsSync: typeof existsSync;
  readonly readFileSync: typeof readFileSync;
  readonly renameSync: typeof renameSync;
  readonly rmSync: typeof rmSync;
  readonly statSync: typeof statSync;
  readonly writeFileSync: typeof writeFileSync;
}

interface AdoOutcomeInput {
  readonly status?: unknown;
  readonly workItemReference?: unknown;
  readonly reasonCode?: unknown;
}

export interface PersistF3AdoTraceabilityInput {
  readonly f3Root: string;
  readonly reportPath?: string;
  readonly receipt: {
    readonly operation: "created" | "updated";
    readonly targetIdentity: {
      readonly organization: string;
      readonly project: string;
      readonly workItemId: number;
    };
    readonly verifiedAt: string;
  };
}

export interface PersistF3AdoTargetValidationInput {
  readonly f3Root: string;
  readonly reportPath?: string;
  readonly targetIdentity: {
    readonly organization: string;
    readonly project: string;
    readonly workItemId: number;
  };
  readonly verifiedAt: string;
}

export interface PublishF3AdoTraceabilityArtifactsInput extends PersistF3AdoTraceabilityInput {
  readonly __internalFsOps?: Partial<F3AdoFsOps>;
  readonly __internalFailPromotionAt?: number;
  readonly __internalFailWithPath?: string;
}

export interface PublishF3AdoTargetValidationArtifactsInput extends PersistF3AdoTargetValidationInput {
  readonly __internalFsOps?: Partial<F3AdoFsOps>;
  readonly __internalFailPromotionAt?: number;
  readonly __internalFailWithPath?: string;
}

export interface WriteF3AdoReminderArtifactsInput {
  readonly f3OutputRoot: string;
  readonly adoOutcome?: AdoOutcomeInput;
  readonly reportPath?: string;
  readonly receipt?: PersistF3AdoTraceabilityInput["receipt"];
  readonly targetValidation?: Pick<PersistF3AdoTargetValidationInput, "targetIdentity" | "verifiedAt">;
  readonly __internalFsOps?: Partial<F3AdoFsOps>;
  readonly __internalFailPromotionAt?: number;
  readonly __internalFailWithPath?: string;
}

export interface F3AdoReminderArtifactsResult {
  readonly reminderPath: string;
  readonly historyHtmlPath: string;
  readonly report: DrawingGovernanceResultV2 | DrawingGovernanceResultV3;
}

type AcceptedDrawingGovernanceResultV3 = Exclude<DrawingGovernanceResultV3, { status: "input_rejected" }>;

export function persistF3AdoTargetValidation(input: PersistF3AdoTargetValidationInput): AcceptedDrawingGovernanceResultV3 {
  if (input.reportPath === undefined || input.reportPath.trim().length === 0) {
    throw new Error("Feature 3 current report path is required for structured ADO target validation.");
  }
  const f3Root = path.resolve(input.f3Root);
  const reportPath = path.resolve(input.reportPath);
  const reportRelativePath = path.relative(f3Root, reportPath);
  if (reportRelativePath.startsWith("..") || path.isAbsolute(reportRelativePath)) {
    throw new Error("Feature 3 report path is outside the current writable root.");
  }
  if (!Number.isFinite(Date.parse(input.verifiedAt))) throw new Error("Surface target verifiedAt is invalid.");

  const source = JSON.parse(readFileSync(reportPath, "utf8")) as unknown;
  const existingV3 = drawingGovernanceResultV3Schema.safeParse(source);
  if (existingV3.success) {
    if (existingV3.data.status === "input_rejected") {
      throw new Error("Cannot persist ADO target validation for an input_rejected Feature 3 report.");
    }
    const ado = existingV3.data.ado;
    if (ado.status === "target_validated"
      && ado.organization === input.targetIdentity.organization
      && ado.project === input.targetIdentity.project
      && ado.workItemId === input.targetIdentity.workItemId) return existingV3.data;
    throw new Error("Current Feature 3 v3 traceability does not match the validated Surface target.");
  }

  const legacy = drawingGovernanceResultV2Schema.parse(source);
  if (legacy.status === "input_rejected") {
    throw new Error("Cannot persist ADO target validation for an input_rejected Feature 3 report.");
  }
  const report = drawingGovernanceResultV3Schema.parse({
    ...legacy,
    modelVersion: "drawing-governance-v3",
    ado: {
      status: "target_validated",
      organization: input.targetIdentity.organization,
      project: input.targetIdentity.project,
      workItemId: input.targetIdentity.workItemId,
    },
  });
  if (report.status === "input_rejected") {
    throw new Error("Cannot persist ADO target validation for an input_rejected Feature 3 report.");
  }
  return report;
}

export function persistF3AdoTraceability(input: PersistF3AdoTraceabilityInput): AcceptedDrawingGovernanceResultV3 {
  if (input.reportPath === undefined || input.reportPath.trim().length === 0) {
    throw new Error("Feature 3 current report path is required for structured ADO receipt persistence.");
  }
  const f3Root = path.resolve(input.f3Root);
  const reportPath = path.resolve(input.reportPath);
  const reportRelativePath = path.relative(f3Root, reportPath);
  if (reportRelativePath.startsWith("..") || path.isAbsolute(reportRelativePath)) {
    throw new Error("Feature 3 report path is outside the current writable root.");
  }
  const source = JSON.parse(readFileSync(reportPath, "utf8")) as unknown;
  const existingV3 = drawingGovernanceResultV3Schema.safeParse(source);
  if (existingV3.success) {
    if (existingV3.data.status === "input_rejected") {
      throw new Error("Cannot persist ADO traceability for an input_rejected Feature 3 report.");
    }
    if (matchesReceipt(existingV3.data, input.receipt)) return existingV3.data;
    throw new Error("Current Feature 3 v3 traceability does not match the verified Surface receipt.");
  }

  const legacy = drawingGovernanceResultV2Schema.parse(source);
  if (legacy.status === "input_rejected") {
    throw new Error("Cannot persist ADO traceability for an input_rejected Feature 3 report.");
  }
  if (!Number.isFinite(Date.parse(input.receipt.verifiedAt))) {
    throw new Error("Surface readback verifiedAt is invalid.");
  }

  const report = drawingGovernanceResultV3Schema.parse({
    ...legacy,
    modelVersion: "drawing-governance-v3",
    ado: {
      status: "updated",
      operation: input.receipt.operation,
      organization: input.receipt.targetIdentity.organization,
      project: input.receipt.targetIdentity.project,
      workItemId: input.receipt.targetIdentity.workItemId,
    },
  });
  if (report.status === "input_rejected") {
    throw new Error("Cannot persist ADO traceability for an input_rejected Feature 3 report.");
  }
  return report;
}

export function publishF3AdoTraceabilityArtifacts(input: PublishF3AdoTraceabilityArtifactsInput): F3AdoReminderArtifactsResult {
  return writeF3AdoReminderArtifacts({
    f3OutputRoot: input.f3Root,
    receipt: input.receipt,
    ...(input.reportPath !== undefined ? { reportPath: input.reportPath } : {}),
    ...(input.__internalFsOps !== undefined ? { __internalFsOps: input.__internalFsOps } : {}),
    ...(input.__internalFailPromotionAt !== undefined ? { __internalFailPromotionAt: input.__internalFailPromotionAt } : {}),
    ...(input.__internalFailWithPath !== undefined ? { __internalFailWithPath: input.__internalFailWithPath } : {}),
  });
}

export function publishF3AdoTargetValidationArtifacts(input: PublishF3AdoTargetValidationArtifactsInput): F3AdoReminderArtifactsResult {
  return writeF3AdoReminderArtifacts({
    f3OutputRoot: input.f3Root,
    targetValidation: { targetIdentity: input.targetIdentity, verifiedAt: input.verifiedAt },
    ...(input.reportPath !== undefined ? { reportPath: input.reportPath } : {}),
    ...(input.__internalFsOps !== undefined ? { __internalFsOps: input.__internalFsOps } : {}),
    ...(input.__internalFailPromotionAt !== undefined ? { __internalFailPromotionAt: input.__internalFailPromotionAt } : {}),
    ...(input.__internalFailWithPath !== undefined ? { __internalFailWithPath: input.__internalFailWithPath } : {}),
  });
}

export function writeF3AdoReminderArtifacts(input: WriteF3AdoReminderArtifactsInput): F3AdoReminderArtifactsResult {
  const fsOps = createFsOps(input.__internalFsOps);
  const rootArg = ensureSafePathInput(input.f3OutputRoot, "Feature 3 output directory");
  const resolvedRoot = path.resolve(rootArg);
  if (!fsOps.existsSync(resolvedRoot) || !fsOps.statSync(resolvedRoot).isDirectory()) {
    throw new Error("Feature 3 output directory is missing or invalid.");
  }

  const transactionLock = acquireTransactionLock(resolvedRoot, fsOps);
  try {
    if (input.receipt !== undefined) {
      const reportJsonPath = resolveExplicitCurrentReportPath(resolvedRoot, input.reportPath, fsOps);
      const report = persistF3AdoTraceability({ f3Root: resolvedRoot, reportPath: reportJsonPath, receipt: input.receipt });
      const reminderPath = path.join(resolvedRoot, "Feature3-ADO-Reminder.md");
      const historyHtmlPath = path.join(resolvedRoot, "Feature3-ADO-History.html");
      const reportMdPath = path.join(resolvedRoot, "Feature3-Report.md");
      const renderingReport = toLegacyAdoRenderingReport(report);

      persistArtifactsAtomically([
        { targetPath: reminderPath, content: renderF3AdoReminder(renderingReport) },
        { targetPath: historyHtmlPath, content: renderF3AdoHistoryHtml(renderingReport) },
        { targetPath: reportJsonPath, content: `${JSON.stringify(report, null, 2)}\n` },
        { targetPath: reportMdPath, content: renderPublishedF3Report(renderingReport, resolvedRoot) },
      ], fsOps, promotionOptions(input));

      return { reminderPath, historyHtmlPath, report };
    }

    if (input.targetValidation !== undefined) {
      const reportJsonPath = resolveExplicitCurrentReportPath(resolvedRoot, input.reportPath, fsOps);
      const report = persistF3AdoTargetValidation({
        f3Root: resolvedRoot,
        reportPath: reportJsonPath,
        targetIdentity: input.targetValidation.targetIdentity,
        verifiedAt: input.targetValidation.verifiedAt,
      });
      const reminderPath = path.join(resolvedRoot, "Feature3-ADO-Reminder.md");
      const historyHtmlPath = path.join(resolvedRoot, "Feature3-ADO-History.html");
      const reportMdPath = path.join(resolvedRoot, "Feature3-Report.md");
      const renderingReport = toLegacyAdoRenderingReport(report);

      persistArtifactsAtomically([
        { targetPath: reminderPath, content: renderF3AdoReminder(renderingReport) },
        { targetPath: historyHtmlPath, content: renderF3AdoHistoryHtml(renderingReport) },
        { targetPath: reportJsonPath, content: `${JSON.stringify(report, null, 2)}\n` },
        { targetPath: reportMdPath, content: renderPublishedF3Report(renderingReport, resolvedRoot) },
      ], fsOps, promotionOptions(input));

      return { reminderPath, historyHtmlPath, report };
    }

    const loaded = loadReportFromOutputRoot(resolvedRoot, fsOps);
    const report = drawingGovernanceResultV2Schema.parse({
      ...loaded.report,
      ado: validateAdoOutcome(input.adoOutcome),
    });

    persistArtifactsAtomically([
      { targetPath: loaded.reminderPath, content: renderF3AdoReminder(report) },
      { targetPath: loaded.historyHtmlPath, content: renderF3AdoHistoryHtml(report) },
      { targetPath: loaded.reportJsonPath, content: `${JSON.stringify(report, null, 2)}\n` },
      { targetPath: loaded.reportMdPath, content: renderPublishedF3Report(report, resolvedRoot) },
    ], fsOps, promotionOptions(input));

    return { reminderPath: loaded.reminderPath, historyHtmlPath: loaded.historyHtmlPath, report };
  } finally {
    transactionLock.release();
  }
}

function matchesReceipt(
  report: DrawingGovernanceResultV3,
  receipt: PersistF3AdoTraceabilityInput["receipt"],
): boolean {
  return report.status !== "input_rejected"
    && report.ado.status === "updated"
    && report.ado.operation === receipt.operation
    && report.ado.organization === receipt.targetIdentity.organization
    && report.ado.project === receipt.targetIdentity.project
    && report.ado.workItemId === receipt.targetIdentity.workItemId;
}

function createFsOps(overrides: Partial<F3AdoFsOps> = {}): F3AdoFsOps {
  return {
    existsSync,
    readFileSync,
    renameSync,
    rmSync,
    statSync,
    writeFileSync,
    ...overrides,
  };
}

function ensureSafePathInput(value: unknown, description: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${description} is required.`);
  const segments = value.trim().split(/[\\/]+/).filter(Boolean);
  if (segments.includes("..")) throw new Error(`${description} is unsafe.`);
  return value.trim();
}

function isOutsideRoot(root: string, candidatePath: string): boolean {
  const relativePath = path.relative(root, candidatePath);
  return relativePath === ".." || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath);
}

function resolveExplicitCurrentReportPath(resolvedRoot: string, reportPath: unknown, fsOps: F3AdoFsOps): string {
  if (typeof reportPath !== "string" || reportPath.trim().length === 0) {
    throw new Error("Feature 3 current report path is required for structured ADO receipt persistence.");
  }
  const resolvedReportPath = path.resolve(ensureSafePathInput(reportPath, "Feature 3 current report path"));
  if (isOutsideRoot(resolvedRoot, resolvedReportPath)) {
    throw new Error("Feature 3 current report path is outside the current writable root.");
  }
  if (!fsOps.existsSync(resolvedReportPath)) throw new Error("Feature 3 current report path is missing.");
  return resolvedReportPath;
}

function readLockPayload(lockPath: string, fsOps: F3AdoFsOps): { readonly ownerToken: string; readonly createdAt: string } | null {
  try {
    const raw = String(fsOps.readFileSync(lockPath, "utf8") ?? "").trim();
    if (raw.length === 0) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const ownerToken = typeof record.ownerToken === "string" ? record.ownerToken : undefined;
    const createdAt = typeof record.createdAt === "string" ? record.createdAt : undefined;
    if (!ownerToken || !createdAt) return null;
    return { ownerToken, createdAt };
  } catch {
    return null;
  }
}

function acquireTransactionLock(resolvedRoot: string, fsOps: F3AdoFsOps): { readonly release: () => void } {
  const ownerToken = `${process.pid}.${randomUUID()}`;
  const lockPath = path.join(resolvedRoot, LOCK_FILE_NAME);
  const lockPayload = `${JSON.stringify({ lockVersion: "v1", ownerToken, createdAt: new Date().toISOString() })}\n`;

  try {
    fsOps.writeFileSync(lockPath, lockPayload, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
    if (code === "EEXIST") {
      const current = readLockPayload(lockPath, fsOps);
      const ageHint = current?.createdAt ? ` (lock createdAt=${current.createdAt})` : "";
      throw new Error(`Feature 3 reminder persistence is already in progress for this output directory${ageHint}.`);
    }
    throw error;
  }

  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      try {
        if (!fsOps.existsSync(lockPath)) return;
        const current = readLockPayload(lockPath, fsOps);
        if (!current || current.ownerToken !== ownerToken) return;
        fsOps.rmSync(lockPath);
      } catch {
        // Preserve caller outcome. Lock cleanup is best effort and owner-guarded.
      }
    },
  };
}

function loadReportFromOutputRoot(f3OutputRoot: string, fsOps: F3AdoFsOps) {
  const resolvedRoot = path.resolve(ensureSafePathInput(f3OutputRoot, "Feature 3 output directory"));
  if (!fsOps.existsSync(resolvedRoot) || !fsOps.statSync(resolvedRoot).isDirectory()) {
    throw new Error("Feature 3 output directory is missing or invalid.");
  }

  const reportJsonPath = path.join(resolvedRoot, "Feature3-Report.json");
  if (!fsOps.existsSync(reportJsonPath)) throw new Error("Feature 3 report artifact is missing.");

  let decoded: unknown;
  try {
    decoded = JSON.parse(String(fsOps.readFileSync(reportJsonPath, "utf8")));
  } catch {
    throw new Error("Feature 3 report artifact is invalid.");
  }

  const parsed = drawingGovernanceResultV2Schema.safeParse(decoded);
  if (!parsed.success) throw new Error("Feature 3 report artifact shape is invalid.");
  if (parsed.data.status === "input_rejected") throw new Error("Cannot persist ADO outcome for input_rejected report.");

  return {
    root: resolvedRoot,
    reportJsonPath,
    reportMdPath: path.join(resolvedRoot, "Feature3-Report.md"),
    reminderPath: path.join(resolvedRoot, "Feature3-ADO-Reminder.md"),
    historyHtmlPath: path.join(resolvedRoot, "Feature3-ADO-History.html"),
    report: parsed.data,
  };
}

function validateAdoOutcome(adoOutcome: AdoOutcomeInput | undefined) {
  if (typeof adoOutcome !== "object" || adoOutcome === null) throw new Error("ADO outcome is required.");
  const status = typeof adoOutcome.status === "string" ? adoOutcome.status.trim() : "";
  if (!SUPPORTED_STATUSES.has(status)) throw new Error("ADO status is unsupported for this utility.");

  const workItemReference = adoOutcome.workItemReference === undefined
    ? undefined
    : String(adoOutcome.workItemReference).trim();
  if (workItemReference !== undefined && workItemReference.length === 0) {
    throw new Error("ADO work item reference is invalid.");
  }

  const reasonCode = adoOutcome.reasonCode === undefined
    ? undefined
    : String(adoOutcome.reasonCode).trim();
  if (reasonCode !== undefined && !CONTROLLED_REASON_CODES.has(reasonCode)) {
    throw new Error("ADO reason code is unsupported.");
  }

  if (status === "not_requested" && (workItemReference !== undefined || reasonCode !== undefined)) {
    throw new Error("not_requested status cannot include work item reference or reason code.");
  }
  if (status === "updated" && reasonCode !== undefined) {
    throw new Error("updated status cannot include reason code.");
  }
  if ((status === "blocked" || status === "failed") && reasonCode === undefined) {
    throw new Error("blocked/failed status requires a controlled reason code.");
  }

  const preValidationReasonCodes = new Set(["surface_mcp_unavailable", "surface_mcp_authentication_failed"]);
  if (workItemReference !== undefined && reasonCode !== undefined && preValidationReasonCodes.has(reasonCode)) {
    throw new Error("Pre-validation Surface MCP failures cannot include work item reference.");
  }

  return {
    status,
    ...(workItemReference !== undefined ? { workItemReference } : {}),
    ...(reasonCode !== undefined ? { reasonCode } : {}),
  };
}

function toLegacyAdoRenderingReport(report: AcceptedDrawingGovernanceResultV3): DrawingGovernanceResultV2 {
  const targetValidated = report.ado.status === "target_validated";
  return drawingGovernanceResultV2Schema.parse({
    ...report,
    modelVersion: "drawing-governance-v2",
    ado: {
      status: targetValidated ? "confirmation_required" : report.ado.status,
      ...(report.ado.status === "updated" || targetValidated ? { workItemReference: String(report.ado.workItemId) } : {}),
      ...(report.ado.status === "blocked" || report.ado.status === "failed" ? { reasonCode: report.ado.reasonCode } : {}),
    },
  });
}

const F3_REPORT_TABLE_HEADER = "| Device Level Dim | Dimension Description | Part / Subsystem | Drawing Number | Dim ID | Factor Description | Nominal | Upper Tolerance (+) | Lower Tolerance (-) | σ Level | Source Evidence |";
const F3_REPORT_TABLE_SEPARATOR = "| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |";
const WINDOWS_ABSOLUTE_PATH_PATTERN = /[A-Za-z]:(?:\\[^\\/:*?"<>|\r\n]+)+(?=$|[\s"'|),;\]])/g;
const WINDOWS_ESCAPED_ABSOLUTE_PATH_PATTERN = /[A-Za-z]:(?:\\\\[^\\/:*?"<>|\r\n]+)+(?=$|[\s"'|),;\]])/g;

function redactF3ReportText(value: unknown): string {
  return String(value)
    .replace(WINDOWS_ESCAPED_ABSOLUTE_PATH_PATTERN, "[redacted-local-path]")
    .replace(WINDOWS_ABSOLUTE_PATH_PATTERN, "[redacted-local-path]")
    .replace(/Authorization\s*[:=]\s*(?:Bearer\s+)?[^\s|"'`),;\]]+/gi, "Authorization: [redacted]");
}

function f3ReportCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "（缺失）";
  return redactF3ReportText(value).replaceAll("|", "\\|").replaceAll(/\r?\n/g, "<br>");
}

function f3ReportInlineCode(value: unknown): string {
  if (value === null || value === undefined || value === "") return "（缺失）";
  const sanitized = redactF3ReportText(value).replaceAll("`", "'").replaceAll(/\r?\n/g, " ");
  return `\`${sanitized}\``;
}

function renderPublishedF3Report(report: DrawingGovernanceResultV2, outputRoot: string): string {
  if (report.status === "input_rejected") {
    return `${[
      "# Feature 3 DIM ID 与图纸治理报告",
      "",
      "状态：`input_rejected`",
      "",
      "## 输入问题",
      "",
      "| Reason Code | Artifact Reference |",
      "| --- | --- |",
      ...report.artifactIssues.map((issue) => `| ${f3ReportCell(issue.reasonCode)} | ${f3ReportCell(issue.artifactReference)} |`),
    ].join("\n")}\n`;
  }

  const rows = report.worksheets.flatMap((worksheet) => worksheet.rows);
  const statusCounts = new Map<string, number>();
  for (const row of rows) statusCounts.set(row.dimIdStatus, (statusCounts.get(row.dimIdStatus) ?? 0) + 1);
  const lines = [
    "# Feature 3 DIM ID 与图纸治理报告",
    "",
    "## 执行摘要",
    "",
    `- 状态：\`${report.status}\``,
    `- Worksheet：${report.summary.worksheetCount}`,
    `- 因子：${report.summary.factorCount}`,
    `- 治理完成：${report.summary.completeCount}`,
    `- 需要治理：${report.summary.governanceRequiredCount}`,
    `- 同图纸重复冲突：${report.summary.duplicateConflictCount}`,
    `- ADO 状态：\`${report.ado.status}\``,
  ];
  if (report.ado.workItemReference !== undefined) lines.push(`- ADO Work Item：${f3ReportInlineCode(report.ado.workItemReference)}`);
  if (report.ado.reasonCode !== undefined) lines.push(`- ADO 原因：${f3ReportCell(report.ado.reasonCode)}`);
  lines.push(
    "",
    "## 质量状态计数",
    "",
    "| DIM ID Status | Count |",
    "| --- | ---: |",
    `| valid | ${statusCounts.get("valid") ?? 0} |`,
    `| missing | ${statusCounts.get("missing") ?? 0} |`,
    `| suspected_invalid | ${statusCounts.get("suspected_invalid") ?? 0} |`,
    `| needs_confirmation | ${statusCounts.get("needs_confirmation") ?? 0} |`,
  );

  const groups = new Map<string, { readonly partCategory: string; readonly drawingNumber: string; readonly rows: typeof rows }>();
  for (const row of rows) {
    const drawingNumber = row.drawingNumber ?? "（缺失）";
    const key = `${row.partCategory}\u0000${drawingNumber}`;
    const group = groups.get(key) ?? { partCategory: row.partCategory, drawingNumber, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  const sortedGroups = [...groups.values()].sort((left, right) => left.partCategory.localeCompare(right.partCategory)
    || left.drawingNumber.localeCompare(right.drawingNumber));
  for (const group of sortedGroups) {
    lines.push("", `## ${f3ReportCell(group.partCategory)} / ${f3ReportCell(group.drawingNumber)}`, "", F3_REPORT_TABLE_HEADER, F3_REPORT_TABLE_SEPARATOR);
    for (const row of group.rows) {
      const href = path.relative(
        path.resolve(outputRoot),
        path.resolve(report.artifactRoot, row.imageReference.relativePath),
      ).split(path.sep).join("/");
      const imageLink = (value: unknown) => `[${f3ReportCell(value)}](${href})`;
      const sourceFields = Object.entries(row.source.sourceCells)
        .filter(([, sourceCell]) => Boolean(sourceCell))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([field, sourceCell]) => `${field}=${sourceCell}`);
      const sourceEvidence = `Worksheet: ${row.source.worksheetName}; Table: ${row.source.tableId}; Row: ${row.source.sourceRow}; Fields: ${sourceFields.length > 0 ? sourceFields.join(", ") : "none"}`;
      lines.push(`| ${imageLink(row.deviceLevelDim)} | ${imageLink(row.dimensionDescription)} | ${f3ReportCell(row.partSubsystem)} | ${f3ReportCell(row.drawingNumber)} | ${f3ReportCell(row.dimId)} | ${imageLink(row.factorDescription)} | ${f3ReportCell(row.nominal)} | ${f3ReportCell(row.upperTolerance)} | ${f3ReportCell(row.lowerTolerance)} | ${f3ReportCell(row.sigmaLevel)} | ${f3ReportCell(sourceEvidence)} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function promotionOptions(input: { readonly __internalFailPromotionAt?: number; readonly __internalFailWithPath?: string }) {
  return {
    ...(Number.isInteger(input.__internalFailPromotionAt) ? { failPromotionAt: input.__internalFailPromotionAt } : {}),
    ...(typeof input.__internalFailWithPath === "string" && input.__internalFailWithPath.length > 0
      ? { failWithPath: input.__internalFailWithPath }
      : {}),
  };
}

function persistArtifactsAtomically(
  artifacts: readonly { readonly targetPath: string; readonly content: string }[],
  fsOps: F3AdoFsOps,
  options: { readonly token?: string; readonly failPromotionAt?: number; readonly failWithPath?: string } = {},
): void {
  const token = options.token ?? `${process.pid}.${randomUUID()}`;
  const backedUpPaths: string[] = [];
  const states = artifacts.map((artifact) => ({
    ...artifact,
    existed: fsOps.existsSync(artifact.targetPath),
    stagePath: `${artifact.targetPath}.copilot-stage-${token}`,
    backupPath: `${artifact.targetPath}.copilot-backup-${token}`,
  }));

  const cleanupPath = (candidatePath: string) => {
    if (fsOps.existsSync(candidatePath)) fsOps.rmSync(candidatePath, { force: true });
  };

  try {
    for (const state of states) fsOps.writeFileSync(state.stagePath, state.content, "utf8");

    for (let index = 0; index < states.length; index += 1) {
      const state = states[index]!;
      if (state.existed) {
        fsOps.renameSync(state.targetPath, state.backupPath);
        backedUpPaths.push(state.backupPath);
      }

      if (options.failPromotionAt === index + 1) {
        const failPath = options.failWithPath ?? state.targetPath;
        throw new Error(`simulated-third-promotion-failure: "${failPath}" and '${failPath}' and ${failPath}`);
      }

      fsOps.renameSync(state.stagePath, state.targetPath);
    }

    for (const backupPath of backedUpPaths) cleanupPath(backupPath);
  } catch (primaryError) {
    const rollbackErrors: string[] = [];
    for (let index = states.length - 1; index >= 0; index -= 1) {
      const state = states[index]!;
      try {
        if (state.existed) {
          if (fsOps.existsSync(state.targetPath)) fsOps.rmSync(state.targetPath, { force: true });
          if (fsOps.existsSync(state.backupPath)) fsOps.renameSync(state.backupPath, state.targetPath);
        } else if (fsOps.existsSync(state.targetPath)) {
          fsOps.rmSync(state.targetPath, { force: true });
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError instanceof Error ? rollbackError.message : String(rollbackError));
      }
    }

    for (const state of states) {
      try {
        cleanupPath(state.stagePath);
      } catch (cleanupError) {
        rollbackErrors.push(cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
      }
      try {
        cleanupPath(state.backupPath);
      } catch (cleanupError) {
        rollbackErrors.push(cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
      }
    }

    if (rollbackErrors.length > 0) {
      const error = new Error(
        `Feature 3 artifact persistence failed and rollback encountered ${rollbackErrors.length} issue(s): ${rollbackErrors.join(" | ")}`,
      );
      error.cause = primaryError;
      throw error;
    }
    throw primaryError;
  } finally {
    for (const state of states) {
      try {
        cleanupPath(state.stagePath);
      } catch {
        // Preserve prior outcome; best-effort cleanup in finalizer.
      }
      try {
        cleanupPath(state.backupPath);
      } catch {
        // Preserve prior outcome; best-effort cleanup in finalizer.
      }
    }
  }
}