import { spawnSync, type SpawnSyncOptions, type SpawnSyncReturns } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { F6PdfWorkerRequest } from "./f6-pdf-export.js";

interface WorkerDependencies {
  readonly spawnWorker?: (executable: string, args: readonly string[], options: SpawnSyncOptions) => SpawnSyncReturns<Buffer>;
  readonly killBrowser?: (pid: number) => void;
  readonly removeProfile?: (path: string) => void;
  readonly waitForCleanup?: () => void;
}

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function killBrowserTree(pid: number): void {
  if (!isAlive(pid)) return;
  if (process.platform === "win32") {
    const result = spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true, timeout: 5_000, killSignal: "SIGKILL", stdio: "ignore",
    });
    if (result.status !== 0 && isAlive(pid)) throw new Error("Browser cleanup failed.");
  } else {
    process.kill(-pid, "SIGKILL");
  }
}

function removeBrowserProfile(profilePath: string, dependencies: WorkerDependencies): void {
  const remove = dependencies.removeProfile ?? ((path: string) => rmSync(path, { recursive: true, force: true }));
  const wait = dependencies.waitForCleanup ?? (() => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250));
  for (let retry = 0; retry <= 20; retry += 1) {
    try { remove(profilePath); return; } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
      if (retry >= 20 || !["EPERM", "EBUSY", "ENOTEMPTY", "EACCES"].includes(String(code))) throw error;
      // Windows can retain profile handles briefly after taskkill has returned successfully.
      wait();
    }
  }
}

function cleanupBrowser(request: F6PdfWorkerRequest, dependencies: WorkerDependencies): void {
  try {
    if (existsSync(request.pidPath)) {
      const pid = Number(readFileSync(request.pidPath, "utf8"));
      if (!Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid) throw new Error("Invalid browser PID.");
      (dependencies.killBrowser ?? killBrowserTree)(pid);
      rmSync(request.pidPath, { force: true });
    }
    removeBrowserProfile(request.profilePath, dependencies);
  } catch {
    throw Object.assign(new Error("F6 PDF browser cleanup failed."), { code: "cleanup_failed" });
  }
}

export function executeF6PdfWorker(request: F6PdfWorkerRequest, dependencies: WorkerDependencies = {}): void {
  const compiledWorker = new URL("./f6-pdf-worker.js", import.meta.url);
  const args = existsSync(compiledWorker)
    ? [fileURLToPath(compiledWorker)]
    : ["--import", "tsx", fileURLToPath(new URL("./f6-pdf-worker.ts", import.meta.url))];
  try {
    const result = (dependencies.spawnWorker ?? spawnSync)(process.execPath, args, {
      input: JSON.stringify(request),
      windowsHide: true,
      timeout: request.timeoutMs,
      killSignal: "SIGKILL",
      stdio: "pipe",
      maxBuffer: 1_024,
      env: { ...process.env, DEBUG: "", PWDEBUG: "0", NODE_OPTIONS: "" },
    });
    if (result.error !== undefined && "code" in result.error && result.error.code === "ETIMEDOUT") {
      throw Object.assign(new Error("F6 PDF worker timed out."), { code: "ETIMEDOUT" });
    }
    if (result.error !== undefined || result.status !== 0) throw new Error("F6 PDF worker failed.");
  } finally {
    // The supervisor owns cleanup even when the worker is forcibly killed while CDP is hung.
    cleanupBrowser(request, dependencies);
  }
}
