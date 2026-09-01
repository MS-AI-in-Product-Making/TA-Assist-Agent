import { test, expect } from "./workbench-fixture.js";

test("shows F7 as unavailable without measured engineering controls or values", async ({ page, workbench }) => {
  await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);
  const progress = page.getByRole("region", { name: "Analysis progress" });
  const f7 = progress.locator("li").filter({ hasText: "F7" });
  await expect(f7).toContainText("Apply Feedback");
  await expect(f7).toContainText("In development");
  await expect(page.getByText(/Measured Cpk/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Import.*F7|Measured/i })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
});
