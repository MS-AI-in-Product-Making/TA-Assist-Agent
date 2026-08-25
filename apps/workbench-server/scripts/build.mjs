import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolvePackageRoot();
const webDistRoot = join(packageRoot, "..", "workbench-web", "dist");
const assetsRoot = join(packageRoot, "assets", "workbench");
const assetNames = ["workbench.js", "workbench.css"];

await rm(assetsRoot, { recursive: true, force: true });
await mkdir(assetsRoot, { recursive: true });
await Promise.all(assetNames.map((assetName) => cp(join(webDistRoot, assetName), join(assetsRoot, assetName), { force: false })));

function resolvePackageRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}