import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { createAnonymousWorkbookZip } from "../../../packages/workbook-catalog/src/test-support.ts";

export const ANONYMOUS_WORKBOOK_RELATIVE_PATH = "test/e2e/fixtures/anonymous-ta-workbook.xlsx";

const EXPECTED_FIXTURE_BYTES = Buffer.from(createAnonymousWorkbookZip());
const EXPECTED_FIXTURE_SHA256 = createHash("sha256").update(EXPECTED_FIXTURE_BYTES).digest("hex");

export function expectedAnonymousWorkbookSha256(): string {
  return EXPECTED_FIXTURE_SHA256;
}

export async function ensureAnonymousWorkbookFixture(rootDir = process.cwd()): Promise<{ absolutePath: string; sha256: string; written: boolean }> {
  const absolutePath = resolve(rootDir, ANONYMOUS_WORKBOOK_RELATIVE_PATH);
  await mkdir(dirname(absolutePath), { recursive: true });

  const existing = await readFile(absolutePath).catch(() => undefined);
  if (existing !== undefined) {
    const existingSha256 = createHash("sha256").update(existing).digest("hex");
    if (existingSha256 === EXPECTED_FIXTURE_SHA256) {
      return { absolutePath, sha256: EXPECTED_FIXTURE_SHA256, written: false };
    }
  }

  await writeFile(absolutePath, EXPECTED_FIXTURE_BYTES);
  const writtenBytes = await readFile(absolutePath);
  const writtenSha256 = createHash("sha256").update(writtenBytes).digest("hex");
  if (writtenSha256 !== EXPECTED_FIXTURE_SHA256) {
    throw new Error(`Failed to persist deterministic anonymous workbook fixture at ${absolutePath}`);
  }

  return { absolutePath, sha256: EXPECTED_FIXTURE_SHA256, written: true };
}
