import { runExportCommand } from "./commands/export.js";
import { isFeature1Phrase, runFeature1WorkflowCommand } from "./commands/feature1.js";
import { runInspectCommand } from "./commands/inspect.js";
import { runPurgeCommand, runPurgePlanCommand } from "./commands/purge.js";
import { runSmokeCommand } from "./commands/smoke.js";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

type Command = "smoke" | "inspect" | "export" | "purge-plan" | "purge" | "feature1";

export async function executeCli(argv: readonly string[]): Promise<CliResult> {
  try {
    if (argv.length === 1 && isFeature1Phrase(argv[0])) {
      const stdout = await runFeature1WorkflowCommand(process.cwd());
      return { exitCode: 0, stdout: `${stdout}\n`, stderr: "" };
    }
    const parsed = parseArguments(argv);
    const stdout = await executeCommand(parsed);
    return { exitCode: 0, stdout, stderr: "" };
  } catch (error: unknown) {
    return { exitCode: 2, stdout: "", stderr: `${safeMessage(error)}\n` };
  }
}

async function executeCommand(parsed: ReturnType<typeof parseArguments>): Promise<string> {
  switch (parsed.command) {
    case "smoke":
      return runSmokeCommand(parsed.rootDir);
    case "inspect":
      return runInspectCommand(parsed.rootDir, parsed.runId);
    case "export":
      return runExportCommand(parsed.rootDir, parsed.runId, parsed.confirmConfidential);
    case "purge-plan":
      return runPurgePlanCommand(parsed.rootDir, parsed.runId);
    case "purge":
      return runPurgeCommand(parsed.rootDir, parsed.runId, parsed.confirmationToken);
    case "feature1":
      return runFeature1WorkflowCommand(parsed.rootDir);
  }
}

function parseArguments(argv: readonly string[]):
  | { command: "smoke"; rootDir: string }
  | { command: "inspect"; rootDir: string; runId: string }
  | { command: "export"; rootDir: string; runId: string; confirmConfidential: boolean }
  | { command: "purge-plan"; rootDir: string; runId: string }
  | { command: "purge"; rootDir: string; runId: string; confirmationToken: string }
  | { command: "feature1"; rootDir: string } {
  const [command, ...flags] = argv;
  if (!isCommand(command)) {
    throw new Error("validation_error: command is invalid");
  }
  const values = new Map<string, string | boolean>();
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === "--confirm-confidential") {
      setOnce(values, flag, true);
      continue;
    }
    if (flag !== "--root" && flag !== "--run-id" && flag !== "--confirmation-token") {
      throw new Error("validation_error: unknown option");
    }
    const value = flags[index + 1];
    if (typeof value !== "string" || value.startsWith("--")) {
      throw new Error("validation_error: option value is missing");
    }
    setOnce(values, flag, value);
    index += 1;
  }
  const rootDir = values.get("--root");
  if (typeof rootDir !== "string" || rootDir.length === 0) {
    throw new Error("validation_error: --root is required");
  }
  if (command === "smoke") {
    rejectUnexpected(values, ["--root"]);
    return { command, rootDir };
  }
  if (command === "feature1") {
    rejectUnexpected(values, ["--root"]);
    return { command, rootDir };
  }
  const runId = values.get("--run-id");
  if (typeof runId !== "string" || !isUuid(runId)) {
    throw new Error("validation_error: --run-id must be a UUID");
  }
  if (command === "inspect" || command === "purge-plan") {
    rejectUnexpected(values, ["--root", "--run-id"]);
    return { command, rootDir, runId };
  }
  if (command === "export") {
    rejectUnexpected(values, ["--root", "--run-id", "--confirm-confidential"]);
    return { command, rootDir, runId, confirmConfidential: values.get("--confirm-confidential") === true };
  }
  const confirmationToken = values.get("--confirmation-token");
  if (typeof confirmationToken !== "string" || confirmationToken.length === 0) {
    throw new Error("validation_error: confirmation token is required for purge");
  }
  rejectUnexpected(values, ["--root", "--run-id", "--confirmation-token"]);
  return { command, rootDir, runId, confirmationToken };
}

function isCommand(value: string | undefined): value is Command {
  return value === "smoke"
    || value === "inspect"
    || value === "export"
    || value === "purge-plan"
    || value === "purge"
    || value === "feature1";
}

function setOnce(values: Map<string, string | boolean>, key: string, value: string | boolean): void {
  if (values.has(key)) {
    throw new Error("validation_error: duplicate option");
  }
  values.set(key, value);
}

function rejectUnexpected(values: ReadonlyMap<string, string | boolean>, allowed: readonly string[]): void {
  if ([...values.keys()].some((key) => !allowed.includes(key))) {
    throw new Error("validation_error: option is not supported by this command");
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeMessage(error: unknown): string {
  const code = typedErrorCode(error);
  const summary = typedErrorSummary(error);
  return code !== undefined && summary !== undefined
    ? `${code}: ${summary}`
    : "internal_error: operation failed";
}

function typedErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    const message = error instanceof Error ? error.message : undefined;
    return message?.match(/^(validation_error|policy_denied|feature_not_available|dependency_error|transient_error|internal_error): /)?.[1];
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^(validation_error|policy_denied|feature_not_available|dependency_error|transient_error|internal_error)$/.test(code)
    ? code
    : undefined;
}

function typedErrorSummary(error: unknown): string | undefined {
  const summary = typeof error === "object" && error !== null && "summary" in error
    ? (error as { summary?: unknown }).summary
    : error instanceof Error ? error.message.replace(/^[a-z_]+: /, "") : undefined;
  return typeof summary === "string" && /^[A-Za-z0-9][A-Za-z0-9 ,;()._-]*$/.test(summary)
    ? summary
    : undefined;
}

const invokedPath = process.argv[1]?.replaceAll("\\", "/");
if (invokedPath !== undefined && import.meta.url === new URL(`file://${invokedPath}`).href) {
  const result = await executeCli(process.argv.slice(2));
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}