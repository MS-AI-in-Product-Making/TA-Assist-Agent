import type { WorkbookHealthModel } from "../workbook-health.js";

export function WorkbookHealth({ model, onNavigate }: { readonly model?: WorkbookHealthModel; readonly onNavigate?: (worksheetName: string) => void }) {
  if (model === undefined) return null;
  return <section className="workbook-health" aria-labelledby="workbook-health-title"><header><div><span>Workbook evidence</span><h2 id="workbook-health-title">Missing information and data health</h2></div></header><div className="health-summary">{model.summary.map((item) => <div key={item.label} className={`health-summary__item health-summary__item--${item.tone}`}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div><ul className="health-findings">{model.findings.map((finding, index) => <li key={`${finding.kind}-${index}`}>{finding.worksheetName === undefined ? <span>{finding.message}</span> : <button type="button" onClick={() => onNavigate?.(finding.worksheetName!)}><strong>{finding.worksheetName}</strong><span>{finding.message}</span></button>}</li>)}</ul></section>;
}
