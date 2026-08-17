import { expect, it } from "vitest";
import { featureNotAvailable } from "./feature-placeholder-skill.js";

it("returns the disabled feature dependencies and enablement requirements", () => {
  expect(featureNotAvailable("F6")).toMatchObject({
    code: "feature_not_available",
    featureId: "F6",
    dependencies: [
      "knowledge-base-v1",
      "comparison-engine-v1",
      "interpretation-rules-v1",
    ],
    enablementRequirements: ["approved-knowledge-base"],
  });
});