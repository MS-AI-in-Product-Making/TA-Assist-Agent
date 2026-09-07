import { describe, expect, it } from "vitest";
import { changeInteractionLanguage, resolveInteractionLanguage } from "./interaction-language.js";

describe("interaction language", () => {
  it("locks a Japanese request while falling fixed UI back to English", () => {
    expect(resolveInteractionLanguage({ text: "公差解析を開始", turnId: "turn-1", explicitLanguageTag: "ja-JP" })).toEqual({
      languageTag: "ja-JP",
      uiCatalogLanguage: "en",
      lockedAtTurnId: "turn-1",
      source: "workflow_start",
      fallbackUsed: true,
    });
  });

  it("keeps a legacy fallback when no reliable language signal exists", () => {
    expect(resolveInteractionLanguage({ text: "Analyze this workbook", turnId: "turn-2" })).toEqual({
      languageTag: "und",
      uiCatalogLanguage: "en",
      lockedAtTurnId: "turn-2",
      source: "legacy_fallback",
      fallbackUsed: true,
    });
  });

  it("changes the interaction language on explicit user request", () => {
    const current = resolveInteractionLanguage({ text: "公差解析を開始", turnId: "turn-1", explicitLanguageTag: "ja-JP" });

    expect(changeInteractionLanguage(current, { text: "请切换到中文", turnId: "turn-3", explicitLanguageTag: "zh-CN" })).toEqual({
      languageTag: "zh-CN",
      uiCatalogLanguage: "zh",
      lockedAtTurnId: "turn-3",
      source: "explicit_user_change",
      fallbackUsed: false,
    });
  });
});