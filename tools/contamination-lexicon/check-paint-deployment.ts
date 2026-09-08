/** Production deployment audit: actual production seeds, host slots and paint bakers after terrain cropping. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { generateRiftLayout } from '../../src/generation/rift-layout';
import { mix32 } from '../../src/generation/seed-fork';
import { TileGrid } from '../../src/systems/tile-grid';
import { TileType } from '../../src/types/game-types';
import { bakePaintGenome, collectPaintGenomeFloorTiles } from '../../src/entities/form-renderers/d/paint-genome/bake';
import { resolvePaintVeinVariant } from '../../src/entities/form-renderers/d/paint-genome/topology';
import { colonyNucleusSeatsInFloors, resolveStopLoss } from '../../src/systems/contamination-host-live';
import { GAME_CONSTANTS } from '../../src/config/constants';

const records = [];
let emptyPatches = 0, clippedTiles = 0, clippedWallTiles = 0, clippedVoidTiles = 0;
let clippedPixels = 0, clippedWallPixels = 0, clippedVoidPixels = 0;
let minLegalTiles = Infinity, minLegalPixels = Infinity, coloniesBelowTwo = 0, missedLegalPair = 0, noLegalPair = 0, compactColonies = 0;
const familyCounts: Record<string, number> = {};
const mapCounts: Record<string, number> = {};
for (let inputSeed = 1; inputSeed <= 128; inputSeed++) {
  const layout = generateRiftLayout(inputSeed);
  const grid = new TileGrid(layout.tileMap);
  mapCounts[layout.fragmentTypeId] = (mapCounts[layout.fragmentTypeId] ?? 0) + 1;
  const forms = layout.contaminationDraw.forms.filter(f => f.portfolio === 'bing');
  assert.equal(forms.length, layout.contaminationPins.paintFloors.length);
  for (const [slot, form] of forms.entries()) {
    const id = `ENM_BING_${String(slot + 1).padStart(2, '0')}`;
    const pin = layout.contaminationPins.paintFloors[slot]!;
    const x = (pin.floorCol + .5) * grid.tileSize, y = (pin.floorRow + .5) * grid.tileSize;
    const seed = mix32(layout.seed, id);
    const baked = bakePaintGenome({ substrate: form.substrate, coverage: form.coverage, seed,
      continuity: form.continuity, sense: form.lexemes.sense, rhythm: form.lexemes.rhythm,
      fragmentTypeId: layout.fragmentTypeId, veinVariant: resolvePaintVeinVariant(form.substrate, seed) });
    const raw = collectPaintGenomeFloorTiles(baked.field, baked.canvasW, baked.canvasH, x, y, grid.tileSize);
    const legal = raw.filter(p => grid.isWalkable(p.col, p.row));
    const wallTiles = raw.filter(p => !grid.isWalkable(p.col, p.row) && grid.getTile(p.col, p.row) === TileType.WALL).length;
    const voidTiles = raw.length - legal.length - wallTiles;
    let visiblePixels = 0, legalPixels = 0, wallPixels = 0, voidPixels = 0;
    const left = x - baked.canvasW / 2, top = y - baked.canvasH / 2;
    for (let py = 0; py < baked.canvasH; py++) for (let px = 0; px < baked.canvasW; px++) {
      if (!baked.buf.data[(py * baked.canvasW + px) * 4 + 3]) continue;
      visiblePixels++;
      const col = Math.floor((left + px + .5) / grid.tileSize), row = Math.floor((top + py + .5) / grid.tileSize);
      if (grid.isWalkable(col, row)) legalPixels++;
      else if (grid.getTile(col, row) === TileType.WALL) wallPixels++;
      else voidPixels++;
    }
    const stop = resolveStopLoss(form);
    const nuclei = stop !== 'illegal' && stop.family === 'scatter_rejoin'
      ? colonyNucleusSeatsInFloors(legal, GAME_CONSTANTS.CONTAMINATION.COLONY_NUCLEUS_COUNT_MIN,
        GAME_CONSTANTS.CONTAMINATION.COLONY_NUCLEUS_COUNT_MAX, GAME_CONSTANTS.CONTAMINATION.COLONY_NUCLEUS_MIN_TILE_GAP, 2)
      : [];
    const minimumNucleusGap = nuclei.length > 1 ? Math.min(...nuclei.flatMap((a, i) => nuclei.slice(i + 1).map(b => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row))))) : null;
    if (minimumNucleusGap === 1) compactColonies++;
    const keys = new Set(legal.map(p => `${p.col},${p.row}`));
    assert(nuclei.every(p => keys.has(`${p.col},${p.row}`) && grid.isWalkable(p.col, p.row)));
    const legalSpan = legal.length ? Math.max(Math.max(...legal.map(p => p.col)) - Math.min(...legal.map(p => p.col)), Math.max(...legal.map(p => p.row)) - Math.min(...legal.map(p => p.row))) : 0;
    if (stop !== 'illegal' && stop.family === 'scatter_rejoin' && nuclei.length < 2) { coloniesBelowTwo++; if (legalSpan >= 2) missedLegalPair++; else noLegalPair++; }
    if (!legal.length || !legalPixels) emptyPatches++;
    minLegalTiles = Math.min(minLegalTiles, legal.length); minLegalPixels = Math.min(minLegalPixels, legalPixels);
    clippedTiles += raw.length - legal.length; clippedWallTiles += wallTiles; clippedVoidTiles += voidTiles;
    clippedPixels += visiblePixels - legalPixels; clippedWallPixels += wallPixels; clippedVoidPixels += voidPixels;
    familyCounts[form.substrate] = (familyCounts[form.substrate] ?? 0) + 1;
    records.push({ inputSeed, layoutSeed: layout.seed, fragment: layout.fragmentTypeId, id, seed, substrate: form.substrate,
      coverage: form.coverage, continuity: form.continuity, anchor: { x, y }, rawTiles: raw.length, legalTiles: legal.length,
      clippedWallTiles: wallTiles, clippedVoidTiles: voidTiles, visiblePixels, legalPixels,
      clippedWallPixels: wallPixels, clippedVoidPixels: voidPixels, nucleusCount: nuclei.length, minimumNucleusGap, legalSpan, nuclei });
  }
}
const summary = { maps: 128, patches: records.length, emptyPatches, minLegalTiles, minLegalPixels, coloniesBelowTwo, missedLegalPair, noLegalPair, compactColonies,
  clippedTiles, clippedWallTiles, clippedVoidTiles, clippedPixels, clippedWallPixels, clippedVoidPixels, familyCounts, mapCounts,
  note: 'Rest-pose material alpha pixels and actual registered field tile footprint, per production host slot/seed. Clipped counts count each host separately, not unique map area. Out-of-bounds follows TileGrid WALL semantics. Not a visual quality verdict.' };
const outputPath = process.argv[2] ?? 'docs/qa/iteration-18-evidence/paint-deployment-r3.json';
writeFileSync(outputPath, JSON.stringify({ ...summary, records }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
assert.equal(emptyPatches, 0, 'terrain crop must not silently remove a generated paint host');
assert.equal(coloniesBelowTwo, 0, 'clipped colony must retain its minimum two reachable nuclei');
console.log('check:paint-deployment PASS');
