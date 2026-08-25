import { readFile, readdir } from "node:fs/promises";

import { test, expect, sha256File } from "./workbench-fixture.js";

test("renders governed F4 evidence and runs fixture-backed What-if without workbook writeback", async ({ page, workbench }) => {
  const hashes = JSON.parse(await readFile("test/f8-e2e/fixtures/fixture-hashes.json", "utf8")) as Record<string, string>;
  await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);
  await expect(page.getByRole("heading", { name: "Three-pane Worksheet Review" })).toBeVisible();
  await expect(page.getByText("review_required", { exact: true }).first()).toBeVisible();
  const snapshotResponse = await page.request.get(`${workbench.origin}/api/sessions/${workbench.sessionId}`);
  expect(snapshotResponse.status()).toBe(200);
  const snapshot = await snapshotResponse.json() as { artifactRefs?: Array<{ artifactId: string; kind: string }> };
  expect(snapshot.artifactRefs).toContainEqual(expect.objectContaining({ artifactId: "f4-e2e", kind: "f4_calculation" }));
  expect((await page.request.get(`${workbench.origin}/api/sessions/${workbench.sessionId}/artifacts/f4-e2e`)).status()).toBe(200);
  const originalHash = await sha256File(workbench.sourceWorkbook);

  await page.getByRole("button", { name: "打开公差试算" }).click();
  const upper = page.getByLabel("AJ center to C-bucket +Tol");
  await upper.fill("0.040");
  await upper.press("Enter");
  await expect(page.getByTestId("draft-cpk")).toHaveText("1.600");

  expect(await sha256File(workbench.sourceWorkbook)).toBe(originalHash);
  expect(originalHash).toBe(hashes["anonymous-ta-workbook.xlsx"]);
  const managedPaths = await readdir(workbench.rootDir, { recursive: true });
  expect(managedPaths.filter((path) => /\.xlsx$/i.test(path))).toEqual([]);
});
