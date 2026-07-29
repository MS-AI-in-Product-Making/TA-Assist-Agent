import { Inflate } from "fflate";
import { createTypedError } from "@ai-assist/contracts";

export const MAX_ARCHIVE_BYTES = 16 * 1024 * 1024;
export const MAX_ZIP_ENTRIES = 1024;
export const MAX_SINGLE_UNCOMPRESSED_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
export const MAX_COMPRESSION_RATIO = 100;
export const MAX_XML_PART_BYTES = 8 * 1024 * 1024;

const REQUIRED_PARTS = ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels"];
const ARCHIVE_SUMMARY = "Workbook-catalog archive cannot be processed.";
const utf8 = new TextDecoder("utf-8", { fatal: true });
const DEFLATE_INPUT_CHUNK_BYTES = 1024;

function archiveError(): Error {
  return createTypedError({
    code: "validation_error",
    summary: ARCHIVE_SUMMARY,
    suggestedAction: "Provide a supported workbook archive.",
    affectedInputReferences: ["workbook-archive"],
  });
}

function fail(): never {
  throw archiveError();
}

function readUint16(view: DataView, offset: number): number {
  if (offset < 0 || offset + 2 > view.byteLength) fail();
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number): number {
  if (offset < 0 || offset + 4 > view.byteLength) fail();
  return view.getUint32(offset, true);
}

function safeEntryName(name: string): boolean {
  return name.length > 0
    && !name.includes("\0")
    && !name.includes("\\")
    && !name.startsWith("/")
    && !/^[A-Za-z]:/.test(name)
    && !name.endsWith("/")
    && !name.split("/").some((part) => part === ".." || part.length === 0);
}

function requiresXmlValidation(name: string): boolean {
  if (name === "[Content_Types].xml" || name === "_rels/.rels") return true;
  if (!name.startsWith("xl/")) return false;
  if (name === "xl/workbook.xml" || name === "xl/sharedStrings.xml") return true;
  if (name === "xl/_rels/workbook.xml.rels") return true;
  if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(name)) return true;
  if (/^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/i.test(name)) return true;
  if (/^xl\/drawings\/drawing\d+\.xml$/i.test(name)) return true;
  if (/^xl\/drawings\/_rels\/drawing\d+\.xml\.rels$/i.test(name)) return true;
  return false;
}

function validateXmlBytes(name: string, bytes: Uint8Array): void {
  if (!name.endsWith(".xml") && !name.endsWith(".rels")) return;
  if (!requiresXmlValidation(name)) return;
  if (bytes.byteLength > MAX_XML_PART_BYTES) fail();
  let xml: string;
  try {
    xml = utf8.decode(bytes);
  } catch {
    fail();
  }
  if (/<!\s*(doctype|entity)\b/i.test(xml)) fail();
  const declarations = xml.match(/<\?xml\s[^?]*\?>/gi) ?? [];
  if (declarations.length > 1) fail();
  const declaration = declarations[0];
  if (declaration && xml.indexOf(declaration) !== 0) fail();
  const withoutDeclaration = declaration ? xml.slice(declaration.length) : xml;
  if (/<\?[\s\S]*?\?>/i.test(withoutDeclaration)) fail();
}

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function inflateBounded(compressed: Uint8Array, declaredSize: number, remainingTotalSize: number): Uint8Array {
  const chunks: Uint8Array[] = [];
  let emittedSize = 0;
  let completed = false;
  const inflater = new Inflate((chunk, final) => {
    emittedSize += chunk.byteLength;
    if (emittedSize > declaredSize || emittedSize > MAX_SINGLE_UNCOMPRESSED_BYTES || emittedSize > remainingTotalSize) fail();
    if (chunk.byteLength > 0) chunks.push(chunk.slice());
    if (final) completed = true;
  });
  for (let offset = 0; offset < compressed.byteLength; offset += DEFLATE_INPUT_CHUNK_BYTES) {
    const end = Math.min(offset + DEFLATE_INPUT_CHUNK_BYTES, compressed.byteLength);
    inflater.push(compressed.subarray(offset, end), end === compressed.byteLength);
  }
  if (!completed || emittedSize !== declaredSize) fail();
  const content = new Uint8Array(emittedSize);
  let offset = 0;
  for (const chunk of chunks) {
    content.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return content;
}

export function readSafeZip(bytes: Uint8Array): ReadonlyMap<string, Uint8Array> {
  try {
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_ARCHIVE_BYTES) fail();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const minimumEocdOffset = Math.max(0, bytes.byteLength - 65_557);
    let eocdOffset = -1;
    for (let offset = bytes.byteLength - 22; offset >= minimumEocdOffset; offset -= 1) {
      if (readUint32(view, offset) === 0x06054b50) {
        eocdOffset = offset;
        break;
      }
    }
    if (eocdOffset < 0 || eocdOffset + 22 + readUint16(view, eocdOffset + 20) !== bytes.byteLength) fail();
    if (eocdOffset >= 20 && readUint32(view, eocdOffset - 20) === 0x07064b50) fail();
    if (readUint16(view, eocdOffset + 4) !== 0 || readUint16(view, eocdOffset + 6) !== 0) fail();
    const entriesOnDisk = readUint16(view, eocdOffset + 8);
    const entries = readUint16(view, eocdOffset + 10);
    const centralSize = readUint32(view, eocdOffset + 12);
    const centralOffset = readUint32(view, eocdOffset + 16);
    if (entriesOnDisk !== entries || entries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff || entries > MAX_ZIP_ENTRIES) fail();
    if (centralOffset + centralSize !== eocdOffset) fail();

    const result = new Map<string, Uint8Array>();
    let offset = centralOffset;
    let totalUncompressed = 0;
    for (let entryIndex = 0; entryIndex < entries; entryIndex += 1) {
      if (readUint32(view, offset) !== 0x02014b50) fail();
      const flags = readUint16(view, offset + 8);
      const method = readUint16(view, offset + 10);
      const crc = readUint32(view, offset + 16);
      const compressedSize = readUint32(view, offset + 20);
      const uncompressedSize = readUint32(view, offset + 24);
      const nameLength = readUint16(view, offset + 28);
      const extraLength = readUint16(view, offset + 30);
      const commentLength = readUint16(view, offset + 32);
      const disk = readUint16(view, offset + 34);
      const localOffset = readUint32(view, offset + 42);
      const recordLength = 46 + nameLength + extraLength + commentLength;
      if (offset + recordLength > centralOffset + centralSize || disk !== 0 || (flags & 0x0009) !== 0 || method !== 0 && method !== 8) fail();
      if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) fail();
      let name: string;
      try {
        name = utf8.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
      } catch {
        fail();
      }
      if (!safeEntryName(name) || result.has(name) || uncompressedSize > MAX_SINGLE_UNCOMPRESSED_BYTES) fail();
      totalUncompressed += uncompressedSize;
      if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES || uncompressedSize / Math.max(compressedSize, 1) > MAX_COMPRESSION_RATIO) fail();
      if (readUint32(view, localOffset) !== 0x04034b50) fail();
      const localFlags = readUint16(view, localOffset + 6);
      const localMethod = readUint16(view, localOffset + 8);
      const localCrc = readUint32(view, localOffset + 14);
      const localCompressedSize = readUint32(view, localOffset + 18);
      const localUncompressedSize = readUint32(view, localOffset + 22);
      const localNameLength = readUint16(view, localOffset + 26);
      const localExtraLength = readUint16(view, localOffset + 28);
      const localNameStart = localOffset + 30;
      const dataStart = localNameStart + localNameLength + localExtraLength;
      if (localFlags !== flags || localMethod !== method || localCrc !== crc || localCompressedSize !== compressedSize || localUncompressedSize !== uncompressedSize || localNameLength !== nameLength || dataStart + compressedSize > centralOffset) fail();
      for (let nameOffset = 0; nameOffset < nameLength; nameOffset += 1) {
        if (bytes[localNameStart + nameOffset] !== bytes[offset + 46 + nameOffset]) fail();
      }
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      let content: Uint8Array;
      try {
        content = method === 0 ? compressed : inflateBounded(compressed, uncompressedSize, MAX_TOTAL_UNCOMPRESSED_BYTES - (totalUncompressed - uncompressedSize));
      } catch {
        fail();
      }
      if (content.byteLength !== uncompressedSize || crc32(content) !== crc) fail();
      validateXmlBytes(name, content);
      result.set(name, content);
      offset += recordLength;
    }
    if (offset !== centralOffset + centralSize || REQUIRED_PARTS.some((part) => !result.has(part))) fail();
    return result;
  } catch (error) {
    if (error instanceof Error && (error as { summary?: string }).summary === ARCHIVE_SUMMARY) throw error;
    throw archiveError();
  }
}