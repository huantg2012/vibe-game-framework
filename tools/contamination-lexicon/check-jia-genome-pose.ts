/**
 * I5-N / I5-G 热修 machine gate: 基因谱甲朝向、信号相、可走步态。
 * 挂载与本闸门共用 `bakeJiaGenome`，禁止另写一套假画。
 *
 *   npm run check:jia-genome-pose
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeJiaGenome } from '../../src/entities/form-renderers/d/genome/bake.ts';
import { DOORFRAME_ID } from '../../src/entities/form-renderers/d/genome/doorframe.ts';
import { applyJiaGenomeGait } from '../../src/entities/form-renderers/d/genome/gait.ts';
import { INSECT_REMNANT_ID } from '../../src/entities/form-renderers/d/genome/insect-remnant.ts';
import { MAMMAL_REMNANT_ID } from '../../src/entities/form-renderers/d/genome/mammal-remnant.ts';
import { ORGANIC_REMNANT_ID } from '../../src/entities/form-renderers/d/genome/organic-remnant.ts';
import { STALK_CLUMP_ID } from '../../src/entities/form-renderers/d/genome/stalk-clump.ts';
import { STREET_WRECKAGE_ID } from '../../src/entities/form-renderers/d/genome/street-wreckage.ts';
import { WORM_REMNANT_ID } from '../../src/entities/form-renderers/d/genome/worm-remnant.ts';
import type { FormVisualSignal } from '../../src/entities/form-renderers/form-renderer.ts';
import type { Facing4 } from '../../src/types/game-types.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SEED = 1000;
const COVERAGE = 'overwrite' as const;
const FACINGS: readonly Facing4[] = ['up', 'down', 'left', 'right'];
const SIGNALS: readonly FormVisualSignal[] = ['idle', 'awake', 'strike', 'inflated'];
const MASK_W = 48;
const MASK_H = 64;
const CD_COLS = 6;
const CD_ROWS = 8;
const SUBSTRATES = [
  STREET_WRECKAGE_ID,
  DOORFRAME_ID,
  STALK_CLUMP_ID,
  ORGANIC_REMNANT_ID,
  INSECT_REMNANT_ID,
  MAMMAL_REMNANT_ID,
  WORM_REMNANT_ID,
] as const;
const WALKABLE = [STALK_CLUMP_ID, ORGANIC_REMNANT_ID, INSECT_REMNANT_ID, MAMMAL_REMNANT_ID, WORM_REMNANT_ID] as const;

let failed = 0;

function assert(cond: unknown, msg: string): void {
  if (cond) return;
  failed += 1;
  console.error(`FAIL ${msg}`);
}

function bake(substrate: string, facing: Facing4, signal: FormVisualSignal) {
  return bakeJiaGenome({
    substrate,
    coverage: COVERAGE,
    seed: SEED,
    facing4: facing,
    signal,
  });
}

function rgbaKey(buf: { data: Uint8ClampedArray }): string {
  return Buffer.from(buf.data).toString('base64');
}

function maskOf(buf: { data: Uint8ClampedArray; w: number; h: number }): Uint8Array {
  const m = new Uint8Array(MASK_W * MASK_H);
  const ox = ((MASK_W - buf.w) / 2) | 0;
  const oy = MASK_H - buf.h;
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      if ((buf.data[(y * buf.w + x) * 4 + 3] ?? 0) === 0) continue;
      const px = x + ox;
      const py = y + oy;
      if (px < 0 || py < 0 || px >= MASK_W || py >= MASK_H) continue;
      m[py * MASK_W + px] = 1;
    }
  }
  return m;
}

function coarse(mask: Uint8Array): Float32Array {
  const out = new Float32Array(CD_COLS * CD_ROWS);
  const cw = MASK_W / CD_COLS;
  const ch = MASK_H / CD_ROWS;
  for (let y = 0; y < MASK_H; y++) {
    for (let x = 0; x < MASK_W; x++) {
      if (!mask[y * MASK_W + x]) continue;
      const c = Math.min(CD_COLS - 1, (x / cw) | 0);
      const r = Math.min(CD_ROWS - 1, (y / ch) | 0);
      const bin = r * CD_COLS + c;
      out[bin] = (out[bin] ?? 0) + 1;
    }
  }
  const per = cw * ch;
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / per;
  return out;
}

function coarseDist(a: Uint8Array, b: Uint8Array): number {
  const ca = coarse(a);
  const cb = coarse(b);
  let s = 0;
  for (let i = 0; i < ca.length; i++) s += Math.abs(ca[i]! - cb[i]!);
  return s / ca.length;
}

function maskKey(mask: Uint8Array): string {
  return Buffer.from(mask).toString('base64');
}

function opaqueBox(buf: { data: Uint8ClampedArray; w: number; h: number }): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} | null {
  let x0 = buf.w;
  let y0 = buf.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      if ((buf.data[(y * buf.w + x) * 4 + 3] ?? 0) === 0) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return { x0, y0, x1, y1 };
}

function rgbaAt(
  buf: { data: Uint8ClampedArray; w: number },
  x: number,
  y: number,
): [number, number, number, number] {
  const i = (y * buf.w + x) * 4;
  return [buf.data[i] ?? 0, buf.data[i + 1] ?? 0, buf.data[i + 2] ?? 0, buf.data[i + 3] ?? 0];
}

function nearestOccupied(
  buf: { data: Uint8ClampedArray; w: number; h: number },
  x: number,
  y: number,
  maxR: number,
): number | null {
  if (x >= 0 && y >= 0 && x < buf.w && y < buf.h && (buf.data[(y * buf.w + x) * 4 + 3] ?? 0) !== 0) {
    return 0;
  }
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= buf.w || ny >= buf.h) continue;
        if ((buf.data[(ny * buf.w + nx) * 4 + 3] ?? 0) === 0) continue;
        return r;
      }
    }
  }
  return null;
}

function walkDiffStats(
  idle: { data: Uint8ClampedArray; w: number; h: number },
  walk: { data: Uint8ClampedArray; w: number; h: number },
): { span: number; diffMinY: number; diffMaxY: number; bodyH: number; bodyMaxY: number; maxShift: number } | null {
  const box = opaqueBox(idle);
  if (!box) return null;
  let diffMinY = idle.h;
  let diffMaxY = -1;
  let maxShift = 0;
  for (let y = 0; y < idle.h; y++) {
    for (let x = 0; x < idle.w; x++) {
      const [ir, ig, ib, ia] = rgbaAt(idle, x, y);
      const [wr, wg, wb, wa] = rgbaAt(walk, x, y);
      if (ir === wr && ig === wg && ib === wb && ia === wa) continue;
      if (y < diffMinY) diffMinY = y;
      if (y > diffMaxY) diffMaxY = y;
      if (ia !== 0 && wa === 0) {
        const d = nearestOccupied(walk, x, y, 6);
        if (d !== null && d > maxShift) maxShift = d;
      } else if (ia === 0 && wa !== 0) {
        const d = nearestOccupied(idle, x, y, 6);
        if (d !== null && d > maxShift) maxShift = d;
      } else {
        const dxGuess = Math.max(Math.abs(wr - ir) > 0 ? 1 : 0, 0);
        if (dxGuess > maxShift) maxShift = dxGuess;
      }
    }
  }
  if (diffMaxY < 0) {
    return { span: 0, diffMinY: 0, diffMaxY: 0, bodyH: box.y1 - box.y0 + 1, bodyMaxY: box.y1, maxShift: 0 };
  }
  return {
    span: diffMaxY - diffMinY + 1,
    diffMinY,
    diffMaxY,
    bodyH: box.y1 - box.y0 + 1,
    bodyMaxY: box.y1,
    maxShift,
  };
}

const bakeSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/bake.ts'), 'utf8');
assert(/export function bakeJiaGenome/.test(bakeSrc), 'production bakeJiaGenome exists');
assert(!/rotate\s*\(\s*(90|180|Math\.PI)/.test(bakeSrc), 'bake must not rotate the canvas to fake facing');
assert(!/setRotation\s*\(\s*(Math\.PI|90)/.test(bakeSrc), 'bake must not setRotation to fake facing');
assert(bakeSrc.includes('applyJiaGenomeGait'), 'bake applies shared gait');
assert(bakeSrc.includes("genome/gait"), 'bake imports genome/gait');

const gaitSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/gait.ts'), 'utf8');
assert(!/from ['"]phaser['"]/.test(gaitSrc), 'gait.ts must be Phaser-free');
assert(!/from ['"][^'"]*jia-pixels/.test(gaitSrc), 'gait must not import jia-pixels');

const attachSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/attach.ts'), 'utf8');
assert(attachSrc.includes('bakeJiaGenome'), 'attach imports production bake');
assert(attachSrc.includes('pose.facing4'), 'JiaGenomeVisual consumes pose.facing4');
assert(attachSrc.includes('pose.signal'), 'JiaGenomeVisual consumes pose.signal');
assert(attachSrc.includes('pose.moving'), 'JiaGenomeVisual consumes pose.moving');
assert(/setRotation\(\s*0\s*\)/.test(attachSrc), 'GameObject.rotation stays 0');
assert(!/FACINGS\.forEach|for\s*\([^)]*facing/.test(attachSrc.split('ensurePose')[0] ?? ''), 'constructor must not prebake four facings');
assert(!attachSrc.split('update(pose')[0]?.includes("gait: 'walk'"), 'constructor must not prebake walk');

const gateSrc = readFileSync(resolve(ROOT, 'tools/contamination-lexicon/check-jia-genome-pose.ts'), 'utf8');
assert(gateSrc.includes("from '../../src/entities/form-renderers/d/genome/bake.ts'"), 'gate imports production bake');
assert(gateSrc.includes("from '../../src/entities/form-renderers/d/genome/gait.ts'"), 'gate imports production gait');
assert(!/from ['"][^'"]*jia-pixels/.test(gateSrc), 'gate must not import jia-pixels');

const riftSrc = readFileSync(resolve(ROOT, 'src/scenes/rift-scene.ts'), 'utf8');
assert(!riftSrc.includes('form-renderers/d/genome'), 'RiftScene does not import genome');

for (const substrate of SUBSTRATES) {
  const idleByFacing: Record<Facing4, ReturnType<typeof bake>> = {
    up: bake(substrate, 'up', 'idle'),
    down: bake(substrate, 'down', 'idle'),
    left: bake(substrate, 'left', 'idle'),
    right: bake(substrate, 'right', 'idle'),
  };
  const masks: Record<Facing4, Uint8Array> = {
    up: maskOf(idleByFacing.up.buf),
    down: maskOf(idleByFacing.down.buf),
    left: maskOf(idleByFacing.left.buf),
    right: maskOf(idleByFacing.right.buf),
  };
  const distinct = new Set(FACINGS.map((f) => maskKey(masks[f]))).size;
  console.log(`${substrate} facing distinct silhouettes ${distinct} / 4`);
  assert(distinct >= 2, `${substrate} facing distinct ${distinct} want ≥ 2`);
  assert(distinct < 5, `${substrate} facing distinct overflow`);
  const allSame =
    maskKey(masks.up) === maskKey(masks.down) &&
    maskKey(masks.down) === maskKey(masks.left) &&
    maskKey(masks.left) === maskKey(masks.right);
  assert(!allSame, `${substrate} four facings are identical`);
  for (const [a, b] of [
    ['up', 'left'],
    ['up', 'right'],
    ['down', 'left'],
    ['down', 'right'],
  ] as const) {
    const same = maskKey(masks[a]) === maskKey(masks[b]);
    assert(!same, `${substrate} orthogonal ${a} == ${b}`);
    if (same) continue;
    console.log(`  ${a}≠${b} coarse ${coarseDist(masks[a], masks[b]).toFixed(4)}`);
  }

  const idle = bake(substrate, 'down', 'idle');
  const strike = bake(substrate, 'down', 'strike');
  const idleMask = maskOf(idle.buf);
  const strikeMask = maskOf(strike.buf);
  const idleEqStrikeMask = maskKey(idleMask) === maskKey(strikeMask);
  const idleEqStrikePx = rgbaKey(idle.buf) === rgbaKey(strike.buf);
  const strikeCoarse = coarseDist(idleMask, strikeMask);
  console.log(
    `${substrate} idle vs strike  maskEqual=${idleEqStrikeMask}  pxEqual=${idleEqStrikePx}  coarse ${strikeCoarse.toFixed(4)}`,
  );
  assert(!idleEqStrikePx || !idleEqStrikeMask || strikeCoarse > 0, `${substrate} idle and strike are identical`);
  assert(!idleEqStrikePx, `${substrate} idle and strike pixels are identical`);

  const signalKeys = SIGNALS.map((s) => rgbaKey(bake(substrate, 'down', s).buf));
  const signalDistinct = new Set(signalKeys).size;
  console.log(`${substrate} signal distinct buffers ${signalDistinct} / 4`);
  assert(signalDistinct >= 2, `${substrate} four signals are byte-identical`);
}

for (const substrate of WALKABLE) {
  const idle = bakeJiaGenome({
    substrate,
    coverage: COVERAGE,
    seed: SEED,
    facing4: 'down',
    signal: 'idle',
  });
  const walk = bakeJiaGenome({
    substrate,
    coverage: COVERAGE,
    seed: SEED,
    facing4: 'down',
    signal: 'idle',
    gait: 'walk',
    frame: 1,
  });
  const viaGait = applyJiaGenomeGait(idle.buf, {
    substrate,
    coverage: COVERAGE,
    facing: 'down',
    gait: 'walk',
    frame: 1,
    originX: idle.canvas.originX,
    originY: idle.canvas.originY,
  });
  const idleEqWalk = rgbaKey(idle.buf) === rgbaKey(walk.buf);
  const bakeEqGait = rgbaKey(walk.buf) === rgbaKey(viaGait);
  console.log(`${substrate} idle vs walk pxEqual=${idleEqWalk}  bakeEqGait=${bakeEqGait}`);
  assert(!idleEqWalk, `${substrate} idle and walk pixels are identical`);
  assert(bakeEqGait, `${substrate} bakeJiaGenome walk must match applyJiaGenomeGait`);
}

{
  const strideIds = [INSECT_REMNANT_ID, MAMMAL_REMNANT_ID, WORM_REMNANT_ID] as const;
  const strideCoverages = ['infiltrate', 'overwrite'] as const;
  for (const substrate of strideIds) {
    for (const coverage of strideCoverages) {
      const idle = bakeJiaGenome({
        substrate,
        coverage,
        seed: SEED,
        facing4: 'down',
        signal: 'idle',
      });
      const walk = bakeJiaGenome({
        substrate,
        coverage,
        seed: SEED,
        facing4: 'down',
        signal: 'idle',
        gait: 'walk',
        frame: 1,
      });
      const stats = walkDiffStats(idle.buf, walk.buf);
      assert(stats !== null, `${substrate} ${coverage} walk idle body empty`);
      if (!stats) continue;
      const midY = stats.bodyMaxY - stats.bodyH + 1 + Math.floor(stats.bodyH * 0.5);
      const coversLower = stats.diffMinY <= midY && stats.diffMaxY >= stats.bodyMaxY - 1;
      const tallEnough = stats.span >= 8 || stats.span >= Math.ceil(stats.bodyH * 0.3);
      console.log(
        `${substrate} ${coverage} walk diff span ${stats.span}px / body ${stats.bodyH}  y ${stats.diffMinY}..${stats.diffMaxY}  maxShift ${stats.maxShift}  coversLower=${coversLower}`,
      );
      assert(
        coversLower || tallEnough,
        `${substrate} ${coverage} walk diff span ${stats.span} must cover lower half (or ≥8px / ≥30% body)`,
      );
      assert(
        stats.diffMinY < stats.bodyMaxY - 1,
        `${substrate} ${coverage} walk diff only in bottom 2 rows (y ${stats.diffMinY}..${stats.diffMaxY}, bodyMax ${stats.bodyMaxY})`,
      );
      assert(
        stats.maxShift >= 2,
        `${substrate} ${coverage} walk max |Δx| or |Δy| ${stats.maxShift} want ≥2`,
      );
      if (substrate === WORM_REMNANT_ID) {
        const walkBox = opaqueBox(walk.buf);
        assert(walkBox !== null, `${substrate} ${coverage} walk facing down empty`);
        if (walkBox) {
          const xSpan = walkBox.x1 - walkBox.x0;
          const ySpan = walkBox.y1 - walkBox.y0;
          console.log(
            `${substrate} ${coverage} walk facing down box ${xSpan + 1}×${ySpan + 1} (must stay horizontal)`,
          );
          assert(
            xSpan > ySpan * 1.15,
            `${substrate} ${coverage} walk facing down must stay a horizontal strip (xSpan ${xSpan} ySpan ${ySpan})`,
          );
        }
      }
    }
  }
}

if (failed > 0) {
  console.error(`check:jia-genome-pose ${failed} failed`);
  process.exit(1);
}
console.log('check:jia-genome-pose PASS');
