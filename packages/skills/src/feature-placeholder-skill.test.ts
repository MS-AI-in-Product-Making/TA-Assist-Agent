import { expect, it } from "vitest";
import { featureNotAvailable } from "./feature-placeholder-skill.js";

it("returns the disabled feature dependencies and enablement requirements", () => {
  expect(featureNotAvailable("F7")).toEqual({
    code: "feature_not_available",
    featureId: "F7",
    dependencies: [
      "interpretation-rules-v2",
      "measurement-store-v1",
      "dim-id-service-v1",
    ],
    enablementRequirements: [
      "approved-measurement-store",
      "canonical-dim-id-policy",
    ],
  });
});