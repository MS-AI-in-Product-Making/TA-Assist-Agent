import type { F2UserReport } from "@ai-assist/contracts";

export interface F2WorksheetStatusProps {
  readonly report?: F2UserReport;
}

export function F2WorksheetStatus({ report }: F2WorksheetStatusProps) {
  return (
    <section className="panel" aria-labelledby="f2-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">F2</p>
          <h2 id="f2-title">Ready / Blocked worksheets</h2>
        </div>
      </div>
      {report === undefined ? <p className="support-text">F2 artifact 尚未可见。</p> : null}
      {report !== undefined ? (
        <>
          <p className="support-text">Ready {report.summary.readyWorksheetCount} / Blocked {report.summary.blockedWorksheetCount}</p>
          <div className="table-scroll" tabIndex={0} aria-label="F2 worksheet status table">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Worksheet</th>
                <th scope="col">Status</th>
                <th scope="col">Image</th>
                <th scope="col">Issue</th>
              </tr>
            </thead>
            <tbody>
              {report.worksheets.map((worksheet) => (
                <tr key={worksheet.worksheetName}>
                  <td>{worksheet.worksheetName}</td>
                  <td>{worksheet.status}</td>
                  <td>{worksheet.tolerancePathImageStatus}</td>
                  <td>{worksheet.systemSpecificationIssues[0]?.reasonCode ?? worksheet.rows.find((row) => row.missingRequiredFields.length > 0)?.missingRequiredFields[0] ?? "none"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
