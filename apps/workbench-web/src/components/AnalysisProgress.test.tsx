import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AnalysisProgress } from "./AnalysisProgress.js";

afterEach(cleanup);

describe("AnalysisProgress", () => {
  it("does not render internal feature identifiers", () => {
    render(<AnalysisProgress
      stages={[
        { stageId: "prepare_workbook", label: "Prepare workbook", status: "completed", displayStatus: "Completed" },
        { stageId: "validate_analysis_inputs", label: "Validate analysis inputs", status: "running", displayStatus: "Running" },
        { stageId: "review_dimension_traceability", label: "Review dimension traceability", status: "pending", displayStatus: "Pending" },
        { stageId: "calculate_and_interpret", label: "Calculate and interpret tolerance performance", status: "pending", displayStatus: "Pending" },
        { stageId: "evaluate_and_publish", label: "Evaluate improvement options and publish report", status: "pending", displayStatus: "Pending" },
      ] as never}
      connected
    />);

    expect(screen.queryByText(/^F[0-7]$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/F\d\s+running/i)).not.toBeInTheDocument();
  });
});
