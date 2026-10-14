/** Whole proposals including failures; never a production-admission or aesthetic pass. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import sharp from 'sharp';import {createHash} from 'node:crypto';
import {createR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import * as data from '../../src/generated/r100-native-spatial.ts';
import {createNativeSpatialLayout} from '../../src/generation/world-study/native-spatial-layout.ts';
import {buildNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';
import {evaluateNativeSpatialVisibility} from '../../src/generation/world-study/native-spatial-visibility.ts';
import {nativeRectUnionArea} from '../../src/generation/world-study/native-spatial-land.ts';
import {nativeSpatialRemovedLand} from '../../src/generation/world-study/native-spatial-bay-layout.ts';
import {TileType} from '../../src/types/game-types.ts';
const out=process.argv[2];assert(out&&!fs.existsSync(out),'A fresh output directory is required');fs.mkdirSync(out,{recursive:true});
const worlds=['gel-rafts'],seeds=[20261012],grade='medium',spacing=data.NATIVE_SPATIAL_POLICY.spacingPx;
const paths=['native-spatial-layout.ts','native-spatial-land.ts','native-spatial-bay-layout.ts','native-spatial-geometry.ts','native-spatial-measure.ts','native-spatial-final-support.ts','native-spatial-visibility.ts','native-spatial-bay-measure.ts','native-spatial-types.ts','r100-fragment-shape.ts'].map(name=>'src/generation/world-study/'+name).concat(['src/generated/r100-native-spatial.ts']);
const hashes=()=>Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const report={status:'running',scope:'Fixed gel seed 20261012 / medium / candidate 0 / H:S 8:4; native bay count branches 0/1/2. Land is jointly resampled for bay area cost; not a frozen-land ablation. Final H/B identity, profile and source-footprint gates are included; any isolated B pass is not whole-map admission. No spawn/extraction/full deployment/G4 or Art admission.',spacing,seeds,grade,worlds,sourceHashes:hashes(),cases:[]};const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');save();
for(const worldId of worlds)for(const seed of seeds){
 const native=createR100ProductionRecipe(worldId,seed,grade).nativeDefinition,input={policy:{...data.NATIVE_SPATIAL_POLICY,spacingPx:spacing},world:data.NATIVE_SPATIAL_WORLDS.find(w=>w.worldId===worldId),holeProfiles:data.NATIVE_SPATIAL_HOLE_PROFILES,bayProfiles:data.NATIVE_SPATIAL_BAY_PROFILES,assemblies:data.NATIVE_SPATIAL_ASSEMBLIES.filter(a=>a.worldId===worldId&&(a.grade==='all'||a.grade===grade)),subordinateProfiles:data.NATIVE_SPATIAL_SUBORDINATE_PROFILES.filter(p=>p.family===native.family)};
 for(let bayCountIndex=0;bayCountIndex<3;bayCountIndex++){const candidate=0;
  const start=performance.now(),id=`${worldId}-${seed}-b${bayCountIndex}`;let row={worldId,seed,candidate,bayCountIndex};
  try{
   const proposal=createNativeSpatialLayout(native,input,seed,seed,candidate,undefined,0,bayCountIndex),layoutMs=performance.now()-start,t=performance.now(),geometry=buildNativeSpatialGeometry(proposal.definition,seed),groups=identifyNativeSpatialStructures(geometry,proposal.assemblies,input.policy),gate=evaluateNativeSpatialGeometry(geometry,groups,input.policy,input.world,{placements:proposal.holes,profiles:input.holeProfiles},{landRects:proposal.plan.land,placements:proposal.bays,landJoins:proposal.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx}),measureMs=performance.now()-t;
   row={...row,layoutMs,measureMs,requestedCounts:proposal.requestedCounts,gate,positiveLandRects:proposal.plan.land,landPlates:proposal.plan.landPlates,positiveAreaPx2:nativeRectUnionArea(proposal.plan.land),bayAuthoring:proposal.bays.map(b=>({...b,rawRemovedLandAreaPx2:nativeRectUnionArea(nativeSpatialRemovedLand(proposal.plan.land,b.rects))})),deepSpanProxyPx:proposal.plan.deepSpanProxyPx};
   if(gate.accepted&&process.env.QA_VISIBILITY==='1'){const v=performance.now();row.visibility=evaluateNativeSpatialVisibility(geometry,groups.structures,input.policy);row.visibilityMs=performance.now()-v;}
   fs.writeFileSync(path.join(out,`${id}.json`),JSON.stringify({input,proposal,gate,visibility:row.visibility},null,2)+'\n');
   const tile=geometry.terrain.tileMap,rgba=Buffer.alloc(tile.cols*tile.rows*4);for(let y=0;y<tile.rows;y++)for(let x=0;x<tile.cols;x++){const c=tile.tiles[y][x]===TileType.VOID?[4,7,8]:tile.tiles[y][x]===TileType.WALL?[192,145,89]:[133,152,149],at=(y*tile.cols+x)*4;for(let j=0;j<3;j++)rgba[at+j]=c[j];rgba[at+3]=255;}
   await sharp(rgba,{raw:{width:tile.cols,height:tile.rows,channels:4}}).resize(tile.cols*4,tile.rows*4,{kernel:'nearest'}).png().toFile(path.join(out,`${id}.png`));row.image=`${id}.png`;row.proposal=`${id}.json`;
   const outer=proposal.definition.terrainOutline;const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="896" viewBox="0 0 2304 1792"><rect width="2304" height="1792" fill="#040708"/><polygon points="${outer.map(p=>p.x+','+p.y).join(' ')}" fill="#859895"/></svg>`);await sharp(svg).png().toFile(path.join(out,`${id}-outer.png`));row.outerImage=`${id}-outer.png`;
   console.log(`${gate.accepted?'GEOMETRY':'REJECT'} ${id}: ${(performance.now()-start).toFixed(0)}ms ${gate.reasons.join(',')}`);
  }catch(e){row.error=String(e.stack??e);console.log(`FAIL ${id}: ${e.message}`);}
  row.totalMs=performance.now()-start;report.cases.push(row);save();global.gc?.();
 }
}
report.status='completed-proposal-diagnostics';report.sourceHashesAfter=hashes();report.sourcesStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.sourceHashesAfter);save();
