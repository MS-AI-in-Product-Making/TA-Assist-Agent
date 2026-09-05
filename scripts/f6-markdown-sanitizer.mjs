import path from "node:path";
import { marked } from "marked";
import { formatEngineering, formatPercent } from "./engineering-format.mjs";

const REDACTED_PATH = "[redacted-local-path]";
const QUOTED_ABSOLUTE_PATH = /(["'])(?:[A-Za-z]:[\\/]|\\\\|\/(?!\/))[^"'\r\n]+\1/g;
const BRACKETED_ABSOLUTE_PATH = /([[(])(?:[A-Za-z]:[\\/]|\\\\|\/(?!\/))[^\s;|<>"'`()[\]{}]+([)\]])/g;
const WINDOWS_PATH = /[A-Za-z]:[\\/][^\s;|<>"'`()[\]{}]+/g;
const UNC_PATH = /\\\\[^\s;|<>"'`()[\]{}]+/g;
const POSIX_PATH = /(^|[\s=:])\/(?!\/)[^\s;|<>"'`()[\]{}]+/gm;
const MARKDOWN_CHARACTERS = ["\\", "`", "|", "[", "]", "(", ")", "!", "*", "#", "+", "_"];
const ALLOWED_MODEL_TOKEN_TYPES = new Set([
  "paragraph",
  "text",
  "space",
  "heading",
  "list",
  "list_item",
  "table",
  "strong",
  "em",
  "codespan",
  "br",
  "link",
]);
const CALCULATION_PLACEHOLDER = /\{\{calc:([a-z][a-z0-9-]*)\}\}/g;

function failModelMarkdown() {
  throw new Error("Invalid model Markdown.");
}

function validateDeclaredLink(href, declaredLinks) {
  let decoded;
  try {
    decoded = decodeURIComponent(href);
  } catch {
    failModelMarkdown();
  }
  if (decoded.includes("\\")
    || decoded.startsWith("/")
    || /^[A-Za-z]:/.test(decoded)
    || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(decoded)) {
    failModelMarkdown();
  }
  const normalized = path.posix.normalize(decoded);
  if (normalized === ".." || normalized.startsWith("../") || normalized !== decoded) failModelMarkdown();
  if (!declaredLinks.has(normalized)) failModelMarkdown();
}

export function validateModelMarkdown(markdown, declaredLinks = []) {
  if (typeof markdown !== "string" || markdown.trim() === "") failModelMarkdown();
  const declared = new Set(declaredLinks);
  if ([...declared].some((link) => typeof link !== "string" || link === "")) failModelMarkdown();

  let tokens;
  try {
    tokens = marked.lexer(markdown);
  } catch {
    failModelMarkdown();
  }
  marked.walkTokens(tokens, (token) => {
    if (!ALLOWED_MODEL_TOKEN_TYPES.has(token.type)) failModelMarkdown();
    if (token.type === "link") validateDeclaredLink(token.href, declared);
  });

  const withoutPlaceholders = markdown.replace(CALCULATION_PLACEHOLDER, "");
  if (withoutPlaceholders.includes("{{calc:")
    || /(?:^|[^\w])[-+]?\d+\.\d+(?:[eE][-+]?\d+)?(?:$|[^\w])/.test(withoutPlaceholders)
    || /(?:^|[^\w])[-+]?\d+(?:\.\d+)?\s*%/.test(withoutPlaceholders)) {
    failModelMarkdown();
  }
  return markdown;
}

function formatCalculationClaim(claim) {
  if (!Number.isFinite(claim.rawValue)) throw new Error("Invalid calculation claims.");
  if (claim.displayFormat === "engineering" && typeof claim.unit === "string" && claim.unit !== "") {
    return formatEngineering(claim.rawValue, claim.unit, 6).replace(/(\.\d*?[1-9])0+(?=\s)|\.0+(?=\s)/, "$1");
  }
  if (claim.displayFormat === "number" && claim.unit === null) {
    return Number(claim.rawValue.toFixed(6)).toString();
  }
  if (claim.displayFormat === "percent" && claim.unit === null) {
    return formatPercent(claim.rawValue * 100, 1);
  }
  throw new Error("Invalid calculation claims.");
}

export function renderCalculationClaims(markdown, claims) {
  if (typeof markdown !== "string" || !Array.isArray(claims)) throw new Error("Invalid calculation claims.");
  let rendered = markdown;
  const claimIds = new Set();
  for (const claim of claims) {
    if (claim === null || typeof claim !== "object" || typeof claim.claimId !== "string" || claimIds.has(claim.claimId)) {
      throw new Error("Invalid calculation claims.");
    }
    claimIds.add(claim.claimId);
    const placeholder = `{{calc:${claim.claimId}}}`;
    if (rendered.split(placeholder).length !== 2) throw new Error("Invalid calculation claims.");
    rendered = rendered.replace(placeholder, formatCalculationClaim(claim));
  }
  if (/\{\{calc:/.test(rendered)) throw new Error("Invalid calculation claims.");
  return rendered;
}

export function safeText(value) {
  let escaped = String(value)
    .replace(QUOTED_ABSOLUTE_PATH, REDACTED_PATH)
    .replace(BRACKETED_ABSOLUTE_PATH, `$1${REDACTED_PATH}$2`)
    .replace(UNC_PATH, REDACTED_PATH)
    .replace(WINDOWS_PATH, REDACTED_PATH)
    .replace(POSIX_PATH, `$1${REDACTED_PATH}`)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  for (const character of MARKDOWN_CHARACTERS) escaped = escaped.replaceAll(character, `\\${character}`);
  return escaped
    .replaceAll("\\[redacted-local-path\\]", REDACTED_PATH)
    .replaceAll(/\r?\n/g, "<br>");
}

export function cell(value) {
  return value === null || value === undefined || value === "" ? "（缺失）" : safeText(value);
}