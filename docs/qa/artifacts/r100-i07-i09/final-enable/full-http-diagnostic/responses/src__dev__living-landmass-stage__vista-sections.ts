import type { VistaPoint } from './vista-terrain';

export interface VistaSection extends VistaPoint {
  readonly id: string;
  readonly ring: number;
  readonly radius: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly drop: number;
  readonly thickness: number;
}
export interface VistaSectionSample {
  offsetX: number;
  offsetY: number;
  drop: number;
  thickness: number;
}

/** A localized broken bed deforms the one closed cliff mesh. It is never a
 * second coincident skin, which would z-fight with the underlying section.
 * Fixed-direction offsets taper smoothly to zero at the authored span ends. */
export function sampleVistaSections(x: number, y: number, ring: number,
  sections: readonly VistaSection[]): VistaSectionSample {
  let offsetX = 0, offsetY = 0, drop = 0, thickness = 0;
  for (const section of sections) {
    if (section.ring !== ring) continue;
    const distance = Math.hypot(x - section.x, y - section.y) / section.radius;
    if (distance >= 1) continue;
    const strength = (1 - distance * distance) ** 2;
    offsetX += section.offsetX * strength;
    offsetY += section.offsetY * strength;
    drop += (section.drop + Math.sin((x + y * .4) / 125) * 7) * strength;
    thickness += section.thickness * strength;
  }
  return { offsetX, offsetY, drop, thickness };
}
