import path from "node:path";
import { pathToFileURL } from "node:url";
import { publishF3AdoTraceabilityArtifacts } from "../packages/workflow-runners/dist/index.js";

const OPTIONS = new Set([
  "--operation",
  "--organization",
  "--project",
  "--work-item-id",
  "--verified-at",
]);

function requiredOption(options, name) {
  const value = options.get(name);
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Feature 3 ADO receipt requires ${name}.`);
  }
  return value.trim();
}

export function parseF3AdoReceiptArgs(args) {
  let f3Root;
  const options = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      if (f3Root !== undefined) throw new Error("Feature 3 ADO receipt requires exactly one output directory.");
      f3Root = token;
      continue;
    }
    if (!OPTIONS.has(token)) throw new Error(`Feature 3 ADO receipt option is unsupported: ${token}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--") || options.has(token)) {
      throw new Error(`Feature 3 ADO receipt ${token} value is missing or duplicated.`);
    }
    options.set(token, value);
    index += 1;
  }

  if (!f3Root || f3Root.trim().length === 0 || f3Root.split(/[\\/]+/u).includes("..")) {
    throw new Error("Feature 3 ADO receipt output directory is missing or unsafe.");
  }
  const operation = requiredOption(options, "--operation");
  if (operation !== "created" && operation !== "updated") {
    throw new Error("Feature 3 ADO receipt operation must be created or updated.");
  }
  const organization = requiredOption(options, "--organization");
  const project = requiredOption(options, "--project");
  if (/^https?:\/\//iu.test(organization) || /^https?:\/\//iu.test(project)) {
    throw new Error("Feature 3 ADO receipt requires validated identity fields, not a URL.");
  }
  const workItemIdText = requiredOption(options, "--work-item-id");
  const workItemId = Number(workItemIdText);
  if (!Number.isSafeInteger(workItemId) || workItemId <= 0 || String(workItemId) !== workItemIdText) {
    throw new Error("Feature 3 ADO receipt work item ID must be a positive integer.");
  }
  const verifiedAt = requiredOption(options, "--verified-at");
  if (!/(?:Z|[+-]\d{2}:\d{2})$/u.test(verifiedAt) || !Number.isFinite(Date.parse(verifiedAt))) {
    throw new Error("Feature 3 ADO receipt verifiedAt must be an ISO-8601 timestamp with an explicit offset.");
  }

  const resolvedRoot = path.resolve(f3Root.trim());
  return {
    f3Root: resolvedRoot,
    reportPath: path.join(resolvedRoot, "Feature3-Report.json"),
    receipt: {
      operation,
      targetIdentity: { organization, project, workItemId },
      verifiedAt,
    },
  };
}

export function writeF3AdoReceipt(input) {
  return publishF3AdoTraceabilityArtifacts(input);
}

function isDirectExecution() {
  return process.argv[1] !== undefined
    && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isDirectExecution()) {
  try {
    const result = writeF3AdoReceipt(parseF3AdoReceiptArgs(process.argv.slice(2)));
    console.log(JSON.stringify({
      status: result.report.ado.status,
      modelVersion: result.report.modelVersion,
      reminderPath: result.reminderPath,
      historyHtmlPath: result.historyHtmlPath,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      status: "failed",
      error: { name: "Error", message: error instanceof Error ? error.message : String(error) },
    }, null, 2));
    process.exitCode = 1;
  }
}