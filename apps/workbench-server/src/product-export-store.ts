import { mkdir } from "node:fs/promises";
import path from "node:path";

export interface ProductExportStore {
  readonly root: string;
  exportRootFor(productRunReference: string): string;
}

export async function createProductExportStore(rootDir: string): Promise<ProductExportStore> {
  const root = path.join(rootDir, "runtime", "workbench", "product-exports");
  await mkdir(root, { recursive: true });
  return {
    root,
    exportRootFor(productRunReference: string) {
      return path.join(root, productRunReference);
    },
  };
}
