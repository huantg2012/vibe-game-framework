/**
 * Shared rendering primitives for the 15 active/passive tools' VFX.
 *
 * Spec: docs/art/tool-vfx-spec.md (Slice 5 T4). This module exists so the 8 visual
 * families the spec defines share one implementation of "Degree not Kind" instead of each
 * tool hand-rolling its own block-scatter / bracket-marker / dissolve logic - the spec
 * explicitly calls this out as a requirement (A6), not a style preference.
 *
 * Everything here is programmatic (Phaser Graphics), matches the Slice 4.5 ground/boundary
 * approach (no bitmap assets), and only ever fills/strokes rectangles or short line
 * segments - never `fillCircle`/`strokeCircle` (A3-1). The one shape exception the spec
 * allows (`echo`'s expanding ring) is built from short straight segments here too.
 *
 * `ToolSystem` owns *when* each of these runs; this module only owns *how* a block field /
 * bracket / dissolve looks once asked to draw one.
 */

import Phaser from 'phaser';
import type { Vector2 } from '@/types/game-types';

// ---------------------------------------------------------------------------
// Palette (docs/art/palette.json - L2 contamination spectrum only; A3-2 bans every
// other color the Slice 4/5 placeholders used).
// ---------------------------------------------------------------------------

export const CONTAM_COLD = 0x1a7a9a;
export const CONTAM_DEEP = 0x0e4a3f;
export const CONTAM_MID = 0x1a6b5c;
export const CONTAM_CORE = 0x1aad96;
export const CONTAM_GLOW = 0x2ae6c8;
export const CONTAM_BRIGHT = 0x3cffd4;
export const CONTAM_PEAK = 0x7fffee;
export const CONTAM_ANCIENT = 0x4adf8a;
export const CONTAM_WHITE = 0xb0fff5;

/** "熄灭色" - same convention `purification-module.ts` (T6) already validated for a
 * fully-suppressed indicator. Reused verbatim rather than inventing a second dim color. */
export const EXTINGUISH_COLOR = 0x2a2d32;
/** metal-light - retrograde's ghost trail (was the non-compliant `0x888888`). */
export const GHOST_COLOR = 0x5a5f66;

// ---------------------------------------------------------------------------
// Deterministic per-effect RNG
// ---------------------------------------------------------------------------

/** Tiny seeded PRNG so a block field's *layout* is stable for the life of one effect
 * instance (only alpha/position animate afterward) without needing to store 10+ floats
 * per block up front. Not cryptographic; doesn't need to be. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap string->uint32 hash, so effects can seed their PRNG from an enemy id / position
 * and get a stable-but-different layout per instance without a global counter. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Snaps to an 8px (or given) grid, per A3-3's "机械感" requirement - block placement is
 * never free-floating. */
export function snapGrid(v: number, grid = 8): number {
  return Math.round(v / grid) * grid;
}

// ---------------------------------------------------------------------------
// Glitch block field (族群 C's shared renderer; also used by A/F/H per A6)
// ---------------------------------------------------------------------------

export interface GlitchBlock {
  /** Offset from the field's anchor, already grid-snapped. */
  dx: number;
  dy: number;
  size: number;
  /** Per-block alpha multiplier (0..~1.3, clamped on render) - the knob every
   * group-specific motion signal (breathing/edge-ring/drift/flicker/decay) turns. */
  alphaMult: number;
}

/** Scatters `count` grid-aligned blocks inside `radius` of the anchor. Deterministic given
 * `rng` so callers can reproduce/seed a layout; callers wanting per-frame randomness
 * (kindle's flicker) pass `Math.random` instead. */
export function buildGlitchBlockField(
  radius: number,
  count: number,
  sizeMin: number,
  sizeMax: number,
  rng: () => number = Math.random,
): GlitchBlock[] {
  const blocks: GlitchBlock[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = radius * (0.15 + rng() * 0.85);
    const size = snapGrid(sizeMin + rng() * (sizeMax - sizeMin), 4) || sizeMin;
    blocks.push({
      dx: snapGrid(Math.cos(angle) * dist),
      dy: snapGrid(Math.sin(angle) * dist),
      size: Math.max(4, size),
      alphaMult: 1,
    });
  }
  return blocks;
}

/** Draws (after `clear()`) every block at `anchor + block offset`, alpha = `baseAlpha *
 * block.alphaMult`. Shared by every zone-type effect so none of them hand-roll `fillRect`
 * loops with slightly different rounding. */
export function renderGlitchBlockField(
  g: Phaser.GameObjects.Graphics,
  anchor: Vector2,
  blocks: readonly GlitchBlock[],
  color: number,
  baseAlpha: number,
): void {
  g.clear();
  for (const b of blocks) {
    const a = Phaser.Math.Clamp(baseAlpha * b.alphaMult, 0, 1);
    if (a <= 0.003) continue;
    g.fillStyle(color, a);
    g.fillRect(anchor.x + b.dx - b.size / 2, anchor.y + b.dy - b.size / 2, b.size, b.size);
  }
}

// ---------------------------------------------------------------------------
// Discrete (non-tweened) dissipation - A3-5's "结束消散" requirement
// ---------------------------------------------------------------------------

export interface DissolveState {
  stepsTotal: number;
  stepsDone: number;
  stepIntervalMs: number;
  timerMs: number;
  /** Applies the one-frame position jitter on the first step, then clears itself. */
  jitterPending: boolean;
}

export function createDissolveState(stepsTotal = 3, stepIntervalMs = 80): DissolveState {
  return { stepsTotal, stepsDone: 0, timerMs: 0, stepIntervalMs, jitterPending: true };
}

/**
 * Advances a discrete dissolve by `deltaMs`, mutating `blocks` in place (removing a
 * fraction each step - never fading alpha continuously). Returns the jitter offset to
 * apply this frame (±2px, one frame only, per A3-5) and whether the dissolve is complete.
 */
export function stepDissolve(
  state: DissolveState,
  blocks: GlitchBlock[],
  deltaMs: number,
  rng: () => number = Math.random,
): { jitter: Vector2; done: boolean } {
  state.timerMs += deltaMs;
  let jitter: Vector2 = { x: 0, y: 0 };

  if (state.timerMs >= state.stepIntervalMs && state.stepsDone < state.stepsTotal && blocks.length > 0) {
    state.timerMs = 0;
    state.stepsDone++;
    const remainingSteps = state.stepsTotal - state.stepsDone + 1;
    const removeCount = Math.max(1, Math.ceil(blocks.length / remainingSteps));
    blocks.splice(0, removeCount);
    if (state.jitterPending) {
      state.jitterPending = false;
      jitter = { x: (rng() - 0.5) * 4, y: (rng() - 0.5) * 4 };
    }
  }

  const done = state.stepsDone >= state.stepsTotal || blocks.length === 0;
  return { jitter, done };
}

/**
 * Discrete step-fade for line/marker effects that aren't block fields (stitch, resonate,
 * mirror's normal-expiry fade, retrograde's diamond). Alpha only ever *jumps* between a
 * small number of fixed levels on a timer - never an `onUpdate` tween - per A3-5.
 */
export interface StepFadeState {
  readonly alphaSteps: readonly number[];
  stepIndex: number;
  timerMs: number;
  readonly stepIntervalMs: number;
}

export function createStepFade(steps = 3, stepIntervalMs = 80): StepFadeState {
  const alphaSteps: number[] = [];
  for (let i = steps; i >= 0; i--) alphaSteps.push(i / steps);
  return { alphaSteps, stepIndex: 0, timerMs: 0, stepIntervalMs };
}

export function stepFade(state: StepFadeState, deltaMs: number): { alpha: number; done: boolean } {
  state.timerMs += deltaMs;
  if (state.timerMs >= state.stepIntervalMs && state.stepIndex < state.alphaSteps.length - 1) {
    state.timerMs = 0;
    state.stepIndex++;
  }
  const alpha = state.alphaSteps[state.stepIndex]!;
  return { alpha, done: state.stepIndex >= state.alphaSteps.length - 1 };
}

// ---------------------------------------------------------------------------
// Bracket marker (A4 副标示 - the single new primitive the spec allows)
// ---------------------------------------------------------------------------

const BRACKET_SIZE = 6;
const BRACKET_LEG = 2;

/** Four 2px corner-brackets around a 6x6 box, `「 」`-style. Used only by the pure
 * behaviour-changing effects the spec names (compress lock / overwrite reversal /
 * resonate & echo stun) - never by anything that also carries a perception debuff, per A4. */
export function drawBracketMarker(
  g: Phaser.GameObjects.Graphics,
  pos: Vector2,
  color: number,
  alpha: number,
): void {
  const h = BRACKET_SIZE / 2;
  g.lineStyle(1, color, alpha);
  // top-left
  g.beginPath();
  g.moveTo(pos.x - h, pos.y - h + BRACKET_LEG);
  g.lineTo(pos.x - h, pos.y - h);
  g.lineTo(pos.x - h + BRACKET_LEG, pos.y - h);
  g.strokePath();
  // top-right
  g.beginPath();
  g.moveTo(pos.x + h - BRACKET_LEG, pos.y - h);
  g.lineTo(pos.x + h, pos.y - h);
  g.lineTo(pos.x + h, pos.y - h + BRACKET_LEG);
  g.strokePath();
  // bottom-left
  g.beginPath();
  g.moveTo(pos.x - h, pos.y + h - BRACKET_LEG);
  g.lineTo(pos.x - h, pos.y + h);
  g.lineTo(pos.x - h + BRACKET_LEG, pos.y + h);
  g.strokePath();
  // bottom-right
  g.beginPath();
  g.moveTo(pos.x + h - BRACKET_LEG, pos.y + h);
  g.lineTo(pos.x + h, pos.y + h);
  g.lineTo(pos.x + h, pos.y + h - BRACKET_LEG);
  g.strokePath();
}

// ---------------------------------------------------------------------------
// Jagged polygon (solidify's crystal outline) - "棱角分明", never a smooth curve
// ---------------------------------------------------------------------------

/** Builds a closed irregular polygon (3-5 vertices) around the origin, deterministic per
 * `rng`, for solidify's "刚性晶格" outline. */
export function buildJaggedPolygon(radius: number, rng: () => number): Vector2[] {
  const vertexCount = 3 + Math.floor(rng() * 3); // 3-5
  const points: Vector2[] = [];
  for (let i = 0; i < vertexCount; i++) {
    const angle = (i / vertexCount) * Math.PI * 2 + (rng() - 0.5) * 0.6;
    const r = radius * (0.7 + rng() * 0.5);
    points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  return points;
}

export function renderPolygonOutline(
  g: Phaser.GameObjects.Graphics,
  anchor: Vector2,
  points: readonly Vector2[],
  color: number,
  alpha: number,
  lineWidth = 2,
): void {
  g.clear();
  if (points.length === 0) return;
  g.lineStyle(lineWidth, color, alpha);
  g.beginPath();
  g.moveTo(anchor.x + points[0]!.x, anchor.y + points[0]!.y);
  for (let i = 1; i < points.length; i++) g.lineTo(anchor.x + points[i]!.x, anchor.y + points[i]!.y);
  g.closePath();
  g.strokePath();
}

// ---------------------------------------------------------------------------
// Polyline ring (echo's "分段短线拼出多边形近似圆" - the one circle exception, A3-1)
// ---------------------------------------------------------------------------

/** Draws a closed ring made of `segments` short straight strokes at `radius`, each darker
 * than the last (`decayPerSegment`), approximating a circle without ever calling
 * `strokeCircle`. */
export function renderPolylineRing(
  g: Phaser.GameObjects.Graphics,
  center: Vector2,
  radius: number,
  segments: number,
  color: number,
  baseAlpha: number,
): void {
  g.clear();
  if (radius <= 0) return;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const decay = 1 - (i / segments) * 0.7;
    g.lineStyle(2, color, Phaser.Math.Clamp(baseAlpha * decay, 0, 1));
    g.beginPath();
    g.moveTo(center.x + Math.cos(a0) * radius, center.y + Math.sin(a0) * radius);
    g.lineTo(center.x + Math.cos(a1) * radius, center.y + Math.sin(a1) * radius);
    g.strokePath();
  }
}

// ---------------------------------------------------------------------------
// Enemy status indicators (A4 主标示) - approximates the brief without touching the
// enemy renderer itself (out of this task's file ownership: `entities/enemy-factory.ts` is
// under active parallel edit, see delivery report). Draws a small teal "bad pixel" pair on
// the body - distinct position from the existing SUSPICIOUS/ALERT head dots so the two
// never overlap - whose brightness/blink is driven by the multiplier ToolSystem is already
// applying via `setEnemyPerceptionMultiplier`. Zero new gameplay state: this only mirrors
// values ToolSystem already computed for the AI override.
// ---------------------------------------------------------------------------

interface IndicatorSource {
  mult: number;
  suppressed: boolean;
}

interface IndicatorEntry {
  sources: Map<string, IndicatorSource>;
  visual: Phaser.GameObjects.Graphics;
  blinkPhase: number;
}

const INDICATOR_DOT_OFFSET: Vector2 = { x: -5, y: 2 };
const INDICATOR_DOT_SIZE = 2;

export class EnemyPerceptionIndicators {
  private readonly entries = new Map<string, IndicatorEntry>();

  exportRuntimeState(): {enemyId:string; blinkPhase:number; sources:{tag:string;mult:number;suppressed:boolean}[]}[] {
    return [...this.entries].map(([enemyId,entry])=>({enemyId,blinkPhase:entry.blinkPhase,
      sources:[...entry.sources].map(([tag,source])=>({tag,...source}))}));
  }

  restoreRuntimeState(rows: ReturnType<EnemyPerceptionIndicators['exportRuntimeState']>): void {
    this.destroy();
    for(const row of rows) {
      for(const source of row.sources)this.set(row.enemyId,source.tag,source.mult,source.suppressed);
      const entry=this.entries.get(row.enemyId);if(entry)entry.blinkPhase=row.blinkPhase;
    }
  }

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth = 26,
  ) {}

  /** Registers/updates one source's contribution for `enemyId` (e.g. `'combust'`,
   * `'solidify'`). Multiple simultaneous sources combine (min multiplier, OR'd suppressed). */
  set(enemyId: string, sourceTag: string, mult: number, suppressed: boolean): void {
    let entry = this.entries.get(enemyId);
    if (!entry) {
      entry = { sources: new Map(), visual: this.scene.add.graphics().setDepth(this.depth), blinkPhase: 0 };
      this.entries.set(enemyId, entry);
    }
    entry.sources.set(sourceTag, { mult, suppressed });
  }

  clear(enemyId: string, sourceTag: string): void {
    const entry = this.entries.get(enemyId);
    if (!entry) return;
    entry.sources.delete(sourceTag);
    if (entry.sources.size === 0) {
      entry.visual.destroy();
      this.entries.delete(enemyId);
    }
  }

  /** Redraws every registered indicator. `getPosition` returning `undefined` (enemy gone
   * or out of the live list) hides that indicator without deleting its bookkeeping - the
   * owning effect's own update loop is responsible for calling `clear()` on release. */
  update(deltaMs: number, getPosition: (enemyId: string) => Vector2 | undefined): void {
    for (const [enemyId, entry] of this.entries) {
      const pos = getPosition(enemyId);
      if (!pos) {
        entry.visual.setVisible(false);
        continue;
      }
      entry.visual.setVisible(true);

      let mult = 1;
      let suppressed = false;
      for (const src of entry.sources.values()) {
        mult = Math.min(mult, src.mult);
        suppressed = suppressed || src.suppressed;
      }

      const blinkHz = suppressed ? 1 : 3;
      entry.blinkPhase += (deltaMs / 1000) * blinkHz;
      const blinkOn = entry.blinkPhase % 1 < 0.5;

      const anchor = { x: pos.x + INDICATOR_DOT_OFFSET.x, y: pos.y + INDICATOR_DOT_OFFSET.y };
      entry.visual.clear();

      if (mult <= 0.02) {
        // 完全冻结: 熄灭色, 常亮 (no blink - it's off, not signalling).
        entry.visual.fillStyle(EXTINGUISH_COLOR, 0.9);
        entry.visual.fillRect(anchor.x - INDICATOR_DOT_SIZE / 2, anchor.y - INDICATOR_DOT_SIZE / 2, INDICATOR_DOT_SIZE, INDICATOR_DOT_SIZE);
        entry.visual.fillRect(anchor.x + 4 - INDICATOR_DOT_SIZE / 2, anchor.y - INDICATOR_DOT_SIZE / 2, INDICATOR_DOT_SIZE, INDICATOR_DOT_SIZE);
        continue;
      }

      const color = mult < 1 ? lerpColor(EXTINGUISH_COLOR, CONTAM_BRIGHT, mult) : CONTAM_BRIGHT;
      const alpha = (suppressed ? (blinkOn ? 0.9 : 0.15) : (blinkOn ? 0.9 : 0.5)) * (mult < 1 ? 0.5 + mult * 0.5 : 1);
      if (mult >= 1 && !suppressed) continue; // no effect active - nothing to draw
      entry.visual.fillStyle(color, alpha);
      entry.visual.fillRect(anchor.x - INDICATOR_DOT_SIZE / 2, anchor.y - INDICATOR_DOT_SIZE / 2, INDICATOR_DOT_SIZE, INDICATOR_DOT_SIZE);
      entry.visual.fillRect(anchor.x + 4 - INDICATOR_DOT_SIZE / 2, anchor.y - INDICATOR_DOT_SIZE / 2, INDICATOR_DOT_SIZE, INDICATOR_DOT_SIZE);
    }
  }

  destroy(): void {
    for (const entry of this.entries.values()) entry.visual.destroy();
    this.entries.clear();
  }
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const gCh = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (gCh << 8) | bl;
}
