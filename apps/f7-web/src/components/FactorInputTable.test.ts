import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { F7SessionSnapshot } from "../api/f7-client";
import type { DimensionChainReportProjection } from "../assumption-results-pdf-evidence";
import FactorInputTable from "./FactorInputTable.vue";

const STYLE_SOURCE = readFileSync(join(process.cwd(), "apps/f7-web/src/style.css"), "utf8");
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

function createSession(overrides: Partial<F7SessionSnapshot>): F7SessionSnapshot {
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
      designNominal: { status: "available", actualValue: 1, displayValue: "1", sourceLabel: "*Design Nominal ►", sourceCell: "Sheet!P53", valueOrigin: "numeric_literal" },
      lowerSpecLimit: { status: "available", actualValue: -0.2, displayValue: "-0.2", sourceLabel: "*Lower Spec Limit ►", sourceCell: "Sheet!P54", valueOrigin: "numeric_literal" },
      upperSpecLimit: { status: "available", actualValue: 0.2, displayValue: "0.2", sourceLabel: "*Upper Spec Limit ►", sourceCell: "Sheet!P55", valueOrigin: "numeric_literal" },
      targetSigmaLevel: { status: "available", actualValue: 3, displayValue: "3", sourceLabel: "*Target σ Level ►", sourceCell: "Sheet!P56", valueOrigin: "numeric_literal" },
      additionalMeanShift: { status: "available", actualValue: 0, displayValue: "0", sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
      volume: { status: "available", actualValue: 1000000, displayValue: "1000000", sourceLabel: "Volume ►", sourceCell: "Sheet!X56", valueOrigin: "numeric_literal" },
    },
    factors: [
      {
        factorCandidate: {
          workbookContentHash: HASH_A,
          worksheetName: "Anonymous_TA",
          tableId: "table-1",
          sourceRow: 15,
          sourceCells: {
            nominalValue: "Sheet!L15",
          },
          factorCandidateId: HASH_B,
          factorName: "Factor A",
          workbookUnitEvidence: "mm",
          excelSignedMean: 1,
          designNominal: 1,
          upperTolerance: 0.1,
          lowerTolerance: -0.1,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          standardDeviation: 0.025,
          distribution: "Normal",
          lowerSpecLimit: -0.2,
          upperSpecLimit: 0.2,
        },
        setup: {
          factorCandidateId: HASH_B,
          designNominal: 1,
          upperTolerance: 0.1,
          lowerTolerance: -0.1,
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
          sourceCells: {
            nominalValue: "Sheet!L15",
          },
          factorCandidateId: HASH_B,
          factorId: HASH_C,
          factorName: "Factor A",
          unit: "mm",
          unitSource: "workbook",
          designNominal: 1,
          upperTolerance: 0.1,
          lowerTolerance: -0.1,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
          calculatedMean: 1,
          tolerance: 0.1,
          oneSigma: 0.025,
          percentContributionToSigma: 1,
          loopCoefficient: 1,
          physicalMean: 1,
          signedContributionMean: 1,
          baselineSampler: {
            samplerId: "NORMAL_LOCATION_SCALE_V1",
            physicalMean: 1,
            standardDeviation: 0.025,
            support: "REAL",
          },
          lowerSpecLimit: -0.2,
          upperSpecLimit: 0.2,
        },
        sourceMode: "BASELINE_ASSUMPTION",
        input: {
          mode: "BASELINE_ASSUMPTION",
          baselineSampler: {
            samplerId: "NORMAL_LOCATION_SCALE_V1",
            physicalMean: 1,
            standardDeviation: 0.025,
            support: "REAL",
          },
        },
      },
    ],
    ...overrides,
  };
}

function projection(status: "generated" | "fallback", sourceSignature: string): DimensionChainReportProjection {
  if (status === "fallback") {
    return {
      status,
      sourceSignature,
    };
  }
  return {
    status,
    sourceSignature,
    orientation: "horizontal",
    factors: [
      {
        id: HASH_B,
        itemNumber: 1,
        name: "Factor A",
        designNominal: 1,
        upperTolerance: 0.1,
        lowerTolerance: -0.1,
        longTermSafetyFactor: 1,
        sigmaLevel: 4,
        distribution: "Normal",
      },
    ],
    manualLayout: {
      boundaryOffsets: {},
      laneOffsets: {},
    },
    reversedFactorIds: [],
    closureDirection: "start-to-end",
  };
}

describe("FactorInputTable engineering evidence event", () => {
  it("emits undefined while setup is editable", () => {
    const wrapper = mount(FactorInputTable, {
      props: {
        session: createSession({ status: "factor_setup" }),
        busy: false,
        editingSetup: true,
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    });

    expect(wrapper.find("#f7-test-style").exists()).toBe(false);
    const style = document.createElement("style");
    style.id = "f7-test-style";
    style.textContent = STYLE_SOURCE;
    document.head.appendChild(style);

    const emitted = wrapper.emitted("engineering-evidence-change");
    expect(emitted).toHaveLength(1);
    expect(emitted?.[0]?.[0]).toBeUndefined();

    style.remove();
    wrapper.unmount();
  });

  it("emits engineering evidence after receiving generated chain projection in non-editing state", async () => {
    const wrapper = mount(FactorInputTable, {
      props: {
        session: createSession({ status: "measurement_entry" }),
        busy: false,
        editingSetup: false,
      },
      attachTo: document.body,
    });

    const chain = wrapper.getComponent({ name: "DimensionChainPanel" });
    const sourceSignature = chain.props("sourceSignature") as string;
    const emitted = wrapper.emitted("engineering-evidence-change");
    const initialEvidence = emitted?.at(-1)?.[0] as Record<string, unknown> | undefined;
    expect(initialEvidence).toBeTruthy();
    expect(initialEvidence?.dimensionChain).toEqual({
      status: "fallback",
      sourceSignature,
    });

    await chain.vm.$emit("report-projection-change", {
      status: "generated",
      sourceSignature,
      orientation: "horizontal",
      factors: [
        {
          id: HASH_B,
          itemNumber: 1,
          name: "Factor A",
          designNominal: 1,
          upperTolerance: 0.1,
          lowerTolerance: -0.1,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
        },
      ],
      manualLayout: {
        boundaryOffsets: {},
        laneOffsets: {},
      },
      reversedFactorIds: [],
      closureDirection: "start-to-end",
    });
    await wrapper.vm.$nextTick();

    const latest = wrapper.emitted("engineering-evidence-change")?.at(-1)?.[0] as Record<string, unknown> | undefined;
    expect(latest).toBeTruthy();
    expect(latest?.dimensionChain).toEqual(expect.objectContaining({
      status: "generated",
      sourceSignature,
      orientation: "horizontal",
    }));
  });

  it("re-emits evidence when additional mean shift changes", async () => {
    const wrapper = mount(FactorInputTable, {
      props: {
        session: createSession({ status: "measurement_entry" }),
        busy: false,
        editingSetup: false,
      },
    });

    const chain = wrapper.getComponent({ name: "DimensionChainPanel" });
    await chain.vm.$emit("report-projection-change", {
      status: "generated",
      sourceSignature: "signature-1",
      orientation: "horizontal",
      factors: [
        {
          id: HASH_B,
          itemNumber: 1,
          name: "Factor A",
          designNominal: 1,
          upperTolerance: 0.1,
          lowerTolerance: -0.1,
          longTermSafetyFactor: 1,
          sigmaLevel: 4,
          distribution: "Normal",
        },
      ],
      manualLayout: {
        boundaryOffsets: {},
        laneOffsets: {},
      },
      reversedFactorIds: [],
      closureDirection: "start-to-end",
    });
    await wrapper.vm.$nextTick();

    const before = wrapper.emitted("engineering-evidence-change")?.length ?? 0;
    await wrapper.get("#additional-mean-shift").setValue("0.123");
    await wrapper.vm.$nextTick();

    const after = wrapper.emitted("engineering-evidence-change")?.length ?? 0;
    expect(after).toBeGreaterThan(before);
  });

  it("builds engineering evidence from fallback chain for initial, stale, and reset fallback states", async () => {
    const wrapper = mount(FactorInputTable, {
      props: {
        session: createSession({ status: "measurement_entry" }),
        busy: false,
        editingSetup: false,
      },
    });

    await wrapper.vm.$nextTick();
    const chain = wrapper.getComponent({ name: "DimensionChainPanel" });

    const currentSourceSignature = chain.props("sourceSignature") as string;
    await chain.vm.$emit("report-projection-change", projection("fallback", currentSourceSignature));
    await wrapper.vm.$nextTick();
    const initialFallbackEvidence = wrapper.emitted("engineering-evidence-change")?.at(-1)?.[0] as Record<string, unknown> | undefined;
    expect(initialFallbackEvidence).toBeTruthy();
    expect(initialFallbackEvidence?.dimensionChain).toEqual({
      status: "fallback",
      sourceSignature: currentSourceSignature,
    });

    await chain.vm.$emit("report-projection-change", projection("generated", currentSourceSignature));
    await wrapper.vm.$nextTick();
    await chain.vm.$emit("report-projection-change", projection("fallback", currentSourceSignature));
    await wrapper.vm.$nextTick();
    const staleFallbackEvidence = wrapper.emitted("engineering-evidence-change")?.at(-1)?.[0] as Record<string, unknown> | undefined;
    expect(staleFallbackEvidence?.dimensionChain).toEqual({
      status: "fallback",
      sourceSignature: currentSourceSignature,
    });

    await wrapper.setProps({
      session: createSession({
        status: "measurement_entry",
        factors: [
          {
            ...createSession({}).factors[0]!,
            setup: createSession({}).factors[0]!.setup,
            evidence: createSession({}).factors[0]!.evidence,
          },
        ],
      }),
    });
    await wrapper.vm.$nextTick();
    const resetChain = wrapper.getComponent({ name: "DimensionChainPanel" });
    const resetSourceSignature = resetChain.props("sourceSignature") as string;
    await resetChain.vm.$emit("report-projection-change", projection("fallback", resetSourceSignature));
    await wrapper.vm.$nextTick();
    const resetFallbackEvidence = wrapper.emitted("engineering-evidence-change")?.at(-1)?.[0] as Record<string, unknown> | undefined;
    expect(resetFallbackEvidence).toBeTruthy();
    expect(resetFallbackEvidence?.dimensionChain).toEqual({
      status: "fallback",
      sourceSignature: resetSourceSignature,
    });
  });

  it("clears on session replacement and only consumes chain projection that matches current session", async () => {
    const wrapper = mount(FactorInputTable, {
      props: {
        session: createSession({ status: "measurement_entry", sessionId: "session-a" }),
        busy: false,
        editingSetup: false,
      },
    });

    let chain = wrapper.getComponent({ name: "DimensionChainPanel" });
    await chain.vm.$emit("report-projection-change", projection("generated", "signature-a"));
    await wrapper.vm.$nextTick();
    const beforeReplacement = wrapper.emitted("engineering-evidence-change")?.at(-1)?.[0] as Record<string, unknown> | undefined;
    expect(beforeReplacement).toBeTruthy();

    await wrapper.setProps({
      session: createSession({
        status: "measurement_entry",
        sessionId: "session-b",
        workbook: {
          fileName: "replacement.xlsx",
          workbookContentHash: HASH_A,
        },
      }),
    });
    await wrapper.vm.$nextTick();
    chain = wrapper.getComponent({ name: "DimensionChainPanel" });

    const afterReplacement = wrapper.emitted("engineering-evidence-change")?.at(-1)?.[0];
    expect(afterReplacement).toBeUndefined();

    await chain.vm.$emit("report-projection-change", projection("generated", "signature-a"));
    await wrapper.vm.$nextTick();
    const oldProjectionEmission = wrapper.emitted("engineering-evidence-change")?.at(-1)?.[0];
    expect(oldProjectionEmission).toBeUndefined();

    const currentSourceSignature = chain.props("sourceSignature") as string;
    await chain.vm.$emit("report-projection-change", projection("fallback", currentSourceSignature));
    await wrapper.vm.$nextTick();
    const currentProjectionEvidence = wrapper.emitted("engineering-evidence-change")?.at(-1)?.[0] as Record<string, unknown> | undefined;
    expect(currentProjectionEvidence).toBeTruthy();
    expect(currentProjectionEvidence?.dimensionChain).toEqual({
      status: "fallback",
      sourceSignature: currentSourceSignature,
    });

    const beforeShiftChange = wrapper.emitted("engineering-evidence-change")?.length ?? 0;
    await wrapper.get("#additional-mean-shift").setValue("0.25");
    await wrapper.vm.$nextTick();
    const afterShiftChange = wrapper.emitted("engineering-evidence-change")?.length ?? 0;
    expect(afterShiftChange).toBeGreaterThan(beforeShiftChange);
    const afterShiftEvidence = wrapper.emitted("engineering-evidence-change")?.at(-1)?.[0] as Record<string, unknown> | undefined;
    expect(afterShiftEvidence).toBeTruthy();
    expect(afterShiftEvidence?.dimensionChain).toEqual({
      status: "fallback",
      sourceSignature: currentSourceSignature,
    });
  });
});
