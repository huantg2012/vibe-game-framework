/** CSV -> complete authoring inputs. Never derive CSV from runtime geometry. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {generateRectilinearFragment, RECTILINEAR_FRAGMENT_VERSION} from '../../src/generation/world-study/fragment-shape/index.ts';
const names = ['layouts', 'rectangles', 'worlds'];
const sources = names.map(name => fs.readFileSync(new URL(`../../data/rift-spatial-fragment-${name}.csv`, import.meta.url), 'utf8'));
const parse = source => {
  const [head, ...lines] = source.trim().split(/\r?\n/);
  const keys = head.split(',');
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate fragment CSV column');
  return lines.map(line => {
    const cells = line.split(',');
    if (cells.length !== keys.length) throw new Error('Fragment CSV column count differs');
    return Object.fromEntries(keys.map((key, index) => [key, cells[index]]));
  });
};
const [layouts, rectangles, worlds] = sources.map(parse);
const number = (row, key) => {
  if (row[key] === '' || !Number.isFinite(Number(row[key]))) throw new Error(`Invalid fragment number: ${key}`);
  return Number(row[key]);
};
const unique = (list, key) => {if (new Set(list.map(key)).size !== list.length) throw new Error('Duplicate fragment identity');};
unique(layouts, row => row.id); unique(worlds, row => row.world_id); unique(rectangles, row => `${row.layout_id}:${row.id}`);
for (const row of rectangles) if (!layouts.some(layout => layout.id === row.layout_id) || !['land', 'void'].includes(row.kind)) throw new Error('Unknown fragment layout or rectangle kind');
const compiledLayouts = new Map(layouts.map(row => {
  if (row.algorithm_version !== RECTILINEAR_FRAGMENT_VERSION || number(row, 'world_scale') !== 2) throw new Error('Unsupported fragment policy or authoring scale');
  const assigned = rectangles.filter(rect => rect.layout_id === row.id);
  unique(assigned, rect => `${rect.kind}:${rect.ordinal}`);
  if (assigned.some(rect => !Number.isSafeInteger(number(rect, 'ordinal')) || number(rect, 'ordinal') < 0)) throw new Error('Invalid fragment rectangle order');
  const list = kind => assigned.filter(rect => rect.kind === kind).sort((a, b) => number(a, 'ordinal') - number(b, 'ordinal')).map(rect => ['x', 'y', 'width', 'height'].map(key => number(rect, key)));
  const layout = {authoringFrame: [number(row, 'authoring_width'), number(row, 'authoring_height')], worldScale: 2, landRects: list('land'), voidRects: list('void')};
  generateRectilinearFragment({algorithmVersion: row.algorithm_version, layout, edgeSeed: 20261011});
  return [row.id, layout];
}));
const nativeIds = parse(fs.readFileSync(new URL('../../data/rift-native-worlds.csv', import.meta.url), 'utf8')).map(row => row.world_id);
const definitions = worlds.map(row => {
  const layout = compiledLayouts.get(row.layout_id), salt = number(row, 'seed_salt');
  if (!nativeIds.includes(row.world_id) || !layout || row.edge_seed_mode !== 'run-seed' || !Number.isInteger(salt) || salt < 0 || salt > 0xffffffff) throw new Error('Invalid fragment world assignment');
  return {worldId: row.world_id, layoutId: row.layout_id, algorithmVersion: RECTILINEAR_FRAGMENT_VERSION, seedMode: row.edge_seed_mode, seedSalt: salt, layout};
});
if (layouts.some(layout => !worlds.some(world => world.layout_id === layout.id))) throw new Error('Unassigned fragment layout');
const hash = createHash('sha256').update(sources.join('\n')).digest('hex');
const output = `// GENERATED from data/rift-spatial-fragment-*.csv; do not hand edit.\nimport type { R100FragmentAuthoring } from '@/generation/world-study/r100-fragment-shape';\nexport const R100_FRAGMENT_SOURCE_HASH = ${JSON.stringify(hash)};\nexport const R100_FRAGMENT_AUTHORING = ${JSON.stringify(definitions, null, 2)} as const satisfies readonly R100FragmentAuthoring[];\n`;
const target = new URL('../../src/generated/r100-fragment-data.ts', import.meta.url);
if (process.argv.includes('--check')) {if (fs.readFileSync(target, 'utf8') !== output) throw new Error('Generated fragment data is stale');}
else fs.writeFileSync(target, output);
console.log(`R100 fragment authoring ${process.argv.includes('--check') ? 'verified' : 'generated'}: ${definitions.length} explicitly registered world(s)`);
