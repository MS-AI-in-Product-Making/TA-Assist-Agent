export const configuredFeature1Jobs = Object.freeze([
  Object.freeze({ workbookPath: "test/Maera_gap_TP_brkt_and _battery_20260305V1.xlsx" }),
  Object.freeze({
    workbookPath: "test/Maera_cosmetic_critical_TA - Rev E.xlsx",
    selectedManifestPath: "test/demo-output/maera-selected-worksheets-factor-tables.full.json",
  }),
  Object.freeze({
    workbookPath: "test/Meara TP TA_20241030-v0.xlsx",
    selectedManifestPath: "test/demo-output/meara-selected-worksheets-factor-tables.full.json",
  }),
]);

export function resolveFeature1Jobs(args, configuredJobs) {
  if (args.length > 1) {
    throw new Error("Feature 1 workflow accepts at most one workbook path.");
  }

  if (args.length === 1) {
    return [{ workbookPath: args[0] }];
  }

  return configuredJobs;
}