import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as worker from "./f6-pdf-worker-process.js";

const roots: string[] = [];
const request = (timeoutMs = 1_000) => {
  const root = mkdtempSync(join(process.cwd(), ".f6-worker-test-"));
  roots.push(root);
  return {
    browser: "chrome.exe", strategy: "playwright" as const,
    htmlPath: join(root, "report.html"), pdfPath: join(root, "report.pdf"),
    profilePath: join(root, "profile"), timeoutMs,
  };
};
afterEach(() => {
  vi.useRealTimers();
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

function fakeChild() {
  const child = Object.assign(new EventEmitter(), {
    pid: 123456, exitCode: null, signalCode: null, stdin: { end: () => {} },
  });
  return child as unknown as ChildProcess;
}

describe("F6 live worker containment", () => {
  it("reports launch failure safely without waiting for the attempt timeout", () => {
    expect(() => worker.executeF6PdfWorker({ ...request(), browser: "CONFIDENTIAL-missing-browser.exe" }))
      .toThrow(expect.objectContaining({ code: "execution_failed", message: "F6 PDF worker failed." }));
  });

  it("exposes an asynchronous supervisor behind the synchronous public boundary", () => {
    expect(worker.superviseF6PdfWorker).toBeTypeOf("function");
  });

  it("kills the owned worker tree during launch without any browser PID publication", async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    const targets: ChildProcess[] = [];
    const result = worker.superviseF6PdfWorker(request(), {
      spawnWorker: () => child,
      terminateTree: (owned, done) => {
        targets.push(owned);
        child.emit("exit", null, "SIGKILL");
        setTimeout(() => child.emit("close", null, "SIGKILL"), 20);
        done();
      },
    });
    await vi.advanceTimersByTimeAsync(1_000);
    let settled = false;
    void result.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(20);
    expect(await result).toBe("timed_out");
    expect(targets).toEqual([child]);
  });

  it.each(["exit", "close"])("never targets a recycled PID after worker %s even at the deadline", async (event) => {
    vi.useFakeTimers();
    const child = fakeChild();
    let kills = 0;
    setTimeout(() => {
      child.emit(event, 0, null);
      if (event === "exit") setTimeout(() => child.emit("close", 0, null), 40);
    }, 1_000);
    const result = worker.superviseF6PdfWorker(request(), {
      spawnWorker: () => child,
      terminateTree: () => { kills += 1; },
    });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toBe("success");
    expect(kills).toBe(0);
  });

  it("handles timeout winning the close race with exactly one tree termination", async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    let kills = 0;
    const result = worker.superviseF6PdfWorker(request(), {
      spawnWorker: () => child,
      terminateTree: (_owned, done) => { kills += 1; done(); },
    });
    setTimeout(() => { child.emit("exit", 0); child.emit("close", 0); }, 1_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toBe("timed_out");
    expect(kills).toBe(1);
  });

  it.each(["error", "missing-close", "missing-callback"])("bounds cleanup %s with safe metadata", async (failure) => {
    vi.useFakeTimers();
    const child = fakeChild();
    const result = worker.superviseF6PdfWorker(request(), {
      spawnWorker: () => child,
      terminateTree: (_owned, done) => {
        if (failure === "error") done(new Error("CONFIDENTIAL path"));
        if (failure === "missing-close") done();
        if (failure !== "missing-close") child.emit("close", null, "SIGKILL");
      },
    });
    await vi.advanceTimersByTimeAsync(6_000);
    expect(await result).toBe("cleanup_failed");
  });

  it.each(["execution_failed", "cleanup_failed"])("contains a live worker reporting %s before normal exit", async (outcome) => {
    const child = fakeChild();
    const result = worker.superviseF6PdfWorker(request(), {
      spawnWorker: () => child,
      terminateTree: (owned, done) => {
        expect(owned).toBe(child);
        child.emit("exit", null, "SIGKILL");
        child.emit("close", null, "SIGKILL");
        done();
      },
    });
    child.emit("message", outcome);
    expect(await result).toBe(outcome);
  });

  it("kills real worker descendants before launch completes without a browser PID protocol", async () => {
    const value = request(1_500);
    const root = roots.at(-1)!;
    const observed = join(root, "observed.json");
    const fixture = join(root, "hung.cjs");
    writeFileSync(fixture, `
      const { spawn } = require("node:child_process");
      const fs = require("node:fs");
      const browser = spawn(process.execPath, ["-e", \`
        const child = require("node:child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {stdio:"ignore"});
        require("node:fs").writeFileSync(${JSON.stringify(observed).replaceAll("\\", "\\\\")}, JSON.stringify([process.pid, child.pid]));
        setInterval(() => {}, 1000);
      \`], {stdio:"ignore"});
      process.stdout.write("CONFIDENTIAL");
      setInterval(() => {}, 1000);
    `);
    let owned: ChildProcess | undefined;
    const result = await worker.superviseF6PdfWorker(value, {
      spawnWorker: (executable, _args, options) => {
        owned = spawn(executable, [fixture], options);
        return owned;
      },
    });
    expect(result).toBe("timed_out");
    const pids = JSON.parse(readFileSync(observed, "utf8")) as number[];
    for (const pid of [owned!.pid!, ...pids]) expect(() => process.kill(pid, 0)).toThrow();
  }, 10_000);

  it("retries transient profile locks after supervised close", () => {
    let removals = 0;
    let waits = 0;
    worker.executeF6PdfWorker(request(), {
      runSupervisor: () => "success",
      removeProfile: () => { if (++removals <= 3) throw Object.assign(new Error("locked"), { code: "EPERM" }); },
      waitForCleanup: () => { waits += 1; },
    });
    expect(removals).toBe(4);
    expect(waits).toBe(3);
  });

  it("sanitizes and bounds exhausted profile cleanup failures", () => {
    let waits = 0;
    expect(() => worker.executeF6PdfWorker(request(), {
      runSupervisor: () => "success",
      removeProfile: () => { throw Object.assign(new Error("CONFIDENTIAL"), { code: "EPERM" }); },
      waitForCleanup: () => { waits += 1; },
    })).toThrow(expect.objectContaining({ code: "cleanup_failed", message: "F6 PDF browser cleanup failed." }));
    expect(waits).toBe(20);
  });
});
