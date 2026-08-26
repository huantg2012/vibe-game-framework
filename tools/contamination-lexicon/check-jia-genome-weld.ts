/**
 * I5-B machine gate: weld 后可见身体四连通分量必须为 1。
 * 同时断言默认 d-mixed 出击路径仍走旧 attachJiaD（字节级）。
 *
 *   npm run check:jia-genome-weld
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { genomeCanvasOf } from '../../src/entities/form-renderers/d/genome/canvas.ts';
import { buildFixtureSkeleton } from '../../src/entities/form-renderers/d/genome/fixture.ts';
import { GENOME_PART_KINDS } from '../../src/entities/form-renderers/d/genome/types.ts';
import { countOpaquePixels, drawSkeleton } from '../../src/entities/form-renderers/d/genome/parts.ts';
import { countOpaque4Components, paintWeldedBody, weld } from '../../src/entities/form-renderers/d/genome/weld.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

let failed = 0;

function assert(cond: unknown, msg: string): void {
  if (cond) return;
  failed += 1;
  console.error(`FAIL ${msg}`);
}

const kinds = new Set(GENOME_PART_KINDS);
assert(kinds.size === 7, `shared part kinds ${[...kinds].join(',')} want 7`);
assert(kinds.has('post') && kinds.has('beam') && kinds.has('mass') && kinds.has('plate'), 'rod/beam/mass/plate present');
assert(kinds.has('filament') && kinds.has('nub') && kinds.has('core'), 'filament/nub/core present');

const infiltrate = genomeCanvasOf('infiltrate');
assert(infiltrate.w === 32 && infiltrate.h === 32, `infiltrate canvas ${infiltrate.w}x${infiltrate.h} want 32x32`);
assert(infiltrate.collision === 20 && infiltrate.offsetX === 6 && infiltrate.offsetY === 6, 'infiltrate offset (32-20)/2');

const rewrite = genomeCanvasOf('rewrite');
assert(rewrite.w === 32 && rewrite.h === 48, `rewrite canvas ${rewrite.w}x${rewrite.h} want 32x48`);
assert(rewrite.collision === 20 && rewrite.offsetX === 6 && rewrite.offsetY === 14, 'rewrite offset');

const overwrite = genomeCanvasOf('overwrite');
assert(overwrite.w === 48 && overwrite.h === 64, `overwrite canvas ${overwrite.w}x${overwrite.h} want 48x64`);
assert(overwrite.collision === 20 && overwrite.offsetX === 14 && overwrite.offsetY === 22, 'overwrite offset');

const hear = genomeCanvasOf('infiltrate', 'sense_hear');
assert(hear.w === 32 && hear.h === 48, `infiltrate+hear canvas ${hear.w}x${hear.h} want 32x48`);
assert(genomeCanvasOf('overwrite', 'sense_hear').w === 48, 'overwrite canvas stays 48x64 with hear');

const coverages = ['infiltrate', 'rewrite', 'overwrite'] as const;
for (const coverage of coverages) {
  const split = buildFixtureSkeleton(coverage, 7, undefined, true);
  const before = drawSkeleton(split);
  const beforeN = countOpaque4Components(before);
  assert(beforeN > 1, `${coverage} split fixture before weld components ${beforeN} want > 1`);
  const after = paintWeldedBody(split);
  const afterN = countOpaque4Components(after);
  assert(afterN === 1, `${coverage} weld 4-connected components ${afterN} want 1`);
  assert(countOpaquePixels(after) > 0, `${coverage} welded body is not empty`);
}

const connected = buildFixtureSkeleton('infiltrate', 3);
weld(connected);
const connectedBuf = paintWeldedBody(connected);
assert(countOpaque4Components(connectedBuf) === 1, 'already-connected fixture stays 1 component');

const used = new Set(connected.parts.map((p) => p.kind));
for (const kind of GENOME_PART_KINDS) {
  assert(used.has(kind), `fixture exercises part kind ${kind}`);
}

const mixedSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/scheme-d-mixed.ts'), 'utf8');
assert(mixedSrc.includes("from '@/entities/form-renderers/d/jia'"), 'd-mixed imports attachJiaD module');
assert(/case 'floor':\s*return attachJiaD\(ctx\);/.test(mixedSrc), 'd-mixed floor path is attachJiaD');
assert(!mixedSrc.includes('genome'), 'd-mixed does not mention genome');
assert(!mixedSrc.includes('attachJiaGenomeD'), 'd-mixed does not call attachJiaGenomeD');

const riftSrc = readFileSync(resolve(ROOT, 'src/scenes/rift-scene.ts'), 'utf8');
assert(!riftSrc.includes('form-renderers/d/genome'), 'RiftScene does not import genome');
assert(riftSrc.includes("getFormRenderer('d-mixed')"), 'RiftScene still attaches d-mixed');

if (failed > 0) {
  console.error(`check:jia-genome-weld ${failed} failed`);
  process.exit(1);
}
console.log('check:jia-genome-weld PASS');
