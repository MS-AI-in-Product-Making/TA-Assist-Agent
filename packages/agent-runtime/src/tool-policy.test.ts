import { describe, expect, it } from "vitest";

import { createToolPolicy } from "./tool-policy.js";

describe("createToolPolicy", () => {
  it("exposes read-only tools and UI proposals to the model", () => {
    const policy = createToolPolicy({ state: "review_required" });

    expect(policy.modelTools.map((tool) => tool.name)).toEqual([
      "read_status",
      "read_evidence",
      "explain_blocker",
      "propose_navigation",
      "open_what_if",
      "open_report",
    ]);
  });

  it("never exposes governed write commands to the model", () => {
    const policy = createToolPolicy({ state: "ado_decision_required" });

    expect(policy.modelTools.some((tool) => /confirm|write|delete|export/i.test(tool.name))).toBe(false);
    expect(policy.blockedCapabilities).toContain("surface_write");
  });
});