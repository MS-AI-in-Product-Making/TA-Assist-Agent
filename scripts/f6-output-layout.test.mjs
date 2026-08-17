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

describe("resolveFeature6OutputLayout", () => {
  it("builds the fixed default artifact layout", () => {
    expect(resolveFeature6OutputLayout(roots(), undefined, fixedNow)).toEqual({
      runId: "2026-08-17T01-02-03-456Z",
      runRoot: "test/demo-output/f6-runs/F5-Source/2026-08-17T01-02-03-456Z",
      publishRoot: "test/demo-output",
      optimizationJsonName: "Feature6-Optimization.json",
      optimizationMdName: "Feature6-Optimization.md",
      composedReportJsonName: "Feature6-Composed-Report.json",
      composedReportMdName: "Feature6-Composed-Report.md",
      runSummaryJsonName: "Feature6-Run-Summary.json",
      manifestName: "manifest.json",
    });
  });

  it("accepts an override only with an existing explicit publish root", () => {
    const publishRoot = fs.mkdtempSync(path.join(os.tmpdir(), "f6-layout-"));
    cleanup.push(publishRoot);
    const layout = resolveFeature6OutputLayout(
      roots(publishRoot),
      path.join(publishRoot, "f6", "custom"),
      fixedNow,
      publishRoot,
    );
    expect(layout.runRoot).toBe(path.join(publishRoot, "f6", "custom", layout.runId));
  });

  it.each(["../outside", "runs/../outside", "runs/./child", "runs/CON", "runs/bad\u0001name"])(
    "rejects unsafe output root %j",
    (outputRoot) => expect(() => resolveFeature6OutputLayout(roots(), outputRoot, fixedNow, "test/demo-output"))
      .toThrow(/unsafe|publish root|outside/i),
  );

  it("requires an explicit publish root for an override", () => {
    expect(() => resolveFeature6OutputLayout(roots(), "test/demo-output/custom", fixedNow))
      .toThrow(/publish root/i);
  });

  it("rejects any governed input root outside the publish root", () => {
    for (const key of Object.keys(roots())) {
      expect(() => resolveFeature6OutputLayout({ ...roots(), [key]: "outside/run" }, "test/demo-output/f6", fixedNow, "test/demo-output"))
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
    expect(() => resolveFeature6OutputLayout(roots(publishRoot), path.join(linkedRoot, "run"), fixedNow, publishRoot))
      .toThrow(/publish root|outside|link/i);
  });

  it("does not create output directories while resolving", () => {
    const publishRoot = fs.mkdtempSync(path.join(os.tmpdir(), "f6-no-create-"));
    cleanup.push(publishRoot);
    const outputRoot = path.join(publishRoot, "new", "output");
    resolveFeature6OutputLayout(roots(publishRoot), outputRoot, fixedNow, publishRoot);
    expect(fs.existsSync(outputRoot)).toBe(false);
  });
});