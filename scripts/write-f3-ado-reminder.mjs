import { existsSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { drawingGovernanceResultV2Schema } from "../packages/contracts/dist/contracts.js";
import { renderF3AdoReminder } from "./f3-ado-reminder.mjs";
import { renderF3Report } from "./f3-report.mjs";

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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeErrorMessage(value, sensitivePaths = []) {
  let sanitized = String(value);

  const orderedPaths = [...new Set(sensitivePaths.filter((item) => typeof item === "string" && item.length > 0))]
    .sort((left, right) => right.length - left.length);
  for (const sensitivePath of orderedPaths) {
    const exactPattern = new RegExp(escapeRegex(sensitivePath), "gi");
    sanitized = sanitized.replace(exactPattern, "[redacted-local-path]");
  }

  sanitized = sanitized
    .replace(/"[A-Za-z]:\\[^"\r\n]*"/g, '"[redacted-local-path]"')
    .replace(/'[A-Za-z]:\\[^'\r\n]*'/g, "'[redacted-local-path]'")
    .replace(/[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/g, "[redacted-local-path]")
    .replace(/[A-Za-z]:(?:\\\\[^\\/:*?"<>|\r\n]+)+/g, "[redacted-local-path]");

  return sanitized;
}

function ensureSafePathInput(value, description) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${description} is required.`);
  const segments = value.trim().split(/[\\/]+/).filter(Boolean);
  if (segments.includes("..")) throw new Error(`${description} is unsafe.`);
  return value.trim();
}

function validateAdoOutcome(adoOutcome) {
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

  if (status === "not_requested") {
    if (workItemReference !== undefined || reasonCode !== undefined) {
      throw new Error("not_requested status cannot include work item reference or reason code.");
    }
  }

  if (status === "updated" && reasonCode !== undefined) {
    throw new Error("updated status cannot include reason code.");
  }

  if ((status === "blocked" || status === "failed") && reasonCode === undefined) {
    throw new Error("blocked/failed status requires a controlled reason code.");
  }

  const preValidationReasonCodes = new Set([
    "surface_mcp_unavailable",
    "surface_mcp_authentication_failed",
  ]);
  if (workItemReference !== undefined && preValidationReasonCodes.has(reasonCode)) {
    throw new Error("Pre-validation Surface MCP failures cannot include work item reference.");
  }

  return {
    status,
    ...(workItemReference !== undefined ? { workItemReference } : {}),
    ...(reasonCode !== undefined ? { reasonCode } : {}),
  };
}

function createFsOps(overrides = {}) {
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

function readLockPayload(lockPath, fsOps) {
  try {
    const raw = String(fsOps.readFileSync(lockPath, "utf8") ?? "").trim();
    if (raw.length === 0) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const ownerToken = typeof parsed.ownerToken === "string" ? parsed.ownerToken : undefined;
    const createdAt = typeof parsed.createdAt === "string" ? parsed.createdAt : undefined;
    if (!ownerToken || !createdAt) return null;
    return { ownerToken, createdAt };
  } catch {
    return null;
  }
}

function acquireTransactionLock(resolvedRoot, fsOps) {
  const ownerToken = `${process.pid}.${randomUUID()}`;
  const lockPath = path.join(resolvedRoot, LOCK_FILE_NAME);
  const lockPayload = `${JSON.stringify({
    lockVersion: "v1",
    ownerToken,
    createdAt: new Date().toISOString(),
  })}\n`;

  try {
    fsOps.writeFileSync(lockPath, lockPayload, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
    if (code === "EEXIST") {
      const current = readLockPayload(lockPath, fsOps);
      const ageHint = current?.createdAt
        ? ` (lock createdAt=${current.createdAt})`
        : "";
      throw new Error(`Feature 3 reminder persistence is already in progress for this output directory${ageHint}.`);
    }
    throw error;
  }

  let released = false;
  const release = () => {
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
  };

  return { lockPath, ownerToken, release };
}

function resolveSensitivePaths(f3OutputRoot) {
  try {
    const rootArg = ensureSafePathInput(f3OutputRoot, "Feature 3 output directory");
    const resolvedRoot = path.resolve(rootArg);
    return [
      resolvedRoot,
      path.join(resolvedRoot, "Feature3-Report.json"),
      path.join(resolvedRoot, "Feature3-Report.md"),
      path.join(resolvedRoot, "Feature3-ADO-Reminder.md"),
    ];
  } catch {
    return [];
  }
}

function loadReportFromOutputRoot(f3OutputRoot, fsOps = createFsOps()) {
  const rootArg = ensureSafePathInput(f3OutputRoot, "Feature 3 output directory");
  const resolvedRoot = path.resolve(rootArg);
  if (!fsOps.existsSync(resolvedRoot) || !fsOps.statSync(resolvedRoot).isDirectory()) {
    throw new Error("Feature 3 output directory is missing or invalid.");
  }

  const reportJsonPath = path.join(resolvedRoot, "Feature3-Report.json");
  if (!fsOps.existsSync(reportJsonPath)) throw new Error("Feature 3 report artifact is missing.");

  let decoded;
  try {
    decoded = JSON.parse(fsOps.readFileSync(reportJsonPath, "utf8"));
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
    report: parsed.data,
  };
}

function persistArtifactsAtomically(artifacts, fsOps, options = {}) {
  const token = options.token ?? `${process.pid}.${randomUUID()}`;
  const backedUpPaths = [];
  const states = artifacts.map((artifact) => ({
    ...artifact,
    existed: fsOps.existsSync(artifact.targetPath),
    stagePath: `${artifact.targetPath}.copilot-stage-${token}`,
    backupPath: `${artifact.targetPath}.copilot-backup-${token}`,
    promoted: false,
    backupMoved: false,
  }));

  const cleanupPath = (candidatePath) => {
    if (fsOps.existsSync(candidatePath)) {
      fsOps.rmSync(candidatePath, { force: true });
    }
  };

  try {
    for (const state of states) {
      fsOps.writeFileSync(state.stagePath, state.content, "utf8");
    }

    for (let index = 0; index < states.length; index += 1) {
      const state = states[index];
      if (state.existed) {
        fsOps.renameSync(state.targetPath, state.backupPath);
        state.backupMoved = true;
        backedUpPaths.push(state.backupPath);
      }

      if (options.failPromotionAt === index + 1) {
        const failPath = options.failWithPath ?? state.targetPath;
        throw new Error(`simulated-third-promotion-failure: "${failPath}" and '${failPath}' and ${failPath}`);
      }

      fsOps.renameSync(state.stagePath, state.targetPath);
      state.promoted = true;
    }

    for (const backupPath of backedUpPaths) cleanupPath(backupPath);
  } catch (primaryError) {
    const rollbackErrors = [];

    for (let index = states.length - 1; index >= 0; index -= 1) {
      const state = states[index];
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

export function writeF3AdoReminder({
  f3OutputRoot,
  adoOutcome,
  __internalFsOps,
  __internalFailPromotionAt,
  __internalFailWithPath,
}) {
  const fsOps = createFsOps(__internalFsOps);
  const rootArg = ensureSafePathInput(f3OutputRoot, "Feature 3 output directory");
  const resolvedRoot = path.resolve(rootArg);
  if (!fsOps.existsSync(resolvedRoot) || !fsOps.statSync(resolvedRoot).isDirectory()) {
    throw new Error("Feature 3 output directory is missing or invalid.");
  }

  const transactionLock = acquireTransactionLock(resolvedRoot, fsOps);
  try {
    const loaded = loadReportFromOutputRoot(resolvedRoot, fsOps);
    const nextAdo = validateAdoOutcome(adoOutcome);
    const report = drawingGovernanceResultV2Schema.parse({
      ...loaded.report,
      ado: nextAdo,
    });

    const reminderMd = renderF3AdoReminder(report);
    const reportMd = renderF3Report(report, { outputRoot: resolvedRoot });

    persistArtifactsAtomically([
      { targetPath: loaded.reminderPath, content: reminderMd },
      { targetPath: loaded.reportJsonPath, content: `${JSON.stringify(report, null, 2)}\n` },
      { targetPath: loaded.reportMdPath, content: reportMd },
    ], fsOps, {
      ...(Number.isInteger(__internalFailPromotionAt) ? { failPromotionAt: __internalFailPromotionAt } : {}),
      ...(typeof __internalFailWithPath === "string" && __internalFailWithPath.length > 0
        ? { failWithPath: __internalFailWithPath }
        : {}),
    });

    return { reminderPath: loaded.reminderPath, report };
  } finally {
    transactionLock.release();
  }
}

function parseCliArgs(args) {
  let f3OutputRoot;
  const options = new Map();

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      if (f3OutputRoot !== undefined) throw new Error("Feature 3 ADO reminder requires exactly one output directory.");
      f3OutputRoot = token;
      continue;
    }

    if (token !== "--status" && token !== "--work-item-reference" && token !== "--reason-code") {
      throw new Error(`Feature 3 ADO reminder option is unsupported: ${token}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--") || options.has(token)) {
      throw new Error(`Feature 3 ADO reminder ${token} value is missing or duplicated.`);
    }
    options.set(token, value);
    index += 1;
  }

  if (!f3OutputRoot) throw new Error("Feature 3 ADO reminder requires exactly one output directory.");
  if (!options.has("--status")) throw new Error("Feature 3 ADO reminder requires --status.");

  return {
    f3OutputRoot,
    adoOutcome: {
      status: options.get("--status"),
      ...(options.has("--work-item-reference") ? { workItemReference: options.get("--work-item-reference") } : {}),
      ...(options.has("--reason-code") ? { reasonCode: options.get("--reason-code") } : {}),
    },
  };
}

function errorDetails(error, sensitivePaths = []) {
  return {
    name: error instanceof Error ? error.name : "Error",
    message: sanitizeErrorMessage(error instanceof Error ? error.message : String(error), sensitivePaths),
  };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  let parsedArgs;
  let sensitivePaths = [];
  try {
    parsedArgs = parseCliArgs(process.argv.slice(2));
    sensitivePaths = resolveSensitivePaths(parsedArgs.f3OutputRoot);
    const result = writeF3AdoReminder(parsedArgs);
    console.log(JSON.stringify({
      status: result.report.ado.status,
      reminderPath: result.reminderPath,
      report: result.report,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: "failed", error: errorDetails(error, sensitivePaths) }, null, 2));
    process.exitCode = 1;
  }
}
