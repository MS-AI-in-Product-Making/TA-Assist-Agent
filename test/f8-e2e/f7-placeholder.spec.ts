import { test, expect } from "./workbench-fixture.js";

test("shows F7 as unavailable without measured engineering controls or values", async ({ page, workbench }) => {
  await page.goto(`${workbench.origin}/?session=${workbench.sessionId}`);
  await expect(page.getByRole("heading", { name: "F7 正在开发" })).toBeVisible();
  await expect(page.getByText("feature_not_available / in_development")).toBeVisible();
  await expect(page.getByText(/Measured Cpk/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /导入.*F7|Measured/ })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
});
