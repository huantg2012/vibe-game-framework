import assert from 'node:assert/strict';
import { hasMasterMatterPath } from '../../src/dev/rift-r100-masters/visibility';
import { MASTER_SCENES } from '../../src/dev/rift-r100-masters/generated-scenes';
import { createMasterWorld } from '../../src/dev/rift-r100-masters/world';
import { TileGrid } from '../../src/systems/tile-grid';
import { bodyHasSupport } from '../../src/systems/ai/physical-grid';
const results=[];
const land=new Uint8Array(25).fill(1);land[12]=0;
assert.equal(hasMasterMatterPath(land,5,5,32,16,80,144,80),false,'surfaces must not be revealed through void');
assert.equal(hasMasterMatterPath(land,5,5,32,16,16,144,16),true,'ordinary floor remains transparent');
assert.equal(hasMasterMatterPath(land,5,5,32,16,16,144,144),false,'diagonal hole blocks reveal');
assert.equal(hasMasterMatterPath(land,5,5,32,-1,16,16,16),false,'outside map is opaque');
for(const definition of MASTER_SCENES){
  for(const seed of [definition.seed,definition.seed+1]){
    const world=createMasterWorld(definition,seed),grid=new TileGrid(world.layout.tileMap);
    const positions=[world.layout.spawnPoint,world.layout.extractionPoint.position,...world.layout.kindlingNodes.map(n=>n.position)];
    for(const p of positions)assert(bodyHasSupport(grid,p,10,10),`${definition.id} body support`);
    assert.equal(world.layout.contaminationDraw.forms.filter(form=>form.lexemes.sense==='sense_hear').length,1);
    assert.equal(world.diagnostics.gradeMechanics,false);
    assert(world.raster.occupiedPixels.length>2000);
    assert(Number(world.diagnostics.reachableBodySeats)>2000);
    results.push({id:definition.id,seed,geometryFingerprint:world.diagnostics.geometryFingerprint,seats:world.diagnostics.reachableBodySeats,spawn:world.layout.spawnPoint,pixels:world.raster.occupiedPixels.length});
  }
}
assert.throws(()=>createMasterWorld(MASTER_SCENES[0],-1));assert.throws(()=>createMasterWorld(MASTER_SCENES[0],NaN));
console.log(JSON.stringify({checks:24,status:'pass',scope:'18 authored family/grade/seed geometry-first native-body admissions; invalid seeds; not production/world/art qualification',results},null,2));
