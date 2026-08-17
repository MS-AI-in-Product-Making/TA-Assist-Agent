import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runFeature6WorkflowCommand } from "./feature6.js";

const cleanup: string[] = [];
const execFileState = vi.hoisted(() => ({
  options: [] as unknown[],
  nextError: undefined as ({ code: string; message: string; killed?: boolean; signal?: string } | undefined),
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

async function fixture(scriptBody = `console.log(JSON.stringify({status:"completed",outputDirectory:"runs/demo/f6"}));\n`): Promise<{
  rootDir: string;
  f2Root: string;
  f3Root: string;
  f4Root: string;
  f5Root: string;
}> {
  const rootDir = await mkdtemp(join(tmpdir(), "feature6-command-"));
  cleanup.push(rootDir);
  const roots = ["f2", "f3", "f4", "f5"].map((feature) => join(rootDir, "runs", "demo", feature));
  const [f2Root, f3Root, f4Root, f5Root] = roots as [string, string, string, string];
  const scriptPath = join(rootDir, "scripts", "run-f6-full-validation.mjs");
  await Promise.all([...roots.map((root) => mkdir(root, { recursive: true })), mkdir(join(rootDir, "scripts"), { recursive: true })]);
  await Promise.all([
    writeFile(join(f2Root, "Feature2-Report.json"), "{}", "utf8"),
    writeFile(join(f3Root, "Feature3-Report.json"), "{}", "utf8"),
    writeFile(join(f4Root, "Feature4-Calculation.json"), "{}", "utf8"),
    writeFile(join(f5Root, "Feature5-Report.json"), "{}", "utf8"),
    writeFile(scriptPath, scriptBody, "utf8"),
  ]);
  await chmod(scriptPath, 0o755);
  return { rootDir, f2Root, f3Root, f4Root, f5Root };
}

describe("Feature 6 CLI command", () => {
  it("runs the repository runner with four roots, repeated worksheets, and optional evidence paths", async () => {
    const setup = await fixture(`
import { writeFileSync } from "node:fs";
writeFileSync("invocation.json", JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));
console.log(JSON.stringify({ status: "partially_completed", outputDirectory: "runs/demo/f6" }));
`);
    const options = {
      selectedWorksheetNames: ["Overview", "Details"],
      supplierCapabilityPath: "evidence/supplier.json",
      datumStrategyPath: "evidence/datum.json",
      costPath: "evidence/cost.json",
      imageObservationsPath: "evidence/images.json",
    } as const;

    const result = await runFeature6WorkflowCommand(
      setup.rootDir, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root, options,
    );

    expect(result).toBe("Feature 6 workflow completed.\nf6: runs/demo/f6\nstatus: partially_completed");
    expect(JSON.parse(await readFile(join(setup.rootDir, "invocation.json"), "utf8"))).toEqual({
      argv: [
        setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
        "--worksheet", "Overview", "--worksheet", "Details",
        "--supplier-capability", "evidence/supplier.json",
        "--datum-strategy", "evidence/datum.json",
        "--cost", "evidence/cost.json",
        "--image-observations", "evidence/images.json",
      ],
      cwd: setup.rootDir,
    });
    expect(execFileState.options).toContainEqual(expect.objectContaining({
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
      killSignal: "SIGTERM",
    }));
  });

  it.each(["completed", "partially_completed", "calculation_failed"])(
    "accepts the governed nonfailed runner status %s",
    async (status) => {
      const setup = await fixture(`console.log(JSON.stringify({status:${JSON.stringify(status)},outputDirectory:"runs/demo/f6"}));\n`);

      await expect(runFeature6WorkflowCommand(
        setup.rootDir, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
        { selectedWorksheetNames: ["Overview"] },
      )).resolves.toContain(`status: ${status}`);
    },
  );

  it("rejects failed, invalid, and polluted runner output with safe typed errors", async () => {
    for (const scriptBody of [
      `console.log(JSON.stringify({status:"failed",reasonCode:"secret C:/private/input.xlsx"}));\n`,
      `console.log("not-json");\n`,
      `process.stdout.write(JSON.stringify({status:"completed",outputDirectory:"runs/demo/f6"}) + "\\n{}\\n");\n`,
    ]) {
      const setup = await fixture(scriptBody);
      await expect(runFeature6WorkflowCommand(
        setup.rootDir, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
        { selectedWorksheetNames: ["Overview"] },
      )).rejects.toMatchObject({ code: "internal_error", summary: "Feature 6 workflow execution failed." });
    }
  });

  it.each(["", " runs/demo/f6", "runs/demo/f6 ", "runs/demo/f6\r\nforged", "runs/demo/f6\u0000forged"])(
    "rejects a polluted runner output directory %j",
    async (outputDirectory) => {
      const setup = await fixture(`console.log(${JSON.stringify(JSON.stringify({ status: "completed", outputDirectory }))});\n`);
      await expect(runFeature6WorkflowCommand(
        setup.rootDir, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
        { selectedWorksheetNames: ["Overview"] },
      )).rejects.toMatchObject({ code: "internal_error", summary: "Feature 6 workflow execution failed." });
    },
  );

  it("maps child failures to safe typed errors without leaking paths", async () => {
    const timeoutSetup = await fixture();
    execFileState.nextError = { code: "ETIMEDOUT", message: `private path: ${timeoutSetup.f2Root}` };
    const timeout = runFeature6WorkflowCommand(
      timeoutSetup.rootDir, timeoutSetup.f2Root, timeoutSetup.f3Root, timeoutSetup.f4Root, timeoutSetup.f5Root,
      { selectedWorksheetNames: ["Overview"] },
    );
    await expect(timeout).rejects.toMatchObject({ code: "transient_error", summary: "Feature 6 workflow execution timed out." });
    await expect(timeout).rejects.not.toThrow(timeoutSetup.f2Root);

    const dependencySetup = await fixture(`import "missing-feature6-dependency";\n`);
    await expect(runFeature6WorkflowCommand(
      dependencySetup.rootDir, dependencySetup.f2Root, dependencySetup.f3Root, dependencySetup.f4Root, dependencySetup.f5Root,
      { selectedWorksheetNames: ["Overview"] },
    )).rejects.toMatchObject({ code: "dependency_error", summary: "Feature 6 workflow dependencies are unavailable." });
  });

  it("requires the runner, four report-bearing artifact roots, and unique nonempty worksheets", async () => {
    const setup = await fixture();
    await rm(join(setup.f3Root, "Feature3-Report.json"));
    await expect(runFeature6WorkflowCommand(
      setup.rootDir, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
      { selectedWorksheetNames: ["Overview"] },
    )).rejects.toMatchObject({ code: "validation_error" });

    for (const selectedWorksheetNames of [[], ["Overview", " Overview "], ["   "]]) {
      const valid = await fixture();
      await expect(runFeature6WorkflowCommand(
        valid.rootDir, valid.f2Root, valid.f3Root, valid.f4Root, valid.f5Root,
        { selectedWorksheetNames },
      )).rejects.toMatchObject({ code: "validation_error" });
    }
  });
});
