import { spawn } from "node:child_process";
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";

import { f6PdfBrowserArgs, type F6PdfWorkerRequest } from "./f6-pdf-export.js";

async function closeBrowser(browser: Browser | undefined, context: BrowserContext | undefined, page: Page | undefined, exit: Promise<void>): Promise<void> {
  try {
    try {
      try { await page?.close(); } finally { await context?.close(); }
    } finally {
      if (browser !== undefined) {
        try {
          const session = await browser.newBrowserCDPSession();
          await session.send("Browser.close");
        } finally { await browser.close(); }
        await exit;
      }
    }
  } catch {
    throw Object.assign(new Error("Browser close failed."), { code: "cleanup_failed" });
  }
}

async function render(request: F6PdfWorkerRequest): Promise<void> {
  mkdirSync(request.profilePath, { recursive: true });
  const child = spawn(request.browser, f6PdfBrowserArgs(request), {
    windowsHide: true, stdio: "ignore",
  });
  const exit = new Promise<void>((resolve, reject) => {
    child.once("error", () => reject(new Error("Browser launch failed.")));
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error("Browser exited.")));
  });
  void exit.catch(() => {});
  if (request.strategy === "cli") {
    await exit;
    return;
  }

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  try {
    let port: number | undefined;
    while (port === undefined) {
      try {
        const value = Number(readFileSync(join(request.profilePath, "DevToolsActivePort"), "utf8").split("\n")[0]);
        if (Number.isInteger(value) && value > 0 && value <= 65535) port = value;
      } catch {
        // Chromium publishes this file when its local debugging endpoint is ready.
      }
      if (port === undefined) {
        await Promise.race([
          delay(25),
          exit.then(() => { throw new Error("Browser exited before rendering."); }),
        ]);
      }
    }
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: request.timeoutMs });
    context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
    const sourceUrl = pathToFileURL(request.htmlPath).href;
    await context.route("**/*", (route) => {
      const url = route.request().url();
      return url === sourceUrl || url.startsWith("data:") ? route.continue() : route.abort();
    });
    page = await context.newPage();
    await page.goto(sourceUrl, { waitUntil: "load", timeout: request.timeoutMs });
    await page.pdf({ path: request.pdfPath, preferCSSPageSize: true, printBackground: true });
  } finally {
    await closeBrowser(browser, context, page, exit);
  }
}

try {
  const request = JSON.parse(readFileSync(0, "utf8")) as F6PdfWorkerRequest;
  await render(request);
  const descriptor = openSync(request.pdfPath, "r+");
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
  process.exit(0);
} catch (error) {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  // Stay live until our owner terminates the tree, even if launch/close failed.
  process.send?.(code === "cleanup_failed" ? "cleanup_failed" : "execution_failed");
  setInterval(() => {}, 1_000);
}
