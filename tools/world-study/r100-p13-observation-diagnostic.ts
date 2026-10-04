/** Read-only, six fixed maps. Finds geometric candidates, not a live AI victory proof. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data';
import { nativeBodyCollision } from '../../src/generation/world-study/native-body-collision';
import { generatedRiftIdentity } from '../../src/generation/rift-generation-identity';
import { TileGrid } from '../../src/systems/tile-grid';
import { findSoundLureLanding, collectToolRevealSnapshot } from '../../src/systems/tool-targeting';
import { hasLineOfSight } from '../../src/utils/grid-raycast';
import { degToRad, shortestArc, stepAngleToward } from '../../src/utils/math';
import { resolveNextWaypoint } from '../../src/systems/ai/behaviors';
import { ENEMY_DATA } from '../../src/generated/enemy-data';
import { BODY_PROFILE_DATA } from '../../src/generated/contamination-body-data';
import { GAME_CONSTANTS } from '../../src/config/constants';

const output = 'docs/qa/artifacts/r100-p13/observation-diagnostic';
fs.mkdirSync(output, { recursive: true });
const records: any[] = [];
for (const worldId of ['ash-strata', 'crystal-fibre', 'ivory-basin']) for (const seed of [20261004, 20261005]) {
  const recipe = createR100ProductionRecipe(worldId, seed, 'severe'), production = createR100ProductionMap(recipe);
  const world = hydrateR100MasterWorld(production.native!, production.layout), grid = new TileGrid(production.layout.tileMap);
  const physical = nativeBodyCollision(production.native!, production.layout);
  const point = (id: number) => ({ x: (id % grid.cols + .5) * 8, y: (Math.floor(id / grid.cols) + .5) * 8 });
  const key = (p: { x: number; y: number }) => Math.floor(p.y / 8) * grid.cols + Math.floor(p.x / 8);
  const count = grid.cols * grid.rows, valid = new Uint8Array(count);
  for (let id = 0; id < count; id++) valid[id] = physical.supports(point(id), 10, 10) ? 1 : 0;
  function flood(starts: number[], max = Infinity) {
    const distance = new Float64Array(count).fill(Infinity), parent = new Int32Array(count).fill(-1), queue: number[] = [];
    for (const id of starts) if (valid[id]) { distance[id] = 0; queue.push(id); }
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i]!, p = point(id); if (distance[id]! >= max) continue;
      for (const next of [id - 1, id + 1, id - grid.cols, id + grid.cols]) {
        if (next < 0 || next >= count || !valid[next] || distance[next] !== Infinity) continue;
        const q = point(next); if (Math.abs(p.x - q.x) + Math.abs(p.y - q.y) !== 8 || physical.displacementFraction(p, 10, 10, q.x-p.x, q.y-p.y) < 1) continue;
        distance[next] = distance[id]! + 8; parent[next] = id; queue.push(next);
      }
    }
    return { distance, parent };
  }
  const reachable = flood([key(world.layout.spawnPoint)]).distance;
  const dry = (p: { x: number; y: number }) => !world.pollution.paintCells.some(c => Math.floor(c.x/32) === Math.floor(p.x/32) && Math.floor(c.y/32) === Math.floor(p.y/32))
    && !world.pollution.volumes.some(v => p.x/32 >= v.minCol && p.x/32 < v.maxCol+1 && p.y/32 >= v.minRow && p.y/32 < v.maxRow+1);
  const tracks = world.layout.enemySpawns.map(spawn => ({ spawn, p: { x: (spawn.spawn.col+.5)*8, y: (spawn.spawn.row+.5)*8 },
    facing: degToRad(spawn.facing), index: 1, direction: 1 as 1|-1, pause: 0,
    points: spawn.patrol.waypoints.map(p=>({ x:(p.col+.5)*8, y:(p.row+.5)*8 })),
    speed: ENEMY_DATA[spawn.type].patrolSpeed * BODY_PROFILE_DATA[spawn.form!.substrate].moveScale }));
  function advance() {
    for (const t of tracks) {
      if (t.pause > 0) { t.pause -= 100; if (t.pause <= 0) { const n=resolveNextWaypoint(t.spawn.patrol.mode,t.points.length,t.index,t.direction); t.index=n.index;t.direction=n.direction; } continue; }
      const q=t.points[t.index]!,dx=q.x-t.p.x,dy=q.y-t.p.y,d=Math.hypot(dx,dy);
      if (d<=GAME_CONSTANTS.AI.ARRIVE_EPSILON) { t.pause=t.spawn.patrol.pauseMs??GAME_CONSTANTS.AI.WAYPOINT_PAUSE_MS;continue; }
      t.facing=stepAngleToward(t.facing,Math.atan2(dy,dx),degToRad(GAME_CONSTANTS.AI.TURN_RATE)*.1);
      const move=Math.min(d,t.speed*.1);t.p.x+=dx/d*move;t.p.y+=dy/d*move;
    }
  }
  function sees(t: typeof tracks[number], p: { x:number;y:number }) {
    const profile=ENEMY_DATA[t.spawn.type],dx=p.x-t.p.x,dy=p.y-t.p.y,d=Math.hypot(dx,dy);
    if (!hasLineOfSight(world.sight,t.p,p,profile.sightRange)) return false;
    const a=Math.abs(shortestArc(Math.atan2(dy,dx)-t.facing));
    return d<=profile.sightRange&&a<=degToRad(profile.sightHalfAngleCore) || d<=profile.sightRangePeriph&&a<=degToRad(profile.sightHalfAnglePeriph);
  }
  const nodes=[...world.layout.kindlingNodes,...world.layout.contaminantNodes].filter(n=>n.tier==='deep').map(node=>{
    const seats:number[]=[];
    for(let id=0;id<count;id++){const p=point(id);if(valid[id]&&reachable[id]!==Infinity&&dry(p)&&Math.hypot(p.x-node.position.x,p.y-node.position.y)<=48&&hasLineOfSight(world.sight,p,node.position))seats.push(id);}
    const route=flood(seats,192),observers:number[]=[];
    for(let id=0;id<count;id++)if(valid[id]&&reachable[id]!==Infinity&&route.distance[id]!>=48&&route.distance[id]!<=192&&id%grid.cols%2===0&&Math.floor(id/grid.cols)%2===0&&dry(point(id)))observers.push(id);
    return {node,route,observers,observation:null as any,lure:null as any};
  });
  const visible = (from: {x:number;y:number},to: {x:number;y:number}) => Math.hypot(to.x-from.x,to.y-from.y)<=recipe.nativeDefinition.light_radius*.9&&hasLineOfSight(world.sight,from,to);
  for(let elapsed=0;elapsed<=60000;elapsed+=100){
    if(elapsed)advance();if(elapsed%500)continue;
    for(const item of nodes){if(item.lure)continue;
      const near=tracks.filter(t=>Math.hypot(t.p.x-item.node.position.x,t.p.y-item.node.position.y)<=180);
      for(const id of item.observers){
        // No phase-zero candidate at the far edge: even an uninterrupted base-speed
        // approach must have time to arrive, followed by one second to observe.
        if (elapsed < reachable[id]! / 80 * 1000 + 1000) continue;
        const observer=point(id);if(tracks.some(t=>sees(t,observer)||Math.hypot(t.p.x-observer.x,t.p.y-observer.y)<=Math.max(40,ENEMY_DATA[t.spawn.type].hearingStillRange)))continue;
        const guards=near.filter(t=>visible(observer,t.p));if(!guards.length)continue;
        const path=[];let next=id;while(next>=0){path.push(point(next));next=item.route.parent[next]!;}
        const observation={elapsedMs:elapsed,observer,routeToDrySearchSeat:path,routePx:item.route.distance[id],visibleGuardTypes:guards.map(t=>t.spawn.type),guardPositions:guards.map(t=>({...t.p})),unalertedSightOnly:true};
        item.observation??=observation;
        for(let direction=0;direction<16;direction++){
          const angle=direction*Math.PI/8,lure=findSoundLureLanding(observer,{x:Math.cos(angle),y:Math.sin(angle)},96,grid,20,physical);
          if(!lure||!visible(observer,lure))continue;
          const audible=guards.filter(t=>{
            const d=Math.hypot(lure.x-t.p.x,lure.y-t.p.y),range=Math.min(96,ENEMY_DATA[t.spawn.type].hearingRange)*(hasLineOfSight(world.sight,t.p,lure)?1:ENEMY_DATA[t.spawn.type].hearingWallFactor);
            return d<=range&&Math.hypot(lure.x-item.node.position.x,lure.y-item.node.position.y)>=Math.hypot(t.p.x-item.node.position.x,t.p.y-item.node.position.y)+32
              &&collectToolRevealSnapshot(lure,range,grid,[t.p],[]).enemyPositions.length>0;
          });
          if(!audible.length)continue;
          item.lure={...observation,lure,throwAngle:angle,audibleGuards:audible.map(t=>({type:t.spawn.type,position:{...t.p},moveHearingRange:ENEMY_DATA[t.spawn.type].hearingRange,footstepsCouldOverride:Math.hypot(t.p.x-observer.x,t.p.y-observer.y)<=ENEMY_DATA[t.spawn.type].hearingRange})),sideConstraint:'lure lies at least32px farther from search node than target guard'};break;
        }
        if(item.lure)break;
      }
    }
    if(nodes.every(n=>n.lure))break;
  }
  const identity=generatedRiftIdentity(world.layout,recipe,production);
  const result={world:worldId,seed,signature:identity.signature,effectiveSeed:world.layout.seed,algorithmRevision:recipe.package.algorithmRevision,lightRadius:recipe.nativeDefinition.light_radius,nodes:nodes.map(({node,observers,observation,lure})=>({id:node.id,position:node.position,observerCandidates:observers.length,observation,lure}))};
  records.push(result);console.log(worldId,seed,result.nodes.map(n=>`${n.id}:${n.lure?'lure-candidate':n.observation?'observe-only':'none-in-sampled-model'}`).join(' '));
}
const sources=['tools/world-study/r100-p13-observation-diagnostic.ts','src/generation/world-study/r100-expedition.ts','src/generation/world-study/r100-patrol-windows.ts','src/generation/world-study/native-body-collision.ts','src/systems/ai/ai-system.ts','src/systems/ai/state-machine.ts','src/systems/tool-targeting.ts','src/generated/enemy-data.ts'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
fs.writeFileSync(`${output}/report.json`,JSON.stringify({generatedAt:new Date().toISOString(),method:'Read-only 3 mother worlds x 2 fixed seeds. Exact production geometry/body/sight/throw/sound path functions; patrol model uses production speed/turn/pause contracts, sampled500ms over60s. 16px observer lattice, search<=48px, approach physical<=192px, shoulder radius90%,16 throw directions. A positive candidate proves geometry at an unalerted sample, not actual arrival without escalation, sustained safe observation, diversion success, search-noise safety or profitable extraction. Null is bounded negative, never proof that all continuous-time/player routes fail. Content ids used only for posthoc diagnosis, never supplied to playing agents.',records,sources},null,2));
