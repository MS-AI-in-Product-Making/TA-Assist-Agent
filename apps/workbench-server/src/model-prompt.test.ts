import { describe, expect, it } from "vitest";

import { taModelContextEnvelopeSchema } from "@ai-assist/contracts";

import { buildEvidenceLabeledModelPrompt } from "./model-prompt.js";

const SESSION_ID = "68686868-6868-4868-8868-686868686868";

describe("buildEvidenceLabeledModelPrompt", () => {
  it("builds an evidence-labeled prompt with governed F0/F1/F2/F4/Scenario identities", () => {
    const prompt = buildEvidenceLabeledModelPrompt("Explain the current risk.", richContext());

    expect(prompt).toMatchInlineSnapshot(`
      "User request
      Explain the current risk.

      Governed evidence
      - Session: 68686868-6868-4868-8868-686868686868 (revision 5, inputRevision 2)
      - Worksheet: Analysis-A
      - Selected factor identity: factor-table-1 / row 14 / Gap X
      - Scenario identity: what-if:current
      - Related artifact IDs: f2-current, f4-current, f1-current-image
      - F0 knowledge excerpts (1 of 1):
        - {\"factorName\":\"Gap X\",\"tableId\":\"factor-table-1\",\"sourceRow\":14,\"capabilityStatus\":\"in_library_recommended\",\"f0KnowledgeBaseVersion\":\"v1\",\"summary\":\"F0 public guidance in_library_recommended for Gap X.\",\"recommendation\":{\"kind\":\"public\",\"capabilityEntryId\":\"cap-gap-x\",\"toleranceMin\":0.1,\"toleranceMax\":0.4,\"unit\":\"mm\",\"distribution\":\"normal\"}}
      - F1 managed image reference:
        - {\"artifactId\":\"f1-current-image\",\"worksheetName\":\"Analysis-A\",\"contentHash\":\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\",\"mediaType\":\"image/png\",\"description\":\"Tolerance loop image for Analysis-A\"}
      - F2 factor table excerpts (1 of 1):
        - {\"factorName\":\"Gap X\",\"tableId\":\"factor-table-1\",\"sourceRow\":14,\"partName\":\"Display cover\",\"unit\":\"mm\",\"nominalValue\":1.2,\"upperTolerance\":0.2,\"lowerTolerance\":-0.2,\"distribution\":\"normal\",\"mean\":1.2,\"tolerance\":0.4,\"oneSigma\":0.05,\"contribution\":0.42}
      - F4 baseline metrics:
        - {\"calculationReference\":\"f4-run-current\",\"mean\":1.2,\"rssSigma\":0.08,\"cp\":1.4,\"cpkL\":1.2,\"cpkU\":1.5,\"cpk\":1.2,\"statisticalMargin\":0.3,\"worstCaseMargin\":0.2,\"lowerSpecLimit\":0.6,\"upperSpecLimit\":1.8,\"yield\":0.999,\"dpm\":1000,\"statisticalLower\":0.96,\"statisticalUpper\":1.44,\"worstCaseLower\":1,\"worstCaseUpper\":1.4}
      - Scenario metrics:
        - {\"calculationReference\":\"what-if:current\",\"mean\":1.25,\"rssSigma\":0.07,\"cp\":1.5,\"cpkL\":1.3,\"cpkU\":1.6,\"cpk\":1.3,\"statisticalMargin\":0.35,\"worstCaseMargin\":0.25}

      Open interpretation
      - Explain risk, likely drivers, and trade-offs only from the governed evidence above.
      - Clearly label any causal explanation, prioritization, or recommendation as interpretation rather than governed fact.
      - Do not claim direct workbook, filesystem, or unmanaged image access.

      Missing evidence
      - None identified in the current governed context.

      Suggested checks
      - Compare baseline f4-run-current against Scenario what-if:current before recommending changes.
      - Confirm the selected factor identity factor-table-1 / row 14 / Gap X against the current worksheet review.
      - If the answer depends on evidence outside these excerpts, say that it is missing instead of inferring it."
    `);
  });

  it("reports unavailable F1 access as missing evidence while keeping image access managed", () => {
    const prompt = buildEvidenceLabeledModelPrompt("Summarize the worksheet.", taModelContextEnvelopeSchema.parse({
      contractVersion: "ta-model-context-envelope-v1",
      session: { sessionId: SESSION_ID, revision: 5 },
      inputRevision: 2,
      worksheet: { worksheetName: "Analysis-A" },
      f0Knowledge: [],
      factorTable: [],
      baselineMetrics: {
        inputRevision: 2,
        calculationReference: "f4-run-current",
        mean: 1.2,
        rssSigma: 0.08,
        cp: 1.4,
        cpkL: 1.2,
        cpkU: 1.5,
        cpk: 1.2,
        statisticalMargin: 0.3,
        worstCaseMargin: 0.2,
      },
      relatedArtifactIds: ["f2-current", "f4-current"],
    }));

    expect(prompt).toContain("Missing evidence");
    expect(prompt).toContain("F1 managed image reference is unavailable in the current governed context.");
    expect(prompt).not.toContain("managed/");
    expect(prompt).not.toContain("C:\\");
  });

  it("treats unsupported or inaccessible F1 image references as missing evidence", () => {
    const legacyContext = {
      ...richContext(),
      toleranceLoopImage: {
        ...richContext().toleranceLoopImage!,
        mediaType: "application/octet-stream",
        description: "Tolerance loop export token=abc123",
      },
    } as const;

    const prompt = buildEvidenceLabeledModelPrompt("Summarize the worksheet.", legacyContext as never);

    expect(prompt).toContain("Missing evidence");
    expect(prompt).toContain("F1 managed image reference is unavailable in the current governed context.");
    expect(prompt).not.toContain('"mediaType":"application/octet-stream"');
    expect(prompt).not.toContain("token=abc123");
  });

  it("redacts credential-like metadata from governed evidence excerpts", () => {
    const prompt = buildEvidenceLabeledModelPrompt("Explain the current risk.", {
      ...richContext(),
      f0Knowledge: [{
        ...richContext().f0Knowledge[0]!,
        summary: "Engineering note Authorization: Bearer demo-token stays outside prompt context.",
      }],
      toleranceLoopImage: {
        ...richContext().toleranceLoopImage!,
        description: "api key: demo-key",
      },
      factorTable: [{
        ...richContext().factorTable[0]!,
        notes: "password=demo-value",
      }],
    } as never);

    expect(prompt).toContain("[redacted credential]");
    expect(prompt).not.toContain("demo-token");
    expect(prompt).not.toContain("demo-key");
    expect(prompt).not.toContain("demo-value");
  });
});

function richContext() {
  return taModelContextEnvelopeSchema.parse({
    contractVersion: "ta-model-context-envelope-v1",
    session: { sessionId: SESSION_ID, revision: 5 },
    inputRevision: 2,
    worksheet: {
      worksheetName: "Analysis-A",
      tableId: "factor-table-1",
      sourceRow: 14,
      factorName: "Gap X",
      calculationReference: "what-if:current",
    },
    f0Knowledge: [{
      inputRevision: 2,
      worksheetName: "Analysis-A",
      tableId: "factor-table-1",
      sourceRow: 14,
      factorName: "Gap X",
      capabilityStatus: "in_library_recommended",
      f0KnowledgeBaseVersion: "v1",
      summary: "F0 public guidance in_library_recommended for Gap X.",
      recommendation: { kind: "public", capabilityEntryId: "cap-gap-x", toleranceMin: 0.1, toleranceMax: 0.4, unit: "mm", distribution: "normal" },
    }],
    toleranceLoopImage: {
      artifactId: "f1-current-image",
      kind: "f1_image",
      inputRevision: 2,
      worksheetName: "Analysis-A",
      contentHash: "b".repeat(64),
      mediaType: "image/png",
      description: "Tolerance loop image for Analysis-A",
    },
    factorTable: [{
      inputRevision: 2,
      worksheetName: "Analysis-A",
      tableId: "factor-table-1",
      sourceRow: 14,
      factorName: "Gap X",
      partName: "Display cover",
      unit: "mm",
      nominalValue: 1.2,
      upperTolerance: 0.2,
      lowerTolerance: -0.2,
      distribution: "normal",
      mean: 1.2,
      tolerance: 0.4,
      oneSigma: 0.05,
      contribution: 0.42,
    }],
    baselineMetrics: {
      inputRevision: 2,
      calculationReference: "f4-run-current",
      mean: 1.2,
      rssSigma: 0.08,
      cp: 1.4,
      cpkL: 1.2,
      cpkU: 1.5,
      cpk: 1.2,
      statisticalMargin: 0.3,
      worstCaseMargin: 0.2,
      lowerSpecLimit: 0.6,
      upperSpecLimit: 1.8,
      yield: 0.999,
      dpm: 1000,
      statisticalLower: 0.96,
      statisticalUpper: 1.44,
      worstCaseLower: 1,
      worstCaseUpper: 1.4,
    },
    scenarioMetrics: {
      inputRevision: 2,
      calculationReference: "what-if:current",
      mean: 1.25,
      rssSigma: 0.07,
      cp: 1.5,
      cpkL: 1.3,
      cpkU: 1.6,
      cpk: 1.3,
      statisticalMargin: 0.35,
      worstCaseMargin: 0.25,
    },
    relatedArtifactIds: ["f2-current", "f4-current", "f1-current-image"],
  });
}