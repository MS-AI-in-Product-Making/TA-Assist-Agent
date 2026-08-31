export const DEFAULT_SPEC_STEP = 0.001;

export interface SpecificationDraft {
  readonly lowerSpecLimit: number;
  readonly upperSpecLimit: number;
}

export interface SpecificationDraftClampResult extends SpecificationDraft {
  readonly reason?: string;
}

export function specValueFromPointer(input: {
  readonly pointerX: number;
  readonly trackLeft: number;
  readonly trackWidth: number;
  readonly domainStart: number;
  readonly domainEnd: number;
}): number {
  const width = Math.max(input.trackWidth, 1e-9);
  const offset = Math.min(Math.max(input.pointerX - input.trackLeft, 0), width);
  const ratio = offset / width;
  return canonicalNumber(input.domainStart + (input.domainEnd - input.domainStart) * ratio);
}

export function clampSpecDraft(input: SpecificationDraft & { readonly activeField: keyof SpecificationDraft }): SpecificationDraftClampResult {
  if (input.activeField === "lowerSpecLimit" && input.lowerSpecLimit >= input.upperSpecLimit) {
    return {
      lowerSpecLimit: canonicalNumber(input.upperSpecLimit - DEFAULT_SPEC_STEP),
      upperSpecLimit: input.upperSpecLimit,
      reason: "LSL must stay below USL.",
    };
  }
  if (input.activeField === "upperSpecLimit" && input.upperSpecLimit <= input.lowerSpecLimit) {
    return {
      lowerSpecLimit: input.lowerSpecLimit,
      upperSpecLimit: canonicalNumber(input.lowerSpecLimit + DEFAULT_SPEC_STEP),
      reason: "USL must stay above LSL.",
    };
  }
  return {
    lowerSpecLimit: canonicalNumber(input.lowerSpecLimit),
    upperSpecLimit: canonicalNumber(input.upperSpecLimit),
  };
}

export function stepSpecValue(input: SpecificationDraft & { readonly activeField: keyof SpecificationDraft; readonly direction: -1 | 1; readonly step?: number }): SpecificationDraftClampResult {
  const step = input.step ?? DEFAULT_SPEC_STEP;
  return clampSpecDraft({
    lowerSpecLimit: input.activeField === "lowerSpecLimit" ? canonicalNumber(input.lowerSpecLimit + step * input.direction) : input.lowerSpecLimit,
    upperSpecLimit: input.activeField === "upperSpecLimit" ? canonicalNumber(input.upperSpecLimit + step * input.direction) : input.upperSpecLimit,
    activeField: input.activeField,
  });
}

function canonicalNumber(value: number): number {
  return Number(value.toFixed(12));
}