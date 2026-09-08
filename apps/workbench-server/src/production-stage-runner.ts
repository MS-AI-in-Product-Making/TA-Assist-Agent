import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { f5MultimodalArtifactV3Schema } from "@ai-assist/contracts";

import { canonicalSelectedWorksheetSetHash, type F8SessionSnapshot, type RuntimeSkillResult, type TaWorkbookOrchestrator } from "@ai-assist/workbench";
import type { RunContext } from "@ai-assist/workflow-runners";

export interface ProductionRoots { readonly f1Root: string; readonly f2Root: string; readonly f3Root?: string; readonly f4Root?: string; readonly f5Root?: string; readonly f6Root?: string }
export interface CallerAuthorizedF6Inputs {
  readonly analysisContextPath?: string;
  readonly expectedAnalysisContextContentHash?: string;
  readonly optimizationTargetsPath?: string;
  readonly expectedOptimizationTargetsContentHash?: string;
}

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
  readonly callerAuthorizedF6Inputs?: CallerAuthorizedF6Inputs;
  readonly multimodalArtifact?: { readonly path: string; readonly contentHash: string };
}

export async function runProductionStage(stage: string, environment: ProductionStageEnvironment, orchestrator: TaWorkbookOrchestrator): Promise<{ readonly result: unknown; readonly roots: ProductionRoots }> {
  const outputBase = join(environment.serverRoot, "runtime", "workbench", "runner-output", environment.sessionId, "production");
  const publishRoot = join(environment.serverRoot, "runtime", "workbench", "runner-output", environment.sessionId);
  await mkdir(outputBase, { recursive: true });
  const worksheetScope = environment.snapshot.downstreamScopeSelection ?? environment.snapshot.initialScopeSelection;
  const idempotencyKey = `${environment.context.attemptId}:${stage}`;
  const selected = environment.snapshot.downstreamScopeSelection?.selectedWorksheetNames ?? environment.snapshot.initialScopeSelection?.selectedWorksheetNames ?? [];
  if (stage === "f3_running") {
    const f3Root = join(outputBase, "f3");
    const result = requireRuntimeSkillOutput(await orchestrator.runStage("f3_running", {
      inputRevision: environment.snapshot.inputRevision,
      idempotencyKey,
      artifactReferences: [{ artifactId: `f2:${environment.snapshot.inputRevision}`, kind: "f2_report", revision: environment.snapshot.inputRevision, validated: true }],
      ...(worksheetScope === undefined ? {} : { worksheetScope }),
      input: {
        request: { artifactRoot: environment.roots.f2Root, selectedWorksheetNames: selected, outputRoot: f3Root },
        context: { ...environment.context, managedOutputRoot: f3Root },
      },
    }), "dimension-traceability-review-v1") as { readonly status: string; readonly reportJsonPath: string; readonly outputDirectory: string };
    return { result: { ...result, governance: { status: result.status }, reviewContext: environment.reviewContext, artifactReferences: [await artifact(environment.serverRoot, `f3-report:${environment.snapshot.inputRevision}`, "f3_report", result.reportJsonPath)] }, roots: { ...environment.roots, f3Root: result.outputDirectory } };
  }
  if (stage === "f4_running") {
    const scripts = await loadF4(environment.repositoryRoot);
    const f4Base = join(outputBase, "f4");
    const f2ReportPath = join(environment.roots.f2Root, "Feature2-Report.json");
    const result = requireRuntimeSkillOutput(await orchestrator.runStage("f4_running", {
      inputRevision: environment.snapshot.inputRevision,
      idempotencyKey,
      artifactReferences: [{ artifactId: `f2:${environment.snapshot.inputRevision}`, kind: "f2_report", revision: environment.snapshot.inputRevision, validated: true }],
      ...(worksheetScope === undefined ? {} : { worksheetScope }),
      input: {
        request: { artifactRoot: environment.roots.f2Root, selectedWorksheetNames: selected },
        context: { ...environment.context, managedOutputRoot: f4Base },
        dependencies: {
          resolveOutputLayout: () => scripts.resolveFeature4OutputLayout(["--f2-report", f2ReportPath], f4Base),
          loadHandoffs: scripts.loadF4Handoffs,
          calculateWorkflow: scripts.calculateF4Workflow,
          renderReport: scripts.renderF4Report,
        },
      },
    }), "tolerance-performance-calculation-v1") as { readonly status: string; readonly reasonCode?: string; readonly calculationJsonPath?: string; readonly reportMdPath?: string; readonly outputDirectory: string };
    if (result.status !== "completed" || result.calculationJsonPath === undefined) throw new Error(`F4 failed: ${result.reasonCode ?? "unknown"}`);
    const references = [await artifact(environment.serverRoot, `f4-calculation:${environment.snapshot.inputRevision}`, "f4_calculation", result.calculationJsonPath)];
    if (result.reportMdPath !== undefined) references.push(await artifact(environment.serverRoot, `f4-report:${environment.snapshot.inputRevision}`, "f4_report", result.reportMdPath));
    return { result: { ...result, reviewContext: environment.reviewContext, artifactReferences: references }, roots: { ...environment.roots, f4Root: result.outputDirectory } };
  }
  if (stage === "f5_running") {
    if (environment.roots.f3Root === undefined || environment.roots.f4Root === undefined || environment.reviewContext === undefined) throw new Error("F5 roots are unavailable.");
    const multimodal = await requireMultimodalArtifact(environment, selected, "f5");
    const scripts = await loadF5(environment.repositoryRoot);
    const f5Base = join(outputBase, "f5");
    const result = requireRuntimeSkillOutput(await orchestrator.runStage("f5_running", {
      inputRevision: environment.snapshot.inputRevision,
      idempotencyKey,
      artifactReferences: [
        { artifactId: `f3:${environment.snapshot.inputRevision}`, kind: "f3_report", revision: environment.snapshot.inputRevision, validated: true },
        { artifactId: `f4:${environment.snapshot.inputRevision}`, kind: "f4_calculation", revision: environment.snapshot.inputRevision, validated: true },
        { artifactId: `f5-multimodal:${environment.snapshot.inputRevision}`, kind: "f5_multimodal", revision: environment.snapshot.inputRevision, validated: true },
      ],
      ...(worksheetScope === undefined ? {} : { worksheetScope }),
      input: {
        request: { f1ArtifactRoot: environment.roots.f1Root, f3ArtifactRoot: environment.roots.f3Root, f4ArtifactRoot: environment.roots.f4Root, selectedWorksheetNames: selected, modelInterpretationPath: multimodal.path, expectedModelInterpretationContentHash: multimodal.contentHash },
        context: { ...environment.context, managedOutputRoot: f5Base },
        dependencies: {
          resolveOutputLayout: () => scripts.resolveFeature5OutputLayout({ f1ArtifactRoot: environment.roots.f1Root, f3ArtifactRoot: environment.roots.f3Root, f4ArtifactRoot: environment.roots.f4Root }, f5Base, () => new Date(), publishRoot),
          loadBundle: (request: { readonly f1ArtifactRoot: string; readonly f3ArtifactRoot: string; readonly f4ArtifactRoot: string; readonly selectedWorksheetNames?: readonly string[]; readonly imageObservationsPath?: string; readonly modelInterpretationPath: string; readonly expectedModelInterpretationContentHash: string }) => scripts.loadF5ArtifactBundle({ f1ArtifactRoot: request.f1ArtifactRoot, f3ArtifactRoot: request.f3ArtifactRoot, f4ArtifactRoot: request.f4ArtifactRoot, selectedWorksheetNames: request.selectedWorksheetNames, imageObservationArtifact: request.imageObservationsPath, modelInterpretationArtifact: request.modelInterpretationPath, expectedModelInterpretationContentHash: request.expectedModelInterpretationContentHash } as never),
          renderReport: scripts.renderF5Report,
        },
      },
    }), "engineering-interpretation-v1") as { readonly status: string; readonly reasonCode?: string; readonly reportJsonPath?: string; readonly outputDirectory: string };
    if (result.status === "failed" || result.reportJsonPath === undefined) throw new Error(`F5 failed: ${result.reasonCode ?? "unknown"}`);
    return { result: { ...result, reviewContext: environment.reviewContext, artifactReferences: [await artifact(environment.serverRoot, `f5-multimodal:${environment.snapshot.inputRevision}`, "f5_multimodal", multimodal.path), await artifact(environment.serverRoot, `f5-report:${environment.snapshot.inputRevision}`, "f5_report", result.reportJsonPath)] }, roots: { ...environment.roots, f5Root: result.outputDirectory } };
  }
  if (stage === "f6_running") {
    if (environment.roots.f3Root === undefined || environment.roots.f4Root === undefined || environment.roots.f5Root === undefined || environment.reviewContext === undefined) throw new Error("F6 roots are unavailable.");
    const multimodal = await requireMultimodalArtifact(environment, selected, "f6");
    const scripts = await loadF6(environment.repositoryRoot);
    const f6Base = join(outputBase, "f6");
    const layout = scripts.resolveFeature6OutputLayout({ f2ArtifactRoot: environment.roots.f2Root, f3ArtifactRoot: environment.roots.f3Root, f4ArtifactRoot: environment.roots.f4Root, f5ArtifactRoot: environment.roots.f5Root }, f6Base, () => new Date(), publishRoot);
    const request = {
      f2ArtifactRoot: environment.roots.f2Root,
      f3ArtifactRoot: environment.roots.f3Root,
      f4ArtifactRoot: environment.roots.f4Root,
      f5ArtifactRoot: environment.roots.f5Root,
      selectedWorksheetNames: selected,
      interactionLanguage: environment.snapshot.interactionLanguage,
      modelInterpretationPath: multimodal.path,
      expectedModelInterpretationContentHash: multimodal.contentHash,
      requireMultimodalV3: true,
      ...(environment.callerAuthorizedF6Inputs?.analysisContextPath === undefined ? {} : { analysisContextPath: environment.callerAuthorizedF6Inputs.analysisContextPath }),
      ...(environment.callerAuthorizedF6Inputs?.expectedAnalysisContextContentHash === undefined ? {} : { expectedAnalysisContextContentHash: environment.callerAuthorizedF6Inputs.expectedAnalysisContextContentHash }),
      ...(environment.callerAuthorizedF6Inputs?.optimizationTargetsPath === undefined ? {} : { optimizationTargetsPath: environment.callerAuthorizedF6Inputs.optimizationTargetsPath }),
      ...(environment.callerAuthorizedF6Inputs?.expectedOptimizationTargetsContentHash === undefined ? {} : { expectedOptimizationTargetsContentHash: environment.callerAuthorizedF6Inputs.expectedOptimizationTargetsContentHash }),
    };
    const result = requireRuntimeSkillOutput(await orchestrator.runStage("f6_running", {
      inputRevision: environment.snapshot.inputRevision,
      idempotencyKey,
      artifactReferences: [
        { artifactId: `f3:${environment.snapshot.inputRevision}`, kind: "f3_report", revision: environment.snapshot.inputRevision, validated: true },
        { artifactId: `f4:${environment.snapshot.inputRevision}`, kind: "f4_calculation", revision: environment.snapshot.inputRevision, validated: true },
        { artifactId: `f5:${environment.snapshot.inputRevision}`, kind: "f5_report", revision: environment.snapshot.inputRevision, validated: true },
      ],
      ...(worksheetScope === undefined ? {} : { worksheetScope }),
      input: {
        request,
        context: { ...environment.context, managedOutputRoot: f6Base },
        dependencies: {
          resolveOutputLayout: () => layout,
          loadBundle: (value: { readonly publishRoot?: string }) => scripts.loadF6ArtifactBundle({
            ...value,
            ...request,
            publishRoot: layout.publishRoot,
            analysisContextArtifact: request.analysisContextPath,
            optimizationTargetsArtifact: request.optimizationTargetsPath,
            modelInterpretationArtifactRoot: dirname(request.modelInterpretationPath),
            modelInterpretationArtifact: basename(request.modelInterpretationPath),
            expectedModelInterpretationContentHash: request.expectedModelInterpretationContentHash,
          } as never),
          createFinalReport: scripts.createF6FinalReportProjection,
          renderOptimization: scripts.renderF6Report,
        },
      },
    }), "improvement-evaluation-v1") as {
      readonly status: string;
      readonly reasonCode?: string;
      readonly optimizationJsonPath?: string;
      readonly optimizationMdPath?: string;
      readonly finalReportMdPath?: string;
      readonly runSummaryPath?: string;
      readonly manifestPath?: string;
      readonly finalReportProjection?: unknown;
      readonly outputDirectory: string;
    };
    if (result.status === "failed"
      || result.optimizationJsonPath === undefined
      || result.optimizationMdPath === undefined
      || result.finalReportMdPath === undefined
      || result.runSummaryPath === undefined
      || result.manifestPath === undefined
      || result.finalReportProjection === undefined) {
      throw new Error(`F6 failed: ${result.reasonCode ?? "unknown"}`);
    }
    const projectionPath = await writeManagedProjectionArtifact(environment.serverRoot, environment.sessionId, environment.snapshot.inputRevision, result.finalReportProjection);
    return {
      result: {
        ...result,
        reviewContext: environment.reviewContext,
        artifactReferences: [
          await artifact(environment.serverRoot, `f6-optimization:${environment.snapshot.inputRevision}`, "f6_optimization", result.optimizationJsonPath),
          await artifact(environment.serverRoot, `f6-optimization-markdown:${environment.snapshot.inputRevision}`, "f6_optimization_markdown", result.optimizationMdPath),
          await artifact(environment.serverRoot, `f6-report:${environment.snapshot.inputRevision}`, "f6_report", result.finalReportMdPath),
          await artifact(environment.serverRoot, `f6-run-summary:${environment.snapshot.inputRevision}`, "f6_run_summary", result.runSummaryPath),
          await artifact(environment.serverRoot, `f6-manifest:${environment.snapshot.inputRevision}`, "f6_manifest", result.manifestPath),
          await artifact(environment.serverRoot, `engineering-summary-projection:${environment.snapshot.inputRevision}`, "engineering_summary_projection", projectionPath),
        ],
      },
      roots: { ...environment.roots, f6Root: result.outputDirectory },
    };
  }
  throw new Error(`Unsupported production stage: ${stage}`);
}

async function requireMultimodalArtifact(environment: ProductionStageEnvironment, selectedWorksheetNames: readonly string[], consumer: "f5" | "f6") {
  const identity = environment.multimodalArtifact;
  if (identity === undefined) throw new Error("Mandatory multimodal interpretation artifact is unavailable.");
  const bytes = await readFile(identity.path);
  if (createHash("sha256").update(bytes).digest("hex") !== identity.contentHash) throw new Error("Mandatory multimodal interpretation artifact hash mismatch.");
  const parsed = f5MultimodalArtifactV3Schema.safeParse(JSON.parse(bytes.toString("utf8")));
  if (!parsed.success
    || parsed.data.sessionId !== environment.sessionId
    || (consumer === "f5" ? parsed.data.revision !== environment.snapshot.revision : parsed.data.revision >= environment.snapshot.revision)
    || parsed.data.inputRevision !== environment.snapshot.inputRevision
    || parsed.data.workbookContentHash !== environment.reviewContext?.workbookHash
    || JSON.stringify(parsed.data.selectedWorksheetNames) !== JSON.stringify(selectedWorksheetNames)) {
    throw new Error("Mandatory multimodal interpretation artifact authority mismatch.");
  }
  if (consumer === "f6") {
    const references = environment.snapshot.artifactRefs?.filter((reference) => reference.kind === "f5_multimodal"
      && reference.validated
      && reference.revision === environment.snapshot.inputRevision
      && reference.artifactId === `f5-multimodal:${environment.snapshot.inputRevision}`
      && reference.contentHash === identity.contentHash
      && resolve(environment.serverRoot, reference.relativePath) === resolve(identity.path)) ?? [];
    if (references.length !== 1) throw new Error("Mandatory multimodal interpretation artifact reference mismatch.");
  }
  return { ...identity, artifact: parsed.data };
}

function requireRuntimeSkillOutput<Output>(result: RuntimeSkillResult<Output>, skillId: string): Output {
  if (result.status === "failed") {
    if (result.error instanceof Error) {
      throw result.error;
    }
    throw new Error(`${skillId} failed: ${result.summary ?? result.reasonCode ?? "unknown"}`);
  }
  if (result.status === "blocked") {
    throw new Error(`${skillId} blocked: ${result.summary ?? result.reasonCode ?? "unknown"}`);
  }
  if (result.output === undefined) {
    throw new Error(`${skillId} returned no output.`);
  }
  return result.output;
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

async function artifact(rootDir: string, artifactId: string, kind: "f3_report" | "f4_calculation" | "f4_report" | "f5_multimodal" | "f5_report" | "f6_optimization" | "f6_report" | "f6_optimization_markdown" | "f6_run_summary" | "f6_manifest" | "engineering_summary_projection", absolutePath: string) {
  const bytes = await readFile(absolutePath);
  const relativePath = relative(resolve(rootDir), resolve(absolutePath));
  if (relativePath.startsWith("..")) throw new Error(`${kind} escaped the managed root.`);
  return { artifactId, kind, relativePath, contentHash: createHash("sha256").update(bytes).digest("hex") };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function writeManagedProjectionArtifact(rootDir: string, sessionId: string, inputRevision: number, projection: unknown): Promise<string> {
  const target = join(
    rootDir,
    "runtime",
    "workbench",
    "managed-artifacts",
    sessionId,
    "engineering-summary-projection",
    `revision-${inputRevision}.json`,
  );
  await mkdir(join(target, ".."), { recursive: true });
  await writeFile(target, `${stableStringify(projection)}\n`, "utf8");
  return target;
}

async function modules(root: string, names: readonly string[]) {
  return Object.assign({}, ...await Promise.all(names.map(async (name) => import(pathToFileURL(join(root, "scripts", name)).href)))) as Record<string, (...args: never[]) => never>;
}
async function loadF4(root: string) { return await modules(root, ["f4-output-layout.mjs", "f4-artifact-loader.mjs", "f4-calculation-workflow.mjs", "f4-excel-mapping.mjs", "f4-excel-comparison.mjs", "f4-report.mjs"]) as any; }
async function loadF5(root: string) { return await modules(root, ["f5-output-layout.mjs", "f5-artifact-loader.mjs", "f5-report.mjs"]) as any; }
async function loadF6(root: string) { return await modules(root, ["f6-output-layout.mjs", "f6-artifact-loader.mjs", "f6-final-report.mjs", "f6-report.mjs"]) as any; }
