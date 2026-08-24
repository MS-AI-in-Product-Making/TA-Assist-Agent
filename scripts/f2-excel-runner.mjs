import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  createTypedError,
  typedErrorSchema,
} from "../packages/contracts/dist/contracts.js";
import { runF1F2Confirmed, runF1F2Selection } from "../packages/workflow-runners/dist/index.js";

function errorDetails(error) {
  return { name: error instanceof Error ? error.name : "Error", message: error instanceof Error ? error.message : String(error) };
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
      if (flag !== "--workbook-hash" && flag !== "--worksheets") throw new Error(`Feature 2 option is unsupported: ${flag}`);
      const value = args[index + 1];
      if (!value || value.startsWith("--") || flags.has(flag)) throw new Error(`Feature 2 ${flag} value is missing or duplicated.`);
      flags.set(flag, value);
      index += 1;
    }
    const confirmationCount = Number(flags.has("--confirm")) + Number(flags.has("--workbook-hash")) + Number(flags.has("--worksheets"));
    if (confirmationCount !== 0 && confirmationCount !== 3) throw new Error("Feature 2 confirmation parameters must be provided together.");
    const worksheetSelection = confirmationCount === 3
      ? {
          workbookContentHash: flags.get("--workbook-hash"),
          selectedWorksheetNames: flags.get("--worksheets").split(",").map((name) => name.trim()).filter(Boolean),
          confirmed: true,
        }
      : undefined;
    console.log(JSON.stringify(runF2ExcelWorkflow({ workbookPath, worksheetSelection }), null, 2));
  } catch (error) {
    const typed = typedErrorSchema.safeParse(error);
    console.error(JSON.stringify({ status: "failed", error: typed.success ? typed.data : errorDetails(error) }, null, 2));
    process.exitCode = 1;
  }
}