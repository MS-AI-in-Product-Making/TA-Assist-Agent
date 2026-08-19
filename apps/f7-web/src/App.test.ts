import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import App from "./App.vue";
import type { F7Client, F7SessionSnapshot } from "./api/f7-client";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

function createSnapshot(overrides: Partial<F7SessionSnapshot>): F7SessionSnapshot {
  return {
    contractId: "f7-analysis-result-v1",
    outputClassification: "confidential",
    sessionId: "session-01",
    status: "worksheet_selection",
    workbook: {
      fileName: "demo.xlsx",
      workbookContentHash: HASH_A,
    },
    selectedWorksheetNames: [],
    worksheetOptions: [
      {
        selectionIndex: 1,
        worksheetName: "Anonymous_TA",
        toleranceLoopDescription: "Loop A",
        worksheetKind: "analysis",
        source: {
          summarySheet: "Auto Summary",
          summaryRow: 10,
          worksheetAnchor: "Anonymous_TA!A1",
        },
      },
      {
        selectionIndex: 2,
        worksheetName: "Loop_B",
        toleranceLoopDescription: "Loop B",
        worksheetKind: "analysis",
        source: {
          summarySheet: "Auto Summary",
          summaryRow: 11,
          worksheetAnchor: "Loop_B!A1",
        },
      },
    ],
    factors: [],
    ...overrides,
  };
}

function factorSetupSnapshot() {
  return createSnapshot({
    status: "factor_setup",
    selectedWorksheetNames: ["Anonymous_TA"],
    factors: [
      {
        factorCandidate: {
          factorCandidateId: HASH_B,
          factorName: "C-cover height",
          excelSignedMean: -1.94,
          sourceCells: { mean: "Anonymous_TA!R15" },
          workbookUnitEvidence: "mm",
        },
      },
    ],
  });
}

function measurementEntrySnapshot() {
  return createSnapshot({
    status: "measurement_entry",
    selectedWorksheetNames: ["Anonymous_TA"],
    factors: [
      {
        factorCandidate: {
          factorCandidateId: HASH_B,
          factorName: "C-cover height",
          excelSignedMean: -1.94,
          sourceCells: { mean: "Anonymous_TA!R15" },
          workbookUnitEvidence: "mm",
        },
        setup: {
          factorCandidateId: HASH_B,
          loopCoefficient: -1,
          unit: "mm",
          confirmed: true,
        },
        evidence: {
          factorCandidateId: HASH_B,
          factorId: HASH_C,
          factorName: "C-cover height",
          unit: "mm",
          loopCoefficient: -1,
          physicalMean: 1.94,
          signedContributionMean: -1.94,
          sourceCells: { mean: "Anonymous_TA!R15" },
        },
        sourceMode: "MEASURED",
        input: { mode: "MEASURED" },
      },
    ],
  });
}

function phaseReadySnapshot() {
  return createSnapshot({
    status: "phase_1_ready",
    selectedWorksheetNames: ["Anonymous_TA"],
    factors: [
      {
        factorCandidate: {
          factorCandidateId: HASH_B,
          factorName: "C-cover height",
          excelSignedMean: -1.94,
          sourceCells: { mean: "Anonymous_TA!R15" },
          workbookUnitEvidence: "mm",
        },
        setup: {
          factorCandidateId: HASH_B,
          loopCoefficient: -1,
          unit: "mm",
          confirmed: true,
        },
        evidence: {
          factorCandidateId: HASH_B,
          factorId: HASH_C,
          factorName: "C-cover height",
          unit: "mm",
          loopCoefficient: -1,
          physicalMean: 1.94,
          signedContributionMean: -1.94,
          sourceCells: { mean: "Anonymous_TA!R15" },
        },
        sourceMode: "MEASURED",
        input: {
          mode: "MEASURED",
          dataset: {
            factorId: HASH_C,
            unit: "mm",
            structure: "UNORDERED_SAMPLE",
            sourceReference: "paste-01",
            msaStatus: "available",
            observations: [
              { originalRow: 1, value: 1.1, disposition: "included" },
              { originalRow: 2, value: 1.2, disposition: "included" },
            ],
            originalRowCount: 2,
            analyzedCount: 2,
          },
        },
        measurementPasteResult: {
          status: "ready",
          factorId: HASH_C,
          dataset: {
            factorId: HASH_C,
            unit: "mm",
            structure: "UNORDERED_SAMPLE",
            sourceReference: "paste-01",
            msaStatus: "available",
            observations: [
              { originalRow: 1, value: 1.1, disposition: "included" },
              { originalRow: 2, value: 1.2, disposition: "included" },
            ],
            originalRowCount: 2,
            analyzedCount: 2,
          },
          validation: {
            status: "ready",
            blockingIssues: [],
            advisoryIssues: [{ reason: "fit_uncertainty", factorId: HASH_C }],
          },
        },
        datasetValidation: {
          status: "ready",
          blockingIssues: [],
          advisoryIssues: [{ reason: "fit_uncertainty", factorId: HASH_C }],
        },
      },
    ],
  });
}

function createMockClient(initial: F7SessionSnapshot, nextByAction: Partial<Record<string, F7SessionSnapshot>> = {}): F7Client {
  let session = initial;
  return {
    importWorkbook: vi.fn(async () => {
      session = nextByAction.importWorkbook ?? session;
      return session;
    }),
    confirmWorksheet: vi.fn(async () => {
      session = nextByAction.confirmWorksheet ?? session;
      return session;
    }),
    confirmFactors: vi.fn(async () => {
      session = nextByAction.confirmFactors ?? session;
      return session;
    }),
    setFactorMode: vi.fn(async () => {
      session = nextByAction.setFactorMode ?? session;
      return session;
    }),
    pasteMeasurements: vi.fn(async () => {
      session = nextByAction.pasteMeasurements ?? session;
      return session;
    }),
    applyMeasurementDisposition: vi.fn(async () => {
      session = nextByAction.applyMeasurementDisposition ?? session;
      return session;
    }),
    getSession: vi.fn(async () => session),
  };
}

async function uploadWorkbook(wrapper: ReturnType<typeof mount>, file = new File([new Uint8Array([1, 2, 3])], "demo.xlsx")): Promise<void> {
  const input = wrapper.get("#workbook-file").element as HTMLInputElement;
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });
  await wrapper.get("#workbook-file").trigger("change");
}

describe("F7 workbench shell", () => {
  it("1) initial import UI has file label and no marketing landing", () => {
    const client = createMockClient(createSnapshot({ status: "worksheet_selection" }));
    const wrapper = mount(App, { props: { client } });
    expect(wrapper.text()).toContain("Import Workbook");
    expect(wrapper.find("label[for='workbook-file']").text()).toContain("Workbook file");
    expect(wrapper.text().toLowerCase()).not.toContain("hero");
    expect(wrapper.text().toLowerCase()).not.toContain("welcome");
  });

  it("2) import->worksheet_selection allows explicit pick and confirm with exact DTO", async () => {
    const client = createMockClient(createSnapshot({ status: "worksheet_selection" }), {
      importWorkbook: createSnapshot({ status: "worksheet_selection" }),
      confirmWorksheet: factorSetupSnapshot(),
    });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    expect(client.importWorkbook).toHaveBeenCalledTimes(1);

    await wrapper.get("input[type='radio'][name='worksheet-option'][value='Loop_B']").setValue(true);
    await wrapper.get("button").trigger("click");
    expect(client.confirmWorksheet).toHaveBeenCalledWith({
      sessionId: "session-01",
      workbookContentHash: HASH_A,
      selectedWorksheetName: "Loop_B",
      confirmed: true,
    });
  });

  it("2b) worksheet confirmation disables and does not call client when worksheet options are empty", async () => {
    const client = createMockClient(createSnapshot({ status: "worksheet_selection", worksheetOptions: [] }));
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    expect(wrapper.text()).toContain("No worksheet options available");
    const confirmButton = wrapper.get("button.action-button");
    expect(confirmButton.attributes("disabled")).toBeDefined();
    await confirmButton.trigger("click");
    expect(client.confirmWorksheet).not.toHaveBeenCalled();
  });

  it("3) factor_setup shows candidate signed mean/source cells and requires coefficient+unit before confirm", async () => {
    const client = createMockClient(factorSetupSnapshot(), {
      importWorkbook: factorSetupSnapshot(),
      confirmFactors: measurementEntrySnapshot(),
    });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    expect(wrapper.text()).toContain("-1.94");
    expect(wrapper.text()).toContain("Anonymous_TA!R15");
    expect(wrapper.text()).toContain("-1");
    expect(wrapper.text()).toContain("+1");
    expect(wrapper.find("td:nth-child(6)").text()).toBe("-");

    const unitInput = wrapper.get("input[id^='unit-']");
    await unitInput.setValue("mm");
    await wrapper.get("button.action-button").trigger("click");
    expect(client.confirmFactors).toHaveBeenCalledWith({
      sessionId: "session-01",
      confirmations: [{ factorCandidateId: HASH_B, loopCoefficient: -1, unit: "mm", confirmed: true }],
    });
  });

  it("4) normalized factor row shows coefficient/unit/physicalMean/source mode/sample/readiness", async () => {
    const client = createMockClient(phaseReadySnapshot(), { importWorkbook: phaseReadySnapshot() });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    expect(wrapper.text()).toContain("-1");
    expect(wrapper.text()).toContain("mm");
    expect(wrapper.text()).toContain("1.94");
    expect(wrapper.text()).toContain("MEASURED");
    expect(wrapper.text()).toContain("2");
    expect(wrapper.text().toLowerCase()).toContain("ready");
  });

  it("5) source mode uses fieldset/legend, measured shows paste panel, baseline route works", async () => {
    const measured = measurementEntrySnapshot();
    const baseline = createSnapshot({
      ...measured,
      factors: measured.factors.map((factor) => ({
        ...factor,
        sourceMode: "BASELINE_ASSUMPTION" as const,
        input: {
          mode: "BASELINE_ASSUMPTION" as const,
          baselineSampler: {
            samplerId: "NORMAL_LOCATION_SCALE_V1" as const,
            physicalMean: 1.94,
            standardDeviation: 0.025,
            support: "REAL" as const,
          },
        },
      })),
    });
    const client = createMockClient(measured, { importWorkbook: measured, setFactorMode: baseline });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    expect(wrapper.find("fieldset legend").text()).toContain("Source mode");
    expect(wrapper.text()).toContain("Measurement Input");
    await wrapper.get("input[value='BASELINE_ASSUMPTION']").trigger("change");
    expect(client.setFactorMode).toHaveBeenCalledWith({ sessionId: "session-01", factorId: HASH_C, mode: "BASELINE_ASSUMPTION" });
  });

  it("5b) factor coefficient radios are grouped by fieldset and legend", async () => {
    const client = createMockClient(factorSetupSnapshot(), {
      importWorkbook: factorSetupSnapshot(),
    });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    const fieldsets = wrapper.findAll("fieldset");
    expect(fieldsets.length).toBeGreaterThan(0);
    const coefficientFieldset = fieldsets.find((node) => node.text().includes("Loop coefficient"));
    expect(coefficientFieldset).toBeDefined();

    const coefficientRadios = wrapper.findAll(`input[type='radio'][name='coef-${HASH_B}']`);
    expect(coefficientRadios.length).toBe(2);
  });

  it("6) paste panel has structure/sourceRef/MSA/textarea and uses exact API; reason labels shown without raw marker", async () => {
    const blocked = createSnapshot({
      ...measurementEntrySnapshot(),
      factors: [
        {
          ...measurementEntrySnapshot().factors[0]!,
          measurementPasteResult: {
            status: "blocked",
            factorId: HASH_C,
            validation: {
              status: "blocked",
              blockingIssues: [{ reason: "invalid_rows_rejected", factorId: HASH_C, rowNumbers: [7] }],
              advisoryIssues: [{ reason: "outlier_candidate", factorId: HASH_C, rowNumbers: [12] }],
            },
          },
          datasetValidation: {
            status: "blocked",
            blockingIssues: [{ reason: "invalid_rows_rejected", factorId: HASH_C, rowNumbers: [7] }],
            advisoryIssues: [{ reason: "outlier_candidate", factorId: HASH_C, rowNumbers: [12] }],
          },
        },
      ],
    });
    const client = createMockClient(measurementEntrySnapshot(), { importWorkbook: measurementEntrySnapshot(), pasteMeasurements: blocked });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    await wrapper.get("select").setValue(HASH_C);
    await wrapper.findAll("select")[1]?.setValue("ORDERED_INDIVIDUALS");
    await wrapper.get("input[type='text']").setValue("source-ref-1");
    await wrapper.findAll("select")[2]?.setValue("available");
    await wrapper.get("textarea").setValue("1\n2\n3");
    await wrapper.get("button.action-button").trigger("click");
    expect(client.pasteMeasurements).toHaveBeenCalledWith({
      sessionId: "session-01",
      factorId: HASH_C,
      structure: "ORDERED_INDIVIDUALS",
      sourceReference: "source-ref-1",
      msaStatus: "available",
      text: "1\n2\n3",
    });

    expect(wrapper.text()).toContain("Invalid rows rejected");
    expect(wrapper.text()).toContain("Outlier candidate");
    expect(wrapper.text().toLowerCase()).not.toContain("rejected_marker");
  });

  it("7) disposition requires reason/operator/confirm and calls disposition route; original count visible", async () => {
    const withDataset = createSnapshot({
      ...measurementEntrySnapshot(),
      factors: [
        {
          ...measurementEntrySnapshot().factors[0]!,
          measurementPasteResult: {
            status: "ready",
            factorId: HASH_C,
            dataset: {
              factorId: HASH_C,
              unit: "mm",
              structure: "UNORDERED_SAMPLE",
              sourceReference: "p1",
              msaStatus: "available",
              observations: [{ originalRow: 1, value: 1.1, disposition: "included" }],
              originalRowCount: 24,
              analyzedCount: 1,
            },
            validation: { status: "ready", blockingIssues: [], advisoryIssues: [] },
          },
          datasetValidation: { status: "ready", blockingIssues: [], advisoryIssues: [] },
        },
      ],
    });
    const client = createMockClient(withDataset, { importWorkbook: withDataset });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);
    await wrapper.get("select").setValue(HASH_C);
    expect(wrapper.text()).toContain("Original row count: 24");

    const rowInput = wrapper.get("input[placeholder='e.g. 5,8,10']");
    const operatorInput = wrapper.findAll("input[type='text']")[2];
    await rowInput.setValue("5,8");
    await wrapper.findAll("select")[3]?.setValue("OUTLIER");
    await operatorInput?.setValue("op-9");
    await wrapper.get("button.warn-button").trigger("click");
    expect(client.applyMeasurementDisposition).toHaveBeenCalledWith({
      sessionId: "session-01",
      factorId: HASH_C,
      rowNumbers: [5, 8],
      action: "EXCLUDE",
      reason: "OUTLIER",
      operatorReference: "op-9",
      confirmed: true,
    });
  });

  it("7b) disposition row input normalizes sorted unique integers before emit", async () => {
    const withDataset = createSnapshot({
      ...measurementEntrySnapshot(),
      factors: [
        {
          ...measurementEntrySnapshot().factors[0]!,
          measurementPasteResult: {
            status: "ready",
            factorId: HASH_C,
            dataset: {
              factorId: HASH_C,
              unit: "mm",
              structure: "UNORDERED_SAMPLE",
              sourceReference: "p1",
              msaStatus: "available",
              observations: [{ originalRow: 1, value: 1.1, disposition: "included" }],
              originalRowCount: 24,
              analyzedCount: 1,
            },
            validation: { status: "ready", blockingIssues: [], advisoryIssues: [] },
          },
          datasetValidation: { status: "ready", blockingIssues: [], advisoryIssues: [] },
        },
      ],
    });
    const client = createMockClient(withDataset, { importWorkbook: withDataset });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    await wrapper.get("select").setValue(HASH_C);
    await wrapper.get("input[placeholder='e.g. 5,8,10']").setValue("8,5,8");
    await wrapper.findAll("select")[3]?.setValue("OUTLIER");
    await wrapper.findAll("input[type='text']")[2]?.setValue("op-9");
    await wrapper.get("button.warn-button").trigger("click");

    expect(client.applyMeasurementDisposition).toHaveBeenCalledWith({
      sessionId: "session-01",
      factorId: HASH_C,
      rowNumbers: [5, 8],
      action: "EXCLUDE",
      reason: "OUTLIER",
      operatorReference: "op-9",
      confirmed: true,
    });
  });

  it("7c) disposition rejects invalid row tokens locally and does not call client", async () => {
    const withDataset = createSnapshot({
      ...measurementEntrySnapshot(),
      factors: [
        {
          ...measurementEntrySnapshot().factors[0]!,
          measurementPasteResult: {
            status: "ready",
            factorId: HASH_C,
            dataset: {
              factorId: HASH_C,
              unit: "mm",
              structure: "UNORDERED_SAMPLE",
              sourceReference: "p1",
              msaStatus: "available",
              observations: [{ originalRow: 1, value: 1.1, disposition: "included" }],
              originalRowCount: 24,
              analyzedCount: 1,
            },
            validation: { status: "ready", blockingIssues: [], advisoryIssues: [] },
          },
          datasetValidation: { status: "ready", blockingIssues: [], advisoryIssues: [] },
        },
      ],
    });
    const client = createMockClient(withDataset, { importWorkbook: withDataset });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    await wrapper.get("select").setValue(HASH_C);
    await wrapper.get("input[placeholder='e.g. 5,8,10']").setValue("8,0,a");
    await wrapper.findAll("select")[3]?.setValue("OUTLIER");
    await wrapper.findAll("input[type='text']")[2]?.setValue("op-9");
    await wrapper.get("button.warn-button").trigger("click");

    expect(wrapper.text()).toContain("Enter valid positive integer row numbers");
    expect(client.applyMeasurementDisposition).not.toHaveBeenCalled();
  });

  it("8) phase_1_ready banner states readiness and no command controls for capability/fit/simulation/monte-carlo/recommendation", async () => {
    const client = createMockClient(phaseReadySnapshot(), { importWorkbook: phaseReadySnapshot() });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    expect(wrapper.text()).toContain("Phase 1 setup ready");
    expect(wrapper.text()).toContain("Capability analysis and Monte Carlo are not executed in this phase");
    const buttonLabels = wrapper.findAll("button").map((button) => button.text().toLowerCase());
    expect(buttonLabels.some((text) => text.includes("capability") || text.includes("fit") || text.includes("simulation") || text.includes("recommend"))).toBe(false);
  });

  it("9) workflow rail renders six exact steps, locks 3-6 as non-interactive, and marks step1 current initially", async () => {
    const client = createMockClient(createSnapshot({ status: "worksheet_selection" }), { importWorkbook: createSnapshot({ status: "worksheet_selection" }) });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    const stepLabels = wrapper.findAll("ol.workflow-steps > li .step-label").map((node) => node.text().trim());
    expect(stepLabels).toEqual([
      "Select worksheet",
      "Measurement data",
      "Capability analysis",
      "Distribution fit",
      "Monte Carlo",
      "Report",
    ]);

    const listItems = wrapper.findAll("ol.workflow-steps > li");
    expect(listItems).toHaveLength(6);
    expect(listItems[0]?.attributes("aria-current")).toBe("step");

    for (const index of [2, 3, 4, 5]) {
      const item = listItems[index];
      expect(item?.attributes("aria-disabled")).toBe("true");
      expect(item?.findAll("button, a, input, select, textarea")).toHaveLength(0);
      expect(item?.text().toLowerCase()).toContain("locked");
    }

    const buttonLabels = wrapper.findAll("button").map((button) => button.text());
    expect(buttonLabels.some((text) => /capability|distribution|monte carlo|report/i.test(text))).toBe(false);
  });

  it("9b) workflow rail marks step2 as current during measurement stage", async () => {
    const client = createMockClient(measurementEntrySnapshot(), { importWorkbook: measurementEntrySnapshot() });
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    const listItems = wrapper.findAll("ol.workflow-steps > li");
    expect(listItems).toHaveLength(6);
    expect(listItems[0]?.attributes("aria-current")).toBeUndefined();
    expect(listItems[1]?.attributes("aria-current")).toBe("step");
  });

  it("10) aria-live polite validation region and aria-busy with duplicate submission disabled", async () => {
    let resolveImport: ((value: F7SessionSnapshot) => void) | undefined;
    const client: F7Client = {
      importWorkbook: vi.fn(async () => await new Promise<F7SessionSnapshot>((resolve) => { resolveImport = resolve; })),
      confirmWorksheet: vi.fn(async () => factorSetupSnapshot()),
      confirmFactors: vi.fn(async () => measurementEntrySnapshot()),
      setFactorMode: vi.fn(async () => measurementEntrySnapshot()),
      pasteMeasurements: vi.fn(async () => measurementEntrySnapshot()),
      applyMeasurementDisposition: vi.fn(async () => measurementEntrySnapshot()),
      getSession: vi.fn(async () => createSnapshot({ status: "worksheet_selection" })),
    };
    const wrapper = mount(App, { props: { client } });
    await uploadWorkbook(wrapper);

    expect(wrapper.attributes("aria-busy")).toBe("true");
    expect(wrapper.get("#workbook-file").attributes("disabled")).toBeDefined();
    const resumeImport = resolveImport;
    if (!resumeImport) {
      throw new Error("import promise resolver is unavailable");
    }
    resumeImport(measurementEntrySnapshot());
    await vi.waitFor(() => {
      expect(wrapper.attributes("aria-busy")).toBe("false");
    });
    const live = wrapper.find("[aria-live='polite']");
    expect(live.exists()).toBe(true);
  });

  it("11) controlled error message visible and retry removes raw message leak", async () => {
    const client: F7Client = {
      importWorkbook: vi.fn()
        .mockRejectedValueOnce({
          code: "validation_error",
          summary: "F7 request is invalid.",
          suggestedAction: "Use the documented DTO.",
          affectedInputReferences: ["f7-local-api"],
          rawMessage: "secret stack trace",
        })
        .mockResolvedValueOnce(createSnapshot({ status: "worksheet_selection" })),
      confirmWorksheet: vi.fn(async () => factorSetupSnapshot()),
      confirmFactors: vi.fn(async () => measurementEntrySnapshot()),
      setFactorMode: vi.fn(async () => measurementEntrySnapshot()),
      pasteMeasurements: vi.fn(async () => measurementEntrySnapshot()),
      applyMeasurementDisposition: vi.fn(async () => measurementEntrySnapshot()),
      getSession: vi.fn(async () => createSnapshot({ status: "worksheet_selection" })),
    };
    const wrapper = mount(App, { props: { client } });
    const file = new File([new Uint8Array([1, 2, 3])], "demo.xlsx");
    await uploadWorkbook(wrapper, file);

    expect(wrapper.text()).toContain("F7 request is invalid.");
    expect(wrapper.text()).not.toContain("secret stack trace");

    await uploadWorkbook(wrapper, file);
    await vi.waitFor(() => {
      expect(wrapper.text()).not.toContain("F7 request is invalid.");
    });
  });
});