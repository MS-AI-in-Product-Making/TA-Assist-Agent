export interface ImageCropBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function dimensionChainRasterScale(width: number, height: number): number {
  return Math.min(2, 3200 / width, 2000 / height);
}

export function findDimensionChainContentBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  padding: number,
): ImageCropBounds {
  let minimumX = width;
  let minimumY = height;
  let maximumX = -1;
  let maximumY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const visible = (pixels[offset + 3] ?? 0) > 8
        && ((pixels[offset] ?? 255) < 248 || (pixels[offset + 1] ?? 255) < 248 || (pixels[offset + 2] ?? 255) < 248);
      if (!visible) continue;
      minimumX = Math.min(minimumX, x);
      minimumY = Math.min(minimumY, y);
      maximumX = Math.max(maximumX, x);
      maximumY = Math.max(maximumY, y);
    }
  }

  if (maximumX < minimumX || maximumY < minimumY) return { x: 0, y: 0, width, height };
  const safePadding = Math.max(0, Math.round(padding));
  const x = Math.max(0, minimumX - safePadding);
  const y = Math.max(0, minimumY - safePadding);
  const right = Math.min(width, maximumX + safePadding + 1);
  const bottom = Math.min(height, maximumY + safePadding + 1);
  return { x, y, width: right - x, height: bottom - y };
}