/** Read-only bridge from durable exposure to the accepted two-family material.
 * Geometry consumes typedFraction separately: unknown sources may bend the body,
 * but must never impersonate a known fibre or membrane organism.
 */
import { R100_WORLD_APPEARANCES } from '@/generated/r100-world-appearance';
import { resolveEnemyWorldAdaptation } from '@/entities/form-renderers/d/world-adaptation';
import type { AssimilationSources } from '@/systems/assimilation-system';
import {
  ASSIMILATION_NEUTRAL_PALETTE, getAssimilationLookPalettes,
  type AssimilationLookState, type AssimilationPalette,
} from './assimilation-appearance';

type Color = [number, number, number];
type MutablePalette = { dark: Color; mid: Color; light: Color };
type MutableLook = { -readonly [K in keyof AssimilationLookState]: AssimilationLookState[K] };
type Source = { kind: 'fibre' | 'membrane' | 'neutral'; palette: AssimilationPalette };
const worldAppearance = new Map(R100_WORLD_APPEARANCES.map(row => [row.worldId, row]));
const sourceCache = new Map<string, Source>();
const colors = ['dark', 'mid', 'light'] as const;
const rgb = (hex: number): Color => [hex >>> 16 & 255, hex >>> 8 & 255, hex & 255];
const emptyPalette = (): MutablePalette => ({ dark: [0, 0, 0], mid: [0, 0, 0], light: [0, 0, 0] });
function sourceOf(worldId: string): Source {
  const known = sourceCache.get(worldId);
  if (known) return known;
  const adaptation = resolveEnemyWorldAdaptation(worldId);
  const solid = worldAppearance.get(worldId)?.solid;
  const source: Source = adaptation && (adaptation.kind === 'fibre' || adaptation.kind === 'membrane') ? { kind: adaptation.kind, palette: adaptation }
    : { kind: 'neutral', palette: solid ? { dark: rgb(solid.dark), mid: rgb(solid.mid), light: rgb(solid.light) }
      : ASSIMILATION_NEUTRAL_PALETTE };
  sourceCache.set(worldId, source);
  return source;
}

/** One instance per scene. Stable state/palette objects, no allocation on update. */
export class AssimilationStatePresentation {
  private readonly fibrePalette = emptyPalette();
  private readonly membranePalette = emptyPalette();
  private readonly neutralPalette = emptyPalette();
  private readonly totals = new Float64Array(27);
  private readonly state: MutableLook = {
    amount: 0, fibre: 0, membrane: 0, seconds: 0, motion: false, subjective: false,
    palettes: [this.fibrePalette, this.membranePalette], neutralFraction: 0, neutralPalette: this.neutralPalette,
    paletteRevision: 0,
  };
  readonly look: AssimilationLookState = this.state;
  typedFraction = 0;

  update(assimilation: number, sources: AssimilationSources, seconds: number, motion: boolean, subjective: boolean): void {
    const amount = Number.isFinite(assimilation) ? Math.max(0, Math.min(100, assimilation)) : 0;
    this.totals.fill(0);
    let fibre = 0, membrane = 0, neutralKnown = 0;
    for (const worldId in sources.worlds) {
      if (!Object.prototype.hasOwnProperty.call(sources.worlds, worldId)) continue;
      const points = sources.worlds[worldId]!;
      if (!Number.isFinite(points) || points <= 0) continue;
      const source = sourceOf(worldId);
      const slot = source.kind === 'fibre' ? 0 : source.kind === 'membrane' ? 1 : 2;
      if (slot === 0) fibre += points;
      else if (slot === 1) membrane += points;
      else neutralKnown += points;
      this.accumulate(slot, source.palette, points);
    }
    const typed = fibre + membrane;
    const neutral = Math.max(0, amount - typed);
    this.accumulate(2, ASSIMILATION_NEUTRAL_PALETTE, Math.max(0, neutral - neutralKnown));
    const [defaultFibre, defaultMembrane] = getAssimilationLookPalettes();
    this.finish(0, this.fibrePalette, fibre, defaultFibre);
    this.finish(1, this.membranePalette, membrane, defaultMembrane);
    this.finish(2, this.neutralPalette, neutral, ASSIMILATION_NEUTRAL_PALETTE);
    this.typedFraction = amount > 0 ? Math.min(1, typed / amount) : 0;
    this.state.amount = amount / 100;
    this.state.fibre = typed > 0 ? fibre / typed : 0;
    this.state.membrane = typed > 0 ? membrane / typed : 0;
    this.state.neutralFraction = amount > 0 ? 1 - this.typedFraction : 0;
    this.state.seconds = Number.isFinite(seconds) ? seconds : 0;
    this.state.motion = motion;
    this.state.subjective = subjective;
  }

  private accumulate(slot: number, palette: AssimilationPalette, points: number): void {
    for (let tone = 0; tone < 3; tone++) for (let channel = 0; channel < 3; channel++) {
      const offset = slot * 9 + tone * 3 + channel;
      this.totals[offset] = this.totals[offset]! + palette[colors[tone]!]![channel]! * points;
    }
  }
  private finish(slot: number, target: MutablePalette, points: number, fallback: AssimilationPalette): void {
    for (let tone = 0; tone < 3; tone++) for (let channel = 0; channel < 3; channel++) {
      const next = points > 0 ? this.totals[slot * 9 + tone * 3 + channel]! / points
        : fallback[colors[tone]!]![channel]!;
      if (Math.abs(target[colors[tone]!]![channel]! - next) > 1e-7) {
        target[colors[tone]!]![channel] = next;
        this.state.paletteRevision = (this.state.paletteRevision ?? 0) + 1;
      }
    }
  }
}
