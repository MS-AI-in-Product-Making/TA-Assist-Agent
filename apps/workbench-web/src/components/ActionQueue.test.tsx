import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActionQueue } from "./ActionQueue.js";

describe("ActionQueue", () => {
  it("renders product capability and action labels without raw identifiers", () => {
    render(<ActionQueue items={[{ featureId: "F6", action: "confirm_optimization_targets", blocking: true }]} />);

    expect(screen.getByText("Design Optimization")).toBeVisible();
    expect(screen.getByText("Add or confirm optimization targets")).toBeVisible();
    expect(screen.queryByText("F6")).not.toBeInTheDocument();
    expect(screen.queryByText("confirm_optimization_targets")).not.toBeInTheDocument();
  });
});