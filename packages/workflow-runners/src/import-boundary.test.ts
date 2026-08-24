import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionSources(entryPath);
    if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) return [];
    return [entryPath];
  });
}

describe("workflow-runners package boundaries", () => {
  it("does not import from repository scripts in production source", () => {
    const sourceRoot = path.resolve(import.meta.dirname, ".");
    const offenders = productionSources(sourceRoot).filter((sourcePath) =>
      readFileSync(sourcePath, "utf8").includes("../../../scripts"));

    expect(offenders.map((sourcePath) => path.relative(sourceRoot, sourcePath))).toEqual([]);
  });
});