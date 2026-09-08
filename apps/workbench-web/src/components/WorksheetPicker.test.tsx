import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorksheetPicker } from "./WorksheetPicker.js";

describe("WorksheetPicker", () => {
  it("links worksheet search to persistent registered guidance", () => {
    render(<WorksheetPicker worksheets={[]} onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox", { name: "Worksheet search" });
    expect(input).toHaveAttribute("data-user-input-id", "worksheet_search");
    expect(input).toHaveAttribute("aria-describedby", "worksheet_search-guidance");
    expect(screen.getByText(/Search for the worksheet to review/)).toBeVisible();
  });
});