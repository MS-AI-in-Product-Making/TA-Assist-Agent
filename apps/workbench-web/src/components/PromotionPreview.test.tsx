import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PromotionPreview } from "./PromotionPreview.js";

describe("PromotionPreview", () => {
  it("requires a new independent confirmation before promoting tolerance targets", () => {
    const confirm = vi.fn();
    render(<PromotionPreview changes={[{
      factorName: "AJ center to C-bucket",
      baselineUpperTolerance: 0.05,
      baselineLowerTolerance: -0.05,
      draftUpperTolerance: 0.04,
      draftLowerTolerance: -0.04,
    }]} onConfirm={confirm} />);

    expect(screen.getByText("0.050 → 0.040")).toBeVisible();
    const button = screen.getByRole("button", { name: "Confirm optimization targets" });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "I confirm that only tolerance changes will be promoted" }));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(confirm).toHaveBeenCalledOnce();
  });
});
