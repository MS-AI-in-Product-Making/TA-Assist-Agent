import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveFeature5OutputLayout } from "./f5-output-layout.mjs";

describe("resolveFeature5OutputLayout", () => {
  const fixedNow = () => new Date("2026-08-11T12:34:56.789Z");
  const parsed = {
    f1ArtifactRoot: "test/demo-output/f1-runs/F1 Demo",
    f3ArtifactRoot: "test/demo-output/f3-runs/F3 Demo",
    f4ArtifactRoot: "test/demo-output/f4-runs/F4 Demo",
    selectedWorksheetNames: ["Analysis A"],
    imageObservationsPath: "notes/image observations.json",
  };

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
    } finally {
      fs.rmSync(publishRoot, { recursive: true, force: true });
    }
  });

  it("accepts a relative override under an explicit common publish root", () => {
    const layout = resolveFeature5OutputLayout(parsed, "test/demo-output/custom f5", fixedNow, "test/demo-output");

    expect(layout.publishRoot).toBe("test/demo-output");
    expect(layout.runRoot).toBe("test/demo-output/custom f5/2026-08-11T12-34-56-789Z");
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