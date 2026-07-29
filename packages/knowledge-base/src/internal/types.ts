import type {
  InternalToleranceGuidanceEntry,
  InternalToleranceGuidanceManifest,
  InternalToleranceGuidanceSourceMetadata,
} from "@ai-assist/contracts";

export interface InternalKnowledgeSeedPackage {
  manifest: InternalToleranceGuidanceManifest;
  sources: InternalToleranceGuidanceSourceMetadata[];
  entries: InternalToleranceGuidanceEntry[];
}

type DeepReadonly<Value> = Value extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : Value extends object
    ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
    : Value;

export type InternalKnowledgeSnapshot = DeepReadonly<InternalKnowledgeSeedPackage>;
