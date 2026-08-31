import { useEffect, useState } from "react";

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
  readonly onSubmit: (worksheetNames: string[]) => Promise<void>;
}

export function WorksheetSelection({
  title,
  description,
  actionLabel,
  options,
  disabled = false,
  blockedReason,
  onSubmit,
}: WorksheetSelectionProps) {
  const [selected, setSelected] = useState<readonly string[]>([]);

  useEffect(() => {
    setSelected((current) => current.filter((name) => options.some((option) => option.worksheetName === name && option.disabled !== true)));
  }, [options]);

  return (
    <section className="panel" aria-labelledby={title}>
      <div className="panel__header">
        <div>
          <p className="eyebrow">Selection</p>
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
          <legend className="sr-only">{title}</legend>
          {options.map((option) => {
            const checked = selected.includes(option.worksheetName);
            return (
              <label key={option.worksheetName} className={`worksheet-option worksheet-option--${option.status}${option.disabled ? " is-disabled" : ""}`}>
                <input
                  type="checkbox"
                  aria-label={option.worksheetName}
                  checked={checked}
                  disabled={option.disabled}
                  onChange={(event) => {
                    const nextSelected = event.target.checked
                      ? [...selected, option.worksheetName]
                      : selected.filter((name) => name !== option.worksheetName);
                    setSelected(nextSelected);
                  }}
                />
                <span className="worksheet-option__name">{option.worksheetName}</span>
                <span className="worksheet-option__status">{option.status}</span>
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
