import path from "node:path";

import { describe, expect, it } from "vitest";

import {
	ANALYSIS_STAGE_DIRS,
	assertAnalysisWorkspaceWorkbookIdentity,
	formatLocalDateYYYYMMDD,
	resolveAnalysisWorkspaceStagePaths,
	validateAnalysisWorkspaceLayout,
	validateAnalysisWorkspaceSummary,
	type AnalysisStage,
	type AnalysisWorkspaceLayout,
	type AnalysisWorkspaceSummary,
} from "./analysis-workspace.js";

const HASH = "a".repeat(64);
const ROOT = path.resolve("test", "20260921 - Demo");

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
		stagePaths: { ...ANALYSIS_STAGE_DIRS },
		stages: stageStatuses({}),
		overallStatus: "in_progress",
		...overrides,
	};
}

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

	it("rejects changed workbook identity after allocation", () => {
		expect(() => assertAnalysisWorkspaceWorkbookIdentity(layoutFixture(), "Other.xlsx", HASH))
			.toThrow(/workbook identity/i);
		expect(() => assertAnalysisWorkspaceWorkbookIdentity(layoutFixture(), "Demo.xlsx", "b".repeat(64)))
			.toThrow(/workbook identity/i);
	});

	it("rejects absolute stage paths in the summary contract", () => {
		expect(() => validateAnalysisWorkspaceSummary(summaryFixture({
			stagePaths: {
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
			stagePaths: {
				...ANALYSIS_STAGE_DIRS,
				f6: "06 - F6 Final Report",
			},
		}))).toThrow(/stage path/i);
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

	it("rejects completed F6 stages that do not have the full publish set", () => {
		expect(() => validateAnalysisWorkspaceSummary(summaryFixture({
			stages: {
				...stageStatuses({ f1: "completed", f2: "completed", f3: "completed", f4: "completed", f5: "completed", f6: "completed" }),
				f6: {
					status: "completed",
					artifacts: {
						optimizationJson: path.join(ANALYSIS_STAGE_DIRS.f6, "Feature6-Optimization.json"),
					},
				},
			},
			currentStage: "f6",
			overallStatus: "completed",
		}))).toThrow(/f6 publish set/i);
	});

	it("rejects completed stages that have no validated artifacts", () => {
		expect(() => validateAnalysisWorkspaceSummary(summaryFixture({
			stages: {
				...stageStatuses({ f1: "completed" }),
				f1: { status: "completed", artifacts: {} },
			},
		}))).toThrow(/validated artifacts/i);
	});

	it("rejects a current stage that does not match the first incomplete stage", () => {
		expect(() => validateAnalysisWorkspaceSummary(summaryFixture({
			stages: stageStatuses({ f1: "completed", f2: "pending", f3: "pending", f4: "pending", f5: "pending", f6: "pending" }),
			currentStage: "f4",
		}))).toThrow(/current stage/i);
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
