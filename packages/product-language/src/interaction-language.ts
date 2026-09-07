export type UiCatalogLanguage = "en" | "zh";
export type LanguageLockSource = "workflow_start" | "explicit_user_change" | "legacy_fallback";

export interface InteractionLanguage {
  readonly languageTag: string;
  readonly uiCatalogLanguage: UiCatalogLanguage;
  readonly lockedAtTurnId: string;
  readonly source: LanguageLockSource;
  readonly fallbackUsed: boolean;
}

export interface ResolveInteractionLanguageInput {
  readonly text: string;
  readonly turnId: string;
  readonly explicitLanguageTag?: string;
  readonly hostLocale?: string;
}

function normalizeLanguageTag(languageTag: string | undefined): string {
  const trimmed = languageTag?.trim();
  return trimmed === undefined || trimmed.length === 0 ? "und" : trimmed;
}

function isChineseLanguageTag(languageTag: string): boolean {
  return /^zh(?:[-_].+)?$/iu.test(languageTag);
}

function isEnglishLanguageTag(languageTag: string): boolean {
  return /^en(?:[-_].+)?$/iu.test(languageTag);
}

function isReliableHostLocale(hostLocale: string | undefined): boolean {
  if (hostLocale === undefined) {
    return false;
  }

  const normalized = normalizeLanguageTag(hostLocale);
  return isChineseLanguageTag(normalized) || isEnglishLanguageTag(normalized);
}

function resolveUiCatalogLanguage(languageTag: string): UiCatalogLanguage {
  return isChineseLanguageTag(languageTag) ? "zh" : "en";
}

function buildInteractionLanguage(languageTag: string, turnId: string, source: LanguageLockSource): InteractionLanguage {
  const normalizedTag = normalizeLanguageTag(languageTag);
  const uiCatalogLanguage = resolveUiCatalogLanguage(normalizedTag);
  const fallbackUsed = normalizedTag === "und" || (uiCatalogLanguage === "en" && !isEnglishLanguageTag(normalizedTag));

  return {
    languageTag: normalizedTag,
    uiCatalogLanguage,
    lockedAtTurnId: turnId,
    source,
    fallbackUsed,
  };
}

export function resolveInteractionLanguage(input: ResolveInteractionLanguageInput): InteractionLanguage {
  void input.text;

  if (input.explicitLanguageTag !== undefined) {
    return buildInteractionLanguage(input.explicitLanguageTag, input.turnId, "workflow_start");
  }

  if (isReliableHostLocale(input.hostLocale)) {
    return buildInteractionLanguage(input.hostLocale, input.turnId, "workflow_start");
  }

  return buildInteractionLanguage("und", input.turnId, "legacy_fallback");
}

export function changeInteractionLanguage(current: InteractionLanguage, input: ResolveInteractionLanguageInput): InteractionLanguage {
  void input.text;

  if (input.explicitLanguageTag !== undefined) {
    return buildInteractionLanguage(input.explicitLanguageTag, input.turnId, "explicit_user_change");
  }

  if (isReliableHostLocale(input.hostLocale)) {
    return buildInteractionLanguage(input.hostLocale, input.turnId, "explicit_user_change");
  }

  return {
    ...current,
    lockedAtTurnId: input.turnId,
    source: "explicit_user_change",
  };
}