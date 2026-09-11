/** The reveal affects ocean material only. The original scene fog still owns all ground information. */
export interface SeaRasterLayers {
  width: number; height: number; pixelStep: number;
  bodyPixels: Uint32Array; bodyDepth: Float32Array; bodySurface: Uint8Array;
  fallPixels: Uint32Array; fallDepth: Float32Array;
}
export interface SeaReveal {
  x: number; groundY: number; compression: number; elapsedMs: number;
  /** A full-opacity view is useful for checking geometry without the gameplay reveal. */
  enabled: boolean;
}
const smooth = (x: number) => { const v = Math.max(0, Math.min(1, x)); return v * v * (3 - 2 * v); };

/** Pixels are straight RGBA packed little-endian; greater camera depth is nearer.
 * Each water surface keeps its own depth when the nearer sea partially clears.
 * In particular, this never draws a hidden falling column on top of opaque foreground water.
 */
export function compositeSeaVolume(layers: Readonly<SeaRasterLayers>, output: ImageData, reveal: Readonly<SeaReveal>): void {
  const { width, height, pixelStep, bodyPixels, bodyDepth, bodySurface, fallPixels, fallDepth } = layers;
  const bytes = output.data;
  const centerY = reveal.groundY - 19 / reveal.compression;
  const rx = 164, ry = 114 / reveal.compression, seconds = reveal.elapsedMs / 1000;
  for (let row = 0; row < height; row++) {
    const y = (row + .5) * pixelStep, dy = (y - centerY) / ry;
    for (let col = 0; col < width; col++) {
      const i = row * width + col, target = i * 4;
      const body = bodyPixels[i]!, fall = fallPixels[i]!;
      if (!body && !fall) { bytes[target] = bytes[target + 1] = bytes[target + 2] = bytes[target + 3] = 0; continue; }
      const x = (col + .5) * pixelStep, dx = (x - reveal.x) / rx;
      let bodyAlpha = (body >>> 24) / 255, fallAlpha = (fall >>> 24) / 255;
      if (reveal.enabled && Math.abs(dx) < 1.4 && Math.abs(dy) < 1.4) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Broad, asymmetric material transitions; no bright rim and no clear circular window.
        const edge = distance + .10 * Math.sin(dx * 3.1 + dy * 2.4 + .8)
          + .05 * Math.sin(dx * 7 - dy * 5 + seconds * .07);
        const feather = smooth((edge - .28) / .83);
        const residual = bodySurface[i] === 2 ? .14 : .075;
        bodyAlpha *= residual + (1 - residual) * feather;
        // Only the small actual silhouette is made legible through falling water.
        const silhouette = Math.sqrt(((x - reveal.x) / 26) ** 2 + ((y - centerY) * reveal.compression / 34) ** 2);
        fallAlpha *= .44 + .56 * smooth((silhouette - .35) / .75);
      }
      let front = body, back = fall, fa = bodyAlpha, ba = fallAlpha;
      if (fallDepth[i]! > bodyDepth[i]!) { front = fall; back = body; fa = fallAlpha; ba = bodyAlpha; }
      const underneath = ba * (1 - fa), alpha = fa + underneath;
      if (alpha < .001) { bytes[target] = bytes[target + 1] = bytes[target + 2] = bytes[target + 3] = 0; continue; }
      bytes[target] = ((front & 255) * fa + (back & 255) * underneath) / alpha;
      bytes[target + 1] = (((front >>> 8) & 255) * fa + ((back >>> 8) & 255) * underneath) / alpha;
      bytes[target + 2] = (((front >>> 16) & 255) * fa + ((back >>> 16) & 255) * underneath) / alpha;
      bytes[target + 3] = alpha * 255;
    }
  }
}
