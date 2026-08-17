import { execFile } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { createTypedError } from "@ai-assist/contracts";

const execFileAsync = promisify(execFile);

export interface Feature6CommandOptions {
  readonly selectedWorksheetNames: readonly string[];
  readonly supplierCapabilityPath?: string;
  readonly datumStrategyPath?: string;
  readonly costPath?: string;
  readonly imageObservationsPath?: string;
}

function feature6Error(
  code: "validation_error" | "dependency_error" | "transient_error" | "internal_error",
  summary: string,
): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Verify the Feature 2 through Feature 5 artifact directories and repository Feature 6 runner before rerunning.",
    affectedInputReferences: ["feature6-workflow"],
  });
}

function validateArtifactRoot(value: string, reportName: string, featureName: string): void {
  if (!existsSync(value)) {
    throw feature6Error("validation_error", `Feature 6 requires one existing ${featureName} artifact directory.`);
  }
  const rootStats = lstatSync(value);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw feature6Error("validation_error", `Feature 6 requires one existing ${featureName} artifact directory.`);
  }
  const reportPath = join(value, reportName);
  if (!existsSync(reportPath) || !lstatSync(reportPath).isFile()) {
    throw feature6Error("validation_error", `${featureName} report JSON is missing.`);
  }
}

function normalizedWorksheets(values: readonly string[]): string[] {
  const normalized = values.map((value) => value.trim());
  if (normalized.length === 0 || normalized.some((value) => value.length === 0)
    || new Set(normalized).size !== normalized.length) {
    throw feature6Error("validation_error", "Feature 6 requires unique nonempty worksheet selections.");
  }
  return normalized;
}

function optionalPath(value: string | undefined, label: string): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw feature6Error("validation_error", `Feature 6 ${label} path must not be blank.`);
  }
  return normalized;
}

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function isContained(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return relativePath.length > 0 && relativePath !== ".."
    && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath);
}

function formatFeature6Output(rootDir: string, value: unknown): string {
  if (typeof value !== "object" || value === null) throw new Error("invalid runner output");
  const output = value as Record<string, unknown>;
  const statuses = new Set(["completed", "partially_completed", "calculation_failed"]);
  if (typeof output.outputDirectory !== "string" || output.outputDirectory.length === 0
    || output.outputDirectory.trim() !== output.outputDirectory || containsControlCharacter(output.outputDirectory)
    || isAbsolute(output.outputDirectory)
    || !isContained(resolve(rootDir, "test", "demo-output"), resolve(rootDir, output.outputDirectory))
    || typeof output.status !== "string" || !statuses.has(output.status)) {
    throw new Error("invalid runner output");
  }
  return [
    "Feature 6 workflow completed.",
    `f6: ${output.outputDirectory}`,
    `status: ${output.status}`,
  ].join("\n");
}

function dependencyFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; message?: unknown; stderr?: unknown };
  const details = [candidate.code, candidate.message, candidate.stderr]
    .filter((value): value is string => typeof value === "string")
    .join("\n");
  return /ENOENT|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|cannot find package|cannot find module/i.test(details);
}

function timeoutFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; killed?: unknown; signal?: unknown };
  return candidate.code === "ETIMEDOUT" || (candidate.killed === true && candidate.signal === "SIGTERM");
}

function feature6RunnerEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  delete environment.AI_TVA_F6_OUTPUT_ROOT;
  delete environment.AI_TVA_F6_PUBLISH_ROOT;
  return environment;
}

export async function runFeature6WorkflowCommand(
  rootDir: string,
  f2Root: string,
  f3Root: string,
  f4Root: string,
  f5Root: string,
  options: Feature6CommandOptions,
): Promise<string> {
  const scriptPath = join(rootDir, "scripts", "run-f6-full-validation.mjs");
  if (!existsSync(scriptPath)) throw feature6Error("validation_error", "Feature 6 workflow script is missing.");
  const scriptStats = lstatSync(scriptPath);
  if (scriptStats.isSymbolicLink() || !scriptStats.isFile()) {
    throw feature6Error("validation_error", "Feature 6 workflow script is invalid.");
  }
  validateArtifactRoot(f2Root, "Feature2-Report.json", "Feature 2");
  validateArtifactRoot(f3Root, "Feature3-Report.json", "Feature 3");
  validateArtifactRoot(f4Root, "Feature4-Calculation.json", "Feature 4");
  validateArtifactRoot(f5Root, "Feature5-Report.json", "Feature 5");

  const args = [scriptPath, f2Root, f3Root, f4Root, f5Root];
  for (const worksheetName of normalizedWorksheets(options.selectedWorksheetNames)) {
    args.push("--worksheet", worksheetName);
  }
  for (const [flag, value] of [
    ["--supplier-capability", optionalPath(options.supplierCapabilityPath, "supplier capability")],
    ["--datum-strategy", optionalPath(options.datumStrategyPath, "datum strategy")],
    ["--cost", optionalPath(options.costPath, "cost")],
    ["--image-observations", optionalPath(options.imageObservationsPath, "image observations")],
  ] as const) {
    if (value !== undefined) args.push(flag, value);
  }

  try {
    const { stdout } = await execFileAsync(process.execPath, args, {
      cwd: rootDir,
      env: feature6RunnerEnvironment(),
      maxBuffer: 4 * 1024 * 1024,
      timeout: 120_000,
      killSignal: "SIGTERM",
    });
    return formatFeature6Output(rootDir, JSON.parse(stdout));
  } catch (error: unknown) {
    if (timeoutFailure(error)) {
      throw feature6Error("transient_error", "Feature 6 workflow execution timed out.");
    }
    if (dependencyFailure(error)) {
      throw feature6Error("dependency_error", "Feature 6 workflow dependencies are unavailable.");
    }
    throw feature6Error("internal_error", "Feature 6 workflow execution failed.");
  }
}