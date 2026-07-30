import type { InterpretationKnowledgeSeedPackage as ContractInterpretationKnowledgeSeedPackage } from "@ai-assist/contracts";

export type DeepReadonly<Value> = Value extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : Value extends object
    ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
    : Value;

export type InterpretationKnowledgeSeedPackage = ContractInterpretationKnowledgeSeedPackage;

export type InterpretationKnowledgeSnapshot = DeepReadonly<InterpretationKnowledgeSeedPackage>;