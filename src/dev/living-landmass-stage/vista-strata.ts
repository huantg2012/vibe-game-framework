import type { VistaPoint } from './vista-terrain';

export type VistaStratumKind = 'shoulder' | 'ridge' | 'fold' | 'basin' | 'fold-plane' | 'channel';
/** Authoring values live in CSV. These fields describe one continuous bed,
 * including where its exposed crest returns beneath its own sediment. */
export interface VistaStratum extends VistaPoint {
  readonly id: string;
  readonly region: string;
  readonly kind: VistaStratumKind;
  readonly length: number;
  readonly width: number;
  readonly yaw: number;
  readonly rise: number;
  readonly exposure: number;
  readonly sediment: number;
}
export interface VistaStrataSample {
  height: number;
  exposure: number;
  sediment: number;
  fracture: number;
  beddingU: number;
  beddingV: number;
}

/** Mesh-authoring only, never the runtime support source. Crest and lee use
 * the same local frame, so pigment cannot disagree with the shape beneath it. */
export function sampleVistaStrata(x: number, y: number, strata: readonly VistaStratum[]): VistaStrataSample {
  let height = 0, exposure = 0, sediment = .15, fracture = 0, channelCover = 0;
  // One continuous hard-substrate coordinate field. Different material
  // roles keep different scales; adjacent terrain vertices never switch UV
  // charts according to whichever geological influence happens to win.
  const beddingU = (x * .94 + y * .34) / 920;
  const beddingV = (-x * .34 + y * .94) / 760;
  for (const bed of strata) {
    const angle = bed.yaw * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const u = ((x - bed.x) * c + (y - bed.y) * s) / bed.length;
    const v = (-(x - bed.x) * s + (y - bed.y) * c) / bed.width;
    // Finite ends make the exposed body rise and bury again. No periodic
    // ripples or noise determine landform silhouettes.
    const end = Math.max(0, 1 - u * u);
    const along = end * end;
    const isBasin = bed.kind === 'basin' || bed.kind === 'channel';
    // A folded bed is a long inclined hard face with one definite shoulder,
    // rather than a second rounded ridge. Finite ends still bury into ground.
    const cross = bed.kind === 'fold-plane'
      ? Math.max(0, v <= .25 ? (v + 1) / 1.25 : 1 - (v - .25) / .95)
      : Math.exp(-v * v * (isBasin ? 1.4 : 2.2));
    const asymmetric = bed.kind === 'fold' ? 1 + .22 * Math.tanh(v * 2) : 1;
    const weight = along * cross;
    height += bed.rise * weight * asymmetric;
    // A finite exposed shell, with a narrow boundary where the same tilted
    // body emerges from the deposit. The mask is intentionally not a wash.
    const breadth = bed.kind === 'fold-plane' ? .68 : bed.kind === 'shoulder' ? 1.12 : bed.kind === 'ridge' ? 1.85 : 2.9;
    const edge = 1 - u * u - (v + .08) ** 2 * breadth;
    const fade = Math.max(0, Math.min(1, edge / .17));
    const exposed = bed.exposure * fade * fade * (3 - 2 * fade);
    exposure = Math.max(exposure, exposed);
    sediment = Math.max(sediment, bed.sediment * weight);
    if (bed.kind === 'channel') channelCover = Math.max(channelCover, bed.sediment * weight);
    if (!isBasin) {
      // Deposits collect on the lee/root, not in a uniform rock halo.
      sediment = Math.max(sediment, .65 * along * Math.exp(-((v - .9) ** 2) * 8));
      fracture = Math.max(fracture, bed.exposure * along * Math.exp(-((v + .34) ** 2) * 52));
    }
  }
  return { height, exposure: exposure * (1 - channelCover), sediment, fracture, beddingU, beddingV };
}
