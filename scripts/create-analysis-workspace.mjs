import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import {
  allocateAnalysisWorkspace, createInitialAnalysisWorkspaceSummary, writeAnalysisWorkspaceSummary,
} from "../packages/workflow-runners/dist/index.js";

export function createAnalysisWorkspace(args) {
  const flags = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!["--workbook", "--test-root"].includes(flag) || flags.has(flag)
      || !value || !path.isAbsolute(value)) throw new Error("Invalid workspace allocation arguments.");
    flags.set(flag, value);
  }
  const workbook = flags.get("--workbook");
  if (!workbook || path.extname(workbook).toLowerCase() !== ".xlsx") throw new Error("An absolute .xlsx workbook is required.");
  const bytes = readFileSync(workbook);
  if (bytes.subarray(0, 2).toString("ascii") !== "PK") throw new Error("Invalid xlsx workbook.");
  const book = XLSX.read(bytes, { type: "buffer", bookSheets: true });
  if (!book.SheetNames?.length) throw new Error("Workbook has no worksheets.");
  const layout = allocateAnalysisWorkspace({
    testRoot: flags.get("--test-root") ?? path.resolve("test"),
    workbookFileName: path.basename(workbook),
    workbookContentHash: createHash("sha256").update(bytes).digest("hex"),
    now: new Date(),
  });
  writeAnalysisWorkspaceSummary(layout, createInitialAnalysisWorkspaceSummary(layout));
  return layout;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(createAnalysisWorkspace(process.argv.slice(2)), null, 2));
  } catch {
    console.error(JSON.stringify({ status: "failed", reasonCode: "workspace_allocation_failed" }));
    process.exitCode = 1;
  }
}
