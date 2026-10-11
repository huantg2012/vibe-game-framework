/** Compile authored spatial arrangements. Runtime and recovery consume snapshots. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const names = ['policy', 'layouts', 'erosion', 'anchors', 'worlds', 'materials', 'organizations', 'authored-groups', 'authored-erosion', 'sectors', 'sector-layouts', 'sector-cuts', 'sector-anchors', 'land-plates', 'land-outlines'];
const contents = names.map(name => readFileSync(new URL(`../../data/rift-spatial-${name}.csv`, import.meta.url), 'utf8'));
function parse(source) {
  const [header, ...lines] = source.trim().split(/\r?\n/), keys = header.split(',');
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate spatial CSV column');
  return lines.map(line => {
    const values = line.split(',');
    if (values.length !== keys.length) throw new Error('Invalid spatial CSV column count');
    return Object.fromEntries(keys.map((key, index) => [key, values[index]]));
  });
}
const [configs, placements, erosion, anchors, worlds, materials, organizationRows, authoredGroups, authoredErosion, sectorRows, sectorLayouts, sectorCuts, sectorAnchors, landPlates, landOutlines] = contents.map(parse);
const nativeSource = readFileSync(new URL('../../data/rift-native-worlds.csv', import.meta.url), 'utf8');
const nativeWorlds = parse(nativeSource);
const organizations = organizationRows.map(row => row.organization);
if (new Set(organizations).size !== organizations.length) throw new Error('Duplicate spatial organization');
const number = (row, key) => { const value = Number(row[key]); if (row[key] === '' || !Number.isFinite(value)) throw new Error(`Invalid spatial number ${key}`); return value; };
const bool = (row, key) => { if (!['true', 'false'].includes(row[key])) throw new Error(`Invalid spatial boolean ${key}`); return row[key] === 'true'; };
const unique = (values, key) => { if (new Set(values.map(key)).size !== values.length) throw new Error('Duplicate spatial key'); };
if (configs.length !== 1) throw new Error('Expected one spatial policy');
const config = Object.fromEntries(Object.keys(configs[0]).map(key => [key, number(configs[0], key)]));
if (config.version !== 1 || config.cols !== 72 || config.rows !== 56 || config.placement_jitter_px < 0 || config.placement_jitter_px > 24) throw new Error('Invalid spatial configuration');
const layouts = placements.map(row => ({ organization: row.organization, id: number(row, 'id'), role: row.role, sourceIndex: number(row, 'source_index'), x: number(row, 'x'), y: number(row, 'y'), rotation: number(row, 'rotation'), length: number(row, 'length'), width: number(row, 'width') }));
const cuts = erosion.map(row => ({ organization: row.organization, id: row.id, points: row.points.split('|').map(pair => { const [x, y, ...extra] = pair.split(':').map(Number); if (extra.length || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid spatial erosion point'); return { x, y }; }) }));
const starts = anchors.map(row => ({ organization: row.organization, id: number(row, 'id'), x: number(row, 'x'), y: number(row, 'y') }));
const catalog = worlds.map(row => ({ worldId: row.world_id, organization: row.organization, mirrorX: bool(row, 'mirror_x'), mirrorY: bool(row, 'mirror_y') }));
const shapes = materials.map(row => ({ key: row.key, lengthScale: number(row, 'length_scale'), widthScale: number(row, 'width_scale') }));
for (const rows of [layouts, cuts, starts]) { unique(rows, row => `${row.organization}:${row.id}`); if (rows.some(row => !organizations.includes(row.organization))) throw new Error('Unknown spatial organization'); }
const rules = organizationRows.map(row => ({ organization: row.organization, sourceMode: row.source_mode, materialScaling: bool(row, 'material_scaling'), solidCount: number(row, 'solid_count'), reliefCount: number(row, 'relief_count'), placementJitterPx: number(row, 'placement_jitter_px') }));
for (const rule of rules) {
  const { organization } = rule;
  if (organization === 'authored-group' || organization === 'authored-sectors') {
    if (rule.sourceMode !== 'source-once' || rule.materialScaling || rule.solidCount !== 0 || rule.reliefCount !== 0 || rule.placementJitterPx !== 0) throw new Error('Invalid whole-group rules');
    continue;
  }
  if (!['repeat', 'source-once'].includes(rule.sourceMode) || !Number.isInteger(rule.solidCount) || rule.solidCount < 1 || !Number.isInteger(rule.reliefCount) || rule.reliefCount < 0 || layouts.filter(row => row.organization === organization && row.role === 'solid').length !== rule.solidCount || layouts.filter(row => row.organization === organization && row.role === 'relief').length !== rule.reliefCount || cuts.filter(row => row.organization === organization).length < 4 || starts.filter(row => row.organization === organization).length < 6) throw new Error(`Incomplete spatial arrangement ${organization}`);
}
unique(catalog, row => row.worldId); unique(shapes, row => row.key);
const sourceWorldIds = nativeWorlds.map(row => row.world_id);
if (catalog.length !== sourceWorldIds.length || catalog.some(row => !sourceWorldIds.includes(row.worldId) || !organizations.includes(row.organization))) throw new Error('Spatial assignments must cover the native catalog exactly');
unique(authoredGroups, row => row.world_id);
const groups = authoredGroups.map(row => {
  const native = nativeWorlds.find(world => world.world_id === row.world_id);
  const world = catalog.find(world => world.worldId === row.world_id);
  if (!native || Number(native.construction_version) < 3 || !native.instances || world?.organization !== 'authored-group' || world.mirrorX || world.mirrorY) throw new Error(`Invalid whole-group source ${row.world_id}`);
  const transform = { scale: number(row, 'scale'), sourceX: number(row, 'source_x'), sourceY: number(row, 'source_y'), targetX: number(row, 'target_x'), targetY: number(row, 'target_y') };
  if (transform.scale < 1 || transform.scale > 2) throw new Error('Invalid whole-group scale');
  const counts = { solid: 0, relief: 0 };
  const placements = native.instances.split('|').map((cell, index) => {
    const [family, role, x, y, rotation, length, width] = cell.split(':');
    if (!['solid', 'relief'].includes(role)) throw new Error('Invalid whole-group role');
    return { id: index + 1, role, sourceIndex: counts[role]++, x: transform.targetX + (Number(x) - transform.sourceX) * transform.scale,
      y: transform.targetY + (Number(y) - transform.sourceY) * transform.scale, rotation: Number(rotation), length: Number(length) * transform.scale, width: Number(width) * transform.scale };
  });
  const erosion = authoredErosion.filter(cut => cut.world_id === row.world_id).map(cut => cut.points.split('|').map(point => { const [x,y] = point.split(':').map(Number); return { x,y }; }));
  if (erosion.length < 4 || erosion.length > 12) throw new Error(`Missing compiled whole-group shore ${row.world_id}`);
  return { worldId: row.world_id, transform, solidCount: counts.solid, reliefCount: counts.relief, placements, erosion };
});
if (catalog.filter(row => row.organization === 'authored-group').length !== groups.length) throw new Error('Whole-group world registration mismatch');
unique(sectorRows, row => row.world_id);
unique(landPlates, row => `${row.world_id}:${row.id}`);
unique(landOutlines, row => row.world_id);
const positiveWorlds = [...new Set(landPlates.map(row => row.world_id))].sort();
if (JSON.stringify(positiveWorlds) !== JSON.stringify(landOutlines.map(row => row.world_id).sort())
  || positiveWorlds.some(id => !sectorRows.some(row => row.world_id === id))) throw new Error('Incomplete positive terrain compilation');
for (const rows of [sectorLayouts, sectorCuts, sectorAnchors]) {
  unique(rows, row => `${row.world_id}:${row.id}`);
  if (rows.some(row => !sectorRows.some(sector => sector.world_id === row.world_id))) throw new Error('Unregistered sector authoring data');
}
const sectors = sectorRows.map(row => {
  const world = catalog.find(world => world.worldId === row.world_id);
  const native = nativeWorlds.find(world => world.world_id === row.world_id);
  if (!native || world?.organization !== 'authored-sectors' || world.mirrorX || world.mirrorY) throw new Error(`Invalid sector source ${row.world_id}`);
  const placements = sectorLayouts.filter(p => p.world_id === row.world_id).map(p => ({ id: number(p, 'id'), role: p.role, sourceIndex: number(p, 'source_index'), x: number(p, 'x'), y: number(p, 'y'), rotation: number(p, 'rotation'), length: number(p, 'length'), width: number(p, 'width') }));
  const solidCount = placements.filter(p => p.role === 'solid').length, reliefCount = placements.filter(p => p.role === 'relief').length;
  const organizationRules = { sourceMode: row.source_mode, materialScaling: bool(row, 'material_scaling'), solidCount, reliefCount };
  if (!['repeat', 'source-once'].includes(row.source_mode) || solidCount < 1 || placements.some(p => !['solid', 'relief'].includes(p.role))) throw new Error('Invalid sector roles');
  if (row.source_mode === 'source-once') for (const role of ['solid', 'relief']) {
    const sources = native.instances.split('|').filter(cell => cell.split(':')[1] === role);
    const selected = placements.filter(p => p.role === role);
    if (selected.length !== sources.length || selected.some(p => !Number.isInteger(p.sourceIndex) || p.sourceIndex < 0 || p.sourceIndex >= sources.length) || new Set(selected.map(p => p.sourceIndex)).size !== sources.length) throw new Error(`Sector must preserve each source ${row.world_id}/${role}`);
  }
  const erosion = authoredErosion.filter(cut => cut.world_id === row.world_id).map(cut => cut.points.split('|').map(point => { const [x,y] = point.split(':').map(Number); return { x,y }; }));
  const spawnCandidates = sectorAnchors.filter(p => p.world_id === row.world_id).map(p => ({ x: number(p, 'x'), y: number(p, 'y') }));
  if (erosion.length < 4 || erosion.length > 12 || spawnCandidates.length < 6 || spawnCandidates.length > 32) throw new Error(`Incomplete sector arrangement ${row.world_id}`);
  const outline = landOutlines.find(p => p.world_id === row.world_id);
  const terrainOutline = outline?.points.split('|').map(pair => {
    const values = pair.split(':').map(Number);
    if (values.length !== 2 || !values.every(Number.isFinite) || values[0] < 0 || values[0] > config.cols * 32 || values[1] < 0 || values[1] > config.rows * 32) throw new Error('Invalid positive terrain point');
    return { x: values[0], y: values[1] };
  });
  if (terrainOutline && (terrainOutline.length < 3 || terrainOutline.length > 32)) throw new Error('Invalid positive terrain outline');
  return { worldId: row.world_id, organizationRules, placementJitterPx: number(row, 'placement_jitter_px'), placements, erosion, spawnCandidates,
    ...(terrainOutline ? { terrainOutline } : {}) };
});
if (catalog.filter(row => row.organization === 'authored-sectors').length !== sectors.length) throw new Error('Sector world registration mismatch');
const sourceHash = createHash('sha256').update([...contents, nativeSource].join('\n')).digest('hex');
let output = '// GENERATED by tools/world-study/codegen-r100-spatial.mjs from data/rift-spatial-*.csv.\n';
for (const [name, value] of Object.entries({ SOURCE_HASH: sourceHash, CONFIG: config, PLACEMENTS: layouts, EROSION: cuts, ANCHORS: starts, WORLDS: catalog, MATERIALS: shapes, ORGANIZATIONS: rules, AUTHORED_GROUPS: groups, SECTORS: sectors })) output += `export const R100_SPATIAL_${name} = ${JSON.stringify(value, null, 2)} as const;\n`;
const target = new URL('../../src/generated/r100-spatial-data.ts', import.meta.url);
if (process.argv.includes('--check')) { if (readFileSync(target, 'utf8') !== output) throw new Error('Generated spatial data is stale'); } else writeFileSync(target, output);
console.log(`R100 spatial data ${process.argv.includes('--check') ? 'verified' : 'generated'}: ${catalog.length} worlds / ${organizations.length} arrangements`);
