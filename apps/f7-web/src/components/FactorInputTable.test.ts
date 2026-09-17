import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mount } from "@vue/test-utils";
import { defineComponent, h, isReactive } from "vue";
import { describe, expect, it } from "vitest";
import { processRequirementComponentCategorySchema } from "@ai-assist/contracts";
import type { F7FactorInput } from "@ai-assist/contracts";
import type { F7SessionSnapshot } from "../api/f7-client";
import type { AssumptionResultsEngineeringEvidence, DimensionChainReportProjection } from "../assumption-results-pdf-evidence";
import FactorInputTable from "./FactorInputTable.vue";

const STYLE_SOURCE = readFileSync(join(process.cwd(), "apps/f7-web/src/style.css"), "utf8");
const COMPONENT_SOURCE = readFileSync(join(process.cwd(), "apps/f7-web/src/components/FactorInputTable.vue"), "utf8");
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
  readonly measurementEntryMode?: "import" | "individual";
  readonly blockedMeasurementFactors?: readonly { factorId: string; message: string }[];
  readonly automaticAnalysisProgress?: {
    readonly factorIds: readonly string[];
    readonly activeFactorId: string;
    readonly completedCount: number;
  } | undefined;
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

describe("FactorInputTable measurement entry modes", () => {
  function createModeSession(
    mutateMeasuredFactor?: (factor: F7SessionSnapshot["factors"][number]) => F7SessionSnapshot["factors"][number],
  ): F7SessionSnapshot {
    const base = createSession({ status: "measurement_entry" });
    const baseline = base.factors[0]!;
    const measuredFactor = mutateMeasuredFactor?.({
      ...baseline,
      factorCandidate: {
        ...baseline.factorCandidate,
        factorCandidateId: HASH_D,
        factorName: "Measured factor",
      },
      setup: baseline.setup
        ? {
            ...baseline.setup,
            factorCandidateId: HASH_D,
          }
        : baseline.setup,
      evidence: baseline.evidence
        ? {
            ...baseline.evidence,
            factorCandidateId: HASH_D,
            factorId: HASH_A,
            factorName: "Measured factor",
          }
        : baseline.evidence,
      sourceMode: "MEASURED",
      input: {
        mode: "MEASURED",
        dataset: {
          factorId: HASH_A,
          unit: "mm",
          structure: "ORDERED_INDIVIDUALS",
          sourceReference: "import-01",
          importedAt: "2026-09-16T08:00:00.000Z",
          msaStatus: "unknown",
          observations: [
            { originalRow: 1, value: 0.11, disposition: "included" },
            { originalRow: 2, value: 0.12, disposition: "included" },
          ],
          missingRowCount: 0,
          rejectionSummaries: [],
          originalRowCount: 2,
          analyzedCount: 2,
          contentHash: HASH_C,
        },
      },
      measurementPasteResult: {
        status: "ready",
        factorId: HASH_A,
        dataset: {
          factorId: HASH_A,
          unit: "mm",
          structure: "ORDERED_INDIVIDUALS",
          sourceReference: "import-01",
          importedAt: "2026-09-16T08:00:00.000Z",
          msaStatus: "unknown",
          observations: [
            { originalRow: 1, value: 0.11, disposition: "included" },
            { originalRow: 2, value: 0.12, disposition: "included" },
          ],
          missingRowCount: 0,
          rejectionSummaries: [],
          originalRowCount: 2,
          analyzedCount: 2,
          contentHash: HASH_C,
        },
        validation: {
          status: "ready",
          blockingIssues: [],
          advisoryIssues: [],
          candidateEligibility: {
            normal: "eligible",
            lognormal: "eligible",
            weibull: "eligible",
            gamma: "eligible",
            uniform: "eligible_with_boundary_warning",
          },
        },
      },
    });
    return {
      ...base,
      factors: [
        baseline,
        measuredFactor ?? {
          ...baseline,
          factorCandidate: {
            ...baseline.factorCandidate,
            factorCandidateId: HASH_D,
            factorName: "Measured factor",
          },
          setup: baseline.setup
            ? {
                ...baseline.setup,
                factorCandidateId: HASH_D,
              }
            : baseline.setup,
          evidence: baseline.evidence
            ? {
                ...baseline.evidence,
                factorCandidateId: HASH_D,
                factorId: HASH_A,
                factorName: "Measured factor",
              }
            : baseline.evidence,
          sourceMode: "MEASURED",
          input: {
            mode: "MEASURED",
            dataset: {
              factorId: HASH_A,
              unit: "mm",
              structure: "ORDERED_INDIVIDUALS",
              sourceReference: "import-01",
              importedAt: "2026-09-16T08:00:00.000Z",
              msaStatus: "unknown",
              observations: [
                { originalRow: 1, value: 0.11, disposition: "included" },
                { originalRow: 2, value: 0.12, disposition: "included" },
              ],
              missingRowCount: 0,
              rejectionSummaries: [],
              originalRowCount: 2,
              analyzedCount: 2,
              contentHash: HASH_C,
            },
          },
          measurementPasteResult: {
            status: "ready",
            factorId: HASH_A,
            dataset: {
              factorId: HASH_A,
              unit: "mm",
              structure: "ORDERED_INDIVIDUALS",
              sourceReference: "import-01",
              importedAt: "2026-09-16T08:00:00.000Z",
              msaStatus: "unknown",
              observations: [
                { originalRow: 1, value: 0.11, disposition: "included" },
                { originalRow: 2, value: 0.12, disposition: "included" },
              ],
              missingRowCount: 0,
              rejectionSummaries: [],
              originalRowCount: 2,
              analyzedCount: 2,
              contentHash: HASH_C,
            },
            validation: {
              status: "ready",
              blockingIssues: [],
              advisoryIssues: [],
              candidateEligibility: {
                normal: "eligible",
                lognormal: "eligible",
                weibull: "eligible",
                gamma: "eligible",
                uniform: "eligible_with_boundary_warning",
              },
            },
          },
        },
      ],
    };
  }

  function workspaceButton(wrapper: ReturnType<typeof mountWithFastStubs>) {
    return wrapper.get(`[data-open-measurement='${HASH_A}']`);
  }

  function expectWorkspaceButtonState(
    wrapper: ReturnType<typeof mountWithFastStubs>,
    state: "empty" | "ready" | "warning" | "blocked",
    indicator: "none" | "warning" | "blocked",
    expectedBlockedTitle = "Measurement validation is blocked.",
  ): void {
    const expectedLabels = {
      empty: "Measured Data: No measured data",
      ready: "Measured Data: passed validation",
      warning: "Measured Data: passed validation with warnings; you can continue",
      blocked: "Measured Data: validation is blocked; correction or re-upload is required",
    } as const;
    const button = workspaceButton(wrapper);
    const expectedLabel = `${expectedLabels[state]} for Measured factor`;
    expect(button.attributes("data-measured-state")).toBe(state);
    expect(button.attributes("aria-label")).toBe(expectedLabel);
    expect(button.attributes("title")).toBe(state === "blocked" ? expectedBlockedTitle : expectedLabel);
    expect(button.text()).toBe("Measured Data");
    expect(wrapper.find(".factor-workspace-warning-indicator").exists()).toBe(indicator === "warning");
    expect(wrapper.find(".factor-workspace-blocked-indicator").exists()).toBe(indicator === "blocked");
  }

  function measuredComparisonSession(
    observations: NonNullable<NonNullable<F7SessionSnapshot["factors"][number]["measurementPasteResult"]>["dataset"]>["observations"],
  ): F7SessionSnapshot {
    return createModeSession((factor) => ({
      ...factor,
      evidence: {
        ...factor.evidence!,
        calculatedMean: 1,
        tolerance: 0.1,
        oneSigma: 0.025,
        lowerSpecLimit: 0.8,
        upperSpecLimit: 1.2,
      },
      measurementPasteResult: {
        ...factor.measurementPasteResult!,
        dataset: {
          ...factor.measurementPasteResult!.dataset!,
          observations,
          originalRowCount: observations.length,
          analyzedCount: observations.filter((observation) => observation.disposition === "included").length,
        },
      },
    }));
  }

  it("renders measured comparison after Setup with Cpk and explicit Actual and delta metrics", () => {
    const wrapper = mountWithFastStubs({
      session: measuredComparisonSession([
        { originalRow: 1, value: 0.9, disposition: "included" },
        { originalRow: 2, value: 1, disposition: "included" },
        { originalRow: 3, value: 1.1, disposition: "included" },
      ]),
      busy: false,
      editingSetup: false,
      measurementEntryMode: "import",
    });

    const headers = wrapper.findAll("#factor-setup-table thead th").map((header) => header.attributes("aria-label"));
    expect(headers.slice(headers.indexOf("1σ"), headers.indexOf("% Cont. to σ") + 1)).toEqual([
      "1σ",
      "Cpk",
      "% Cont. to σ",
    ]);
    const expectedComparisonColumns = {
      mean: { defaultWidth: 94, minWidth: 88 },
      tolerance: { defaultWidth: 116, minWidth: 108 },
      oneSigma: { defaultWidth: 94, minWidth: 88 },
      cpk: { defaultWidth: 94, minWidth: 88 },
    } as const;
    for (const [key, widths] of Object.entries(expectedComparisonColumns)) {
      expect(COMPONENT_SOURCE).toContain(
        `{ key: "${key}", label:`,
      );
      expect(COMPONENT_SOURCE).toMatch(new RegExp(
        `\\{ key: "${key}",[^\\n]+defaultWidth: ${widths.defaultWidth}, minWidth: ${widths.minWidth} \\}`,
      ));
      expect(wrapper.get(`col[data-column-key='${key}']`).attributes("style")).toContain(`${widths.defaultWidth}px`);
    }
    expect(wrapper.get("#factor-setup-table").attributes("style")).toContain("min-width: 1698px");

    const comparison = wrapper.get(`[data-factor-measured-comparison='${HASH_A}']`);
    const setupRow = comparison.element.previousElementSibling;
    expect(setupRow?.querySelector("output[aria-label='Measured factor Cpk']")?.textContent).toBe("1.3333");
    expect(setupRow?.nextElementSibling).toBe(comparison.element);
    expect(setupRow?.querySelector(`[data-open-measurement='${HASH_A}']`)?.textContent?.trim()).toBe("Measured Data");
    expect(comparison.find(`[data-open-measurement='${HASH_A}']`).exists()).toBe(false);
    const setupCells = [...(setupRow?.querySelectorAll("td") ?? [])];
    expect(setupCells.slice(0, 9).every((cell) => cell.getAttribute("rowspan") === "2")).toBe(true);
    expect(setupCells.slice(0, 9).every((cell) => cell.classList.contains("factor-setup-rowspan-cell"))).toBe(true);
    const measuredRowspanCells = setupCells.slice(-3);
    expect(measuredRowspanCells.map((cell) => cell.getAttribute("data-column-key"))).toEqual([
      "sourceMode",
      "sampleCount",
      "readiness",
    ]);
    expect(measuredRowspanCells.every((cell) => cell.getAttribute("rowspan") === "2")).toBe(true);
    expect(measuredRowspanCells.every((cell) => cell.classList.contains("factor-measured-rowspan-cell"))).toBe(true);
    expect(measuredRowspanCells[1]?.textContent?.trim()).toBe("3");
    expect(measuredRowspanCells[2]?.textContent?.trim()).toBe("ready");
    expect(comparison.attributes("aria-label")).toContain("Measured factor");
    expect(comparison.findAll("td")).toHaveLength(5);

    expect(comparison.get("[data-measured-comparison-metric='mean']").text()).toContain("Actual 1");
    expect(comparison.get("[data-measured-comparison-metric='mean']").text()).toContain("Δ 0");
    expect(comparison.get("[data-measured-comparison-metric='tolerance']").text()).toContain("Actual ±3σ 0.3");
    expect(comparison.get("[data-measured-comparison-metric='tolerance']").text()).toContain("Δ +0.2");
    expect(comparison.get("[data-measured-comparison-metric='oneSigma']").text()).toContain("Actual 0.1");
    expect(comparison.get("[data-measured-comparison-metric='oneSigma']").text()).toContain("Δ +0.075");
    expect(comparison.get("[data-measured-comparison-metric='cpk']").text()).toContain("Actual 0.6667");
    expect(comparison.get("[data-measured-comparison-metric='cpk']").text()).toContain("Δ -0.6667");
  });

  it("omits measured comparison for baseline, unready, editing, and no included finite data", () => {
    const baselineWrapper = mountWithFastStubs({
      session: createSession({ status: "measurement_entry" }),
      busy: false,
      editingSetup: false,
    });
    expect(baselineWrapper.find("td[rowspan]").exists()).toBe(false);
    const unreadyWrapper = mountWithFastStubs({
      session: createModeSession((factor) => ({ ...factor, measurementPasteResult: undefined })),
      busy: false,
      editingSetup: false,
    });
    const editingWrapper = mountWithFastStubs({
      session: measuredComparisonSession([
        { originalRow: 1, value: 0.9, disposition: "included" },
        { originalRow: 2, value: 1.1, disposition: "included" },
      ]),
      busy: false,
      editingSetup: true,
    });
    const emptyWrapper = mountWithFastStubs({
      session: measuredComparisonSession([
        {
          originalRow: 1,
          value: 1,
          disposition: "excluded",
          reason: "OTHER",
          operatorReference: "operator",
          confirmed: true,
        },
      ]),
      busy: false,
      editingSetup: false,
    });

    expect(baselineWrapper.find("[data-factor-measured-comparison]").exists()).toBe(false);
    expect(unreadyWrapper.find("[data-factor-measured-comparison]").exists()).toBe(false);
    expect(editingWrapper.find("[data-factor-measured-comparison]").exists()).toBe(false);
    expect(emptyWrapper.find("[data-factor-measured-comparison]").exists()).toBe(false);
  });

  it("renders unavailable measured comparison Cpk as an em dash for zero variation", () => {
    const wrapper = mountWithFastStubs({
      session: measuredComparisonSession([
        { originalRow: 1, value: 1, disposition: "included" },
        { originalRow: 2, value: 1, disposition: "included" },
      ]),
      busy: false,
      editingSetup: false,
    });

    const comparison = wrapper.get(`[data-factor-measured-comparison='${HASH_A}']`);
    expect(comparison.get("[data-measured-comparison-metric='cpk']").text()).toContain("Actual —");
    expect(comparison.get("[data-measured-comparison-metric='cpk']").text()).toContain("Δ —");
  });

  it("omits the redundant measured source text and keeps baseline text in import mode", () => {
    const wrapper = mountWithFastStubs({
      session: createModeSession(),
      busy: false,
      editingSetup: false,
      measurementEntryMode: "import",
    } as {
      session: F7SessionSnapshot;
      busy: boolean;
      editingSetup: boolean;
      measurementEntryMode: "import";
    });

    expect(wrapper.text()).toContain("BASELINE_ASSUMPTION");
    expect(wrapper.text()).not.toContain("MEASURED");
    expect(wrapper.get(`[data-open-measurement='${HASH_A}']`).text()).toBe("Measured Data");
    expect(wrapper.findAll("input[type='radio']")).toHaveLength(0);
  });

  it("retains source mode radios in individual mode", () => {
    const wrapper = mountWithFastStubs({
      session: createModeSession(),
      busy: false,
      editingSetup: false,
      measurementEntryMode: "individual",
    } as {
      session: F7SessionSnapshot;
      busy: boolean;
      editingSetup: boolean;
      measurementEntryMode: "individual";
    });

    expect(wrapper.find("fieldset legend").text()).toContain("Source mode");
    expect(wrapper.findAll("input[type='radio']").length).toBeGreaterThan(0);
  expectWorkspaceButtonState(wrapper, "warning", "warning");
  });

  it("keeps the Measured Data workspace action visible in both modes", () => {
    const importWrapper = mountWithFastStubs({
      session: createModeSession(),
      busy: false,
      editingSetup: false,
      measurementEntryMode: "import",
    } as {
      session: F7SessionSnapshot;
      busy: boolean;
      editingSetup: boolean;
      measurementEntryMode: "import";
    });
    const individualWrapper = mountWithFastStubs({
      session: createModeSession(),
      busy: false,
      editingSetup: false,
      measurementEntryMode: "individual",
    } as {
      session: F7SessionSnapshot;
      busy: boolean;
      editingSetup: boolean;
      measurementEntryMode: "individual";
    });

    expect(importWrapper.get(`[data-open-measurement='${HASH_A}']`).text()).toBe("Measured Data");
    expect(individualWrapper.get(`[data-open-measurement='${HASH_A}']`).text()).toBe("Measured Data");
  });

  it("renders the Measured Data button state and state-aware labels in import mode", () => {
    const emptyWrapper = mountWithFastStubs({
      session: createModeSession((factor) => ({
        ...factor,
        measurementPasteResult: undefined,
      })),
      busy: false,
      editingSetup: false,
      measurementEntryMode: "import",
    });
    const readyWrapper = mountWithFastStubs({
      session: createModeSession((factor) => ({
        ...factor,
        evidence: {
          ...factor.evidence!,
          lowerSpecLimit: 0.05,
          upperSpecLimit: 0.2,
        },
        measurementPasteResult: {
          ...factor.measurementPasteResult!,
          dataset: {
            ...factor.measurementPasteResult!.dataset!,
            observations: [
              { originalRow: 1, value: 0.11, disposition: "included" },
              { originalRow: 2, value: 0.12, disposition: "included" },
            ],
          },
        },
      })),
      busy: false,
      editingSetup: false,
      measurementEntryMode: "import",
    });
    const warningWrapper = mountWithFastStubs({
      session: createModeSession((factor) => ({
        ...factor,
        measurementPasteResult: {
          ...factor.measurementPasteResult!,
          dataset: {
            ...factor.measurementPasteResult!.dataset!,
            observations: [
              ...factor.measurementPasteResult!.dataset!.observations,
              { originalRow: 3, value: 0.5, disposition: "included" },
            ],
          },
        },
      })),
      busy: false,
      editingSetup: false,
      measurementEntryMode: "import",
    });
    const blockedWrapper = mountWithFastStubs({
      session: createModeSession((factor) => ({
        ...factor,
        measurementPasteResult: {
          ...factor.measurementPasteResult!,
          status: "blocked",
          dataset: {
            ...factor.measurementPasteResult!.dataset!,
            observations: [
              ...factor.measurementPasteResult!.dataset!.observations,
              { originalRow: 3, value: 0.5, disposition: "included" },
            ],
          },
        },
      })),
      busy: false,
      editingSetup: false,
      measurementEntryMode: "import",
    });

    expectWorkspaceButtonState(emptyWrapper, "empty", "none");
    expectWorkspaceButtonState(readyWrapper, "ready", "none");
    expectWorkspaceButtonState(warningWrapper, "warning", "warning");
    expectWorkspaceButtonState(blockedWrapper, "blocked", "blocked");
    expect(workspaceButton(emptyWrapper).attributes("aria-label")).toContain("No measured data");
    expect(workspaceButton(readyWrapper).attributes("aria-label")).toContain("passed validation");
  });

  it("sets the Measured Data button state to blocked when an empty factor ID is supplied through the prop", () => {
    const session = createModeSession((factor) => ({
      ...factor,
      measurementPasteResult: undefined,
    }));
    const emptyWrapper = mountWithFastStubs({
      session,
      busy: false,
      editingSetup: false,
      measurementEntryMode: "import",
    });
    const blockedWrapper = mountWithFastStubs({
      session,
      busy: false,
      editingSetup: false,
      measurementEntryMode: "import",
      blockedMeasurementFactors: [{ factorId: HASH_A, message: "Action required" }],
    });

    expect(workspaceButton(emptyWrapper).attributes("data-measured-state")).toBe("empty");
    expect(workspaceButton(blockedWrapper).attributes("data-measured-state")).toBe("blocked");
    expect(blockedWrapper.get(".factor-workspace-blocked-indicator").text()).toBe("Action required");
    expect(blockedWrapper.text()).not.toContain("Warning");
  });

  it("keeps the blocked Measured Data button state clickable through the prop in both modes", async () => {
    const blockedMeasurementFactors = [{ factorId: HASH_A, message: "Action required" }] as const;
    const importWrapper = mountWithFastStubs({
      session: createModeSession(),
      busy: false,
      editingSetup: false,
      measurementEntryMode: "import",
      blockedMeasurementFactors,
    });
    const individualWrapper = mountWithFastStubs({
      session: createModeSession((factor) => {
        const baselineInput: Extract<F7FactorInput, { mode: "BASELINE_ASSUMPTION" }> = factor.input?.mode === "BASELINE_ASSUMPTION"
          ? factor.input
          : {
              mode: "BASELINE_ASSUMPTION",
              baselineSampler: factor.evidence!.baselineSampler,
            };
        return {
          ...factor,
          sourceMode: "BASELINE_ASSUMPTION",
          input: baselineInput,
        };
      }),
      busy: false,
      editingSetup: false,
      measurementEntryMode: "individual",
      blockedMeasurementFactors,
    });

    expectWorkspaceButtonState(importWrapper, "blocked", "blocked", "Action required");
    expectWorkspaceButtonState(individualWrapper, "blocked", "blocked", "Action required");
    expect(workspaceButton(importWrapper).attributes("disabled")).toBeUndefined();
    expect(workspaceButton(individualWrapper).attributes("disabled")).toBeUndefined();

    await workspaceButton(importWrapper).trigger("click");
    await workspaceButton(individualWrapper).trigger("click");

    expect(importWrapper.emitted("openMeasurement")?.at(-1)).toEqual([HASH_A]);
    expect(individualWrapper.emitted("openMeasurement")?.at(-1)).toEqual([HASH_A]);
  });

  it("shows automatic measured analysis progress for active and queued Source Mode rows", async () => {
    const queuedWrapper = mountWithFastStubs({
      session: createModeSession(),
      busy: true,
      editingSetup: false,
      measurementEntryMode: "import",
      automaticAnalysisProgress: {
        factorIds: [HASH_C, HASH_A],
        activeFactorId: HASH_C,
        completedCount: 0,
      },
    });

    const queuedFeedback = queuedWrapper.get("[data-automatic-analysis-feedback]");
    expect(queuedFeedback.get("[data-automatic-analysis-progress]").text()).toBe("Analyzing measured data 1 / 2");
    expect(queuedFeedback.find("[data-automatic-analysis-bar]").exists()).toBe(true);
    expect(queuedFeedback.attributes("role")).toBe("status");
    expect(queuedFeedback.attributes("aria-live")).toBe("polite");
    expect(queuedFeedback.get(".automatic-analysis-spinner").attributes("aria-hidden")).toBe("true");
    expect(queuedFeedback.get("[data-automatic-analysis-bar]").attributes("aria-hidden")).toBe("true");
    expect(queuedFeedback.element.previousElementSibling).toBe(queuedWrapper.get(".factor-setup-heading").element);
    expect(queuedFeedback.element.nextElementSibling).toBe(queuedWrapper.get(".table-scroll").element);
    expect(queuedWrapper.find("thead [data-automatic-analysis-progress]").exists()).toBe(false);
    expect(workspaceButton(queuedWrapper).text()).toBe("Queued");
    expect(workspaceButton(queuedWrapper).attributes("aria-label")).toBe("Measured Data queued for automatic analysis for Measured factor");

    const activeWrapper = mountWithFastStubs({
      session: createModeSession(),
      busy: true,
      editingSetup: false,
      measurementEntryMode: "import",
      automaticAnalysisProgress: {
        factorIds: [HASH_C, HASH_A],
        activeFactorId: HASH_A,
        completedCount: 1,
      },
    });

    const activeFeedback = activeWrapper.get("[data-automatic-analysis-feedback]");
    expect(activeFeedback.get("[data-automatic-analysis-progress]").text()).toBe("Analyzing measured data 2 / 2");
    expect(activeFeedback.find("[data-automatic-analysis-bar]").exists()).toBe(true);
    expect(activeWrapper.find("thead [data-automatic-analysis-progress]").exists()).toBe(false);
    expect(workspaceButton(activeWrapper).text()).toContain("Analyzing");
    expect(workspaceButton(activeWrapper).find("[data-analysis-spinner]").exists()).toBe(true);
    expect(workspaceButton(activeWrapper).attributes("aria-label")).toBe("Analyzing measured data for Measured factor");

    const measuredState = workspaceButton(activeWrapper).attributes("data-measured-state");
    await activeWrapper.setProps({ automaticAnalysisProgress: undefined, busy: false });

    expect(activeWrapper.find("[data-automatic-analysis-feedback]").exists()).toBe(false);
    expect(workspaceButton(activeWrapper).text()).toBe("Measured Data");
    expect(workspaceButton(activeWrapper).attributes("data-measured-state")).toBe(measuredState);
    expect(workspaceButton(activeWrapper).attributes("disabled")).toBeUndefined();
  });
});

describe("FactorInputTable component category", () => {
  const expectedOptions = [
    ["", "Not classified"],
    ["battery-cts", "Battery CTS"],
    ["z-axis-or-around-xy-clearance", "Z-axis or around-XY clearance"],
    ["glass-tdm-gap-or-z-step", "Glass/TDM gap or Z-step"],
    ["thermal-module-critical-path", "Thermal module critical path"],
    ["pcb-critical-clearance-or-alignment", "PCB critical clearance or alignment"],
    ["cover-fit-and-function", "Cover fit and function"],
    ["hinge-trackpad-button-or-sensor", "Hinge, trackpad, button, or sensor"],
    ["cable-routing", "Cable routing"],
    ["external-port-kickstand-logo-or-ssd", "External port, kickstand, logo, or SSD"],
    ["pcb-component-or-fastener", "PCB component or fastener"],
    ["engagement-or-assembly-feature", "Engagement or assembly feature"],
    ["foam-or-gasket-sealing-cushioning-or-nvh", "Foam or gasket sealing, cushioning, or NVH"],
  ] as const;

  function editableSession(categorySource: "setup" | "evidence" | "blank"): F7SessionSnapshot {
    const session = createSession({ status: "factor_setup" });
    const factor = session.factors[0]!;
    session.factors = [{
      ...factor,
      setup: factor.setup
        ? {
            ...factor.setup,
            ...(categorySource === "setup" ? { componentCategory: "battery-cts" as const } : {}),
          }
        : factor.setup,
      evidence: factor.evidence
        ? {
            ...factor.evidence,
            ...(categorySource === "evidence" ? { componentCategory: "cable-routing" as const } : {}),
          }
        : factor.evidence,
    }];
    return session;
  }

  it("renders the blank option plus every controlled component category with engineering labels", () => {
    const wrapper = mountWithFastStubs({
      session: editableSession("blank"),
      busy: false,
      editingSetup: true,
    });

    const select = wrapper.get("[data-component-category]");
    const options = select.findAll("option").map((option) => [option.element.value, option.text()]);
    expect(options).toEqual(expectedOptions.map((option) => [...option]));
    expect(options.slice(1).map(([value]) => value)).toEqual(processRequirementComponentCategorySchema.options);
    expect(wrapper.get("col[data-column-key='componentCategory']").attributes("style")).toContain("140px");
  });

  it.each([
    ["setup", "battery-cts"],
    ["evidence", "cable-routing"],
  ] as const)("backfills an existing %s category", (categorySource, expectedCategory) => {
    const wrapper = mountWithFastStubs({
      session: editableSession(categorySource),
      busy: false,
      editingSetup: true,
    });

    expect(wrapper.get<HTMLSelectElement>("[data-component-category]").element.value).toBe(expectedCategory);
  });

  it("includes a selected category in confirmation payload and omits a blank category", async () => {
    const selectedWrapper = mountWithFastStubs({
      session: editableSession("blank"),
      busy: false,
      editingSetup: true,
    });
    await selectedWrapper.get("[data-component-category]").setValue("thermal-module-critical-path");
    await selectedWrapper.get("#confirm-factor-setup").trigger("click");
    expect(selectedWrapper.emitted("confirmFactors")?.at(-1)?.[0]).toEqual([
      expect.objectContaining({ componentCategory: "thermal-module-critical-path" }),
    ]);

    const blankWrapper = mountWithFastStubs({
      session: editableSession("blank"),
      busy: false,
      editingSetup: true,
    });
    await blankWrapper.get("#confirm-factor-setup").trigger("click");
    expect(blankWrapper.emitted("confirmFactors")?.at(-1)?.[0]).toEqual([
      expect.not.objectContaining({ componentCategory: expect.anything() }),
    ]);
  });

  it("resets category drafts when a new session reuses the same candidate ID", async () => {
    const wrapper = mountWithFastStubs({
      session: editableSession("setup"),
      busy: false,
      editingSetup: true,
    });
    await wrapper.get("[data-component-category]").setValue("pcb-component-or-fastener");

    const replacementSession = editableSession("evidence");
    replacementSession.sessionId = "session-02";
    await wrapper.setProps({ session: replacementSession });

    expect(wrapper.get<HTMLSelectElement>("[data-component-category]").element.value).toBe("cable-routing");
    await wrapper.get("#confirm-factor-setup").trigger("click");
    expect(wrapper.emitted("confirmFactors")?.at(-1)?.[0]).toEqual([
      expect.objectContaining({ componentCategory: "cable-routing" }),
    ]);
  });

  it("defaults user-added factors to blank and reset clears a manually selected category", async () => {
    const wrapper = mountWithFastStubs({
      session: editableSession("blank"),
      busy: false,
      editingSetup: true,
    });
    const importedSelect = wrapper.get<HTMLSelectElement>("[data-component-category]");
    await importedSelect.setValue("cover-fit-and-function");
    await wrapper.get("[data-factor-reset]").trigger("click");
    expect(wrapper.get<HTMLSelectElement>("[data-component-category]").element.value).toBe("");

    await wrapper.get("button[aria-label='Add factor after Factor A']").trigger("click");
    const selects = wrapper.findAll<HTMLSelectElement>("[data-component-category]");
    expect(selects).toHaveLength(2);
    expect(selects[1]!.element.value).toBe("");
  });

  it("preserves category changes through undo and redo snapshots", async () => {
    const wrapper = mountWithFastStubs({
      session: editableSession("evidence"),
      busy: false,
      editingSetup: true,
    });
    const category = () => wrapper.get<HTMLSelectElement>("[data-component-category]").element.value;

    await wrapper.get("[data-component-category]").setValue("pcb-component-or-fastener");
    await wrapper.vm.$nextTick();
    expect(category()).toBe("pcb-component-or-fastener");

    await wrapper.get("[data-factor-undo]").trigger("click");
    await wrapper.vm.$nextTick();
    expect(category()).toBe("cable-routing");

    await wrapper.get("[data-factor-redo]").trigger("click");
    await wrapper.vm.$nextTick();
    expect(category()).toBe("pcb-component-or-fastener");
  });
});
