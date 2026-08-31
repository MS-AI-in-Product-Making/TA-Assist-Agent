import type { DrawingGovernanceResultV2 } from "./contracts.js";

type AcceptedF3Report = Exclude<DrawingGovernanceResultV2, { status: "input_rejected" }>;
export type F3AdoGovernanceRow = AcceptedF3Report["worksheets"][number]["rows"][number];

export interface F3AdoGovernanceGroup {
  readonly partSubsystem: string;
  readonly factorCount: number;
  readonly missingDrawingNumberCount: number;
  readonly missingDimIdCount: number;
  readonly rows: readonly F3AdoGovernanceRow[];
}

const QUALITY_SIGNAL_MESSAGES = {
  drawing_number_missing: "Drawing Number missing",
  dim_id_missing: "DIM ID missing",
  dim_id_suspected_invalid: "DIM ID suspected invalid",
  dim_id_needs_confirmation: "DIM ID needs confirmation",
  duplicate_conflict: "Duplicate Drawing Number and DIM ID conflict",
} as const;

const QUALITY_SIGNAL_ORDER = [
  "drawing_number_missing",
  "dim_id_missing",
  "dim_id_suspected_invalid",
  "dim_id_needs_confirmation",
  "duplicate_conflict",
] as const;

export function partSubsystemLabel(value: string | null | undefined): string {
  if (value === null || value === undefined) return "(missing Part / Subsystem)";
  const text = String(value).trim();
  if (text.length === 0 || text === "(missing)") return "(missing Part / Subsystem)";
  return text;
}

export function governanceIssue(row: Pick<F3AdoGovernanceRow, "qualitySignals">): string {
  const issues = QUALITY_SIGNAL_ORDER
    .filter((signal) => row.qualitySignals.includes(signal))
    .map((signal) => QUALITY_SIGNAL_MESSAGES[signal]);
  return issues.length > 0 ? issues.join("; ") : "Complete";
}

function missingText(value: string | null | undefined): boolean {
  return value === null || value === undefined || String(value).trim().length === 0;
}

export function projectF3AdoGovernanceGroups(report: AcceptedF3Report): readonly F3AdoGovernanceGroup[] {
  const groups: F3AdoGovernanceGroup[] = [];
  const bySubsystem = new Map<string, { rows: F3AdoGovernanceRow[]; missingDrawingNumberCount: number; missingDimIdCount: number }>();
  for (const worksheet of report.worksheets) {
    for (const row of worksheet.rows) {
      const partSubsystem = partSubsystemLabel(row.partSubsystem);
      let group = bySubsystem.get(partSubsystem);
      if (group === undefined) {
        group = { rows: [], missingDrawingNumberCount: 0, missingDimIdCount: 0 };
        bySubsystem.set(partSubsystem, group);
        groups.push({ partSubsystem, factorCount: 0, missingDrawingNumberCount: 0, missingDimIdCount: 0, rows: group.rows });
      }
      group.rows.push(row);
      if (missingText(row.drawingNumber)) group.missingDrawingNumberCount += 1;
      if (missingText(row.dimId)) group.missingDimIdCount += 1;
    }
  }
  return groups.map((group) => {
    const aggregate = bySubsystem.get(group.partSubsystem)!;
    return Object.freeze({
      partSubsystem: group.partSubsystem,
      factorCount: aggregate.rows.length,
      missingDrawingNumberCount: aggregate.missingDrawingNumberCount,
      missingDimIdCount: aggregate.missingDimIdCount,
      rows: Object.freeze([...aggregate.rows]),
    });
  });
}