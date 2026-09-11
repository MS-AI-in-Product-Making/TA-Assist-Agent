import { execFile } from "node:child_process";
import { lstatSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { runFeature6WorkflowCommand } from "./feature6.js";

const trustedRoot = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".."));
const publishRoot = join(trustedRoot, "test", "demo-output");
const trustedRunner = join(trustedRoot, "scripts", "run-f6-full-validation.mjs");
const cleanup: string[] = [];

type ExecuteOptions = {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly maxBuffer: number;
  readonly timeout: number;
  readonly killSignal: NodeJS.Signals;
};
type ExecuteFile = (
  file: string,
  args: readonly string[],
  options: ExecuteOptions,
) => Promise<{ stdout: string; stderr: string }>;

beforeAll(async () => mkdir(publishRoot, { recursive: true }));
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(cleanup.splice(0).map((target) => rm(target, { recursive: true, force: true })));
});

async function fixture() {
  const base = await mkdtemp(join(publishRoot, ".feature6-command-"));
  cleanup.push(base);
  const [f2Root, f3Root, f4Root, f5Root] = ["f2", "f3", "f4", "f5"]
    .map((feature) => join(base, "inputs", feature)) as [string, string, string, string];
  const outputDirectory = join(base, "f6-runs", "run-1");
  await Promise.all([f2Root, f3Root, f4Root, f5Root, outputDirectory].map((value) => mkdir(value, { recursive: true })));
  await Promise.all([
    writeFile(join(f2Root, "Feature2-Report.json"), "{}", "utf8"),
    writeFile(join(f3Root, "Feature3-Report.json"), "{}", "utf8"),
    writeFile(join(f4Root, "Feature4-Calculation.json"), "{}", "utf8"),
    writeFile(join(f5Root, "Feature5-Report.json"), "{}", "utf8"),
    writeFile(join(outputDirectory, "Feature6-Report.md"), "# report\n", "utf8"),
    writeFile(join(outputDirectory, "Feature6-Report.pdf"), Buffer.from("%PDF-1.7\nvalidated\n")),
  ]);
  return {
    base,
    f2Root,
    f3Root,
    f4Root,
    f5Root,
    outputDirectory,
    outputRelative: relative(trustedRoot, outputDirectory).replaceAll(sep, "/"),
  };
}

function successfulExecutor(outputDirectory: string, status = "completed"): ExecuteFile {
  return async () => ({
    stdout: JSON.stringify({
      status,
      outputDirectory,
      finalReportMdPath: `${outputDirectory.replaceAll("\\", "/")}/Feature6-Report.md`,
      finalReportPdfPath: `${outputDirectory.replaceAll("\\", "/")}/Feature6-Report.pdf`,
    }),
    stderr: "",
  });
}

async function run(
  setup: Awaited<ReturnType<typeof fixture>>,
  executeFile: ExecuteFile,
  selectedWorksheetNames: readonly string[] = ["Overview"],
): Promise<string> {
  return runFeature6WorkflowCommand(
    trustedRoot, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
    { selectedWorksheetNames }, { executeFile },
  );
}

describe("Feature 6 CLI trust boundary", () => {
  it("rejects a successful runner result without the required PDF report", async () => {
    const setup = await fixture();

    await expect(run(setup, async () => ({
      stdout: JSON.stringify({
        status: "completed",
        outputDirectory: setup.outputRelative,
        finalReportMdPath: `${setup.outputRelative}/Feature6-Report.md`,
      }),
      stderr: "",
    }))).rejects.toMatchObject({ code: "internal_error", summary: "Feature 6 workflow execution failed." });
  });

  it("rejects an untrusted repository root before executing its runner", async () => {
    const fakeRoot = await mkdtemp(join(tmpdir(), "feature6-fake-root-"));
    cleanup.push(fakeRoot);
    const marker = join(fakeRoot, "runner-executed.marker");
    const roots = ["f2", "f3", "f4", "f5"].map((feature) => join(fakeRoot, feature));
    await Promise.all([...roots, join(fakeRoot, "scripts")].map((value) => mkdir(value, { recursive: true })));
    await Promise.all([
      writeFile(join(roots[0], "Feature2-Report.json"), "{}"),
      writeFile(join(roots[1], "Feature3-Report.json"), "{}"),
      writeFile(join(roots[2], "Feature4-Calculation.json"), "{}"),
      writeFile(join(roots[3], "Feature5-Report.json"), "{}"),
      writeFile(join(fakeRoot, "scripts", "run-f6-full-validation.mjs"), `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "executed");`),
    ]);
    let executeCalls = 0;

    await expect(runFeature6WorkflowCommand(
      fakeRoot, roots[0], roots[1], roots[2], roots[3],
      { selectedWorksheetNames: ["Overview"] },
      { executeFile: async () => {
        executeCalls += 1;
        return { stdout: "{}", stderr: "" };
      } },
    )).rejects.toMatchObject({ code: "validation_error" });
    expect(executeCalls).toBe(0);
    await expect(readFile(marker, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("uses only the fixed trusted runner with governed execution options and cleared overrides", async () => {
    vi.stubEnv("PATH", "trusted-path");
    vi.stubEnv("SystemRoot", "C:\\Windows");
    vi.stubEnv("PROGRAMFILES", "C:\\Program Files");
    vi.stubEnv("PROGRAMFILES(X86)", "C:\\Program Files (x86)");
    vi.stubEnv("LOCALAPPDATA", "C:\\Users\\engineer\\AppData\\Local");
    vi.stubEnv("AI_TVA_CHROMIUM_EXECUTABLE", "C:\\untrusted\\payload.exe");
    vi.stubEnv("NODE_OPTIONS", "--require attacker.cjs");
    vi.stubEnv("NODE_PATH", "attacker-modules");
    vi.stubEnv("NODE_EXTRA_CA_CERTS", "attacker-ca.pem");
    vi.stubEnv("npm_config_node_options", "--import=attacker.mjs");
    vi.stubEnv("ELECTRON_RUN_AS_NODE", "1");
    vi.stubEnv("AI_TVA_F6_OUTPUT_ROOT", "outside/f6-runs");
    vi.stubEnv("AI_TVA_F6_PUBLISH_ROOT", "outside");
    vi.stubEnv("AI_TVA_UNTRUSTED_OVERRIDE", "outside");
    const setup = await fixture();
    const calls: Array<{ file: string; args: readonly string[]; options: ExecuteOptions }> = [];
    const executeFile: ExecuteFile = async (file, args, options) => {
      calls.push({ file, args, options });
      return {
        stdout: JSON.stringify({
          status: "partially_completed",
          outputDirectory: setup.outputRelative,
          finalReportMdPath: `${setup.outputRelative}/Feature6-Report.md`,
          finalReportPdfPath: `${setup.outputRelative}/Feature6-Report.pdf`,
        }),
        stderr: "",
      };
    };

    const result = await runFeature6WorkflowCommand(
      trustedRoot, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
      {
        selectedWorksheetNames: ["Overview", "Details"],
        languageTag: "en-US",
        modelInterpretationPath: "evidence/model.json",
        supplierCapabilityPath: "evidence/supplier.json",
        datumStrategyPath: "evidence/datum.json",
        costPath: "evidence/cost.json",
        imageObservationsPath: "evidence/images.json",
      },
      { executeFile },
    );

    expect(result).toBe(`Feature 6 workflow completed.\nfullReportPath: ${join(setup.outputDirectory, "Feature6-Report.md")}\nfullPdfReportPath: ${join(setup.outputDirectory, "Feature6-Report.pdf")}\nstatus: partially_completed`);
    expect(calls).toHaveLength(1);
    expect(calls[0].file).toBe(process.execPath);
    expect(calls[0].args).toEqual([
      trustedRunner, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
      "--worksheet", "Overview", "--worksheet", "Details",
      "--language", "en-US", "--model-interpretation", "evidence/model.json",
      "--supplier-capability", "evidence/supplier.json",
      "--datum-strategy", "evidence/datum.json",
      "--cost", "evidence/cost.json",
      "--image-observations", "evidence/images.json",
    ]);
    expect(calls[0].options).toMatchObject({
      cwd: trustedRoot, timeout: 120_000, maxBuffer: 4 * 1024 * 1024, killSignal: "SIGTERM",
    });
    expect(calls[0].options.env).toMatchObject({
      PATH: "trusted-path",
      SystemRoot: "C:\\Windows",
      PROGRAMFILES: "C:\\Program Files",
      "PROGRAMFILES(X86)": "C:\\Program Files (x86)",
    });
    expect(Object.keys(calls[0].options.env)).toEqual(expect.arrayContaining(["PATH", "SystemRoot"]));
    expect(Object.keys(calls[0].options.env).every((key) => [
      "PATH", "Path", "SystemRoot", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP", "USERPROFILE",
      "HOMEDRIVE", "HOMEPATH", "PROGRAMFILES", "PROGRAMFILES(X86)", "APPDATA", "HOME",
      "TMPDIR", "LANG", "LC_ALL", "LC_CTYPE",
    ].includes(key))).toBe(true);
    for (const rejectedKey of [
      "NODE_OPTIONS", "NODE_PATH", "NODE_EXTRA_CA_CERTS", "npm_config_node_options", "ELECTRON_RUN_AS_NODE",
      "AI_TVA_F6_OUTPUT_ROOT", "AI_TVA_F6_PUBLISH_ROOT", "AI_TVA_UNTRUSTED_OVERRIDE", "AI_TVA_CHROMIUM_EXECUTABLE",
      "LOCALAPPDATA",
    ]) {
      expect(calls[0].options.env).not.toHaveProperty(rejectedKey);
    }
    expect(lstatSync(trustedRunner).isFile()).toBe(true);
    expect(lstatSync(trustedRunner).isSymbolicLink()).toBe(false);
    expect(realpathSync(trustedRunner)).toBe(trustedRunner);
  });

  it("rejects redirected browser installation roots", async () => {
    vi.stubEnv("PROGRAMFILES", "C:\\attacker");
    vi.stubEnv("PROGRAMFILES(X86)", "D:\\payload");
    vi.stubEnv("LOCALAPPDATA", "C:\\attacker-local");
    const setup = await fixture();
    let childEnvironment: NodeJS.ProcessEnv | undefined;

    await runFeature6WorkflowCommand(
      trustedRoot, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
      { selectedWorksheetNames: ["Overview"] },
      { executeFile: async (_file, _args, options) => {
        childEnvironment = options.env;
        return successfulExecutor(setup.outputRelative)();
      } },
    );

    expect(childEnvironment).not.toHaveProperty("PROGRAMFILES");
    expect(childEnvironment).not.toHaveProperty("PROGRAMFILES(X86)");
    expect(childEnvironment).not.toHaveProperty("LOCALAPPDATA");
  });

  it("does not let NODE_OPTIONS execute a marker module in the real default child", async () => {
    const setup = await fixture();
    const markerRoot = await mkdtemp(join(tmpdir(), "feature6-node-options-"));
    cleanup.push(markerRoot);
    const markerPath = join(markerRoot, "executed.marker");
    const markerModulePath = join(markerRoot, "marker.cjs");
    await writeFile(
      markerModulePath,
      `require("node:fs").writeFileSync(${JSON.stringify(markerPath)}, "executed");\n`,
      "utf8",
    );
    await writeFile(join(setup.f2Root, "Feature2-Report.json"), "not-json", "utf8");
    const previousNodeOptions = process.env.NODE_OPTIONS;
    process.env.NODE_OPTIONS = `--require ${JSON.stringify(markerModulePath)}`;

    let failure: unknown;
    try {
      await runFeature6WorkflowCommand(
        trustedRoot, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
        { selectedWorksheetNames: ["Overview"] },
      );
    } catch (error: unknown) {
      failure = error;
    } finally {
      if (previousNodeOptions === undefined) delete process.env.NODE_OPTIONS;
      else process.env.NODE_OPTIONS = previousNodeOptions;
    }

    expect(failure).toMatchObject({ code: "internal_error", summary: "Feature 6 workflow execution failed." });
    expect(String(failure)).not.toContain(setup.f2Root);
    expect(String(failure)).not.toContain(markerModulePath);
    await expect(readFile(markerPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each(["completed", "partially_completed", "calculation_failed"])(
    "accepts governed status %s and returns the canonical final report path",
    async (status) => {
      const setup = await fixture();
      await expect(run(setup, successfulExecutor(setup.outputRelative, status)))
        .resolves.toBe(`Feature 6 workflow completed.\nfullReportPath: ${join(setup.outputDirectory, "Feature6-Report.md")}\nfullPdfReportPath: ${join(setup.outputDirectory, "Feature6-Report.pdf")}\nstatus: ${status}`);
    },
  );

  it.each([
    "", " test/demo-output/f6", "test/demo-output/f6 ",
    "test/demo-output/f6\u0000forged", "test/demo-output/f6\u0085forged", "test/demo-output/f6\u202eforged",
    "../private/f6", "test/demo-output/../../../private/f6", "C:relative\\f6", "\\\\server\\share\\f6",
  ])("rejects unsafe runner output directory %j", async (outputDirectory) => {
    const setup = await fixture();
    await expect(run(setup, successfulExecutor(outputDirectory)))
      .rejects.toMatchObject({ code: "internal_error", summary: "Feature 6 workflow execution failed." });
  });

  it("rejects absolute, nonexistent, publish-root, and linked-out output directories", async () => {
    const setup = await fixture();
    const outside = await mkdtemp(join(tmpdir(), "feature6-output-outside-"));
    cleanup.push(outside);
    const linkedOutput = join(setup.base, "linked-output");
    await symlink(outside, linkedOutput, process.platform === "win32" ? "junction" : "dir");

    for (const outputDirectory of [
      setup.outputDirectory,
      relative(trustedRoot, join(setup.base, "missing-output")).replaceAll(sep, "/"),
      "test/demo-output",
      relative(trustedRoot, linkedOutput).replaceAll(sep, "/"),
    ]) {
      await expect(run(setup, successfulExecutor(outputDirectory)))
        .rejects.toMatchObject({ code: "internal_error", summary: "Feature 6 workflow execution failed." });
    }
  });

  it.each([
    "test/demo-output/f6-runs/run-1/report.md",
    "test/demo-output/f6-runs/run-1/missing.md",
    "../private/Feature6-Report.md",
  ])("rejects unsafe final report path %j", async (finalReportMdPath) => {
    const setup = await fixture();
    const executeFile: ExecuteFile = async () => ({
      stdout: JSON.stringify({ status: "completed", outputDirectory: setup.outputRelative, finalReportMdPath }),
      stderr: "",
    });

    await expect(run(setup, executeFile)).rejects.toMatchObject({
      code: "internal_error",
      summary: "Feature 6 workflow execution failed.",
    });
  });

  it("rejects report paths that do not stay inside the reported output directory", async () => {
    const setup = await fixture();
    const siblingOutput = join(setup.base, "f6-runs", "run-2");
    await mkdir(siblingOutput, { recursive: true });
    await writeFile(join(siblingOutput, "Feature6-Report.md"), "# report\n", "utf8");
    const siblingRelative = relative(trustedRoot, siblingOutput).replaceAll(sep, "/");

    await expect(run(setup, async () => ({
      stdout: JSON.stringify({
        status: "completed",
        outputDirectory: setup.outputRelative,
        finalReportMdPath: `${siblingRelative}/Feature6-Report.md`,
      }),
      stderr: "",
    }))).rejects.toMatchObject({ code: "internal_error", summary: "Feature 6 workflow execution failed." });
  });

  it("rejects a final report path that is a linked filesystem entry", async () => {
    const setup = await fixture();
    const reportPath = join(setup.outputDirectory, "Feature6-Report.md");
    await rm(reportPath);
    if (process.platform === "win32") {
      const linkedTarget = join(setup.outputDirectory, "linked-report-target");
      await mkdir(linkedTarget);
      await symlink(linkedTarget, reportPath, "junction");
    } else {
      const realReportPath = join(setup.outputDirectory, "real-report.md");
      await writeFile(realReportPath, "# report\n", "utf8");
      await symlink(realReportPath, reportPath, "file");
    }

    await expect(run(setup, successfulExecutor(setup.outputRelative)))
      .rejects.toMatchObject({ code: "internal_error", summary: "Feature 6 workflow execution failed." });
  });

  it("rejects a linked root even when it resolves to the trusted repository", async () => {
    const setup = await fixture();
    const linkParent = await mkdtemp(join(tmpdir(), "feature6-root-link-"));
    cleanup.push(linkParent);
    const linkedRoot = join(linkParent, "repo-link");
    await symlink(trustedRoot, linkedRoot, process.platform === "win32" ? "junction" : "dir");
    let executeCalls = 0;

    await expect(runFeature6WorkflowCommand(
      linkedRoot, setup.f2Root, setup.f3Root, setup.f4Root, setup.f5Root,
      { selectedWorksheetNames: ["Overview"] },
      { executeFile: async () => {
        executeCalls += 1;
        return { stdout: "{}", stderr: "" };
      } },
    )).rejects.toMatchObject({ code: "validation_error" });
    expect(executeCalls).toBe(0);
  });

  it("maps a real blocking child timeout to a typed transient error and terminates the child", async () => {
    const setup = await fixture();
    const startedAt = Date.now();
    const executeFile: ExecuteFile = (_file, _args, options) => new Promise((resolvePromise, rejectPromise) => {
      execFile(process.execPath, ["-e", "setInterval(() => {}, 1_000)"], {
        ...options, timeout: 25, encoding: "utf8",
      }, (error, stdout, stderr) => {
        if (error !== null) rejectPromise(error);
        else resolvePromise({ stdout, stderr });
      });
    });

    await expect(run(setup, executeFile))
      .rejects.toMatchObject({ code: "transient_error", summary: "Feature 6 workflow execution timed out." });
    expect(Date.now() - startedAt).toBeLessThan(2_000);
  });

  it("maps missing child dependencies to a safe typed dependency error", async () => {
    const setup = await fixture();
    const executeFile: ExecuteFile = async () => {
      throw Object.assign(new Error(`Cannot find module at ${setup.f2Root}`), { code: "MODULE_NOT_FOUND" });
    };

    const execution = run(setup, executeFile);
    await expect(execution).rejects.toMatchObject({
      code: "dependency_error", summary: "Feature 6 workflow dependencies are unavailable.",
    });
    await expect(execution).rejects.not.toThrow(setup.f2Root);
  });

  it("rejects invalid child JSON, report roots, and worksheet selections", async () => {
    const setup = await fixture();
    await expect(run(setup, async () => ({ stdout: "not-json", stderr: "" })))
      .rejects.toMatchObject({ code: "internal_error" });
    await rm(join(setup.f3Root, "Feature3-Report.json"));
    await expect(run(setup, successfulExecutor(setup.outputRelative))).rejects.toMatchObject({ code: "validation_error" });

    for (const selectedWorksheetNames of [[], ["Overview", " Overview "], ["   "]]) {
      const valid = await fixture();
      await expect(run(valid, successfulExecutor(valid.outputRelative), selectedWorksheetNames))
        .rejects.toMatchObject({ code: "validation_error" });
    }
  });
});
