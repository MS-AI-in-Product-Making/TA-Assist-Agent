import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isFeature3Phrase, runFeature3WorkflowCommand } from "./feature3.js";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((target) => rm(target, { recursive: true, force: true })));
});

async function fixture(): Promise<{ rootDir: string; f2Root: string }> {
  const rootDir = await mkdtemp(join(tmpdir(), "feature3-command-"));
  cleanup.push(rootDir);
  const f2Root = join(rootDir, "runs", "demo", "f2");
  const scriptPath = join(rootDir, "scripts", "run-f3-full-validation.mjs");
  await mkdir(f2Root, { recursive: true });
  await mkdir(join(rootDir, "scripts"), { recursive: true });
  await writeFile(join(f2Root, "Feature2-Report.json"), "{}", "utf8");
  await writeFile(scriptPath, `console.log(JSON.stringify({status:"governance_required",outputDirectory:"runs/demo/f3"}));\n`, "utf8");
  await chmod(scriptPath, 0o755);
  return { rootDir, f2Root };
}

describe("Feature 3 CLI command", () => {
  it("recognizes explicit English and Chinese phrases", () => {
    expect(isFeature3Phrase("帮我用F3治理DIM ID")).toBe(true);
    expect(isFeature3Phrase("use F3 to govern DIM IDs")).toBe(true);
    expect(isFeature3Phrase("govern dimensions")).toBe(false);
  });

  it("runs Feature 3 from one Feature 2 artifact directory", async () => {
    const setup = await fixture();
    const result = await runFeature3WorkflowCommand(setup.rootDir, setup.f2Root);

    expect(result).toContain("Feature 3 workflow completed.");
    expect(result).toContain("f3: runs/demo/f3");
    expect(result).toContain("status: governance_required");
  });

  it("rejects an xlsx input and directories without the F2 JSON report", async () => {
    const setup = await fixture();
    const workbook = join(setup.rootDir, "Demo.xlsx");
    await writeFile(workbook, "fixture", "utf8");
    const emptyDirectory = join(setup.rootDir, "empty");
    await mkdir(emptyDirectory);

    await expect(runFeature3WorkflowCommand(setup.rootDir, workbook)).rejects.toMatchObject({ code: "validation_error" });
    await expect(runFeature3WorkflowCommand(setup.rootDir, emptyDirectory)).rejects.toMatchObject({ code: "validation_error" });
  });
});