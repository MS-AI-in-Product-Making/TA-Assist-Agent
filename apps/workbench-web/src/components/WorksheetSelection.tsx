import { useEffect, useState } from "react";
import { inputMetadata, type UiCatalogLanguage } from "@ai-assist/product-language";
import { InputGuidance, inputGuidanceId } from "./InputGuidance.js";

export interface WorksheetOption {
  readonly worksheetName: string;
  readonly detail?: string;
  readonly disabled?: boolean;
  readonly status: "ready" | "blocked" | "available";
}

export interface WorksheetSelectionProps {
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly options: readonly WorksheetOption[];
  readonly disabled?: boolean;
  readonly blockedReason?: string;
  readonly language?: UiCatalogLanguage;
  readonly onSubmit: (worksheetNames: string[]) => Promise<void>;
}

export function WorksheetSelection({
  title,
  description,
  actionLabel,
  options,
  disabled = false,
  blockedReason,
  language = "en",
  onSubmit,
}: WorksheetSelectionProps) {
  const metadata = inputMetadata(language).worksheet_scope;
  const statusLabels = language === "zh"
    ? { ready: "就绪", blocked: "已阻止", available: "可用" }
    : { ready: "Ready", blocked: "Blocked", available: "Available" };
  const [selected, setSelected] = useState<readonly string[]>([]);

  useEffect(() => {
    setSelected((current) => current.filter((name) => options.some((option) => option.worksheetName === name && option.disabled !== true)));
  }, [options]);

  return (
    <section className="panel" aria-labelledby={title}>
      <div className="panel__header">
        <div>
          <p className="eyebrow">{language === "zh" ? "选择" : "Selection"}</p>
          <h2 id={title}>{title}</h2>
        </div>
      </div>
      <p className="support-text">{description}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (selected.length === 0 || disabled || blockedReason !== undefined) return;
          void onSubmit([...selected]);
        }}
      >
        <fieldset className="worksheet-list" disabled={disabled}>
          <legend>{metadata.title}</legend>
          <InputGuidance inputId="worksheet_scope" language={language} />
          {options.map((option) => {
            const checked = selected.includes(option.worksheetName);
            return (
              <label key={option.worksheetName} className={`worksheet-option worksheet-option--${option.status}${option.disabled ? " is-disabled" : ""}`}>
                <input
                  type="checkbox"
                  aria-label={option.worksheetName}
                  checked={checked}
                  disabled={option.disabled}
                  aria-describedby={inputGuidanceId("worksheet_scope")}
                  data-user-input-id="worksheet_scope"
                  onChange={(event) => {
                    const nextSelected = event.target.checked
                      ? [...selected, option.worksheetName]
                      : selected.filter((name) => name !== option.worksheetName);
                    setSelected(nextSelected);
                  }}
                />
                <span className="worksheet-option__name">{option.worksheetName}</span>
                <span className="worksheet-option__status">{statusLabels[option.status]}</span>
                {option.detail === undefined ? null : <span className="worksheet-option__detail">{option.detail}</span>}
              </label>
            );
          })}
        </fieldset>
        {blockedReason === undefined ? null : <p className="inline-alert">{blockedReason}</p>}
        <button type="submit" className="button button--primary" disabled={disabled || selected.length === 0 || blockedReason !== undefined}>
          {actionLabel}
        </button>
      </form>
    </section>
  );
}
