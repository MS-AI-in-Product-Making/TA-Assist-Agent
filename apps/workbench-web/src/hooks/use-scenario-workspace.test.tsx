import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkbenchApi } from "../api.js";
import type { FactorRowModel } from "../workspace-model.js";
import { projectSourceText } from "../web-projection.js";
import { useScenarioWorkspace } from "./use-scenario-workspace.js";

afterEach(() => vi.useRealTimers());

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useScenarioWorkspace", () => {
  it("calculates once 300ms after cell commit and retains the last valid result", async () => {
    vi.useFakeTimers();
    const calculateWorksheetWhatIf = vi.fn(async () => ({ calculationReference: "calc-1", calculationMetrics: metrics(), factorResults: [] }));
    const { result } = renderHook(() => useScenarioWorkspace({ api: { calculateWorksheetWhatIf } as unknown as WorkbenchApi, sessionId: "session", inputRevision: 1, factors: [factor()], onSave: async () => undefined }));

    act(() => { result.current.edit("sheet\u0000table\u00001", "upperTolerance", "0.25"); result.current.commit("sheet\u0000table\u00001"); });
    expect(calculateWorksheetWhatIf).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(calculateWorksheetWhatIf).toHaveBeenCalledTimes(1);
    expect(result.current.factorStates.get("sheet\u0000table\u00001")?.lastValidResult?.calculationReference).toBe("calc-1");
  });

  it("uses one stable draft id for calculate and save", async () => {
    vi.useFakeTimers();
    const calculateWorksheetWhatIf = vi.fn(async () => ({ calculationReference: "calc-1", calculationMetrics: metrics(), factorResults: [] }));
    const onSave = vi.fn(async () => undefined);
    const { result } = renderHook(() => useScenarioWorkspace({ api: { calculateWorksheetWhatIf } as unknown as WorkbenchApi, sessionId: "session", inputRevision: 1, factors: [factor()], onSave }));
    act(() => { result.current.edit(factor().key, "upperTolerance", "0.25"); result.current.commit(factor().key); });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await act(async () => { await result.current.save(factor().key); });
    expect(onSave.mock.calls[0]?.[0].draftId).toBe(calculateWorksheetWhatIf.mock.calls[0]?.[1]?.draftId);
  });

  it("does not calculate an unchanged factor and cancels timers on unmount", async () => {
    vi.useFakeTimers();
    const calculateWorksheetWhatIf = vi.fn();
    const rendered = renderHook(() => useScenarioWorkspace({ api: { calculateWorksheetWhatIf } as unknown as WorkbenchApi, sessionId: "session", inputRevision: 1, factors: [factor()], onSave: async () => undefined }));
    act(() => { rendered.result.current.commit(factor().key); });
    rendered.unmount();
    await vi.advanceTimersByTimeAsync(300);
    expect(calculateWorksheetWhatIf).not.toHaveBeenCalled();
  });

  it("requires explicit baseline direction confirmation for nominal edits", async () => {
    vi.useFakeTimers();
    const calculateWorksheetWhatIf = vi.fn(async () => ({ calculationReference: "calc-1", calculationMetrics: metrics(), factorResults: [] }));
    const unavailable = { ...factor(), directionAvailable: false, directionLabel: "unavailable" };
    const { result } = renderHook(() => useScenarioWorkspace({ api: { calculateWorksheetWhatIf } as unknown as WorkbenchApi, sessionId: "session", inputRevision: 1, factors: [unavailable], onSave: async () => undefined }));

    act(() => { result.current.edit(unavailable.key, "nominalValue", "1.1"); result.current.commit(unavailable.key); });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(calculateWorksheetWhatIf.mock.calls[0]?.[1]).toMatchObject({ signedDirectionEvidence: true, factorOverrides: [{ sourceRow: 1, nominalValue: 1.1 }] });
  });

  it("accumulates edits from multiple rows into one worksheet Scenario", async () => {
    vi.useFakeTimers();
    const second = { ...factor(), key: "sheet\u0000table\u00002", sourceRow: 2, factorName: "Second" };
    const calculateWorksheetWhatIf = vi.fn(async () => ({ calculationReference: "calc-sheet", calculationMetrics: metrics(), factorResults: [] }));
    const { result } = renderHook(() => useScenarioWorkspace({ api: { calculateWorksheetWhatIf } as unknown as WorkbenchApi, sessionId: "session", inputRevision: 1, factors: [factor(), second], onSave: async () => undefined }));
    act(() => { result.current.edit(factor().key, "upperTolerance", "0.25"); result.current.edit(second.key, "lowerTolerance", "-0.3"); result.current.commit(second.key); });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(calculateWorksheetWhatIf.mock.calls[0]?.[1]?.factorOverrides).toEqual([
      expect.objectContaining({ sourceRow: 1, upperTolerance: 0.25 }),
      expect.objectContaining({ sourceRow: 2, lowerTolerance: -0.3 }),
    ]);
  });

  it("throttles transient system specification previews and sends only system overrides", async () => {
    vi.useFakeTimers();
    const calculateWorksheetWhatIf = vi.fn(async () => ({ calculationReference: "calc-spec", calculationMetrics: metrics(), factorResults: [] }));
    const { result } = renderHook(() => useScenarioWorkspace({
      api: { calculateWorksheetWhatIf } as unknown as WorkbenchApi,
      sessionId: "session",
      inputRevision: 1,
      factors: [factor()],
      baselineSystem: { lowerSpecLimit: 1.4, upperSpecLimit: 1.6 },
      onSave: async () => undefined,
    }));

    act(() => {
      result.current.previewSystemSpecification("lowerSpecLimit", "1.35");
      result.current.previewSystemSpecification("lowerSpecLimit", "1.34");
    });

    expect(calculateWorksheetWhatIf).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(calculateWorksheetWhatIf).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });

    expect(calculateWorksheetWhatIf).toHaveBeenCalledTimes(1);
    expect(calculateWorksheetWhatIf.mock.calls[0]?.[1]).toMatchObject({
      worksheetName: "sheet",
      factorOverrides: [],
      systemSpecification: { lowerSpecLimit: 1.34, upperSpecLimit: 1.6 },
    });
    expect(result.current.systemValues.lowerSpecLimit).toBe("1.34");
  });

  it("commits one clamped system specification calculation on release and cancels pending previews", async () => {
    vi.useFakeTimers();
    const calculateWorksheetWhatIf = vi.fn(async () => ({ calculationReference: "calc-commit", calculationMetrics: metrics(), factorResults: [] }));
    const { result } = renderHook(() => useScenarioWorkspace({
      api: { calculateWorksheetWhatIf } as unknown as WorkbenchApi,
      sessionId: "session",
      inputRevision: 1,
      factors: [factor()],
      baselineSystem: { lowerSpecLimit: 1.4, upperSpecLimit: 1.6 },
      onSave: async () => undefined,
    }));

    act(() => {
      result.current.previewSystemSpecification("lowerSpecLimit", "1.8");
      result.current.commitSystemSpecification("lowerSpecLimit");
    });

    expect(calculateWorksheetWhatIf).toHaveBeenCalledTimes(1);
    expect(calculateWorksheetWhatIf.mock.calls[0]?.[1]).toMatchObject({
      factorOverrides: [],
      systemSpecification: { lowerSpecLimit: 1.599, upperSpecLimit: 1.6 },
    });
    expect(result.current.systemValues.lowerSpecLimit).toBe("1.599");
    expect(result.current.systemSpecificationError).toBe("LSL must stay below USL.");

    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(calculateWorksheetWhatIf).toHaveBeenCalledTimes(1);
  });

  it("keeps baseline system values immutable while previewing and committing a scenario draft", async () => {
    vi.useFakeTimers();
    const baselineSystem = Object.freeze({ lowerSpecLimit: 1.4, upperSpecLimit: 1.6 });
    const baselineContribution = factor().contribution;
    const calculateWorksheetWhatIf = vi.fn(async () => ({
      calculationReference: "calc-immutable",
      calculationMetrics: metrics(),
      factorResults: [{ worksheetName: "sheet", tableId: "table", sourceRow: 1, mean: 1.05, tolerance: 0.25, oneSigma: 0.06, contribution: 0.65 }],
    }));
    const { result } = renderHook(() => useScenarioWorkspace({
      api: { calculateWorksheetWhatIf } as unknown as WorkbenchApi,
      sessionId: "session",
      inputRevision: 1,
      factors: [factor()],
      baselineSystem,
      onSave: async () => undefined,
    }));

    act(() => {
      result.current.previewSystemSpecification("lowerSpecLimit", "1.35");
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(baselineSystem).toEqual({ lowerSpecLimit: 1.4, upperSpecLimit: 1.6 });
    expect(factor().contribution).toBe(baselineContribution);
    expect(result.current.factorStates.get(factor().key)?.calculated?.contribution).toBe(0.65);

    act(() => {
      result.current.commitSystemSpecification("lowerSpecLimit");
    });

    expect(baselineSystem).toEqual({ lowerSpecLimit: 1.4, upperSpecLimit: 1.6 });
    expect(factor().contribution).toBe(baselineContribution);
    expect(calculateWorksheetWhatIf).toHaveBeenCalledTimes(2);
  });

  it("does not persist a drag preview draft and issues exactly one calculate request on release", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn(async () => undefined);
    const calculateWorksheetWhatIf = vi.fn(async () => ({
      calculationReference: "calc-release",
      calculationMetrics: metrics(),
      factorResults: [{ worksheetName: "sheet", tableId: "table", sourceRow: 1, mean: 1.05, tolerance: 0.25, oneSigma: 0.06, contribution: 0.65 }],
    }));
    const { result } = renderHook(() => useScenarioWorkspace({
      api: { calculateWorksheetWhatIf } as unknown as WorkbenchApi,
      sessionId: "session",
      inputRevision: 1,
      factors: [factor()],
      baselineSystem: { lowerSpecLimit: 1.4, upperSpecLimit: 1.6 },
      onSave,
    }));

    act(() => {
      result.current.previewSystemSpecification("lowerSpecLimit", "1.35");
      result.current.previewSystemSpecification("lowerSpecLimit", "1.34");
      result.current.commitSystemSpecification("lowerSpecLimit");
    });

    expect(calculateWorksheetWhatIf).toHaveBeenCalledTimes(1);
    expect(calculateWorksheetWhatIf.mock.calls[0]?.[1]).toMatchObject({
      systemSpecification: { lowerSpecLimit: 1.34, upperSpecLimit: 1.6 },
      factorOverrides: [],
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.dirty).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(calculateWorksheetWhatIf).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves a committed system specification Scenario without requiring a factor patch", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn(async () => undefined);
    const calculateWorksheetWhatIf = vi.fn(async () => ({
      calculationReference: "calc-system-save",
      calculationMetrics: metrics(),
      factorResults: [],
    }));
    const { result } = renderHook(() => useScenarioWorkspace({
      api: { calculateWorksheetWhatIf } as unknown as WorkbenchApi,
      sessionId: "session",
      inputRevision: 3,
      factors: [factor()],
      baselineSystem: { lowerSpecLimit: 1.4, upperSpecLimit: 1.6 },
      onSave,
    }));

    await act(async () => {
      result.current.previewSystemSpecification("lowerSpecLimit", "1.35");
      await result.current.commitSystemSpecification("lowerSpecLimit");
    });
    await act(async () => { await result.current.save(factor().key); });

    expect(onSave).toHaveBeenCalledWith({
      draftId: calculateWorksheetWhatIf.mock.calls[0]?.[1]?.draftId,
      worksheetName: "sheet",
      inputRevision: 3,
      factorOverrides: [],
      systemSpecification: { lowerSpecLimit: 1.35, upperSpecLimit: 1.6 },
    });
  });

  it("keeps the last valid worksheet result when a system preview fails", async () => {
    vi.useFakeTimers();
    const calculateWorksheetWhatIf = vi.fn()
      .mockResolvedValueOnce({ calculationReference: "calc-1", calculationMetrics: metrics(), factorResults: [] })
      .mockRejectedValueOnce(new Error("preview failed"));
    const { result } = renderHook(() => useScenarioWorkspace({
      api: { calculateWorksheetWhatIf } as unknown as WorkbenchApi,
      sessionId: "session",
      inputRevision: 1,
      factors: [factor()],
      baselineSystem: { lowerSpecLimit: 1.4, upperSpecLimit: 1.6 },
      onSave: async () => undefined,
    }));

    act(() => {
      result.current.edit(factor().key, "upperTolerance", "0.25");
      result.current.commit(factor().key);
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(result.current.factorStates.get(factor().key)?.lastValidResult?.calculationReference).toBe("calc-1");

    act(() => {
      result.current.previewSystemSpecification("lowerSpecLimit", "1.35");
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });

    expect(calculateWorksheetWhatIf).toHaveBeenCalledTimes(2);
    expect(result.current.factorStates.get(factor().key)?.lastValidResult?.calculationReference).toBe("calc-1");
    expect(result.current.systemSpecificationError).toBe("Preview failed. The last valid result was kept.");
  });

  it("does not leave timers behind after a transient system preview is cancelled", () => {
    vi.useFakeTimers();
    const calculateWorksheetWhatIf = vi.fn(async () => ({ calculationReference: "calc-spec", calculationMetrics: metrics(), factorResults: [] }));
    const rendered = renderHook(() => useScenarioWorkspace({
      api: { calculateWorksheetWhatIf } as unknown as WorkbenchApi,
      sessionId: "session",
      inputRevision: 1,
      factors: [factor()],
      baselineSystem: { lowerSpecLimit: 1.4, upperSpecLimit: 1.6 },
      onSave: async () => undefined,
    }));

    act(() => {
      rendered.result.current.previewSystemSpecification("lowerSpecLimit", "1.35");
    });
    expect(vi.getTimerCount()).toBe(1);

    rendered.unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(calculateWorksheetWhatIf).not.toHaveBeenCalled();
  });

  it("does not report a late preview result after unmount", async () => {
    vi.useFakeTimers();
    const pending = deferred<{ calculationReference: string; calculationMetrics: ReturnType<typeof metrics>; factorResults: never[] }>();
    const calculateWorksheetWhatIf = vi.fn(() => pending.promise);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rendered = renderHook(() => useScenarioWorkspace({
      api: { calculateWorksheetWhatIf } as unknown as WorkbenchApi,
      sessionId: "session",
      inputRevision: 1,
      factors: [factor()],
      baselineSystem: { lowerSpecLimit: 1.4, upperSpecLimit: 1.6 },
      onSave: async () => undefined,
    }));

    act(() => {
      rendered.result.current.previewSystemSpecification("lowerSpecLimit", "1.35");
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(calculateWorksheetWhatIf).toHaveBeenCalledTimes(1);

    rendered.unmount();

    await act(async () => {
      pending.resolve({ calculationReference: "late-calc", calculationMetrics: metrics(), factorResults: [] });
      await pending.promise;
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

function factor(): FactorRowModel {
  return { key: "sheet\u0000table\u00001", worksheetName: "sheet", tableId: "table", sourceRow: 1, factorName: projectSourceText("间隙", "Gap"), partName: projectSourceText("部件", "Part"), partCategory: "CNC", unit: "mm", nominalValue: 1, nominalDisplay: "1.000", upperTolerance: 0.2, upperToleranceDisplay: "0.200", lowerTolerance: -0.2, lowerToleranceDisplay: "-0.200", longTermSafetyFactorDisplay: "1.0", sigmaLevelDisplay: "4.0", distribution: "Normal", meanDisplay: "1.000", toleranceDisplay: "0.200", oneSigmaDisplay: "0.050", contributionDisplay: "50.0%", capabilityResult: "ready", editable: true, additionalMeanShift: 0, directionLabel: "available", directionAvailable: true, contribution: 0.5, status: "pass" };
}

function metrics() {
  return { mean: 0, rssSigma: 0.1, cp: 1.2, cpkL: 1.1, cpkU: 1.2, cpk: 1.1, statisticalMargin: 0.2, worstCaseMargin: 0.1 };
}
