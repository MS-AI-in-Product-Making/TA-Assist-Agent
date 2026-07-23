import { describe, expect, it } from "vitest";
import { typedErrorSchema } from "@ai-assist/contracts";
import { createAnonymousWorkbookZip } from "./test-support.js";
import { MAX_ARCHIVE_BYTES, MAX_SINGLE_UNCOMPRESSED_BYTES, MAX_ZIP_ENTRIES, readSafeZip } from "./zip-security.js";

const ARCHIVE_SUMMARY = "Workbook-catalog archive cannot be processed.";

function expectSafeArchiveError(action: () => unknown): void {
  try {
    action();
  } catch (error) {
    const typed = error as Error & { affectedInputReferences?: string[] };
    expect(typedErrorSchema.safeParse(error).success).toBe(true);
    expect(typed).toMatchObject({ code: "validation_error", summary: ARCHIVE_SUMMARY });
    expect(typed.message).not.toContain("anonymous-private-marker");
    expect(typed.affectedInputReferences?.join(" ")).not.toContain("anonymous-private-marker");
    return;
  }
  throw new Error("Expected archive validation error.");
}

interface ZipLayout { readonly eocdOffset: number; readonly centralOffset: number; readonly firstCentralOffset: number; readonly firstLocalOffset: number; }

function variedText(length: number): string {
  let value = 0x12345678;
  let result = "";
  for (let index = 0; index < length; index += 1) {
    value = (value * 1664525 + 1013904223) >>> 0;
    result += String.fromCharCode(65 + (value % 26));
  }
  return result;
}

function layout(bytes: Uint8Array): ZipLayout {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = bytes.byteLength - 22;
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  return { eocdOffset, centralOffset, firstCentralOffset: centralOffset, firstLocalOffset: view.getUint32(centralOffset + 42, true) };
}

function mutateArchive(mutation: (view: DataView, layout: ZipLayout) => void): Uint8Array {
  const archive = createAnonymousWorkbookZip().slice();
  mutation(new DataView(archive.buffer, archive.byteOffset, archive.byteLength), layout(archive));
  return archive;
}

function centralEntryOffsets(bytes: Uint8Array): number[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = bytes.byteLength - 22;
  const entries = view.getUint16(eocdOffset + 10, true);
  const offsets: number[] = [];
  let offset = view.getUint32(eocdOffset + 16, true);
  for (let entryIndex = 0; entryIndex < entries; entryIndex += 1) {
    offsets.push(offset);
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  return offsets;
}

function exceedTotalSize(): Uint8Array {
  const archive = createAnonymousWorkbookZip().slice();
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  for (const offset of centralEntryOffsets(archive).slice(0, 5)) view.setUint32(offset + 24, MAX_SINGLE_UNCOMPRESSED_BYTES, true);
  return archive;
}

function underreportedDeflatePayload(): Uint8Array {
  const marker = "anonymous-private-marker";
  const archive = createAnonymousWorkbookZip({ binaryParts: { "xl/oversized.bin": new TextEncoder().encode(marker + "0".repeat(MAX_SINGLE_UNCOMPRESSED_BYTES)) } }).slice();
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  for (const centralOffset of centralEntryOffsets(archive)) {
    const nameLength = view.getUint16(centralOffset + 28, true);
    const name = new TextDecoder().decode(archive.slice(centralOffset + 46, centralOffset + 46 + nameLength));
    if (name !== "xl/oversized.bin") continue;
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    view.setUint32(centralOffset + 24, compressedSize, true);
    view.setUint32(localOffset + 22, compressedSize, true);
    return archive;
  }
  throw new Error("Expected oversized test entry.");
}

describe("safe OOXML archive reader", () => {
  it("returns required OOXML parts from an anonymous in-memory archive", () => {
    const parts = readSafeZip(createAnonymousWorkbookZip());
    expect(parts.get("xl/workbook.xml")).toBeInstanceOf(Uint8Array);
  });

  it.each([
    ["unsafe traversal", createAnonymousWorkbookZip({ unsafeEntryName: "../anonymous-private-marker.xml" })],
    ["unsafe backslash", createAnonymousWorkbookZip({ unsafeEntryName: "xl\\anonymous-private-marker.xml" })],
    ["duplicate entry", createAnonymousWorkbookZip({ duplicateEntryName: true })],
    ["compression ratio", createAnonymousWorkbookZip({ highlyCompressibleEntry: true })],
    ["ZIP64", createAnonymousWorkbookZip({ zip64: true })],
    ["DTD", createAnonymousWorkbookZip({ xmlParts: { "xl/workbook.xml": '<!DOCTYPE marker [<!ENTITY x "anonymous-private-marker">]><workbook/>' } })],
    ["repeated processing instruction", createAnonymousWorkbookZip({ xmlParts: { "xl/workbook.xml": '<?xml version="1.0"?><?anonymous-private-marker data?><workbook/>' } })],
  ])("rejects %s without leaking archive content", (_name, archive) => {
    expectSafeArchiveError(() => readSafeZip(archive));
  });

  it("rejects an oversized archive before parsing", () => {
    expectSafeArchiveError(() => readSafeZip(new Uint8Array(MAX_ARCHIVE_BYTES + 1)));
  });

  it("rejects an XML part larger than one MiB before decoding its content", () => {
    const marker = "xml-size-private-marker";
    const xml = `<?xml version="1.0"?><workbook>${marker}${variedText(1_048_576)}</workbook>`;

    try {
      readSafeZip(createAnonymousWorkbookZip({ xmlParts: { "xl/workbook.xml": xml } }));
    } catch (error) {
      const typed = error as Error & { affectedInputReferences?: string[] };
      expect(typedErrorSchema.safeParse(error).success).toBe(true);
      expect(typed).toMatchObject({ code: "validation_error", summary: ARCHIVE_SUMMARY });
      expect(typed.message).not.toContain(marker);
      expect(typed.affectedInputReferences?.join(" ")).not.toContain(marker);
      return;
    }
    throw new Error("Expected archive validation error.");
  });

  it("rejects an underreported DEFLATE payload without leaking its marker", () => {
    expectSafeArchiveError(() => readSafeZip(underreportedDeflatePayload()));
  });

  it("rejects matching forged CRC values in central and local headers", () => {
    const archive = mutateArchive((view, { firstCentralOffset, firstLocalOffset }) => {
      view.setUint32(firstCentralOffset + 16, 0xdecafbad, true);
      view.setUint32(firstLocalOffset + 14, 0xdecafbad, true);
    });

    expectSafeArchiveError(() => readSafeZip(archive));
  });

  it.each([
    ["entry count", mutateArchive((view, { eocdOffset }) => view.setUint16(eocdOffset + 10, MAX_ZIP_ENTRIES + 1, true))],
    ["per-entry size", mutateArchive((view, { firstCentralOffset }) => view.setUint32(firstCentralOffset + 24, MAX_SINGLE_UNCOMPRESSED_BYTES + 1, true))],
    ["total size", exceedTotalSize()],
    ["encrypted flag", mutateArchive((view, { firstCentralOffset }) => view.setUint16(firstCentralOffset + 8, 1, true))],
    ["unsupported compression method", mutateArchive((view, { firstCentralOffset }) => view.setUint16(firstCentralOffset + 10, 99, true))],
    ["empty entry name", mutateArchive((view, { firstCentralOffset }) => view.setUint16(firstCentralOffset + 28, 0, true))],
    ["central and local header disagreement", mutateArchive((view, { firstCentralOffset }) => view.setUint8(firstCentralOffset + 46, "X".charCodeAt(0)))],
  ])("rejects %s metadata before decompression", (_name, archive) => {
    expectSafeArchiveError(() => readSafeZip(archive));
  });

  it.each([
    ["absolute entry name", "/anonymous-private-marker.xml"],
    ["drive-qualified entry name", "C:anonymous-private-marker.xml"],
    ["NUL entry name", "anonymous\0-private-marker.xml"],
    ["directory entry name", "xl/anonymous-private-marker/"],
  ])("rejects %s", (_name, unsafeEntryName) => {
    expectSafeArchiveError(() => readSafeZip(createAnonymousWorkbookZip({ unsafeEntryName })));
  });

  it.each([
    ["missing required part", createAnonymousWorkbookZip({ omittedParts: ["xl/workbook.xml"] })],
    ["invalid UTF-8 XML", createAnonymousWorkbookZip({ binaryParts: { "xl/workbook.xml": new Uint8Array([0xff]) } })],
    ["standalone entity", createAnonymousWorkbookZip({ xmlParts: { "xl/workbook.xml": '<?xml version="1.0"?><!ENTITY marker "anonymous-private-marker"><workbook/>' } })],
  ])("rejects %s without leaking archive content", (_name, archive) => {
    expectSafeArchiveError(() => readSafeZip(archive));
  });
});