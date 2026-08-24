/**
 * I6-P 回归夹具：固定种子下三张已启用碎片的残墟几何快照。
 *
 *   npx tsx --tsconfig tsconfig.json tools/map-preview/snapshot-i6-p.ts write
 *   npx tsx --tsconfig tsconfig.json tools/map-preview/snapshot-i6-p.ts check
 *
 * 比对字段：墙后可走掩膜、墙掩膜、每个残块的 kind / 格子集合 / 朝向主轴 / alignY。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateRuins } from '../../src/generation/ruins.ts';
import type { RuinCell, RuinFeature, RuinedMask } from '../../src/generation/types.ts';

const FRAGMENTS = ['frag-outdoor', 'frag-clinic', 'frag-metro'] as const;
const SEEDS = [101, 202, 303, 404, 505, 606] as const;

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, 'fixtures');
const FIXTURE_PATH = join(FIXTURE_DIR, 'i6-p-mass-grammar.json');

type Axis = 'v' | 'h' | 'square';

type FeatureSnap = {
  kind: string;
  axis: Axis;
  alignY: boolean;
  cells: string[];
};

type CaseSnap = {
  fragmentTypeId: string;
  seed: number;
  attempt: number;
  walkable: string;
  walls: string;
  features: FeatureSnap[];
};

type SnapshotFile = {
  capturedAt: string;
  fragments: readonly string[];
  seeds: readonly number[];
  cases: CaseSnap[];
};

function maskB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function walkableMask(mask: RuinedMask): Uint8Array {
  const out = new Uint8Array(mask.walls.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = mask.outline.land[i] && !mask.walls[i] ? 1 : 0;
  }
  return out;
}

function cellKey(cell: RuinCell): string {
  return `${cell.col},${cell.row}`;
}

function massAxis(cells: readonly RuinCell[]): Axis {
  if (cells.length === 0) return 'square';
  let minC = cells[0]!.col;
  let maxC = minC;
  let minR = cells[0]!.row;
  let maxR = minR;
  for (const cell of cells) {
    if (cell.col < minC) minC = cell.col;
    if (cell.col > maxC) maxC = cell.col;
    if (cell.row < minR) minR = cell.row;
    if (cell.row > maxR) maxR = cell.row;
  }
  const spanC = maxC - minC;
  const spanR = maxR - minR;
  if (spanR > spanC) return 'v';
  if (spanC > spanR) return 'h';
  return 'square';
}

function snapFeature(feat: RuinFeature): FeatureSnap {
  const cells = feat.cells.map(cellKey).sort();
  return {
    kind: feat.kind,
    axis: massAxis(feat.cells),
    alignY: feat.alignY === true,
    cells,
  };
}

function snapCase(fragmentTypeId: string, seed: number): CaseSnap {
  const mask = generateRuins(seed, fragmentTypeId);
  return {
    fragmentTypeId,
    seed,
    attempt: mask.attempt,
    walkable: maskB64(walkableMask(mask)),
    walls: maskB64(mask.walls),
    features: mask.features.map(snapFeature),
  };
}

function captureAll(): SnapshotFile {
  const cases: CaseSnap[] = [];
  for (const fragmentTypeId of FRAGMENTS) {
    for (const seed of SEEDS) {
      cases.push(snapCase(fragmentTypeId, seed));
    }
  }
  return {
    capturedAt: new Date().toISOString(),
    fragments: [...FRAGMENTS],
    seeds: [...SEEDS],
    cases,
  };
}

function firstDiff(a: CaseSnap, b: CaseSnap): string | null {
  if (a.attempt !== b.attempt) return `attempt ${a.attempt} → ${b.attempt}`;
  if (a.walkable !== b.walkable) return 'walkable mask';
  if (a.walls !== b.walls) return 'walls mask';
  if (a.features.length !== b.features.length) {
    return `feature count ${a.features.length} → ${b.features.length}`;
  }
  for (let i = 0; i < a.features.length; i++) {
    const fa = a.features[i]!;
    const fb = b.features[i]!;
    if (fa.kind !== fb.kind) return `feature[${i}].kind ${fa.kind} → ${fb.kind}`;
    if (fa.axis !== fb.axis) return `feature[${i}].axis ${fa.axis} → ${fb.axis}`;
    if (fa.alignY !== fb.alignY) return `feature[${i}].alignY ${String(fa.alignY)} → ${String(fb.alignY)}`;
    if (fa.cells.length !== fb.cells.length || fa.cells.some((c, j) => c !== fb.cells[j])) {
      return `feature[${i}].cells`;
    }
  }
  return null;
}

function writeSnapshot(): void {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const snap = captureAll();
  writeFileSync(FIXTURE_PATH, `${JSON.stringify(snap)}\n`);
  console.log(`wrote ${snap.cases.length} cases → ${FIXTURE_PATH}`);
}

function checkSnapshot(): void {
  if (!existsSync(FIXTURE_PATH)) {
    console.error(`missing fixture ${FIXTURE_PATH} (run write first)`);
    process.exit(1);
  }
  const golden = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as SnapshotFile;
  const live = captureAll();
  if (golden.cases.length !== live.cases.length) {
    console.error(`FAIL case count ${golden.cases.length} → ${live.cases.length}`);
    process.exit(1);
  }
  let failed = 0;
  for (let i = 0; i < golden.cases.length; i++) {
    const g = golden.cases[i]!;
    const l = live.cases[i]!;
    const label = `${g.fragmentTypeId} seed=${g.seed}`;
    if (l.fragmentTypeId !== g.fragmentTypeId || l.seed !== g.seed) {
      console.error(`FAIL ${label}: case identity drifted`);
      failed++;
      continue;
    }
    const diff = firstDiff(g, l);
    if (diff) {
      console.error(`FAIL ${label}: ${diff}`);
      failed++;
    }
  }
  if (failed > 0) {
    console.error(`FAIL ${failed}/${golden.cases.length} cases drifted`);
    process.exit(1);
  }
  console.log(`PASS ${golden.cases.length} cases byte-identical (${FRAGMENTS.join(', ')}; seeds ${SEEDS.join(',')})`);
}

const mode = process.argv[2] ?? 'check';
if (mode === 'write') writeSnapshot();
else if (mode === 'check') checkSnapshot();
else {
  console.error(`unknown mode '${mode}' (use write | check)`);
  process.exit(1);
}
