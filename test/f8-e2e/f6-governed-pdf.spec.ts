import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const REQUEST_CONTEXT = {
  requestedAt: "2026-09-16T08:30:12.000Z",
  utcOffsetMinutes: -420,
  source: "web",
} as const;

const INTERACTION_LANGUAGE = {
  languageTag: "en-US",
  uiCatalogLanguage: "en",
  lockedAtTurnId: "task-10-e2e",
  source: "workflow_start",
  fallbackUsed: false,
} as const;

const LINKED_ADO = {
  status: "updated",
  operation: "updated",
  organization: "contoso",
  project: "Devices",
  workItemId: 1119604,
} as const;

const SCREENSHOT_ROOT = path.resolve("test-results", "f6-governed-pdf");

type AdoTraceability = typeof LINKED_ADO | { readonly status: "not_requested" };

interface GovernedF6Run {
  readonly root: string;
  readonly publishRoot: string;
  readonly outputDirectory: string;
  readonly pdfPath: string;
  readonly htmlPath: string;
  readonly worksheetNames: readonly string[];
  readonly verifiedOutputDirectory: string;
}

async function inspectPdf(pdfPath: string): Promise<{
  readonly pageTexts: readonly string[];
  readonly annotationUrls: readonly string[];
}> {
  const loadingTask = getDocument({ data: new Uint8Array(readFileSync(pdfPath)) });
  const pdf = await loadingTask.promise;
  try {
    const pageTexts: string[] = [];
    const annotationUrls: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const pdfPage = await pdf.getPage(pageNumber);
      const viewport = pdfPage.getViewport({ scale: 1 });
      const textContent = await pdfPage.getTextContent();
      const textItems = textContent.items.filter((item): item is typeof item & { str: string; width: number; transform: number[] } => "str" in item);
      for (const item of textItems) {
        const left = item.transform[4];
        const baseline = item.transform[5];
        expect(left).toBeGreaterThanOrEqual(-1);
        expect(left + item.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(baseline).toBeGreaterThanOrEqual(-1);
        expect(baseline).toBeLessThanOrEqual(viewport.height + 1);
      }
      pageTexts.push(textItems.map((item) => item.str).join(" "));
      const annotations = await pdfPage.getAnnotations({ intent: "display" });
      for (const annotation of annotations) {
        if (typeof annotation.url === "string") annotationUrls.push(annotation.url);
      }
    }
    return { pageTexts, annotationUrls };
  } finally {
    await loadingTask.destroy();
  }
}

function createGovernedF6FixtureRun(testInfo: TestInfo, ado: AdoTraceability): GovernedF6Run {
  const worksheetNames = ["Ready-Gap", "Blocked-Step"] as const;
  const runId = `task-10-${ado.status}-${randomUUID()}`;
  const htmlPath = testInfo.outputPath(`f6-${ado.status}-${runId}.html`);
  const repositoryRoot = process.cwd();
  const moduleUrl = (relativePath: string): string => pathToFileURL(path.join(repositoryRoot, relativePath)).href;
  const generationCode = `
import { createHash } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createF6ArtifactBundleFixture, installRequiredMultimodalV3 } from ${JSON.stringify(moduleUrl("scripts/f6-artifact-test-fixture.mjs"))};
import { loadF6ArtifactBundle } from ${JSON.stringify(moduleUrl("scripts/f6-artifact-loader.mjs"))};
import { runF6FullValidation } from ${JSON.stringify(moduleUrl("scripts/run-f6-full-validation.mjs"))};
import { validateExistingF6Artifact } from ${JSON.stringify(moduleUrl("scripts/verify-current-f6.mjs"))};
import { renderF6PdfHtml } from ${JSON.stringify(moduleUrl("packages/product-export/dist/f6-pdf-report.js"))};
import { validatedF6InlineImages } from ${JSON.stringify(moduleUrl("packages/product-export/dist/f6-pdf-export.js"))};

const [runId, htmlPath, adoJson, worksheetNamesJson, requestContextJson, languageJson] = process.argv.slice(1);
const worksheetNames = JSON.parse(worksheetNamesJson);
const bundle = createF6ArtifactBundleFixture({
  worksheetNames: [worksheetNames[0]],
  blockedWorksheetNames: [worksheetNames[1]],
  actualFieldOverrides: { dimCharacteristicId: "1" },
});
installRequiredMultimodalV3(bundle);
const ado = JSON.parse(adoJson);
const outputDirectory = path.join(bundle.publishRoot, "f6-runs", runId);
const result = runF6FullValidation({}, {
  parseArgs: () => ({
    ...bundle,
    selectedWorksheetNames: bundle.selectedWorksheetNames,
    interactionLanguage: JSON.parse(languageJson),
    analysisRequestContext: JSON.parse(requestContextJson),
    modelInterpretationArtifact: path.join(bundle.modelInterpretationArtifactRoot, bundle.modelInterpretationArtifact),
    expectedModelInterpretationContentHash: bundle.expectedModelInterpretationContentHash,
  }),
  loadBundle: (input) => {
    const loaded = loadF6ArtifactBundle(input);
    if (loaded.status !== "accepted" || ado.status !== "updated") return loaded;
    return {
      ...loaded,
      f3Report: { ...loaded.f3Report, modelVersion: "drawing-governance-v3", ado },
    };
  },
  resolveLayout: () => ({
    artifactSetVersion: "f6-artifact-set-v3",
    runId,
    runRoot: outputDirectory,
    publishRoot: bundle.publishRoot,
    optimizationJsonName: "Feature6-Optimization.json",
    finalReportMdName: "Feature6-Report.md",
    finalReportPdfName: "Feature6-Report.pdf",
    runSummaryJsonName: "Feature6-Run-Summary.json",
    manifestName: "manifest.json",
  }),
});
if (result.status !== "completed" || result.outputDirectory !== outputDirectory) {
  rmSync(bundle.root, { recursive: true, force: true });
  throw new Error("isolated F6 workflow did not publish the expected governed run: " + JSON.stringify({ status: result.status, reasonCode: result.reasonCode, failureDetail: result.failureDetail, outputDirectory: result.outputDirectory }));
}
const verification = validateExistingF6Artifact(outputDirectory, { publishRoot: bundle.publishRoot });
if (verification.status !== "accepted" || verification.outputDirectory !== outputDirectory) {
  rmSync(bundle.root, { recursive: true, force: true });
  throw new Error("isolated governed run rejected: " + JSON.stringify(verification));
}
const verifierOutput = execFileSync(process.execPath, [
  ${JSON.stringify(path.join(process.cwd(), "scripts", "verify-current-f6.mjs"))},
  outputDirectory,
], {
  cwd: ${JSON.stringify(process.cwd())},
  encoding: "utf8",
  timeout: 60_000,
  env: { ...process.env, AI_TVA_F6_PUBLISH_ROOT: bundle.publishRoot },
});
const verifierResult = JSON.parse(verifierOutput);
if (verifierResult.status !== "accepted" || verifierResult.outputDirectory !== outputDirectory) {
  rmSync(bundle.root, { recursive: true, force: true });
  throw new Error("exact-run verifier rejected governed output: " + verifierOutput);
}
const markdown = verification.finalReportMarkdown;
const sourceHash = createHash("sha256").update(markdown).digest("hex");
const inlineImages = validatedF6InlineImages({ markdown, sourceHash, reportPath: verification.finalReportMarkdownPath, managedRoot: bundle.publishRoot });
writeFileSync(htmlPath, renderF6PdfHtml({ markdown, sourceHash, inlineImages }), "utf8");
console.log("TASK10_RUN_JSON=" + JSON.stringify({
  root: bundle.root,
  publishRoot: bundle.publishRoot,
  outputDirectory,
  pdfPath: verification.finalReportPdfPath,
  htmlPath,
  worksheetNames,
  verifiedOutputDirectory: verifierResult.outputDirectory,
}));
`;
  const output = execFileSync(process.execPath, [
    "--input-type=module",
    "-e",
    generationCode,
    runId,
    htmlPath,
    JSON.stringify(ado),
    JSON.stringify(worksheetNames),
    JSON.stringify(REQUEST_CONTEXT),
    JSON.stringify(INTERACTION_LANGUAGE),
  ], { cwd: repositoryRoot, encoding: "utf8", timeout: 180_000 });
  const encodedRun = output.split(/\r?\n/u).find((line) => line.startsWith("TASK10_RUN_JSON="));
  if (encodedRun === undefined) throw new Error(`isolated F6 generator returned no run identity: ${output}`);
  const run = JSON.parse(encodedRun.slice("TASK10_RUN_JSON=".length)) as GovernedF6Run;
  console.log(`F6_E2E_${ado.status.toUpperCase()}_RUN=${run.outputDirectory}`);
  console.log(`F6_E2E_${ado.status.toUpperCase()}_PUBLISH_ROOT=${run.publishRoot}`);
  return run;
}

async function assertSlidesFit(page: Page): Promise<void> {
  const slides = page.locator(".slide");
  await expect(slides).toHaveCount(3);
  for (const slide of await slides.all()) {
    expect(await slide.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    expect(await slide.evaluate((node) => node.scrollHeight <= node.clientHeight)).toBe(true);
  }
}

async function assertProcessRowsDoNotOverlap(panel: Locator): Promise<void> {
  const processRows = panel.locator("tbody tr");
  await expect(processRows).toHaveCount(7);
  const overlaps = await processRows.evaluateAll((rows) => rows.flatMap((row, index) => {
    const current = row.getBoundingClientRect();
    return rows.slice(index + 1).flatMap((candidate, candidateOffset) => {
      const next = candidate.getBoundingClientRect();
      const intersects = current.left < next.right
        && current.right > next.left
        && current.top < next.bottom
        && current.bottom > next.top;
      return intersects ? [`${index}:${index + candidateOffset + 1}`] : [];
    });
  }));
  expect(overlaps).toEqual([]);
}

async function openRenderedReport(page: Page, run: GovernedF6Run): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(pathToFileURL(run.htmlPath).href);
  await page.waitForLoadState("load");
  await expect(page.locator(".slide-summary")).toBeVisible();
  await assertSlidesFit(page);
}

test("publishes one overview page plus one page per worksheet without overflow", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  mkdirSync(SCREENSHOT_ROOT, { recursive: true });
  const runs: GovernedF6Run[] = [];
  try {
    const missingRun = createGovernedF6FixtureRun(testInfo, { status: "not_requested" });
    runs.push(missingRun);
    expect(missingRun.verifiedOutputDirectory).toBe(missingRun.outputDirectory);

    const pdfEvidence = await inspectPdf(missingRun.pdfPath);
    expect(pdfEvidence.pageTexts).toHaveLength(1 + missingRun.worksheetNames.length);
    const pdfText = pdfEvidence.pageTexts.join(" ");
    for (const checkLabel of [
      "Analysis Method", "Input Completeness", "Output Completeness", "Tolerance Validity",
      "Drawing/DIM Governance", "ADO Traceability", "Target Sigma",
    ]) expect(pdfText).toContain(checkLabel);
    expect(pdfText).toContain("MISSING");

    await openRenderedReport(page, missingRun);
    const overview = page.locator(".slide-summary");
    const ready = page.locator(".slide-worksheet").filter({ hasText: missingRun.worksheetNames[0] });
    const blocked = page.locator(".slide-worksheet").filter({ hasText: missingRun.worksheetNames[1] });
    await expect(ready).toBeVisible();
    await expect(blocked).toBeVisible();
    const stackImage = ready.locator(".stack-image img");
    await expect(stackImage).toHaveJSProperty("complete", true);
    expect(await stackImage.evaluate((image: HTMLImageElement) => {
      if (image.naturalWidth === 0 || image.naturalHeight === 0) return false;
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (context === null) return false;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] > 0 && (pixels[index] < 250 || pixels[index + 1] < 250 || pixels[index + 2] < 250)) return true;
      }
      return false;
    })).toBe(true);

    const missingProcess = ready.locator(".analysis-panel--process");
    const missingStatus = missingProcess.getByRole("cell", { name: "MISSING", exact: true });
    await expect(missingStatus).toBeVisible();
    await expect(missingProcess.getByRole("link")).toHaveCount(0);
    await assertProcessRowsDoNotOverlap(missingProcess);

    await overview.screenshot({ path: path.join(SCREENSHOT_ROOT, "f6-overview.png") });
    await ready.screenshot({ path: path.join(SCREENSHOT_ROOT, "f6-ready-worksheet.png") });
    await blocked.screenshot({ path: path.join(SCREENSHOT_ROOT, "f6-blocked-worksheet.png") });
    await missingProcess.screenshot({ path: path.join(SCREENSHOT_ROOT, "f6-ado-missing.png") });

    const summary = JSON.parse(readFileSync(path.join(missingRun.outputDirectory, "Feature6-Run-Summary.json"), "utf8"));
    const pdfBytes = readFileSync(missingRun.pdfPath);
    expect(pdfBytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(createHash("sha256").update(pdfBytes).digest("hex")).toBe(summary.hashes.finalReportPdfSha256);
    const dimId = ready.locator(".dim-id-review", { hasText: "1" });
    await expect(dimId).toBeVisible();
    expect(await dimId.evaluate((cell) => getComputedStyle(cell).backgroundColor)).toBe("rgb(254, 240, 0)");
    expect(await dimId.evaluate((cell) => getComputedStyle(cell).fontWeight)).toBe("800");

    const imagePanel = ready.locator(".analysis-panel--image");
    const [imageWidth, copyWidth] = await imagePanel.evaluate((panel) => {
      const image = panel.querySelector(".stack-image")?.getBoundingClientRect();
      const copy = panel.querySelector("p")?.getBoundingClientRect();
      if (image === undefined || copy === undefined) throw new Error("Tolerance Path Image columns are missing");
      return [image.width, copy.width];
    });
    expect(imageWidth / copyWidth).toBeCloseTo(1.5, 1);

    expect(await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return [
        "--p-black", "--p-white", "--p-gray-242", "--p-gray-210", "--p-gray-80", "--p-orange",
        "--p-yellow", "--p-green", "--p-aqua", "--p-cyan", "--p-purple", "--p-dark-red",
      ].map((token) => style.getPropertyValue(token).trim());
    })).toEqual([
      "#000000", "#FFFFFF", "#F2F2F2", "#D2D2D2", "#505050", "#FF9349",
      "#FEF000", "#9BF00B", "#30E5D0", "#50E6FF", "#D59DFF", "#A72929",
    ]);
    expect(await missingStatus.evaluate((cell) => getComputedStyle(cell).fontWeight)).toBe("800");
    expect(await missingStatus.evaluate((cell) => getComputedStyle(cell).color)).toBe("rgb(167, 41, 41)");
  } finally {
    if (process.env.AI_TVA_F6_E2E_KEEP_RUN !== "1") {
      for (const run of runs) rmSync(run.root, { recursive: true, force: true });
    }
  }
});

test("renders the validated ADO work item link in the worksheet process checks", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  mkdirSync(SCREENSHOT_ROOT, { recursive: true });
  const runs: GovernedF6Run[] = [];
  try {
    const linkedRun = createGovernedF6FixtureRun(testInfo, LINKED_ADO);
    runs.push(linkedRun);
    expect(linkedRun.verifiedOutputDirectory).toBe(linkedRun.outputDirectory);
    await openRenderedReport(page, linkedRun);
    const linkedProcess = page.locator(".slide-worksheet")
      .filter({ hasText: linkedRun.worksheetNames[0] })
      .locator(".analysis-panel--process");
    const adoLink = linkedProcess.getByRole("link", { name: "Updated Work Item #1119604" });
    const expectedAdoUrl = "https://dev.azure.com/contoso/Devices/_workitems/edit/1119604";
    await expect(adoLink).toHaveAttribute("href", expectedAdoUrl);
    expect((await inspectPdf(linkedRun.pdfPath)).annotationUrls).toContain(expectedAdoUrl);
    await assertProcessRowsDoNotOverlap(linkedProcess);
    await linkedProcess.screenshot({ path: path.join(SCREENSHOT_ROOT, "f6-ado-linked.png") });
  } finally {
    if (process.env.AI_TVA_F6_E2E_KEEP_RUN !== "1") {
      for (const run of runs) rmSync(run.root, { recursive: true, force: true });
    }
  }
});