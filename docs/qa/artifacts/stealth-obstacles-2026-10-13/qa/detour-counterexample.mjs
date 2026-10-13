// QA negative control: a wall reaches the north boundary, so both routes must go south.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {diagnoseWorld} from '../../../../../tools/stealth-obstacles/diagnostics.ts';
import {TileType} from '../../../../../src/types/game-types.ts';

const output = process.argv[2];
if (!output || fs.existsSync(output)) throw new Error('Fresh report path required');
const sourceFile = 'tools/stealth-obstacles/diagnostics.ts';
const from = {x: 60, y: 124}, to = {x: 260, y: 124};
const mesh = {spec: {id: 1}, positions: new Float32Array([144,0,0, 176,0,0, 176,176,0, 144,176,0]), indices: new Uint16Array([0,1,2,0,2,3]), triangleCount: 2};
const map = {native: {definition: {instances: [{id: 1, role: 'solid'}]}, meshes: [mesh]}, layout: {
  tileMap: {tileSize: 8, cols: 40, rows: 32, tiles: Array.from({length: 32}, () => Array(40).fill(TileType.FLOOR))},
  spawnPoint: from, extractionPoint: {position: to}
}};
const result = diagnoseWorld(map, {detours: [{id: 'north-closed-wall', objectId: 1, from, to, sideA: {x: 60, y: 84}, sideB: {x: 60, y: 164}}]});
const d = result.report.detours[0];
const crossing = route => route.path.filter(p => p.x >= 144 && p.x <= 176);
const report = {kind: 'synthetic negative control, not a production world', generatedAt: new Date().toISOString(),
  diagnosticSourceSha256: createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex'),
  setup: 'Solid rectangle x=144..176,y=0..176 touches north boundary; any 20x20 crossing must use y>=186 below it. Both waypoints lie west of wall, opposite sides of endpoint axis y=124.',
  observed: {reportedPassed: d.passed, oppositeSideWaypoints: d.oppositeSideWaypoints, straightLineHitsSolid: d.straightLineHitsSolid,
    sideACrossings: crossing(d.sideA), sideBCrossings: crossing(d.sideB), sideALengthPx: d.sideA.lengthPx, sideBLengthPx: d.sideB.lengthPx},
  expected: 'A two-sided obstacle-bypass claim must fail: north bypass is impossible. Both route requests are individually valid body paths.',
  detour: d};
fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, JSON.stringify(report, null, 2)+'\n', {flag:'wx'});
console.log(JSON.stringify(report.observed));
