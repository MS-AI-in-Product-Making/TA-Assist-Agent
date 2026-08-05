import { afterEach, describe, expect, it } from "vitest";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { materializeF2Images } from "./f2-image-materializer.mjs";

const cleanup = [];

afterEach(() => {
  for (const target of cleanup.splice(0)) rmSync(target, { recursive: true, force: true });
});

function fixture({ imagePath = "sheets/book/images/factor.png", sourceBytes = Buffer.from([1, 2, 3]), expectedHash } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "f2-image-"));
  const outputRoot = path.join(root, "output");
  const artifactRoot = path.join(root, "artifact");
  cleanup.push(root);
  mkdirSync(path.dirname(path.join(artifactRoot, imagePath)), { recursive: true });
  writeFileSync(path.join(artifactRoot, imagePath), sourceBytes);
  const contentHash = expectedHash ?? createHash("sha256").update(sourceBytes).digest("hex");
  const imageTarget = { relativePath: `images/${contentHash}.png`, contentHash };
  return {
    artifactRoot,
    outputRoot,
    contentHash,
    input: {
      worksheets: [{ worksheetName: "Analysis-A", tolerancePathImage: { status: "available", imagePath, contentHash, mediaType: "image/png" } }],
    },
    report: {
      worksheets: [{ worksheetName: "Analysis-A", rows: [{ sourceRow: 2, imageTarget }, { sourceRow: 3, imageTarget }] }],
    },
  };
}

describe("materializeF2Images", () => {
  it("copies each verified content hash once", () => {
    const setup = fixture();

    const result = materializeF2Images(setup);

    expect(result.copied).toEqual([`images/${setup.contentHash}.png`]);
    expect(readFileSync(path.join(setup.outputRoot, "images", `${setup.contentHash}.png`))).toEqual(Buffer.from([1, 2, 3]));
  });

  it("rejects source bytes that do not match the declared hash", () => {
    const setup = fixture({ expectedHash: "a".repeat(64) });

    expect(() => materializeF2Images(setup)).toThrow(/hash/i);
  });

  it("rejects source paths outside the artifact root", () => {
    const root = mkdtempSync(path.join(tmpdir(), "f2-image-outside-"));
    cleanup.push(root);
    const bytes = Buffer.from([4, 5, 6]);
    const contentHash = createHash("sha256").update(bytes).digest("hex");
    writeFileSync(path.join(root, "outside.png"), bytes);
    const setup = fixture({ imagePath: "placeholder.png", sourceBytes: bytes, expectedHash: contentHash });
    setup.input.worksheets[0].tolerancePathImage.imagePath = "../outside.png";

    expect(() => materializeF2Images(setup)).toThrow(/outside|越界/i);
  });
});