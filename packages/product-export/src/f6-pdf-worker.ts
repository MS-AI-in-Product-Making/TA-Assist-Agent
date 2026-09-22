import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

import { f6PdfBrowserArgs, type F6PdfWorkerRequest } from "./f6-pdf-export.js";

async function render(request: F6PdfWorkerRequest): Promise<void> {
  mkdirSync(request.profilePath, { recursive: true });
  const child = spawn(request.browser, f6PdfBrowserArgs(request), {
    windowsHide: true, stdio: "ignore", detached: process.platform !== "win32",
  });
  if (child.pid !== undefined) writeFileSync(request.pidPath, String(child.pid));
  const exit = new Promise<void>((resolve, reject) => {
    child.once("error", () => reject(new Error("Browser launch failed.")));
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Browser exited.")));
  });
  if (request.strategy === "cli") {
    await exit;
    return;
  }

  await Promise.race([exit.then(() => { throw new Error("Browser exited before rendering."); }), (async () => {
    let port: number | undefined;
    while (port === undefined) {
      try {
        const value = Number(readFileSync(join(request.profilePath, "DevToolsActivePort"), "utf8").split("\n")[0]);
        if (Number.isInteger(value) && value > 0 && value <= 65535) port = value;
      } catch {
        // Chromium publishes this file when its local debugging endpoint is ready.
      }
      if (port === undefined) await delay(25);
    }
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: request.timeoutMs });
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
    const sourceUrl = pathToFileURL(request.htmlPath).href;
    await context.route("**/*", (route) => {
      const url = route.request().url();
      return url === sourceUrl || url.startsWith("data:") ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    await page.goto(sourceUrl, { waitUntil: "load", timeout: request.timeoutMs });
    await page.pdf({ path: request.pdfPath, preferCSSPageSize: true, printBackground: true });
  })()]);
  // Do not await potentially hung browser.close(): the supervisor kills the owned process tree.
}

try {
  const request = JSON.parse(readFileSync(0, "utf8")) as F6PdfWorkerRequest;
  await render(request);
  process.exit(0);
} catch {
  // Only the exit status crosses the worker boundary; never emit browser errors or report paths.
  process.exit(1);
}
