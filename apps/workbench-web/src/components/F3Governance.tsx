import type { DrawingGovernanceResultV2 } from "@ai-assist/contracts";

export interface F3GovernanceProps {
  readonly report?: DrawingGovernanceResultV2;
}

export function F3Governance({ report }: F3GovernanceProps) {
  const governedRows = report?.status === "input_rejected"
    ? []
    : report?.worksheets.flatMap((worksheet) => worksheet.rows.filter((row) => row.governanceStatus !== "complete").map((row) => ({ worksheetName: worksheet.worksheetName, row }))) ?? [];

  return (
    <section className="panel" aria-labelledby="f3-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">F3</p>
          <h2 id="f3-title">Governance</h2>
        </div>
      </div>
      {report === undefined ? <p className="support-text">F3 artifact 尚未可见。</p> : null}
      {report !== undefined && report.status !== "input_rejected" ? (
        <>
          <p className="support-text">Status: {report.status}. Governance required rows: {report.summary.governanceRequiredCount}</p>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Worksheet</th>
                <th scope="col">Dimension</th>
                <th scope="col">Drawing</th>
                <th scope="col">DIM ID</th>
                <th scope="col">Signal</th>
              </tr>
            </thead>
            <tbody>
              {governedRows.map(({ worksheetName, row }) => (
                <tr key={`${worksheetName}-${row.factorInstanceId}`}>
                  <td>{worksheetName}</td>
                  <td>{row.dimensionDescription}</td>
                  <td>{row.drawingNumber ?? "missing"}</td>
                  <td>{row.dimId ?? "missing"}</td>
                  <td>{row.qualitySignals[0] ?? row.governanceStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      {report?.status === "input_rejected" ? <p className="inline-alert">F3 输入被拒绝，需先修复上游 artifact。</p> : null}
    </section>
  );
}
