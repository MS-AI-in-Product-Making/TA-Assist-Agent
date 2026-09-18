import { z } from "zod";

export interface AnalysisRequestContext {
  requestedAt: string;
  utcOffsetMinutes: number;
  source: "web" | "vscode" | "cli";
}

export const analysisRequestContextSchema: z.ZodType<AnalysisRequestContext> = z
  .object({
    requestedAt: z.string().datetime({ offset: true }),
    utcOffsetMinutes: z.number().int().min(-840).max(840),
    source: z.enum(["web", "vscode", "cli"]),
  })
  .strict();