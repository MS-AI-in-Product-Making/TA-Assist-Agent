import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { inputMetadata } from "@ai-assist/product-language";
import { UploadPanel } from "./UploadPanel.js";

afterEach(cleanup);

describe("UploadPanel", () => {
  it.each(["en", "zh"] as const)("renders persistent %s workbook guidance", (language) => {
    const metadata = inputMetadata(language).workbook_file;
    render(<UploadPanel language={language} onUpload={vi.fn(async () => undefined)} />);

    const input = screen.getByLabelText(metadata.title);
    expect(input).toHaveAttribute("data-user-input-id", "workbook_file");
    expect(input).toHaveAttribute("aria-describedby", "workbook_file-guidance");
    expect(screen.getByText(metadata.example)).toBeVisible();
  });
});