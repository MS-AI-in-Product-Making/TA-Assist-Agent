import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { F8SessionSnapshot } from "@ai-assist/workbench";
import { canonicalSelectedWorksheetSetHash } from "@ai-assist/workbench";
import { runF3Analysis, runF4Calculation, runF5Interpretation, runF6Optimization, type F5InterpretationRequest, type F6OptimizationRequest, type RunContext } from "@ai-assist/workflow-runners";

export interface ProductionRoots { readonly f1Root: string; readonly f2Root: string; readonly f3Root?: string; readonly f4Root?: string; readonly f5Root?: string; readonly f6Root?: string }
export interface ProductionStageEnvironment {
  readonly repositoryRoot: string;
  readonly serverRoot: string;
  readonly sessionId: string;
  readonly workbookPath: string;
  readonly snapshot: F8SessionSnapshot;
  readonly roots: ProductionRoots;
  readonly context: RunContext;
  readonly baselineRunReference: string;
  readonly reviewContext?: { readonly workbookHash: string; readonly downstreamSelectionHash: string; readonly baselineRunReference: string };
}

export async function runProductionStage(stage: string, environment: ProductionStageEnvironment): Promise<{ readonly result: unknown; readonly roots: ProductionRoots }> {
  const outputBase = join(environment.serverRoot, "runtime", "workbench", "runner-output", environment.sessionId, "production");
  const publishRoot = join(environment.serverRoot, "runtime", "workbench", "runner-output", environment.sessionId);
  await mkdir(outputBase, { recursive: true });
  const selected = environment.snapshot.downstreamScopeSelection?.selectedWorksheetNames ?? environment.snapshot.initialScopeSelection?.selectedWorksheetNames ?? [];
  if (stage === "f3_running") {
    const f3Root = join(outputBase, "f3");
    const result = runF3Analysis({ artifactRoot: environment.roots.f2Root, selectedWorksheetNames: selected, outputRoot: f3Root }, { ...environment.context, managedOutputRoot: f3Root });
    return { result: { ...result, governance: { status: result.status }, reviewContext: environment.reviewContext, artifactReferences: [await artifact(environment.serverRoot, `f3-report:${environment.snapshot.inputRevision}`, "f3_report", result.reportJsonPath)] }, roots: { ...environment.roots, f3Root: result.outputDirectory } };
  }
  if (stage === "f4_running") {
    const scripts = await loadF4(environment.repositoryRoot);
    const f4Base = join(outputBase, "f4");
    const f2ReportPath = join(environment.roots.f2Root, "Feature2-Report.json");
    const result = runF4Calculation({ artifactRoot: environment.roots.f2Root, selectedWorksheetNames: selected }, { ...environment.context, managedOutputRoot: f4Base }, {
      resolveOutputLayout: () => scripts.resolveFeature4OutputLayout(["--f2-report", f2ReportPath], f4Base),
      loadHandoffs: scripts.loadF4Handoffs,
      calculateWorkflow: scripts.calculateF4Workflow,
      renderReport: scripts.renderF4Report,
    });
    if (result.status !== "completed" || result.calculationJsonPath === undefined) throw new Error(`F4 failed: ${result.reasonCode ?? "unknown"}`);
    const references = [await artifact(environment.serverRoot, `f4-calculation:${environment.snapshot.inputRevision}`, "f4_calculation", result.calculationJsonPath)];
    if (result.reportMdPath !== undefined) references.push(await artifact(environment.serverRoot, `f4-report:${environment.snapshot.inputRevision}`, "f4_report", result.reportMdPath));
    return { result: { ...result, reviewContext: environment.reviewContext, artifactReferences: references }, roots: { ...environment.roots, f4Root: result.outputDirectory } };
  }
  if (stage === "f5_running") {
    if (environment.roots.f3Root === undefined || environment.roots.f4Root === undefined || environment.reviewContext === undefined) throw new Error("F5 roots are unavailable.");
    const scripts = await loadF5(environment.repositoryRoot);
    const f5Base = join(outputBase, "f5");
    const result = runF5Interpretation({ f1ArtifactRoot: environment.roots.f1Root, f3ArtifactRoot: environment.roots.f3Root, f4ArtifactRoot: environment.roots.f4Root, selectedWorksheetNames: selected }, { ...environment.context, managedOutputRoot: f5Base }, {
      resolveOutputLayout: () => scripts.resolveFeature5OutputLayout({ f1ArtifactRoot: environment.roots.f1Root, f3ArtifactRoot: environment.roots.f3Root, f4ArtifactRoot: environment.roots.f4Root }, f5Base, () => new Date(), publishRoot),
      loadBundle: (request: F5InterpretationRequest) => scripts.loadF5ArtifactBundle({ f1ArtifactRoot: request.f1ArtifactRoot, f3ArtifactRoot: request.f3ArtifactRoot, f4ArtifactRoot: request.f4ArtifactRoot, selectedWorksheetNames: request.selectedWorksheetNames, imageObservationArtifact: request.imageObservationsPath } as never),
      renderReport: scripts.renderF5Report,
    });
    if (result.status === "failed" || result.reportJsonPath === undefined) throw new Error(`F5 failed: ${result.reasonCode ?? "unknown"}`);
    return { result: { ...result, reviewContext: environment.reviewContext, artifactReferences: [await artifact(environment.serverRoot, `f5-report:${environment.snapshot.inputRevision}`, "f5_report", result.reportJsonPath)] }, roots: { ...environment.roots, f5Root: result.outputDirectory } };
  }
  if (stage === "f6_running") {
    if (environment.roots.f3Root === undefined || environment.roots.f4Root === undefined || environment.roots.f5Root === undefined || environment.reviewContext === undefined) throw new Error("F6 roots are unavailable.");
    const scripts = await loadF6(environment.repositoryRoot);
    const f6Base = join(outputBase, "f6");
    const layout = scripts.resolveFeature6OutputLayout({ f2ArtifactRoot: environment.roots.f2Root, f3ArtifactRoot: environment.roots.f3Root, f4ArtifactRoot: environment.roots.f4Root, f5ArtifactRoot: environment.roots.f5Root }, f6Base, () => new Date(), publishRoot);
    const request = { f2ArtifactRoot: environment.roots.f2Root, f3ArtifactRoot: environment.roots.f3Root, f4ArtifactRoot: environment.roots.f4Root, f5ArtifactRoot: environment.roots.f5Root, selectedWorksheetNames: selected };
    const result = runF6Optimization(request, { ...environment.context, managedOutputRoot: f6Base }, {
      resolveOutputLayout: () => layout,
      loadBundle: (value: F6OptimizationRequest & { publishRoot?: string }) => scripts.loadF6ArtifactBundle({ ...value, publishRoot: layout.publishRoot } as never),
      createFinalReport: scripts.createF6FinalReportProjection,
      renderOptimization: scripts.renderF6Report,
    });
    if (result.status === "failed" || result.optimizationJsonPath === undefined || result.finalReportMdPath === undefined) throw new Error(`F6 failed: ${result.reasonCode ?? "unknown"}`);
    return { result: { ...result, reviewContext: environment.reviewContext, artifactReferences: [await artifact(environment.serverRoot, `f6-optimization:${environment.snapshot.inputRevision}`, "f6_optimization", result.optimizationJsonPath), await artifact(environment.serverRoot, `f6-report:${environment.snapshot.inputRevision}`, "f6_report", result.finalReportMdPath)] }, roots: { ...environment.roots, f6Root: result.outputDirectory } };
  }
  throw new Error(`Unsupported production stage: ${stage}`);
}

export function reviewContextFor(snapshot: F8SessionSnapshot, baselineRunReference: string) {
  const initial = snapshot.initialScopeSelection;
  const scope = snapshot.downstreamScopeSelection;
  if (initial === undefined || scope === undefined) throw new Error("Worksheet selections are unavailable for production export.");
  if (initial.provenance !== "user" || scope.provenance !== "user") {
    throw new Error("Production export requires user-confirmed worksheet selections.");
  }
  if (initial.workbookContentHash !== scope.workbookContentHash) {
    throw new Error("Downstream selection workbook hash does not match the initial confirmation.");
  }
  if (scope.selectedWorksheetNames.length === 0 || new Set(scope.selectedWorksheetNames).size !== scope.selectedWorksheetNames.length) {
    throw new Error("Downstream worksheet selection must include a unique non-empty worksheet list.");
  }
  const initialWorksheets = new Set(initial.selectedWorksheetNames);
  if (scope.selectedWorksheetNames.some((worksheetName) => !initialWorksheets.has(worksheetName))) {
    throw new Error("Downstream worksheet selection contains out-of-scope worksheets.");
  }
  return { workbookHash: scope.workbookContentHash, downstreamSelectionHash: canonicalSelectedWorksheetSetHash(scope.selectedWorksheetNames), baselineRunReference };
}

async function artifact(rootDir: string, artifactId: string, kind: "f3_report" | "f4_calculation" | "f4_report" | "f5_report" | "f6_optimization" | "f6_report", absolutePath: string) {
  const bytes = await readFile(absolutePath);
  const relativePath = relative(resolve(rootDir), resolve(absolutePath));
  if (relativePath.startsWith("..")) throw new Error(`${kind} escaped the managed root.`);
  return { artifactId, kind, relativePath, contentHash: createHash("sha256").update(bytes).digest("hex") };
}

async function modules(root: string, names: readonly string[]) {
  return Object.assign({}, ...await Promise.all(names.map(async (name) => import(pathToFileURL(join(root, "scripts", name)).href)))) as Record<string, (...args: never[]) => never>;
}
async function loadF4(root: string) { return await modules(root, ["f4-output-layout.mjs", "f4-artifact-loader.mjs", "f4-calculation-workflow.mjs", "f4-excel-mapping.mjs", "f4-excel-comparison.mjs", "f4-report.mjs"]) as any; }
async function loadF5(root: string) { return await modules(root, ["f5-output-layout.mjs", "f5-artifact-loader.mjs", "f5-report.mjs"]) as any; }
async function loadF6(root: string) { return await modules(root, ["f6-output-layout.mjs", "f6-artifact-loader.mjs", "f6-final-report.mjs", "f6-report.mjs"]) as any; }
