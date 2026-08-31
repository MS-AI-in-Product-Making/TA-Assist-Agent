import { describe, expect, it } from "vitest";

import { createTypedError } from "@ai-assist/contracts";
import { projectWorkspaceIssue } from "./business-status.js";

it("translates internal failures into business language without process labels", () => {
  const issue = projectWorkspaceIssue(undefined, createTypedError({ code: "evidence_mismatch", summary: "f4_running failed", suggestedAction: "retry F4", affectedInputReferences: ["F4"] }));
  expect(issue).toMatchObject({ title: "Analysis data updated", action: "refresh" });
  expect(JSON.stringify(issue)).not.toMatch(/F[0-7]|running|pending|f4_running/);
});

it("explains direction evidence for unavailable calculation", () => {
  expect(projectWorkspaceIssue(undefined, createTypedError({ code: "calculation_not_possible", summary: "direction", suggestedAction: "direction", affectedInputReferences: [] }))).toMatchObject({ title: "Calculation unavailable" });
});
