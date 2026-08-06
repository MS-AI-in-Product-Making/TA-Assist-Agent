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

export type Feature2WorksheetSelectionArgs =
  | { readonly mode: "prompt" }
  | { readonly mode: "confirmed"; readonly workbookContentHash: string; readonly selectedWorksheetNames: readonly string[] };

export async function runFeature2WorkflowCommand(
  rootDir: string,
  workbookPath: string,
  selection: Feature2WorksheetSelectionArgs = { mode: "prompt" },
): Promise<string> {
  const scriptPath = join(rootDir, "scripts", "f2-excel-runner.mjs");
  if (!existsSync(scriptPath)) throw feature2Error("validation_error", "Feature 2 workflow script is missing.");
  if (extname(workbookPath).toLowerCase() !== ".xlsx" || !existsSync(workbookPath) || !statSync(workbookPath).isFile()) {
    throw feature2Error("validation_error", "Feature 2 requires one existing xlsx workbook.");
  }

  try {
    const args = [scriptPath, workbookPath];
    if (selection.mode === "confirmed") {
      args.push(
        "--workbook-hash",
        selection.workbookContentHash,
        "--worksheets",
        selection.selectedWorksheetNames.join(","),
        "--confirm",
      );
    }
    const { stdout } = await execFileAsync(process.execPath, args, { cwd: rootDir, maxBuffer: 4 * 1024 * 1024 });
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    if (parsed.status === "selectionRequired") {
      const prompt = parsed.prompt as { workbook?: { contentHash?: unknown }; options?: Array<{ worksheetName?: unknown }> } | undefined;
      const contentHash = outputPath(prompt?.workbook?.contentHash);
      const worksheetNames = prompt?.options?.map((option) => outputPath(option.worksheetName)).filter((name): name is string => name !== undefined) ?? [];
      if (!contentHash || worksheetNames.length === 0) throw new Error("invalid runner output");
      return [
        "Worksheet selection required.",
        `workbookHash: ${contentHash}`,
        ...worksheetNames.map((worksheetName) => `worksheet: ${worksheetName}`),
      ].join("\n");
    }
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