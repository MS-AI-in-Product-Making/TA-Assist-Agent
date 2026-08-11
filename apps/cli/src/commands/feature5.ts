import { execFile } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { createTypedError } from "@ai-assist/contracts";

const execFileAsync = promisify(execFile);

export interface Feature5CommandOptions {
  readonly selectedWorksheetNames?: readonly string[];
  readonly imageObservationsPath?: string;
}

function feature5Error(
  code: "validation_error" | "dependency_error" | "transient_error" | "internal_error",
  summary: string,
): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Verify the Feature 1, Feature 3, and Feature 4 artifact directories and repository Feature 5 runner before rerunning.",
    affectedInputReferences: ["feature5-workflow"],
  });
}

function validateArtifactRoot(value: string, reportName: string, featureName: string): void {
  if (!existsSync(value)) {
    throw feature5Error("validation_error", `Feature 5 requires one existing ${featureName} artifact directory.`);
  }
  const rootStats = lstatSync(value);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
    throw feature5Error("validation_error", `Feature 5 requires one existing ${featureName} artifact directory.`);
  }
  const reportPath = join(value, reportName);
  if (!existsSync(reportPath) || !lstatSync(reportPath).isFile()) {
    throw feature5Error("validation_error", `${featureName} report JSON is missing.`);
  }
}

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function formatFeature5Output(value: unknown): string {
  if (typeof value !== "object" || value === null) throw new Error("invalid runner output");
  const output = value as Record<string, unknown>;
  const statuses = new Set(["completed", "partially_completed"]);
  if (typeof output.outputDirectory !== "string" || output.outputDirectory.length === 0
    || output.outputDirectory.trim() !== output.outputDirectory || containsControlCharacter(output.outputDirectory)
    || typeof output.status !== "string" || !statuses.has(output.status)) {
    throw new Error("invalid runner output");
  }
  return [
    "Feature 5 workflow completed.",
    `f5: ${output.outputDirectory}`,
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

export async function runFeature5WorkflowCommand(
  rootDir: string,
  f1Root: string,
  f3Root: string,
  f4Root: string,
  options: Feature5CommandOptions = {},
): Promise<string> {
  const scriptPath = join(rootDir, "scripts", "run-f5-full-validation.mjs");
  if (!existsSync(scriptPath)) throw feature5Error("validation_error", "Feature 5 workflow script is missing.");
  validateArtifactRoot(f1Root, "Feature1-Report.json", "Feature 1");
  validateArtifactRoot(f3Root, "Feature3-Report.json", "Feature 3");
  validateArtifactRoot(f4Root, "Feature4-Calculation.json", "Feature 4");

  const args = [scriptPath, f1Root, f3Root, f4Root];
  for (const worksheetName of options.selectedWorksheetNames ?? []) {
    args.push("--worksheet", worksheetName);
  }
  if (options.imageObservationsPath !== undefined) {
    args.push("--image-observations", options.imageObservationsPath);
  }

  try {
    const { stdout } = await execFileAsync(process.execPath, args, {
      cwd: rootDir,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 120_000,
      killSignal: "SIGTERM",
    });
    return formatFeature5Output(JSON.parse(stdout));
  } catch (error: unknown) {
    if (timeoutFailure(error)) {
      throw feature5Error("transient_error", "Feature 5 workflow execution timed out.");
    }
    if (dependencyFailure(error)) {
      throw feature5Error("dependency_error", "Feature 5 workflow dependencies are unavailable.");
    }
    throw feature5Error("internal_error", "Feature 5 workflow execution failed.");
  }
}

export function isFeature5Phrase(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "使用f5分析报告"
    || normalized === "使用 f5 分析报告"
    || normalized === "use f5 analysis report";
}