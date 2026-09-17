import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { F7MeasurementImportPreviewResponse, F7SessionSnapshot } from "../api/f7-client";
import MeasurementImportPanel from "./MeasurementImportPanel.vue";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

function createSession(): F7SessionSnapshot {
  return {
    contractId: "f7-analysis-result-v1",
    outputClassification: "confidential",
    sessionId: "session-01",
    status: "measurement_entry",
    workbook: {
      fileName: "demo.xlsx",
      workbookContentHash: HASH_A,
    },
    selectedWorksheetNames: ["Anonymous_TA"],
    worksheetOptions: [],
    systemSpecification: {
      status: "available",
      designNominal: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Design Nominal", sourceCell: "Anonymous_TA!P53", valueOrigin: "numeric_literal" },
      lowerSpecLimit: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Lower Spec Limit", sourceCell: "Anonymous_TA!P54", valueOrigin: "numeric_literal" },
      upperSpecLimit: { status: "available", actualValue: 1, displayValue: "1", sourceLabel: "Upper Spec Limit", sourceCell: "Anonymous_TA!P55", valueOrigin: "numeric_literal" },
      targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3", sourceLabel: "Target σ Level", sourceCell: "Anonymous_TA!P56", valueOrigin: "numeric_literal" },
      additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
      volume: { status: "available", actualValue: 1000000, displayValue: "1000000", sourceLabel: "Volume", sourceCell: "Anonymous_TA!X56", valueOrigin: "numeric_literal" },
    },
    factors: [
      {
        factorCandidate: {
          workbookContentHash: HASH_A,
          worksheetName: "Anonymous_TA",
          tableId: "table-1",
          sourceRow: 15,
          sourceCells: { mean: "Anonymous_TA!R15" },
          factorCandidateId: HASH_B,
          factorName: "Cross-zero factor",
          workbookUnitEvidence: "mm",
          excelSignedMean: -0.02,
          designNominal: -0.02,
          upperTolerance: 0.05,
          lowerTolerance: -0.02,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          standardDeviation: 0.01,
          distribution: "Normal",
          lowerSpecLimit: 0,
          upperSpecLimit: 0.03,
        },
        setup: {
          factorCandidateId: HASH_B,
          designNominal: -0.02,
          upperTolerance: 0.05,
          lowerTolerance: -0.02,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
          confirmed: true,
        },
        evidence: {
          workbookContentHash: HASH_A,
          worksheetName: "Anonymous_TA",
          tableId: "table-1",
          sourceRow: 15,
          sourceCells: { mean: "Anonymous_TA!R15" },
          factorCandidateId: HASH_B,
          factorId: HASH_C,
          factorName: "Cross-zero factor",
          unit: "mm",
          designNominal: -0.02,
          upperTolerance: 0.05,
          lowerTolerance: -0.02,
          loopCoefficient: 1,
          physicalMean: 0.02,
          signedContributionMean: -0.02,
          lowerSpecLimit: 0,
          upperSpecLimit: 0.03,
        },
        sourceMode: "MEASURED",
        input: { mode: "MEASURED" },
      },
    ],
  } as unknown as F7SessionSnapshot;
}

function createPreview(status: "ready" | "blocked"): F7MeasurementImportPreviewResponse {
  const readyFactor = {
    factorId: HASH_C,
    factorName: "Cross-zero factor",
    unit: "mm",
    structure: "ORDERED_INDIVIDUALS" as const,
    sampleCount: 32,
    status: "ready" as const,
    replacesExistingFactor: true,
    diagnostics: [],
    warnings: [
      {
        reason: "sample_validation_failure" as const,
        factorId: HASH_C,
        factorName: "Cross-zero factor",
        displayMessage: "Factor specification crosses zero; physical LSL is 0.",
      },
    ],
    validation: {
      status: "ready" as const,
      blockingIssues: [],
      advisoryIssues: [],
      candidateEligibility: {
        normal: "eligible" as const,
        lognormal: "eligible" as const,
        weibull: "eligible" as const,
        gamma: "eligible" as const,
        uniform: "eligible_with_boundary_warning" as const,
      },
    },
  };
  const blockedFactor = {
    factorId: HASH_B,
    factorName: "Blocked factor",
    unit: "mm",
    structure: "RATIONAL_SUBGROUP" as const,
    rationalSubgroupConfig: {
      subgroupSize: 5,
      estimator: "RANGE_D2" as const,
    },
    sampleCount: 7,
    status: "blocked" as const,
    replacesExistingFactor: false,
    diagnostics: [
      {
        reason: "negative_physical_measurement" as const,
        factorId: HASH_B,
        factorName: "Blocked factor",
        sheetCell: "Measurements!C12",
        rowNumber: 12,
        value: -0.1,
        displayMessage: "Measurements must be nonnegative.",
      },
    ],
    warnings: [],
    validation: {
      status: "blocked" as const,
      blockingIssues: [
        {
          reason: "sample_count_below_minimum" as const,
          factorId: HASH_B,
          rowNumbers: [12],
        },
      ],
      advisoryIssues: [],
      candidateEligibility: {
        normal: "eligible" as const,
        lognormal: "ineligible_nonpositive" as const,
        weibull: "ineligible_nonpositive" as const,
        gamma: "ineligible_nonpositive" as const,
        uniform: "eligible_with_boundary_warning" as const,
      },
    },
  };
  const blockedDiagnostic = {
    reason: "negative_physical_measurement" as const,
    factorId: HASH_B,
    factorName: "Blocked factor",
    sheetCell: "Measurements!C12",
    rowNumber: 12,
    value: -0.1,
    displayMessage: "Blocked factor Measurements!C12 must be nonnegative.",
  };
  return {
    previewId: "preview-01",
    expiresAt: "2026-09-16T08:15:00.000Z",
    sessionStateDigest: HASH_A,
    factorSetDigest: HASH_B,
    status,
    factorCount: status === "ready" ? 1 : 2,
    replacementFactorIds: [HASH_C],
    factors: status === "ready" ? [readyFactor] : [readyFactor, blockedFactor],
    diagnostics: status === "ready" ? [] : [blockedDiagnostic],
    readyFactorCount: 1,
    blockedFactorCount: status === "ready" ? 0 : 1,
    replacementCount: 1,
    totalSampleCount: status === "ready" ? 32 : 39,
    diagnosticCount: status === "ready" ? 0 : 1,
  } satisfies F7MeasurementImportPreviewResponse;
}

describe("MeasurementImportPanel", () => {
  it("connects the exclusive input mode group to the Monte Carlo next action", async () => {
    const wrapper = mount(MeasurementImportPanel, {
      props: {
        session: createSession(),
        preview: null,
        busy: false,
        action: null,
        mode: "import",
        successMessage: null,
        monteCarloReady: false,
      },
    });

    expect(wrapper.get("[data-measurement-process-flow]").exists()).toBe(true);
    expect(wrapper.get("[data-measurement-entry-choice]").findAll("[role='tab']")).toHaveLength(2);
    expect(wrapper.findAll("[role='tab'][aria-selected='true']")).toHaveLength(1);
    expect(wrapper.get("[data-measurement-flow-arrow]").attributes("aria-hidden")).toBe("true");

    const nextAction = wrapper.get("[data-open-monte-carlo-flow]");
    expect(nextAction.text()).toContain("Monte Carlo Calculation & Report");
    expect(nextAction.attributes("disabled")).toBeDefined();

    await wrapper.setProps({ monteCarloReady: true });
    expect(nextAction.attributes("disabled")).toBeUndefined();
    await nextAction.trigger("click");
    expect(wrapper.emitted("open-monte-carlo")).toEqual([[]]);
  });

  it("renders keyboard-accessible segmented tabs, moves focus, and hides the import surface in individual mode", async () => {
    const wrapper = mount(MeasurementImportPanel, {
      attachTo: document.body,
      props: {
        session: createSession(),
        preview: null,
        busy: false,
        action: null,
        mode: "import",
        successMessage: null,
      },
    });

    const tabs = wrapper.findAll("[role='tab']");
    expect(tabs).toHaveLength(2);
    expect(wrapper.get("section").attributes("aria-label")).toBe("Measurement input");
    expect(wrapper.get("[data-measurement-entry-mode-label]").text()).toBe("Measurement Input Mode");
    expect(tabs.map((tab) => tab.text())).toEqual(["Excel Bulk Import", "Web Factor Entry"]);
    expect(wrapper.get("[role='tab'][aria-selected='true']").text()).toBe("Excel Bulk Import");

    await wrapper.get("[role='tab'][aria-selected='true']").trigger("keydown", { key: "ArrowRight" });

    expect(wrapper.emitted("mode-change")).toEqual([[("individual")]]);
    expect(document.activeElement).toBe(tabs[1]!.element);

    await wrapper.setProps({ mode: "individual" });
    expect(wrapper.find("[data-measurement-import-surface]").exists()).toBe(false);
    expect(tabs[1]!.attributes("aria-controls")).toBe("measurement-entry-individual-panel");
    wrapper.unmount();
  });

  it("opens a two-step dialog and allows upload before downloading while requiring the Step 1 template", async () => {
    const wrapper = mount(MeasurementImportPanel, {
      attachTo: document.body,
      props: {
        session: createSession(),
        preview: null,
        busy: false,
        action: null,
        mode: "import",
        successMessage: null,
      },
    });

    expect(wrapper.find("[data-measurement-import-dialog]").exists()).toBe(false);
    await wrapper.get("[role='tab'][aria-selected='true']").trigger("click");

    const dialog = wrapper.get("[data-measurement-import-dialog]");
    expect(dialog.attributes("aria-modal")).toBe("true");
    expect(dialog.text()).toContain("Step 1");
    expect(dialog.text()).toContain("Download Template");
    expect(dialog.text()).toContain("Step 2");
    expect(dialog.text()).toContain("Upload Completed File");
    expect(dialog.text()).toContain("based on the Step 1 template");
    expect(wrapper.get("[data-upload-measurement-workbook]").attributes("disabled")).toBeUndefined();
    expect(wrapper.get("[data-measurement-import-file]").attributes("disabled")).toBeUndefined();

    await wrapper.get("[data-download-measurement-template]").trigger("click");
    expect(wrapper.emitted("download")).toHaveLength(1);

    await wrapper.get("[data-close-measurement-import]").trigger("click");
    expect(wrapper.find("[data-measurement-import-dialog]").exists()).toBe(false);
    expect(wrapper.emitted("close-import")).toHaveLength(1);
    wrapper.unmount();
  });

  it("shows worksheet identity, factor count, accessible import actions, xlsx restriction, and busy states", async () => {
    const wrapper = mount(MeasurementImportPanel, {
      props: {
        session: createSession(),
        preview: null,
        busy: false,
        action: null,
        mode: "import",
        successMessage: null,
      },
    });

    await wrapper.get("[role='tab'][aria-selected='true']").trigger("click");
    await wrapper.setProps({ busy: true, action: "previewMeasurementImport" });

    expect(wrapper.text()).toContain("demo.xlsx");
    expect(wrapper.text()).toContain("Anonymous_TA");
    expect(wrapper.text()).toContain("1 Factor");
    expect(wrapper.get("[data-download-measurement-template]").attributes("aria-label")).toContain("Download measurement template");
    expect(wrapper.get("[data-download-measurement-template]").attributes("title")).toContain("Download measurement template");
    expect(wrapper.get("[data-download-measurement-template]").text()).toBe("Download Template");
    expect(wrapper.get("[data-upload-measurement-workbook]").attributes("aria-label")).toContain("Upload completed measurement workbook");
    expect(wrapper.get("[data-upload-measurement-workbook]").text()).toBe("Upload Completed File");
    expect(wrapper.get("input[type='file']").attributes("accept")).toBe(".xlsx");
    expect(wrapper.get("input[type='file']").attributes("tabindex")).toBe("-1");
    expect(wrapper.get("[data-upload-measurement-workbook]").attributes("disabled")).toBeDefined();
  });

  it("focuses the review heading and renders factor rows, structure, readiness, cross-zero warning, and diagnostics", async () => {
    const wrapper = mount(MeasurementImportPanel, {
      attachTo: document.body,
      props: {
        session: createSession(),
        preview: null,
        busy: false,
        action: null,
        mode: "import",
        successMessage: null,
      },
    });

    await wrapper.setProps({ preview: createPreview("blocked") });

    const heading = wrapper.get("[data-measurement-import-review-heading]");
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(heading.element);
    });
    expect(wrapper.text()).toContain("Cross-zero factor");
    expect(wrapper.text()).toContain("Blocked factor");
    expect(wrapper.text()).toContain("ORDERED_INDIVIDUALS");
    expect(wrapper.text()).toContain("RATIONAL_SUBGROUP");
    expect(wrapper.text()).toContain("ready");
    expect(wrapper.text()).toContain("blocked");
    expect(wrapper.get("[data-import-warning='cross-zero']").text()).toContain("LSL 0");
    expect(wrapper.get("[data-import-warning='cross-zero']").classes()).toContain("is-danger");
    expect(wrapper.text()).toContain("Measurements!C12");
    expect(wrapper.text()).toContain("Measurements must be nonnegative.");
    const blockingDiagnostics = wrapper.findAll("[data-import-diagnostic='blocking']");
    expect(blockingDiagnostics).toHaveLength(1);
    expect(blockingDiagnostics.every((diagnostic) => diagnostic.classes().includes("is-danger"))).toBe(true);
    expect(blockingDiagnostics.every((diagnostic) => diagnostic.find("svg.lucide-triangle-alert").exists())).toBe(true);
    expect(wrapper.get("[data-confirm-measurement-import]").attributes("disabled")).toBeDefined();
  });

  it("shows replacement copy, emits download upload confirm cancel once, and announces success", async () => {
    const wrapper = mount(MeasurementImportPanel, {
      props: {
        session: createSession(),
        preview: createPreview("ready"),
        busy: false,
        action: null,
        mode: "import",
        successMessage: "Imported 1 measured dataset.",
      },
    });

    expect(wrapper.text()).toContain("1 replacement");
    expect(wrapper.get("[data-confirm-measurement-import]").text()).toContain("Confirm import");
    expect(wrapper.get("[data-confirm-measurement-import]").attributes("disabled")).toBeUndefined();
    expect(wrapper.get("[data-measurement-import-success]").text()).toContain("Imported 1 measured dataset.");

    await wrapper.get("[data-download-measurement-template]").trigger("click");
    const fileInput = wrapper.get("input[type='file']");
    const file = new File([new Uint8Array([1, 2, 3])], "measurements.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    Object.defineProperty(fileInput.element, "files", {
      configurable: true,
      value: [file],
    });
    await fileInput.trigger("change");
    await wrapper.get("[data-confirm-measurement-import]").trigger("click");
    await wrapper.get("[data-cancel-measurement-import]").trigger("click");

    expect(wrapper.emitted("download")).toHaveLength(1);
    expect(wrapper.emitted("upload")).toEqual([[file]]);
    expect(wrapper.emitted("confirm")).toHaveLength(1);
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });
});