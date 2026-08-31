const SUPPORTED_GOVERNED_IMAGE_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const CREDENTIAL_LIKE_PATTERNS = [
  /\bAuthorization\s*[:=]\s*(?:Bearer\s+)?[^\s;|<>{}"'`]+/giu,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{6,}/giu,
  /\b(?:password|token|access[ _-]?token|secret(?:s)?|api[ _-]?key)\s*[:=]\s*[^\s;|<>{}"'`]+/giu,
];

export function isSupportedGovernedImageMediaType(mediaType: string | undefined): boolean {
  return typeof mediaType === "string" && SUPPORTED_GOVERNED_IMAGE_MEDIA_TYPES.has(mediaType);
}

export function sanitizePromptVisibleText(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  let sanitized = trimmed;
  for (const pattern of CREDENTIAL_LIKE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[redacted credential]");
  }
  return sanitized;
}