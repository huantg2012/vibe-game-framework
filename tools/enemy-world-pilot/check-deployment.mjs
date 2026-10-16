/** Real r13 generation: admitted forms, paint support/contact and cold recovery. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createR100DirectConstructionRecipe,createR100NativeSpatialDevelopmentRecipe,createR100ProductionRecipe,validR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from '../../src/generation/world-study/r100-production-map.ts';
import {NATIVE_ENEMY_DEPLOYMENTS} from '../../src/generated/r100-enemy-deployment.ts';
import {R100_NATIVE_WORLDS} from '../../src/generated/r100-native-worlds.ts';
import {supportsRuntimeForm} from '../../src/generation/contamination-draw.ts';
import {bakePaintGenome,collectPaintGenomeFloorTiles} from '../../src/entities/form-renderers/d/paint-genome/bake.ts';
import {resolvePaintVeinVariant} from '../../src/entities/form-renderers/d/paint-genome/topology.ts';
import {colonyNucleusSeatsInFloors,resolveStopLoss} from '../../src/systems/contamination-host-live.ts';
import {mix32} from '../../src/generation/seed-fork.ts';
import {TileGrid} from '../../src/systems/tile-grid.ts';
import {bodyHasSupport,bodyDisplacementFraction} from '../../src/systems/ai/physical-grid.ts';
import {GAME_CONSTANTS} from '../../src/config/constants.ts';
const [output,worldOnly,gradeOnly,seedText='20261012']=process.argv.slice(2);
assert(output,'Usage: check-deployment.mjs NEW_OUTPUT [WORLD GRADE SEED]');assert(!fs.existsSync(output),'Never overwrite evidence');fs.mkdirSync(output,{recursive:true});
const report={status:'running',cases:[],errors:[],checks:[]},save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const files=['data/rift-native-enemy-deployment.csv','src/generated/r100-enemy-deployment.ts','src/generation/world-study/native-enemy-deployment.ts','src/generation/world-study/r100-package.ts','src/generation/world-study/r100-master-world.ts','src/generation/world-study/r100-pollution.ts','src/generation/world-study/r100-expedition.ts','src/generation/world-study/r100-production-map.ts'];
const hashes=()=>Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));report.sourcesBefore=hashes();save();
try{
  const recipes=[];
  for(const world of ['crystal-fibre','ruptured-film'])for(const grade of ['low','medium','severe']){
    const recipe=createR100DirectConstructionRecipe(world,Number(seedText),grade);assert(validR100ProductionRecipe(recipe));
    const contract=recipe.enemyDeployment;assert(contract);assert.deepEqual(contract,NATIVE_ENEMY_DEPLOYMENTS.find(row=>row.worldId===world&&row.grade===grade));
    for(const form of [contract.infiltrator,contract.rewriter,contract.paint])assert(supportsRuntimeForm(form));
    for(const mutate of [r=>delete r.enemyDeployment,r=>r.enemyDeployment.paint.substrate='oil_film',r=>r.enemyDeployment.infiltrator.lexemes.sense='sense_hear',r=>r.enemyDeployment.sourceHash='0'.repeat(64)]){
      const changed=structuredClone(recipe);mutate(changed);assert.equal(validR100ProductionRecipe(changed),false);
    }
    const r12=createR100NativeSpatialDevelopmentRecipe(world,Number(seedText),grade);assert.equal(r12.enemyDeployment,undefined);assert(validR100ProductionRecipe(r12));
    if((!worldOnly||worldOnly===world)&&(!gradeOnly||gradeOnly===grade))recipes.push(recipe);
  }
  for(const world of R100_NATIVE_WORLDS)if(!['crystal-fibre','ruptured-film'].includes(world.id))assert.equal(createR100ProductionRecipe(world.id,42,'medium').enemyDeployment,undefined);
  assert(recipes.length);report.checks.push('6 frozen legal form contracts; changed/missing data rejected; r12 and other 106 worlds have no deployment override');
  // Only this isolated process loses today's deployment catalog. Saved contracts
  // must still validate and reconstruct; no generated file is edited.
  NATIVE_ENEMY_DEPLOYMENTS.splice(0);
  for(const recipe of recipes){
    const started=performance.now();assert(validR100ProductionRecipe(recipe));
    const map=createR100ProductionMap(recipe),layout=map.layout,contract=recipe.enemyDeployment;
    const row={world:contract.worldId,grade:contract.grade,requestedSeed:recipe.requestedSeed,effectiveSeed:layout.seed,attempt:map.metadata.attempt,enemyCount:layout.enemySpawns.length,paintCount:map.native.pollution.forms.filter(form=>form.occupancy==='paint').length,paint:[],enemies:[]};
    assert.equal(layout.enemySpawns.length,recipe.contentDefinition.enemy_count);
    const grid=new TileGrid(layout.tileMap),half=GAME_CONSTANTS.AI.BODY_SIZE/2;
    for(const enemy of layout.enemySpawns){
      assert.deepEqual(enemy.form,enemy.type==='rewriter'?contract.rewriter:contract.infiltrator);
      const points=[enemy.spawn,...enemy.patrol.waypoints].map(p=>({x:(p.col+.5)*8,y:(p.row+.5)*8}));
      for(const point of points)assert(bodyHasSupport(grid,point,half,half));
      for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(a.x!==b.x||a.y!==b.y)assert.equal(bodyDisplacementFraction(grid,a,half,half,b.x-a.x,b.y-a.y),1);}
      row.enemies.push({id:enemy.id,type:enemy.type,substrate:enemy.form.substrate,coverage:enemy.form.coverage,lexemes:enemy.form.lexemes,patrolPoints:enemy.patrol.waypoints.length});
    }
    assert.equal(row.paintCount,recipe.gradeDefinition.paintCount);const union=new Set(),hostGrid=new TileGrid(map.hostTileMap);
    for(let slot=0;slot<row.paintCount;slot++){
      const form=map.native.pollution.forms[slot],pin=layout.contaminationPins.paintFloors[slot];assert.deepEqual(form,contract.paint);
      const seed=mix32(layout.seed,`ENM_BING_${String(slot+1).padStart(2,'0')}`),baked=bakePaintGenome({...form,seed,sense:form.lexemes.sense,rhythm:form.lexemes.rhythm,fragmentTypeId:layout.fragmentTypeId,veinVariant:resolvePaintVeinVariant(form.substrate,seed),geometryVersion:layout.paintGeometryVersion});
      const cells=field=>collectPaintGenomeFloorTiles(field,baked.canvasW,baked.canvasH,(pin.floorCol+.5)*32,(pin.floorRow+.5)*32,32),support=cells(baked.terrainFootprintField),danger=cells(baked.field);
      assert(support.length&&danger.length);assert(support.every(p=>hostGrid.isWalkable(p.col,p.row)));assert(danger.every(p=>hostGrid.isWalkable(p.col,p.row)));
      for(const p of danger){const key=`${p.col},${p.row}`;assert(!union.has(key),'Distinct Hosts retain non-overlapping danger cells');union.add(key);}
      const config=GAME_CONSTANTS.CONTAMINATION,nuclei=colonyNucleusSeatsInFloors(danger,config.COLONY_NUCLEUS_COUNT_MIN,config.COLONY_NUCLEUS_COUNT_MAX,config.COLONY_NUCLEUS_MIN_TILE_GAP,2);
      assert.equal(resolveStopLoss(form).family,'scatter_rejoin');assert(nuclei.length>=config.COLONY_NUCLEUS_COUNT_MIN);
      row.paint.push({slot,substrate:form.substrate,coverage:form.coverage,lexemes:form.lexemes,supportCells:support.length,dangerCells:danger.length,nuclei:nuclei.length});
    }
    assert.deepEqual([...union].sort(),map.native.pollution.paintCells.map(p=>`${Math.floor(p.x/32)},${Math.floor(p.y/32)}`).sort());
    const again=createR100ProductionMap(JSON.parse(JSON.stringify(recipe)));assert.deepEqual(again,map,'Cold recipe reproduces entire actual map without current deployment catalog');
    row.status='passed';row.elapsedMs=performance.now()-started;row.signature=map.metadata.signature;report.cases.push(row);save();console.log(JSON.stringify({world:row.world,grade:row.grade,status:row.status,enemies:row.enemyCount,paint:row.paintCount,elapsedMs:row.elapsedMs}));
  }
  report.checks.push('Actual full AI quotas/forms and 20px patrol support','Actual fungal bake support, danger union, non-overlap and colony nuclei','Full map JSON-recipe cold replay without current deployment catalog');report.status='passed';
}catch(error){report.status='failed';report.errors.push({error:String(error.stack??error),diagnostics:error.diagnostics??null});}
finally{report.sourcesAfter=hashes();report.sourcesStable=JSON.stringify(report.sourcesBefore)===JSON.stringify(report.sourcesAfter);if(!report.sourcesStable)report.status='failed';save();console.log(JSON.stringify({status:report.status,cases:report.cases.length,output,errors:report.errors.map(row=>row.error)}));}
if(report.status!=='passed')process.exitCode=1;
