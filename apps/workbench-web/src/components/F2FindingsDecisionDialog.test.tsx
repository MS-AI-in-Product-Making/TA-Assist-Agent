import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { F2FindingsDecisionProjection } from "@ai-assist/contracts";
import { F2FindingsDecisionDialog } from "./F2FindingsDecisionDialog.js";

afterEach(cleanup);

describe("F2FindingsDecisionDialog", () => {
  it("explains mixed findings and continues with the exact ready set in report order", async () => {
    const onContinue = vi.fn(async () => undefined);
    render(<F2FindingsDecisionDialog projection={projection()} language="en" onContinue={onContinue} onReplace={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Review workbook findings" })).toBeInTheDocument();
    const ready = screen.getByRole("group", { name: "Ready Sheet" });
    expect(within(ready).getByText("Drawing Number is missing")).toBeInTheDocument();
    expect(within(ready).getByText(/can continue/i)).toBeInTheDocument();
    const blocked = screen.getByRole("group", { name: "Blocked Sheet" });
    expect(within(blocked).getByText("Tolerance loop stack-up image is missing")).toBeInTheDocument();
    expect(within(blocked).getByText(/will not enter engineering analysis/i)).toBeInTheDocument();
    const evidence = screen.getByText("Evidence details").closest("details");
    expect(evidence).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Evidence details"));
    expect(evidence).toHaveAttribute("open");
    expect(screen.getByText("Rows 8, 12")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue with ready worksheets" }));
    expect(onContinue).toHaveBeenCalledWith(["Ready Sheet"]);
  });

  it("keeps identifier-only worksheets actionable", () => {
    const base = projection();
    const identifierOnly = { ...base, worksheetFindings: [base.worksheetFindings[0]!], downstreamReadyWorksheetNames: ["Ready Sheet"] };
    render(<F2FindingsDecisionDialog projection={identifierOnly} language="en" onContinue={vi.fn()} onReplace={vi.fn()} />);

    expect(screen.getByText("DIM ID is missing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with ready worksheets" })).toBeEnabled();
  });

  it("disables continue when all worksheets are blocked and supports replace and cancel", async () => {
    const onReplace = vi.fn(async () => undefined);
    const onCancel = vi.fn();
    const base = projection();
    const allBlocked = { ...base, worksheetFindings: [base.worksheetFindings[1]!], downstreamReadyWorksheetNames: [] };
    render(<F2FindingsDecisionDialog projection={allBlocked} language="en" onContinue={vi.fn()} onReplace={onReplace} onCancel={onCancel} />);

    expect(screen.getByRole("button", { name: "Continue with ready worksheets" })).toBeDisabled();
    const file = new File(["workbook"], "replacement.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    fireEvent.change(screen.getByLabelText("Replace workbook"), { target: { files: [file] } });
    expect(onReplace).toHaveBeenCalledWith(file);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toBeEnabled());
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("uses the locked Chinese catalog", () => {
    render(<F2FindingsDecisionDialog projection={projection()} language="zh" onContinue={vi.fn()} onReplace={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "检查工作簿发现" })).toBeInTheDocument();
    expect(screen.getByText("Drawing Number 缺失")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "使用就绪工作表继续" })).toBeEnabled();
  });

  it("contains keyboard focus, supports Escape, and locks actions while submitting", async () => {
    let finish!: () => void;
    const onContinue = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const onCancel = vi.fn();
    render(<F2FindingsDecisionDialog projection={projection()} language="en" onContinue={onContinue} onReplace={vi.fn()} onCancel={onCancel} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();

    const continueButton = screen.getByRole("button", { name: "Continue with ready worksheets" });
    fireEvent.click(continueButton);
    fireEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledOnce();
    expect(continueButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    finish();
    await waitFor(() => expect(continueButton).toBeEnabled());
  });
});

function projection(): F2FindingsDecisionProjection {
  return {
    contractVersion: "f2-findings-decision-projection-v1",
    workbookHash: "a".repeat(64),
    inputRevision: 2,
    f2ReportArtifactId: "f2-report-2",
    f2ReportContentHash: "b".repeat(64),
    findingDigest: "c".repeat(64),
    worksheetFindings: [
      {
        contractVersion: "f2-worksheet-finding-projection-v1",
        worksheetName: "Ready Sheet",
        readiness: "downstream_ready",
        identifierWarnings: ["drawing_number_missing", "dim_id_missing"],
        blockers: [],
        sourceRows: [8, 12],
      },
      {
        contractVersion: "f2-worksheet-finding-projection-v1",
        worksheetName: "Blocked Sheet",
        readiness: "blocked",
        identifierWarnings: [],
        blockers: ["tolerance_path_image_missing"],
        sourceRows: [],
      },
    ],
    downstreamReadyWorksheetNames: ["Ready Sheet"],
  };
}