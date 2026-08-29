/**
 * I5-L machine gate：哺乳动物同覆盖档 16 种子去重剪影 = 16；
 * 改写→覆盖粗占格距离 > 0.0059（该值必须 FAIL）。度量 6×8，不用 IoU。
 * 恰好 4 根 limb post。邻域用测量分类（肢高/躯干高、尾长、撑开宽度、两臂+两足），
 * 不是同一套四足异星兽，也不是闸门另写一套假 layout。
 * 陈列馆四个邻域厅各 8 采样种子须都是该邻域，禁止一厅 8 格同一只。
 * 不要要求一个厅里并排四种邻域。
 * 16 种子四邻域各 ≥1，类人 ≤6，猫科 ≥2。
 * weld=1、无 flesh、剪影不得读成虫（多足横向）或蠕虫（无足分节）。
 *
 *   npm run check:jia-mammal-remnant
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mix32 } from '../../src/generation/seed-fork.ts';
import {
  SORTIE_SUBSTRATE_IDS,
  SUBSTRATE_DATA,
  type CoverageId,
} from '../../src/generated/contamination-lexicon-data.ts';
import { operatorBudget, radiateAllowed } from '../../src/entities/form-renderers/d/genome/operators.ts';
import { countOpaquePixels, drawSkeleton } from '../../src/entities/form-renderers/d/genome/parts.ts';
import {
  MAMMAL_NEIGHBORHOODS,
  MAMMAL_REMNANT_ID,
  buildMammalRemnantSkeleton,
  mammalNeighborhoodOf,
  paintMammalRemnantBody,
} from '../../src/entities/form-renderers/d/genome/mammal-remnant.ts';
import {
  GALLERY_JIA_SEED_BUCKETS,
  jiaSeedForMammalNeighborhood,
  jiaVariantOf,
} from '../../src/gym/lexicon-gallery-catalog.ts';
import { countOpaque4Components } from '../../src/entities/form-renderers/d/genome/weld.ts';
import type { GenomeNode, GenomeSkeleton } from '../../src/entities/form-renderers/d/genome/types.ts';
import type { Facing4 } from '../../src/types/game-types.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASELINE_REWRITE_OVERWRITE = 0.0059;
const MASK_W = 48;
const MASK_H = 64;
const CD_COLS = 6;
const CD_ROWS = 8;
const SEEDS = 16;
const COVERAGES: readonly CoverageId[] = ['infiltrate', 'rewrite', 'overwrite'];
const FACINGS: readonly Facing4[] = ['up', 'down', 'left', 'right'];
const HARD_OK = new Set(['bone', 'concrete', 'metal']);

let failed = 0;

function assert(cond: unknown, msg: string): void {
  if (cond) return;
  failed += 1;
  console.error(`FAIL ${msg}`);
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

function distinctCount(masks: readonly Uint8Array[]): number {
  const keys = new Set<string>();
  for (const m of masks) keys.add(Buffer.from(m).toString('base64'));
  return keys.size;
}

function median(vals: number[]): number {
  const a = [...vals].sort((x, y) => x - y);
  return a.length === 0 ? 0 : a[a.length >> 1]!;
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

function limbPosts(sk: GenomeSkeleton): GenomeNode[] {
  return sk.parts.filter((p) => p.role === 'limb' && p.kind === 'post');
}

function centerOf(p: GenomeNode): { x: number; y: number } {
  return { x: p.x + p.w / 2, y: p.y + p.h / 2 };
}

/** 多足横向：单块宽扁腹甲、足往两侧伸出超过 2 根/侧。 */
function looksLikeLateralInsect(sk: GenomeSkeleton): boolean {
  const masses = sk.parts.filter((p) => p.kind === 'mass');
  const limbs = limbPosts(sk);
  if (limbs.length !== 4) return true;
  if (masses.length === 1) {
    const mass = masses[0]!;
    if (mass.w >= mass.h) {
      const left = limbs.filter((p) => p.x + p.w <= mass.x);
      const right = limbs.filter((p) => p.x >= mass.x + mass.w);
      if (left.length >= 2 && right.length >= 2) return true;
    }
  }
  const body = masses.find((p) => p.role === 'spine') ?? masses[0];
  if (!body) return true;
  const left = limbs.filter((p) => p.x + p.w / 2 < body.x + body.w / 2);
  const right = limbs.filter((p) => p.x + p.w / 2 > body.x + body.w / 2);
  return left.length >= 3 && right.length >= 3;
}

/** 无足分节：4+ 个团串成一条、没有向下的肢柱。 */
function looksLikeSegmentedWorm(sk: GenomeSkeleton): boolean {
  const masses = sk.parts.filter((p) => p.kind === 'mass');
  const limbs = limbPosts(sk);
  if (limbs.length === 0 && masses.length >= 4) return true;
  if (masses.length >= 4) {
    const ys = masses.map((p) => p.y + p.h / 2).sort((a, b) => a - b);
    const xs = masses.map((p) => p.x + p.w / 2).sort((a, b) => a - b);
    const ySpan = ys[ys.length - 1]! - ys[0]!;
    const xSpan = xs[xs.length - 1]! - xs[0]!;
    const similar = masses.every((p) => Math.abs(p.w - masses[0]!.w) <= 2 && Math.abs(p.h - masses[0]!.h) <= 2);
    if (similar && (ySpan > xSpan * 1.4 || xSpan > ySpan * 1.4)) return true;
  }
  return false;
}

function headOnFacingSide(head: GenomeNode, torso: GenomeNode, facing: Facing4): boolean {
  const h = centerOf(head);
  const t = centerOf(torso);
  const dx = h.x - t.x;
  const dy = h.y - t.y;
  if (facing === 'left') return dx < 0 && Math.abs(dx) >= Math.abs(dy);
  if (facing === 'right') return dx > 0 && Math.abs(dx) >= Math.abs(dy);
  if (facing === 'up') return dy < 0 && Math.abs(dy) >= Math.abs(dx);
  return dy > 0 && Math.abs(dy) >= Math.abs(dx);
}

function downLimbs(sk: GenomeSkeleton): GenomeNode[] {
  return limbPosts(sk).filter((p) => p.h > p.w);
}

function sideArms(sk: GenomeSkeleton, torso: GenomeNode): GenomeNode[] {
  return limbPosts(sk).filter((p) => {
    const midY = p.y + p.h / 2;
    const inTorsoY = midY >= torso.y && midY <= torso.y + torso.h;
    return p.w >= p.h && p.h <= 3 && inTorsoY;
  });
}

function isUprightHumanoid(sk: GenomeSkeleton): boolean {
  const torso = sk.parts.find((p) => p.kind === 'mass' && p.role === 'spine');
  if (!torso) return false;
  return sideArms(sk, torso).length === 2 && downLimbs(sk).length === 2;
}

function headAboveFollowsFacing(head: GenomeNode, torso: GenomeNode, facing: Facing4): boolean {
  const h = centerOf(head);
  const t = centerOf(torso);
  if (h.y >= t.y) return false;
  if (facing === 'left') return h.x <= t.x;
  if (facing === 'right') return h.x >= t.x;
  return true;
}

function limbTorsoRatio(sk: GenomeSkeleton): number {
  const torso = sk.parts.find((p) => p.kind === 'mass' && p.role === 'spine');
  const feet = downLimbs(sk);
  if (!torso || torso.h <= 0 || feet.length === 0) return 0;
  return Math.max(...feet.map((p) => p.h)) / torso.h;
}

function tailLenOf(sk: GenomeSkeleton): number {
  const tails = sk.parts.filter(
    (p) => p.role === 'accent' && (p.kind === 'post' || p.kind === 'filament') && p.mat !== 'glow',
  );
  if (tails.length === 0) return 0;
  return Math.max(...tails.map((p) => Math.max(p.w, p.h)));
}

function splayWidthOf(sk: GenomeSkeleton): number {
  const torso = sk.parts.find((p) => p.kind === 'mass' && p.role === 'spine');
  const feet = downLimbs(sk);
  if (!torso || feet.length === 0) return 0;
  const minX = Math.min(...feet.map((p) => p.x));
  const maxX = Math.max(...feet.map((p) => p.x + p.w));
  return maxX - minX - torso.w;
}

type MammalHood = 'cat' | 'deer' | 'crawler' | 'humanoid';

function measureHoods(sk: GenomeSkeleton): Set<MammalHood> {
  const out = new Set<MammalHood>();
  const torso = sk.parts.find((p) => p.kind === 'mass' && p.role === 'spine');
  if (!torso) return out;
  const humanoid = isUprightHumanoid(sk);
  if (humanoid) out.add('humanoid');
  const ratio = limbTorsoRatio(sk);
  const tail = tailLenOf(sk);
  const splay = splayWidthOf(sk);
  const feet = downLimbs(sk);
  const maxLimbH = feet.length === 0 ? 0 : Math.max(...feet.map((p) => p.h));
  const squat = torso.h <= torso.w || torso.h <= 6;
  if (!humanoid && splay >= 3 && tail >= 4) out.add('crawler');
  if (!humanoid && ratio >= 1.2) out.add('deer');
  if (!humanoid && tail >= 4 && maxLimbH <= 7 && squat && splay < 3) out.add('cat');
  return out;
}

/** 与陈列馆 `jiaSeedForMammalNeighborhood` 同一循环：桶内搜邻域，禁止 % 4。 */
function galleryHoodSeeds(hood: (typeof MAMMAL_NEIGHBORHOODS)[number]): readonly number[] {
  return GALLERY_JIA_SEED_BUCKETS.map((variant) => jiaSeedForMammalNeighborhood(variant, hood));
}

assert(operatorBudget('infiltrate') === 1, 'I5-D infiltrate budget still 1');
assert(operatorBudget('rewrite') === 3, 'I5-D rewrite budget still 3');
assert(operatorBudget('overwrite') === 5, 'I5-D overwrite budget still 5');
assert(!radiateAllowed('infiltrate') && !radiateAllowed('rewrite'), 'radiate still locked before overwrite');
assert(radiateAllowed('overwrite'), 'radiate still only at overwrite');

const mammalSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/mammal-remnant.ts'), 'utf8');
const mammalCode = mammalSrc
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
  .join('\n');
assert(!/mix32\([^)]*substrate[^)]*\)\s*%\s*3/.test(mammalCode), 'must not use mix32(seed, substrate) % 3');
assert(!/%\s*3/.test(mammalCode), 'must not cut identity with % 3');
assert(!/%\s*4/.test(mammalCode), 'must not cut identity with % 4');
assert(!/\binsect_remnant\b/.test(mammalCode), 'mammal must not implement insect grammar');
assert(!/\bworm_remnant\b/.test(mammalCode), 'mammal must not implement worm grammar');
assert(
  !/if\s*\(\s*(kind|variant|family)\s*===/.test(mammalCode),
  'must not hard-cut silhouette identities',
);
assert(!/\bflesh\b/.test(mammalCode), 'mammal must not use flesh as a material');
assert(!/jia-silhouette/.test(mammalCode), 'must not import jia-silhouette');
assert(!/jia-pixels/.test(mammalCode), 'must not import jia-pixels');
assert(!/infiltrator-sprite/.test(mammalCode), 'must not import infiltrator-sprite');
assert(
  /lowness/.test(mammalCode) && /limbRatio/.test(mammalCode) && /splay/.test(mammalCode) && /upright/.test(mammalCode),
  'shared continuous axes must be sampled',
);
assert(/mammal_remnant:phase/.test(mammalCode), 'must scatter small seeds on a phase circle');
assert(!/jiaSeedForVariant/.test(mammalCode), 'production must not pin gallery variant seeds');
assert(!/Math\.floor\([^)]*\*\s*4/.test(mammalCode), 'must not Math.floor(t*4) cut silhouette identity');
assert(/layoutMammalNodes\([\s\S]*facing/.test(mammalSrc), 'layoutMammalNodes must take facing');

const attachSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/attach.ts'), 'utf8');
assert(!attachSrc.includes('MAMMAL_REMNANT_ID'), 'mammal must not join isAnchoredFloorJia');

const gaitSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/gait.ts'), 'utf8');
assert(gaitSrc.includes('MAMMAL_REMNANT_ID'), 'gait branches on mammal_remnant');
assert(gaitSrc.includes('mammalWalkStride'), 'mammal gait stays in mammalWalkStride, not insect or remnant squash');
assert(!/catWalk|deerWalk|crawlerWalk|humanoidWalk/.test(gaitSrc), 'must not split mammal gait into four fake walks');
assert(!/footY = maxY - 1/.test(gaitSrc), 'mammal stride must not limit motion to the tip row');
assert(!/from ['"][^'"]*jia-pixels/.test(gaitSrc), 'gait must not import jia-pixels');

const mixedSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/scheme-d-mixed.ts'), 'utf8');
assert(/case 'floor':\s*return attachJiaGenomeD\(ctx\);/.test(mixedSrc), 'd-mixed floor path is attachJiaGenomeD');
assert(!mixedSrc.includes('attachJiaD'), 'd-mixed no longer calls attachJiaD');

const riftSrc = readFileSync(resolve(ROOT, 'src/scenes/rift-scene.ts'), 'utf8');
assert(!riftSrc.includes('form-renderers/d/genome'), 'RiftScene does not import genome');

assert(SORTIE_SUBSTRATE_IDS.includes(MAMMAL_REMNANT_ID), 'mammal_remnant is sortie');
assert(SUBSTRATE_DATA[MAMMAL_REMNANT_ID]?.enabledScope === 'sortie', 'CSV enabled_scope is sortie');

const seedList = Array.from({ length: SEEDS }, (_, i) => 1000 + i * 977);

{
  const downSk = buildMammalRemnantSkeleton('infiltrate', seedList[0]!, undefined, 'down');
  const leftSk = buildMammalRemnantSkeleton('infiltrate', seedList[0]!, undefined, 'left');
  assert(
    JSON.stringify(downSk.parts) !== JSON.stringify(leftSk.parts),
    'layout must consume facing4 (down vs left skeletons identical)',
  );
}

for (const facing of FACINGS) {
  for (const seed of seedList.slice(0, 8)) {
    const sk = buildMammalRemnantSkeleton('infiltrate', seed, undefined, facing);
    const head = sk.parts.find((p) => p.kind === 'mass' && p.role === 'head');
    const torso = sk.parts.find((p) => p.kind === 'mass' && p.role === 'spine');
    assert(!!head, `${facing} seed ${seed} needs a head mass`);
    assert(!!torso, `${facing} seed ${seed} needs a torso mass`);
    if (head && torso) {
      if (isUprightHumanoid(sk)) {
        assert(
          headAboveFollowsFacing(head, torso, facing),
          `${facing} seed ${seed} upright head must sit above the torso and follow facing`,
        );
      } else {
        assert(
          headOnFacingSide(head, torso, facing),
          `${facing} seed ${seed} head is not on the facing side of the torso`,
        );
      }
    }
  }
}

for (const coverage of COVERAGES) {
  for (const seed of seedList) {
    const sk = buildMammalRemnantSkeleton(coverage, seed);
    const heads = sk.parts.filter((p) => p.kind === 'mass' && p.role === 'head');
    const torsos = sk.parts.filter((p) => p.kind === 'mass' && p.role === 'spine');
    const limbs = limbPosts(sk);
    const tails = sk.parts.filter((p) => p.role === 'accent' && (p.kind === 'post' || p.kind === 'filament') && p.mat !== 'glow');
    assert(heads.length === 1, `${coverage} seed ${seed} needs exactly 1 head mass, got ${heads.length}`);
    assert(torsos.length === 1, `${coverage} seed ${seed} needs exactly 1 torso mass, got ${torsos.length}`);
    assert(limbs.length === 4, `${coverage} seed ${seed} limb posts ${limbs.length} want exactly 4`);
    assert(tails.length <= 1, `${coverage} seed ${seed} tails ${tails.length} want 0–1`);
    const head = heads[0];
    const torso = torsos[0];
    if (head && torso) {
      assert(head.mat !== 'flesh' && torso.mat !== 'flesh', `${coverage} seed ${seed} body must not be flesh`);
      assert(
        HARD_OK.has(head.mat) && HARD_OK.has(torso.mat),
        `${coverage} seed ${seed} body mats ${head.mat}/${torso.mat} want bone/concrete/metal`,
      );
      if (isUprightHumanoid(sk)) {
        assert(
          headAboveFollowsFacing(head, torso, 'down'),
          `${coverage} seed ${seed} default-down upright head must sit above the torso`,
        );
      } else {
        assert(
          headOnFacingSide(head, torso, 'down'),
          `${coverage} seed ${seed} default-down head must sit on the facing side of the torso`,
        );
      }
    }
    assert(
      limbs.every((p) => p.mat !== 'flesh'),
      `${coverage} seed ${seed} limbs must not be flesh`,
    );
    const hs = limbs.map((p) => p.h);
    const spread = Math.max(...hs) - Math.min(...hs);
    assert(spread >= 2, `${coverage} seed ${seed} limb h spread ${spread} want ≥2 (equal-length door)`);
    assert(!looksLikeLateralInsect(sk), `${coverage} seed ${seed} grammar reads as a lateral insect`);
    assert(!looksLikeSegmentedWorm(sk), `${coverage} seed ${seed} grammar reads as a legless segmented worm`);
    assert(sk.canvas.collision === 20, `${coverage} collision must stay 20`);
    if (coverage === 'infiltrate') {
      assert(sk.canvas.w === 32 && sk.canvas.h === 32, 'infiltrate canvas 32x32');
    } else if (coverage === 'rewrite') {
      assert(sk.canvas.w === 32 && sk.canvas.h === 48, 'rewrite canvas 32x48');
    } else {
      assert(sk.canvas.w === 48 && sk.canvas.h === 64, 'overwrite canvas 48x64');
    }
    const raw = drawSkeleton(sk);
    assert(!looksLikeLateralInsect(sk), `${coverage} seed ${seed} drawSkeleton still insect`);
    const box = opaqueBox(raw);
    assert(box !== null, `${coverage} seed ${seed} grammar silhouette empty`);
    const buf = paintMammalRemnantBody(coverage, seed);
    const welded = countOpaque4Components(buf);
    assert(welded === 1, `${coverage} seed ${seed} weld 4-connected ${welded} want 1`);
    assert(countOpaquePixels(buf) > 0, `${coverage} seed ${seed} body empty`);
  }

  const masks = seedList.map((seed) => maskOf(paintMammalRemnantBody(coverage, seed)));
  const distinct = distinctCount(masks);
  console.log(`mammal_remnant ${coverage} distinct ${distinct} / ${SEEDS}`);
  assert(distinct === SEEDS, `${coverage} distinct silhouettes ${distinct} want ${SEEDS}`);
}

{
  const counts: Record<MammalHood, number> = { cat: 0, deer: 0, crawler: 0, humanoid: 0 };
  for (const seed of seedList) {
    const sk = buildMammalRemnantSkeleton('infiltrate', seed);
    const hoods = measureHoods(sk);
    for (const hood of hoods) counts[hood] += 1;
    console.log(
      `mammal_remnant seed ${seed} hoods ${[...hoods].join(',') || 'none'}  ratio ${limbTorsoRatio(sk).toFixed(2)} tail ${tailLenOf(sk)} splay ${splayWidthOf(sk)} arms+feet ${isUprightHumanoid(sk) ? 'yes' : 'no'}`,
    );
  }
  console.log(
    `mammal_remnant neighborhoods  cat ${counts.cat}  deer ${counts.deer}  crawler ${counts.crawler}  humanoid ${counts.humanoid}`,
  );
  assert(counts.cat >= 2, `cat neighborhood hit ${counts.cat} want ≥2 of 16`);
  assert(counts.deer >= 2, `deer neighborhood hit ${counts.deer} want ≥2 of 16`);
  assert(counts.crawler >= 2, `crawler neighborhood hit ${counts.crawler} want ≥2 of 16`);
  assert(counts.humanoid >= 1, `humanoid neighborhood hit ${counts.humanoid} want ≥1 of 16`);
  assert(counts.humanoid <= 6, `humanoid neighborhood hit ${counts.humanoid} want ≤6 of 16`);
}

{
  for (const hood of MAMMAL_NEIGHBORHOODS) {
    const gallerySeeds = galleryHoodSeeds(hood);
    const unique = new Set(gallerySeeds);
    assert(unique.size === GALLERY_JIA_SEED_BUCKETS.length, `gallery ${hood} unique seeds ${unique.size} want 8`);
    for (let i = 0; i < gallerySeeds.length; i++) {
      const seed = gallerySeeds[i]!;
      const variant = GALLERY_JIA_SEED_BUCKETS[i]!;
      assert(jiaVariantOf(seed, MAMMAL_REMNANT_ID) === variant, `gallery ${hood} v${variant} bucket`);
      assert(mammalNeighborhoodOf(seed) === hood, `gallery ${hood} v${variant} seed ${seed} must stay ${hood}`);
      console.log(`mammal_remnant gallery ${hood} v${variant} seed ${seed}`);
    }
    const masks = gallerySeeds.map((seed) => maskOf(paintMammalRemnantBody('infiltrate', seed)));
    const distinct = distinctCount(masks);
    console.log(`mammal_remnant gallery ${hood} distinct ${distinct} / ${gallerySeeds.length}`);
    assert(distinct === gallerySeeds.length, `gallery ${hood} 8 seeds must not be the same individual (${distinct}/8)`);
  }
}

const pairDists: number[] = [];
for (const seed of seedList) {
  const rewrite = maskOf(paintMammalRemnantBody('rewrite', seed));
  const overwrite = maskOf(paintMammalRemnantBody('overwrite', seed));
  pairDists.push(coarseDist(rewrite, overwrite));
}
const diagSeed = mix32(7, MAMMAL_REMNANT_ID) % 8192;
const diagDist = coarseDist(
  maskOf(paintMammalRemnantBody('rewrite', diagSeed)),
  maskOf(paintMammalRemnantBody('overwrite', diagSeed)),
);
const minDist = Math.min(...pairDists);
const medDist = median(pairDists);
console.log(
  `mammal_remnant rewrite→overwrite coarse  min ${minDist.toFixed(4)}  median ${medDist.toFixed(4)}  seed7 ${diagDist.toFixed(4)}  baseline ${BASELINE_REWRITE_OVERWRITE}`,
);
assert(
  minDist > BASELINE_REWRITE_OVERWRITE,
  `rewrite→overwrite min coarse ${minDist.toFixed(4)} must beat baseline ${BASELINE_REWRITE_OVERWRITE}`,
);
assert(
  medDist > BASELINE_REWRITE_OVERWRITE,
  `rewrite→overwrite median coarse ${medDist.toFixed(4)} must beat baseline ${BASELINE_REWRITE_OVERWRITE}`,
);
assert(
  diagDist > BASELINE_REWRITE_OVERWRITE,
  `rewrite→overwrite diagnostic coarse ${diagDist.toFixed(4)} must beat baseline ${BASELINE_REWRITE_OVERWRITE}`,
);

if (failed > 0) {
  console.error(`check:jia-mammal-remnant ${failed} failed`);
  process.exit(1);
}
console.log('check:jia-mammal-remnant PASS');
