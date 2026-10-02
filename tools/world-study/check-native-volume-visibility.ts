/** The partial surface-range query must never replace gameplay LOS. */
import assert from 'node:assert/strict';
import { VisibilitySystem, createRiftVisionConfig } from '../../src/systems/visibility-system';
import { TileGrid } from '../../src/systems/tile-grid';
import { TileType } from '../../src/types/game-types';
import { hasLineOfSight } from '../../src/utils/grid-raycast';
const tiles = Array.from({length:128},()=>Array<number>(128).fill(TileType.FLOOR));
for (let y=0;y<128;y++) tiles[y]![72]=TileType.WALL;
for (let y=72;y<90;y++) for (let x=20;x<70;x++) tiles[y]![x]=TileType.VOID;
const grid=new TileGrid({cols:128,rows:128,tileSize:8,tiles});
const sight=new VisibilitySystem(), config=createRiftVisionConfig(), origin={x:512,y:512};
Object.assign(sight,{config,occluders:grid,origin});
let checked=0, wallSurfaces=0, outside=0;
for (const facing of [0,Math.PI/2,Math.PI,-Math.PI/2]) {
 Object.assign(sight,{facingCache:facing});
 for (let y=256;y<=768;y+=8) for(let x=256;x<=768;x+=8) {
  const point={x,y}, range=sight.getUnoccludedVisibilityAt(point), actual=sight.getVisibilityAt(point);
  assert.equal(actual,hasLineOfSight(grid,origin,point)?range:0);
  assert([0,...config.bandAlphas].includes(range));
  if(range>0 && actual===0)wallSurfaces++;
  if(range===0)outside++;
  checked++;
 }
}
assert(wallSurfaces>100,'range alone would expose blocked receivers; gameplay must keep LOS');
assert(outside>1000,'partial query still rejects outside the finite view');
Object.assign(sight,{facingCache:0});
const far={x:origin.x+150,y:origin.y}; const before=sight.getUnoccludedVisibilityAt(far);
sight.setRadiusScale(.4);
assert(sight.getUnoccludedVisibilityAt(far)<=before,'chaos range modulation is inherited');
assert.equal(sight.getUnoccludedVisibilityAt(origin),config.bandAlphas[0]);
console.log(JSON.stringify({checked,wallSurfaces,outside,passed:['same gameplay LOS','finite range/facing','same bands','chaos modulation','near-foot safety']}));
