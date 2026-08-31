export interface UploadPanelProps {
  readonly disabled?: boolean;
  readonly compact?: boolean;
  readonly onUpload: (file: File) => Promise<void>;
}

export function UploadPanel({ disabled = false, compact = false, onUpload }: UploadPanelProps) {
  const input = (
    <label className={compact ? "button button--upload" : "field field--file"}>
      <span>{compact ? "Open workbook" : "Choose .xlsx file"}</span>
      <input
        className={compact ? "visually-hidden" : undefined}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) {
            void onUpload(file);
            event.currentTarget.value = "";
          }
        }}
      />
    </label>
  );
  return compact ? input : (
    <section className="panel" aria-labelledby="upload-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Upload</p>
          <h2 id="upload-title">Upload workbook</h2>
        </div>
      </div>
      {input}
      <p className="support-text">The browser only sends governed workbook bytes. It does not store tokens or rewrite the workbook.</p>
    </section>
  );
}
