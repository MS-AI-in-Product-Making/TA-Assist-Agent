import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { renderF6PdfSync } from "./f6-pdf-export.js";
import { renderF6PdfHtml } from "./f6-pdf-report.js";

const MARKDOWN = "# Governed report\n";
const HASH = createHash("sha256").update(MARKDOWN).digest("hex");

describe("renderF6PdfSync", () => {
  it("renders validated Markdown as PDF bytes with the source hash embedded", () => {
    const executeFile = vi.fn((_browser: string, args: readonly string[]) => {
      const output = args.find((arg) => arg.startsWith("--print-to-pdf="))?.slice("--print-to-pdf=".length);
      const htmlUrl = args.at(-1);
      if (output === undefined || htmlUrl === undefined) throw new Error("missing browser arguments");
      const htmlPath = new URL(htmlUrl);
      expect(readFileSync(htmlPath, "utf8")).toContain(`data-source-sha256="${HASH}"`);
      writeFileSync(output, Buffer.from("%PDF-1.7\nvalidated\n"));
    });

    const pdf = renderF6PdfSync({
      markdown: MARKDOWN,
      sourceHash: HASH,
      reportPath: path.resolve("Feature6-Report.md"),
      managedRoot: process.cwd(),
    }, {
      installedBrowsers: () => ["controlled-browser.exe"],
      executeFile,
    });

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(executeFile).toHaveBeenCalledOnce();
  });

  it("fails closed when no browser produces a valid PDF", () => {
    expect(() => renderF6PdfSync({
      markdown: MARKDOWN,
      sourceHash: HASH,
      reportPath: path.resolve("Feature6-Report.md"),
      managedRoot: process.cwd(),
    }, {
      installedBrowsers: () => ["controlled-browser.exe"],
      executeFile: vi.fn(),
    })).toThrow(expect.objectContaining({ code: "pdf_render_unavailable" }));
  });

  it("does not render unresolved local image links", () => {
    expect(() => renderF6PdfHtml({
      markdown: "[Open image](../outside.png)",
      sourceHash: createHash("sha256").update("[Open image](../outside.png)").digest("hex"),
    })).toThrow("validated and inlined");
  });

  it("renders Markdown image tokens only from validated inline bytes", () => {
    const markdown = "![Tolerance stack](evidence/stack.png)";
    const html = renderF6PdfHtml({
      markdown,
      sourceHash: createHash("sha256").update(markdown).digest("hex"),
      inlineImages: new Map([["evidence/stack.png", "data:image/png;base64,iVBORw0KGgo="]]),
    });

    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(html).not.toContain('src="evidence/stack.png"');
  });
});