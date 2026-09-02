import { test, expect } from "./workbench-fixture.js";

test("shows F7 as unavailable without measured engineering controls or values", async ({ page, workbench }) => {
  await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);
  const progress = page.getByRole("region", { name: "Analysis progress" });
  await expect(progress).toContainText("Evaluate improvement options and publish report");
  await expect(progress).not.toContainText(/\bF7\b/);
  await expect(page.getByText(/Measured Cpk/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Import.*F7|Measured/i })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
});
