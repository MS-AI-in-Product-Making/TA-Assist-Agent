import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createF2UserReport } from "../packages/workbook-catalog/dist/f2-user-report.js";
import { loadF1ArtifactBundle } from "./f2-artifact-loader.mjs";
import { safeName } from "./f1-output-layout.mjs";
import { resolveFeature2OutputLayout } from "./f2-output-layout.mjs";
import { renderF2Report } from "./f2-report.mjs";
import { runAnalysisStage, withoutAnalysisRoot } from "./analysis-stage-lifecycle.mjs";

function executeF2(cliArgs, workspace) {
if (workspace && (process.env.AI_TVA_F2_OUTPUT_ROOT !== undefined
  || path.resolve(cliArgs[0]) !== workspace.stagePaths.f1
  || readdirSync(workspace.stagePaths.f2).length > 0)) throw new Error("Invalid workspace cleaning stage.");
const outputLayout = resolveFeature2OutputLayout(cliArgs, workspace?.stagePaths.f2 ?? process.env.AI_TVA_F2_OUTPUT_ROOT);
const loaded = loadF1ArtifactBundle(cliArgs[0]);
const f2Result = loaded.status === "inputRejected"
  ? loaded.report
  : createF2UserReport({ ...loaded.input, knowledgeBaseVersions: ["v1", "internal-v1"], mappingRuleVersion: "v1" });

if (!workspace) rmSync(outputLayout.outRoot, { recursive: true, force: true });
mkdirSync(outputLayout.outRoot, { recursive: true });
if (loaded.status === "accepted") {
  if (f2Result.f4Handoffs.length > 0) {
    const handoffRoot = path.join(outputLayout.outRoot, "f4-handoffs");
    mkdirSync(handoffRoot, { recursive: true });
    for (const handoff of f2Result.f4Handoffs) {
      writeFileSync(path.join(handoffRoot, `${safeName(handoff.worksheetName)}.json`), `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
    }
  }
}
writeFileSync(path.join(outputLayout.outRoot, outputLayout.reportJsonName), `${JSON.stringify(f2Result, null, 2)}\n`, "utf8");
writeFileSync(path.join(outputLayout.outRoot, outputLayout.reportMdName), `${renderF2Report(f2Result, { outputRoot: outputLayout.outRoot })}\n`, "utf8");

return {
  status: f2Result.status,
  outputDirectory: outputLayout.outRoot,
  ...(f2Result.status === "inputRejected" ? { artifactIssues: f2Result.artifactIssues } : { summary: f2Result.summary }),
};
}

try {
  const args = process.argv.slice(2);
  const result = runAnalysisStage({ stage: "f2", args }, (workspace) => executeF2(withoutAnalysisRoot(args), workspace));
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "failed") process.exitCode = 1;
} catch {
  console.error(JSON.stringify({ status: "failed", reasonCode: "cleaning_failed" }));
  process.exitCode = 1;
}