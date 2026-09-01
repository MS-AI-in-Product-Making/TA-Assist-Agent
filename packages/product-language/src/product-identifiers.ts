import { createHash } from "node:crypto";
import { TA_INTERNAL_WORKFLOW_STATES } from "./ta-workbook-language.js";

const WINDOWS_RESERVED_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

const PROHIBITED_PRODUCT_PATTERNS = [
  /\bF[0-7]\b/iu,
  /\bFeature[ _-]?[0-7]\b/iu,
];

export const TA_INTERNAL_REVIEW_ARTIFACT_KINDS = [
  "f1_image",
  "f2_report",
  "f3_report",
  "f4_calculation",
  "f4_report",
  "f5_report",
  "f6_optimization",
  "f6_report",
  "f7_import_dataset",
  "f7_measurement_summary",
] as const;

const INTERNAL_STATE_TOKEN_SET = new Set<string>(TA_INTERNAL_WORKFLOW_STATES);
const INTERNAL_ARTIFACT_KIND_SET = new Set<string>(TA_INTERNAL_REVIEW_ARTIFACT_KINDS);
const MACHINE_STATE_ASSIGNMENT = /\b(?:state|status|workflow_state|internal_state)\s*[:=]\s*([a-z0-9_-]+)/giu;
const TOKEN_PATTERN = /[a-z0-9_-]+/giu;

const WINDOWS_UNSAFE_CHARACTERS = /[<>:"/\\|?*\u0000-\u001F]/g;
const COLLAPSIBLE_SEPARATOR = /[-_.\s]+/g;
const TRAILING_WINDOWS_INVALID = /[.\s]+$/g;
const LEADING_OR_TRAILING_HYPHEN = /^-+|-+$/g;
const FILE_EXTENSION = /\.[^.\\/]+$/;
const PRODUCT_SAFE_NAME_LIMIT = 96;
const TRUNCATED_HASH_LENGTH = 8;

function shortDeterministicHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, TRUNCATED_HASH_LENGTH);
}

function collapseToSafeStem(input: string): string {
  const nfc = input.normalize("NFC").trim();
  const withoutExtension = nfc.replace(FILE_EXTENSION, "");
  const replacedUnsafeChars = withoutExtension.replace(WINDOWS_UNSAFE_CHARACTERS, "-");
  const collapsed = replacedUnsafeChars.replace(COLLAPSIBLE_SEPARATOR, "-");
  const withoutTrailingInvalid = collapsed.replace(TRAILING_WINDOWS_INVALID, "");
  const normalizedStem = withoutTrailingInvalid.replace(LEADING_OR_TRAILING_HYPHEN, "");
  return normalizedStem.length > 0 ? normalizedStem : "workbook";
}

function truncateWithHash(stem: string): string {
  if (stem.length <= PRODUCT_SAFE_NAME_LIMIT) {
    return stem;
  }

  const suffix = shortDeterministicHash(stem);
  const prefixLength = PRODUCT_SAFE_NAME_LIMIT - TRUNCATED_HASH_LENGTH - 1;
  const prefix = stem.slice(0, prefixLength).replace(LEADING_OR_TRAILING_HYPHEN, "");
  return `${prefix}-${suffix}`;
}

export function productSafeNameV1(fileName: string): string {
  const safeStem = truncateWithHash(collapseToSafeStem(fileName));
  if (WINDOWS_RESERVED_NAMES.has(safeStem.toUpperCase())) {
    return `workbook-${safeStem}`;
  }
  return safeStem;
}

export function createProductRunReference(seed: string): string {
  const normalizedSeed = seed.normalize("NFC");
  const token = BigInt(`0x${createHash("sha256").update(normalizedSeed).digest("hex").slice(0, 12)}`)
    .toString(36)
    .padStart(8, "0")
    .slice(0, 8);
  return `ta-run-${token}`;
}

export function assertNoProhibitedProductIdentifiers(value: string): void {
  for (const pattern of PROHIBITED_PRODUCT_PATTERNS) {
    if (pattern.test(value)) {
      throw new Error(`Prohibited internal identifier found in product surface: ${value}`);
    }
  }

  for (const match of value.matchAll(MACHINE_STATE_ASSIGNMENT)) {
    const token = match[1]?.toLowerCase();
    if (token !== undefined && INTERNAL_STATE_TOKEN_SET.has(token)) {
      throw new Error(`Prohibited internal identifier found in product surface: ${value}`);
    }
  }

  for (const match of value.matchAll(TOKEN_PATTERN)) {
    const token = match[0].toLowerCase();
    if (INTERNAL_ARTIFACT_KIND_SET.has(token)) {
      throw new Error(`Prohibited internal identifier found in product surface: ${value}`);
    }

    if (token.includes("_") && INTERNAL_STATE_TOKEN_SET.has(token)) {
      throw new Error(`Prohibited internal identifier found in product surface: ${value}`);
    }
  }
}
