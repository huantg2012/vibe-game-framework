/** Real authored topology + production visibility/combat; no browser or visual sign-off. */
import assert from 'node:assert/strict';
import { MASTER_SCENES } from '../../src/dev/rift-r100-masters/generated-scenes';
import { createMasterWorld } from '../../src/dev/rift-r100-masters/world';
import { NativeVolumeLighting, type NativeVolumeMaterialSet } from '../../src/generation/world-study/native-volume-raster';
import { bodyHasSupport } from '../../src/systems/ai/physical-grid';
import { CombatSystem } from '../../src/systems/combat-system';
import { TileGrid } from '../../src/systems/tile-grid';
import { createRiftVisionConfig, VisibilitySystem } from '../../src/systems/visibility-system';
import { TileType } from '../../src/types/game-types';
import type { OccluderGrid } from '../../src/types/map-types';
import { hasLineOfSight } from '../../src/utils/grid-raycast';

const material = { base:[90,95,92], dark:[35,40,38], light:[160,166,158], roughness:.8, structure:.6 } as const;
const palette: NativeVolumeMaterialSet = { outer:material, cut:material, inner:material, joint:material };
const results: { id:string; reliefSeats:number; solidCells:number; erosionCells:number; landscapeRay:boolean; erosionRay:boolean }[] = [];
for (const definition of MASTER_SCENES) {
  const world = createMasterWorld(definition, definition.seed), grid = new TileGrid(world.layout.tileMap), config = createRiftVisionConfig();
  const sight = new VisibilitySystem(); Object.assign(sight, { config, occluders:world.sight });
  let reliefSeats = 0, solidCells = 0, landscapeRay = false, erosionRay = false;
  for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) {
    const point = { x:(col+.5)*grid.tileSize, y:(row+.5)*grid.tileSize }, tile = grid.getTile(col,row);
    assert.equal(world.matterAt(point.x,point.y), tile !== TileType.VOID, `${definition.id}: terrain and presentation agree at 8px`);
    assert.equal(world.sight.isOpaque(col,row), tile === TileType.VOID, `${definition.id}: only absent terrain swallows sight`);
    assert.equal(world.combat.isOpaque(col,row), tile !== TileType.FLOOR, `${definition.id}: melee retains physical obstacles`);
    if (tile === TileType.WALL) { solidCells++; assert.equal(grid.isWalkable(col,row),false); }
    if (world.roleAt(point.x,point.y)==='relief' && bodyHasSupport(grid,point,10,10)) reliefSeats++;
    if (tile === TileType.FLOOR || col === 0 || grid.getTile(col-1,row)!==TileType.FLOOR) continue;
    let end = col;
    while (end < grid.cols && grid.getTile(end,row) === tile) end++;
    if (end === grid.cols || grid.getTile(end,row)!==TileType.FLOOR || end-col>20) continue;
    const from = {x:(col-.5)*grid.tileSize,y:point.y}, to = {x:(end+.5)*grid.tileSize,y:point.y};
    Object.assign(sight,{origin:from,facingCache:0});
    if (tile===TileType.WALL) {
      assert(hasLineOfSight(world.sight,from,to),'ordinary solid scenery cannot hide its far side');
      assert(sight.getVisibilityAt(point)>0 && sight.getVisibilityAt(to)>0,'real finite visibility includes landscape and its far side');
      assert(!hasLineOfSight(world.combat,from,to),'same solid still interrupts a physical strike'); landscapeRay=true;
    } else {
      assert(!hasLineOfSight(world.sight,from,to),'erosion blocks the actual shared ray');
      assert.equal(sight.getVisibilityAt(to),0,'real finite visibility cannot see through erosion'); erosionRay=true;
    }
  }
  assert(reliefSeats>0,`${definition.id}: actual 20px body can stand on shallow relief`);
  assert(solidCells>0 && landscapeRay,`${definition.id}: actual solid obstacle is transparent to sight`);
  assert(erosionRay,`${definition.id}: authored erosion interrupts otherwise walkable terrain`);
  assert.equal(world.matterAt(-1,50),false); assert.equal(world.sight.isOpaque(-1,1),true);
  const actorPoints = [world.layout.spawnPoint,world.layout.extractionPoint.position,...world.layout.kindlingNodes.map(node=>node.position),
    ...world.layout.enemySpawns.map(enemy=>({x:(enemy.spawn.col+.5)*grid.tileSize,y:(enemy.spawn.row+.5)*grid.tileSize}))];
  for(const point of actorPoints) assert(bodyHasSupport(grid,point,10,10),`${definition.id}: deployed 20px body fits`);
  // Exercise the actual material renderer with the same authoritative visibility.
  const index = world.raster.occupiedPixels.find(i=>world.roleAt(i%world.raster.width+.5,Math.floor(i/world.raster.width)+.5)!==null)!;
  assert.notEqual(index,undefined);
  const point = {x:index%world.raster.width+.5,y:Math.floor(index/world.raster.width)+.5};
  Object.assign(sight,{origin:point,facingCache:0});
  const visible = new Float32Array(world.raster.width*world.raster.height); visible[index]=sight.getVisibilityAt(point);
  const output = new Uint8ClampedArray(visible.length*4), shader = new NativeVolumeLighting(world.raster,palette);
  shader.render([{x:point.x,y:point.y,z:28,radius:100,intensity:1,color:[1,1,1],castsShadow:false}],output,{ambient:.34,visibility:visible});
  assert(output[index*4]!+output[index*4+1]!+output[index*4+2]!>0 && output[index*4+3]===255,'ordinary landscape is a lit opaque material receiver');
  results.push({id:definition.id,reliefSeats,solidCells,erosionCells:Number(world.diagnostics.erosionCells),landscapeRay,erosionRay});
}
for(const family of ['folded-slab','fibre-knot','broken-shell']) {
  const counts = ['low','medium','severe'].map(grade=>results.find(row=>row.id===`${family}-${grade}`)!.erosionCells);
  assert(counts[0]!>0 && counts[0]!<counts[1]! && counts[1]!<counts[2]!,'grades change authored erosion footprint');
}

// The real CombatSystem must consume the physical grid even while AI/player see through it.
const tiles=Array.from({length:20},()=>Array<number>(20).fill(TileType.FLOOR)); tiles[10]![12]=TileType.WALL;
const physical=new TileGrid({cols:20,rows:20,tileSize:8,tiles});
const optical:OccluderGrid={cols:20,rows:20,tileSize:8,version:0,isOpaque:(c,r)=>c<0||r<0||c>=20||r>=20};
function swing(occluders:OccluderGrid):number {
  const combat=new CombatSystem(), position={x:80,y:84}, target={x:112,y:84};
  const player={getPosition:()=>position,getFacingAngle:()=>0,setSpeedModifier(){},clearSpeedModifier(){},setWeaponVisual(){},setWeaponAttackPose(){}};
  const view={getId:()=>'behind-solid',getPosition:()=>target,getFacingAngle:()=>0,isEngaged:()=>false};
  Object.assign(combat,{player,occluders,hooks:{onNoise(){}},ai:{getEnemies:()=>[view],getEnemyById:()=>view},spawnFx(){},drawVisuals(){},stepFx(){}});
  combat.noteRosterChanged();combat.configureWeapon('crowbar_plain',7);combat.requestPlayerAttack();
  for(let time=0;time<400;time+=16)combat.update(16);
  return combat.getEnemyHealth('behind-solid')!;
}
assert.equal(swing(physical),75,'physical obstacle stops the real crowbar swing');
assert(swing(optical)<75,'negative control: passing the optical grid would incorrectly allow the same strike');
console.log(JSON.stringify({status:'pass',scope:'9 authored cells: explicit scenery roles, 8px terrain/erosion, production visibility and real melee; no art or human approval',results},null,2));
