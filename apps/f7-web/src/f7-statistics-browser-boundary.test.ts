import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const WEB_ADAPTERS = [
  "f7-capability.ts",
  "factor-measured-comparison.ts",
  "measurement-diagnostics.ts",
  "measurement-structure.ts",
  "measurement-workspace-warnings.ts",
] as const;

describe("F7 statistics browser boundary", () => {
  it("uses browser-safe subpath imports instead of the Node-inclusive package root", () => {
    for (const adapter of WEB_ADAPTERS) {
      const source = readFileSync(join(process.cwd(), "apps/f7-web/src", adapter), "utf8");

      expect(source).not.toContain('from "@ai-assist/f7-statistics"');
    }

    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "packages/f7-statistics/package.json"), "utf8"),
    ) as { readonly exports?: Readonly<Record<string, unknown>> };

    expect(Object.keys(packageJson.exports ?? {})).toEqual(
      expect.arrayContaining([
        "./capability",
        "./factor-measured-comparison",
        "./measurement-diagnostics",
        "./measurement-observation",
        "./measurement-structure",
        "./measurement-warnings",
      ]),
    );
  });
});