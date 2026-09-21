import path from "node:path";

import { workbookCatalogFileNameSchema } from "@ai-assist/contracts";

import { isWithinOrEqual } from "./path-containment.js";

export const ANALYSIS_WORKSPACE_VERSION = "analysis-workspace-v1";
export const ANALYSIS_WORKSPACE_SUMMARY_FILE_NAME = "analysis-run-summary.json";

export const ANALYSIS_STAGE_DIRS = {
	f1: "01 - F1 Data Parsing",
	f2: "02 - F2 Data Cleaning",
	f3: "03 - F3 Drawing Governance",
	f4: "04 - F4 Calculation Engine",
	f5: "05 - F5 Result Interpretation",
	f6: "06 - F6 Design Optimization",
} as const;

export type AnalysisStage = keyof typeof ANALYSIS_STAGE_DIRS;
export type AnalysisStageStatus = "pending" | "running" | "completed" | "failed" | "blocked";
export type AnalysisWorkspaceOverallStatus = "in_progress" | "completed" | "failed";

export interface AnalysisWorkspaceResolvedStagePaths {
	readonly f1: string;
	readonly f2: string;
	readonly f3: string;
	readonly f4: string;
	readonly f5: string;
	readonly f6: string;
}

export interface AnalysisWorkspaceStageDirectoryNames {
	readonly f1: typeof ANALYSIS_STAGE_DIRS.f1;
	readonly f2: typeof ANALYSIS_STAGE_DIRS.f2;
	readonly f3: typeof ANALYSIS_STAGE_DIRS.f3;
	readonly f4: typeof ANALYSIS_STAGE_DIRS.f4;
	readonly f5: typeof ANALYSIS_STAGE_DIRS.f5;
	readonly f6: typeof ANALYSIS_STAGE_DIRS.f6;
}

export interface AnalysisWorkspaceLayout {
	readonly contractVersion: typeof ANALYSIS_WORKSPACE_VERSION;
	readonly analysisRoot: string;
	readonly summaryPath: string;
	readonly workbookFileName: string;
	readonly workbookContentHash: string;
	readonly allocationDate: string;
	readonly stagePaths: AnalysisWorkspaceResolvedStagePaths;
}

export interface AnalysisWorkspaceStageSummary {
	readonly status: AnalysisStageStatus;
	readonly artifacts: Readonly<Record<string, string>>;
}

export interface AnalysisWorkspaceSummary {
	readonly contractVersion: typeof ANALYSIS_WORKSPACE_VERSION;
	readonly analysisRoot: string;
	readonly summaryPath: string;
	readonly workbook: {
		readonly fileName: string;
		readonly contentHash: string;
	};
	readonly allocationDate: string;
	readonly currentStage: AnalysisStage;
	readonly stageDirectories: AnalysisWorkspaceStageDirectoryNames;
	readonly stages: Readonly<Record<AnalysisStage, AnalysisWorkspaceStageSummary>>;
	readonly overallStatus: AnalysisWorkspaceOverallStatus;
	readonly failedStage?: AnalysisStage;
	readonly failureCategory?: string;
}

const ANALYSIS_STAGES = Object.keys(ANALYSIS_STAGE_DIRS) as AnalysisStage[];
const STAGE_STATUS_SET: ReadonlySet<AnalysisStageStatus> = new Set(["pending", "running", "completed", "failed", "blocked"]);
const OVERALL_STATUS_SET: ReadonlySet<AnalysisWorkspaceOverallStatus> = new Set(["in_progress", "completed", "failed"]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const LOCAL_DATE_PATTERN = /^\d{8}$/;

export function formatLocalDateYYYYMMDD(now: Date): string {
	const year = String(now.getFullYear());
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}${month}${day}`;
}

export function resolveAnalysisWorkspaceStagePaths(analysisRoot: string): AnalysisWorkspaceResolvedStagePaths {
	const resolvedRoot = path.resolve(analysisRoot);
	return {
		f1: path.join(resolvedRoot, ANALYSIS_STAGE_DIRS.f1),
		f2: path.join(resolvedRoot, ANALYSIS_STAGE_DIRS.f2),
		f3: path.join(resolvedRoot, ANALYSIS_STAGE_DIRS.f3),
		f4: path.join(resolvedRoot, ANALYSIS_STAGE_DIRS.f4),
		f5: path.join(resolvedRoot, ANALYSIS_STAGE_DIRS.f5),
		f6: path.join(resolvedRoot, ANALYSIS_STAGE_DIRS.f6),
	};
}

export function validateAnalysisWorkspaceLayout(layout: AnalysisWorkspaceLayout): void {
	if (layout.contractVersion !== ANALYSIS_WORKSPACE_VERSION) {
		throw new Error("Analysis workspace version is invalid.");
	}

	const analysisRoot = path.resolve(layout.analysisRoot);
	validateWorkbookIdentity(layout.workbookFileName, layout.workbookContentHash, "Analysis workspace layout workbook");
	validateAllocationDate(layout.allocationDate);

	const expectedSummaryPath = path.join(analysisRoot, ANALYSIS_WORKSPACE_SUMMARY_FILE_NAME);
	if (path.resolve(layout.summaryPath) !== expectedSummaryPath) {
		throw new Error("Analysis workspace summary path is invalid.");
	}

	const expectedStagePaths = resolveAnalysisWorkspaceStagePaths(analysisRoot);
	for (const stage of ANALYSIS_STAGES) {
		const candidatePath = path.resolve(layout.stagePaths[stage]);
		if (candidatePath !== expectedStagePaths[stage]) {
			throw new Error(`Analysis workspace stage path for ${stage} is invalid.`);
		}
		if (!isWithinOrEqual(analysisRoot, candidatePath)) {
			throw new Error(`Analysis workspace stage path for ${stage} escaped the analysis root.`);
		}
	}
}

export function assertAnalysisWorkspaceWorkbookIdentity(
	workspace: Pick<AnalysisWorkspaceLayout, "workbookFileName" | "workbookContentHash">,
	workbookFileName: string,
	workbookContentHash: string,
): void {
	const expectedFileName = workbookCatalogFileNameSchema.parse(workbookFileName);
	validateContentHash(workbookContentHash, "Analysis workspace workbook content hash");

	if (workspace.workbookFileName !== expectedFileName || workspace.workbookContentHash !== workbookContentHash) {
		throw new Error("Analysis workspace workbook identity mismatch.");
	}
}

export function validateAnalysisWorkspaceSummary(summary: AnalysisWorkspaceSummary): void {
	if (summary.contractVersion !== ANALYSIS_WORKSPACE_VERSION) {
		throw new Error("Analysis workspace summary version is invalid.");
	}

	const analysisRoot = path.resolve(summary.analysisRoot);
	validateWorkbookIdentity(summary.workbook.fileName, summary.workbook.contentHash, "Analysis workspace summary workbook");
	validateAllocationDate(summary.allocationDate);

	const expectedSummaryPath = path.join(analysisRoot, ANALYSIS_WORKSPACE_SUMMARY_FILE_NAME);
	if (path.resolve(summary.summaryPath) !== expectedSummaryPath) {
		throw new Error("Analysis workspace summary path is invalid.");
	}

	if (!ANALYSIS_STAGES.includes(summary.currentStage)) {
		throw new Error("Analysis workspace current stage is invalid.");
	}

	validateSummaryStageDirectories(summary.stageDirectories);

	for (const stage of ANALYSIS_STAGES) {
		const stageSummary = summary.stages[stage];
		if (stageSummary === undefined) {
			throw new Error(`Analysis workspace stage ${stage} is missing.`);
		}
		if (!STAGE_STATUS_SET.has(stageSummary.status)) {
			throw new Error(`Analysis workspace stage ${stage} status is invalid.`);
		}
		validateStageArtifacts(analysisRoot, stage, stageSummary);
	}

	validateStageOrdering(summary.stages);

	if (!OVERALL_STATUS_SET.has(summary.overallStatus)) {
		throw new Error("Analysis workspace overall status is invalid.");
	}

	if (summary.overallStatus === "completed" && ANALYSIS_STAGES.some((stage) => summary.stages[stage].status !== "completed")) {
		throw new Error("Analysis workspace overall status requires every stage to be completed.");
	}

	if (summary.overallStatus === "failed") {
		if (!summary.failedStage || !ANALYSIS_STAGES.includes(summary.failedStage)) {
			throw new Error("Analysis workspace failed stage is invalid.");
		}
		if (typeof summary.failureCategory !== "string" || summary.failureCategory.trim() === "") {
			throw new Error("Analysis workspace failure category is invalid.");
		}
		if (summary.currentStage !== summary.failedStage || summary.stages[summary.failedStage].status !== "failed") {
			throw new Error("Analysis workspace failed stage must match the recorded failed stage.");
		}
	} else if (summary.failedStage !== undefined || summary.failureCategory !== undefined) {
		throw new Error("Analysis workspace failure details are only allowed for failed summaries.");
	}
}

function validateWorkbookIdentity(fileName: string, contentHash: string, label: string): void {
	workbookCatalogFileNameSchema.parse(fileName);
	validateContentHash(contentHash, `${label} content hash`);
}

function validateContentHash(contentHash: string, label: string): void {
	if (!SHA256_PATTERN.test(contentHash)) {
		throw new Error(`${label} must be a lowercase sha256.`);
	}
}

function validateAllocationDate(allocationDate: string): void {
	if (!LOCAL_DATE_PATTERN.test(allocationDate)) {
		throw new Error("Analysis workspace allocation date is invalid.");
	}
}

function validateSummaryStageDirectories(stageDirectories: AnalysisWorkspaceSummary["stageDirectories"]): void {
	for (const stage of ANALYSIS_STAGES) {
		if (stageDirectories[stage] !== ANALYSIS_STAGE_DIRS[stage]) {
			throw new Error(`Analysis workspace stage path for ${stage} is invalid.`);
		}
		if (isAbsoluteAny(stageDirectories[stage])) {
			throw new Error(`Analysis workspace stage path for ${stage} must remain relative.`);
		}
	}
}

function validateStageArtifacts(
	analysisRoot: string,
	stage: AnalysisStage,
	stageSummary: AnalysisWorkspaceStageSummary,
): void {
	const artifacts = Object.entries(stageSummary.artifacts);
	if (stageSummary.status === "completed" && artifacts.length === 0) {
		throw new Error(`Analysis workspace stage ${stage} requires validated artifacts before completion.`);
	}

	for (const [artifactName, artifactPath] of artifacts) {
		if (artifactName.trim() === "") {
			throw new Error(`Analysis workspace stage ${stage} artifact name is invalid.`);
		}
		if (!isSafeStageRelativePath(analysisRoot, stage, artifactPath)) {
			throw new Error(`Analysis workspace stage ${stage} artifact path is invalid.`);
		}
	}
}

function validateStageOrdering(stages: AnalysisWorkspaceSummary["stages"]): void {
	let predecessorIncomplete = false;
	for (const stage of ANALYSIS_STAGES) {
		const stageStatus = stages[stage].status;
		if (stageStatus !== "completed") predecessorIncomplete = true;
		else if (predecessorIncomplete) {
			throw new Error(`Analysis workspace stage ${stage} cannot be completed before its completed predecessor chain.`);
		}
	}
}

function isSafeStageRelativePath(analysisRoot: string, stage: AnalysisStage, artifactPath: string): boolean {
	if (artifactPath.trim() === "" || isAbsoluteAny(artifactPath)) return false;

	const stageRoot = path.join(analysisRoot, ANALYSIS_STAGE_DIRS[stage]);
	const resolvedArtifactPath = path.resolve(analysisRoot, artifactPath);
	return isWithinOrEqual(stageRoot, resolvedArtifactPath);
}

function isAbsoluteAny(candidatePath: string): boolean {
	return path.isAbsolute(candidatePath) || path.posix.isAbsolute(candidatePath) || path.win32.isAbsolute(candidatePath);
}
