import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { inputMetadata } from "@ai-assist/product-language";
import { WorksheetSelection } from "./WorksheetSelection.js";

afterEach(cleanup);

describe("WorksheetSelection", () => {
  it.each(["en", "zh"] as const)("renders persistent %s worksheet guidance", (language) => {
    const metadata = inputMetadata(language).worksheet_scope;
    render(<WorksheetSelection title="Select worksheets" description="Choose the analysis scope." actionLabel="Confirm" language={language} options={[{ worksheetName: "AJ_GAP", status: "available" }]} onSubmit={vi.fn(async () => undefined)} />);

    const input = screen.getByRole("checkbox", { name: "AJ_GAP" });
    expect(screen.getByRole("group", { name: metadata.title })).toBeVisible();
    expect(input).toHaveAttribute("data-user-input-id", "worksheet_scope");
    expect(input).toHaveAttribute("aria-describedby", "worksheet_scope-guidance");
    expect(screen.getByText(metadata.example)).toBeVisible();
  });
});