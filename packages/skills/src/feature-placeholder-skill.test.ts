import { expect, it } from "vitest";
import { featureNotAvailable } from "./feature-placeholder-skill.js";

it("returns the disabled feature dependencies and enablement requirements", () => {
  expect(featureNotAvailable("F4")).toMatchObject({
    code: "feature_not_available",
    featureId: "F4",
    dependencies: ["calculation-worker-v1"],
    enablementRequirements: ["approved-windows-excel-worker"],
  });
});