import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mount } from "@vue/test-utils";
import { defineComponent, h, isReactive } from "vue";
import { describe, expect, it } from "vitest";
import type { F7SessionSnapshot } from "../api/f7-client";
import type { AssumptionResultsEngineeringEvidence, DimensionChainReportProjection } from "../assumption-results-pdf-evidence";
import FactorInputTable from "./FactorInputTable.vue";

const STYLE_SOURCE = readFileSync(join(process.cwd(), "apps/f7-web/src/style.css"), "utf8");
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);

function createSystemSpecification(input?: {
  readonly additionalMeanShift?: number;
  readonly lowerSpecLimit?: number;
  readonly upperSpecLimit?: number;
  readonly targetSigmaLevel?: number;
}): NonNullable<F7SessionSnapshot["systemSpecification"]> {
  const additionalMeanShift = input?.additionalMeanShift ?? 0;
  const lowerSpecLimit = input?.lowerSpecLimit ?? -0.2;
  const upperSpecLimit = input?.upperSpecLimit ?? 0.2;
  const targetSigmaLevel = input?.targetSigmaLevel ?? 3;
  return {
    status: "available",
    designNominal: { status: "available", actualValue: 1, displayValue: "1", sourceLabel: "*Design Nominal ►", sourceCell: "Sheet!P53", valueOrigin: "numeric_literal" },
    lowerSpecLimit: { status: "available", actualValue: lowerSpecLimit, displayValue: `${lowerSpecLimit}`, sourceLabel: "*Lower Spec Limit ►", sourceCell: "Sheet!P54", valueOrigin: "numeric_literal" },
    upperSpecLimit: { status: "available", actualValue: upperSpecLimit, displayValue: `${upperSpecLimit}`, sourceLabel: "*Upper Spec Limit ►", sourceCell: "Sheet!P55", valueOrigin: "numeric_literal" },
    targetSigmaLevel: { status: "available", actualValue: targetSigmaLevel, displayValue: `${targetSigmaLevel}`, sourceLabel: "*Target σ Level ►", sourceCell: "Sheet!P56", valueOrigin: "numeric_literal" },
    additionalMeanShift: { status: "available", actualValue: additionalMeanShift, displayValue: `${additionalMeanShift}`, sourceLabel: "Additional Mean Shift", valueOrigin: "defaulted" },
    volume: { status: "available", actualValue: 1000000, displayValue: "1000000", sourceLabel: "Volume ►", sourceCell: "Sheet!X56", valueOrigin: "numeric_literal" },
  };
}

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
    systemSpecification: createSystemSpecification(),
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

function createSessionWithFactorIds(
  ids: {
    readonly candidateId: string;
    readonly factorId: string;
  },
  overrides: Partial<F7SessionSnapshot> = {},
): F7SessionSnapshot {
  const base = createSession(overrides);
  const factor = base.factors[0]!;
  return {
    ...base,
    factors: [
      {
        ...factor,
        factorCandidate: {
          ...factor.factorCandidate,
          factorCandidateId: ids.candidateId,
        },
        setup: factor.setup
          ? {
              ...factor.setup,
              factorCandidateId: ids.candidateId,
            }
          : factor.setup,
        evidence: factor.evidence
          ? {
              ...factor.evidence,
              factorCandidateId: ids.candidateId,
              factorId: ids.factorId,
            }
          : factor.evidence,
      },
    ],
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

function latestEvidence(wrapper: ReturnType<typeof mount>): Record<string, unknown> | undefined {
  return wrapper.emitted("engineering-evidence-change")?.at(-1)?.[0] as Record<string, unknown> | undefined;
}

function latestDimensionChain(wrapper: ReturnType<typeof mount>): Record<string, unknown> | undefined {
  const envelope = latestEvidence(wrapper);
  const evidence = envelope?.evidence as Record<string, unknown> | undefined;
  return evidence?.dimensionChain as Record<string, unknown> | undefined;
}

function latestTypedEvidence(wrapper: ReturnType<typeof mount>): AssumptionResultsEngineeringEvidence | undefined {
  const envelope = wrapper.emitted("engineering-evidence-change")?.at(-1)?.[0] as Record<string, unknown> | undefined;
  if (!envelope) return undefined;
  return envelope.evidence as AssumptionResultsEngineeringEvidence | undefined;
}

const FastDimensionChainPanelStub = defineComponent({
  name: "DimensionChainPanel",
  props: {
    sourceSignature: {
      type: String,
      required: false,
      default: "",
    },
  },
  setup(props) {
    return () => h("div", {
      "data-dimension-chain-panel-stub": "",
      "data-source-signature": props.sourceSignature,
    });
  },
});

const FastResponseDistributionCurveStub = defineComponent({
  name: "ResponseDistributionCurve",
  setup() {
    return () => h("div", { "data-response-distribution-curve-stub": "" });
  },
});

function mountWithFastStubs(props: {
  readonly session: F7SessionSnapshot;
  readonly busy: boolean;
  readonly editingSetup: boolean;
}) {
  return mount(FactorInputTable, {
    props,
    global: {
      stubs: {
        DimensionChainPanel: FastDimensionChainPanelStub,
        ResponseDistributionCurve: FastResponseDistributionCurveStub,
      },
    },
  });
}

describe("FactorInputTable engineering evidence event", () => {
  it("emits a session-bound envelope for engineering evidence", () => {
    const wrapper = mount(FactorInputTable, {
      props: {
        session: createSession({ status: "measurement_entry", sessionId: "session-envelope" }),
        busy: false,
        editingSetup: false,
      },
    });

    const envelope = latestEvidence(wrapper);
    expect(envelope).toBeTruthy();
    expect(envelope?.sessionId).toBe("session-envelope");
    expect(envelope?.workbookIdentity).toEqual({
      workbookContentHash: HASH_A,
      workbookFileName: "demo.xlsx",
      worksheetName: "Anonymous_TA",
    });
    expect((envelope?.evidence as Record<string, unknown> | undefined)?.dimensionChain).toEqual(
      expect.objectContaining({ status: "fallback" }),
    );
  });

  it("emits undefined while setup is editable", () => {
    const wrapper = mountWithFastStubs({
      session: createSession({ status: "factor_setup" }),
      busy: false,
      editingSetup: true,
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
    const initialEnvelope = emitted?.at(-1)?.[0] as Record<string, unknown> | undefined;
    const initialEvidence = initialEnvelope?.evidence as Record<string, unknown> | undefined;
    expect(initialEvidence).toBeTruthy();
    expect(initialEvidence?.dimensionChain).toEqual({
      status: "fallback",
      sourceSignature,
    });
    wrapper.unmount();
  });

  it("emits fallback engineering evidence when a missing workbook unit is normalized as unspecified", () => {
    const session = createSession({ status: "measurement_entry" });
    const factor = session.factors[0]!;
    session.factors = [{
      ...factor,
      factorCandidate: {
        ...factor.factorCandidate,
        workbookUnitEvidence: undefined,
      },
      evidence: {
        ...factor.evidence!,
        unit: "unspecified",
        unitSource: "unspecified",
      },
    }];

    const wrapper = mount(FactorInputTable, {
      props: {
        session,
        busy: false,
        editingSetup: false,
      },
    });

    const envelope = wrapper.emitted("engineering-evidence-change")?.at(-1)?.[0] as Record<string, unknown> | undefined;
    expect(envelope?.evidence).toBeTruthy();

    wrapper.unmount();
  });

  it("updates engineering evidence after receiving generated chain projection", async () => {
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

    const latestEnvelope = wrapper.emitted("engineering-evidence-change")?.at(-1)?.[0] as Record<string, unknown> | undefined;
    const latest = latestEnvelope?.evidence as Record<string, unknown> | undefined;
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

  it("uses real Reset to imported factors to clear generated cache and re-emit fallback", async () => {
    const wrapper = mount(FactorInputTable, {
      props: {
        session: createSession({ status: "measurement_entry" }),
        busy: false,
        editingSetup: true,
      },
    });

    await wrapper.vm.$nextTick();
    const chain = wrapper.getComponent({ name: "DimensionChainPanel" });
    const currentSourceSignature = chain.props("sourceSignature") as string;

    const initialProjection = chain.emitted("report-projection-change")?.at(-1)?.[0] as DimensionChainReportProjection | undefined;
    expect(initialProjection).toEqual({
      status: "fallback",
      sourceSignature: currentSourceSignature,
    });

    await chain.get("[data-generate-dimension-chain]").trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.setProps({ editingSetup: false });
    await wrapper.vm.$nextTick();
    expect(latestDimensionChain(wrapper)).toEqual(expect.objectContaining({
      status: "generated",
      sourceSignature: currentSourceSignature,
    }));

    await wrapper.setProps({ editingSetup: true });
    await wrapper.vm.$nextTick();

    await wrapper.get("[data-factor-design-nominal]").setValue("2");
    await wrapper.vm.$nextTick();
    const editedChain = wrapper.getComponent({ name: "DimensionChainPanel" });
    const editedSourceSignature = editedChain.props("sourceSignature") as string;
    expect(editedSourceSignature).not.toBe(currentSourceSignature);

    const emissionCountBeforeReset = wrapper.emitted("engineering-evidence-change")?.length ?? 0;
    await wrapper.get("[data-factor-reset]").trigger("click");
    await wrapper.vm.$nextTick();

    await wrapper.setProps({ editingSetup: false });
    await wrapper.vm.$nextTick();

    const resetChain = wrapper.getComponent({ name: "DimensionChainPanel" });
    const resetSourceSignature = resetChain.props("sourceSignature") as string;
    const emittedAfterReset = (wrapper.emitted("engineering-evidence-change") ?? []).slice(emissionCountBeforeReset);
    const hasResetFallbackEvidence = emittedAfterReset.some((entry) => {
      const envelope = entry?.[0] as Record<string, unknown> | undefined;
      const evidence = envelope?.evidence as Record<string, unknown> | undefined;
      const chainProjection = evidence?.dimensionChain as Record<string, unknown> | undefined;
      return chainProjection?.status === "fallback" && chainProjection?.sourceSignature === resetSourceSignature;
    });
    expect(hasResetFallbackEvidence).toBe(true);

    const hasResetGeneratedEvidence = emittedAfterReset.some((entry) => {
      const envelope = entry?.[0] as Record<string, unknown> | undefined;
      const evidence = envelope?.evidence as Record<string, unknown> | undefined;
      const chainProjection = evidence?.dimensionChain as Record<string, unknown> | undefined;
      return chainProjection?.status === "generated" && chainProjection?.sourceSignature === resetSourceSignature;
    });
    expect(hasResetGeneratedEvidence).toBe(false);
  });

  it("resets additional mean shift on session switch and keeps evidence session-bound", async () => {
    const wrapper = mount(FactorInputTable, {
      props: {
        session: createSession({ status: "measurement_entry", sessionId: "session-a" }),
        busy: false,
        editingSetup: true,
      },
    });

    let chain = wrapper.getComponent({ name: "DimensionChainPanel" });
    const sessionASourceSignature = chain.props("sourceSignature") as string;
    await chain.get("[data-generate-dimension-chain]").trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.setProps({ editingSetup: false });
    await wrapper.vm.$nextTick();
    const beforeReplacement = latestTypedEvidence(wrapper);
    expect(beforeReplacement).toBeTruthy();
    expect(beforeReplacement?.dimensionChain).toEqual(expect.objectContaining({
      status: "generated",
      sourceSignature: sessionASourceSignature,
    }));

    await wrapper.get("#additional-mean-shift").setValue("0.25");
    await wrapper.vm.$nextTick();
    const beforeReplacementShift = latestTypedEvidence(wrapper)?.responseSummary?.responseAndSpecifications?.additionalMeanShift;
    expect(beforeReplacementShift).toBe(0.25);

    const emissionCountBeforeReplacement = wrapper.emitted("engineering-evidence-change")?.length ?? 0;

    await wrapper.setProps({
      session: createSessionWithFactorIds(
        {
          candidateId: HASH_D,
          factorId: `${HASH_D.slice(0, 63)}f`,
        },
        {
          status: "measurement_entry",
          sessionId: "session-b",
          systemSpecification: createSystemSpecification({ additionalMeanShift: 0.4 }),
          workbook: {
            fileName: "replacement.xlsx",
            workbookContentHash: HASH_A,
          },
        },
      ),
    });
    await wrapper.vm.$nextTick();
    chain = wrapper.getComponent({ name: "DimensionChainPanel" });
    const currentSourceSignature = chain.props("sourceSignature") as string;

    const emissionsAfterReplacement = (wrapper.emitted("engineering-evidence-change") ?? []).slice(emissionCountBeforeReplacement);
    expect(emissionsAfterReplacement.length).toBeGreaterThan(0);
    const undefinedIndex = emissionsAfterReplacement.findIndex((entry) => entry?.[0] === undefined);
    expect(undefinedIndex).toBeGreaterThanOrEqual(0);
    const fallbackIndex = emissionsAfterReplacement.findIndex((entry) => {
      const envelope = entry?.[0] as Record<string, unknown> | undefined;
      const evidence = envelope?.evidence as Record<string, unknown> | undefined;
      return evidence?.dimensionChain
        && typeof evidence.dimensionChain === "object"
        && (evidence.dimensionChain as { status?: string }).status === "fallback";
    });
    expect(fallbackIndex).toBeGreaterThan(undefinedIndex);

    const oldProjectionEmissionCount = wrapper.emitted("engineering-evidence-change")?.length ?? 0;
    await chain.vm.$emit("report-projection-change", projection("generated", sessionASourceSignature));
    await wrapper.vm.$nextTick();
    const afterOldProjectionCount = wrapper.emitted("engineering-evidence-change")?.length ?? 0;
    expect(afterOldProjectionCount).toBe(oldProjectionEmissionCount);

    const currentProjectionEvidence = latestTypedEvidence(wrapper);
    expect(currentProjectionEvidence).toBeTruthy();
    expect(currentProjectionEvidence?.dimensionChain).toEqual({
      status: "fallback",
      sourceSignature: currentSourceSignature,
    });
    const sessionBShift = latestTypedEvidence(wrapper)?.responseSummary?.responseAndSpecifications?.additionalMeanShift;
    expect(sessionBShift).toBe(0.4);
    expect(sessionBShift).not.toBe(0.25);

    const emissionCountBeforeSecondSwitch = wrapper.emitted("engineering-evidence-change")?.length ?? 0;
    await wrapper.setProps({
      session: createSessionWithFactorIds(
        {
          candidateId: `${HASH_D.slice(0, 63)}9`,
          factorId: `${HASH_D.slice(0, 63)}8`,
        },
        {
          status: "measurement_entry",
          sessionId: "session-c",
          workbook: {
            fileName: "replacement-2.xlsx",
            workbookContentHash: HASH_A,
          },
        },
      ),
    });
    await wrapper.vm.$nextTick();

    const emissionsAfterSecondSwitch = (wrapper.emitted("engineering-evidence-change") ?? []).slice(emissionCountBeforeSecondSwitch);
    expect(emissionsAfterSecondSwitch.some((entry) => entry?.[0] === undefined)).toBe(true);
    expect(latestTypedEvidence(wrapper)?.responseSummary?.responseAndSpecifications?.additionalMeanShift).toBe(0);
  });

  it("increments dimensionChainResetRevision and resets child panel projection state when only sessionId changes", async () => {
    const wrapper = mount(FactorInputTable, {
      props: {
        session: createSession({ status: "measurement_entry", sessionId: "session-a" }),
        busy: false,
        editingSetup: false,
      },
    });

    const firstChain = wrapper.getComponent({ name: "DimensionChainPanel" });
    const firstSourceSignature = firstChain.props("sourceSignature") as string;
    await firstChain.vm.$emit("report-projection-change", projection("generated", firstSourceSignature));
    await wrapper.vm.$nextTick();

    expect(latestDimensionChain(wrapper)).toEqual(expect.objectContaining({
      status: "generated",
      sourceSignature: firstSourceSignature,
    }));

    const beforeSwitchSetupState = (wrapper.vm.$ as unknown as {
      setupState: {
        dimensionChainResetRevision: number;
      };
    }).setupState;
    const beforeSwitchRevision = beforeSwitchSetupState.dimensionChainResetRevision;

    await wrapper.setProps({
      session: createSession({
        status: "measurement_entry",
        sessionId: "session-b",
      }),
    });
    await wrapper.vm.$nextTick();

    const afterSwitchSetupState = (wrapper.vm.$ as unknown as {
      setupState: {
        dimensionChainResetRevision: number;
      };
    }).setupState;
    expect(afterSwitchSetupState.dimensionChainResetRevision).toBe(beforeSwitchRevision + 1);

    const nextChain = wrapper.getComponent({ name: "DimensionChainPanel" });
    const nextSourceSignature = nextChain.props("sourceSignature") as string;

    const emissionsAfterSwitch = wrapper.emitted("engineering-evidence-change") ?? [];
    const latestEnvelope = emissionsAfterSwitch.at(-1)?.[0] as Record<string, unknown> | undefined;
    const latestAfterSwitch = latestEnvelope?.evidence as AssumptionResultsEngineeringEvidence | undefined;
    expect(latestAfterSwitch?.dimensionChain).toEqual({
      status: "fallback",
      sourceSignature: nextSourceSignature,
    });

    const countBeforeOldReplay = emissionsAfterSwitch.length;
    await firstChain.vm.$emit("report-projection-change", projection("generated", firstSourceSignature));
    await wrapper.vm.$nextTick();

    expect((wrapper.emitted("engineering-evidence-change") ?? []).length).toBe(countBeforeOldReplay);
    expect(latestDimensionChain(wrapper)).toEqual({
      status: "fallback",
      sourceSignature: nextSourceSignature,
    });

    await nextChain.vm.$emit("report-projection-change", projection("generated", nextSourceSignature));
    await wrapper.vm.$nextTick();
    expect(latestDimensionChain(wrapper)).toEqual(expect.objectContaining({
      status: "generated",
      sourceSignature: nextSourceSignature,
    }));
  });

  it("stores report projection as plain immutable DTO and emitted evidence stays stable when payload is mutated", async () => {
    const wrapper = mountWithFastStubs({
      session: createSession({ status: "measurement_entry", sessionId: "session-immutable" }),
      busy: false,
      editingSetup: false,
    });

    const rawSourceSignature = wrapper.get("[data-dimension-chain-panel-stub]").attributes("data-source-signature");
    expect(rawSourceSignature).toBeTruthy();
    const sourceSignature = rawSourceSignature ?? "";
    const payload = projection("generated", sourceSignature);
    const chain = wrapper.getComponent({ name: "DimensionChainPanel" });

    await chain.vm.$emit("report-projection-change", payload);
    await wrapper.vm.$nextTick();

    const setupState = (wrapper.vm.$ as unknown as {
      setupState: {
        latestDimensionChainProjection: {
          sessionKey: string;
          projection: unknown;
        } | undefined;
      };
    }).setupState;
    expect(setupState.latestDimensionChainProjection).toBeTruthy();
    expect(isReactive(setupState.latestDimensionChainProjection)).toBe(false);
    expect(isReactive(setupState.latestDimensionChainProjection?.projection)).toBe(false);

    const beforeMutationEvidence = latestTypedEvidence(wrapper);
    expect(beforeMutationEvidence?.dimensionChain).toEqual(expect.objectContaining({
      status: "generated",
      sourceSignature,
    }));

    if (payload.status === "generated") {
      const mutablePayload = payload as unknown as {
        factors: Array<{ id: string; itemNumber: number; name: string; designNominal: number; upperTolerance: number; lowerTolerance: number; longTermSafetyFactor: number; sigmaLevel: number; distribution: string }>;
        manualLayout: { boundaryOffsets: Record<string, number>; laneOffsets: Record<string, number> };
        reversedFactorIds: string[];
      };
      mutablePayload.factors[0] = {
        ...mutablePayload.factors[0]!,
        name: "Mutated Factor Name",
        designNominal: 999,
      };
      mutablePayload.manualLayout.boundaryOffsets = { hacked: 321 };
      mutablePayload.reversedFactorIds = ["hijacked"];
    }

    const afterMutationEvidence = latestTypedEvidence(wrapper);
    expect(afterMutationEvidence?.dimensionChain).toEqual(beforeMutationEvidence?.dimensionChain);
    expect(afterMutationEvidence?.dimensionChain).toEqual(expect.objectContaining({
      status: "generated",
      sourceSignature,
    }));
  });

  it("emits undefined when f4Calculation itself becomes unavailable with a valid current-session projection", async () => {
    const wrapper = mount(FactorInputTable, {
      props: {
        session: createSession({ status: "measurement_entry" }),
        busy: false,
        editingSetup: true,
      },
    });

    const chain = wrapper.getComponent({ name: "DimensionChainPanel" });
    const sourceSignature = chain.props("sourceSignature") as string;
    await chain.get("[data-generate-dimension-chain]").trigger("click");
    await wrapper.vm.$nextTick();

    await wrapper.setProps({ editingSetup: false });
    await wrapper.vm.$nextTick();

    expect(latestTypedEvidence(wrapper)?.dimensionChain).toEqual(expect.objectContaining({
      status: "generated",
      sourceSignature,
    }));

    await wrapper.setProps({ editingSetup: true });
    await wrapper.vm.$nextTick();

    await wrapper.get("[data-f4-target-sigma-input]").setValue("");
    await wrapper.vm.$nextTick();

    await wrapper.setProps({ editingSetup: false });
    await wrapper.vm.$nextTick();

    const unavailableEmission = wrapper.emitted("engineering-evidence-change")?.at(-1)?.[0];
    expect(unavailableEmission).toBeUndefined();
  });

  it("re-emits valid generated evidence after additional mean shift recalculation while preserving current session/source binding", async () => {
    const wrapper = mount(FactorInputTable, {
      props: {
        session: createSession({ status: "measurement_entry", sessionId: "stable-session" }),
        busy: false,
        editingSetup: true,
      },
    });

    const chain = wrapper.getComponent({ name: "DimensionChainPanel" });
    const sourceSignature = chain.props("sourceSignature") as string;
  await chain.get("[data-generate-dimension-chain]").trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.setProps({ editingSetup: false });
    await wrapper.vm.$nextTick();

    const beforeShiftEvidence = latestTypedEvidence(wrapper);
    expect(beforeShiftEvidence?.dimensionChain).toEqual(expect.objectContaining({
      status: "generated",
      sourceSignature,
    }));
    const beforeShiftAdjustedMean = beforeShiftEvidence?.responseSummary?.responseAndSpecifications?.adjustedMean;

    const beforeShiftCount = wrapper.emitted("engineering-evidence-change")?.length ?? 0;
    await wrapper.get("#additional-mean-shift").setValue("0.321");
    await wrapper.vm.$nextTick();

    const afterShiftCount = wrapper.emitted("engineering-evidence-change")?.length ?? 0;
    expect(afterShiftCount).toBeGreaterThan(beforeShiftCount);

    const afterShiftEvidence = latestTypedEvidence(wrapper);
    expect(afterShiftEvidence?.dimensionChain).toEqual(expect.objectContaining({
      status: "generated",
      sourceSignature,
    }));
    expect(afterShiftEvidence?.responseSummary?.responseAndSpecifications?.additionalMeanShift).toBe(0.321);
    expect(afterShiftEvidence?.responseSummary?.responseAndSpecifications?.adjustedMean).not.toBe(beforeShiftAdjustedMean);
  });
});
