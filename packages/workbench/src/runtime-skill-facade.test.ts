import { describe, expect, it } from "vitest";

import {
  TA_RUNTIME_SKILLS,
  validateRuntimeSkillInvocation,
  type RuntimeSkillInvocation,
} from "./runtime-skill-facade.js";

describe("runtime skill facade metadata", () => {
  it("declares stable TA runtime skill metadata", () => {
    expect(TA_RUNTIME_SKILLS.map((skill) => skill.skillId)).toEqual([
      "knowledge-and-rules-validation-v1",
      "workbook-scope-discovery-v1",
      "workbook-analysis-assets-v1",
      "analysis-input-validation-v1",
      "dimension-traceability-review-v1",
      "ado-governance-publication-v1",
      "tolerance-performance-calculation-v1",
      "engineering-interpretation-v1",
      "improvement-evaluation-v1",
      "engineering-summary-report-v1",
      "ta-product-export-v1",
    ]);
  });
});

describe("validateRuntimeSkillInvocation", () => {
  const validInvocation: RuntimeSkillInvocation<{ readonly stage: string }> = {
    inputRevision: 3,
    idempotencyKey: "attempt-1:f4-running",
    artifactReferences: [{ artifactId: "f2-report", kind: "f2_report", revision: 3, validated: true }],
    worksheetScope: {
      workbookContentHash: "a".repeat(64),
      selectedWorksheetNames: ["Analysis-A"],
      confirmed: true,
      provenance: "user",
    },
    input: { stage: "f4_running" },
  };

  it("accepts valid invocation", () => {
    expect(() => validateRuntimeSkillInvocation(validInvocation)).not.toThrow();
  });

  it("rejects invalid revision, idempotency key, artifact references, and worksheet scope", () => {
    expect(() => validateRuntimeSkillInvocation({
      ...validInvocation,
      inputRevision: -1,
      idempotencyKey: "",
      artifactReferences: [{ artifactId: "", kind: "f2_report", revision: -1, validated: true }],
      worksheetScope: {
        workbookContentHash: "",
        selectedWorksheetNames: ["", "Analysis-A", "Analysis-A"],
        confirmed: true,
        provenance: "user",
      },
    })).toThrow(/runtime skill invocation/i);
  });
});
