import { z } from "zod";

const PNG_DATA_URL_PREFIX = "data:image/png;base64,";
const MAX_DIMENSION_CHAIN_IMAGE_BYTES = 768 * 1024;
const MAX_DIMENSION_CHAIN_IMAGE_DIMENSION = 4096;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_DIMENSION_CHAIN_PIXELS = 16_000_000;

function pngCrc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readPngDimensions(bytes: Buffer): { readonly width: number; readonly height: number } | undefined {
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return undefined;
  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let sawHeader = false;
  let sawData = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) return undefined;
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const typeAndData = bytes.subarray(offset + 4, offset + 8 + length);
    if (pngCrc32(typeAndData) !== bytes.readUInt32BE(offset + 8 + length)) return undefined;
    if (!sawHeader) {
      if (type !== "IHDR" || length !== 13) return undefined;
      width = bytes.readUInt32BE(offset + 8);
      height = bytes.readUInt32BE(offset + 12);
      if (width === 0 || height === 0) return undefined;
      sawHeader = true;
    } else if (type === "IHDR") {
      return undefined;
    }
    if (type === "IDAT") sawData = true;
    if (type === "IEND") {
      if (length !== 0 || !sawData || chunkEnd !== bytes.length) return undefined;
      return { width, height };
    }
    offset = chunkEnd;
  }
  return undefined;
}

export const dimensionChainVisualSchema = z.union([
  z.object({ status: z.literal("empty") }).strict(),
  z.object({
    status: z.literal("image"),
    mediaType: z.literal("image/png"),
    dataUrl: z.string().startsWith(PNG_DATA_URL_PREFIX).max(1_100_000),
    width: z.number().int().positive().max(MAX_DIMENSION_CHAIN_IMAGE_DIMENSION),
    height: z.number().int().positive().max(MAX_DIMENSION_CHAIN_IMAGE_DIMENSION),
  }).strict().superRefine((visual, context) => {
    const encoded = visual.dataUrl.slice(PNG_DATA_URL_PREFIX.length);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
      context.addIssue({ code: "custom", message: "Dimension Chain image must use canonical base64.", path: ["dataUrl"] });
      return;
    }
    const bytes = Buffer.from(encoded, "base64");
    const dimensions = bytes.length <= MAX_DIMENSION_CHAIN_IMAGE_BYTES ? readPngDimensions(bytes) : undefined;
    if (!dimensions
      || dimensions.width !== visual.width
      || dimensions.height !== visual.height
      || dimensions.width > MAX_DIMENSION_CHAIN_IMAGE_DIMENSION
      || dimensions.height > MAX_DIMENSION_CHAIN_IMAGE_DIMENSION
      || dimensions.width * dimensions.height > MAX_DIMENSION_CHAIN_PIXELS) {
      context.addIssue({ code: "custom", message: "Dimension Chain image must be a valid controlled PNG.", path: ["dataUrl"] });
    }
  }),
]);

export type DimensionChainVisual = z.infer<typeof dimensionChainVisualSchema>;

export function renderDimensionChainVisual(visual: DimensionChainVisual): string {
  if (visual.status === "empty") return '<div class="dimension-chain-visual-empty" data-dimension-chain-visual-empty></div>';
  return `<figure class="dimension-chain-visual" data-dimension-chain-visual><img src="${visual.dataUrl}" width="${visual.width}" height="${visual.height}" alt="Dimension Chain as displayed in the Web workspace"></figure>`;
}
