import path from "node:path";
import { safeName } from "./f1-output-layout.mjs";

export function resolveFeature2OutputLayout(args) {
  if (args.length !== 1) {
    throw new Error("Feature 2 workflow requires exactly one Feature 1 artifact directory.");
  }
  if (/\.xls[xm]?$/i.test(args[0])) throw new Error("Feature 2 requires a Feature 1 artifact directory, not an Excel workbook.");
  const workbookName = safeName(path.basename(path.normalize(args[0])));
  if (!workbookName) throw new Error("Feature 2 artifact output name is empty.");
  return {
    outRoot: path.posix.join("test", "demo-output", "feature2-output", workbookName),
    reportJsonName: "Feature2-Report.json",
    reportMdName: "Feature2-Report.md",
  };
}