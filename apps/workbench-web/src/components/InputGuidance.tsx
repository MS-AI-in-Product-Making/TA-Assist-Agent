import { inputMetadata, type UiCatalogLanguage, type UserInputId } from "@ai-assist/product-language/input-metadata";

export function inputGuidanceId(inputId: UserInputId): string {
  return `${inputId}-guidance`;
}

export function InputGuidance({ inputId, language = "en", compact = false }: {
  readonly inputId: UserInputId;
  readonly language?: UiCatalogLanguage;
  readonly compact?: boolean;
}) {
  const metadata = inputMetadata(language)[inputId];
  return (
    <div id={inputGuidanceId(inputId)} className={compact ? "visually-hidden" : "input-guidance"}>
      <p>{metadata.whatToEnter} {metadata.purpose}</p>
      <p><strong>{language === "zh" ? "示例：" : "Example: "}</strong>{metadata.example}</p>
      <p>{metadata.validationHint}</p>
      {metadata.consequence === undefined ? null : <p>{metadata.consequence}</p>}
      {metadata.nextStep === undefined ? null : <p>{metadata.nextStep}</p>}
      {metadata.recovery === undefined ? null : <p>{metadata.recovery}</p>}
    </div>
  );
}