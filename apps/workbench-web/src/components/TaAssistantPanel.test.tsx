import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaAssistantPanel } from "./TaAssistantPanel.js";

afterEach(cleanup);

describe("TaAssistantPanel", () => {
  it("shows English suggested prompts and a concise next-request context summary", async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(
      <TaAssistantPanel
        worksheetName="Analysis-A"
        factorName="Gap"
        turns={[]}
        disabled={false}
        onSubmit={onSubmit}
        requestContextChips={[
          { key: "knowledge", label: "Knowledge", value: "2 items", included: true, detail: "2 governed F0 knowledge items are available for validation." },
          { key: "loop-image", label: "Loop image", value: "Requested", included: true, detail: "The F1 loop image is requested for the next request." },
          { key: "factor-table", label: "Factor table", value: "4 rows", included: true, detail: "4 governed factor rows are available for validation." },
          { key: "baseline", label: "Baseline", value: "Available for validation", included: true, detail: "The current baseline run is available for validation." },
          { key: "scenario", label: "Scenario", value: "Not requested", included: false, detail: "No saved current-lineage Scenario is requested for the next request." },
        ]}
      />,
    );

    expect(screen.getByText("Current context")).toBeVisible();
    expect(screen.getByText("Next request context")).toBeVisible();
    expect(screen.getByText("Knowledge: 2 items")).toBeVisible();
    expect(screen.getByText("Loop image: Requested")).toBeVisible();
    expect(screen.getByText("Scenario: Not requested")).toBeVisible();
    expect(screen.getByRole("button", { name: "Summarize the current governed evidence" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Which factor is driving the current risk?" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Compare the baseline and saved Scenario" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Compare the baseline and saved Scenario" }));
    expect(screen.getByRole("textbox", { name: "Describe your request in natural language" })).toHaveValue("Compare the baseline and saved Scenario");
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Compare the baseline and saved Scenario"));
  });

  it("binds worksheet and factor context while suggestions only fill the draft", async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<TaAssistantPanel worksheetName="Analysis-A" factorName="Gap" turns={[]} disabled={false} onSubmit={onSubmit} />);

    expect(screen.getAllByText("Analysis-A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Gap").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Summarize the current governed evidence" }));
    expect(screen.getByRole("textbox", { name: "Describe your request in natural language" })).toHaveValue("Summarize the current governed evidence");
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Summarize the current governed evidence"));
  });
});
