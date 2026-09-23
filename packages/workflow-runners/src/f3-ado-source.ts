export function formatF3WorksheetSource(source: {
  readonly worksheetName: string;
  readonly sourceRow: number;
}): string {
  return `${source.worksheetName} (Row ${source.sourceRow})`;
}
