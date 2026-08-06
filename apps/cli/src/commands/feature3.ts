import { execFile } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { createTypedError } from "@ai-assist/contracts";

const execFileAsync = promisify(execFile);

function feature3Error(
  code: "validation_error" | "dependency_error" | "internal_error",
  summary: string,
): Error {
  return createTypedError({
    code,
    summary,
    suggestedAction: "Verify the Feature 2 artifact directory and repository Feature 3 runner before rerunning.",
    affectedInputReferences: ["feature3-workflow"],
  });
}

function validateFeature2ArtifactRoot(value: string): void {
  if (!existsSync(value) || !statSync(value).isDirectory()) {
    throw feature3Error("validation_error", "Feature 3 requires one existing Feature 2 artifact directory.");
  }
  if (!existsSync(join(value, "Feature2-Report.json"))) {
    throw feature3Error("validation_error", "Feature 2 report JSON is missing.");
  }
}

function formatFeature3Output(value: unknown): string {
  if (typeof value !== "object" || value === null) throw new Error("invalid runner output");
  const output = value as Record<string, unknown>;
  const statuses = new Set(["completed", "governance_required", "input_rejected"]);
  if (typeof output.outputDirectory !== "string" || output.outputDirectory.length === 0
    || typeof output.status !== "string" || !statuses.has(output.status)) {
    throw new Error("invalid runner output");
  }
  return [
    "Feature 3 workflow completed.",
    `f3: ${output.outputDirectory}`,
    `status: ${output.status}`,
  ].join("\n");
}

export async function runFeature3WorkflowCommand(rootDir: string, f2ArtifactRoot: string): Promise<string> {
  const scriptPath = join(rootDir, "scripts", "run-f3-full-validation.mjs");
  if (!existsSync(scriptPath)) throw feature3Error("validation_error", "Feature 3 workflow script is missing.");
  validateFeature2ArtifactRoot(f2ArtifactRoot);

  try {
    const { stdout } = await execFileAsync(process.execPath, [scriptPath, f2ArtifactRoot], {
      cwd: rootDir,
      maxBuffer: 4 * 1024 * 1024,
    });
    return formatFeature3Output(JSON.parse(stdout));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT|cannot find|not found/i.test(message)) {
      throw feature3Error("dependency_error", "Feature 3 workflow dependencies are unavailable.");
    }
    throw feature3Error("internal_error", "Feature 3 workflow execution failed.");
  }
}

export function isFeature3Phrase(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "帮我用f3治理dim id"
    || normalized === "use f3 to govern dim ids";
}