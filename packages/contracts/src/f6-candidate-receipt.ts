import { z } from "zod";

export const F6_CANDIDATE_RECEIPT_FILE_NAME = "Feature6-Candidate-Receipt.json";
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const identity = z.object({ dev: z.number().int(), ino: z.number().int() }).strict();
const inputs = z.object({
  analysisRoot: z.string().min(1),
  workbookFileName: z.string().min(1),
  workbookContentHash: sha256,
  invocationHash: sha256,
  sources: z.record(z.string(), sha256).refine((value) => ["f2", "f4", "f5", "model"].every((key) => key in value)),
  f3AnalysisHash: sha256,
}).strict();

export const f6CandidateIntentSchema = z.object({
  version: z.literal("f6-candidate-intent-v1"),
  internalOnly: z.literal(true),
  status: z.literal("running"),
  owner: identity,
  inputs,
}).strict();

export const f6CandidateReceiptSchema = z.object({
  version: z.literal("f6-candidate-receipt-v1"),
  internalOnly: z.literal(true),
  status: z.literal("validated"),
  owner: identity,
  publicationOwner: identity,
  inputs,
  intentSha256: sha256,
  files: z.record(z.string(), identity.extend({ sha256 }).strict())
    .refine((files) => Object.keys(files).length === 5),
}).strict();
