export type ReviewContextId = string & { readonly __reviewContextId: unique symbol };

export interface ReviewContextIdentity {
  readonly workbookHash: string;
  readonly downstreamSelectionHash: string;
  readonly baselineRunReference: string;
}
