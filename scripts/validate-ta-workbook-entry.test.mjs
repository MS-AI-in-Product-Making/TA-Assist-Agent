import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { validateTaWorkbookEntry } from "./validate-ta-workbook-entry.mjs";

const cleanup = [];

afterEach(() => {
  for (const target of cleanup.splice(0)) rmSync(target, { recursive: true, force: true });
});

describe("validateTaWorkbookEntry", () => {
  it("exposes the governed entry command and forbids repository-wide content scans", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    const skill = readFileSync(new URL("../.github/skills/design-optimization/SKILL.md", import.meta.url), "utf8");

    expect(packageJson.scripts["workflow:ta-entry-validation"]).toBe("node scripts/validate-ta-workbook-entry.mjs");
    expect(skill).toContain("npm run workflow:ta-entry-validation -- <ta-workbook-path>");
    expect(skill).toContain("Never recursively scan repository contents to validate controlled versions");
    expect(skill).toContain("process requirements `process-requirements-v3`");
    expect(skill).not.toContain("process requirements `process-requirements-v1`");
  });

  it("validates only the supplied workbook and controlled capability loaders", () => {
    const root = mkdtempSync(path.join(tmpdir(), "ta-entry-"));
    cleanup.push(root);
    const workbookPath = path.join(root, "Input.xlsx");
    const workbookBytes = Buffer.from("workbook fixture");
    writeFileSync(workbookPath, workbookBytes);
    const validateCapabilities = vi.fn(() => ({
      featureId: "F0",
      status: "completed",
      versions: ["v1", "internal-v1", "interpretation-rules-v2", "process-requirements-v3"],
      artifactRoot: undefined,
    }));

    expect(validateTaWorkbookEntry(workbookPath, { validateCapabilities })).toEqual({
      status: "completed",
      workbook: {
        canonicalPath: workbookPath,
        contentHash: createHash("sha256").update(workbookBytes).digest("hex"),
        sizeBytes: workbookBytes.length,
      },
      controlledVersions: ["v1", "internal-v1", "interpretation-rules-v2", "process-requirements-v3"],
    });
    expect(validateCapabilities).toHaveBeenCalledOnce();
  });

  it.each([
    ["a directory", (root) => root],
    ["a non-xlsx file", (root) => {
      const target = path.join(root, "Input.xlsm");
      writeFileSync(target, "fixture");
      return target;
    }],
    ["a missing file", (root) => path.join(root, "Missing.xlsx")],
  ])("rejects %s before capability validation", (_label, createTarget) => {
    const root = mkdtempSync(path.join(tmpdir(), "ta-entry-invalid-"));
    cleanup.push(root);
    const validateCapabilities = vi.fn();

    expect(() => validateTaWorkbookEntry(createTarget(root), { validateCapabilities })).toThrow();
    expect(validateCapabilities).not.toHaveBeenCalled();
  });
});