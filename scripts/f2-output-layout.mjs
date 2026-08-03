import path from "node:path";
import { safeName } from "./f1-output-layout.mjs";

export function resolveFeature2OutputLayout(args) {
  if (args.length !== 1) {
    throw new Error("Feature 2 workflow requires exactly one workbook path.");
  }
  const extension = path.extname(args[0]);
  const parsedName = path.basename(args[0], extension);
  const bareName = extension || !/^\.[^.]+$/.test(parsedName) ? parsedName : "";
  const workbookName = safeName(bareName);
  if (!workbookName) throw new Error("Feature 2 workbook output name is empty.");
  return {
    outRoot: path.posix.join("test", "demo-output", "feature2-output", workbookName),
    reportJsonName: "Feature2-Report.json",
    reportMdName: "Feature2-Report.md",
  };
}