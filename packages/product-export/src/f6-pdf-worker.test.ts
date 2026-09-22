import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import treeKill from "tree-kill";

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
    send: vi.fn(),
  });
  return child as unknown as ChildProcess;
}

function completionFixture(value: ReturnType<typeof request>) {
  const fixture = join(roots.at(-1)!, "completion.mjs");
  writeFileSync(fixture, `
    import { writeFileSync } from "node:fs";
    import { createF6PdfWorkerHandshake } from ${JSON.stringify(new URL("./f6-pdf-worker-handshake.ts", import.meta.url).href)};
    const handshake = createF6PdfWorkerHandshake(async () => {});
    process.stdin.resume();
    process.on("message", (message) => {
      if (message === "FINISH_RENDER") {
        writeFileSync(${JSON.stringify(value.pdfPath)}, "%PDF-1.7\\ncomplete\\n");
        handshake.ready();
      }
    });
    process.send("STARTED");
  `);
  return fixture;
}

describe("F6 live worker containment", () => {
  it("does not launch a browser when its supervisor channel is already absent at startup", async () => {
    const value = request();
    const child = spawn(process.execPath, [
      "--import", "tsx", fileURLToPath(new URL("./f6-pdf-worker.ts", import.meta.url)),
    ], { stdio: ["pipe", "ignore", "ignore"] });
    const exit = once(child, "exit");
    child.stdin!.end(JSON.stringify(value));
    expect((await exit)[0]).toBe(1);
    expect(existsSync(value.profilePath)).toBe(false);
  });

  it("reports launch failure safely without waiting for the attempt timeout", () => {
    expect(() => worker.executeF6PdfWorker({ ...request(10_000), browser: "CONFIDENTIAL-missing-browser.exe" }))
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
    expect(await result).toBe("execution_failed");
    expect(kills).toBe(0);
  });

  it("never acknowledges late READY while asynchronous tree termination still owns the live worker", async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    let kills = 0;
    let live = true;
    let completeKill: (() => void) | undefined;
    const result = worker.superviseF6PdfWorker(request(), {
      spawnWorker: () => child,
      terminateTree: (_owned, done) => {
        kills += 1;
        completeKill = () => {
          expect(live).toBe(true);
          live = false;
          child.emit("exit", null, "SIGKILL");
          done();
          setTimeout(() => child.emit("close", null, "SIGKILL"), 20);
        };
      },
    });
    await vi.advanceTimersByTimeAsync(1_000);
    child.emit("message", "READY_SUCCESS");
    await vi.advanceTimersByTimeAsync(100);
    expect(child.send).not.toHaveBeenCalled();
    expect(live).toBe(true);
    let settled = false;
    void result.then(() => { settled = true; });
    completeKill!();
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(20);
    expect(await result).toBe("timed_out");
    expect(kills).toBe(1);
  });

  it("validates READY before ACK and never kills after READY wins the deadline", async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    const value = request();
    writeFileSync(value.pdfPath, "%PDF-1.7\nvalid\n");
    const terminateTree = vi.fn();
    const result = worker.superviseF6PdfWorker(value, { spawnWorker: () => child, terminateTree });
    child.emit("message", "READY_SUCCESS");
    expect(child.send).toHaveBeenCalledWith("ACK_COMMIT", expect.any(Function));
    await vi.advanceTimersByTimeAsync(1_100);
    expect(terminateTree).not.toHaveBeenCalled();
    child.emit("exit", 0);
    child.emit("close", 0);
    expect(await result).toBe("success");
  });

  it.each(["missing", "invalid"])("aborts %s PDF while READY worker remains owned", async (kind) => {
    const child = fakeChild();
    const value = request();
    if (kind === "invalid") writeFileSync(value.pdfPath, "not a PDF");
    const terminateTree = vi.fn();
    const result = worker.superviseF6PdfWorker(value, { spawnWorker: () => child, terminateTree });
    child.emit("message", "READY_SUCCESS");
    expect(child.send).toHaveBeenCalledWith("ABORT", expect.any(Function));
    expect(child.send).not.toHaveBeenCalledWith("ACK_COMMIT", expect.any(Function));
    child.emit("close", 1);
    expect(await result).toBe("invalid_pdf");
    expect(terminateTree).not.toHaveBeenCalled();
  });

  it("holds a real READY worker PID across delayed Windows tree targeting and kill completion", async () => {
    const value = request(1_500);
    const fixture = completionFixture(value);
    const observations: string[] = [];
    let owned!: ChildProcess;
    const result = await worker.superviseF6PdfWorker(value, {
      spawnWorker: (executable, _args, options) => {
        owned = spawn(executable, ["--import", "tsx", fixture], options);
        owned.on("message", (message) => {
          if (message === "READY_SUCCESS") observations.push("ready");
        });
        return owned;
      },
      terminateTree: (child, done) => {
        observations.push("terminating");
        child.send("FINISH_RENDER");
        const onReady = (message: unknown) => {
          if (message !== "READY_SUCCESS") return;
          child.off("message", onReady);
          // Model taskkill starting asynchronously AFTER the render completes.
          setTimeout(() => {
            try {
              process.kill(child.pid!, 0);
              observations.push("still-owned");
            } catch { observations.push("premature-exit"); }
            treeKill(child.pid!, "SIGKILL", (error) => {
              setTimeout(() => {
                observations.push("kill-callback");
                done(error);
              }, 50);
            });
          }, 75);
        };
        child.on("message", onReady);
      },
    });
    expect(result).toBe("timed_out");
    expect(observations).toEqual(["terminating", "ready", "still-owned", "kill-callback"]);
    expect(owned.exitCode !== null || owned.signalCode !== null).toBe(true);
    expect(() => process.kill(owned.pid!, 0)).toThrow();
  }, 10_000);

  it("commits a real READY-first worker without any delayed tree kill", async () => {
    const value = request(3_000);
    const fixture = completionFixture(value);
    const terminateTree = vi.fn();
    const result = await worker.superviseF6PdfWorker(value, {
      spawnWorker: (executable, _args, options) => {
        const child = spawn(executable, ["--import", "tsx", fixture], options);
        child.on("message", (message) => { if (message === "STARTED") child.send("FINISH_RENDER"); });
        return child;
      },
      terminateTree,
    });
    expect(result).toBe("success");
    expect(terminateTree).not.toHaveBeenCalled();
  }, 10_000);

  it("releases a real waiting worker on supervisor disconnect without ACK", async () => {
    const value = request();
    const fixture = completionFixture(value);
    const child = spawn(process.execPath, ["--import", "tsx", fixture], { stdio: ["pipe", "ignore", "ignore", "ipc"] });
    child.stdin!.end();
    const exit = once(child, "exit");
    await once(child, "message");
    child.send("FINISH_RENDER");
    expect((await once(child, "message"))[0]).toBe("READY_SUCCESS");
    expect(() => process.kill(child.pid!, 0)).not.toThrow();
    child.disconnect();
    expect((await exit)[0]).toBe(1);
    expect(() => process.kill(child.pid!, 0)).toThrow();
  }, 10_000);

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

  it("cancels an outstanding tree killer before cleanup failure can disconnect the owned worker", async () => {
    vi.useFakeTimers();
    const child = fakeChild();
    let completeCancellation!: () => void;
    let cancelled = false;
    let settled = false;
    const result = worker.superviseF6PdfWorker(request(), {
      spawnWorker: () => child,
      terminateTree: () => () => new Promise<void>((resolve) => {
        cancelled = true;
        completeCancellation = resolve;
      }),
    });
    void result.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(6_000);
    child.emit("message", "READY_SUCCESS");
    expect(cancelled).toBe(true);
    expect(settled).toBe(false);
    expect(child.send).not.toHaveBeenCalled();
    completeCancellation();
    await expect(result).resolves.toBe("cleanup_failed");
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
