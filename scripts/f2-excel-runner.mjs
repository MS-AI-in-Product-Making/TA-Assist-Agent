import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { typedErrorSchema } from "../packages/contracts/dist/errors.js";
import { normalizeRunnerError, runF1F2Confirmed, runF1F2Selection } from "../packages/workflow-runners/dist/index.js";

function safeTypedError(error) {
  const parsed = typedErrorSchema.safeParse(error);
  const typed = parsed.success ? parsed.data : normalizeRunnerError(error);
  return {
    code: typed.code,
    runId: typed.runId,
    summary: typed.summary,
    retryable: typed.retryable,
    suggestedAction: typed.suggestedAction,
    affectedInputReferences: [...typed.affectedInputReferences],
  };
}

function createContext(repositoryRoot) {
  return {
    repositoryRoot: path.resolve(repositoryRoot),
    managedOutputRoot: path.join(path.resolve(repositoryRoot), "test", "demo-output"),
    attemptId: crypto.randomUUID(),
    signal: new AbortController().signal,
    emit: () => {},
  };
}

export function runF2ExcelWorkflow({ workbookPath, worksheetSelection, repositoryRoot = process.cwd(), now = () => new Date(), executeStage }) {
  const context = createContext(repositoryRoot);
  return worksheetSelection === undefined
    ? runF1F2Selection({ workbookPath, now }, context, { executeStage })
    : runF1F2Confirmed({
        workbookPath,
        workbookContentHash: worksheetSelection.workbookContentHash,
        selectedWorksheetNames: worksheetSelection.selectedWorksheetNames,
        selectionReference: worksheetSelection.selectionReference ?? (
          worksheetSelection.runId && worksheetSelection.runRoot && worksheetSelection.manifestPath && worksheetSelection.promptPath
            ? {
                runId: worksheetSelection.runId,
                runRoot: worksheetSelection.runRoot,
                manifestPath: worksheetSelection.manifestPath,
                promptPath: worksheetSelection.promptPath,
              }
            : undefined
        ),
        now,
      }, context, { executeStage });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const args = process.argv.slice(2);
    const workbookPath = args[0];
    if (!workbookPath || workbookPath.startsWith("--")) throw new Error("Feature 2 Excel workflow requires exactly one .xlsx workbook.");
    const flags = new Map();
    for (let index = 1; index < args.length; index += 1) {
      const flag = args[index];
      if (flag === "--confirm") {
        if (flags.has(flag)) throw new Error("Feature 2 confirmation option is duplicated.");
        flags.set(flag, true);
        continue;
      }
      if (flag !== "--workbook-hash" && flag !== "--worksheets" && flag !== "--selection-manifest") throw new Error(`Feature 2 option is unsupported: ${flag}`);
      const value = args[index + 1];
      if (!value || value.startsWith("--") || flags.has(flag)) throw new Error(`Feature 2 ${flag} value is missing or duplicated.`);
      flags.set(flag, value);
      index += 1;
    }
    const confirmationCount = Number(flags.has("--confirm")) + Number(flags.has("--workbook-hash")) + Number(flags.has("--worksheets")) + Number(flags.has("--selection-manifest"));
    if (confirmationCount !== 0 && confirmationCount !== 4) throw new Error("Feature 2 confirmation parameters must be provided together.");
    const worksheetSelection = confirmationCount === 4
        ? {
            workbookContentHash: flags.get("--workbook-hash"),
            selectedWorksheetNames: flags.get("--worksheets").split(",").map((name) => name.trim()).filter(Boolean),
            selectionReference: {
              ...JSON.parse(readFileSync(flags.get("--selection-manifest"), "utf8")),
              manifestPath: flags.get("--selection-manifest"),
              promptPath: JSON.parse(readFileSync(flags.get("--selection-manifest"), "utf8")).selection.promptPath,
            },
            confirmed: true,
          }
        : undefined;
    console.log(JSON.stringify(runF2ExcelWorkflow({ workbookPath, worksheetSelection }), null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: "failed", error: safeTypedError(error) }, null, 2));
    process.exitCode = 1;
  }
}