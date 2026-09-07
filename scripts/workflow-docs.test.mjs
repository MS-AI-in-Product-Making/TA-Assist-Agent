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

  it("documents the approved F3 factor-row counting protocol", () => {
    for (const relativePath of ["docs/02-end-to-end-flow.md", "docs/governance/feature-register.md"]) {
      const markdown = readFileSync(path.join(root, relativePath), "utf8");
      expect(markdown).toContain("one 12-header payload");
      expect(markdown).toContain("data-f3-factor-row=true");
      expect(markdown).toContain("data-f3-group-row=true");
      expect(markdown).toContain("canonical HTML");
      expect(markdown).toMatch(/SHA-256|body\/hash/);
      expect(markdown).toContain("top: 200");
      expect(markdown).toContain("one write");
      expect(markdown).toContain("readback");
      expect(markdown).not.toContain("expected factor row count");
    }
  });
});
