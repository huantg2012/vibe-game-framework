/**
 * I5-D：七个违规算子 + 覆盖档预算。
 * 作用在骨架上，然后才 weld、然后才刷漆。
 * 用夹具骨架验收；禁止在此填七个基体完整语法。
 * 放射只在覆盖档解锁：渗透 / 改写抽到放射 = 不合格（算子抽不到，不是画成灰放射）。
 */
import { mix32 } from '@/generation/seed-fork';
import { SeededRandom } from '@/utils/random';
import { partBounds } from '@/entities/form-renderers/d/genome/parts';
import type { GenomeNode, GenomeSkeleton } from '@/entities/form-renderers/d/genome/types';
import type { CoverageId } from '@/generated/contamination-lexicon-data';

/** 数量 / 对称 / 层级 / 拼贴 / 朝向 / 尺度 / 放射 */
export const OPERATOR_IDS = [
  'quantity',
  'symmetry',
  'hierarchy',
  'graft',
  'facing',
  'scale',
  'radiate',
] as const;
export type OperatorId = (typeof OPERATOR_IDS)[number];

export const OPERATOR_BUDGET: Record<CoverageId, 1 | 3 | 5> = {
  infiltrate: 1,
  rewrite: 3,
  overwrite: 5,
};

export function operatorBudget(coverage: CoverageId): 1 | 3 | 5 {
  return OPERATOR_BUDGET[coverage];
}

export function radiateAllowed(coverage: CoverageId): boolean {
  return coverage === 'overwrite';
}

/** 渗透 / 改写池子没有放射；覆盖档七张全开。 */
export function operatorPool(coverage: CoverageId): readonly OperatorId[] {
  if (radiateAllowed(coverage)) return OPERATOR_IDS;
  return OPERATOR_IDS.filter((id) => id !== 'radiate');
}

function cloneNode(p: GenomeNode): GenomeNode {
  return {
    kind: p.kind,
    x: p.x,
    y: p.y,
    w: p.w,
    h: p.h,
    mat: p.mat,
    role: p.role,
    bend: p.bend,
  };
}

function clampPart(p: GenomeNode, canvasW: number, canvasH: number): void {
  const b = partBounds(p);
  let dx = 0;
  let dy = 0;
  if (b.x < 0) dx = -b.x;
  else if (b.x + b.w > canvasW) dx = canvasW - (b.x + b.w);
  if (b.y < 0) dy = -b.y;
  else if (b.y + b.h > canvasH) dy = canvasH - (b.y + b.h);
  p.x = Math.round(p.x + dx);
  p.y = Math.round(p.y + dy);
  p.w = Math.max(1, Math.round(p.w));
  p.h = Math.max(1, Math.round(p.h));
}

function clampAll(sk: GenomeSkeleton): void {
  for (const p of sk.parts) clampPart(p, sk.canvas.w, sk.canvas.h);
}

function nonBase(parts: readonly GenomeNode[]): GenomeNode[] {
  return parts.filter((p) => p.role !== 'base');
}

function pickHost(parts: GenomeNode[], rng: SeededRandom): GenomeNode {
  const pool = nonBase(parts);
  return rng.pick(pool.length > 0 ? pool : parts);
}

/** 数量：主构件（脊）翻到约三倍，副本与本体重叠，交给 weld 焊住。 */
function applyQuantity(sk: GenomeSkeleton, rng: SeededRandom): void {
  const spines = sk.parts.filter((p) => p.role === 'spine');
  const src = spines.length > 0 ? spines : nonBase(sk.parts);
  if (src.length === 0) return;
  const copies = Math.max(2, src.length * 2);
  for (let i = 0; i < copies; i++) {
    const p = cloneNode(rng.pick(src));
    p.x += rng.nextInt(-3, 3);
    p.y += rng.nextInt(-2, 2);
    p.w = Math.max(1, p.w - rng.nextInt(0, 1));
    p.h = Math.max(2, p.h - rng.nextInt(0, 3));
    p.role = 'rib';
    sk.parts.push(p);
  }
}

/** 对称：一侧整体拉长 / 加粗。 */
function applySymmetry(sk: GenomeSkeleton, rng: SeededRandom): void {
  const cx = sk.canvas.w / 2;
  const side = rng.next() < 0.5 ? 1 : -1;
  const stretch = rng.nextInt(2, 5);
  for (const p of sk.parts) {
    if (p.role === 'base') continue;
    const mid = p.x + p.w / 2;
    if ((mid - cx) * side <= 0) continue;
    p.y = Math.max(0, p.y - stretch);
    p.h += stretch;
    if (rng.next() < 0.5) p.w += 1;
  }
}

/** 层级：在宿主上长出缩小的同族骨架（夹具自己的构件，不是换基体）。 */
function applyHierarchy(sk: GenomeSkeleton, rng: SeededRandom): void {
  const host = pickHost(sk.parts, rng);
  const snapshot = nonBase(sk.parts).map(cloneNode);
  if (snapshot.length === 0) return;
  const scale = 0.35 + rng.next() * 0.2;
  const take = Math.min(snapshot.length, rng.nextInt(2, 4));
  for (let i = 0; i < take; i++) {
    const p = snapshot[i]!;
    if (p.role === 'base') continue;
    const child = cloneNode(p);
    child.w = Math.max(1, Math.round(p.w * scale));
    child.h = Math.max(1, Math.round(p.h * scale));
    child.x = Math.round(host.x + (host.w - child.w) / 2 + rng.nextInt(-1, 1));
    child.y = Math.round(host.y + rng.nextInt(0, Math.max(0, host.h - 1)));
    child.role = 'accent';
    sk.parts.push(child);
  }
}

/**
 * 拼贴：焊上另一个基体的签名构件。
 * I5-D 只在夹具上验收，用三种签名戳记，不是七个基体完整语法。
 */
function applyGraft(sk: GenomeSkeleton, rng: SeededRandom): void {
  const host = pickHost(sk.parts, rng);
  const which = rng.nextInt(0, 2);
  if (which === 0) {
    sk.parts.push({
      kind: 'beam',
      x: host.x - 2,
      y: host.y,
      w: Math.max(6, host.w + 4),
      h: 2,
      mat: 'brick',
      role: 'lintel',
    });
  } else if (which === 1) {
    sk.parts.push({
      kind: 'post',
      x: host.x + host.w - 1,
      y: host.y,
      w: 1,
      h: Math.max(6, Math.min(host.h, 12)),
      mat: 'bone',
      role: 'limb',
    });
  } else {
    sk.parts.push({
      kind: 'mass',
      x: host.x,
      y: Math.max(0, host.y - 2),
      w: Math.max(3, Math.min(6, host.w + 2)),
      h: Math.max(3, Math.min(5, host.h)),
      mat: 'earth',
      role: 'accent',
    });
  }
}

/** 朝向：构件在锚点上转约 90°；丝反向弯。 */
function applyFacing(sk: GenomeSkeleton, rng: SeededRandom): void {
  const cands = sk.parts.filter(
    (p) => p.role === 'rib' || p.role === 'limb' || p.role === 'lintel',
  );
  const pool = cands.length > 0 ? cands : nonBase(sk.parts);
  if (pool.length === 0) return;
  const n = Math.min(pool.length, rng.nextInt(1, 3));
  for (let i = 0; i < n; i++) {
    const p = rng.pick(pool);
    if (p.kind === 'filament') {
      p.bend = -(p.bend ?? 1) * rng.nextInt(2, 3);
      continue;
    }
    const ax = p.x + p.w / 2;
    const ay = p.y + p.h / 2;
    const nw = p.h;
    const nh = p.w;
    p.w = Math.max(1, nw);
    p.h = Math.max(1, nh);
    p.x = Math.round(ax - p.w / 2);
    p.y = Math.max(0, Math.round(ay - p.h / 2));
  }
}

/** 尺度：某构件放大到压过本体。 */
function applyScale(sk: GenomeSkeleton, rng: SeededRandom): void {
  const prefer = sk.parts.filter(
    (p) => p.role === 'head' || p.kind === 'core' || p.kind === 'mass',
  );
  const pool = prefer.length > 0 ? prefer : nonBase(sk.parts);
  if (pool.length === 0) return;
  const p = rng.pick(pool);
  const k = 1.7 + rng.next() * 1.2;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  p.w = Math.max(2, Math.round(p.w * k));
  p.h = Math.max(
    2,
    Math.round(p.h * (p.kind === 'post' || p.kind === 'filament' ? 1 : k)),
  );
  p.x = Math.round(cx - p.w / 2);
  p.y = Math.max(0, Math.round(cy - p.h / 2));
  if (p.kind === 'core') p.mat = 'glow';
}

/** 放射：线性骨架变放射对称。只在覆盖档调用。 */
function applyRadiate(sk: GenomeSkeleton, rng: SeededRandom): void {
  const host =
    sk.parts.find((p) => p.role === 'head') ??
    sk.parts.find((p) => p.role === 'spine') ??
    sk.parts[0];
  if (!host) return;
  const hubX = Math.round(host.x + host.w / 2);
  const hubY = Math.round(host.y + host.h / 2);
  const arms = rng.nextInt(3, 5);
  const maxLen = Math.max(6, Math.floor(sk.canvas.h * 0.28));
  for (let i = 0; i < arms; i++) {
    const len = rng.nextInt(6, maxLen);
    const dir = i / arms;
    const bend = Math.round(Math.cos(dir * Math.PI * 2) * len * 0.8);
    sk.parts.push({
      kind: 'filament',
      x: hubX,
      y: Math.max(0, hubY - 1),
      w: 1,
      h: len,
      bend,
      mat: i % 2 === 0 ? 'metal' : 'bone',
      role: 'rib',
    });
  }
  sk.parts.push({
    kind: 'core',
    x: hubX,
    y: hubY,
    w: 2,
    h: 2,
    mat: 'glow',
    role: 'accent',
  });
}

export function pickOperators(coverage: CoverageId, seed: number): OperatorId[] {
  const rng = new SeededRandom(mix32(seed, `operators:${coverage}`));
  const bag = [...operatorPool(coverage)];
  rng.shuffle(bag);
  return bag.slice(0, operatorBudget(coverage));
}

/**
 * 按名应用一条算子。渗透 / 改写点名放射必须抛错（闸门据此 FAIL），不得画成灰放射。
 */
export function applyNamedOperator(
  sk: GenomeSkeleton,
  id: OperatorId,
  rng: SeededRandom,
  coverage: CoverageId,
): void {
  if (id === 'radiate' && !radiateAllowed(coverage)) {
    throw new Error(`radiate is locked at coverage ${coverage}`);
  }
  switch (id) {
    case 'quantity':
      applyQuantity(sk, rng);
      break;
    case 'symmetry':
      applySymmetry(sk, rng);
      break;
    case 'hierarchy':
      applyHierarchy(sk, rng);
      break;
    case 'graft':
      applyGraft(sk, rng);
      break;
    case 'facing':
      applyFacing(sk, rng);
      break;
    case 'scale':
      applyScale(sk, rng);
      break;
    case 'radiate':
      applyRadiate(sk, rng);
      break;
  }
  clampAll(sk);
}

/**
 * 按覆盖档预算抽算子并作用在骨架上。不 weld、不刷漆。
 * 同一档抽哪几条由种子决定。
 */
export function applyOperators(
  sk: GenomeSkeleton,
  coverage: CoverageId,
  seed: number,
): OperatorId[] {
  const rng = new SeededRandom(mix32(seed, `operators:${coverage}`));
  const bag = [...operatorPool(coverage)];
  rng.shuffle(bag);
  const picked = bag.slice(0, operatorBudget(coverage));
  for (const id of picked) {
    applyNamedOperator(sk, id, rng, coverage);
  }
  return picked;
}
