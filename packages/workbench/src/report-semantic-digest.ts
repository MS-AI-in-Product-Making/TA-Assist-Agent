import { createHash } from "node:crypto";

import {
  taEngineeringReportProjectionContentSchema,
  type TaEngineeringReportProjectionContent,
} from "@ai-assist/contracts";

const DISPLAY_POINTER_ALLOWLIST = new Set<string>([
  "/title",
]);

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function stripDisplayFields(value: unknown, pointer = ""): unknown {
  if (DISPLAY_POINTER_ALLOWLIST.has(pointer)) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => stripDisplayFields(entry, `${pointer}/${index}`));
  }

  if (value !== null && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      const childPointer = `${pointer}/${key}`;
      const cleaned = stripDisplayFields(entryValue, childPointer);
      if (cleaned !== undefined) {
        next[key] = cleaned;
      }
    }
    return next;
  }

  return value;
}

export function computeTaReportSemanticDigest(input: TaEngineeringReportProjectionContent): string {
  const projection = taEngineeringReportProjectionContentSchema.parse(input);
  const semanticProjection = stripDisplayFields(projection) as TaEngineeringReportProjectionContent;
  return createHash("sha256").update(canonicalJson(semanticProjection)).digest("hex");
}
