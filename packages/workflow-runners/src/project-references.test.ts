import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("workflow-runners project references", () => {
  it("references product-export before importing its compiled package entrypoint", () => {
    const currentDirectory = dirname(fileURLToPath(import.meta.url));
    const tsconfigPath = resolve(currentDirectory, "..", "tsconfig.json");
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8")) as {
      references?: Array<{ path?: string }>;
    };

    expect(tsconfig.references?.map(({ path }) => path)).toContain("../product-export");
  });
});
