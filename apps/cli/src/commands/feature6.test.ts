import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runFeature6WorkflowCommand } from "./feature6.js";

const trustedRoot = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".."));
const publishRoot = join(trustedRoot, "test", "demo-output");
const cleanup: string[] = [];
const execFileState = vi.hoisted(() => ({
  options: [] as unknown[],
  scriptPath: undefined as string | undefined,
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
    const commandArgs = [...(args[1] as string[])];
    if (execFileState.scriptPath !== undefined) commandArgs[0] = execFileState.scriptPath;
    return Reflect.apply(original.execFile, undefined, [args[0], commandArgs, ...args.slice(2)]);
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
  execFileState.scriptPath = undefined;
  execFileState.nextError = undefined;
  vi.unstubAllEnvs();
  await rm(join(trustedRoot, "invocation.json"), { force: true });
  await Promise.all(cleanup.splice(0).map((target) => rm(target, { recursive: true, force: true })));
});

async function fixture(scriptBody = `console.log(JSON.stringify({status:"completed",outputDirectory:"test/demo-output/f6-runs/demo/run-1",finalReportMdPath:"test/demo-output/f6-runs/demo/run-1/Feature6-Report.md",finalReportPdfPath:"test/demo-output/f6-runs/demo/run-1/Feature6-Report.pdf"}));\n`): Promise<{
  rootDir: string;
  f2Root: string;
  f3Root: string;
  f4Root: string;
  f5Root: string;
  scriptPath: string;
}> {
  await mkdir(publishRoot, { recursive: true });
  const fixtureRoot = await mkdtemp(join(publishRoot, ".feature6-legacy-"));
  cleanup.push(fixtureRoot);
  const rootDir = trustedRoot;
  const roots = ["f2", "f3", "f4", "f5"].map((feature) => join(fixtureRoot, "inputs", feature));
  const [f2Root, f3Root, f4Root, f5Root] = roots as [string, string, string, string];
  const scriptPath = join(fixtureRoot, "runner.mjs");
  execFileState.scriptPath = scriptPath;
  await Promise.all([
    ...roots.map((root) => mkdir(root, { recursive: true })),
    mkdir(join(publishRoot, "f6-runs", "demo", "run-1"), { recursive: true }),
    writeFile(join(publishRoot, "f6-runs", "demo", "run-1", "Feature6-Report.md"), "# report\n", "utf8"),
    writeFile(join(publishRoot, "f6-runs", "demo", "run-1", "Feature6-Report.pdf"), Buffer.from("%PDF-1.7\nvalidated\n")),
  ]);
  await Promise.all([
    writeFile(join(f2Root, "Feature2-Report.json"), "{}", "utf8"),
    writeFile(join(f3Root, "Feature3-Report.json"), "{}", "utf8"),
    writeFile(join(f4Root, "Feature4-Calculation.json"), "{}", "utf8"),
    writeFile(join(f5Root, "Feature5-Report.json"), "{}", "utf8"),
    writeFile(scriptPath, scriptBody, "utf8"),
  ]);
  await chmod(scriptPath, 0o755);
  return { rootDir, f2Root, f3Root, f4Root, f5Root, scriptPath };
}

describe("Feature 6 CLI command", () => {
  it("labels the validated absolute report path explicitly", async () => {
    const setup = await fixture();

    const result = await runFeature6WorkflowCommand(
      setup.rootDir, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
      { selectedWorksheetNames: ["Analysis-A"] },
    );

    expect(result).toContain(`fullReportPath: ${join(publishRoot, "f6-runs", "demo", "run-1", "Feature6-Report.md")}`);
    expect(result).toContain(`fullPdfReportPath: ${join(publishRoot, "f6-runs", "demo", "run-1", "Feature6-Report.pdf")}`);
    expect(result).not.toContain("\nreport: ");
  });

  it("runs the repository runner with four roots, repeated worksheets, and optional evidence paths", async () => {
    const setup = await fixture(`
import { writeFileSync } from "node:fs";
writeFileSync("invocation.json", JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));
console.log(JSON.stringify({ status: "partially_completed", outputDirectory: "test/demo-output/f6-runs/demo/run-1", finalReportMdPath: "test/demo-output/f6-runs/demo/run-1/Feature6-Report.md", finalReportPdfPath: "test/demo-output/f6-runs/demo/run-1/Feature6-Report.pdf" }));
`);
    const options = {
      selectedWorksheetNames: ["Overview", "Details"],
      languageTag: "en-US",
      modelInterpretationPath: "evidence/model.json",
      supplierCapabilityPath: "evidence/supplier.json",
      datumStrategyPath: "evidence/datum.json",
      costPath: "evidence/cost.json",
      imageObservationsPath: "evidence/images.json",
      analysisContextPath: "evidence/context.json",
      optimizationTargetsPath: "evidence/targets.json",
    } as const;

    const result = await runFeature6WorkflowCommand(
      setup.rootDir, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root, options,
    );

    expect(result).toBe(`Feature 6 workflow completed.\nfullReportPath: ${join(publishRoot, "f6-runs", "demo", "run-1", "Feature6-Report.md")}\nfullPdfReportPath: ${join(publishRoot, "f6-runs", "demo", "run-1", "Feature6-Report.pdf")}\nstatus: partially_completed`);
    expect(JSON.parse(await readFile(join(setup.rootDir, "invocation.json"), "utf8"))).toEqual({
      argv: [
        setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
        "--worksheet", "Overview", "--worksheet", "Details",
        "--language", "en-US", "--model-interpretation", "evidence/model.json",
        "--supplier-capability", "evidence/supplier.json",
        "--datum-strategy", "evidence/datum.json",
        "--cost", "evidence/cost.json",
        "--image-observations", "evidence/images.json",
        "--analysis-context", "evidence/context.json",
        "--optimization-targets", "evidence/targets.json",
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
      const setup = await fixture(`console.log(JSON.stringify({status:${JSON.stringify(status)},outputDirectory:"test/demo-output/f6-runs/demo/run-1",finalReportMdPath:"test/demo-output/f6-runs/demo/run-1/Feature6-Report.md",finalReportPdfPath:"test/demo-output/f6-runs/demo/run-1/Feature6-Report.pdf"}));\n`);

      await expect(runFeature6WorkflowCommand(
        setup.rootDir, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
        { selectedWorksheetNames: ["Overview"] },
      )).resolves.toContain(`status: ${status}`);
    },
  );

  it("rejects failed, invalid, and polluted runner output with safe typed errors", async () => {
    for (const scriptBody of [
      `console.log(JSON.stringify({status:"failed",reasonCode:"secret C:/private/input.xlsx",finalReportMdPath:"test/demo-output/f6-runs/demo/run-1/Feature6-Report.md"}));\n`,
      `console.log("not-json");\n`,
      `process.stdout.write(JSON.stringify({status:"completed",outputDirectory:"test/demo-output/f6-runs/demo/run-1",finalReportMdPath:"test/demo-output/f6-runs/demo/run-1/Feature6-Report.md"}) + "\\n{}\\n");\n`,
    ]) {
      const setup = await fixture(scriptBody);
      await expect(runFeature6WorkflowCommand(
        setup.rootDir, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
        { selectedWorksheetNames: ["Overview"] },
      )).rejects.toMatchObject({ code: "internal_error", summary: "Feature 6 workflow execution failed." });
    }
  });

  it.each(["", " test/demo-output/f6", "test/demo-output/f6 ", "test/demo-output/f6\r\nforged", "test/demo-output/f6\u0000forged"])(
    "rejects a polluted runner output directory %j",
    async (outputDirectory) => {
      const setup = await fixture(`console.log(${JSON.stringify(JSON.stringify({ status: "completed", outputDirectory, finalReportMdPath: "test/demo-output/f6-runs/demo/run-1/Feature6-Report.md" }))});\n`);
      await expect(runFeature6WorkflowCommand(
        setup.rootDir, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
        { selectedWorksheetNames: ["Overview"] },
      )).rejects.toMatchObject({ code: "internal_error", summary: "Feature 6 workflow execution failed." });
    },
  );

  it("rejects runner output directories outside the repository publish root", async () => {
    const setup = await fixture();
    for (const outputDirectory of [
      "../private/f6",
      "test/demo-output/../../../private/f6",
      "test/demo-output",
      join(setup.rootDir, "test", "demo-output", "f6-runs", "demo", "run-1"),
    ]) {
      await writeFile(
        setup.scriptPath,
        `console.log(${JSON.stringify(JSON.stringify({ status: "completed", outputDirectory, finalReportMdPath: "test/demo-output/f6-runs/demo/run-1/Feature6-Report.md" }))});\n`,
        "utf8",
      );

      await expect(runFeature6WorkflowCommand(
        setup.rootDir, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
        { selectedWorksheetNames: ["Overview"] },
      )).rejects.toMatchObject({ code: "internal_error", summary: "Feature 6 workflow execution failed." });
    }
  });

  it("does not inherit Feature 6 output root overrides from the CLI environment", async () => {
    vi.stubEnv("AI_TVA_F6_OUTPUT_ROOT", "outside/f6-runs");
    vi.stubEnv("AI_TVA_F6_PUBLISH_ROOT", "outside");
    const setup = await fixture();

    await runFeature6WorkflowCommand(
      setup.rootDir, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
      { selectedWorksheetNames: ["Overview"] },
    );

    expect(execFileState.options).toContainEqual(expect.objectContaining({
      env: expect.not.objectContaining({
        AI_TVA_F6_OUTPUT_ROOT: expect.anything(),
        AI_TVA_F6_PUBLISH_ROOT: expect.anything(),
      }),
    }));
  });

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

  it.each([
    undefined,
    "",
    " test/demo-output/f6-runs/demo/run-1/Feature6-Report.md",
    "test/demo-output/f6-runs/demo/run-1/Feature6-Report.md ",
    "test/demo-output/f6-runs/demo/run-1/report.md",
    "test/demo-output/f6-runs/demo/run-1/missing.md",
    "../outside/Feature6-Report.md",
  ])("rejects unsafe or invalid final report path %j", async (finalReportMdPath) => {
    const setup = await fixture(`console.log(${JSON.stringify(JSON.stringify({
      status: "completed",
      outputDirectory: "test/demo-output/f6-runs/demo/run-1",
      finalReportMdPath,
    }))});\n`);

    await expect(runFeature6WorkflowCommand(
      setup.rootDir, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
      { selectedWorksheetNames: ["Overview"] },
    )).rejects.toMatchObject({ code: "internal_error", summary: "Feature 6 workflow execution failed." });
  });

  it("rejects final report path when it is outside the reported output directory", async () => {
    const setup = await fixture(`console.log(${JSON.stringify(JSON.stringify({
      status: "completed",
      outputDirectory: "test/demo-output/f6-runs/demo/run-1",
      finalReportMdPath: "test/demo-output/f6-runs/demo/run-2/Feature6-Report.md",
    }))});\n`);
    await mkdir(join(publishRoot, "f6-runs", "demo", "run-2"), { recursive: true });
    await writeFile(join(publishRoot, "f6-runs", "demo", "run-2", "Feature6-Report.md"), "# report\n", "utf8");

    await expect(runFeature6WorkflowCommand(
      setup.rootDir, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
      { selectedWorksheetNames: ["Overview"] },
    )).rejects.toMatchObject({ code: "internal_error", summary: "Feature 6 workflow execution failed." });
  });

});
