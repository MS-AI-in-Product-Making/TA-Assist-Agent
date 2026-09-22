import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import treeKill from "tree-kill";

import type { F6PdfWorkerRequest } from "./f6-pdf-export.js";

export type WorkerOutcome = "success" | "execution_failed" | "timed_out" | "cleanup_failed";
const CLEANUP_MS = 5_000;
const outcomes: readonly WorkerOutcome[] = ["success", "execution_failed", "timed_out", "cleanup_failed"];

interface SupervisorDependencies {
  readonly spawnWorker?: (executable: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
  readonly terminateTree?: (child: ChildProcess, done: (error?: Error) => void) => void;
}

interface WorkerDependencies {
  readonly runSupervisor?: (request: F6PdfWorkerRequest) => WorkerOutcome;
  readonly removeProfile?: (path: string) => void;
  readonly waitForCleanup?: () => void;
}

function entryArgs(name: string): string[] {
  const compiled = new URL(`./${name}.js`, import.meta.url);
  return existsSync(compiled) ? [fileURLToPath(compiled)] : ["--import", "tsx", fileURLToPath(new URL(`./${name}.ts`, import.meta.url))];
}

function terminateOwnedTree(child: ChildProcess, done: (error?: Error) => void): void {
  if (child.pid === undefined) { done(); return; }
  if (process.platform === "win32") {
    treeKill(child.pid, "SIGKILL", done);
  } else {
    // The supervisor starts the worker as group leader; browsers must not detach.
    try { process.kill(-child.pid, "SIGKILL"); done(); } catch (error) { done(error as Error); }
  }
}

export function superviseF6PdfWorker(request: F6PdfWorkerRequest, dependencies: SupervisorDependencies = {}): Promise<WorkerOutcome> {
  return new Promise((resolve) => {
    let child: ChildProcess;
    try {
      child = (dependencies.spawnWorker ?? spawn)(process.execPath, entryArgs("f6-pdf-worker"), {
        windowsHide: true, detached: process.platform !== "win32",
        stdio: ["pipe", "ignore", "ignore", "ipc"],
        env: { ...process.env, DEBUG: "", PWDEBUG: "0", NODE_OPTIONS: "" },
      });
    } catch { resolve("execution_failed"); return; }
    let exited = false;
    let closed = false;
    let settled = false;
    let stopping = false;
    let terminationDone = false;
    let outcome: WorkerOutcome = "execution_failed";
    let cleanup: ReturnType<typeof setTimeout> | undefined;
    const finish = (value: WorkerOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearTimeout(cleanup);
      resolve(value);
    };
    const boundCleanup = () => {
      cleanup ??= setTimeout(() => finish("cleanup_failed"), CLEANUP_MS);
    };
    const stop = (reason: WorkerOutcome) => {
      // This gate and termination initiation run in one event-loop turn. Never
      // schedule a PID-based termination after our owned child has exited.
      if (settled || exited || closed || stopping) return;
      stopping = true;
      outcome = reason;
      clearTimeout(deadline);
      boundCleanup();
      try {
        (dependencies.terminateTree ?? terminateOwnedTree)(child, (error) => {
          terminationDone = true;
          if (error != null) outcome = "cleanup_failed";
          if (closed) finish(outcome);
        });
      } catch {
        terminationDone = true;
        outcome = "cleanup_failed";
        if (closed) finish(outcome);
      }
    };
    child.once("exit", () => {
      exited = true;
      clearTimeout(deadline);
      boundCleanup();
    });
    child.once("close", (code) => {
      closed = true;
      exited = true;
      if (!stopping) finish(code === 0 ? "success" : "execution_failed");
      else if (terminationDone) finish(outcome);
    });
    child.once("error", () => {
      if (child.pid === undefined) { outcome = "execution_failed"; boundCleanup(); }
      else stop("execution_failed");
    });
    child.on("message", (message) => {
      if (message === "execution_failed" || message === "cleanup_failed") stop(message);
    });
    const deadline = setTimeout(() => stop("timed_out"), request.timeoutMs);
    child.stdin?.on?.("error", () => stop("execution_failed"));
    try { child.stdin?.end(JSON.stringify(request)); } catch { stop("execution_failed"); }
  });
}

function runSupervisor(request: F6PdfWorkerRequest): WorkerOutcome {
  // No outer abandonment timer: the live supervisor owns the attempt deadline
  // and a separate bounded close/termination deadline.
  const result = spawnSync(process.execPath, entryArgs("f6-pdf-supervisor"), {
    input: JSON.stringify(request), windowsHide: true, stdio: "pipe", maxBuffer: 1_024,
    env: { ...process.env, DEBUG: "", PWDEBUG: "0", NODE_OPTIONS: "" },
  });
  const outcome = result.stdout?.toString("utf8");
  return result.status === 0 && outcomes.includes(outcome as WorkerOutcome) ? outcome as WorkerOutcome : "execution_failed";
}

function removeBrowserProfile(profilePath: string, dependencies: WorkerDependencies): void {
  const remove = dependencies.removeProfile ?? ((path: string) => rmSync(path, { recursive: true, force: true }));
  const wait = dependencies.waitForCleanup ?? (() => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250));
  for (let retry = 0; retry <= 20; retry += 1) {
    try { remove(profilePath); return; } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
      if (retry >= 20 || !["EPERM", "EBUSY", "ENOTEMPTY", "EACCES"].includes(String(code))) throw error;
      wait();
    }
  }
}

function cleanupProfile(request: F6PdfWorkerRequest, dependencies: WorkerDependencies): void {
  try { removeBrowserProfile(request.profilePath, dependencies); } catch {
    throw Object.assign(new Error("F6 PDF browser cleanup failed."), { code: "cleanup_failed" });
  }
}

export function executeF6PdfWorker(request: F6PdfWorkerRequest, dependencies: WorkerDependencies = {}): void {
  try {
    const outcome = (dependencies.runSupervisor ?? runSupervisor)(request);
    if (outcome !== "success") {
      throw Object.assign(new Error(outcome === "cleanup_failed" ? "F6 PDF browser cleanup failed." : "F6 PDF worker failed."), {
        code: outcome === "timed_out" ? "ETIMEDOUT" : outcome,
      });
    }
  } finally {
    cleanupProfile(request, dependencies);
  }
}
