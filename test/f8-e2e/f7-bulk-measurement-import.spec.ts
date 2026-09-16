import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Download, type Page } from "@playwright/test";

import {
  createCompletedMeasurementWorkbook,
  createAnonymousSevenFactorWorkbook,
  F7_ANONYMOUS_SOURCE_WORKBOOK,
  F7_BULK_IMPORT_OUTPUT_DIRECTORY,
} from "./fixtures/f7-bulk-measurement-import.ts";

const WEB_ORIGIN = "http://127.0.0.1:5177";

test.beforeAll(async () => {
  await createAnonymousSevenFactorWorkbook();
  await mkdir(F7_BULK_IMPORT_OUTPUT_DIRECTORY, { recursive: true });
});

test("imports seven measured Factors, blocks negative data, and explicitly confirms overwrite", async ({ page }) => {
  await page.goto(WEB_ORIGIN);
  await page.locator("#workbook-file").setInputFiles(F7_ANONYMOUS_SOURCE_WORKBOOK);

  await expect(page.getByRole("region", { name: "Worksheet confirmation" })).toBeVisible();
  await page.getByRole("radio", { name: /Anonymous_TA/ }).check();
  await page.getByRole("button", { name: "Confirm selection" }).click();

  await expect(page.getByRole("tab", { name: "Import Data" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#factor-setup-table tbody tr")).toHaveCount(7);

  const initialTemplate = await downloadTemplate(page, "initial-template.xlsx");
  const initialCompleted = await createCompletedMeasurementWorkbook(initialTemplate, "initial-completed.xlsx");
  await uploadMeasurementWorkbook(page, initialCompleted);

  await expect(page.locator("[data-measurement-import-review] .measurement-import-factor-row")).toHaveCount(7);
  const crossZeroWarning = page.locator("[data-import-warning='cross-zero']").first();
  await expect(crossZeroWarning).toBeVisible();
  await expect(crossZeroWarning).toContainText("LSL 0");
  await expect(crossZeroWarning).toHaveCSS("color", "rgb(181, 57, 47)");
  await expect(page.locator("[data-confirm-measurement-import]")).toBeEnabled();
  await page.locator("[data-confirm-measurement-import]").click();

  await expect(page.locator("[data-measurement-import-success]")).toContainText("Imported 7 measured datasets");
  await assertCanonicalMeasuredRows(page);

  await page.getByRole("tab", { name: "Enter Individually" }).click();
  await assertCanonicalMeasuredRows(page);
  await page.locator("[data-open-measurement]").first().click();
  await expect(page.getByRole("region", { name: "Factor measurement workspace" })).toBeVisible();
  await page.locator("[data-close-measurement]").click();

  await page.getByRole("tab", { name: "Import Data" }).click();
  const overwriteTemplate = await downloadTemplate(page, "overwrite-template.xlsx");
  const negativeCompleted = await createCompletedMeasurementWorkbook(
    overwriteTemplate,
    "negative-completed.xlsx",
    { negativeCell: "B15", baseValue: 2 },
  );
  const overwriteCompleted = await createCompletedMeasurementWorkbook(
    overwriteTemplate,
    "overwrite-completed.xlsx",
    { baseValue: 2 },
  );

  await uploadMeasurementWorkbook(page, negativeCompleted);
  await expect(page.locator("[data-confirm-measurement-import]")).toBeDisabled();
  await expect(page.locator("[data-import-diagnostic='blocking']").first()).toContainText("Measurements!B15");

  await page.getByRole("tab", { name: "Enter Individually" }).click();
  const committedRows = page.locator("#factor-setup-table tbody tr");
  for (let factorIndex = 0; factorIndex < 7; factorIndex += 1) {
    await committedRows.nth(factorIndex).getByRole("button", { name: "Open workspace" }).click();
    await expect(page.locator("[data-measurement-row='14']")).toHaveValue(String(1 + factorIndex * 0.1));
    await page.locator("[data-close-measurement]").click();
  }

  await page.getByRole("tab", { name: "Import Data" }).click();
  await uploadMeasurementWorkbook(page, overwriteCompleted);
  const confirmOverwrite = page.locator("[data-confirm-measurement-import]");
  await expect(confirmOverwrite).toContainText("Confirm import");
  await expect(confirmOverwrite).toContainText("7 replacements");
  await expect(confirmOverwrite).toBeEnabled();

  await page.screenshot({
    path: resolve(F7_BULK_IMPORT_OUTPUT_DIRECTORY, "bulk-import-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(confirmOverwrite).toBeVisible();
  await page.screenshot({
    path: resolve(F7_BULK_IMPORT_OUTPUT_DIRECTORY, "bulk-import-mobile.png"),
    fullPage: true,
  });

  await confirmOverwrite.click();
  await expect(page.locator("[data-measurement-import-success]")).toContainText("7 replacements");
  await assertCanonicalMeasuredRows(page);
});

async function downloadTemplate(page: Page, fileName: string): Promise<string> {
  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-download-measurement-template]").click();
  const download = await downloadPromise;
  return saveDownload(download, fileName);
}

async function saveDownload(download: Download, fileName: string): Promise<string> {
  const outputPath = resolve(F7_BULK_IMPORT_OUTPUT_DIRECTORY, fileName);
  await download.saveAs(outputPath);
  return outputPath;
}

async function uploadMeasurementWorkbook(page: Page, workbookPath: string): Promise<void> {
  await page.locator("[data-measurement-import-file]").setInputFiles(workbookPath);
  await expect(page.locator("[data-measurement-import-review]")).toBeVisible();
}

async function assertCanonicalMeasuredRows(page: Page): Promise<void> {
  const rows = page.locator("#factor-setup-table tbody tr");
  await expect(rows).toHaveCount(7);
  for (let index = 0; index < 7; index += 1) {
    const row = rows.nth(index);
    await expect(row.locator("[data-column-key='sourceMode']")).toContainText("MEASURED");
    await expect(row.locator("[data-column-key='readiness']")).toContainText("ready", { ignoreCase: true });
    await expect(row.getByRole("button", { name: "Open workspace" })).toBeEnabled();
  }
}