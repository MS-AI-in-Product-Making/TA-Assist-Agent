import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveFeature6OutputLayout } from "./f6-output-layout.mjs";

const cleanup = [];
const fixedNow = () => new Date("2026-08-17T01:02:03.456Z");

afterEach(() => {
  for (const target of cleanup.splice(0)) fs.rmSync(target, { recursive: true, force: true });
});

function roots(publishRoot = "test/demo-output") {
  return {
    f2ArtifactRoot: path.join(publishRoot, "f2-runs", "run-a"),
    f3ArtifactRoot: path.join(publishRoot, "f3-runs", "run-a"),
    f4ArtifactRoot: path.join(publishRoot, "f4-runs", "run-a"),
    f5ArtifactRoot: path.join(publishRoot, "f5-runs", "F5 Source"),
  };
}

function createAnalysisWorkspaceRoot() {
  const analysisRoot = fs.mkdtempSync(path.join(os.tmpdir(), "f6-layout-workspace-"));
  cleanup.push(analysisRoot);
  const stagePaths = {
    f1: path.join(analysisRoot, "01 - F1 Data Parsing"),
    f2: path.join(analysisRoot, "02 - F2 Data Cleaning"),
    f3: path.join(analysisRoot, "03 - F3 Drawing Governance"),
    f4: path.join(analysisRoot, "04 - F4 Calculation Engine"),
    f5: path.join(analysisRoot, "05 - F5 Result Interpretation"),
    f6: path.join(analysisRoot, "06 - F6 Design Optimization"),
  };
  for (const stagePath of Object.values(stagePaths)) fs.mkdirSync(stagePath, { recursive: true });
  fs.writeFileSync(path.join(stagePaths.f2, "Feature2-Report.json"), "{}\n");
  fs.writeFileSync(path.join(stagePaths.f3, "Feature3-Report.json"), "{}\n");
  fs.writeFileSync(path.join(stagePaths.f4, "Feature4-Calculation.json"), "{}\n");
  fs.writeFileSync(path.join(stagePaths.f5, "Feature5-Report.json"), "{}\n");
  fs.writeFileSync(path.join(analysisRoot, "analysis-run-summary.json"), JSON.stringify({
    contractVersion: "analysis-workspace-v1",
    analysisRoot,
    summaryPath: path.join(analysisRoot, "analysis-run-summary.json"),
    workbook: { fileName: "Anonymous.xlsx", contentHash: "a".repeat(64) },
    allocationDate: "20260921",
    currentStage: "f1",
    stageDirectories: {
      f1: "01 - F1 Data Parsing",
      f2: "02 - F2 Data Cleaning",
      f3: "03 - F3 Drawing Governance",
      f4: "04 - F4 Calculation Engine",
      f5: "05 - F5 Result Interpretation",
      f6: "06 - F6 Design Optimization",
    },
    stages: {
      f1: { status: "pending", artifacts: {} },
      f2: { status: "pending", artifacts: {} },
      f3: { status: "pending", artifacts: {} },
      f4: { status: "pending", artifacts: {} },
      f5: { status: "pending", artifacts: {} },
      f6: { status: "pending", artifacts: {} },
    },
    overallStatus: "in_progress",
  }, null, 2));
  return { analysisRoot, stagePaths };
}

describe("resolveFeature6OutputLayout", () => {
  it("builds the workbook-derived current artifact layout outside the legacy demo-output root", () => {
    const publishRoot = fs.mkdtempSync(path.join(os.tmpdir(), "f6-layout-current-"));
    cleanup.push(publishRoot);
    const layout = resolveFeature6OutputLayout(roots(publishRoot), path.join(publishRoot, "f6", "current"), fixedNow, publishRoot, "Anonymous.xlsx");
    expect(layout).toMatchObject({
      artifactSetVersion: "f6-artifact-set-v4",
      optimizationJsonName: "Feature6-Optimization.json",
      finalReportMdName: "Anonymous - TA ENGINEERING ANALYSIS REPORT.md",
      finalReportPdfName: "Anonymous - TA ENGINEERING ANALYSIS REPORT.pdf",
      runSummaryJsonName: "Feature6-Run-Summary.json",
      manifestName: "manifest.json",
    });
    expect(layout).not.toHaveProperty("optimizationMdName");
    expect(layout).not.toHaveProperty("composedReportJsonName");
    expect(layout).not.toHaveProperty("composedReportMdName");
  });

  it("rejects the legacy demo-output root for current writes even when no override is provided", () => {
    expect(() => resolveFeature6OutputLayout(roots(), undefined, fixedNow, undefined, "Anonymous.xlsx"))
      .toThrow(/legacy|demo-output/i);
  });

  it("routes current workspace writes directly into the validated stage6 root", () => {
    const { analysisRoot, stagePaths } = createAnalysisWorkspaceRoot();
    const layout = resolveFeature6OutputLayout({
      f2ArtifactRoot: stagePaths.f2,
      f3ArtifactRoot: stagePaths.f3,
      f4ArtifactRoot: stagePaths.f4,
      f5ArtifactRoot: stagePaths.f5,
      analysisRoot,
    }, undefined, fixedNow, undefined, "Anonymous.xlsx");
    expect(layout).toMatchObject({
      artifactSetVersion: "f6-artifact-set-v4",
      publishRoot: analysisRoot,
      runRoot: stagePaths.f6,
      finalReportMdName: "Anonymous - TA ENGINEERING ANALYSIS REPORT.md",
      finalReportPdfName: "Anonymous - TA ENGINEERING ANALYSIS REPORT.pdf",
      allowExistingRunRoot: true,
      workspaceBoundary: {
        publishRootIdentity: expect.objectContaining({ canonicalPath: analysisRoot }),
        runRootIdentity: expect.objectContaining({ canonicalPath: stagePaths.f6 }),
      },
    });
  });

  it("rejects a workspace root combined with an explicit output override", () => {
    const { analysisRoot, stagePaths } = createAnalysisWorkspaceRoot();
    expect(() => resolveFeature6OutputLayout({
      f2ArtifactRoot: stagePaths.f2,
      f3ArtifactRoot: stagePaths.f3,
      f4ArtifactRoot: stagePaths.f4,
      f5ArtifactRoot: stagePaths.f5,
      analysisRoot,
    }, path.join(analysisRoot, "custom"), fixedNow, analysisRoot, "Anonymous.xlsx"))
      .toThrow(/analysis workspace root cannot be combined/i);
  });

  it.each([
    ["F2", "f2ArtifactRoot", "outside-f2", "Feature2-Report.json"],
    ["F3", "f3ArtifactRoot", "outside-f3", "Feature3-Report.json"],
    ["F4", "f4ArtifactRoot", "outside-f4", "Feature4-Calculation.json"],
    ["F5", "f5ArtifactRoot", "outside-f5", "Feature5-Report.json"],
  ])("requires the exact validated %s stage path in workspace mode", (_stageName, field, directoryName, artifactFileName) => {
    const { analysisRoot, stagePaths } = createAnalysisWorkspaceRoot();
    const lookalikeRoot = path.join(analysisRoot, directoryName);
    fs.mkdirSync(lookalikeRoot, { recursive: true });
    fs.writeFileSync(path.join(lookalikeRoot, artifactFileName), "{}\n");
    expect(() => resolveFeature6OutputLayout({
      f2ArtifactRoot: stagePaths.f2,
      f3ArtifactRoot: stagePaths.f3,
      f4ArtifactRoot: stagePaths.f4,
      f5ArtifactRoot: stagePaths.f5,
      [field]: lookalikeRoot,
      analysisRoot,
    }, undefined, fixedNow, undefined, "Anonymous.xlsx"))
      .toThrow(new RegExp(`exact validated ${_stageName} stage path`, "i"));
  });

  it("accepts an override only with an existing explicit publish root", () => {
    const publishRoot = fs.mkdtempSync(path.join(os.tmpdir(), "f6-layout-"));
    cleanup.push(publishRoot);
    const layout = resolveFeature6OutputLayout(
      roots(publishRoot),
      path.join(publishRoot, "f6", "custom"),
      fixedNow,
      publishRoot,
      "Anonymous.xlsx",
    );
    expect(layout.runRoot).toBe(path.join(publishRoot, "f6", "custom", layout.runId));
  });

  it("rejects explicit current destinations inside the legacy demo-output root", () => {
    expect(() => resolveFeature6OutputLayout(
      roots(),
      path.join("test", "demo-output", "f6-runs", "current"),
      fixedNow,
      path.join("test", "demo-output"),
      "Anonymous.xlsx",
    )).toThrow(/legacy|demo-output/i);
  });

  it.each(["../outside", "runs/../outside", "runs/./child", "runs/CON", "runs/bad\u0001name"])(
    "rejects unsafe output root %j",
    (outputRoot) => expect(() => resolveFeature6OutputLayout(roots(), outputRoot, fixedNow, "test/demo-output", "Anonymous.xlsx"))
      .toThrow(/unsafe|publish root|outside/i),
  );

  it("requires an explicit publish root for an override", () => {
    expect(() => resolveFeature6OutputLayout(roots(), "test/demo-output/custom", fixedNow, undefined, "Anonymous.xlsx"))
      .toThrow(/publish root/i);
  });

  it("rejects any governed input root outside the publish root", () => {
    for (const key of Object.keys(roots())) {
      expect(() => resolveFeature6OutputLayout({ ...roots(), [key]: "outside/run" }, "test/demo-output/f6", fixedNow, "test/demo-output", "Anonymous.xlsx"))
        .toThrow(/publish root|outside/i);
    }
  });

  it("rejects containment through a directory link", ({ skip }) => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "f6-link-layout-"));
    cleanup.push(sandbox);
    const publishRoot = path.join(sandbox, "publish");
    const outsideRoot = path.join(sandbox, "outside");
    const linkedRoot = path.join(publishRoot, "linked");
    fs.mkdirSync(publishRoot);
    fs.mkdirSync(outsideRoot);
    try {
      fs.symlinkSync(outsideRoot, linkedRoot, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES"].includes(error?.code)) return skip();
      throw error;
    }
    expect(() => resolveFeature6OutputLayout(roots(publishRoot), path.join(linkedRoot, "run"), fixedNow, publishRoot, "Anonymous.xlsx"))
      .toThrow(/publish root|outside|link/i);
  });

  it("rejects a publish root that is itself a directory link", ({ skip }) => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "f6-publish-link-layout-"));
    cleanup.push(sandbox);
    const realPublishRoot = path.join(sandbox, "real-publish");
    const linkedPublishRoot = path.join(sandbox, "linked-publish");
    fs.mkdirSync(realPublishRoot);
    try {
      fs.symlinkSync(realPublishRoot, linkedPublishRoot, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES"].includes(error?.code)) return skip();
      throw error;
    }
    expect(() => resolveFeature6OutputLayout(
      roots(linkedPublishRoot),
      path.join(linkedPublishRoot, "f6", "run"),
      fixedNow,
      linkedPublishRoot,
      "Anonymous.xlsx",
    )).toThrow(/publish root|link/i);
  });

  it("rejects a linked alias into the legacy demo-output root", ({ skip }) => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "f6-legacy-link-layout-"));
    cleanup.push(sandbox);
    const linkedPublishRoot = path.join(sandbox, "linked-demo-output");
    const legacyRoot = path.resolve("test", "demo-output");
    try {
      fs.symlinkSync(legacyRoot, linkedPublishRoot, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES"].includes(error?.code)) return skip();
      throw error;
    }
    expect(() => resolveFeature6OutputLayout(
      roots(linkedPublishRoot),
      path.join(linkedPublishRoot, "f6", "run"),
      fixedNow,
      linkedPublishRoot,
      "Anonymous.xlsx",
    )).toThrow(/legacy|demo-output|link/i);
  });

  it("does not create output directories while resolving", () => {
    const publishRoot = fs.mkdtempSync(path.join(os.tmpdir(), "f6-no-create-"));
    cleanup.push(publishRoot);
    const outputRoot = path.join(publishRoot, "new", "output");
    resolveFeature6OutputLayout(roots(publishRoot), outputRoot, fixedNow, publishRoot, "Anonymous.xlsx");
    expect(fs.existsSync(outputRoot)).toBe(false);
  });
});