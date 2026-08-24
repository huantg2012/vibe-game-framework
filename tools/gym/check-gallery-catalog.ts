/**
 * Machine gate for the lexicon gallery visual-identity catalog (I4-A).
 *
 *   npm run check:gallery-catalog
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PortfolioId } from '../../src/generated/contamination-lexicon-data.ts';
import { mix32 } from '../../src/generation/seed-fork.ts';
import {
  GALLERY_ATTACH_CAP,
  GALLERY_CELL_SIZE,
  GALLERY_START_ZOOM,
  GALLERY_VIEW_HEIGHT,
  GALLERY_VIEW_WIDTH,
  GALLERY_ZOOM_MIN,
  cellIntersectsView,
  clampGalleryScroll,
  galleryViewFromCenter,
  galleryViewFromScroll,
  layoutGalleryHall,
  selectGalleryKeep,
  shiftGalleryView,
  type GalleryHallLayout,
  type GalleryLayoutCell,
  type GalleryRect,
} from '../../src/gym/gallery-virtualize.ts';
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
assert(total === 765, `default catalog size must stay 765 (got ${total})`);
assert(inRange(jia, 400, 650), `jia ${jia} in [400, 650]`);
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
assert(
  /export const GYM_CAMERA_ZOOM_MIN = 0\.12/.test(CAMERA_SRC),
  'GYM_CAMERA_ZOOM_MIN must remain 0.12',
);

const MAP_SRC = readFileSync(resolve(ROOT, 'src/gym/gym-map-scene.ts'), 'utf8');
assert(
  /this\.cameraHandle = bindGymCamera\(this\);/.test(MAP_SRC),
  'map lesson must call bindGymCamera(this) with no opts',
);
assert(!/bindGymCamera\(\s*this\s*,/.test(MAP_SRC), 'map lesson must not pass zoomMin into bindGymCamera');
assert(!MAP_SRC.includes('setZoomMin'), 'map lesson must not call setZoomMin');

const GAME_CFG_SRC = readFileSync(resolve(ROOT, 'src/config/game-config.ts'), 'utf8');
assert(/width:\s*960/.test(GAME_CFG_SRC), 'game-config width must stay 960');
assert(/height:\s*640/.test(GAME_CFG_SRC), 'game-config height must stay 640');
assert(GALLERY_VIEW_WIDTH === 960 && GALLERY_VIEW_HEIGHT === 640, 'gallery view size matches logical resolution');

const VIRT_SRC = readFileSync(resolve(ROOT, 'src/gym/gallery-virtualize.ts'), 'utf8');
assert(!/from ['"]phaser['"]/.test(VIRT_SRC), 'gallery-virtualize must not import phaser');
assert(!/\.attach\(/.test(VIRT_SRC), 'gallery-virtualize must not call attach');
assert(
  GALLERY_ATTACH_CAP.jia === 48 &&
    GALLERY_ATTACH_CAP.yi === 48 &&
    GALLERY_ATTACH_CAP.bing === 40 &&
    GALLERY_ATTACH_CAP.ding === 24,
  'attach cap is 48/48/40/24 (sole copy)',
);
assert(
  GALLERY_ZOOM_MIN.jia === 1.1 &&
    GALLERY_ZOOM_MIN.yi === 0.12 &&
    GALLERY_ZOOM_MIN.bing === 0.7 &&
    GALLERY_ZOOM_MIN.ding === 0.55,
  'per-hall zoom floors',
);
assert(
  !/jia:\s*8,\s*yi:\s*12,\s*bing:\s*12,\s*ding:\s*8/.test(VIRT_SRC),
  'virtualize must not keep the retired 8/12/12/8 caps',
);

const SCENE_SRC = readFileSync(resolve(ROOT, 'src/gym/gym-lexicon-gallery-scene.ts'), 'utf8');
assert(SCENE_SRC.includes('selectGalleryKeep'), 'gallery scene must call selectGalleryKeep');
assert(SCENE_SRC.includes('layoutGalleryHall'), 'gallery scene must call layoutGalleryHall');
assert(!SCENE_SRC.includes('function layoutHall'), 'gallery scene must not keep a second layoutHall');
assert(!SCENE_SRC.includes('ATTACH_CAP'), 'gallery scene must not keep a second ATTACH_CAP');
assert(!/slice\(\s*0\s*,/.test(SCENE_SRC), 'gallery scene must not slice keep by cap');
assert(
  !/jia:\s*8,\s*yi:\s*12,\s*bing:\s*12,\s*ding:\s*8/.test(SCENE_SRC),
  'gallery scene must not keep the retired 8/12/12/8 caps',
);
assert(SCENE_SRC.includes('GALLERY_ZOOM_MIN'), 'gallery scene must apply per-hall zoomMin');
assert(SCENE_SRC.includes('setZoomMin'), 'gallery scene must switch zoomMin on hall change');

function shiftedClampedView(
  view: GalleryRect,
  dx: number,
  dy: number,
  zoom: number,
  bounds: GalleryHallLayout['bounds'],
): GalleryRect {
  const shifted = shiftGalleryView(view, dx, dy);
  const clamped = clampGalleryScroll(shifted.x, shifted.y, zoom, bounds);
  return galleryViewFromScroll(clamped.scrollX, clamped.scrollY, zoom);
}

function hallSlideViews(layout: GalleryHallLayout, portfolio: PortfolioId, zoom: number): GalleryRect[] {
  const first = layout.cells[0];
  const last = layout.cells[layout.cells.length - 1];
  if (!first || !last) return [];
  const cell = GALLERY_CELL_SIZE[portfolio];
  const bounds = layout.bounds;
  const onFirst = galleryViewFromCenter(first.x, first.y, zoom, bounds);
  return [
    galleryViewFromCenter(bounds.x + bounds.w * 0.5, bounds.y + bounds.h * 0.5, zoom, bounds),
    onFirst,
    galleryViewFromCenter(last.x, last.y, zoom, bounds),
    shiftedClampedView(onFirst, cell * 0.5, 0, zoom, bounds),
    shiftedClampedView(onFirst, cell, 0, zoom, bounds),
    shiftedClampedView(onFirst, cell * 1.5, 0, zoom, bounds),
    shiftedClampedView(onFirst, 0, cell, zoom, bounds),
  ];
}

/** AABB scan on the hall cells. Do not reuse `selectGalleryKeep.intersectingKeys` — a sliced keep that also shrinks that list would still look green. */
function intersectingKeysOfView(cells: readonly GalleryLayoutCell[], view: GalleryRect): string[] {
  const keys: string[] = [];
  for (const cell of cells) {
    if (cellIntersectsView(cell, view)) keys.push(cell.specimen.visualKey);
  }
  return keys;
}

function assertKeepCoversView(
  label: string,
  layout: GalleryHallLayout,
  view: GalleryRect,
  portfolio: PortfolioId,
  prevKeep: ReadonlySet<string>,
  inspectKey?: string | null,
): ReturnType<typeof selectGalleryKeep> {
  const result = selectGalleryKeep({
    cells: layout.cells,
    view,
    portfolio,
    prevKeepKeys: prevKeep,
    inspectKey,
  });
  const keep = new Set(result.keepKeys);
  const independent = intersectingKeysOfView(layout.cells, view);
  for (const key of independent) {
    const covered = keep.has(key) || key === inspectKey;
    assert(covered, `${label}: intersecting ${key} missing from keep`);
  }
  const reported = new Set(result.intersectingKeys);
  assert(
    independent.length === reported.size && independent.every((key) => reported.has(key)),
    `${label}: intersectingKeys must match AABB scan (${independent.length} vs ${reported.size})`,
  );
  if (inspectKey) {
    assert(!keep.has(inspectKey), `${label}: inspect key must not occupy a hall slot`);
  }
  const cap = GALLERY_ATTACH_CAP[portfolio];
  const intersectingForCap = independent.filter((key) => key !== inspectKey);
  assert(
    intersectingForCap.length <= cap,
    `${label}: |intersecting|=${intersectingForCap.length} > cap ${cap}`,
  );
  assert(!result.overCap, `${label}: overCap (intersecting exceeded cap; raise zoom floor or cap)`);
  return result;
}

function sweepHalls(specimens: readonly GallerySpecimen[], tag: string): void {
  for (const port of portfolioOptions()) {
    for (const sub of substrateOptions(port.id)) {
      const rows = specimens.filter((row) => row.portfolio === port.id && row.substrate === sub.id);
      if (rows.length === 0) continue;
      const layout = layoutGalleryHall(rows, port.id);
      const zooms = [GALLERY_START_ZOOM[port.id], GALLERY_ZOOM_MIN[port.id]];
      for (const zoom of zooms) {
        let prev: Set<string> = new Set();
        const views = hallSlideViews(layout, port.id, zoom);
        for (let i = 0; i < views.length; i += 1) {
          const view = views[i];
          if (!view) continue;
          const label = `${tag} ${port.id}/${sub.id} z=${zoom} view=${i}`;
          assertKeepCoversView(`${label} emptyPrev`, layout, view, port.id, new Set());
          const chained = assertKeepCoversView(label, layout, view, port.id, prev);
          prev = new Set(chained.keepKeys);
        }
      }
    }
  }
}

sweepHalls(listed, 'default');
sweepHalls(withIllegal.specimens, 'illegal');

let biggestJia: { substrate: string; layout: GalleryHallLayout } | null = null;
for (const sub of substrateOptions('jia')) {
  const rows = listed.filter((row) => row.portfolio === 'jia' && row.substrate === sub.id);
  if (rows.length === 0) continue;
  const layout = layoutGalleryHall(rows, 'jia');
  if (!biggestJia || layout.cells.length > biggestJia.layout.cells.length) {
    biggestJia = { substrate: sub.id, layout };
  }
}
assert(biggestJia !== null && biggestJia.layout.cells.length > 0, 'jia has a hall to reproduce the scroll bug');
if (biggestJia) {
  const layout = biggestJia.layout;
  const first = layout.cells[0];
  assert(first !== undefined, 'jia largest hall has a first cell');
  if (first) {
    const zoom = 1.25;
    assert(zoom === GALLERY_START_ZOOM.jia, 'repro zoom is jia start zoom 1.25');
    const beforeView = galleryViewFromCenter(first.x, first.y, zoom, layout.bounds);
    const afterView = shiftedClampedView(beforeView, GALLERY_CELL_SIZE.jia, 0, zoom, layout.bounds);
    assert(
      afterView.x > beforeView.x + 1,
      `jia repro view must move right (before x=${beforeView.x} after x=${afterView.x})`,
    );
    const before = assertKeepCoversView(
      `jia-repro ${biggestJia.substrate} before`,
      layout,
      beforeView,
      'jia',
      new Set(),
    );
    const after = assertKeepCoversView(
      `jia-repro ${biggestJia.substrate} after`,
      layout,
      afterView,
      'jia',
      new Set(before.keepKeys),
    );
    const beforeKeep = new Set(before.keepKeys);
    const afterKeep = new Set(after.keepKeys);
    const afterIntersecting = new Set(after.intersectingKeys);
    for (const key of before.intersectingKeys) {
      if (!afterIntersecting.has(key)) continue;
      assert(beforeKeep.has(key), `jia-repro: still-intersecting ${key} was not in before keep`);
      assert(afterKeep.has(key), `jia-repro: still-intersecting ${key} dropped after one-cell pan — screenshot bug`);
    }
    const mid = layout.cells[Math.floor(layout.cells.length / 2)];
    if (mid) {
      const inspectView = galleryViewFromCenter(mid.x, mid.y, zoom, layout.bounds);
      assertKeepCoversView(
        `jia-repro inspect ${mid.specimen.visualKey}`,
        layout,
        inspectView,
        'jia',
        new Set(),
        mid.specimen.visualKey,
      );
    }
    console.log(
      [
        `jia-repro hall=${biggestJia.substrate} cells=${layout.cells.length} zoom=1.25`,
        `  before scrollX=${beforeView.x.toFixed(1)} intersecting=${before.intersectingKeys.length} keep=${before.keepKeys.length}`,
        `  after  scrollX=${afterView.x.toFixed(1)} intersecting=${after.intersectingKeys.length} keep=${after.keepKeys.length}`,
      ].join('\n'),
    );

    // Runtime fallback lock: illegal zoom (below hall floor) may put intersecting > cap.
    // Keep must still contain every intersecting cell; the legal-zoom sweep above must stay !overCap.
    const illegalZoom = 0.12;
    const overflowView = galleryViewFromCenter(
      layout.bounds.x + layout.bounds.w * 0.5,
      layout.bounds.y + layout.bounds.h * 0.5,
      illegalZoom,
      layout.bounds,
    );
    const overflowIntersecting = intersectingKeysOfView(layout.cells, overflowView);
    const overflow = selectGalleryKeep({
      cells: layout.cells,
      view: overflowView,
      portfolio: 'jia',
      prevKeepKeys: new Set(),
    });
    assert(
      overflowIntersecting.length > GALLERY_ATTACH_CAP.jia,
      `overCap fallback setup: intersecting ${overflowIntersecting.length} should exceed cap ${GALLERY_ATTACH_CAP.jia}`,
    );
    assert(overflow.overCap, 'overCap fallback: flag must be true when intersecting exceeds cap');
    const overflowKeep = new Set(overflow.keepKeys);
    for (const key of overflowIntersecting) {
      assert(overflowKeep.has(key), `overCap fallback: intersecting ${key} must stay in keep`);
    }
    assert(
      overflow.keepKeys.length >= overflowIntersecting.length,
      `overCap fallback: keep ${overflow.keepKeys.length} must not shrink intersecting ${overflowIntersecting.length}`,
    );
  }
}

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
