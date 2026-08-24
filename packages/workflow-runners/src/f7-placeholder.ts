import { f7PlaceholderStatusSchema } from "@ai-assist/contracts";

import type { F7PlaceholderOptions } from "./types.js";

export function getF7PlaceholderStatus(_options: F7PlaceholderOptions = {}) {
  return f7PlaceholderStatusSchema.parse({
    contractVersion: "f7-workbench-placeholder-v1",
    status: "feature_not_available",
    lifecycle: "in_development",
  });
}