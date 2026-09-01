import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  commitProductExport,
  prepareProductExport,
  verifyExistingProductExport,
} from "./atomic-product-export.js";

describe("atomic product export", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "ta-product-export-"));
  });

  it("stages under managed root, commits atomically, and records all-file manifest", async () => {
    const prepared = await prepareProductExport({
      managedRoot: join(rootDir, "managed"),
      exportId: "ta-run-7m4k2p9q",
      files: [
        { relativePath: "TA-Engineering-Analysis-Report.md", content: "# report\n" },
        { relativePath: "TA-Improvement-Options.md", content: "# options\n" },
        { relativePath: "TA-Analysis-Run-Summary.json", content: "{\"status\":\"completed\"}\n" },
      ],
    });

    const committed = await commitProductExport(prepared);

    expect(committed.manifest.files.map((file) => file.relativePath)).toEqual([
      "TA-Engineering-Analysis-Report.md",
      "TA-Improvement-Options.md",
      "TA-Analysis-Run-Summary.json",
      "export-manifest.json",
    ]);
    expect(committed.manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
  });

  it("allows identical retry but fails closed on drift", async () => {
    const managedRoot = join(rootDir, "managed");
    const source = {
      managedRoot,
      exportId: "ta-run-7m4k2p9q",
      files: [
        { relativePath: "TA-Engineering-Analysis-Report.md", content: "# report\n" },
        { relativePath: "TA-Improvement-Options.md", content: "# options\n" },
        { relativePath: "TA-Analysis-Run-Summary.json", content: "{\"status\":\"completed\"}\n" },
      ],
    };

    const first = await commitProductExport(await prepareProductExport(source));
    const second = await verifyExistingProductExport(source);
    expect(second).toEqual(first);

    await writeFile(join(first.root, "TA-Engineering-Analysis-Report.md"), "# mutated\n", "utf8");

    await expect(verifyExistingProductExport(source)).rejects.toMatchObject({ code: "evidence_mismatch" });
  });

  it("rejects path escape, symlink ancestors, and extra unmanaged files", async () => {
    const managedRoot = join(rootDir, "managed");
    await mkdir(managedRoot, { recursive: true });

    await expect(prepareProductExport({
      managedRoot,
      exportId: "ta-run-7m4k2p9q",
      files: [{ relativePath: "../escape.md", content: "bad" }],
    })).rejects.toThrow();

    const committed = await commitProductExport(await prepareProductExport({
      managedRoot,
      exportId: "ta-run-7m4k2p9q",
      files: [
        { relativePath: "TA-Engineering-Analysis-Report.md", content: "# report\n" },
        { relativePath: "TA-Improvement-Options.md", content: "# options\n" },
        { relativePath: "TA-Analysis-Run-Summary.json", content: "{\"status\":\"completed\"}\n" },
      ],
    }));

    await writeFile(join(committed.root, "unexpected.tmp"), "oops\n", "utf8");

    await expect(verifyExistingProductExport({
      managedRoot,
      exportId: "ta-run-7m4k2p9q",
      files: [
        { relativePath: "TA-Engineering-Analysis-Report.md", content: "# report\n" },
        { relativePath: "TA-Improvement-Options.md", content: "# options\n" },
        { relativePath: "TA-Analysis-Run-Summary.json", content: "{\"status\":\"completed\"}\n" },
      ],
    })).rejects.toMatchObject({ code: "evidence_mismatch" });

    const manifest = JSON.parse(await readFile(join(committed.root, "export-manifest.json"), "utf8"));
    expect(Array.isArray(manifest.files)).toBe(true);

    await rm(rootDir, { recursive: true, force: true });
  });
});
