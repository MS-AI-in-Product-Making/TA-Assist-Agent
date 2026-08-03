import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createF2UserReport } from "../packages/workbook-catalog/dist/f2-user-report.js";
import { loadF1ArtifactBundle } from "./f2-artifact-loader.mjs";
import { resolveFeature2OutputLayout } from "./f2-output-layout.mjs";
import { renderF2Report } from "./f2-report.mjs";

const cliArgs = process.argv.slice(2);
const outputLayout = resolveFeature2OutputLayout(cliArgs);
const loaded = loadF1ArtifactBundle(cliArgs[0]);
const f2Result = loaded.status === "inputRejected"
  ? loaded.report
  : createF2UserReport({ ...loaded.input, knowledgeBaseVersion: "v1", mappingRuleVersion: "v1" });

rmSync(outputLayout.outRoot, { recursive: true, force: true });
mkdirSync(outputLayout.outRoot, { recursive: true });
writeFileSync(path.join(outputLayout.outRoot, outputLayout.reportJsonName), `${JSON.stringify(f2Result, null, 2)}\n`, "utf8");
writeFileSync(path.join(outputLayout.outRoot, outputLayout.reportMdName), `${renderF2Report(f2Result)}\n`, "utf8");

console.log(JSON.stringify({
  status: f2Result.status,
  outputDirectory: outputLayout.outRoot,
  ...(f2Result.status === "inputRejected" ? { artifactIssues: f2Result.artifactIssues } : { summary: f2Result.summary }),
}, null, 2));