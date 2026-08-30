/**
 * I10-HOTFIX-1: loot pile vs fragment floor contrast (DEC-110 / v2).
 *
 *   npm run check:loot-pile-contrast
 *
 * Four enabled fragments. Floor cell = contrastFloorCell(floorBv × floorBias), no +16.
 * CIE76 from src/generation/cie76.ts (same function as check:contam-floor-contrast).
 */
import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import { deltaE76, meanRgb } from '@/generation/cie76';
import {
  contrastFloorCell,
  DEBRIS_HEX,
  DEBRIS_HEX_SET,
  hexToRgb,
  L1_EXCLUDED_HEX,
  L1_POOL,
  PALETTE_HEX,
  rgbToHexString,
  TEAL_FAMILY_SET,
  type Rgb,
} from '@/generation/palette-quantize';
import { derivePileSlots } from '@/systems/loot-search-presentation';

const FRAGMENTS = ['frag-outdoor', 'frag-clinic', 'frag-metro', 'frag-library'] as const;

const BODY_MIN = 18;
const HIGHLIGHT_MIN = 20;
const SHADOW_MIN = 8;

function fail(msg: string): never {
  console.error(`loot-pile-contrast check failed: ${msg}`);
  process.exit(1);
}

function assert(cond: boolean, msg: string): void {
  if (!cond) fail(msg);
}

function phaserToRgb(n: number): Rgb {
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexOf(rgb: Rgb): string {
  return rgbToHexString(rgb);
}

function groundMain(id: string): Rgb {
  const def = RIFT_FRAGMENT_DATA[id];
  if (!def) fail(`missing fragment def ${id}`);
  return contrastFloorCell(
    def.floorBv * def.floorBiasR,
    def.floorBv * def.floorBiasG,
    def.floorBv * def.floorBiasB,
  );
}

const paletteSet = new Set(PALETTE_HEX.map((h) => h.toLowerCase()));

console.log('loot pile contrast = CIE76 vs contrastFloorCell (no +16)');
console.log(`gates: body≥${BODY_MIN}  highlight≥${HIGHLIGHT_MIN}  shadow≥${SHADOW_MIN}  mean sandwich`);
console.log('');

let failed = 0;
console.log(
  '碎片'.padEnd(16),
  '地面'.padEnd(10),
  '主体'.padEnd(10),
  '渍缝'.padEnd(10),
  '高光'.padEnd(10),
  '底影'.padEnd(10),
  'ΔE体  ΔE高  ΔE影  夹心',
);

for (const id of FRAGMENTS) {
  const floor = groundMain(id);
  const slots = derivePileSlots(id);
  const body = phaserToRgb(slots.body);
  const stain = phaserToRgb(slots.stain);
  const highlight = phaserToRgb(slots.highlight);
  const shadow = phaserToRgb(slots.shadow);
  const slotRgbs: ReadonlyArray<readonly [string, Rgb]> = [
    ['shadow', shadow],
    ['stain', stain],
    ['body', body],
    ['highlight', highlight],
  ];

  for (const [name, rgb] of slotRgbs) {
    const hex = hexOf(rgb);
    if (!paletteSet.has(hex.toLowerCase())) {
      console.log(`FAIL ${id} ${name} ${hex} ∉ palette.json`);
      failed += 1;
    }
    if (TEAL_FAMILY_SET.has(hex) || L1_EXCLUDED_HEX.has(hex)) {
      console.log(`FAIL ${id} ${name} ${hex} in teal / L3 / L4 / UI / danger / warning`);
      failed += 1;
    }
  }

  const dBody = deltaE76(body, floor);
  const dHi = deltaE76(highlight, floor);
  const dSh = deltaE76(shadow, floor);
  const sandwich =
    meanRgb(shadow) < meanRgb(floor)
    && meanRgb(floor) < meanRgb(body)
    && meanRgb(body) < meanRgb(highlight);
  const pass =
    dBody >= BODY_MIN && dHi >= HIGHLIGHT_MIN && dSh >= SHADOW_MIN && sandwich;
  if (!pass) failed += 1;
  console.log(
    id.padEnd(16),
    hexOf(floor).padEnd(10),
    hexOf(body).padEnd(10),
    hexOf(stain).padEnd(10),
    hexOf(highlight).padEnd(10),
    hexOf(shadow).padEnd(10),
    dBody.toFixed(1).padStart(5),
    dHi.toFixed(1).padStart(5),
    dSh.toFixed(1).padStart(5),
    sandwich ? 'PASS' : 'FAIL',
  );
  if (dBody < BODY_MIN) console.log(`  FAIL body ΔE ${dBody.toFixed(1)} < ${BODY_MIN}`);
  if (dHi < HIGHLIGHT_MIN) console.log(`  FAIL highlight ΔE ${dHi.toFixed(1)} < ${HIGHLIGHT_MIN}`);
  if (dSh < SHADOW_MIN) console.log(`  FAIL shadow ΔE ${dSh.toFixed(1)} < ${SHADOW_MIN}`);
  if (!sandwich) {
    console.log(
      `  FAIL sandwich mean shadow ${meanRgb(shadow).toFixed(1)} / floor ${meanRgb(floor).toFixed(1)} / body ${meanRgb(body).toFixed(1)} / hi ${meanRgb(highlight).toFixed(1)}`,
    );
  }
}

const l1Hex = new Set(
  (['WARM', 'COOL', 'OLIVE', 'NEUTRAL'] as const).flatMap((g) => L1_POOL[g].map(rgbToHexString)),
);
for (const hex of DEBRIS_HEX) {
  const rgb = hexToRgb(hex);
  assert(meanRgb(rgb) > 55, `${hex} mean ${meanRgb(rgb).toFixed(1)} must be >55`);
  assert(!l1Hex.has(hex.toLowerCase()) && !l1Hex.has(hex), `${hex} leaked into L1 pool`);
  assert(!TEAL_FAMILY_SET.has(hex), `${hex} leaked into teal family`);
  assert(DEBRIS_HEX_SET.has(hex), `${hex} missing from DEBRIS_HEX_SET`);
}

if (failed > 0) {
  console.error(`\ncheck:loot-pile-contrast ${failed} failure(s)`);
  process.exit(1);
}
console.log('\nPASS: four fragments body≥18 highlight≥20 shadow≥8 sandwich; debris cells out of L1/teal');
console.log('check:loot-pile-contrast ok');
