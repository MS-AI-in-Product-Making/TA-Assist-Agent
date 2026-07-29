import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTypedError } from "@ai-assist/contracts";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function feature1Error(
  code: "validation_error" | "dependency_error" | "internal_error",
  summary: string,
): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Verify the repository root and required Feature 1 scripts before rerunning.",
    affectedInputReferences: ["feature1-workflow"],
  });
}

export async function runFeature1WorkflowCommand(rootDir: string): Promise<string> {
  const scriptPath = join(rootDir, "scripts", "run-f1-full-validation.mjs");
  if (!existsSync(scriptPath)) {
    throw feature1Error("validation_error", "Feature 1 workflow script is missing.");
  }

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath], {
      cwd: rootDir,
      maxBuffer: 1024 * 1024,
    });

    const lines = (stdout || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const latestReport = lines.find((line) => line.endsWith("test/demo-output/feature1-validation/latest.md"))
      ?? "test/demo-output/feature1-validation/latest.md";
    const latestJson = lines.find((line) => line.endsWith("test/demo-output/feature1-validation/latest.json"))
      ?? "test/demo-output/feature1-validation/latest.json";

    return [
      "Feature 1 workflow completed.",
      `report: ${latestReport}`,
      `json: ${latestJson}`,
      ...(stderr?.trim() ? [`stderr: ${stderr.trim()}`] : []),
    ].join("\n");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT|cannot find|not found/i.test(message)) {
      throw feature1Error("dependency_error", "Feature 1 workflow dependencies are unavailable.");
    }
    throw feature1Error("internal_error", "Feature 1 workflow execution failed.");
  }
}

export function isFeature1Phrase(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "用feature 1来解析报告"
    || normalized === "use feature 1 to parse report";
}

export const cliSourceDirectory = __dirname;
