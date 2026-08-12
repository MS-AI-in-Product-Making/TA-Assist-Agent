import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("workbook workflow documentation", () => {
  for (const relativePath of ["README.md", "docs/README.md"]) {
    it(`${relativePath} uses the confirmed F1/F2 handshake`, () => {
      const markdown = readFileSync(path.join(root, relativePath), "utf8");
      expect(markdown).toContain("npm run workflow:f2:excel --");
      expect(markdown).toContain("--workbook-hash");
      expect(markdown).toContain("--worksheets");
      expect(markdown).toContain("--confirm");
      expect(markdown).not.toMatch(/npm run workflow:f1 -- [^\r\n]+[\s\S]{0,160}npm run workflow:f2 --/);
    });
  }
});