import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isFeature5Phrase, runFeature5WorkflowCommand } from "./feature5.js";

const cleanup: string[] = [];
const execFileState = vi.hoisted(() => ({
  options: [] as unknown[],
  nextError: undefined as ({ code: string; message: string } | undefined),
}));

vi.mock("node:child_process", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:child_process")>();
  const mockedExecFile = ((...args: unknown[]) => {
    execFileState.options.push(args[2]);
    if (execFileState.nextError !== undefined) {
      const callback = args.at(-1) as (error: unknown, stdout: string, stderr: string) => void;
      const error = execFileState.nextError;
      execFileState.nextError = undefined;
      queueMicrotask(() => callback(error, "", ""));
      return undefined;
    }
    return Reflect.apply(original.execFile, undefined, args);
  }) as typeof original.execFile;
  Object.defineProperty(mockedExecFile, Symbol.for("nodejs.util.promisify.custom"), {
    value: (file: string, args: readonly string[], options: object) => new Promise((resolve, reject) => {
      Reflect.apply(mockedExecFile, undefined, [file, args, options, (error: unknown, stdout: string, stderr: string) => {
        if (error !== null) reject(error);
        else resolve({ stdout, stderr });
      }]);
    }),
  });
  return { ...original, execFile: mockedExecFile };
});

afterEach(async () => {
  execFileState.options.length = 0;
  execFileState.nextError = undefined;
  await Promise.all(cleanup.splice(0).map((target) => rm(target, { recursive: true, force: true })));
});

async function fixture(scriptBody = `console.log(JSON.stringify({status:"completed",outputDirectory:"runs/demo/f5"}));\n`): Promise<{
  rootDir: string;
  f1Root: string;
  f3Root: string;
  f4Root: string;
}> {
  const rootDir = await mkdtemp(join(tmpdir(), "feature5-command-"));
  cleanup.push(rootDir);
  const f1Root = join(rootDir, "runs", "demo", "f1");
  const f3Root = join(rootDir, "runs", "demo", "f3");
  const f4Root = join(rootDir, "runs", "demo", "f4");
  const scriptPath = join(rootDir, "scripts", "run-f5-full-validation.mjs");
  await Promise.all([
    mkdir(f1Root, { recursive: true }),
    mkdir(f3Root, { recursive: true }),
    mkdir(f4Root, { recursive: true }),
    mkdir(join(rootDir, "scripts"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(f1Root, "Feature1-Report.json"), "{}", "utf8"),
    writeFile(join(f3Root, "Feature3-Report.json"), "{}", "utf8"),
    writeFile(join(f4Root, "Feature4-Calculation.json"), "{}", "utf8"),
    writeFile(scriptPath, scriptBody, "utf8"),
  ]);
  await chmod(scriptPath, 0o755);
  return { rootDir, f1Root, f3Root, f4Root };
}

describe("Feature 5 CLI command", () => {
  it("recognizes only the exact supported English and Chinese phrases", () => {
    expect(isFeature5Phrase("使用F5分析报告")).toBe(true);
    expect(isFeature5Phrase("  使用 F5 分析报告  ")).toBe(true);
    expect(isFeature5Phrase("USE F5 ANALYSIS REPORT")).toBe(true);
    expect(isFeature5Phrase("请使用F5分析报告")).toBe(false);
    expect(isFeature5Phrase("F5")).toBe(false);
  });

  it("runs the repository runner with three roots and optional arguments", async () => {
    const setup = await fixture(`
import { writeFileSync } from "node:fs";
const result = {
  status: "partially_completed",
  outputDirectory: "runs/demo/f5",
};
writeFileSync("invocation.json", JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));
console.log(JSON.stringify(result));
`);
    const imageObservationsPath = join(setup.rootDir, "observations.json");
    await writeFile(imageObservationsPath, "{}", "utf8");

    const result = await runFeature5WorkflowCommand(
      setup.rootDir,
      setup.f1Root,
      setup.f3Root,
      setup.f4Root,
      { selectedWorksheetNames: ["Overview", "Details"], imageObservationsPath },
    );

    expect(result).toBe("Feature 5 workflow completed.\nf5: runs/demo/f5\nstatus: partially_completed");
    const invocation = JSON.parse(await readFile(join(setup.rootDir, "invocation.json"), "utf8"));
    expect(invocation).toEqual({
      argv: [
        setup.f1Root,
        setup.f3Root,
        setup.f4Root,
        "--worksheet", "Overview",
        "--worksheet", "Details",
        "--image-observations", imageObservationsPath,
      ],
      cwd: setup.rootDir,
    });
    expect(execFileState.options).toContainEqual(expect.objectContaining({
      timeout: 120_000,
      killSignal: "SIGTERM",
    }));
  });

  it("returns completed output for one valid runner JSON document", async () => {
    const setup = await fixture();

    await expect(runFeature5WorkflowCommand(setup.rootDir, setup.f1Root, setup.f3Root, setup.f4Root))
      .resolves.toBe("Feature 5 workflow completed.\nf5: runs/demo/f5\nstatus: completed");
  });

  it("rejects failed and invalid runner output with safe typed errors", async () => {
    const failed = await fixture(`console.log(JSON.stringify({status:"failed",reasonCode:"secret C:/private/input.xlsx"}));\n`);
    const invalid = await fixture(`console.log("not-json");\n`);

    await expect(runFeature5WorkflowCommand(failed.rootDir, failed.f1Root, failed.f3Root, failed.f4Root))
      .rejects.toMatchObject({ code: "internal_error", summary: "Feature 5 workflow execution failed." });
    await expect(runFeature5WorkflowCommand(invalid.rootDir, invalid.f1Root, invalid.f3Root, invalid.f4Root))
      .rejects.toMatchObject({ code: "internal_error", summary: "Feature 5 workflow execution failed." });
  });

  it.each(["", " runs/demo/f5", "runs/demo/f5 ", "runs/demo/f5\r\nforged", "runs/demo/f5\u0000forged"])(
    "rejects a polluted runner output directory %j",
    async (outputDirectory) => {
      const setup = await fixture(`console.log(${JSON.stringify(JSON.stringify({ status: "completed", outputDirectory }))});\n`);

      await expect(runFeature5WorkflowCommand(setup.rootDir, setup.f1Root, setup.f3Root, setup.f4Root))
        .rejects.toMatchObject({ code: "internal_error", summary: "Feature 5 workflow execution failed." });
    },
  );

  it("maps child-process timeouts to a safe transient error", async () => {
    const setup = await fixture();
    execFileState.nextError = { code: "ETIMEDOUT", message: `private path: ${setup.f1Root}` };

    await expect(runFeature5WorkflowCommand(setup.rootDir, setup.f1Root, setup.f3Root, setup.f4Root))
      .rejects.toMatchObject({ code: "transient_error", summary: "Feature 5 workflow execution timed out." });
  });

  it("reports unavailable runner dependencies without leaking child-process details", async () => {
    const setup = await fixture(`import "missing-feature5-dependency";\n`);

    await expect(runFeature5WorkflowCommand(setup.rootDir, setup.f1Root, setup.f3Root, setup.f4Root))
      .rejects.toMatchObject({ code: "dependency_error", summary: "Feature 5 workflow dependencies are unavailable." });
  });

  it("requires the runner and all three report-bearing artifact directories", async () => {
    const setup = await fixture();
    const missingRoot = join(setup.rootDir, "missing");
    await rm(join(setup.f3Root, "Feature3-Report.json"));

    await expect(runFeature5WorkflowCommand(setup.rootDir, setup.f1Root, setup.f3Root, setup.f4Root))
      .rejects.toMatchObject({ code: "validation_error" });
    await expect(runFeature5WorkflowCommand(setup.rootDir, setup.f1Root, missingRoot, setup.f4Root))
      .rejects.toMatchObject({ code: "validation_error" });
    await rm(join(setup.rootDir, "scripts", "run-f5-full-validation.mjs"));
    await expect(runFeature5WorkflowCommand(setup.rootDir, setup.f1Root, setup.f3Root, setup.f4Root))
      .rejects.toMatchObject({ code: "validation_error" });
  });

  it("requires regular report files and rejects top-level artifact symlinks", async () => {
    const reportDirectory = await fixture();
    await rm(join(reportDirectory.f1Root, "Feature1-Report.json"));
    await mkdir(join(reportDirectory.f1Root, "Feature1-Report.json"));

    await expect(runFeature5WorkflowCommand(
      reportDirectory.rootDir, reportDirectory.f1Root, reportDirectory.f3Root, reportDirectory.f4Root,
    )).rejects.toMatchObject({ code: "validation_error" });

    const linkedArtifact = await fixture();
    const f1Link = join(linkedArtifact.rootDir, "linked-f1");
    await symlink(linkedArtifact.f1Root, f1Link, process.platform === "win32" ? "junction" : "dir");

    await expect(runFeature5WorkflowCommand(
      linkedArtifact.rootDir, f1Link, linkedArtifact.f3Root, linkedArtifact.f4Root,
    )).rejects.toMatchObject({ code: "validation_error" });
  });
});