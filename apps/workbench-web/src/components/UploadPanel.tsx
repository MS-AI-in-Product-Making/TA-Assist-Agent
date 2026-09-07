import { inputMetadata, type UiCatalogLanguage } from "@ai-assist/product-language/input-metadata";
import { InputGuidance, inputGuidanceId } from "./InputGuidance.js";

export interface UploadPanelProps {
  readonly disabled?: boolean;
  readonly compact?: boolean;
  readonly language?: UiCatalogLanguage;
  readonly onUpload: (file: File) => Promise<void>;
}

export function UploadPanel({ disabled = false, compact = false, language = "en", onUpload }: UploadPanelProps) {
  const metadata = inputMetadata(language).workbook_file;
  const copy = language === "zh" ? { eyebrow: "上传", heading: "上传工作簿" } : { eyebrow: "Upload", heading: "Upload workbook" };
  const input = (
    <label className={compact ? "button button--upload" : "field field--file"}>
      <span>{compact ? (language === "zh" ? "打开工作簿" : "Open workbook") : metadata.title}</span>
      <input
        className={compact ? "visually-hidden" : undefined}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={disabled}
        aria-label={metadata.title}
        aria-describedby={inputGuidanceId("workbook_file")}
        data-user-input-id="workbook_file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) {
            void onUpload(file);
            event.currentTarget.value = "";
          }
        }}
      />
      {compact ? <InputGuidance inputId="workbook_file" language={language} compact /> : null}
    </label>
  );
  return compact ? input : (
    <section className="panel" aria-labelledby="upload-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 id="upload-title">{copy.heading}</h2>
        </div>
      </div>
      {input}
      <InputGuidance inputId="workbook_file" language={language} />
    </section>
  );
}
