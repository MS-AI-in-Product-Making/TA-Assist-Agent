import { runExportCommand } from "./commands/export.js";
import { isFeature1Phrase, runFeature1WorkflowCommand } from "./commands/feature1.js";
import { isFeature2Phrase, runFeature2WorkflowCommand, type Feature2WorksheetSelectionArgs } from "./commands/feature2.js";
import { isFeature3Phrase, runFeature3WorkflowCommand } from "./commands/feature3.js";
import { isFeature5Phrase, runFeature5WorkflowCommand, type Feature5CommandOptions } from "./commands/feature5.js";
import { runFeature6WorkflowCommand, type Feature6CommandOptions } from "./commands/feature6.js";
import { runInspectCommand } from "./commands/inspect.js";
import { runPurgeCommand, runPurgePlanCommand } from "./commands/purge.js";
import { runSmokeCommand } from "./commands/smoke.js";
import type { InteractionLanguage } from "@ai-assist/product-language";
import type { AgentCliRequest } from "./commands/agent.js";
import { runDefaultAgentCommand } from "./commands/agent-launcher.js";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

type Command = "smoke" | "inspect" | "export" | "purge-plan" | "purge" | "feature1" | "feature2" | "feature3" | "feature5" | "feature6" | "agent";

export interface CliDependencies {
  readonly cwd: () => string;
  readonly runFeature1?: typeof runFeature1WorkflowCommand;
  readonly runFeature2: typeof runFeature2WorkflowCommand;
  readonly runFeature3?: typeof runFeature3WorkflowCommand;
  readonly runFeature5?: typeof runFeature5WorkflowCommand;
  readonly runFeature6?: typeof runFeature6WorkflowCommand;
  readonly runAgent?: (request: AgentCliRequest) => Promise<string>;
}

export async function executeCli(argv: readonly string[], dependencies: CliDependencies = { cwd: () => process.cwd(), runFeature2: runFeature2WorkflowCommand }): Promise<CliResult> {
  try {
    if (argv.length === 1 && isFeature1Phrase(argv[0])) {
      const stdout = await (dependencies.runFeature1 ?? runFeature1WorkflowCommand)(dependencies.cwd());
      return { exitCode: 0, stdout: `${stdout}\n`, stderr: "" };
    }
    if (isFeature2Phrase(argv[0])) {
      if (argv.length !== 2 || !argv[1]) throw new Error("validation_error: Feature 2 workbook is required");
      const stdout = await dependencies.runFeature2(dependencies.cwd(), argv[1], { mode: "prompt" });
      return { exitCode: 0, stdout: `${stdout}\n`, stderr: "" };
    }
    if (isFeature3Phrase(argv[0])) {
      if (argv.length !== 2 || !argv[1]) throw new Error("validation_error: Feature 2 artifact directory is required");
      const stdout = await (dependencies.runFeature3 ?? runFeature3WorkflowCommand)(dependencies.cwd(), argv[1]);
      return { exitCode: 0, stdout: `${stdout}\n`, stderr: "" };
    }
    if (isFeature5Phrase(argv[0])) {
      const [f1ArtifactRoot, f3ArtifactRoot, f4ArtifactRoot] = argv.slice(1);
      if (argv.length !== 4 || !f1ArtifactRoot || !f3ArtifactRoot || !f4ArtifactRoot) {
        throw new Error("validation_error: Feature 5 three artifact directories are required");
      }
      const normalizedRoots = [f1ArtifactRoot.trim(), f3ArtifactRoot.trim(), f4ArtifactRoot.trim()] as const;
      if (normalizedRoots.some((value) => value.length === 0)) {
        throw new Error("validation_error: Feature 5 three artifact directories are required");
      }
      const stdout = await (dependencies.runFeature5 ?? runFeature5WorkflowCommand)(
        dependencies.cwd(), normalizedRoots[0], normalizedRoots[1], normalizedRoots[2],
      );
      return { exitCode: 0, stdout: `${stdout}\n`, stderr: "" };
    }
    const parsed = parseArguments(argv);
    const stdout = await executeCommand(parsed, dependencies);
    return { exitCode: 0, stdout, stderr: "" };
  } catch (error: unknown) {
    return { exitCode: 2, stdout: "", stderr: `${safeMessage(error)}\n` };
  }
}

async function executeCommand(parsed: ReturnType<typeof parseArguments>, dependencies: CliDependencies): Promise<string> {
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
      return (dependencies.runFeature1 ?? runFeature1WorkflowCommand)(parsed.rootDir);
    case "feature2":
      return dependencies.runFeature2(parsed.rootDir, parsed.workbookPath, parsed.worksheetSelection);
    case "feature3":
      return (dependencies.runFeature3 ?? runFeature3WorkflowCommand)(parsed.rootDir, parsed.f2ArtifactRoot);
    case "feature5":
      return (dependencies.runFeature5 ?? runFeature5WorkflowCommand)(
        parsed.rootDir, parsed.f1ArtifactRoot, parsed.f3ArtifactRoot, parsed.f4ArtifactRoot, parsed.options,
      );
    case "feature6":
      return (dependencies.runFeature6 ?? runFeature6WorkflowCommand)(
        parsed.rootDir,
        parsed.f2ArtifactRoot,
        parsed.f3ArtifactRoot,
        parsed.f4ArtifactRoot,
        parsed.f5ArtifactRoot,
        parsed.options,
      );
    case "agent":
      return (dependencies.runAgent ?? runDefaultAgentCommand)(parsed.request);
  }
}

function parseArguments(argv: readonly string[]):
  | { command: "smoke"; rootDir: string }
  | { command: "inspect"; rootDir: string; runId: string }
  | { command: "export"; rootDir: string; runId: string; confirmConfidential: boolean }
  | { command: "purge-plan"; rootDir: string; runId: string }
  | { command: "purge"; rootDir: string; runId: string; confirmationToken: string }
  | { command: "feature1"; rootDir: string }
  | { command: "feature2"; rootDir: string; workbookPath: string; worksheetSelection: Feature2WorksheetSelectionArgs }
  | { command: "feature3"; rootDir: string; f2ArtifactRoot: string }
  | { command: "feature5"; rootDir: string; f1ArtifactRoot: string; f3ArtifactRoot: string; f4ArtifactRoot: string; options: Feature5CommandOptions }
  | { command: "feature6"; rootDir: string; f2ArtifactRoot: string; f3ArtifactRoot: string; f4ArtifactRoot: string; f5ArtifactRoot: string; options: Feature6CommandOptions }
  | { command: "agent"; request: AgentCliRequest } {
  const [command, ...rawFlags] = argv;
  if (!isCommand(command)) {
    throw new Error("validation_error: command is invalid");
  }
  const agentAction = command === "agent" ? rawFlags[0] : undefined;
  const flags = command === "agent" ? rawFlags.slice(1) : rawFlags;
  const values = new Map<string, string | boolean>();
  const worksheetValues: string[] = [];
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === "--confirm-confidential" || flag === "--confirm") {
      setOnce(values, flag, true);
      continue;
    }
    if (flag !== "--root" && flag !== "--session" && flag !== "--interaction-language" && flag !== "--run-id" && flag !== "--confirmation-token" && flag !== "--workbook" && flag !== "--f2-artifacts" && flag !== "--f1-artifacts" && flag !== "--f3-artifacts" && flag !== "--f4-artifacts" && flag !== "--f5-artifacts" && flag !== "--worksheets" && flag !== "--worksheet" && flag !== "--workbook-hash" && flag !== "--image-observations" && flag !== "--supplier-capability" && flag !== "--datum-strategy" && flag !== "--cost" && flag !== "--analysis-context" && flag !== "--optimization-targets" && flag !== "--language" && flag !== "--model-interpretation") {
      throw new Error("validation_error: unknown option");
    }
    const value = flags[index + 1];
    if (typeof value !== "string" || value.startsWith("--")) {
      throw new Error("validation_error: option value is missing");
    }
    if (flag === "--worksheet") {
      worksheetValues.push(value);
      values.set(flag, true);
      index += 1;
      continue;
    }
    setOnce(values, flag, value);
    index += 1;
  }
  const rootValue = values.get("--root");
  if (typeof rootValue !== "string" || rootValue.trim().length === 0) {
    throw new Error("validation_error: --root is required");
  }
  const rootDir = rootValue.trim();
  if (command === "agent") {
    const action = agentAction;
    if (action !== "analyze" && action !== "resume" && action !== "status" && action !== "workbench") throw new Error("validation_error: agent action is invalid");
    const sessionId = values.get("--session");
    const serializedInteractionLanguage = values.get("--interaction-language");
    if (action === "resume" || action === "status") {
      if (typeof sessionId !== "string" || sessionId.trim().length === 0) throw new Error("validation_error: --session is required");
      if (serializedInteractionLanguage !== undefined) throw new Error("validation_error: --interaction-language is not allowed for this agent action");
      return { command, request: { action, rootDir, sessionId: sessionId.trim() } };
    }
    if (sessionId !== undefined) throw new Error("validation_error: --session is not allowed for this agent action");
    if (action === "analyze" || action === "workbench") {
      if (typeof serializedInteractionLanguage !== "string") throw new Error("validation_error: --interaction-language is required");
      return { command, request: { action, rootDir, interactionLanguage: parseInteractionLanguage(serializedInteractionLanguage) } };
    }
    throw new Error("validation_error: agent action is invalid");
  }
  if (command === "smoke") {
    rejectUnexpected(values, ["--root"]);
    return { command, rootDir };
  }
  if (command === "feature1") {
    rejectUnexpected(values, ["--root"]);
    return { command, rootDir };
  }
  if (command === "feature2") {
    rejectUnexpected(values, ["--root", "--workbook", "--worksheets", "--workbook-hash", "--confirm"]);
    const workbookPath = values.get("--workbook");
    if (typeof workbookPath !== "string" || workbookPath.length === 0) throw new Error("validation_error: --workbook is required");
    const worksheets = values.get("--worksheets");
    const workbookContentHash = values.get("--workbook-hash");
    const confirmed = values.get("--confirm") === true;
    const providedCount = Number(typeof worksheets === "string") + Number(typeof workbookContentHash === "string") + Number(confirmed);
    if (providedCount !== 0 && providedCount !== 3) throw new Error("validation_error: --worksheets, --workbook-hash, and --confirm must be provided together");
    if (providedCount === 0) return { command, rootDir, workbookPath, worksheetSelection: { mode: "prompt" } };
    if (!/^[a-f0-9]{64}$/i.test(workbookContentHash as string)) throw new Error("validation_error: --workbook-hash must be a SHA-256 hash");
    const selectedWorksheetNames = (worksheets as string).split(",").map((name) => name.trim()).filter(Boolean);
    if (selectedWorksheetNames.length === 0 || new Set(selectedWorksheetNames).size !== selectedWorksheetNames.length) {
      throw new Error("validation_error: --worksheets must contain unique worksheet names");
    }
    return {
      command,
      rootDir,
      workbookPath,
      worksheetSelection: { mode: "confirmed", workbookContentHash: workbookContentHash as string, selectedWorksheetNames },
    };
  }
  if (command === "feature3") {
    rejectUnexpected(values, ["--root", "--f2-artifacts"]);
    const f2ArtifactRoot = values.get("--f2-artifacts");
    if (typeof f2ArtifactRoot !== "string" || f2ArtifactRoot.length === 0) throw new Error("validation_error: --f2-artifacts is required");
    return { command, rootDir, f2ArtifactRoot };
  }
  if (command === "feature5") {
    rejectUnexpected(values, ["--root", "--f1-artifacts", "--f3-artifacts", "--f4-artifacts", "--worksheets", "--image-observations"]);
    const f1ArtifactRoot = requiredString(values, "--f1-artifacts");
    const f3ArtifactRoot = requiredString(values, "--f3-artifacts");
    const f4ArtifactRoot = requiredString(values, "--f4-artifacts");
    const worksheets = values.get("--worksheets");
    const imageObservationsPath = optionalPath(values, "--image-observations");
    let selectedWorksheetNames: string[] | undefined;
    if (typeof worksheets === "string") {
      selectedWorksheetNames = worksheets.split(",").map((name) => name.trim()).filter(Boolean);
      if (selectedWorksheetNames.length === 0 || new Set(selectedWorksheetNames).size !== selectedWorksheetNames.length) {
        throw new Error("validation_error: --worksheets must contain unique worksheet names");
      }
    }
    const options: Feature5CommandOptions = {
      ...(selectedWorksheetNames === undefined ? {} : { selectedWorksheetNames }),
      ...(imageObservationsPath === undefined ? {} : { imageObservationsPath }),
    };
    return { command, rootDir, f1ArtifactRoot, f3ArtifactRoot, f4ArtifactRoot, options };
  }
  if (command === "feature6") {
    rejectUnexpected(values, [
      "--root", "--f2-artifacts", "--f3-artifacts", "--f4-artifacts", "--f5-artifacts", "--worksheet",
      "--supplier-capability", "--datum-strategy", "--cost", "--image-observations",
      "--analysis-context", "--optimization-targets", "--language", "--model-interpretation",
    ]);
    const f2ArtifactRoot = requiredString(values, "--f2-artifacts", "Feature 6");
    const f3ArtifactRoot = requiredString(values, "--f3-artifacts", "Feature 6");
    const f4ArtifactRoot = requiredString(values, "--f4-artifacts", "Feature 6");
    const f5ArtifactRoot = requiredString(values, "--f5-artifacts", "Feature 6");
    const languageTag = requiredString(values, "--language", "Feature 6");
    const modelInterpretationPath = requiredString(values, "--model-interpretation", "Feature 6");
    const selectedWorksheetNames = worksheetValues.map((name) => name.trim());
    if (selectedWorksheetNames.length === 0 || selectedWorksheetNames.some((name) => name.length === 0)
      || new Set(selectedWorksheetNames).size !== selectedWorksheetNames.length) {
      throw new Error("validation_error: Feature 6 requires unique worksheet names");
    }
    const supplierCapabilityPath = optionalPath(values, "--supplier-capability", "Feature 6");
    const datumStrategyPath = optionalPath(values, "--datum-strategy", "Feature 6");
    const costPath = optionalPath(values, "--cost", "Feature 6");
    const imageObservationsPath = optionalPath(values, "--image-observations", "Feature 6");
    const analysisContextPath = optionalPath(values, "--analysis-context", "Feature 6");
    const optimizationTargetsPath = optionalPath(values, "--optimization-targets", "Feature 6");
    const options: Feature6CommandOptions = {
      selectedWorksheetNames,
      languageTag,
      modelInterpretationPath,
      ...(supplierCapabilityPath === undefined ? {} : { supplierCapabilityPath }),
      ...(datumStrategyPath === undefined ? {} : { datumStrategyPath }),
      ...(costPath === undefined ? {} : { costPath }),
      ...(imageObservationsPath === undefined ? {} : { imageObservationsPath }),
      ...(analysisContextPath === undefined ? {} : { analysisContextPath }),
      ...(optimizationTargetsPath === undefined ? {} : { optimizationTargetsPath }),
    };
    return { command, rootDir, f2ArtifactRoot, f3ArtifactRoot, f4ArtifactRoot, f5ArtifactRoot, options };
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
    || value === "feature1"
    || value === "feature2"
    || value === "feature3"
    || value === "agent"
    || value === "feature5"
    || value === "feature6";
}

function requiredString(values: ReadonlyMap<string, string | boolean>, key: string, featureName = "Feature 5"): string {
  const value = values.get(key);
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`validation_error: ${featureName} ${key} is required`);
  return value.trim();
}

function optionalPath(values: ReadonlyMap<string, string | boolean>, key: string, featureName = "Feature 5"): string | undefined {
  const value = values.get(key);
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`validation_error: ${featureName} ${key} must not be blank`);
  return value.trim();
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

function parseInteractionLanguage(serialized: string): InteractionLanguage {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error("validation_error: --interaction-language is invalid");
  }
  if (typeof value !== "object" || value === null) throw new Error("validation_error: --interaction-language is invalid");
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.languageTag !== "string"
    || (candidate.uiCatalogLanguage !== "en" && candidate.uiCatalogLanguage !== "zh")
    || typeof candidate.lockedAtTurnId !== "string"
    || (candidate.source !== "workflow_start" && candidate.source !== "explicit_user_change" && candidate.source !== "legacy_fallback")
    || typeof candidate.fallbackUsed !== "boolean") {
    throw new Error("validation_error: --interaction-language is invalid");
  }
  return candidate as unknown as InteractionLanguage;
}