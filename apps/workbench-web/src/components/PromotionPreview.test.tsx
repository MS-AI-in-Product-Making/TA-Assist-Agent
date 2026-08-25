import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PromotionPreview } from "./PromotionPreview.js";

describe("PromotionPreview", () => {
  it("requires a new independent confirmation before promoting tolerance targets", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn();
    render(<PromotionPreview changes={[{
      factorName: "AJ center to C-bucket",
      baselineUpperTolerance: 0.05,
      baselineLowerTolerance: -0.05,
      draftUpperTolerance: 0.04,
      draftLowerTolerance: -0.04,
    }]} onConfirm={confirm} />);

    expect(screen.getByText("0.050 → 0.040")).toBeVisible();
    const button = screen.getByRole("button", { name: "确认 Optimization Targets" });
    expect(button).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "我确认仅提升公差变更" }));
    expect(button).toBeEnabled();
    await user.click(button);
    expect(confirm).toHaveBeenCalledOnce();
  });
});
