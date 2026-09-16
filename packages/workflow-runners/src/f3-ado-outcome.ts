import { readFileSync } from "node:fs";
import path from "node:path";

import {
  drawingGovernanceResultV2Schema,
  drawingGovernanceResultV3Schema,
  type DrawingGovernanceResultV3,
} from "@ai-assist/contracts";

export interface PersistF3AdoTraceabilityInput {
  readonly f3Root: string;
  readonly reportPath?: string;
  readonly receipt: {
    readonly operation: "created" | "updated";
    readonly targetIdentity: {
      readonly organization: string;
      readonly project: string;
      readonly workItemId: number;
    };
    readonly verifiedAt: string;
  };
}

export function persistF3AdoTraceability(input: PersistF3AdoTraceabilityInput): DrawingGovernanceResultV3 {
  if (input.reportPath === undefined || input.reportPath.trim().length === 0) {
    throw new Error("Feature 3 current report path is required for structured ADO receipt persistence.");
  }
  const f3Root = path.resolve(input.f3Root);
  const reportPath = path.resolve(input.reportPath);
  const reportRelativePath = path.relative(f3Root, reportPath);
  if (reportRelativePath.startsWith("..") || path.isAbsolute(reportRelativePath)) {
    throw new Error("Feature 3 report path is outside the current writable root.");
  }
  const source = JSON.parse(readFileSync(reportPath, "utf8")) as unknown;
  const existingV3 = drawingGovernanceResultV3Schema.safeParse(source);
  if (existingV3.success) {
    if (matchesReceipt(existingV3.data, input.receipt)) return existingV3.data;
    throw new Error("Current Feature 3 v3 traceability does not match the verified Surface receipt.");
  }

  const legacy = drawingGovernanceResultV2Schema.parse(source);
  if (legacy.status === "input_rejected") {
    throw new Error("Cannot persist ADO traceability for an input_rejected Feature 3 report.");
  }
  if (!Number.isFinite(Date.parse(input.receipt.verifiedAt))) {
    throw new Error("Surface readback verifiedAt is invalid.");
  }

  const report = drawingGovernanceResultV3Schema.parse({
    ...legacy,
    modelVersion: "drawing-governance-v3",
    ado: {
      status: "updated",
      operation: input.receipt.operation,
      organization: input.receipt.targetIdentity.organization,
      project: input.receipt.targetIdentity.project,
      workItemId: input.receipt.targetIdentity.workItemId,
    },
  });
  return report;
}

function matchesReceipt(
  report: DrawingGovernanceResultV3,
  receipt: PersistF3AdoTraceabilityInput["receipt"],
): boolean {
  return report.status !== "input_rejected"
    && report.ado.status === "updated"
    && report.ado.operation === receipt.operation
    && report.ado.organization === receipt.targetIdentity.organization
    && report.ado.project === receipt.targetIdentity.project
    && report.ado.workItemId === receipt.targetIdentity.workItemId;
}