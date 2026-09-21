import * as fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
	ANALYSIS_STAGE_DIRS,
	allocateAnalysisWorkspace,
	assertAnalysisWorkspaceWorkbookIdentity,
	formatLocalDateYYYYMMDD,
	resolveAnalysisWorkspaceStagePaths,
	validateAnalysisWorkspaceLayout,
	validateAnalysisWorkspaceSummary,
	type AnalysisStage,
	type AnalysisWorkspaceLayout,
	type AnalysisWorkspaceResolvedStagePaths,
	type AnalysisWorkspaceStageDirectoryNames,
	type AnalysisWorkspaceSummary,
} from "./analysis-workspace.js";

const HASH = "a".repeat(64);
const ROOT = path.resolve("test", "20260921 - Demo");
const ALLOCATION_TEST_ROOT = path.resolve("test-output", "analysis-workspace");
const cleanupRoots: string[] = [];

function stageStatuses(
	statusByStage: Partial<Record<AnalysisStage, AnalysisWorkspaceSummary["stages"][AnalysisStage]["status"]>>,
): AnalysisWorkspaceSummary["stages"] {
	return {
		f1: { status: statusByStage.f1 ?? "pending", artifacts: statusByStage.f1 === "completed" ? { report: path.join(ANALYSIS_STAGE_DIRS.f1, "Feature1-Workbook.json") } : {} },
		f2: { status: statusByStage.f2 ?? "pending", artifacts: statusByStage.f2 === "completed" ? { report: path.join(ANALYSIS_STAGE_DIRS.f2, "Feature2-Report.json") } : {} },
		f3: { status: statusByStage.f3 ?? "pending", artifacts: statusByStage.f3 === "completed" ? { report: path.join(ANALYSIS_STAGE_DIRS.f3, "Feature3-Report.json") } : {} },
		f4: { status: statusByStage.f4 ?? "pending", artifacts: statusByStage.f4 === "completed" ? { report: path.join(ANALYSIS_STAGE_DIRS.f4, "Feature4-Calculation.json") } : {} },
		f5: { status: statusByStage.f5 ?? "pending", artifacts: statusByStage.f5 === "completed" ? { report: path.join(ANALYSIS_STAGE_DIRS.f5, "Feature5-Report.json") } : {} },
		f6: {
			status: statusByStage.f6 ?? "pending",
			artifacts: statusByStage.f6 === "completed"
				? {
					optimizationJson: path.join(ANALYSIS_STAGE_DIRS.f6, "Feature6-Optimization.json"),
					finalReportMarkdown: path.join(ANALYSIS_STAGE_DIRS.f6, "Anonymous - TA ENGINEERING ANALYSIS REPORT.md"),
					finalReportPdf: path.join(ANALYSIS_STAGE_DIRS.f6, "Anonymous - TA ENGINEERING ANALYSIS REPORT.pdf"),
					runSummary: path.join(ANALYSIS_STAGE_DIRS.f6, "Feature6-Run-Summary.json"),
					manifest: path.join(ANALYSIS_STAGE_DIRS.f6, "manifest.json"),
				}
				: {},
		},
	};
}

function layoutFixture(): AnalysisWorkspaceLayout {
	return {
		contractVersion: "analysis-workspace-v1",
		analysisRoot: ROOT,
		summaryPath: path.join(ROOT, "analysis-run-summary.json"),
		workbookFileName: "Demo.xlsx",
		workbookContentHash: HASH,
		allocationDate: "20260921",
		stagePaths: resolveAnalysisWorkspaceStagePaths(ROOT),
	};
}

function summaryStageDirectories(): AnalysisWorkspaceStageDirectoryNames {
	return { ...ANALYSIS_STAGE_DIRS };
}

function summaryFixture(
	overrides: Partial<AnalysisWorkspaceSummary> = {},
): AnalysisWorkspaceSummary {
	return {
		contractVersion: "analysis-workspace-v1",
		analysisRoot: ROOT,
		summaryPath: path.join(ROOT, "analysis-run-summary.json"),
		workbook: {
			fileName: "Demo.xlsx",
			contentHash: HASH,
		},
		allocationDate: "20260921",
		currentStage: "f1",
		stageDirectories: summaryStageDirectories(),
		stages: stageStatuses({}),
		overallStatus: "in_progress",
		...overrides,
	};
}

function allocationInput(testRoot: string, workbookFileName = "Demo.xlsx") {
	return {
		testRoot,
		workbookFileName,
		workbookContentHash: HASH,
		now: new Date(2026, 8, 21, 23, 59),
	};
}

function testRootFor(name: string): string {
	const root = path.join(ALLOCATION_TEST_ROOT, name);
	fs.rmSync(root, { recursive: true, force: true });
	cleanupRoots.push(root);
	return root;
}

function isContained(rootPath: string, candidatePath: string): boolean {
	const relative = path.relative(rootPath, candidatePath);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.doUnmock("node:fs");
	vi.doUnmock("node:path");
	vi.resetModules();
	for (const root of cleanupRoots.splice(0)) {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

describe("analysis workspace contract", () => {
	it("defines the exact fixed stage directories", () => {
		expect(ANALYSIS_STAGE_DIRS).toEqual({
			f1: "01 - F1 Data Parsing",
			f2: "02 - F2 Data Cleaning",
			f3: "03 - F3 Drawing Governance",
			f4: "04 - F4 Calculation Engine",
			f5: "05 - F5 Result Interpretation",
			f6: "06 - F6 Design Optimization",
		});
	});

	it("formats local dates as YYYYMMDD", () => {
		expect(formatLocalDateYYYYMMDD(new Date(2026, 8, 21, 23, 59))).toBe("20260921");
	});

	it("allocates exclusive analysis roots with exact suffixes and fixed stage directories", () => {
		const testRoot = testRootFor("allocate-suffixes");
		const workbookFileName = "Maera_gap_TP_brkt_and _battery_20260305V1 - test.xlsx";

		const first = allocateAnalysisWorkspace(allocationInput(testRoot, workbookFileName));
		const second = allocateAnalysisWorkspace(allocationInput(testRoot, workbookFileName));
		const third = allocateAnalysisWorkspace(allocationInput(testRoot, workbookFileName));

		expect(path.relative(testRoot, first.analysisRoot)).toBe(
			"20260921 - Maera_gap_TP_brkt_and _battery_20260305V1 - test",
		);
		expect(path.relative(testRoot, second.analysisRoot)).toBe(
			"20260921 - Maera_gap_TP_brkt_and _battery_20260305V1 - test -1",
		);
		expect(path.relative(testRoot, third.analysisRoot)).toBe(
			"20260921 - Maera_gap_TP_brkt_and _battery_20260305V1 - test -2",
		);
		expect(Object.values(first.stagePaths)).toEqual([
			path.join(first.analysisRoot, ANALYSIS_STAGE_DIRS.f1),
			path.join(first.analysisRoot, ANALYSIS_STAGE_DIRS.f2),
			path.join(first.analysisRoot, ANALYSIS_STAGE_DIRS.f3),
			path.join(first.analysisRoot, ANALYSIS_STAGE_DIRS.f4),
			path.join(first.analysisRoot, ANALYSIS_STAGE_DIRS.f5),
			path.join(first.analysisRoot, ANALYSIS_STAGE_DIRS.f6),
		]);
		for (const stagePath of Object.values(first.stagePaths)) {
			expect(fs.statSync(stagePath).isDirectory()).toBe(true);
		}
	});

	it("returns a canonical analysis root beneath the physical test root when the supplied path is a link", ({ skip }) => {
		const physicalRoot = testRootFor("allocate-physical-root");
		const linkParent = testRootFor("allocate-linked-parent");
		const linkedRoot = path.join(linkParent, "linked-root");
		fs.mkdirSync(physicalRoot, { recursive: true });
		fs.mkdirSync(linkParent, { recursive: true });

		try {
			fs.symlinkSync(physicalRoot, linkedRoot, process.platform === "win32" ? "junction" : "dir");
		} catch (error) {
			const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
			if (code === "EPERM" || code === "EACCES" || code === "UNKNOWN") skip("directory links are unavailable in this environment");
			throw error;
		}

		const layout = allocateAnalysisWorkspace(allocationInput(linkedRoot));
		const canonicalRoot = fs.realpathSync.native(physicalRoot);

		expect(layout.analysisRoot).toBe(path.join(canonicalRoot, "20260921 - Demo"));
		expect(isContained(canonicalRoot, layout.analysisRoot)).toBe(true);
		expect(isContained(linkedRoot, layout.analysisRoot)).toBe(false);
	});

	it("never collides across concurrent allocations", async () => {
		const testRoot = testRootFor("allocate-concurrently");
		const [first, second] = await Promise.all([
			Promise.resolve().then(() => allocateAnalysisWorkspace(allocationInput(testRoot))),
			Promise.resolve().then(() => allocateAnalysisWorkspace(allocationInput(testRoot))),
		]);

		expect(new Set([first.analysisRoot, second.analysisRoot]).size).toBe(2);
		expect(() => validateAnalysisWorkspaceLayout(first)).not.toThrow();
		expect(() => validateAnalysisWorkspaceLayout(second)).not.toThrow();
	});

	it("rejects unsafe workbook names and escaped allocation roots", async () => {
		const unsafeRoot = testRootFor("rejects-unsafe-workbook");
		expect(() => allocateAnalysisWorkspace(allocationInput(unsafeRoot, "..\\escape.xlsx"))).toThrow();

		const escapedRootParent = testRootFor("rejects-escaped-root");
		const resolvedTestRoot = path.resolve(escapedRootParent);
		const escapedRoot = path.resolve(resolvedTestRoot, "..", "escaped-root");
		vi.doMock("node:path", async (importOriginal) => {
			const actual = await importOriginal<typeof import("node:path")>();
			const originalJoin = actual.join;
			const mockedPath = {
				...actual,
				join: (...parts: string[]) => {
					if (parts.length === 2 && path.resolve(parts[0] ?? "") === resolvedTestRoot && parts[1]?.startsWith("20260921 - Demo")) {
						return escapedRoot;
					}
					return originalJoin(...parts);
				},
			};
			return {
				...actual,
				default: mockedPath,
			};
		});
		const { allocateAnalysisWorkspace: mockedAllocateAnalysisWorkspace } = await import("./analysis-workspace.js");

		expect(() => mockedAllocateAnalysisWorkspace(allocationInput(escapedRootParent))).toThrow(/test root/i);
	});

	it("rejects a test root whose canonical identity changes during allocation", async () => {
		const testRoot = testRootFor("identity-change");
		const rootRealPath = path.resolve(testRoot);
		const changedRealPath = path.join(path.dirname(rootRealPath), "identity-change-moved");

		vi.doMock("node:fs", async (importOriginal) => {
			const actual = await importOriginal<typeof import("node:fs")>();
			let realpathCallCount = 0;
			const realpathSync: typeof actual.realpathSync = ((target, options) => {
				const targetPath = String(target);
				if (path.resolve(targetPath) === rootRealPath) {
					realpathCallCount += 1;
					const selected = realpathCallCount === 1 ? rootRealPath : changedRealPath;
					return typeof options === "string" || options?.encoding !== "buffer"
						? selected
						: Buffer.from(selected);
				}
				return actual.realpathSync(target as Parameters<typeof actual.realpathSync>[0], options as Parameters<typeof actual.realpathSync>[1]);
			}) as typeof actual.realpathSync;
			const statSync: typeof actual.statSync = ((target, options) => {
				const targetPath = String(target);
				if (path.resolve(targetPath) === changedRealPath) {
					return actual.statSync(rootRealPath, options as Parameters<typeof actual.statSync>[1]);
				}
				return actual.statSync(target as Parameters<typeof actual.statSync>[0], options as Parameters<typeof actual.statSync>[1]);
			}) as typeof actual.statSync;
			return {
				...actual,
				realpathSync,
				statSync,
			};
		});

		const { allocateAnalysisWorkspace: mockedAllocateAnalysisWorkspace } = await import("./analysis-workspace.js");
		expect(() => mockedAllocateAnalysisWorkspace(allocationInput(testRoot))).toThrow(/changed during allocation/i);
	});

	it("cleans up only directories created by this invocation when stage creation fails", async () => {
		const testRoot = testRootFor("cleanup-partial-stages");
		const existingRoot = path.join(testRoot, "20260921 - Demo");
		const existingMarker = path.join(existingRoot, "keep.txt");
		fs.mkdirSync(existingRoot, { recursive: true });
		fs.writeFileSync(existingMarker, "keep");

		const allocatedRoot = `${existingRoot} -1`;
		const failingStagePath = path.join(allocatedRoot, ANALYSIS_STAGE_DIRS.f2);
		const concurrentStagePath = path.join(allocatedRoot, ANALYSIS_STAGE_DIRS.f3);
		const concurrentMarker = path.join(concurrentStagePath, "preserve.txt");
		vi.doMock("node:fs", async (importOriginal) => {
			const actual = await importOriginal<typeof import("node:fs")>();
			const mkdirSync: typeof actual.mkdirSync = ((target, options) => {
				if (typeof target === "string" && path.resolve(target) === failingStagePath) {
					actual.mkdirSync(concurrentStagePath, { recursive: true });
					actual.writeFileSync(concurrentMarker, "concurrent");
					throw new Error("simulated stage creation failure");
				}
				return actual.mkdirSync(target, options);
			}) as typeof actual.mkdirSync;
			return {
				...actual,
				mkdirSync,
			};
		});
		const { allocateAnalysisWorkspace: mockedAllocateAnalysisWorkspace } = await import("./analysis-workspace.js");

		expect(() => mockedAllocateAnalysisWorkspace(allocationInput(testRoot))).toThrow(/simulated stage creation failure/i);
		expect(fs.existsSync(existingRoot)).toBe(true);
		expect(fs.readFileSync(existingMarker, "utf8")).toBe("keep");
		expect(fs.existsSync(path.join(allocatedRoot, ANALYSIS_STAGE_DIRS.f1))).toBe(false);
		expect(fs.existsSync(concurrentStagePath)).toBe(true);
		expect(fs.readFileSync(concurrentMarker, "utf8")).toBe("concurrent");
		expect(fs.existsSync(allocatedRoot)).toBe(true);
	});

	it("fails with an explicit error after bounded suffix exhaustion", async () => {
		const testRoot = testRootFor("suffix-exhaustion");
		const rootRealPath = path.resolve(testRoot);

		vi.doMock("node:fs", async (importOriginal) => {
			const actual = await importOriginal<typeof import("node:fs")>();
			const mkdirSync: typeof actual.mkdirSync = ((target, options) => {
				if (typeof target === "string" && path.resolve(target) !== rootRealPath) {
					const error = new Error("already exists") as NodeJS.ErrnoException;
					error.code = "EEXIST";
					throw error;
				}
				return actual.mkdirSync(target, options);
			}) as typeof actual.mkdirSync;
			return {
				...actual,
				mkdirSync,
			};
		});

		const { allocateAnalysisWorkspace: mockedAllocateAnalysisWorkspace } = await import("./analysis-workspace.js");
		expect(() => mockedAllocateAnalysisWorkspace(allocationInput(testRoot))).toThrow(/exceeded 1000 attempts/i);
	});

	it("resolves canonical stage paths beneath the analysis root", () => {
		expect(resolveAnalysisWorkspaceStagePaths(ROOT)).toEqual({
			f1: path.join(ROOT, ANALYSIS_STAGE_DIRS.f1),
			f2: path.join(ROOT, ANALYSIS_STAGE_DIRS.f2),
			f3: path.join(ROOT, ANALYSIS_STAGE_DIRS.f3),
			f4: path.join(ROOT, ANALYSIS_STAGE_DIRS.f4),
			f5: path.join(ROOT, ANALYSIS_STAGE_DIRS.f5),
			f6: path.join(ROOT, ANALYSIS_STAGE_DIRS.f6),
		});
	});

	it("accepts a valid layout and summary", () => {
		expect(() => validateAnalysisWorkspaceLayout(layoutFixture())).not.toThrow();
		expect(() => validateAnalysisWorkspaceSummary(summaryFixture())).not.toThrow();
	});

	it("uses distinct stage-path types for layout and summary contracts", () => {
		const resolved: AnalysisWorkspaceResolvedStagePaths = resolveAnalysisWorkspaceStagePaths(ROOT);
		const directories: AnalysisWorkspaceStageDirectoryNames = summaryStageDirectories();
		expect(resolved.f1).toBe(path.join(ROOT, ANALYSIS_STAGE_DIRS.f1));
		expect(directories.f1).toBe(ANALYSIS_STAGE_DIRS.f1);
	});

	it("rejects changed workbook identity after allocation", () => {
		expect(() => assertAnalysisWorkspaceWorkbookIdentity(layoutFixture(), "Other.xlsx", HASH))
			.toThrow(/workbook identity/i);
		expect(() => assertAnalysisWorkspaceWorkbookIdentity(layoutFixture(), "Demo.xlsx", "b".repeat(64)))
			.toThrow(/workbook identity/i);
	});

	it("rejects absolute stage directory paths in the summary contract", () => {
		expect(() => validateAnalysisWorkspaceSummary(summaryFixture({
			stageDirectories: {
				...ANALYSIS_STAGE_DIRS,
				f2: path.win32.join("C:\\analysis", ANALYSIS_STAGE_DIRS.f2),
			},
		}))).toThrow(/stage path/i);
	});

	it("rejects traversal in stage artifact paths", () => {
		expect(() => validateAnalysisWorkspaceSummary(summaryFixture({
			stages: {
				...stageStatuses({ f1: "completed" }),
				f1: {
					status: "completed",
					artifacts: { report: path.join("..", "escape.json") },
				},
			},
		}))).toThrow(/artifact path/i);
	});

	it("rejects renamed stages", () => {
		expect(() => validateAnalysisWorkspaceSummary(summaryFixture({
			stageDirectories: {
				...ANALYSIS_STAGE_DIRS,
				f6: "06 - F6 Final Report",
			},
		}))).toThrow(/stage path/i);
	});

	it("rejects renamed absolute layout stage paths", () => {
		expect(() => validateAnalysisWorkspaceLayout({
			...layoutFixture(),
			stagePaths: {
				...resolveAnalysisWorkspaceStagePaths(ROOT),
				f3: path.join(ROOT, "03 - F3 Governed Drawing"),
			},
		})).toThrow(/stage path/i);
	});

	it("rejects sibling absolute layout stage paths", () => {
		expect(() => validateAnalysisWorkspaceLayout({
			...layoutFixture(),
			stagePaths: {
				...resolveAnalysisWorkspaceStagePaths(ROOT),
				f4: path.resolve(ROOT, "..", "04 - F4 Calculation Engine"),
			},
		})).toThrow(/stage path/i);
	});

	it("rejects escaping absolute layout stage paths", () => {
		expect(() => validateAnalysisWorkspaceLayout({
			...layoutFixture(),
			stagePaths: {
				...resolveAnalysisWorkspaceStagePaths(ROOT),
				f5: path.resolve(ROOT, "..", "..", "escaped"),
			},
		})).toThrow(/stage path/i);
	});

	it("rejects a completed downstream stage with an incomplete predecessor", () => {
		expect(() => validateAnalysisWorkspaceSummary(summaryFixture({
			stages: stageStatuses({ f1: "completed", f2: "pending", f3: "completed" }),
		}))).toThrow(/completed predecessor/i);
	});

	it("rejects completed status before F6 completion", () => {
		expect(() => validateAnalysisWorkspaceSummary(summaryFixture({
			stages: stageStatuses({ f1: "completed", f2: "completed", f3: "completed", f4: "completed", f5: "completed", f6: "pending" }),
			currentStage: "f6",
			overallStatus: "completed",
		}))).toThrow(/overall status/i);
	});

	it("accepts a completed F6 stage without local artifact-name completeness rules", () => {
		expect(() => validateAnalysisWorkspaceSummary(summaryFixture({
			stages: {
				...stageStatuses({ f1: "completed", f2: "completed", f3: "completed", f4: "completed", f5: "completed", f6: "completed" }),
				f6: {
					status: "completed",
					artifacts: {
						report: path.join(ANALYSIS_STAGE_DIRS.f6, "Feature6-Optimization.json"),
					},
				},
			},
			currentStage: "f6",
			overallStatus: "completed",
		}))).not.toThrow();
	});

	it("rejects completed summaries until every stage is completed", () => {
		expect(() => validateAnalysisWorkspaceSummary(summaryFixture({
			stages: {
				...stageStatuses({ f1: "completed", f2: "completed", f3: "completed", f4: "completed", f5: "completed", f6: "running" }),
				f6: { status: "running", artifacts: {} },
			},
			currentStage: "f6",
			overallStatus: "completed",
		}))).toThrow(/overall status/i);
	});

	it("rejects completed stages that have no validated artifacts", () => {
		expect(() => validateAnalysisWorkspaceSummary(summaryFixture({
			stages: {
				...stageStatuses({ f1: "completed" }),
				f1: { status: "completed", artifacts: {} },
			},
		}))).toThrow(/validated artifacts/i);
	});

	it("allows valid in-progress persistence windows after all stages complete", () => {
		expect(() => validateAnalysisWorkspaceSummary(summaryFixture({
			stages: stageStatuses({ f1: "completed", f2: "completed", f3: "completed", f4: "completed", f5: "completed", f6: "completed" }),
			currentStage: "f6",
			overallStatus: "in_progress",
		}))).not.toThrow();
	});

	it("rejects a failed stage that does not match the recorded failed stage", () => {
		expect(() => validateAnalysisWorkspaceSummary(summaryFixture({
			stages: {
				...stageStatuses({ f1: "completed", f2: "completed", f3: "failed", f4: "pending", f5: "pending", f6: "pending" }),
				f3: { status: "failed", artifacts: {} },
			},
			currentStage: "f3",
			overallStatus: "failed",
			failedStage: "f4",
			failureCategory: "validation_error",
		}))).toThrow(/failed stage/i);
	});
});
