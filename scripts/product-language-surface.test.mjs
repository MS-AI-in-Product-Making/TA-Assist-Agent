import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { assertNoProhibitedProductIdentifiers } from "@ai-assist/product-language";

const root = process.cwd();

const REQUIRED_PRODUCT_SURFACE_FILES = [
  "apps/f7-web/src/App.vue",
  "apps/f7-web/src/components/MeasurementImportPanel.vue",
  "apps/f7-web/src/components/ReportPanel.vue",
  "apps/f7-web/src/components/TAResultsInterpretation.vue",
  "docs/governance/evidence/f3-f5-f6-report-readability-f4-baseline.json",
];

const SCANNED_PRODUCT_SURFACE_FILES = [
  "apps/f7-web/src/App.vue",
  "apps/f7-web/src/components/DimensionChainPanel.vue",
  "apps/f7-web/src/components/MeasurementImportPanel.vue",
  "apps/f7-web/src/components/TAResultsInterpretation.vue",
  "apps/f7-web/src/components/WorksheetConfirmation.vue",
];

describe("product-language surface scan", () => {
  it("covers retained production surfaces only", () => {
    for (const relativePath of REQUIRED_PRODUCT_SURFACE_FILES) {
      expect(existsSync(path.join(root, relativePath)), relativePath).toBe(true);
    }

    const collected = SCANNED_PRODUCT_SURFACE_FILES;
    expect(collected.some((relativePath) => relativePath.startsWith("apps/f7-web/src/components/"))).toBe(true);
    expect(collected.some((relativePath) => relativePath.endsWith(".vue"))).toBe(true);
    expect(collected.some((relativePath) => relativePath.includes("workbench"))).toBe(false);
    expect(collected.some((relativePath) => relativePath.includes("agent-runtime"))).toBe(false);
  });

  it("rejects prohibited internal identifiers from retained real user surfaces", () => {
    const failures = [];

    const surfaceFiles = [...SCANNED_PRODUCT_SURFACE_FILES];

    for (const relativePath of [...new Set(surfaceFiles)]) {
      const absolutePath = path.join(root, relativePath);
      const content = readFileSync(absolutePath, "utf8");
      const candidates = (
        relativePath.endsWith(".vue")
          ? collectVueUserFacingText(content)
          : collectUserFacingText(content)
      ).filter((text) => text.length > 0);

      for (const text of candidates) {
        try {
          assertNoProhibitedProductIdentifiers(text);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          failures.push(`${relativePath}: ${detail}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });
});

function collectUserFacingText(content) {
  const values = [];
  const quotedText = /(["'`])((?:\\.|(?!\1).){1,240})\1/gus;
  for (const match of content.matchAll(quotedText)) {
    const text = (match[2] ?? "").trim();
    if (text.length === 0) continue;
    if (!/[A-Za-z\u4e00-\u9fff]/u.test(text)) continue;
    if (/^[A-Za-z0-9_-]+$/u.test(text)) continue;
    values.push(text);
  }

  return values;
}

function collectVueUserFacingText(content) {
  const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/u);
  if (!templateMatch) return [];

  const templateContent = templateMatch[1]
    .replace(/\{\{[\s\S]*?\}\}/gu, " ")
    .replace(/<script[\s\S]*?<\/script>/gu, " ")
    .replace(/<style[\s\S]*?<\/style>/gu, " ");

  const values = [];

  for (const match of templateContent.matchAll(/>([^<>{}]{1,240})</gu)) {
    const text = normalizeCandidateText(match[1] ?? "");
    if (isUserFacingCandidate(text)) values.push(text);
  }

  for (const match of templateContent.matchAll(/\b(?:title|placeholder|aria-label|alt)\s*=\s*["']([^"']{1,240})["']/gu)) {
    const text = normalizeCandidateText(match[1] ?? "");
    if (isUserFacingCandidate(text)) values.push(text);
  }

  return values;
}

function normalizeCandidateText(text) {
  return text.replace(/\s+/gu, " ").trim();
}

function isUserFacingCandidate(text) {
  if (text.length === 0) return false;
  if (!/[A-Za-z\u4e00-\u9fff]/u.test(text)) return false;
  if (/^[A-Za-z0-9_-]+$/u.test(text)) return false;
  return true;
}
