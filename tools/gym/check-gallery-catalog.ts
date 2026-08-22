/**
 * Machine gate for the lexicon gallery visual-identity catalog (I4-A).
 *
 *   npm run check:gallery-catalog
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mix32 } from '../../src/generation/seed-fork.ts';
import { portfolioOptions, substrateOptions } from '../../src/gym/gym-lexicon-form.ts';
import {
  CANONICAL_SEED,
  GALLERY_AXES,
  collectGalleryCatalog,
  enumerateGallerySpecimens,
  galleryDedupeCopy,
  infiltrateResidualMotion,
  jiaSeedForVariant,
  jiaVariantOf,
  visualKeyOf,
  type GallerySpecimen,
} from '../../src/gym/lexicon-gallery-catalog.ts';
import { resolveStopLoss } from '../../src/systems/contamination-host-live.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CATALOG_SRC = resolve(ROOT, 'src/gym/lexicon-gallery-catalog.ts');

let failed = 0;

function assert(cond: unknown, msg: string): void {
  if (cond) return;
  failed += 1;
  console.error(`FAIL ${msg}`);
}

function inRange(n: number, lo: number, hi: number): boolean {
  return n >= lo && n <= hi;
}

function sameStopLoss(
  a: GallerySpecimen['stopLoss'],
  b: ReturnType<typeof resolveStopLoss>,
): boolean {
  if (a === 'illegal' || b === 'illegal') return a === b;
  return a.family === b.family && a.corePolicy === b.corePolicy && a.hittable === b.hittable;
}

const src = readFileSync(CATALOG_SRC, 'utf8');
assert(!/from ['"]phaser['"]/.test(src), 'catalog must not import phaser');
assert(!/ContaminationHostSystem/.test(src), 'catalog must not name ContaminationHostSystem');
assert(!/\bfrom ['"][^'"]*\/enemy['"]/.test(src), 'catalog must not import Enemy');
assert(!/\.attach\(/.test(src), 'catalog must not call attach');

const listed = enumerateGallerySpecimens();
const collected = collectGalleryCatalog();
assert(listed.length === collected.specimens.length, 'enumerateGallerySpecimens matches collectGalleryCatalog');
assert(
  listed.every((row, i) => row.visualKey === collected.specimens[i]?.visualKey),
  'enumerateGallerySpecimens order matches collectGalleryCatalog',
);

const byPortfolio: Record<string, number> = { jia: 0, yi: 0, bing: 0, ding: 0 };
const keys = new Set<string>();
let keyCollision = false;
for (const spec of listed) {
  byPortfolio[spec.portfolio] = (byPortfolio[spec.portfolio] ?? 0) + 1;
  if (keys.has(spec.visualKey)) keyCollision = true;
  keys.add(spec.visualKey);
  assert(spec.visualKey === visualKeyOf(spec.form, spec.seedBucket), `visualKeyOf matches stored key ${spec.visualKey}`);
  assert(spec.portfolio === spec.form.portfolio, `portfolio field ${spec.visualKey}`);
  assert(spec.substrate === spec.form.substrate, `substrate field ${spec.visualKey}`);
    assert(sameStopLoss(spec.stopLoss, resolveStopLoss(spec.form)), `stopLoss field ${spec.visualKey}`);
  assert(spec.stopLoss !== 'illegal', `default list excludes illegal stop-loss ${spec.visualKey}`);
  if (spec.portfolio !== 'jia') {
    assert(spec.form.lexemes.contact !== 'contact_melee_three', `non-jia melee three ${spec.visualKey}`);
    assert(spec.seedBucket === 0, `non-jia seedBucket is 0 ${spec.visualKey}`);
    assert(spec.seed === CANONICAL_SEED, `non-jia uses CANONICAL_SEED ${spec.visualKey}`);
  } else {
    assert(spec.seedBucket === 0 || spec.seedBucket === 1 || spec.seedBucket === 2, `jia seedBucket ${spec.visualKey}`);
    assert(jiaVariantOf(spec.seed, spec.substrate) === spec.seedBucket, `jia seed matches bucket ${spec.visualKey}`);
    if (spec.form.coverage === 'infiltrate') {
      const lock = infiltrateResidualMotion(spec.substrate);
      if (lock) {
        assert(spec.form.lexemes.motion === lock, `jia infiltrate motion is residual lock ${spec.visualKey}`);
      }
    }
  }
  assert(spec.enabledScope === 'sortie' || spec.enabledScope === 'gym', `enabledScope ${spec.visualKey}`);
}

assert(!keyCollision, 'visualKey has no collisions');
assert(keys.size === listed.length, `visualKey unique (set ${keys.size} vs ${listed.length})`);

const jia = byPortfolio.jia ?? 0;
const yi = byPortfolio.yi ?? 0;
const bing = byPortfolio.bing ?? 0;
const ding = byPortfolio.ding ?? 0;
const total = listed.length;

assert(inRange(total, 400, 800), `total ${total} in [400, 800]`);
assert(inRange(jia, 200, 400), `jia ${jia} in [200, 400]`);
assert(inRange(yi, 15, 80), `yi ${yi} in [15, 80]`);
assert(inRange(bing, 80, 350), `bing ${bing} in [80, 350]`);
assert(inRange(ding, 20, 120), `ding ${ding} in [20, 120]`);

const withIllegal = collectGalleryCatalog({ includeIllegal: true });
assert(withIllegal.specimens.length > total, `includeIllegal ${withIllegal.specimens.length} > default ${total}`);

const clinicKeys = new Set(
  enumerateGallerySpecimens({ fragmentTypeId: 'frag-clinic' }).map((row) => row.visualKey),
);
const metroKeys = new Set(
  enumerateGallerySpecimens({ fragmentTypeId: 'frag-metro' }).map((row) => row.visualKey),
);
assert(clinicKeys.size === metroKeys.size, `fragment swap keeps identity count (${clinicKeys.size} vs ${metroKeys.size})`);
assert(
  [...clinicKeys].every((key) => metroKeys.has(key)),
  'fragment swap does not change visualKey set',
);

for (const port of portfolioOptions()) {
  const copy = galleryDedupeCopy(port.id);
  assert(Array.isArray(copy.occupying) && copy.occupying.length > 0, `${port.id} occupying list`);
  assert(
    copy.occupying.every((row) => typeof row.item === 'string' && row.item.length > 0 && !row.item.includes('|')),
    `${port.id} occupying items are separate field names`,
  );
  assert(
    copy.nonOccupying.every((row) => typeof row.item === 'string' && row.item.length > 0),
    `${port.id} nonOccupying items are separate field names`,
  );
  assert(
    copy.rules.every((row) => typeof row.item === 'string' && typeof row.value === 'string'),
    `${port.id} rules are item/value pairs, not a compound noun`,
  );
  assert(copy.canonicalSeed === CANONICAL_SEED, `${port.id} canonical seed`);
  const axes = GALLERY_AXES[port.id];
  assert(axes.occupying.includes('基体'), `${port.id} occupying names include 基体`);
}

for (const sub of substrateOptions('jia')) {
  for (const variant of [0, 1, 2] as const) {
    const seed = jiaSeedForVariant(sub.id, variant);
    assert((mix32(seed, sub.id) % 3) === variant, `jiaSeedForVariant ${sub.id} ${variant}`);
  }
}

// 滚轮回归网。Phaser 3.80 的 POINTER_WHEEL 只 emit (pointer, currentlyOver, dx, dy, dz)；
// 曾经有人按第六个 DOM 事件参数写，`event.preventDefault()` 首行即抛，整个滚轮处理静默失效。
// EventEmitter 是松类型，tsc 抓不到这类 arity 错误，只能在源码层拦。
const CAMERA_SRC = readFileSync(resolve(ROOT, 'src/gym/gym-camera.ts'), 'utf8');
const wheelSig = CAMERA_SRC.split('const onWheel = (')[1]?.split(')')[0] ?? '';
assert(
  !/WheelEvent/.test(wheelSig),
  'gym camera wheel handler must not declare a 6th WheelEvent arg (Phaser emits 5)',
);
assert(
  CAMERA_SRC.includes('pointer.event as WheelEvent'),
  'gym camera must read wheel modifiers from pointer.event',
);
assert(
  !/\bevent\.preventDefault\(\)/.test(CAMERA_SRC),
  'gym camera must not call preventDefault on the non-existent emitted event',
);

function countByPortfolio(rows: readonly GallerySpecimen[]): Record<string, number> {
  const out: Record<string, number> = { jia: 0, yi: 0, bing: 0, ding: 0 };
  for (const row of rows) out[row.portfolio] = (out[row.portfolio] ?? 0) + 1;
  return out;
}

const illegalBy = countByPortfolio(withIllegal.specimens);
console.log(
  [
    `default total=${total} jia=${jia} yi=${yi} bing=${bing} ding=${ding}`,
    `includeIllegal total=${withIllegal.specimens.length} (Δ ${withIllegal.specimens.length - total})`,
    `includeIllegal jia=${illegalBy.jia} yi=${illegalBy.yi} bing=${illegalBy.bing} ding=${illegalBy.ding}`,
    `discards residualMotionLock=${collected.discards.residualMotionLock} contactMeleeThree=${collected.discards.contactMeleeThree} illegalStopLoss=${collected.discards.illegalStopLoss}`,
    `utterances attached=${collected.discards.utterancesAttached} newCell=${collected.discards.utterancesNewCell}`,
    `CANONICAL_SEED=${CANONICAL_SEED}`,
  ].join('\n'),
);

if (failed > 0) {
  console.error(`check:gallery-catalog FAILED (${failed})`);
  process.exit(1);
}
console.log('check:gallery-catalog OK');
