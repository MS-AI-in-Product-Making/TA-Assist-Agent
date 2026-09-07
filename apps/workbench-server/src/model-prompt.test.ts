import { describe, expect, it } from "vitest";

import { taModelContextEnvelopeSchema } from "@ai-assist/contracts";

import { buildEvidenceLabeledModelPrompt } from "./model-prompt.js";

const SESSION_ID = "68686868-6868-4868-8868-686868686868";
const ENGLISH_LOCK = { languageTag: "en-US", uiCatalogLanguage: "en", lockedAtTurnId: "turn-en", source: "workflow_start", fallbackUsed: false } as const;
const CHINESE_LOCK = { languageTag: "zh-CN", uiCatalogLanguage: "zh", lockedAtTurnId: "turn-zh", source: "workflow_start", fallbackUsed: false } as const;

describe("buildEvidenceLabeledModelPrompt", () => {
  it("uses product capability names and follows the locked session language across turns", () => {
    const englishPrompt = buildEvidenceLabeledModelPrompt("请解释工作表 Housing 的当前风险。", richContext(), ENGLISH_LOCK);
    const chinesePrompt = buildEvidenceLabeledModelPrompt("Explain the current risk for worksheet Housing.", richContext(), CHINESE_LOCK);

    expect(englishPrompt).toContain("Respond entirely in English");
    expect(englishPrompt).toContain("Knowledge Library excerpts");
    expect(englishPrompt).toContain("Data Parsing managed image reference");
    expect(englishPrompt).toContain("Data Cleaning factor table excerpts");
    expect(englishPrompt).toContain("TA Calculation baseline metrics");
    expect(englishPrompt).not.toMatch(/\bF[0-7]\b/u);
    expect(chinesePrompt).toContain("全部使用中文回答");
    expect(chinesePrompt).toContain("知识库摘录");
    expect(chinesePrompt).not.toMatch(/\bF[0-7]\b/u);
  });

  it("projects legacy stage references before they enter the model prompt", () => {
    const englishPrompt = buildEvidenceLabeledModelPrompt("Explain the Feature 6 result.", richContext(), ENGLISH_LOCK);
    const chinesePrompt = buildEvidenceLabeledModelPrompt("请解释 F5 结果。", richContext(), CHINESE_LOCK);

    expect(englishPrompt).toContain("Explain the Design Optimization result.");
    expect(englishPrompt).not.toContain("Feature 6");
    expect(chinesePrompt).toContain("请解释 结果解读 结果。");
    expect(chinesePrompt).not.toContain("F5");
  });

  it("builds an evidence-labeled prompt with governed capability and Scenario identities", () => {
    const prompt = buildEvidenceLabeledModelPrompt("Explain the current risk.", richContext(), ENGLISH_LOCK);

    expect(prompt).toContain(`- Session: ${SESSION_ID} (revision 5, inputRevision 2)`);
    expect(prompt).toContain("- Selected factor identity: factor-table-1 / row 14 / Gap X");
    expect(prompt).toContain("- Scenario identity: what-if:current");
    expect(prompt).toContain("Knowledge Library public guidance in_library_recommended for Gap X.");
    expect(prompt).toContain("Open interpretation");
    expect(prompt).toContain("Suggested checks");
    expect(prompt).not.toMatch(/\bF[0-7]\b/u);
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
    }), ENGLISH_LOCK);

    expect(prompt).toContain("Missing evidence");
    expect(prompt).toContain("Data Parsing managed image reference is unavailable in the current governed context.");
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

    const prompt = buildEvidenceLabeledModelPrompt("Summarize the worksheet.", legacyContext as never, ENGLISH_LOCK);

    expect(prompt).toContain("Missing evidence");
    expect(prompt).toContain("Data Parsing managed image reference is unavailable in the current governed context.");
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
    } as never, ENGLISH_LOCK);

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