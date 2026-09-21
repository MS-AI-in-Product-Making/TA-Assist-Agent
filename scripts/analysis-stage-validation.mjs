import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import {
  drawingGovernanceResultV2Schema, drawingGovernanceResultV3Schema, f2UserReportSchema, f4ExcelComparisonResultSchema,
  f4WorkflowCalculationResultSchema, f5DataInterpretationResultSchema,
} from "../packages/contracts/dist/index.js";
import { assertAnalysisWorkspaceWorkbookIdentity, validateExistingF6 } from "../packages/workflow-runners/dist/index.js";
import { loadF1ArtifactBundle } from "./f2-artifact-loader.mjs";

function invalid() { throw new Error("Stage artifact validation failed."); }
function hash(file) { return createHash("sha256").update(readFileSync(file)).digest("hex"); }

export function validateAnalysisStageArtifacts(layout, stage) {
  const root = layout.stagePaths[stage];
  const artifacts = {};
  function artifact(key, name) {
    if (typeof name !== "string" || path.isAbsolute(name)) invalid();
    const target = path.resolve(root, name);
    const relative = path.relative(root, target);
    if (!relative || relative.split(path.sep).includes("..") || path.isAbsolute(relative)) invalid();
    let current = root;
    for (const segment of relative.split(path.sep)) {
      current = path.join(current, segment);
      if (lstatSync(current).isSymbolicLink()) invalid();
    }
    if (realpathSync(target) !== target || !lstatSync(target).isFile() || lstatSync(target).size === 0) invalid();
    artifacts[key] = path.relative(layout.analysisRoot, target).split(path.sep).join("/");
    return target;
  }
  function json(key, name, schema) {
    const value = JSON.parse(readFileSync(artifact(key, name), "utf8"));
    if (!schema) return value;
    const parsed = schema.safeParse(value);
    if (!parsed.success) invalid();
    return parsed.data;
  }
  function identity(workbook) {
    assertAnalysisWorkspaceWorkbookIdentity(layout, workbook?.fileName, workbook?.contentHash);
  }
  function manifest(featureId, statuses = ["completed"]) {
    const value = json("manifest", "manifest.json");
    if (value.contractVersion !== "v1" || value.featureId !== featureId
      || !statuses.includes(value.status) || !value.artifacts) invalid();
    return value;
  }
  if (stage === "f1") {
    const loaded = loadF1ArtifactBundle(root);
    if (loaded.status !== "accepted") invalid();
    identity(loaded.input.workbook);
    json("reportJson", "Feature1-Report.json");
    artifact("reportMarkdown", "Feature1-Report.md");
  } else if (stage === "f2") {
    const report = json("reportJson", "Feature2-Report.json", f2UserReportSchema);
    if (report.status === "inputRejected") invalid();
    identity(report.workbook);
    artifact("reportMarkdown", "Feature2-Report.md");
  } else if (stage === "f3") {
    const report = json("reportJson", "Feature3-Report.json", drawingGovernanceResultV3Schema.or(drawingGovernanceResultV2Schema));
    if (report.status === "input_rejected") invalid();
    identity(report.workbook);
    artifact("reportMarkdown", "Feature3-Report.md");
  } else if (stage === "f4") {
    const files = manifest("F4").artifacts;
    if (files.calculation !== "Feature4-Calculation.json" || files.report !== "Feature4-Report.md") invalid();
    const calculation = json("calculation", files.calculation, f4WorkflowCalculationResultSchema);
    if (calculation.status !== "completed") invalid();
    identity({ fileName: calculation.source.workbookFileName, contentHash: calculation.source.workbookContentHash });
    artifact("reportMarkdown", files.report);
    if (files.comparison) json("comparison", files.comparison, f4ExcelComparisonResultSchema);
  } else if (stage === "f5") {
    const publication = manifest("F5", ["completed", "partially_completed"]);
    const files = publication.artifacts;
    if (files.reportJson !== "Feature5-Report.json" || files.reportMarkdown !== "Feature5-Report.md"
      || files.runSummary !== "Feature5-Run-Summary.json") invalid();
    const report = json("reportJson", files.reportJson, f5DataInterpretationResultSchema);
    if (report.status === "input_rejected" || report.status !== publication.status) invalid();
    identity(report.workbook);
    const markdown = artifact("reportMarkdown", files.reportMarkdown);
    const summary = json("runSummary", files.runSummary);
    if (summary.status !== report.status || summary.hashes?.reportJsonSha256 !== hash(path.join(root, files.reportJson))
      || summary.hashes?.reportMarkdownSha256 !== hash(markdown)) invalid();
    if (files.imageObservations) {
      const observation = artifact("imageObservations", files.imageObservations);
      if (summary.hashes?.imageObservationsSha256 !== hash(observation)) invalid();
    }
  } else if (stage === "f6") {
    const validated = validateExistingF6(root, {
      publishRoot: root,
      workspaceModelInterpretationPath: path.join(root, "evidence", "model-interpretation", "Feature6-Model-Interpretation.json"),
    });
    if (validated.status !== "accepted" || !validated.finalReportPdfPath) invalid();
    identity(JSON.parse(readFileSync(validated.optimizationJsonPath, "utf8")).workbook);
    for (const key of ["optimizationJsonPath", "finalReportMarkdownPath", "finalReportPdfPath", "runSummaryPath", "manifestPath"]) {
      artifact(key, path.relative(root, validated[key]));
    }
  } else invalid();
  return artifacts;
}
