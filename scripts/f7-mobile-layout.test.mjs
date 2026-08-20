import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const stylePath = path.join(rootDir, "apps/f7-web/src/style.css");

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function findMatchingBrace(source, openBraceIndex) {
  let depth = 0;
  for (let index = openBraceIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractAtRuleBody(css, atRulePrefix) {
  const startIndex = css.indexOf(atRulePrefix);
  if (startIndex < 0) return null;

  const openBraceIndex = css.indexOf("{", startIndex);
  if (openBraceIndex < 0) return null;

  const closeBraceIndex = findMatchingBrace(css, openBraceIndex);
  if (closeBraceIndex < 0) return null;

  return css.slice(openBraceIndex + 1, closeBraceIndex);
}

function extractRuleBody(css, selector) {
  const selectorPattern = new RegExp(`(^|})\\s*${escapeRegExp(selector)}\\s*\\{`, "m");
  const match = selectorPattern.exec(css);
  if (!match) return null;

  const openBraceIndex = css.indexOf("{", match.index);
  if (openBraceIndex < 0) return null;
  const closeBraceIndex = findMatchingBrace(css, openBraceIndex);
  if (closeBraceIndex < 0) return null;

  return css.slice(openBraceIndex + 1, closeBraceIndex);
}

function extractRuleBodiesIncludingSelector(css, selector) {
  const bodies = [];
  const startRegex = /([^{}]+)\{/g;
  let match;
  while ((match = startRegex.exec(css)) !== null) {
    const selectorListText = match[1]?.trim() ?? "";
    if (selectorListText.startsWith("@")) continue;

    const selectors = selectorListText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!selectors.includes(selector)) continue;

    const openBraceIndex = css.indexOf("{", match.index);
    const closeBraceIndex = findMatchingBrace(css, openBraceIndex);
    if (closeBraceIndex < 0) continue;
    bodies.push(css.slice(openBraceIndex + 1, closeBraceIndex));
  }
  return bodies;
}

function expectDeclaration(ruleBody, property, value) {
  expect(ruleBody).not.toBeNull();
  const declaration = new RegExp(`${escapeRegExp(property)}\\s*:\\s*${escapeRegExp(value)}\\s*;`);
  expect(ruleBody).toMatch(declaration);
}

function expectDeclarationInAnyRule(ruleBodies, property, value) {
  const declaration = new RegExp(`${escapeRegExp(property)}\\s*:\\s*${escapeRegExp(value)}\\s*;`);
  expect(ruleBodies.length).toBeGreaterThan(0);
  expect(ruleBodies.some((body) => declaration.test(body))).toBe(true);
}

describe("f7 mobile layout css contract", () => {
  const css = stripComments(fs.readFileSync(stylePath, "utf-8"));

  it("keeps workbench and layout containers width-contained", () => {
    const rootRule = extractRuleBody(css, ".workbench-root");
    expectDeclaration(rootRule, "max-width", "1360px");
    expectDeclaration(rootRule, "width", "100%");
    expectDeclaration(rootRule, "min-width", "0");

    const gridRule = extractRuleBody(css, ".layout-grid");
    expectDeclaration(gridRule, "min-width", "0");

    const railRule = extractRuleBody(css, ".workflow-rail");
    expectDeclaration(railRule, "min-width", "0");
    expectDeclaration(railRule, "max-width", "100%");

    const contentRule = extractRuleBody(css, ".workflow-content");
    expectDeclaration(contentRule, "min-width", "0");
    expectDeclaration(contentRule, "max-width", "100%");

    const panelRule = extractRuleBody(css, ".workbench-panel");
    expectDeclaration(panelRule, "min-width", "0");
    expectDeclaration(panelRule, "max-width", "100%");
  });

  it("contains table scrolling inside table-scroll", () => {
    const tableScrollRule = extractRuleBody(css, ".table-scroll");
    expectDeclaration(tableScrollRule, "width", "100%");
    expectDeclaration(tableScrollRule, "min-width", "0");
    expectDeclaration(tableScrollRule, "max-width", "100%");
    expectDeclaration(tableScrollRule, "overflow-x", "auto");
    expectDeclaration(tableScrollRule, "overscroll-behavior-inline", "contain");

    const tableRule = extractRuleBody(css, ".data-table");
    expectDeclaration(tableRule, "min-width", "1050px");
  });

  it("prevents viewport overflow at root and in mobile layout", () => {
    const htmlRule = extractRuleBody(css, "html");
    expectDeclaration(htmlRule, "max-width", "100%");

    const bodyRule = extractRuleBody(css, "body");
    expectDeclaration(bodyRule, "max-width", "100%");

    const headerRule = extractRuleBody(css, ".workbench-header");
    expectDeclaration(headerRule, "flex-wrap", "wrap");
    expectDeclaration(headerRule, "min-width", "0");

    const headerMetaRule = extractRuleBody(css, ".header-meta");
    expectDeclaration(headerMetaRule, "overflow-wrap", "anywhere");

    const railRule = extractRuleBody(css, ".workflow-rail");
    expectDeclaration(railRule, "overflow-wrap", "anywhere");

    const hashRules = extractRuleBodiesIncludingSelector(css, ".hash");
    expectDeclarationInAnyRule(hashRules, "overflow-wrap", "anywhere");

    const mobileRule = extractAtRuleBody(css, "@media (max-width: 920px)");
    expect(mobileRule).not.toBeNull();
    const mobileGridRule = extractRuleBody(mobileRule, ".layout-grid");
    expectDeclaration(mobileGridRule, "grid-template-columns", "1fr");
  });
});