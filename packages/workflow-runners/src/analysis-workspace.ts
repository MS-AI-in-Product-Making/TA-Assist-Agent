import * as fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

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

export interface AllocateAnalysisWorkspaceInput {
	readonly testRoot: string;
	readonly workbookFileName: string;
	readonly workbookContentHash: string;
	readonly now: Date;
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
	readonly failedStage?: AnalysisStage | undefined;
	readonly failureCategory?: string | undefined;
}

interface DirectoryIdentity {
	readonly requestedPath: string;
	readonly canonicalPath: string;
	readonly requestedDev: number;
	readonly requestedIno: number;
	readonly canonicalDev: number;
	readonly canonicalIno: number;
}

const ANALYSIS_STAGES = Object.keys(ANALYSIS_STAGE_DIRS) as AnalysisStage[];
const STAGE_STATUS_SET: ReadonlySet<AnalysisStageStatus> = new Set(["pending", "running", "completed", "failed", "blocked"]);
const OVERALL_STATUS_SET: ReadonlySet<AnalysisWorkspaceOverallStatus> = new Set(["in_progress", "completed", "failed"]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const LOCAL_DATE_PATTERN = /^\d{8}$/;
const MAX_ALLOCATION_ATTEMPTS = 1_000;

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

export function allocateAnalysisWorkspace(input: AllocateAnalysisWorkspaceInput): AnalysisWorkspaceLayout {
	const workbookFileName = workbookCatalogFileNameSchema.parse(input.workbookFileName);
	validateContentHash(input.workbookContentHash, "Analysis workspace workbook content hash");
	validateNow(input.now);
	const trustedTestRoot = ensureTrustedTestRoot(input.testRoot);

	const allocationDate = formatLocalDateYYYYMMDD(input.now);
	validateAllocationDate(allocationDate);
	const workbookBaseName = workbookFileName.slice(0, -path.extname(workbookFileName).length);
	const allocationRootBaseName = `${allocationDate} - ${workbookBaseName}`;

	for (let suffixIndex = 0; suffixIndex < MAX_ALLOCATION_ATTEMPTS; suffixIndex += 1) {
		assertDirectoryIdentityUnchanged(trustedTestRoot, "Analysis workspace test root");
		const allocationRootName = suffixIndex === 0 ? allocationRootBaseName : `${allocationRootBaseName} -${suffixIndex}`;
		const analysisRoot = path.resolve(path.join(trustedTestRoot.canonicalPath, allocationRootName));
		assertPathWithinRoot(trustedTestRoot.canonicalPath, analysisRoot, "Analysis workspace root");

		try {
			fs.mkdirSync(analysisRoot);
		} catch (error) {
			if (isDirectoryAlreadyAllocated(error)) {
				continue;
			}
			throw error;
		}

		const allocatedRootIdentity = captureDirectoryIdentity(analysisRoot, "Analysis workspace root");
		try {
			validateAllocatedRootAfterCreation(trustedTestRoot, allocatedRootIdentity);
		} catch (error) {
			throw failClosedAfterPostCreateValidation(error, allocatedRootIdentity);
		}

		let createdStageDirectories: readonly DirectoryIdentity[] = [];
		try {
			const stagePaths = resolveAnalysisWorkspaceStagePaths(analysisRoot);
			createdStageDirectories = createStageDirectories(analysisRoot, stagePaths);
			const layout = createAllocatedLayout(analysisRoot, workbookFileName, input.workbookContentHash, allocationDate, stagePaths);
			validateAnalysisWorkspaceLayout(layout);
			return layout;
		} catch (error) {
			if (hasCreatedDirectoryIdentities(error)) {
				createdStageDirectories = error.createdDirectories;
			}
			cleanupPartialAllocation(allocatedRootIdentity, createdStageDirectories);
			throw error;
		}
	}

	throw new Error(`Analysis workspace root allocation exceeded ${MAX_ALLOCATION_ATTEMPTS} attempts.`);
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

	validateStageOrdering(summary);

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

export function createInitialAnalysisWorkspaceSummary(layout: AnalysisWorkspaceLayout): AnalysisWorkspaceSummary {
	validateAnalysisWorkspaceLayout(layout);
	const summary: AnalysisWorkspaceSummary = {
		contractVersion: ANALYSIS_WORKSPACE_VERSION,
		analysisRoot: layout.analysisRoot,
		summaryPath: layout.summaryPath,
		workbook: {
			fileName: layout.workbookFileName,
			contentHash: layout.workbookContentHash,
		},
		allocationDate: layout.allocationDate,
		currentStage: "f1",
		stageDirectories: { ...ANALYSIS_STAGE_DIRS },
		stages: createPendingStageSummaries(),
		overallStatus: "in_progress",
	};
	validateAnalysisWorkspaceSummary(summary);
	return summary;
}

export function recordAnalysisStageStarted(summary: AnalysisWorkspaceSummary, stage: AnalysisStage): AnalysisWorkspaceSummary {
	validateAnalysisWorkspaceSummary(summary);
	assertSummaryCanTransition(summary);
	assertStageCanStart(summary, stage);

	return createUpdatedSummary(summary, {
		currentStage: stage,
		stages: updateStageSummary(summary.stages, stage, {
			status: "running",
			artifacts: cloneArtifacts(summary.stages[stage].artifacts),
		}),
	});
}

export function recordAnalysisStageCompleted(
	summary: AnalysisWorkspaceSummary,
	stage: AnalysisStage,
	artifacts: Readonly<Record<string, string>>,
): AnalysisWorkspaceSummary {
	validateAnalysisWorkspaceSummary(summary);
	assertSummaryCanTransition(summary);
	assertStageIsRunning(summary, stage);
	const normalizedArtifacts = normalizeStageArtifactsForPersistence(summary.analysisRoot, stage, artifacts);
	const stageIndex = ANALYSIS_STAGES.indexOf(stage);
	const isFinalStage = stageIndex === ANALYSIS_STAGES.length - 1;
	const nextStage = ANALYSIS_STAGES[stageIndex + 1];

	return createUpdatedSummary(summary, {
		currentStage: isFinalStage ? stage : nextStage!,
		stages: updateStageSummary(summary.stages, stage, {
			status: "completed",
			artifacts: normalizedArtifacts,
		}),
		overallStatus: isFinalStage ? "completed" : "in_progress",
		failedStage: undefined,
		failureCategory: undefined,
	});
}

export function recordAnalysisStageFailed(
	summary: AnalysisWorkspaceSummary,
	stage: AnalysisStage,
	failureCategory: string,
): AnalysisWorkspaceSummary {
	validateAnalysisWorkspaceSummary(summary);
	assertSummaryCanTransition(summary);
	assertStageIsRunning(summary, stage);
	const trimmedFailureCategory = failureCategory.trim();
	if (trimmedFailureCategory === "") {
		throw new Error("Analysis workspace failure category is invalid.");
	}

	const failedStageIndex = ANALYSIS_STAGES.indexOf(stage);
	const stages: AnalysisWorkspaceSummary["stages"] = createStageRecord((candidateStage) => {
		const candidateStageIndex = ANALYSIS_STAGES.indexOf(candidateStage);
		if (candidateStageIndex < failedStageIndex) return cloneStageSummary(summary.stages[candidateStage]);
		if (candidateStage === stage) return { status: "failed" as const, artifacts: cloneArtifacts(summary.stages[candidateStage].artifacts) };
		return { status: "blocked" as const, artifacts: {} };
	});

	return createUpdatedSummary(summary, {
		currentStage: stage,
		stages,
		overallStatus: "failed",
		failedStage: stage,
		failureCategory: trimmedFailureCategory,
	});
}

export function writeAnalysisWorkspaceSummary(layout: AnalysisWorkspaceLayout, summary: AnalysisWorkspaceSummary): void {
	validateAnalysisWorkspaceLayout(layout);
	validateAnalysisWorkspaceSummary(summary);
	assertSummaryMatchesLayout(layout, summary);

	const content = `${JSON.stringify(summary, null, 2)}\n`;
	const temporaryPath = path.join(
		path.dirname(layout.summaryPath),
		`${ANALYSIS_WORKSPACE_SUMMARY_FILE_NAME}.${process.pid}.${randomUUID()}.tmp`,
	);
	let fileDescriptor: number | undefined;
	let ownsTemporaryPath = false;
	let committed = false;
	let writeError: unknown;
	let cleanupError: Error | undefined;

	try {
		fileDescriptor = fs.openSync(temporaryPath, "wx");
		ownsTemporaryPath = true;
		try {
			fs.writeFileSync(fileDescriptor, content, "utf8");
			fs.fsyncSync(fileDescriptor);
		} finally {
			if (fileDescriptor !== undefined) {
				fs.closeSync(fileDescriptor);
				fileDescriptor = undefined;
			}
		}
		fs.renameSync(temporaryPath, layout.summaryPath);
		committed = true;
	} catch (error) {
		writeError = error;
	} finally {
		if (ownsTemporaryPath && !committed) {
			cleanupError = cleanupExactTemporarySummaryFile(temporaryPath);
		}
	}

	if (writeError !== undefined) {
		const normalizedWriteError = writeError instanceof Error ? writeError : new Error(String(writeError));
		if (cleanupError !== undefined) {
			throw new AggregateError(
				[normalizedWriteError, cleanupError],
				"Analysis workspace summary write failed during cleanup.",
			);
		}
		throw normalizedWriteError;
	}
	if (cleanupError !== undefined) {
		throw cleanupError;
	}
}

function validateWorkbookIdentity(fileName: string, contentHash: string, label: string): void {
	workbookCatalogFileNameSchema.parse(fileName);
	validateContentHash(contentHash, `${label} content hash`);
}

function pathChain(value: string): string[] {
	const absolute = path.resolve(value);
	const root = path.parse(absolute).root;
	const segments = path.relative(root, absolute).split(path.sep).filter(Boolean);
	const chain = [root];
	let current = root;
	for (const segment of segments) {
		current = path.join(current, segment);
		chain.push(current);
	}
	return chain;
}

function ensureTrustedTestRoot(testRoot: string): DirectoryIdentity {
	const requestedPath = path.resolve(testRoot);
	ensureRequestedDirectoryExistsSafely(requestedPath, "Analysis workspace test root");
	return captureDirectoryIdentity(requestedPath, "Analysis workspace test root");
}

function ensureRequestedDirectoryExistsSafely(targetPath: string, label: string): void {
	for (const candidate of pathChain(targetPath).slice(1)) {
		const isTarget = candidate === targetPath;
		if (fs.existsSync(candidate)) {
			if (isTarget) return;
			const stats = fs.lstatSync(candidate);
			if (stats.isSymbolicLink() || !stats.isDirectory()) {
				throw new Error(`${label} is invalid.`);
			}
			continue;
		}
		fs.mkdirSync(candidate);
	}
}

function captureDirectoryIdentity(targetPath: string, label: string): DirectoryIdentity {
	const requestedPath = path.resolve(targetPath);
	if (!fs.existsSync(requestedPath)) {
		throw new Error(`${label} is missing.`);
	}
	const requestedStats = fs.lstatSync(requestedPath);
	if (!requestedStats.isDirectory() && !requestedStats.isSymbolicLink()) {
		throw new Error(`${label} is invalid.`);
	}
	const canonicalPath = fs.realpathSync(requestedPath);
	const canonicalStats = fs.statSync(canonicalPath);
	if (!canonicalStats.isDirectory()) {
		throw new Error(`${label} is invalid.`);
	}
	return {
		requestedPath,
		canonicalPath,
		requestedDev: requestedStats.dev,
		requestedIno: requestedStats.ino,
		canonicalDev: canonicalStats.dev,
		canonicalIno: canonicalStats.ino,
	};
}

function assertDirectoryIdentityUnchanged(expected: DirectoryIdentity, label: string): void {
	const current = captureDirectoryIdentity(expected.requestedPath, label);
	if (
		current.canonicalPath !== expected.canonicalPath
		|| current.requestedDev !== expected.requestedDev
		|| current.requestedIno !== expected.requestedIno
		|| current.canonicalDev !== expected.canonicalDev
		|| current.canonicalIno !== expected.canonicalIno
	) {
		throw new Error(`${label} changed during allocation.`);
	}
}

function validateAllocatedRootAfterCreation(trustedTestRoot: DirectoryIdentity, allocationRoot: DirectoryIdentity): void {
	assertDirectoryIdentityUnchanged(trustedTestRoot, "Analysis workspace test root");
	assertPathWithinRoot(trustedTestRoot.canonicalPath, allocationRoot.canonicalPath, "Analysis workspace root");
	const canonicalParent = path.dirname(allocationRoot.canonicalPath);
	if (canonicalParent !== trustedTestRoot.canonicalPath && !isWithinOrEqual(trustedTestRoot.canonicalPath, canonicalParent)) {
		throw new Error("Analysis workspace root changed during allocation.");
	}
}

function validateNow(now: Date): void {
	if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
		throw new Error("Analysis workspace allocation time is invalid.");
	}
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
		if (artifactPath !== normalizeStageArtifactPath(analysisRoot, stage, artifactPath)) {
			throw new Error(`Analysis workspace stage ${stage} artifact path is invalid.`);
		}
	}
}

function validateStageOrdering(summary: Pick<AnalysisWorkspaceSummary, "stages" | "overallStatus" | "failedStage">): void {
	if (summary.overallStatus === "failed") {
		const failedStage = summary.failedStage;
		if (!failedStage) {
			throw new Error("Analysis workspace failed stage is invalid.");
		}
		const failedStageIndex = ANALYSIS_STAGES.indexOf(failedStage);
		for (const [index, stage] of ANALYSIS_STAGES.entries()) {
			const stageStatus = summary.stages[stage].status;
			if (index < failedStageIndex && stageStatus !== "completed") {
				throw new Error(`Analysis workspace stage ${stage} must remain completed before the failed stage.`);
			}
			if (index === failedStageIndex && stageStatus !== "failed") {
				throw new Error(`Analysis workspace stage ${stage} must match the recorded failed stage.`);
			}
			if (index > failedStageIndex && stageStatus !== "blocked") {
				throw new Error(`Analysis workspace stage ${stage} must be blocked after a failed predecessor.`);
			}
		}
		return;
	}

	let predecessorIncomplete = false;
	for (const stage of ANALYSIS_STAGES) {
		const stageStatus = summary.stages[stage].status;
		if (stageStatus === "failed" || stageStatus === "blocked") {
			throw new Error(`Analysis workspace stage ${stage} can only be failed or blocked in failed summaries.`);
		}
		if (stageStatus !== "completed") predecessorIncomplete = true;
		else if (predecessorIncomplete) {
			throw new Error(`Analysis workspace stage ${stage} cannot be completed before its completed predecessor chain.`);
		}
	}
}

function isAbsoluteAny(candidatePath: string): boolean {
	return path.isAbsolute(candidatePath) || path.posix.isAbsolute(candidatePath) || path.win32.isAbsolute(candidatePath);
}

function createAllocatedLayout(
	analysisRoot: string,
	workbookFileName: string,
	workbookContentHash: string,
	allocationDate: string,
	stagePaths: AnalysisWorkspaceResolvedStagePaths,
): AnalysisWorkspaceLayout {
	return {
		contractVersion: ANALYSIS_WORKSPACE_VERSION,
		analysisRoot,
		summaryPath: path.join(analysisRoot, ANALYSIS_WORKSPACE_SUMMARY_FILE_NAME),
		workbookFileName,
		workbookContentHash,
		allocationDate,
		stagePaths,
	};
}

function createStageDirectories(
	analysisRoot: string,
	stagePaths: AnalysisWorkspaceResolvedStagePaths,
): readonly DirectoryIdentity[] {
	const createdStageDirectories: DirectoryIdentity[] = [];
	try {
		for (const stage of ANALYSIS_STAGES) {
			const stagePath = stagePaths[stage];
			assertPathWithinRoot(analysisRoot, stagePath, `Analysis workspace stage path for ${stage}`);
			fs.mkdirSync(stagePath);
			createdStageDirectories.push(captureDirectoryIdentity(stagePath, `Analysis workspace stage path for ${stage}`));
		}
	} catch (error) {
		throw attachCreatedDirectories(error, createdStageDirectories);
	}
	return createdStageDirectories;
}

function cleanupPartialAllocation(
	allocationRoot: DirectoryIdentity,
	createdDirectories: readonly DirectoryIdentity[],
): void {
	removeCreatedDirectoriesInReverse(createdDirectories);
	removeEmptyAllocationRoot(allocationRoot);
}

function removeCreatedDirectoriesInReverse(createdDirectories: readonly DirectoryIdentity[]): void {
	for (const createdDirectory of [...createdDirectories].reverse()) {
		removeEmptyDirectoryIfUnchanged(createdDirectory);
	}
}

function removeEmptyDirectoryIfUnchanged(directory: DirectoryIdentity): void {
	if (!fs.existsSync(directory.requestedPath)) {
		return;
	}
	const current = captureDirectoryIdentity(directory.requestedPath, "Analysis workspace cleanup directory");
	if (
		current.canonicalPath !== directory.canonicalPath
		|| current.requestedDev !== directory.requestedDev
		|| current.requestedIno !== directory.requestedIno
		|| current.canonicalDev !== directory.canonicalDev
		|| current.canonicalIno !== directory.canonicalIno
	) {
		return;
	}
	if (fs.readdirSync(directory.requestedPath).length === 0) {
		fs.rmdirSync(directory.requestedPath);
	}
}

function removeEmptyAllocationRoot(allocationRoot: DirectoryIdentity): void {
	removeEmptyDirectoryIfUnchanged(allocationRoot);
}

function failClosedAfterPostCreateValidation(error: unknown, allocationRoot: DirectoryIdentity): Error {
	removeEmptyAllocationRoot(allocationRoot);
	if (fs.existsSync(allocationRoot.requestedPath)) {
		return new Error(`Analysis workspace cleanup/identity error: ${formatErrorMessage(error)}`);
	}
	return error instanceof Error ? error : new Error(String(error));
}

function assertPathWithinRoot(rootPath: string, candidatePath: string, label: string): void {
	if (!isWithinOrEqual(rootPath, candidatePath)) {
		throw new Error(`${label} escaped the test root.`);
	}
}

function isDirectoryAlreadyAllocated(error: unknown): boolean {
	return isNodeErrorWithCode(error, "EEXIST");
}

function isNodeErrorWithCode(error: unknown, code: string): error is NodeJS.ErrnoException {
	return typeof error === "object" && error !== null && "code" in error && (error as NodeJS.ErrnoException).code === code;
}

function hasCreatedDirectoryIdentities(error: unknown): error is Error & { readonly createdDirectories: readonly DirectoryIdentity[] } {
	return typeof error === "object"
		&& error !== null
		&& "createdDirectories" in error
		&& Array.isArray((error as { readonly createdDirectories?: unknown }).createdDirectories);
}

function attachCreatedDirectories(error: unknown, createdDirectories: readonly DirectoryIdentity[]): Error & { readonly createdDirectories: readonly DirectoryIdentity[] } {
	const wrapped = error instanceof Error ? error : new Error(String(error));
	return Object.assign(wrapped, { createdDirectories });
}

function formatErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function createPendingStageSummaries(): AnalysisWorkspaceSummary["stages"] {
	return createStageRecord(() => ({ status: "pending", artifacts: {} }));
}

function createStageRecord<T>(factory: (stage: AnalysisStage) => T): Record<AnalysisStage, T> {
	return Object.fromEntries(ANALYSIS_STAGES.map((stage) => [stage, factory(stage)])) as Record<AnalysisStage, T>;
}

function createUpdatedSummary(
	summary: AnalysisWorkspaceSummary,
	overrides: Partial<AnalysisWorkspaceSummary>,
): AnalysisWorkspaceSummary {
	const updatedSummary: AnalysisWorkspaceSummary = {
		...summary,
		...overrides,
		workbook: overrides.workbook ?? { ...summary.workbook },
		stageDirectories: overrides.stageDirectories ?? { ...summary.stageDirectories },
		stages: overrides.stages ?? cloneStages(summary.stages),
	};
	validateAnalysisWorkspaceSummary(updatedSummary);
	return updatedSummary;
}

function cloneStages(stages: AnalysisWorkspaceSummary["stages"]): AnalysisWorkspaceSummary["stages"] {
	return createStageRecord((stage) => cloneStageSummary(stages[stage]));
}

function cloneStageSummary(stageSummary: AnalysisWorkspaceStageSummary): AnalysisWorkspaceStageSummary {
	return {
		status: stageSummary.status,
		artifacts: cloneArtifacts(stageSummary.artifacts),
	};
}

function cloneArtifacts(artifacts: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
	return { ...artifacts };
}

function updateStageSummary(
	stages: AnalysisWorkspaceSummary["stages"],
	stage: AnalysisStage,
	stageSummary: AnalysisWorkspaceStageSummary,
): AnalysisWorkspaceSummary["stages"] {
	return createStageRecord((candidateStage) => candidateStage === stage ? stageSummary : cloneStageSummary(stages[candidateStage]));
}

function assertSummaryCanTransition(summary: AnalysisWorkspaceSummary): void {
	if (summary.overallStatus !== "in_progress") {
		throw new Error("Analysis workspace lifecycle transitions require an in-progress summary.");
	}
}

function assertStageCanStart(summary: AnalysisWorkspaceSummary, stage: AnalysisStage): void {
	if (summary.currentStage !== stage) {
		throw new Error(`Analysis workspace stage ${stage} must match the current stage before it can start.`);
	}
	const stageStatus = summary.stages[stage].status;
	if (stageStatus !== "pending") {
		throw new Error(`Analysis workspace stage ${stage} must be pending before it can start.`);
	}
	const stageIndex = ANALYSIS_STAGES.indexOf(stage);
	for (const predecessor of ANALYSIS_STAGES.slice(0, stageIndex)) {
		if (summary.stages[predecessor].status !== "completed") {
			throw new Error(`Analysis workspace stage ${stage} cannot start before its predecessor chain is completed.`);
		}
	}
}

function assertStageIsRunning(summary: AnalysisWorkspaceSummary, stage: AnalysisStage): void {
	if (summary.currentStage !== stage || summary.stages[stage].status !== "running") {
		throw new Error(`Analysis workspace stage ${stage} must be the current running stage.`);
	}
}

function normalizeStageArtifactsForPersistence(
	analysisRoot: string,
	stage: AnalysisStage,
	artifacts: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
	return Object.fromEntries(
		Object.entries(artifacts).map(([artifactName, artifactPath]) => {
			if (artifactName.trim() === "") {
				throw new Error(`Analysis workspace stage ${stage} artifact name is invalid.`);
			}
			return [artifactName, normalizeStageArtifactPath(analysisRoot, stage, artifactPath)];
		}),
	);
}

function normalizeStageArtifactPath(analysisRoot: string, stage: AnalysisStage, artifactPath: string): string {
	if (artifactPath.trim() === "" || isAbsoluteAny(artifactPath)) {
		throw new Error(`Analysis workspace stage ${stage} artifact path is invalid.`);
	}
	if (artifactPath.split(/[\\/]+/).includes("..")) {
		throw new Error(`Analysis workspace stage ${stage} artifact path is invalid.`);
	}

	const normalizedArtifactPath = path.normalize(artifactPath);
	const stageRoot = path.join(path.resolve(analysisRoot), ANALYSIS_STAGE_DIRS[stage]);
	const resolvedArtifactPath = path.resolve(analysisRoot, normalizedArtifactPath);
	if (!isWithinOrEqual(stageRoot, resolvedArtifactPath)) {
		throw new Error(`Analysis workspace stage ${stage} artifact path is invalid.`);
	}

	const rootRelativeArtifactPath = path.relative(path.resolve(analysisRoot), resolvedArtifactPath);
	if (rootRelativeArtifactPath === "" || isAbsoluteAny(rootRelativeArtifactPath)) {
		throw new Error(`Analysis workspace stage ${stage} artifact path is invalid.`);
	}
	return rootRelativeArtifactPath;
}

function assertSummaryMatchesLayout(layout: AnalysisWorkspaceLayout, summary: AnalysisWorkspaceSummary): void {
	if (path.resolve(summary.analysisRoot) !== path.resolve(layout.analysisRoot)) {
		throw new Error("Analysis workspace summary root does not match the allocated layout.");
	}
	if (path.resolve(summary.summaryPath) !== path.resolve(layout.summaryPath)) {
		throw new Error("Analysis workspace summary path does not match the allocated layout.");
	}
	if (summary.workbook.fileName !== layout.workbookFileName || summary.workbook.contentHash !== layout.workbookContentHash) {
		throw new Error("Analysis workspace summary workbook does not match the allocated layout.");
	}
	if (summary.allocationDate !== layout.allocationDate) {
		throw new Error("Analysis workspace summary allocation date does not match the allocated layout.");
	}
}

function cleanupExactTemporarySummaryFile(temporaryPath: string): Error | undefined {
	if (!fs.existsSync(temporaryPath)) return undefined;
	try {
		fs.rmSync(temporaryPath);
		return undefined;
	} catch (error) {
		return error instanceof Error ? error : new Error(String(error));
	}
}
