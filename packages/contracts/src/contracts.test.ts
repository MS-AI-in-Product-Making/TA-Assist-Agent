import { describe, expect, it } from "vitest";
import {
  dataClassificationSchema,
  errorCodeSchema,
  runRequestSchema,
  skillResultSchema,
  typedErrorSchema,
} from "./index.js";

describe("Phase 0 contracts", () => {
  it("accepts a classified run request", () => {
    expect(
      runRequestSchema.parse({
        contractVersion: "v1",
        projectId: "demo-project",
        userId: "demo-user",
        sessionId: "demo-session",
        inputClassification: "public",
        retainConfidentialArtifacts: false,
      }).projectId,
    ).toBe("demo-project");
  });

  it("rejects an error without run_id", () => {
    expect(() => typedErrorSchema.parse({ code: "policy_denied" })).toThrow();
  });

  it("allows only the supported data classifications", () => {
    expect(dataClassificationSchema.parse("confidential")).toBe("confidential");
    expect(() => dataClassificationSchema.parse("restricted")).toThrow();
  });

  it("allows only the supported error codes", () => {
    expect(errorCodeSchema.parse("transient_error")).toBe("transient_error");
    expect(() => errorCodeSchema.parse("unknown_error")).toThrow();
  });

  it("accepts a skill result with evidence and structured output", () => {
    expect(
      skillResultSchema.parse({
        contractVersion: "v1",
        skillId: "smoke",
        outputClassification: "internal",
        evidenceReferences: ["fixture://public/smoke"],
        output: { passed: true },
      }).output,
    ).toEqual({ passed: true });
  });
});