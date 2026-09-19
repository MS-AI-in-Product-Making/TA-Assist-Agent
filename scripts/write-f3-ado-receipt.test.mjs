import { describe, expect, it } from "vitest";
import { parseF3AdoReceiptArgs } from "./write-f3-ado-receipt.mjs";

const validArgs = [
  "test/demo-output/feature3-output",
  "--operation", "updated",
  "--organization", "1ES4Devices",
  "--project", "MechanicalEngineering",
  "--work-item-id", "1119364",
  "--verified-at", "2026-09-18T06:32:13.057Z",
];

describe("parseF3AdoReceiptArgs", () => {
  it("parses a complete validated Surface receipt without retaining a URL", () => {
    const parsed = parseF3AdoReceiptArgs(validArgs);

    expect(parsed.receipt).toEqual({
      operation: "updated",
      targetIdentity: {
        organization: "1ES4Devices",
        project: "MechanicalEngineering",
        workItemId: 1119364,
      },
      verifiedAt: "2026-09-18T06:32:13.057Z",
    });
    expect(JSON.stringify(parsed)).not.toContain("visualstudio.com");
  });

  it.each([
    ["URL identity", ["--organization", "https://1es4devices.visualstudio.com"]],
    ["timestamp without offset", ["--verified-at", "2026-09-18T06:32:13.057"]],
    ["non-positive work item", ["--work-item-id", "0"]],
  ])("rejects %s", (_case, [option, value]) => {
    const args = [...validArgs];
    args[args.indexOf(option) + 1] = value;

    expect(() => parseF3AdoReceiptArgs(args)).toThrow();
  });
});