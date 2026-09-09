import { governanceIssue, partSubsystemLabel, projectF3AdoGovernanceGroups, type DrawingGovernanceResultV2, type F3AdoGovernanceGroup, type F8AdoProjection, type F8AdoWriteConfirmation } from "@ai-assist/contracts";
import type { UiCatalogLanguage } from "@ai-assist/product-language";
import { AdoWorkspaceDecision } from "./AdoWorkspaceDecision.js";

export type GovernanceGroup = F3AdoGovernanceGroup;

interface F3GovernanceProps {
  readonly report?: DrawingGovernanceResultV2;
  readonly language?: UiCatalogLanguage;
  readonly adoDecisionRequired?: boolean;
  readonly adoProjection?: F8AdoProjection;
  readonly onAdoDecision?: (decision: "local_only" | "create_new" | "use_existing", workItemReference?: string, createInput?: { readonly title: string; readonly sponsorEmail: string }) => Promise<void>;
  readonly onAdoConfirm?: (confirmation: F8AdoWriteConfirmation) => Promise<void>;
  readonly onAdoReconcile?: () => Promise<void>;
  readonly onStartNewAdoWriteGeneration?: () => Promise<void>;
  readonly onAdoReset?: () => Promise<void>;
}

export function projectGovernanceGroups(report?: DrawingGovernanceResultV2): GovernanceGroup[] {
  if (report === undefined || report.status === "input_rejected") return [];
  return [...projectF3AdoGovernanceGroups(report)];
}

function cellText(value: unknown): string {
  if (value === null || value === undefined || String(value).trim().length === 0) return "(missing)";
  return String(value);
}

export function F3Governance({ report, language = "en", adoDecisionRequired = false, adoProjection, onAdoDecision, onAdoConfirm, onAdoReconcile, onStartNewAdoWriteGeneration, onAdoReset }: F3GovernanceProps) {
  const groups = projectGovernanceGroups(report);
  if (report === undefined) return null;
  const factorCount = groups.reduce((total, group) => total + group.rows.length, 0);
  return (
    <section className="governance-workspace" aria-labelledby="ado-workspace-title" aria-label="ADO workspace">
      <header>
        <div><span>Workbook governance</span><h2 id="ado-workspace-title">ADO workspace</h2></div>
        <div className="governance-workspace__counts"><strong>{factorCount} Factors</strong><strong>{groups.length} Groups</strong></div>
      </header>
      <div className="governance-groups">{groups.map((group) => <details key={group.partSubsystem}><summary><strong>{group.partSubsystem}</strong><span>{group.factorCount} Factors</span><span>Drawing missing {group.missingDrawingNumberCount}</span><span>DIM ID missing {group.missingDimIdCount}</span></summary><table><thead><tr><th>Worksheet Source</th><th>Device Level Dim</th><th>Dimension Description</th><th>Part / Subsystem</th><th>Drawing Number</th><th>Dim ID</th><th>Factor Description</th><th>Nominal</th><th>Upper Tolerance (+)</th><th>Lower Tolerance (-)</th><th>σ Level</th><th>Governance issue</th></tr></thead><tbody>{group.rows.map((row) => <tr key={row.factorInstanceId}><td>{cellText(row.source.worksheetName)}</td><td>{cellText(row.deviceLevelDim)}</td><td>{cellText(row.dimensionDescription)}</td><td>{partSubsystemLabel(row.partSubsystem)}</td><td>{cellText(row.drawingNumber)}</td><td>{cellText(row.dimId)}</td><td>{cellText(row.factorDescription)}</td><td>{cellText(row.nominal)}</td><td>{cellText(row.upperTolerance)}</td><td>{cellText(row.lowerTolerance)}</td><td>{cellText(row.sigmaLevel)}</td><td>{governanceIssue(row)}</td></tr>)}</tbody></table></details>)}</div>
      <AdoWorkspaceDecision visible={adoDecisionRequired || adoProjection !== undefined || report.ado.status !== "not_requested"} workbookFileName={report.workbook.fileName} language={language} projection={adoProjection} onSubmit={onAdoDecision ?? (async () => undefined)} onConfirm={onAdoConfirm} onReconcile={onAdoReconcile} onStartNewWriteGeneration={onStartNewAdoWriteGeneration} onReset={onAdoReset} />
    </section>
  );
}
