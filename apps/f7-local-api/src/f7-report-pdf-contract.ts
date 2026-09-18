import { f7ReportProjectionSchema } from "@ai-assist/contracts";
import { z } from "zod";
import { dimensionChainVisualSchema } from "./dimension-chain-visual.js";

export const f7ReportPdfRouteRequestSchema = z.object({
  sessionId: z.string().min(1).max(200),
  report: f7ReportProjectionSchema,
  dimensionChainVisual: dimensionChainVisualSchema.optional(),
}).strict().superRefine((request, context) => {
  if (request.sessionId !== request.report.sessionId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Report sessionId must match the requested sessionId.",
      path: ["report", "sessionId"],
    });
  }
});

export type F7ReportPdfRouteRequest = z.infer<typeof f7ReportPdfRouteRequestSchema>;
