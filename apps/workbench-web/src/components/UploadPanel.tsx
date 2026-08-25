export interface UploadPanelProps {
  readonly disabled?: boolean;
  readonly onUpload: (file: File) => Promise<void>;
}

export function UploadPanel({ disabled = false, onUpload }: UploadPanelProps) {
  return (
    <section className="panel" aria-labelledby="upload-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Upload</p>
          <h2 id="upload-title">上传 workbook</h2>
        </div>
      </div>
      <label className="field field--file">
        <span>选择 `.xlsx` 文件</span>
        <input
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
      <p className="support-text">浏览器只发送受控 workbook bytes，不保存 token，不改写 workbook。</p>
    </section>
  );
}
