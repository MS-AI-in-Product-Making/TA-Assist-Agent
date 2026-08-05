import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

function resolveWithin(root, relativePath, label) {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} path is outside its root: ${relativePath}`);
  }
  return resolvedPath;
}

export function materializeF2Images({ artifactRoot, outputRoot, input, report }) {
  if (!input?.worksheets || !report?.worksheets) return { copied: [] };
  const sources = new Map(input.worksheets.flatMap((worksheet) => worksheet.tolerancePathImage?.status === "available"
    ? [[worksheet.worksheetName, worksheet.tolerancePathImage]]
    : []));
  const copiedHashes = new Set();
  const copied = [];

  for (const worksheet of report.worksheets) {
    const source = sources.get(worksheet.worksheetName);
    for (const row of worksheet.rows) {
      const target = row.imageTarget;
      if (!target || copiedHashes.has(target.contentHash)) continue;
      if (!source || source.contentHash !== target.contentHash) {
        throw new Error(`F2 image source hash does not match report target for ${worksheet.worksheetName}`);
      }
      const sourcePath = resolveWithin(artifactRoot, source.imagePath, "F1 image source");
      const targetPath = resolveWithin(outputRoot, target.relativePath, "F2 image target");
      const actualHash = createHash("sha256").update(readFileSync(sourcePath)).digest("hex");
      if (actualHash !== source.contentHash) {
        throw new Error(`F1 image source hash mismatch for ${source.imagePath}`);
      }
      mkdirSync(path.dirname(targetPath), { recursive: true });
      copyFileSync(sourcePath, targetPath);
      copiedHashes.add(target.contentHash);
      copied.push(target.relativePath);
    }
  }

  return { copied };
}