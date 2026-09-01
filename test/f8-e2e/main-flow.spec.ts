import { readFile, readdir } from "node:fs/promises";

import { test, expect, sha256File } from "./workbench-fixture.js";

test("renders governed F4 evidence and runs fixture-backed What-if without workbook writeback", async ({ page, workbench }) => {
  const hashes = JSON.parse(await readFile("test/f8-e2e/fixtures/fixture-hashes.json", "utf8")) as Record<string, string>;
  await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);
  await expect(page.getByRole("region", { name: "Analysis progress" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Live analysis panel" })).toBeVisible();
  const snapshotResponse = await page.request.get(`${workbench.origin}/api/sessions/${workbench.sessionId}`);
  expect(snapshotResponse.status()).toBe(200);
  const snapshot = await snapshotResponse.json() as { artifactRefs?: Array<{ artifactId: string; kind: string }> };
  const f4Artifact = snapshot.artifactRefs?.find(({ kind }) => kind === "f4_calculation");
  expect(f4Artifact).toBeDefined();
  expect((await page.request.get(`${workbench.origin}/api/sessions/${workbench.sessionId}/artifacts/${encodeURIComponent(f4Artifact!.artifactId)}`)).status()).toBe(200);
  const originalHash = await sha256File(workbench.sourceWorkbook);

  await page.getByRole("button", { name: "AJ center to C-bucket", description: "中心间隙" }).click();
  const upper = page.getByRole("spinbutton", { name: "AJ center to C-bucket upperTolerance" });
  await upper.fill("0.040");
  await upper.blur();
  await expect(page.getByRole("button", { name: "Save scenario" }).first()).toBeEnabled();
  await expect(page.getByText("Mean Response", { exact: true })).toBeVisible();

  expect(await sha256File(workbench.sourceWorkbook)).toBe(originalHash);
  expect(originalHash).toBe(hashes["anonymous-ta-workbook.xlsx"]);
  const managedPaths = await readdir(workbench.rootDir, { recursive: true });
  expect(managedPaths.filter((path) => /\.xlsx$/i.test(path))).toEqual([]);
});
