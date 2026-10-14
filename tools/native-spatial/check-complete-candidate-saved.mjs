/** One frozen saved layout, real G1/G2/G3, then the production full-candidate
 * function. No sampler, retry, alternate seed or content fallback. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {serialize} from 'node:v8';
import {gzipSync} from 'node:zlib';
import {mix32} from '../../src/generation/seed-fork.ts';
import {TileType} from '../../src/types/game-types.ts';
import {validR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {completeNativeSpatialCandidate} from '../../src/generation/world-study/r100-production-map.ts';
import {buildNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';
import {evaluateNativeSpatialVisibility} from '../../src/generation/world-study/native-spatial-visibility.ts';
import {createNativeSpatialGeometryWorkBudget,nativeSpatialGeometryFingerprint} from '../../src/generation/world-study/native-spatial-generation.ts';
import {exactHash} from '../stealth-obstacles/baseline.mjs';

const [source,recipeSource,expectedHash,output]=process.argv.slice(2);
assert(source&&recipeSource&&/^[0-9a-f]{16}$/.test(expectedHash??'')&&output&&!fs.existsSync(output),
  'Usage: check-complete-candidate-saved.mjs SAVED_LAYOUT_JSON FULL_RECIPE_OR_SINGLE_FAILURE_JSON EXPECTED_GEOMETRY_HASH NEW_DIRECTORY');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(`${dir}/${entry.name}`):[`${dir}/${entry.name}`]);
const files=[...walk('src').filter(file=>/\.(?:[cm]?[jt]sx?|json)$/.test(file)),...walk('data').filter(file=>file.endsWith('.csv')),
  source,recipeSource,'tools/native-spatial/check-complete-candidate-saved.mjs','tools/contam-preview/tsconfig.json','tsconfig.json','package.json','package-lock.json'];
const snapshot=()=>Object.fromEntries([...new Set(files)].sort().map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const sourceHashes=snapshot(),started=performance.now();
fs.mkdirSync(output,{recursive:true});
const report={status:'running',scope:'One saved layout with exact frozen recipe context and first-attempt geometry seed. A conditional full candidate is not a fresh search or replay success.',startedAt:new Date().toISOString(),node:process.version,source,recipeSource,expectedHash,sourceHashes,
  limits:{deadlineMs:60000,maxFullCandidates:2,attempts:1,retries:0},stages:{geometryCalls:0,visibilityCalls:0,completeCalls:0}};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
try{
  const saved=JSON.parse(fs.readFileSync(source,'utf8')),recipeDocument=JSON.parse(fs.readFileSync(recipeSource,'utf8'));
  const recipe=recipeDocument.version===3?recipeDocument:recipeDocument.recipe??(recipeDocument.failures?.length===1?recipeDocument.failures[0].recipe:null);
  assert(recipe&&validR100ProductionRecipe(recipe)&&recipe.package.algorithmRevision===12,'A complete valid frozen r12 recipe is required');
  const {extraction,deployment,...intent}=recipe.nativeSpatial;
  assert.deepEqual(saved.input,intent,'Saved intent must exactly match all six frozen authoring inputs; never reconstruct missing runtime rules from defaults');
  assert(extraction&&deployment&&recipe.searchSitePolicy,'Extraction, spatial deployment and grounded search policy must be frozen');
  const proposal=saved.proposal,seed=recipe.requestedSeed,input=recipe.nativeSpatial;
  assert.equal(proposal.definition.id,recipe.nativeDefinition.id);assert.equal(proposal.definition.grade,recipe.nativeDefinition.grade);
  assert.equal(proposal.layoutSeed,mix32(seed,`${input.policy.algorithm}:${input.policy.version}:${input.policy.sourceHash}:${input.world.worldId}:${seed}:${proposal.candidate}`),'Saved layout must belong to this exact first request attempt');
  // Layout generation replaces these geometric fields only. Identity, material,
  // original author seed and presentation parameters must retain recipe values.
  const geometricFields=new Set(['cols','rows','instances','erosion','terrainOutline','fragmentShapeVersion','spawn_x','spawn_y','exit_x','exit_y','search_x','search_y','enemy_x','enemy_y']);
  const nonGeometry=definition=>Object.fromEntries(Object.entries(definition).filter(([key])=>!geometricFields.has(key)));
  assert.deepEqual(nonGeometry(proposal.definition),nonGeometry(recipe.nativeDefinition));
  assert.equal(input.policy.maxFullCandidates,2);assert.equal(input.policy.maxGeometryEvaluations,72);
  const frozenRecipe=JSON.stringify(recipe),frozenProposal=JSON.stringify(proposal);
  fs.writeFileSync(path.join(output,'recipe.json'),frozenRecipe+'\n');
  const attempt={geometrySeed:seed,proposalBudget:input.policy.maxGeometryEvaluations,layoutProposals:1,geometryEvaluations:0,fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'},attempts=[attempt],rejected=[];
  report.attempts=attempts;report.rejected=rejected;
  report.context={world:recipe.package.id,grade:recipe.gradeDefinition.id,requestedSeed:seed,geometrySeed:seed,candidate:proposal.candidate,layoutSeed:proposal.layoutSeed,recipeHash:exactHash(recipe),inputSourceHash:input.policy.sourceHash};
  const checkpoint=()=>{if(performance.now()-started>=60000){attempt.stopReason='deadline';throw new Error('Saved native candidate exceeded the shared 60 second deadline');}};
  const budget=createNativeSpatialGeometryWorkBudget(attempt,input.policy.maxGeometryEvaluations,checkpoint);
  const measured=budget.run({kind:'final-geometry',candidate:proposal.candidate},()=>{
    attempt.finalGeometryEvaluations++;report.stages.geometryCalls++;
    const geometry=buildNativeSpatialGeometry(proposal.definition,seed),fingerprint=nativeSpatialGeometryFingerprint(geometry,proposal);
    report.actualGeometryHash=fingerprint.hash;assert.equal(fingerprint.hash,expectedHash,'Refuse a different saved geometry');
    const groups=identifyNativeSpatialStructures(geometry,proposal.assemblies,input.policy);
    const ground=evaluateNativeSpatialGeometry(geometry,groups,input.policy,input.world,{placements:proposal.holes,profiles:input.holeProfiles},
      {landRects:proposal.plan.land,placements:proposal.bays,landJoins:proposal.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx});
    return{accepted:ground.accepted,reasons:ground.reasons,geometry,groups,ground};
  });
  const gates={geometry:measured.ground};report.gates=gates;save();checkpoint();
  if(measured.ground.accepted){
    report.stages.visibilityCalls++;gates.visibility=evaluateNativeSpatialVisibility(measured.geometry,measured.groups.structures,input.policy);checkpoint();
  }
  const reasons=Object.values(gates).flatMap(gate=>gate.reasons),accepted=!!gates.visibility?.accepted&&measured.ground.accepted;
  const trace={candidate:proposal.candidate,geometrySeed:seed,layoutSeed:proposal.layoutSeed,geometryHash:report.actualGeometryHash,requestedCounts:proposal.requestedCounts,accepted,reasons,gates};
  attempt.candidates.push(trace);save();
  if(!accepted){report.status='rejected-before-full';report.reasons=reasons;}
  else{
    report.stages.completeCalls++;
    const result=completeNativeSpatialCandidate(recipe,{layout:proposal,geometry:measured.geometry,groups:measured.groups,trace},{attempt:0,trace:attempt,attempts,rejected,checkpoint});
    if(!result.accepted){report.status='rejected-full';report.feedback=result.feedback;}
    else{
      const map=result.map,{layout}=map,content=recipe.contentDefinition,grade=recipe.gradeDefinition,body=measured.geometry.collision;
      const resources=[];
      for(const tier of ['safe','contested','deep'])for(const kind of ['kindling','contaminant']){
        const nodes=layout[`${kind}Nodes`].filter(node=>node.tier===tier),expectedCount=content[`${kind}_${tier}_count`];
        assert.equal(nodes.length,expectedCount,`${kind}/${tier} exact quota`);
        if(kind==='kindling')assert(nodes.every(node=>node.value===content[`kindling_${tier}_value`]),`${tier} exact value`);
        resources.push({kind,tier,count:nodes.length,...(kind==='kindling'?{value:content[`kindling_${tier}_value`]}:{})});
      }
      assert.equal(layout.enemySpawns.length,content.enemy_count);
      const pins=layout.contaminationPins,forms=layout.contaminationDraw.forms;
      assert.equal(pins.paintFloors.length,grade.paintCount);assert.equal(pins.corridorAabbs.length,grade.volumeCount);
      assert.equal(forms.filter(form=>form.occupancy==='paint'&&form.substrate===grade.paintSubstrate&&form.coverage===grade.paintCoverage).length,grade.paintCount);
      assert.equal(forms.filter(form=>form.occupancy==='volume'&&form.substrate===grade.volumeSubstrate&&form.coverage===grade.volumeCoverage).length,grade.volumeCount);
      for(const pin of pins.paintFloors)assert.equal(map.hostTileMap.tiles[pin.floorRow]?.[pin.floorCol],TileType.FLOOR,'Actual paint pin on Host floor');
      for(const pin of pins.corridorAabbs)for(let y=pin.minRow;y<=pin.maxRow;y++)for(let x=pin.minCol;x<=pin.maxCol;x++)assert.equal(map.hostTileMap.tiles[y]?.[x],TileType.FLOOR,'Actual volume pin supported by Host floor');
      const nodes=[...layout.kindlingNodes,...layout.contaminantNodes];
      for(const point of [layout.spawnPoint,layout.extractionPoint.position,...nodes.map(node=>node.position)])assert(body.supports(point,10,10),'Full body landmark support');
      let patrolSegments=0;
      for(const enemy of layout.enemySpawns){
        assert.notEqual(enemy.patrol.mode,'static');assert(enemy.patrol.waypoints.length>1);assert(enemy.form);
        for(let i=1;i<enemy.patrol.waypoints.length;i++){
          const a=enemy.patrol.waypoints[i-1],b=enemy.patrol.waypoints[i],point={x:(a.col+.5)*8,y:(a.row+.5)*8};
          assert.equal(body.displacementFraction(point,10,10,(b.col-a.col)*8,(b.row-a.row)*8),1,'Actual patrol body sweep');patrolSegments++;
        }
      }
      const windows=map.native.diagnostics.expedition.patrolWindows;
      assert.deepEqual(windows.map(window=>window.id).sort(),nodes.filter(node=>node.tier!=='safe').map(node=>node.id).sort(),'All non-safe nodes retain real patrol search windows');
      assert.deepEqual(map.native.searchSites.map(site=>site.nodeId).sort(),nodes.map(node=>node.id).sort(),'Every node retains grounded provenance');
      for(const site of map.native.searchSites)assert.deepEqual(site.position,nodes.find(node=>node.id===site.nodeId).position);
      checkpoint();assert.equal(map.metadata.effectiveSeed,seed);assert.equal(map.metadata.attempt,0);assert.equal(map.native.algorithmRevision,12);
      report.status='accepted-fixed-candidate';report.mapHash=exactHash(map);report.metadata=map.metadata;report.diagnostics=map.native.diagnostics;
      report.contentChecks={resources,enemyCount:layout.enemySpawns.length,patrolSegments,patrolWindowCount:windows.length,paintPins:pins.paintFloors.length,volumePins:pins.corridorAabbs.length,searchSites:map.native.searchSites.length};
      fs.writeFileSync(path.join(output,'map.v8.gz'),gzipSync(serialize(map)));
    }
  }
  checkpoint();assert.equal(JSON.stringify(recipe),frozenRecipe,'Frozen recipe mutated');assert.equal(JSON.stringify(proposal),frozenProposal,'Saved proposal mutated');
}catch(error){report.status='failed';report.error=String(error.stack??error);if(error.diagnostics)report.errorDiagnostics=error.diagnostics;}
report.elapsedMs=performance.now()-started;report.finishedAt=new Date().toISOString();report.sourceHashesAfter=snapshot();report.sourcesStable=JSON.stringify(sourceHashes)===JSON.stringify(report.sourceHashesAfter);
if(!report.sourcesStable)report.status='invalid-source-changed';save();
console.log(JSON.stringify({status:report.status,actualGeometryHash:report.actualGeometryHash,elapsedMs:report.elapsedMs,stages:report.stages,geometryWork:report.attempts?.[0].geometryEvaluations,fullCandidates:report.attempts?.[0].fullCandidates,reasons:report.reasons,error:report.error,sourcesStable:report.sourcesStable}));
if(report.status!=='accepted-fixed-candidate')process.exitCode=1;
