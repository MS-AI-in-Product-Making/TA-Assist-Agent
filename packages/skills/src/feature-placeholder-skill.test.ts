import { expect, it } from "vitest";
import { featureNotAvailable } from "./feature-placeholder-skill.js";

it("returns the disabled feature dependencies and enablement requirements", () => {
  expect(featureNotAvailable("F5")).toMatchObject({
    code: "feature_not_available",
    featureId: "F5",
    dependencies: [
      "calculation-worker-v1",
      "knowledge-base-v1",
      "interpretation-rules-v1",
    ],
    enablementRequirements: ["approved-knowledge-base"],
  });
});