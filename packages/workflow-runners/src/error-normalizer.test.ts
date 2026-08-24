import { createTypedError } from "@ai-assist/contracts";
import { describe, expect, it } from "vitest";

import { normalizeRunnerError } from "./index.js";

describe("normalizeRunnerError", () => {
  it("preserves known typed errors", () => {
    const error = createTypedError({
      code: "transient_error",
      runId: "d2719b11-3b4c-48f7-b52f-094c6289141f",
      summary: "Temporary worker failure.",
      retryable: true,
      suggestedAction: "Retry the stage.",
      affectedInputReferences: ["F2"],
    });

    expect(normalizeRunnerError(error, { fallbackRunId: "cc2c57cb-a939-42eb-8d7b-a529e454ae1b" })).toBe(error);
  });

  it("maps identity and manifest mismatches to evidence_mismatch", () => {
    const normalized = normalizeRunnerError(new Error("Manifest hash mismatch for workbook identity."), {
      fallbackRunId: "3525452b-fbb7-499a-84f9-cd7d8c0de9ec",
      affectedInputReferences: ["manifest.json", "workbookContentHash"],
    });

    expect(normalized).toMatchObject({
      code: "evidence_mismatch",
      retryable: false,
      affectedInputReferences: ["manifest.json", "workbookContentHash"],
    });
  });

  it("sanitizes unknown failures to internal_error", () => {
    const normalized = normalizeRunnerError("password=secret exploded", {
      fallbackRunId: "3aa8f5eb-b4e8-472e-8cb2-5306f6784fb0",
    });

    expect(normalized).toMatchObject({
      code: "internal_error",
      retryable: false,
    });
    expect(normalized.summary).not.toContain("secret");
  });
});