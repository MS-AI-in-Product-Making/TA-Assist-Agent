import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveFeature5OutputLayout } from "./f5-output-layout.mjs";

const cleanupRoots = [];

function createAnalysisWorkspaceRoot() {
  const analysisRoot = fs.mkdtempSync(path.join(os.tmpdir(), "f5-layout-workspace-"));
  cleanupRoots.push(analysisRoot);
  const stagePaths = {
    f1: path.join(analysisRoot, "01 - F1 Data Parsing"),
    f2: path.join(analysisRoot, "02 - F2 Data Cleaning"),
    f3: path.join(analysisRoot, "03 - F3 Drawing Governance"),
    f4: path.join(analysisRoot, "04 - F4 Calculation Engine"),
    f5: path.join(analysisRoot, "05 - F5 Result Interpretation"),
    f6: path.join(analysisRoot, "06 - F6 Design Optimization"),
  };
  for (const stagePath of Object.values(stagePaths)) fs.mkdirSync(stagePath, { recursive: true });
  fs.writeFileSync(path.join(stagePaths.f1, "Feature1-Report.json"), "{}\n", "utf8");
  fs.writeFileSync(path.join(stagePaths.f3, "Feature3-Report.json"), "{}\n", "utf8");
  fs.writeFileSync(path.join(stagePaths.f4, "Feature4-Calculation.json"), "{}\n", "utf8");
  fs.writeFileSync(path.join(analysisRoot, "analysis-run-summary.json"), JSON.stringify({
    contractVersion: "analysis-workspace-v1",
    analysisRoot,
    summaryPath: path.join(analysisRoot, "analysis-run-summary.json"),
    workbook: { fileName: "Demo.xlsx", contentHash: "a".repeat(64) },
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

afterEach(() => {
  for (const root of cleanupRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("resolveFeature5OutputLayout", () => {
  const fixedNow = () => new Date("2026-08-11T12:34:56.789Z");
  const parsed = {
    f1ArtifactRoot: "test/demo-output/f1-runs/F1 Demo",
    f3ArtifactRoot: "test/demo-output/f3-runs/F3 Demo",
    f4ArtifactRoot: "test/demo-output/f4-runs/F4 Demo",
    selectedWorksheetNames: ["Analysis A"],
    imageObservationsPath: "notes/image observations.json",
  };

  it("routes the canonical workspace F1/F3/F4 stage refs directly into the fixed F5 stage", () => {
    const { analysisRoot, stagePaths } = createAnalysisWorkspaceRoot();
    expect(resolveFeature5OutputLayout({
      ...parsed,
      f1ArtifactRoot: stagePaths.f1,
      f3ArtifactRoot: stagePaths.f3,
      f4ArtifactRoot: stagePaths.f4,
      analysisRoot,
    }, undefined, fixedNow)).toMatchObject({
      runId: "2026-08-11T12-34-56-789Z",
      runRoot: stagePaths.f5,
      publishRoot: analysisRoot,
      reportJsonName: "Feature5-Report.json",
      reportMdName: "Feature5-Report.md",
      runSummaryJsonName: "Feature5-Run-Summary.json",
      imageObservationsJsonName: "Feature5-Image-Observations.json",
      manifestName: "manifest.json",
      allowExistingRunRoot: true,
      workspaceBoundary: {
        publishRootIdentity: { canonicalPath: analysisRoot, requestedPath: analysisRoot },
        runRootIdentity: { canonicalPath: stagePaths.f5, requestedPath: stagePaths.f5 },
      },
    });
  });

  it("rejects a symlink or junction analysis root alias in workspace mode", ({ skip }) => {
    const { analysisRoot, stagePaths } = createAnalysisWorkspaceRoot();
    const linkPath = path.join(path.dirname(analysisRoot), `${path.basename(analysisRoot)}-link`);
    cleanupRoots.push(linkPath);
    try {
      fs.symlinkSync(analysisRoot, linkPath, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (error?.code === "EPERM" || error?.code === "EACCES" || error?.code === "UNKNOWN") {
        skip();
        return;
      }
      throw error;
    }

    expect(() => resolveFeature5OutputLayout({
      ...parsed,
      f1ArtifactRoot: path.join(linkPath, path.basename(stagePaths.f1)),
      f3ArtifactRoot: path.join(linkPath, path.basename(stagePaths.f3)),
      f4ArtifactRoot: path.join(linkPath, path.basename(stagePaths.f4)),
      analysisRoot: linkPath,
    }, undefined, fixedNow)).toThrow(/analysis workspace root|invalid|exact validated/i);
  });

  it("rejects a symlink or junction stage alias in workspace mode", ({ skip }) => {
    const { analysisRoot, stagePaths } = createAnalysisWorkspaceRoot();
    const stageAlias = path.join(analysisRoot, "f1-alias");
    cleanupRoots.push(stageAlias);
    try {
      fs.symlinkSync(stagePaths.f1, stageAlias, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (error?.code === "EPERM" || error?.code === "EACCES" || error?.code === "UNKNOWN") {
        skip();
        return;
      }
      throw error;
    }

    expect(() => resolveFeature5OutputLayout({
      ...parsed,
      f1ArtifactRoot: stageAlias,
      f3ArtifactRoot: stagePaths.f3,
      f4ArtifactRoot: stagePaths.f4,
      analysisRoot,
    }, undefined, fixedNow)).toThrow(/exact validated F1 stage path|invalid/i);
  });

  it("rejects a symlinked workspace artifact file in workspace mode", ({ skip }) => {
    const { analysisRoot, stagePaths } = createAnalysisWorkspaceRoot();
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "f5-layout-artifact-outside-"));
    cleanupRoots.push(outsideRoot);
    const targetFile = path.join(outsideRoot, "Feature1-Report.json");
    fs.writeFileSync(targetFile, "{}\n", "utf8");
    fs.rmSync(path.join(stagePaths.f1, "Feature1-Report.json"), { force: true });
    try {
      fs.symlinkSync(targetFile, path.join(stagePaths.f1, "Feature1-Report.json"), "file");
    } catch (error) {
      if (error?.code === "EPERM" || error?.code === "EACCES" || error?.code === "UNKNOWN") {
        skip();
        return;
      }
      throw error;
    }

    expect(() => resolveFeature5OutputLayout({
      ...parsed,
      f1ArtifactRoot: stagePaths.f1,
      f3ArtifactRoot: stagePaths.f3,
      f4ArtifactRoot: stagePaths.f4,
      analysisRoot,
    }, undefined, fixedNow)).toThrow(/Feature 5 F1 artifact|exact validated F1 stage path|invalid/i);
  });

  it("does not treat lookalike stage names as a validated workspace", () => {
    const { analysisRoot, stagePaths } = createAnalysisWorkspaceRoot();
    const lookalikeStagePaths = {
      f1: path.join("test", "demo-output", "lookalike", "01 - F1 Data Parsing"),
      f3: path.join("test", "demo-output", "lookalike", "03 - F3 Drawing Governance"),
      f4: path.join("test", "demo-output", "lookalike", "04 - F4 Calculation Engine"),
    };

    expect(resolveFeature5OutputLayout({
      ...parsed,
      f1ArtifactRoot: lookalikeStagePaths.f1,
      f3ArtifactRoot: lookalikeStagePaths.f3,
      f4ArtifactRoot: lookalikeStagePaths.f4,
    }, undefined, fixedNow).runRoot).toBe("test/demo-output/f5-runs/04---F4-Calculation-Engine/2026-08-11T12-34-56-789Z");

    expect(() => resolveFeature5OutputLayout({
      ...parsed,
      f1ArtifactRoot: lookalikeStagePaths.f1,
      f3ArtifactRoot: stagePaths.f3,
      f4ArtifactRoot: stagePaths.f4,
      analysisRoot,
    }, undefined, fixedNow)).toThrow(/validated F1 stage path.*missing|exact validated F1 stage path/i);
  });

  it("rejects a workspace root whose canonical identity changes during validation", () => {
    const { analysisRoot, stagePaths } = createAnalysisWorkspaceRoot();
    const changedRoot = path.join(path.dirname(analysisRoot), "retargeted-root");
    let realpathCallCount = 0;

    expect(() => resolveFeature5OutputLayout({
      ...parsed,
      f1ArtifactRoot: stagePaths.f1,
      f3ArtifactRoot: stagePaths.f3,
      f4ArtifactRoot: stagePaths.f4,
      analysisRoot,
    }, undefined, fixedNow, undefined, {
      realpathSync(targetPath) {
        if (path.resolve(targetPath) === path.resolve(analysisRoot)) {
          realpathCallCount += 1;
          return realpathCallCount === 1 ? path.resolve(analysisRoot) : changedRoot;
        }
        return fs.realpathSync(targetPath);
      },
      statSync(targetPath) {
        if (path.resolve(targetPath) === path.resolve(changedRoot)) {
          return fs.statSync(analysisRoot);
        }
        return fs.statSync(targetPath);
      },
    })).toThrow(/changed during allocation|changed during validation|analysis workspace root/i);
  });

  it("builds the deterministic default layout and controlled publish root", () => {
    expect(resolveFeature5OutputLayout(parsed, undefined, fixedNow)).toEqual({
      runId: "2026-08-11T12-34-56-789Z",
      runRoot: "test/demo-output/f5-runs/F4-Demo/2026-08-11T12-34-56-789Z",
      publishRoot: "test/demo-output",
      reportJsonName: "Feature5-Report.json",
      reportMdName: "Feature5-Report.md",
      runSummaryJsonName: "Feature5-Run-Summary.json",
      imageObservationsJsonName: "Feature5-Image-Observations.json",
      manifestName: "manifest.json",
      allowExistingRunRoot: false,
    });
  });

  it("normalizes host-native separators and preserves spaces through safeName", () => {
    const layout = resolveFeature5OutputLayout({
      ...parsed,
      f4ArtifactRoot: path.join("test", "demo-output", "f4-runs", "F4 Run With Spaces"),
    }, undefined, fixedNow);

    expect(layout.runRoot).toBe("test/demo-output/f5-runs/F4-Run-With-Spaces/2026-08-11T12-34-56-789Z");
  });

  it("accepts an absolute override only with an explicit common publish root", () => {
    const publishRoot = fs.mkdtempSync(path.join(os.tmpdir(), "f5-layout-"));
    try {
      const f1ArtifactRoot = path.join(publishRoot, "f1", "run-a");
      const outputRoot = path.join(publishRoot, "f5", "run-a");
      const layout = resolveFeature5OutputLayout({
        ...parsed,
        f1ArtifactRoot,
        f4ArtifactRoot: path.join("runs", "F4 Source"),
      }, outputRoot, fixedNow, publishRoot);

      expect(layout.publishRoot).toBe(publishRoot);
      expect(layout.runRoot).toBe(path.join(outputRoot, "2026-08-11T12-34-56-789Z"));
      expect(layout.allowExistingRunRoot).toBe(false);
    } finally {
      fs.rmSync(publishRoot, { recursive: true, force: true });
    }
  });

  it("accepts a relative override under an explicit common publish root", () => {
    const layout = resolveFeature5OutputLayout(parsed, "test/demo-output/custom f5", fixedNow, "test/demo-output");

    expect(layout.publishRoot).toBe("test/demo-output");
    expect(layout.runRoot).toBe("test/demo-output/custom f5/2026-08-11T12-34-56-789Z");
    expect(layout.allowExistingRunRoot).toBe(false);
  });

  it("rejects unsafe output root override segments", () => {
    for (const outputRoot of [
      "",
      " ",
      "runs/../shared",
      "../outside",
      "runs/./child",
      "runs/CON",
      "runs/bad\u0001name",
      "runs/.. ",
      "runs/. ",
      "runs/CON ",
      "runs/name.",
      "runs/bad\u0085name",
    ]) {
      expect(() => resolveFeature5OutputLayout(parsed, outputRoot, fixedNow, "test/demo-output")).toThrow(/output root|unsafe/i);
    }
  });

  it("requires the publish root to exist", () => {
    const missingPublishRoot = path.join(os.tmpdir(), `missing-f5-publish-${process.pid}-${Date.now()}`);
    expect(() => resolveFeature5OutputLayout(
      { ...parsed, f1ArtifactRoot: path.join(missingPublishRoot, "f1") },
      path.join(missingPublishRoot, "f5"),
      fixedNow,
      missingPublishRoot,
    )).toThrow(/publish root.*exist|exist.*publish root/i);
  });

  it("accepts only host-native absolute path styles", () => {
    const nonNativePaths = process.platform === "win32"
      ? ["/var/tmp/f5-output"]
      : ["C:\\f5-output", "\\\\server\\share\\f5-output"];

    for (const outputRoot of [...nonNativePaths, "C:drive-relative"]) {
      expect(() => resolveFeature5OutputLayout(parsed, outputRoot, fixedNow, "test/demo-output"))
        .toThrow(/native|drive-relative|path style/i);
    }
  });

  it("rejects containment through a junction or directory symlink", ({ skip }) => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "f5-link-layout-"));
    const publishRoot = path.join(sandbox, "publish");
    const outsideRoot = path.join(sandbox, "outside");
    const linkedRoot = path.join(publishRoot, "linked");
    fs.mkdirSync(publishRoot);
    fs.mkdirSync(outsideRoot);

    try {
      try {
        fs.symlinkSync(outsideRoot, linkedRoot, process.platform === "win32" ? "junction" : "dir");
      } catch (error) {
        if (error?.code === "EPERM" || error?.code === "EACCES") {
          skip();
          return;
        }
        throw error;
      }

      expect(() => resolveFeature5OutputLayout(
        { ...parsed, f1ArtifactRoot: path.join(publishRoot, "f1") },
        path.join(linkedRoot, "new-run"),
        fixedNow,
        publishRoot,
      )).toThrow(/publish root|outside|link/i);
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it("rejects different drive roots and unsafe UNC roots", () => {
    if (process.platform === "win32") {
      expect(() => resolveFeature5OutputLayout(
        { ...parsed, f1ArtifactRoot: "C:\\publish\\f1" },
        "Z:\\publish\\f5",
        fixedNow,
        "C:\\publish",
      )).toThrow(/drive|root/i);

      expect(() => resolveFeature5OutputLayout(
        { ...parsed, f1ArtifactRoot: "\\\\server\\share-a\\publish\\f1" },
        "\\\\server\\share-b\\publish\\f5",
        fixedNow,
        "\\\\server\\share-a\\publish",
      )).toThrow(/drive|root|unc/i);
    }
  });

  it("does not create output directories while evaluating containment", () => {
    const publishRoot = fs.mkdtempSync(path.join(os.tmpdir(), "f5-no-create-"));
    const outputRoot = path.join(publishRoot, "new parent", "new output");
    try {
      resolveFeature5OutputLayout(
        { ...parsed, f1ArtifactRoot: path.join(publishRoot, "f1", "run") },
        outputRoot,
        fixedNow,
        publishRoot,
      );
      expect(fs.existsSync(outputRoot)).toBe(false);
    } finally {
      fs.rmSync(publishRoot, { recursive: true, force: true });
    }
  });

  it("preserves legitimate spaces inside path segments", () => {
    const layout = resolveFeature5OutputLayout(
      { ...parsed, f1ArtifactRoot: "test/demo-output/f1 runs/run one" },
      "test/demo-output/f5 runs/run one",
      fixedNow,
      "test/demo-output",
    );
    expect(layout.runRoot).toContain("f5 runs/run one");
  });

  it("requires an explicit publish root for every output override", () => {
    expect(() => resolveFeature5OutputLayout(parsed, "test/demo-output/custom", fixedNow)).toThrow(/publish root/i);
  });

  it.each(["", " ", "test/../demo-output", "test/./demo-output", "CON", "test/demo\u0000-output"])(
    "rejects unsafe publish root %j",
    (publishRoot) => {
      expect(() => resolveFeature5OutputLayout(parsed, "test/demo-output/custom", fixedNow, publishRoot)).toThrow(/publish root|unsafe/i);
    },
  );

  it("rejects an override outside the explicit publish root", () => {
    expect(() => resolveFeature5OutputLayout(
      parsed,
      "other-output/f5",
      fixedNow,
      "test/demo-output",
    )).toThrow(/publish root|outside/i);
  });

  it("rejects an F1 root outside the explicit publish root", () => {
    expect(() => resolveFeature5OutputLayout(
      { ...parsed, f1ArtifactRoot: "other-output/f1" },
      "test/demo-output/custom",
      fixedNow,
      "test/demo-output",
    )).toThrow(/publish root|outside/i);
  });

  it.each([
    ".",
    "..",
    "test/demo-output/f4-runs/.",
    "test/demo-output/f4-runs/..",
    "test/demo-output/f4-runs/CON",
    "test/demo-output/f4-runs/NUL.txt",
    "test/demo-output/f4-runs/bad\u0007name",
  ])("rejects an unsafe F4 run stem from %j", (f4ArtifactRoot) => {
    expect(() => resolveFeature5OutputLayout({
      ...parsed,
      f4ArtifactRoot,
    }, undefined, fixedNow)).toThrow(/output name|f4.*unsafe/i);
  });

  it("rejects a traversal-bearing F4 artifact root before applying safeName", () => {
    expect(() => resolveFeature5OutputLayout({
      ...parsed,
      f4ArtifactRoot: "test/demo-output/f4-runs/../escaped",
    }, undefined, fixedNow)).toThrow(/output name|f4.*unsafe/i);
  });
});