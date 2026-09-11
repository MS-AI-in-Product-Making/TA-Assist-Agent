import type { InterpretationKnowledgeSeedPackage } from "@ai-assist/contracts";
import { createReviewedInterpretationRulesV1SeedPackage } from "./interpretation-rules-v1.js";

export function createReviewedInterpretationRulesV2SeedPackage(): InterpretationKnowledgeSeedPackage {
  const seed = structuredClone(createReviewedInterpretationRulesV1SeedPackage());
  seed.manifest.version = "interpretation-rules-v2";
  for (const entry of seed.entries) {
    delete entry.applicability.method;
    entry.provenance.effectiveVersion = "interpretation-rules-v2";
    entry.provenance.changeSummary = "Reviewed TA interpretation guidance published as interpretation rules version 2.";
  }
  const approvedSource = {
    sourceAlias: "user-approved-f0-v2-rules-2026-09-08",
    sourceFileHash: "7f17c9c1cedf3d980832ca1f8c0ee3be670eb69f64bd401f41eecfef7839f63d",
    sourceVersion: "2026-09-08",
    classification: "internal" as const,
    owner: "TA knowledge steward",
  };
  const approvedProvenance = (sourceRange: string) => ({
    ...approvedSource,
    sheetName: "Controlled_Rules",
    sourceRange,
    confidence: 1,
    effectiveVersion: "interpretation-rules-v2" as const,
    changeSummary: "User-approved F0 V2 enhanced interpretation rule published on 2026-09-08.",
  });
  const dominantContributorOption = seed.entries.find(({ entryId }) => entryId === "improvement-reduce-contributor");
  if (dominantContributorOption?.entryType === "improvement-option") {
    dominantContributorOption.provenance = approvedProvenance("A28:A28");
    dominantContributorOption.validationSteps = [
      "Validate the dominant contributor evidence before changing its tolerance or process controls.",
      "Recalculate the tolerance stack after the proposed contributor change.",
      "Confirm the improvement with representative data against the unchanged resolved target.",
    ];
  }
  const common = {
    applicability: { analysisDimension: "one-dimensional" as const },
  };
  seed.sources.push(approvedSource);
  seed.entries.push(
    {
      ...common,
      entryId: "root-cause-excessive-variation",
      entryType: "root-cause-signal",
      title: "RC01 Excessive variation hypothesis",
      description: "Flags total process variation when Cp is below the resolved Cpk target after a below-target result.",
      relatedEntryIds: ["performance-cpk-below-target"],
      provenance: approvedProvenance("A18:A18"),
      signalStatus: "hypothesis",
      requiredFacts: ["cp", "targetCpk"],
      validationFacts: ["representative-variation-evidence"],
      activationCondition: { kind: "cp-below-target" },
    },
    {
      ...common,
      entryId: "root-cause-mean-shift",
      entryType: "root-cause-signal",
      title: "RC02 Mean shift hypothesis",
      description: "Flags process off-centering when Cp exceeds Cpk and the mean differs from the specification midpoint.",
      relatedEntryIds: ["performance-cpk-below-target"],
      provenance: approvedProvenance("A19:A19"),
      signalStatus: "hypothesis",
      requiredFacts: ["cp", "cpk", "mean", "lowerSpecLimit", "upperSpecLimit"],
      validationFacts: ["mean-evidence", "specification-evidence", "physical-centering-feasibility"],
      activationCondition: {
        kind: "mean-off-center",
        minimumCpCpkGap: 1e-12,
        minimumMeanOffset: 1e-12,
      },
    },
    {
      ...common,
      entryId: "improvement-reduce-variation",
      entryType: "improvement-option",
      title: "Reduce total variation",
      description: "Proposes reducing representative process variation without changing the resolved target.",
      relatedEntryIds: ["root-cause-excessive-variation"],
      provenance: approvedProvenance("A26:A26"),
      expectedImpact: "Increase Cp and Cpk by reducing total variation.",
      tradeoffs: ["May require process, tooling, or supplier capability changes."],
      validationSteps: [
        "Update representative variation evidence.",
        "Rerun the same RSS or Monte Carlo method with unchanged specifications and target.",
        "Confirm Cp and Cpk meet the resolved target using a new representative sample.",
      ],
    },
    {
      ...common,
      entryId: "improvement-center-mean",
      entryType: "improvement-option",
      title: "Center the process mean",
      description: "Proposes shifting the process mean toward the specification midpoint before tightening tolerances.",
      relatedEntryIds: ["root-cause-mean-shift"],
      provenance: approvedProvenance("A27:A27"),
      expectedImpact: "Reduce the Cp-to-Cpk loss caused by process off-centering.",
      tradeoffs: ["Physical centering feasibility requires ME review."],
      validationSteps: [
        "Confirm physical centering feasibility through ME review.",
        "Center toward the specification midpoint while preserving the approved specification.",
        "Rerun the same RSS or Monte Carlo method and confirm Cpk against the unchanged target.",
      ],
    },
    {
      ...common,
      entryId: "improvement-relax-final-specification",
      entryType: "improvement-option",
      title: "Relax the final specification as a fallback",
      description: "Considers widening the final specification only after process and tolerance optimization cannot close the capability gap.",
      relatedEntryIds: ["root-cause-excessive-variation"],
      provenance: approvedProvenance("A29:A29"),
      expectedImpact: "Increase capability margin by widening the approved final specification.",
      tradeoffs: ["Changes the product requirement and requires formal engineering approval."],
      validationSteps: [
        "Demonstrate that feasible process and tolerance optimization cannot close the capability gap.",
        "Obtain formal approval from the requirement owner before changing the final specification.",
        "Rerun the tolerance analysis against the approved revised specification.",
      ],
    },
  );
  seed.manifest.sourceCount = seed.sources.length;
  seed.manifest.entryCount = seed.entries.length;
  seed.manifest.entryTypeCounts["root-cause-signal"] += 2;
  seed.manifest.entryTypeCounts["improvement-option"] += 3;
  seed.manifest.sourcesHash = "6406d052501787d753a33b0bb532f654337cf0f75f791cb10eb25466ca08c915";
  seed.manifest.entriesHash = "f315a49e49bd3c4b6c8ebc756d403f897b1a88645d8fb7785bba6fc44ca1e8f6";
  seed.manifest.contentHash = "47a1e85ee7828169c6de2327648fccca0a071c11eb21e539badffa787304bfae";
  return seed;
}