import { mkdir, readFile } from "node:fs/promises";
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

  await expect(page.getByRole("tab", { name: "Excel Bulk Import" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#factor-setup-table tbody tr")).toHaveCount(7);

  const initialTemplate = await downloadTemplate(page, "initial-template.xlsx");
  const initialCompleted = await createCompletedMeasurementWorkbook(initialTemplate, "initial-completed.xlsx");
  await uploadMeasurementWorkbook(page, initialCompleted);

  await expect(page.locator("[data-measurement-import-review] .measurement-import-factor-row")).toHaveCount(7);
  await expect(page.locator("[data-import-warning='cross-zero']")).toHaveCount(0);
  await expect(page.locator("[data-confirm-measurement-import]")).toBeEnabled();
  await page.locator("[data-confirm-measurement-import]").click();

  await expect(page.locator("[data-measurement-import-dialog]")).toHaveCount(0);
  await assertCanonicalMeasuredRows(page);

  await page.getByRole("tab", { name: "Individual Factor Entry" }).click();
  await assertCanonicalMeasuredRows(page);
  await page.locator("[data-open-measurement]").first().click();
  await expect(page.getByRole("region", { name: "Factor measurement workspace" })).toBeVisible();
  await page.locator("[data-close-measurement]").click();

  await page.getByRole("tab", { name: "Excel Bulk Import" }).click();
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
  await page.locator("[data-close-measurement-import]").click();

  await page.getByRole("tab", { name: "Individual Factor Entry" }).click();
  const committedFactors = page.locator("[data-open-measurement]");
  for (let factorIndex = 0; factorIndex < 7; factorIndex += 1) {
    await committedFactors.nth(factorIndex).click();
    await expect(page.locator("[data-measurement-row='1']")).toHaveValue(String(1 + factorIndex * 0.1));
    await page.locator("[data-close-measurement]").click();
  }

  await page.getByRole("tab", { name: "Excel Bulk Import" }).click();
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
  await expect(page.locator("[data-measurement-import-dialog]")).toHaveCount(0);
  await assertCanonicalMeasuredRows(page);
});

test("renders governed V3 priority guidance and exports it to PDF", async ({ page }) => {
  await page.goto(WEB_ORIGIN);
  await page.locator("#workbook-file").setInputFiles(F7_ANONYMOUS_SOURCE_WORKBOOK);
  await page.getByRole("radio", { name: /Anonymous_TA/ }).check();
  await page.getByRole("button", { name: "Confirm selection" }).click();
  await expect(page.locator("#factor-setup-table tbody tr")).toHaveCount(7);

  const seededCategories = await seedPriorityCategories(page);
  expect(seededCategories).toEqual(["battery-cts", "cover-fit-and-function"]);

  const guidance = page.locator("[data-process-guidance]");
  await expect(guidance).toBeVisible();
  await expect(guidance.locator("[data-process-guidance-version]")).toHaveText("V3");
  await expect(guidance.locator("[data-process-priority-recommendation]")).toContainText("Recommended priority P0");
  await expect(guidance.locator("[data-process-priority-alignment]")).toContainText("Microsoft ME/DM alignment");
  await expect(guidance.locator("[data-process-priority-definition]")).toHaveCount(4);
  await expect(guidance.locator("[data-process-priority-definition]").nth(0)).toHaveAttribute("data-priority", "P0");
  await expect(guidance.locator("[data-process-priority-definition]").nth(3)).toHaveAttribute("data-priority", "P3");

  await page.screenshot({
    path: resolve(F7_BULK_IMPORT_OUTPUT_DIRECTORY, "v3-priority-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(guidance).toBeVisible();
  expect(await guidance.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({
    path: resolve(F7_BULK_IMPORT_OUTPUT_DIRECTORY, "v3-priority-mobile.png"),
    fullPage: true,
  });

  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-generate-assumption-results-pdf]").click();
  const pdfPath = await saveDownload(await downloadPromise, "v3-priority-guidance.pdf");
  const pdfBytes = await readFile(pdfPath);
  expect(pdfBytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(pdfBytes.byteLength).toBeGreaterThan(10_000);
  const pageMarkers = pdfBytes.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? [];
  expect(pageMarkers.length).toBeGreaterThanOrEqual(4);
  expect(pageMarkers.length).toBeLessThanOrEqual(8);
});

async function seedPriorityCategories(page: Page): Promise<string[]> {
  return await page.evaluate(async () => {
    const root = document.querySelector("#app") as { __vue_app__?: { _instance?: { setupState?: Record<string, unknown> } } } | null;
    const setupState = root?.__vue_app__?._instance?.setupState as {
      store?: {
        session: { value: {
          sessionId: string;
          systemSpecification: {
            lowerSpecLimit: { actualValue: number };
            upperSpecLimit: { actualValue: number };
            targetSigmaLevel: { actualValue: number };
          };
          factors: Array<{
            setup: {
              factorCandidateId: string;
              designNominal: number;
              upperTolerance: number;
              lowerTolerance: number;
              longTermSafetyFactor: number;
              sigmaLevel: number;
              distribution: string;
              partNumber?: string | null;
              dimId?: string | null;
            };
          }>;
        } | null };
        refreshSession: () => Promise<void>;
      };
    } | undefined;
    const store = setupState?.store;
    const session = store?.session.value;
    if (!store || !session) throw new Error("F7 Vue session store is unavailable.");
    const response = await fetch("/f7/factors/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        confirmations: session.factors.map((factor, index) => ({
          factorCandidateId: factor.setup.factorCandidateId,
          designNominal: factor.setup.designNominal,
          upperTolerance: factor.setup.upperTolerance,
          lowerTolerance: factor.setup.lowerTolerance,
          longTermSafetyFactor: factor.setup.longTermSafetyFactor,
          sigmaLevel: factor.setup.sigmaLevel,
          distribution: factor.setup.distribution,
          partNumber: factor.setup.partNumber ?? null,
          dimId: factor.setup.dimId ?? null,
          ...(index === 0 ? { componentCategory: "battery-cts" } : {}),
          ...(index === 1 ? { componentCategory: "cover-fit-and-function" } : {}),
          confirmed: true,
        })),
        systemSpecification: {
          lowerSpecLimit: session.systemSpecification.lowerSpecLimit.actualValue,
          upperSpecLimit: session.systemSpecification.upperSpecLimit.actualValue,
          targetSigmaLevel: session.systemSpecification.targetSigmaLevel.actualValue,
        },
      }),
    });
    if (!response.ok) throw new Error(`F7 category seeding failed with status ${response.status}.`);
    const payload = await response.json() as {
      factors: Array<{ evidence?: { componentCategory?: string } }>;
    };
    await store.refreshSession();
    return payload.factors.slice(0, 2).map((factor) => factor.evidence?.componentCategory ?? "");
  });
}

async function downloadTemplate(page: Page, fileName: string): Promise<string> {
  await openMeasurementImportPanel(page);
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
  await openMeasurementImportPanel(page);
  await page.locator("[data-measurement-import-file]").setInputFiles(workbookPath);
  await expect(page.locator("[data-measurement-import-review]")).toBeVisible();
}

async function openMeasurementImportPanel(page: Page): Promise<void> {
  const surface = page.locator("[data-measurement-import-surface]");
  if (await surface.count() > 0 && await surface.isVisible()) return;
  const importTab = page.getByRole("tab", { name: "Excel Bulk Import" });
  await importTab.click();
  await expect(page.locator("[data-upload-measurement-workbook]")).toBeVisible();
}

async function assertCanonicalMeasuredRows(page: Page): Promise<void> {
  const measurementButtons = page.locator("[data-open-measurement]");
  await expect(measurementButtons).toHaveCount(7);
  for (let index = 0; index < 7; index += 1) {
    await expect(measurementButtons.nth(index)).toHaveAttribute("title", /Measured Data/i);
  }
}
