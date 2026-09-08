import { findTerrainSafeVolumeSeat } from '../../src/generation/terrain-safe-volume-seat';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { generateRiftLayout } from '../../src/generation/rift-layout';
import { TileGrid } from '../../src/systems/tile-grid';
import { createVolumePresenceFrame, updateVolumePresenceFrame, volumeTimeAtPhase, sampleVolumeDensity, type VolumePhase } from '../../src/systems/volume-presence';
const substrates = ['gas_mass', 'mist_bank', 'dust_swarm'];
const phases: VolumePhase[] = ['rest', 'gather', 'release', 'disperse'];
let samples = 0, clippedSamples = 0, minimumPresentSamples = Infinity;
const actualCounts: Record<string, number> = {};
for (let seed = 1; seed <= 128; seed++) {
  const layout = generateRiftLayout(seed), grid = new TileGrid(layout.tileMap);
  const box = findTerrainSafeVolumeSeat(layout.contaminationPins.corridorAabbs, (col,row)=>grid.isWalkable(col,row));
  assert(box, `seed ${seed} corridor`);
  for (const form of layout.contaminationDraw.forms.filter(f => f.portfolio === 'ding')) actualCounts[form.substrate] = (actualCounts[form.substrate] ?? 0) + 1;
  const rect = { x: box.minCol * 32, y: box.minRow * 32, w: (box.maxCol-box.minCol+1)*32, h:(box.maxRow-box.minRow+1)*32 };
  for (const substrate of substrates) for (const phase of phases) for (const progress of [0,.25,.5,.75,.999]) {
    const f = createVolumePresenceFrame();
    updateVolumePresenceFrame(f, { substrate, coverage:'rewrite', rect, active:true, elapsedMs:volumeTimeAtPhase(substrate,phase,progress), isWalkableFloor:(col,row)=>grid.isWalkable(col,row) });
    assert(f.hasPresence, `${seed}/${substrate}/${phase}/${progress}: empty deployment`);
    assert(grid.isWalkable(Math.floor(f.coreX/32),Math.floor(f.coreY/32)) && sampleVolumeDensity(f,f.coreX,f.coreY)>=f.dangerThreshold, 'core must sit on reachable visible material');
    let present = 0;
    for (let y=rect.y+4;y<rect.y+rect.h;y+=8) for(let x=rect.x+4;x<rect.x+rect.w;x+=8) {
      const density=sampleVolumeDensity(f,x,y); if(density>=f.dangerThreshold)present++;
      if(!grid.isWalkable(Math.floor(x/32),Math.floor(y/32))) {assert.equal(density,0);clippedSamples++;}
    }
    minimumPresentSamples=Math.min(minimumPresentSamples,present);assert(present>0);
    samples++;
  }
}
for(const substrate of substrates)assert((actualCounts[substrate]??0)>0, `${substrate} reaches actual production`);
const result={maps:128,samples,actualCounts,minimumPresentSamples,clippedSamples,emptyDeployments:0,note:'Every approved material volume at actual 128-map corridor seats and 20 cycle moments, independent of selection chance. Shared density/core sampled against real terrain.'};
writeFileSync('docs/qa/iteration-18-r4-evidence/volume-deployment.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
