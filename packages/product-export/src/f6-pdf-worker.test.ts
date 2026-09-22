import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { executeF6PdfWorker } from "./f6-pdf-worker-process.js";

const roots: string[] = [];
const request = (timeoutMs = 1_000) => {
  const root = mkdtempSync(join(process.cwd(), ".f6-worker-test-"));
  roots.push(root);
  return {
    browser: "chrome.exe",
    strategy: "playwright" as const,
    htmlPath: join(root, "report.html"),
    pdfPath: join(root, "report.pdf"),
    profilePath: join(root, "profile"),
    pidPath: join(root, "browser.pid"),
    timeoutMs,
  };
};
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe("F6 isolated worker deadline and cleanup", () => {
  it("hard-kills a hung worker and its owned browser tree without leaking worker output", () => {
    const value = request();
    const fixture = join(roots.at(-1)!, "hung-worker.cjs");
    const childPidPath = join(roots.at(-1)!, "observed.pid");
    const descendantPidPath = join(roots.at(-1)!, "descendant.pid");
    const browserScript = `
      const descendant = require("node:child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
      require("node:fs").writeFileSync(${JSON.stringify(descendantPidPath)}, String(descendant.pid));
      setInterval(() => {}, 1000);
    `;
    writeFileSync(fixture, `
      const fs = require("node:fs");
      const { spawn } = require("node:child_process");
      const request = JSON.parse(fs.readFileSync(0, "utf8"));
      const browser = spawn(process.execPath, ["-e", ${JSON.stringify(browserScript)}], {
        stdio: "ignore", detached: process.platform !== "win32",
      });
      fs.writeFileSync(request.pidPath, String(browser.pid));
      fs.writeFileSync(${JSON.stringify(childPidPath)}, String(browser.pid));
      process.stdout.write("CONFIDENTIAL worker output");
      process.stderr.write("CONFIDENTIAL worker error");
      setInterval(() => {}, 1000);
    `);
    const start = Date.now();
    let failure: unknown;
    let workerPid: number | undefined;
    try {
      executeF6PdfWorker(value, {
        spawnWorker: (executable, _args, options) => {
          const result = spawnSync(executable, [fixture], options);
          workerPid = result.pid;
          return result;
        },
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: "ETIMEDOUT" });
    expect(String(failure)).not.toContain("CONFIDENTIAL");
    expect(Date.now() - start).toBeLessThan(8_000);
    const pid = Number(readFileSync(childPidPath, "utf8"));
    const descendantPid = Number(readFileSync(descendantPidPath, "utf8"));
    expect(() => process.kill(pid, 0)).toThrow();
    expect(() => process.kill(descendantPid, 0)).toThrow();
    expect(workerPid).toBeGreaterThan(0);
    expect(() => process.kill(workerPid!, 0)).toThrow();
    expect(existsSync(value.pidPath)).toBe(false);
  });

  it.each([0, 1])("cleans up the browser on worker exit %s and passes a hard deadline", (status) => {
    const value = request();
    const killed: number[] = [];
    const run = () => executeF6PdfWorker(value, {
      spawnWorker: (_executable, _args, options) => {
        expect(options.timeout).toBe(value.timeoutMs);
        expect(options.killSignal).toBe("SIGKILL");
        expect(options.stdio).toBe("pipe");
        expect(options.env?.DEBUG).toBe("");
        expect(JSON.parse(String(options.input))).toEqual(value);
        writeFileSync(value.pidPath, "987654");
        return { pid: 123, output: [], stdout: Buffer.from("secret"), stderr: Buffer.from("secret"), status, signal: null };
      },
      killBrowser: (pid) => { killed.push(pid); },
    });
    if (status === 0) run();
    else expect(run).toThrow("F6 PDF worker failed.");
    expect(killed).toEqual([987654]);
    expect(existsSync(value.pidPath)).toBe(false);
  });

  it("waits for transient Windows profile locks after process termination", () => {
    const value = request();
    let removals = 0;
    let waits = 0;
    executeF6PdfWorker(value, {
      spawnWorker: () => ({ pid: 123, output: [], stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), status: 0, signal: null }),
      removeProfile: (profile) => {
        expect(profile).toBe(value.profilePath);
        removals += 1;
        if (removals <= 3) throw Object.assign(new Error("profile still locked"), { code: "EPERM" });
      },
      waitForCleanup: () => { waits += 1; },
    });
    expect(removals).toBe(4);
    expect(waits).toBe(3);
  });

  it("bounds cleanup retries and replaces filesystem paths with a safe category", () => {
    let waits = 0;
    expect(() => executeF6PdfWorker(request(), {
      spawnWorker: () => ({ pid: 123, output: [], stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), status: 0, signal: null }),
      removeProfile: () => { throw Object.assign(new Error("confidential path"), { code: "EPERM" }); },
      waitForCleanup: () => { waits += 1; },
    })).toThrow(expect.objectContaining({ code: "cleanup_failed", message: "F6 PDF browser cleanup failed." }));
    expect(waits).toBe(20);
  });
});
