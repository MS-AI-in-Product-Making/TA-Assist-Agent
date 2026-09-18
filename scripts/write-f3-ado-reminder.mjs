import path from "node:path";
import { pathToFileURL } from "node:url";
import { writeF3AdoReminderArtifacts } from "../packages/workflow-runners/dist/index.js";

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

function resolveSensitivePaths(f3OutputRoot) {
  try {
    const rootArg = ensureSafePathInput(f3OutputRoot, "Feature 3 output directory");
    const resolvedRoot = path.resolve(rootArg);
    return [
      resolvedRoot,
      path.join(resolvedRoot, "Feature3-Report.json"),
      path.join(resolvedRoot, "Feature3-Report.md"),
      path.join(resolvedRoot, "Feature3-ADO-Reminder.md"),
      path.join(resolvedRoot, "Feature3-ADO-History.html"),
    ];
  } catch {
    return [];
  }
}
export function writeF3AdoReminder(input) {
  return writeF3AdoReminderArtifacts(input);
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
      historyHtmlPath: result.historyHtmlPath,
      report: result.report,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: "failed", error: errorDetails(error, sensitivePaths) }, null, 2));
    process.exitCode = 1;
  }
}
