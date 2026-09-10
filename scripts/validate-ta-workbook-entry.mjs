import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateF0Capabilities } from "../packages/workflow-runners/dist/index.js";

function assertUnlinkedPath(filePath) {
  const absolutePath = path.resolve(filePath);
  const parsed = path.parse(absolutePath);
  let currentPath = parsed.root;
  for (const segment of absolutePath.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    currentPath = path.join(currentPath, segment);
    if (lstatSync(currentPath).isSymbolicLink()) {
      throw new Error("Workbook path must not contain symbolic links or junctions.");
    }
  }
}

export function validateTaWorkbookEntry(workbookPath, dependencies = {}) {
  if (typeof workbookPath !== "string" || workbookPath.trim() === "" || path.extname(workbookPath).toLowerCase() !== ".xlsx") {
    throw new Error("Provide exactly one .xlsx TA workbook path.");
  }

  assertUnlinkedPath(workbookPath);
  const workbookStats = lstatSync(workbookPath);
  if (!workbookStats.isFile()) throw new Error("TA workbook path must resolve to a regular file.");

  const canonicalPath = realpathSync.native(workbookPath);
  const workbookBytes = readFileSync(canonicalPath);
  const validateCapabilities = dependencies.validateCapabilities ?? validateF0Capabilities;
  const capabilityResult = validateCapabilities({
    repositoryRoot: process.cwd(),
    managedOutputRoot: path.join(process.cwd(), "test", "demo-output"),
    attemptId: "ta-workbook-entry-validation",
    signal: new AbortController().signal,
    emit: () => {},
  });

  if (capabilityResult?.status !== "completed" || !Array.isArray(capabilityResult.versions)) {
    throw new Error("Controlled knowledge capability validation did not complete.");
  }

  return {
    status: "completed",
    workbook: {
      canonicalPath,
      contentHash: createHash("sha256").update(workbookBytes).digest("hex"),
      sizeBytes: workbookStats.size,
    },
    controlledVersions: capabilityResult.versions,
  };
}

function runCli() {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Error("Provide exactly one .xlsx TA workbook path.");
  process.stdout.write(`${JSON.stringify(validateTaWorkbookEntry(args[0]), null, 2)}\n`);
}

const invokedPath = process.argv[1] ? realpathSync.native(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "TA workbook entry validation failed."}\n`);
    process.exitCode = 1;
  }
}