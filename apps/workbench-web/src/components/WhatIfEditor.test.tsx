import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WhatIfEditor } from "./WhatIfEditor.js";

const baseline = {
  worksheetName: "AJ_GAP",
  factorName: "AJ center to C-bucket",
  nominalValue: 0,
  upperTolerance: 0.05,
  lowerTolerance: -0.05,
  additionalMeanShift: 0,
  metrics: { mean: 0, rssSigma: 0.02, cp: 1.5, cpkL: 1.4, cpkU: 1.6, cpk: 1.4, statisticalMargin: 0.1, worstCaseMargin: 0.05 },
};

const calculated = {
  status: "completed" as const,
  calculationReference: "what-if:draft-a",
  metrics: { ...baseline.metrics, rssSigma: 0.018, cpk: 1.55 },
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("WhatIfEditor", () => {
  it("recalculates immediately on Enter and resets to baseline", async () => {
    const calculate = vi.fn(async () => calculated);
    render(<WhatIfEditor baseline={baseline} api={{ calculate, save: vi.fn() }} />);

    const upper = screen.getByLabelText("AJ center to C-bucket +Tol");
    fireEvent.change(upper, { target: { value: "0.040" } });
    fireEvent.keyDown(upper, { key: "Enter" });

    await waitFor(() => expect(calculate).toHaveBeenCalledWith(expect.objectContaining({ upperTolerance: 0.04 })));
    await waitFor(() => expect(screen.getByTestId("draft-cpk")).toHaveTextContent("1.550"));
    fireEvent.click(screen.getByRole("button", { name: "Restore baseline" }));
    expect(upper).toHaveValue(0.05);
  });

  it("debounces edits and keeps the previous valid result while input is invalid", async () => {
    vi.useFakeTimers();
    const calculate = vi.fn(async () => calculated);
    render(<WhatIfEditor baseline={baseline} api={{ calculate, save: vi.fn() }} />);

    const upper = screen.getByLabelText("AJ center to C-bucket +Tol");
    fireEvent.change(upper, { target: { value: "0.04" } });
    await act(async () => vi.advanceTimersByTimeAsync(249));
    expect(calculate).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(calculate).toHaveBeenCalledOnce();
    expect(screen.getByTestId("draft-cpk")).toHaveTextContent("1.550");

    fireEvent.change(upper, { target: { value: "" } });
    await act(async () => vi.advanceTimersByTimeAsync(250));
    expect(calculate).toHaveBeenCalledOnce();
    expect(screen.getByTestId("draft-cpk")).toHaveTextContent("1.550");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid numeric value");
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
  });

  it("ignores a stale calculation that resolves after the newest edit", async () => {
    let resolveFirst!: (result: typeof calculated) => void;
    const first = new Promise<typeof calculated>((resolve) => { resolveFirst = resolve; });
    const newest = { ...calculated, metrics: { ...calculated.metrics, cpk: 1.8 } };
    const calculate = vi.fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(newest);
    render(<WhatIfEditor baseline={baseline} api={{ calculate, save: vi.fn() }} />);

    const upper = screen.getByLabelText("AJ center to C-bucket +Tol");
    fireEvent.change(upper, { target: { value: "0.04" } });
    fireEvent.keyDown(upper, { key: "Enter" });
    fireEvent.change(upper, { target: { value: "0.03" } });
    fireEvent.keyDown(upper, { key: "Enter" });
    await waitFor(() => expect(screen.getByTestId("draft-cpk")).toHaveTextContent("1.800"));

    await act(async () => resolveFirst(calculated));
    expect(screen.getByTestId("draft-cpk")).toHaveTextContent("1.800");
  });

  it("surfaces calculation errors without discarding the last valid result", async () => {
    const calculate = vi.fn().mockResolvedValueOnce(calculated).mockRejectedValueOnce(new Error("offline"));
    render(<WhatIfEditor baseline={baseline} api={{ calculate, save: vi.fn() }} />);
    const upper = screen.getByLabelText("AJ center to C-bucket +Tol");
    fireEvent.change(upper, { target: { value: "0.04" } });
    fireEvent.keyDown(upper, { key: "Enter" });
    expect(await screen.findByTestId("draft-cpk")).toHaveTextContent("1.550");
    fireEvent.change(upper, { target: { value: "0.03" } });
    fireEvent.keyDown(upper, { key: "Enter" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Preview failed");
    expect(screen.getByTestId("draft-cpk")).toHaveTextContent("1.550");
  });
});
