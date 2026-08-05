import { existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTypedError } from "@ai-assist/contracts";

const execFileAsync = promisify(execFile);

function feature2Error(
  code: "validation_error" | "dependency_error" | "internal_error",
  summary: string,
): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Verify the workbook and repository Feature 2 runner before rerunning.",
    affectedInputReferences: ["feature2-workflow"],
  });
}

function outputPath(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function runFeature2WorkflowCommand(rootDir: string, workbookPath: string): Promise<string> {
  const scriptPath = join(rootDir, "scripts", "f2-excel-runner.mjs");
  if (!existsSync(scriptPath)) throw feature2Error("validation_error", "Feature 2 workflow script is missing.");
  if (extname(workbookPath).toLowerCase() !== ".xlsx" || !existsSync(workbookPath) || !statSync(workbookPath).isFile()) {
    throw feature2Error("validation_error", "Feature 2 requires one existing xlsx workbook.");
  }

  try {
    const { stdout } = await execFileAsync(process.execPath, [scriptPath, workbookPath], { cwd: rootDir, maxBuffer: 4 * 1024 * 1024 });
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    const runRoot = outputPath(parsed.runRoot);
    const f1Root = outputPath(parsed.f1Root);
    const f2Root = outputPath(parsed.f2Root);
    const validationRoot = outputPath(parsed.validationRoot);
    if (!runRoot || !f1Root || !f2Root || !validationRoot) throw new Error("invalid runner output");
    return [
      "Feature 2 workflow completed.",
      `runRoot: ${runRoot}`,
      `f1: ${f1Root}`,
      `f2: ${f2Root}`,
      `validation: ${validationRoot}`,
    ].join("\n");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT|cannot find|not found/i.test(message)) throw feature2Error("dependency_error", "Feature 2 workflow dependencies are unavailable.");
    throw feature2Error("internal_error", "Feature 2 workflow execution failed.");
  }
}

export function isFeature2Phrase(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "帮我用f2分析下excel"
    || normalized === "use f2 to analyze excel";
}