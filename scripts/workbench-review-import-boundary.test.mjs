import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { build } from "vite";
import { describe, expect, it } from "vitest";

describe("workbench browser import boundary", () => {
  it("bundles review helpers without node builtin externalization", async () => {
    const tempDir = await mkdtemp(join(process.cwd(), ".tmp-workbench-review-boundary-"));
    const entry = join(tempDir, "entry.ts");
    await writeFile(entry, [
      "import { projectWorksheetReview, selectCompleteReviewContext } from '@ai-assist/workbench/review';",
      "export { projectWorksheetReview, selectCompleteReviewContext };",
      "",
    ].join("\n"));

    try {
      const output = await build({
        configFile: false,
        logLevel: "silent",
        build: {
          write: false,
          rollupOptions: {
            input: entry,
          },
        },
      });

      const rollupOutput = Array.isArray(output) ? output.flatMap((item) => item.output) : output.output;
      const bundled = rollupOutput.map((chunk) => "code" in chunk ? chunk.code : "").join("\n");
      expect(bundled).not.toContain("node:");
      expect(bundled).not.toContain("__vite-browser-external");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});