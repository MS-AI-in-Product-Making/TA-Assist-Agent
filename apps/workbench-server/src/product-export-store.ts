import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ProductExportStoreRecord {
  readonly contractVersion: "ta-product-export-store-record-v1";
  readonly productRunReference: string;
  readonly status: "completed" | "failed";
  readonly idempotencyKey: string;
  readonly sessionId: string;
  readonly expectedRevision: number;
  readonly sourceBinding?: {
    readonly sourceRunReference: string;
    readonly workbookContentHash: string;
    readonly worksheetScope: readonly string[];
    readonly artifactHashes: Readonly<Record<string, string>>;
  };
  readonly sourceReportSha256?: string;
  readonly projectionSchemaVersion?: string;
  readonly semanticDigest?: string;
  readonly exportRoot?: string;
  readonly exportManifestSha256?: string;
  readonly failureCode?: string;
  readonly failureSummary?: string;
  readonly updatedAt: string;
}

export interface ProductExportStore {
  readonly root: string;
  exportRootFor(productRunReference: string): string;
  recordPathFor(productRunReference: string): string;
  readRecord(productRunReference: string): Promise<ProductExportStoreRecord | undefined>;
  writeRecord(record: ProductExportStoreRecord): Promise<void>;
}

export async function createProductExportStore(rootDir: string): Promise<ProductExportStore> {
  const root = path.join(rootDir, "runtime", "workbench", "product-exports");
  const recordsRoot = path.join(rootDir, "runtime", "workbench", "product-export-store");
  await mkdir(root, { recursive: true });
  await mkdir(recordsRoot, { recursive: true });

  function recordPathFor(productRunReference: string): string {
    return path.join(recordsRoot, `${productRunReference}.json`);
  }

  return {
    root,
    exportRootFor(productRunReference: string) {
      return path.join(root, productRunReference);
    },
    recordPathFor,
    async readRecord(productRunReference: string) {
      try {
        const recordPath = recordPathFor(productRunReference);
        return JSON.parse(await readFile(recordPath, "utf8")) as ProductExportStoreRecord;
      } catch {
        return undefined;
      }
    },
    async writeRecord(record: ProductExportStoreRecord) {
      const target = recordPathFor(record.productRunReference);
      const temporary = `${target}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
        await rename(temporary, target);
      } finally {
        await rm(temporary, { force: true });
      }
    },
  };
}
