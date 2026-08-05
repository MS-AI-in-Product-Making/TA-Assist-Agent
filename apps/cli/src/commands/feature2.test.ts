import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isFeature2Phrase, runFeature2WorkflowCommand } from "./feature2.js";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((target) => rm(target, { recursive: true, force: true })));
});

async function fixture(): Promise<{ rootDir: string; workbookPath: string }> {
  const rootDir = await mkdtemp(join(tmpdir(), "feature2-command-"));
  cleanup.push(rootDir);
  const workbookPath = join(rootDir, "Demo.xlsx");
  const scriptPath = join(rootDir, "scripts", "f2-excel-runner.mjs");
  await mkdir(join(rootDir, "scripts"), { recursive: true });
  await writeFile(workbookPath, "fixture", "utf8");
  await writeFile(scriptPath, `console.log(JSON.stringify({runRoot:"runs/demo",f1Root:"runs/demo/f1",f2Root:"runs/demo/f2",validationRoot:"runs/demo/validation"}));\n`, "utf8");
  await chmod(scriptPath, 0o755);
  return { rootDir, workbookPath };
}

describe("Feature 2 CLI command", () => {
  it("recognizes explicit English and Chinese phrases", () => {
    expect(isFeature2Phrase("帮我用F2分析下excel")).toBe(true);
    expect(isFeature2Phrase("use F2 to analyze Excel")).toBe(true);
    expect(isFeature2Phrase("analyze Excel")).toBe(false);
  });

  it("executes the repository runner and returns all output roots", async () => {
    const setup = await fixture();

    await expect(runFeature2WorkflowCommand(setup.rootDir, setup.workbookPath)).resolves.toContain("runRoot: runs/demo");
    await expect(runFeature2WorkflowCommand(setup.rootDir, setup.workbookPath)).resolves.toContain("validation: runs/demo/validation");
  });

  it("maps missing inputs and runner dependencies to safe typed errors", async () => {
    const setup = await fixture();
    await expect(runFeature2WorkflowCommand(setup.rootDir, join(setup.rootDir, "Missing.xlsx"))).rejects.toMatchObject({ code: "validation_error" });
    await expect(runFeature2WorkflowCommand(setup.rootDir, setup.rootDir)).rejects.toMatchObject({ code: "validation_error" });
    await rm(join(setup.rootDir, "scripts", "f2-excel-runner.mjs"));
    await expect(runFeature2WorkflowCommand(setup.rootDir, setup.workbookPath)).rejects.toMatchObject({ code: "validation_error" });
  });
});