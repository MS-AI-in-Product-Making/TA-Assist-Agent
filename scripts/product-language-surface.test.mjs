import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { assertNoProhibitedProductIdentifiers } from "@ai-assist/product-language";

const root = process.cwd();

const PRODUCT_SURFACE_FILES = [
  "apps/workbench-web/src/app.tsx",
  "apps/workbench-web/src/components/EngineeringWorkspace.tsx",
  "apps/workbench-web/src/components/AnalysisProgress.tsx",
  "apps/workbench-web/src/components/WorksheetReview.tsx",
  "apps/workbench-web/src/components/F6Summary.tsx",
  "apps/workbench-web/src/components/F6Options.tsx",
  "apps/workbench-web/src/components/F7Placeholder.tsx",
  "apps/workbench-web/src/components/EvidenceImagePane.tsx",
  "apps/workbench-web/src/components/EvidencePane.tsx",
  "apps/workbench-web/src/components/AdoWorkspaceDecision.tsx",
  "apps/workbench-web/src/business-status.ts",
  "apps/workbench-web/src/web-projection.ts",
  "apps/workbench-web/src/workbench-session.ts",
  "packages/agent-runtime/src/runtime.ts",
  "packages/agent-runtime/src/context-builder.ts",
  "apps/vscode-extension/package.json",
  "apps/vscode-extension/src/participant.ts",
  "docs/governance/evidence/f3-f5-f6-report-readability-f4-baseline.json",
];

const OPTIONAL_GENERATED_PRODUCT_SURFACE_FILES = [
  "test/demo-output/f6-runs/f5/2026-09-01T07-30-21-518Z/manifest.json",
];

describe("product-language surface scan", () => {
  it("rejects prohibited internal identifiers from real user surfaces", () => {
    const failures = [];

    const surfaceFiles = [
      ...PRODUCT_SURFACE_FILES,
      ...OPTIONAL_GENERATED_PRODUCT_SURFACE_FILES.filter((relativePath) => existsSync(path.join(root, relativePath))),
    ];

    for (const relativePath of surfaceFiles) {
      const absolutePath = path.join(root, relativePath);
      const content = readFileSync(absolutePath, "utf8");
      const candidates = collectUserFacingText(content).filter((text) => text.length > 0);

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
