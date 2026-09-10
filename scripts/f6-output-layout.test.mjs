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
    const layout = resolveFeature6OutputLayout(roots(), undefined, fixedNow);
    expect(layout).toMatchObject({
      artifactSetVersion: "f6-artifact-set-v3",
      optimizationJsonName: "Feature6-Optimization.json",
      finalReportMdName: "Feature6-Report.md",
      finalReportPdfName: "Feature6-Report.pdf",
      runSummaryJsonName: "Feature6-Run-Summary.json",
      manifestName: "manifest.json",
    });
    expect(layout).not.toHaveProperty("optimizationMdName");
    expect(layout).not.toHaveProperty("composedReportJsonName");
    expect(layout).not.toHaveProperty("composedReportMdName");
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
    )).toThrow(/publish root|link/i);
  });

  it("does not create output directories while resolving", () => {
    const publishRoot = fs.mkdtempSync(path.join(os.tmpdir(), "f6-no-create-"));
    cleanup.push(publishRoot);
    const outputRoot = path.join(publishRoot, "new", "output");
    resolveFeature6OutputLayout(roots(publishRoot), outputRoot, fixedNow, publishRoot);
    expect(fs.existsSync(outputRoot)).toBe(false);
  });
});