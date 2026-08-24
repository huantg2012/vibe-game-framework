/**
 * Tiny I6-B self-check: grouping examples + L1 table + palette.json byte match.
 * Not a map-bake script.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  L1_POOL,
  PALETTE_HEX,
  TEAL_FAMILY,
  TEAL_FAMILY_HEX,
  hexToRgb,
  quantizeInGroup,
  rgbToHexString,
  temperatureGroup,
} from '../../src/generation/palette-quantize';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function fail(msg: string): never {
  console.error(`palette-quantize check failed: ${msg}`);
  process.exit(1);
}

function assert(cond: boolean, msg: string): void {
  if (!cond) fail(msg);
}

const paletteDoc = JSON.parse(readFileSync(join(root, 'docs/art/palette.json'), 'utf8')) as {
  colors: string[];
};
assert(
  JSON.stringify(paletteDoc.colors) === JSON.stringify([...PALETTE_HEX]),
  'PALETTE_HEX drifted from docs/art/palette.json',
);

function assertGroup(hex: string, want: ReturnType<typeof temperatureGroup>): void {
  const [r, g, b] = hexToRgb(hex);
  const got = temperatureGroup(r, g, b);
  assert(got === want, `${hex} expected ${want}, got ${got}`);
}

assertGroup('#2a2018', 'WARM');
assertGroup('#1a1e18', 'OLIVE');
assertGroup('#151a1e', 'COOL');
assertGroup('#080a0c', 'NEUTRAL');

function poolHex(group: keyof typeof L1_POOL): string[] {
  return L1_POOL[group].map(rgbToHexString).sort();
}

assert(
  JSON.stringify(poolHex('WARM')) === JSON.stringify(['#24221e', '#2a1f1c', '#2a2018', '#2a2420'].sort()),
  `WARM L1 pool ${poolHex('WARM').join(' ')}`,
);
assert(
  JSON.stringify(poolHex('COOL')) === JSON.stringify(['#0d1114', '#151a1e', '#1e2228', '#2c2e33'].sort()),
  `COOL L1 pool ${poolHex('COOL').join(' ')}`,
);
assert(JSON.stringify(poolHex('OLIVE')) === JSON.stringify(['#1a1e18']), `OLIVE L1 pool ${poolHex('OLIVE').join(' ')}`);
assert(
  JSON.stringify(poolHex('NEUTRAL')) ===
    JSON.stringify(['#080a0c', '#0a0b0d', '#1a1c1f', '#2a2a2e', '#2e2d30'].sort()),
  `NEUTRAL L1 pool ${poolHex('NEUTRAL').join(' ')}`,
);

const measureTeal = [
  '#0e4a3f',
  '#1a6b5c',
  '#1aad96',
  '#2ae6c8',
  '#3cffd4',
  '#7fffee',
  '#b0fff5',
  '#4adf8a',
  '#1a7a9a',
];
assert(
  JSON.stringify([...TEAL_FAMILY_HEX].slice().sort()) === JSON.stringify(measureTeal.slice().sort()),
  'TEAL_FAMILY_HEX must match measure:ground-teal',
);

const picked = quantizeInGroup([20, 180, 160], TEAL_FAMILY, []);
assert(
  TEAL_FAMILY.some((c) => c[0] === picked[0] && c[1] === picked[1] && c[2] === picked[2]),
  `quantizeInGroup left teal family: ${rgbToHexString(picked)}`,
);

const fallback = quantizeInGroup([42, 32, 24], [], []);
assert(
  poolHex('NEUTRAL').includes(rgbToHexString(fallback)),
  `empty pool must fall back to NEUTRAL, got ${rgbToHexString(fallback)}`,
);

console.log('palette-quantize self-check ok');
