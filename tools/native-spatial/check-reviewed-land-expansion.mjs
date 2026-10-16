/** Fixed causal diagnostic: three prescribed land margins, no optimization. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {serialize} from 'node:v8';
import {gzipSync} from 'node:zlib';
import {parseNativeSpatialConstructionReference,constructNativeSpatialReference,NATIVE_CONSTRUCTION_REFERENCE_COLUMNS as columns} from '../../src/generation/world-study/native-spatial-construction-reference.ts';
import {parseNativeConstructionShore,measureNativeConstructionBoundary} from '../../src/generation/world-study/native-spatial-construction-shore.ts';
import {createR100NativeSpatialDevelopmentRecipe} from '../../src/generation/world-study/r100-package.ts';
import {buildNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';
import {evaluateNativeSpatialVisibility} from '../../src/generation/world-study/native-spatial-visibility.ts';
const [receiptDirectory,shoreFile,output]=process.argv.slice(2);
assert(receiptDirectory&&shoreFile&&output,'Usage: check-reviewed-land-expansion.mjs REFINEMENT_DIRECTORY SHORE_CSV NEW_OUTPUT');
assert(!fs.existsSync(output),'Never overwrite diagnostic evidence');fs.mkdirSync(output,{recursive:true});
const sha=value=>createHash('sha256').update(value).digest('hex');
const csv=fs.readFileSync(path.join(receiptDirectory,'best-reference.csv'),'utf8'),original=parseNativeSpatialConstructionReference(csv,sha(csv));
const source=JSON.parse(fs.readFileSync(path.join(receiptDirectory,'report.json'),'utf8')),intent=JSON.parse(fs.readFileSync(path.join(receiptDirectory,'derived-intent.json'),'utf8'));
const shoreCSV=fs.readFileSync(shoreFile,'utf8'),shore=parseNativeConstructionShore(shoreCSV,sha(shoreCSV));
const recipe=createR100NativeSpatialDevelopmentRecipe(original.worldId,original.seed,original.grade),input=recipe.nativeSpatial;
Object.assign(input.world,{frameWidthPx:intent.frameWidthPx,frameHeightPx:intent.frameHeightPx,targetWalkAreaPx2:intent.targetWalkAreaPx2});input.policy.planningCellFactor=intent.planningCellFactor;
const cases=[8,16,24].map(margin=>({id:`land-margin-${margin}`,margin}));
if(original.worldId==='ruptured-film')cases.push({id:'whole-mother-pi',rotation:Math.PI});
const report={scope:'Prescribed causal diagnostics only. Fixed target, frame, source assemblies, H/S coordinates and spawn; shared shore and complete G1/G2/G3. No production eligibility or full deployment.',worldId:original.worldId,sourceReceipt:receiptDirectory,sourceHash:sha(csv),intent,baseline:{geometry:source.gates.geometry.metrics,visibility:source.gates.visibility.metrics.coverage},cases:[]};
const write=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');write();
for(const test of cases){
  const dir=path.join(output,test.id);fs.mkdirSync(dir);const result={...test,geometryAccepted:false,visibilityAccepted:false},began=performance.now();report.cases.push(result);
  try{
    const rows=original.rows.map(row=>({...row}));
    if(test.margin)for(const row of rows.filter(r=>r.kind==='land')){
      row.x_px=String(Number(row.x_px)-test.margin);row.y_px=String(Number(row.y_px)-test.margin);
      row.width_px=String(Number(row.width_px)+2*test.margin);row.height_px=String(Number(row.height_px)+2*test.margin);
      assert(Number(row.x_px)>=0&&Number(row.y_px)>=0&&Number(row.x_px)+Number(row.width_px)<=intent.frameWidthPx&&Number(row.y_px)+Number(row.height_px)<=intent.frameHeightPx,'Prescribed margin would leave the fixed frame');
    }
    if(test.rotation)for(const row of rows.filter(r=>r.kind==='assembly'))row.rotation_rad=String(Number(row.rotation_rad)+test.rotation);
    assert.deepEqual(rows.filter(r=>r.kind==='hole'||r.kind==='solid'||r.kind==='spawn'),original.rows.filter(r=>r.kind==='hole'||r.kind==='solid'||r.kind==='spawn'),'H/S and spawn moved');
    const changedCSV=columns.join(',')+'\n'+rows.map(row=>columns.map(column=>row[column]).join(',')).join('\n')+'\n';
    fs.writeFileSync(path.join(dir,'reference.csv'),changedCSV);
    const reference=parseNativeSpatialConstructionReference(changedCSV,sha(changedCSV));
    const layout=constructNativeSpatialReference(recipe,reference,undefined,{policy:shore,combinedSourceHash:sha(changedCSV+shoreCSV)});
    assert.equal(layout.constructionExtension,undefined);
    const geometry=buildNativeSpatialGeometry(layout.definition,original.seed),groups=identifyNativeSpatialStructures(geometry,layout.assemblies,input.policy);
    const store=(name,value)=>fs.writeFileSync(path.join(dir,name),gzipSync(serialize(value)));
    const ground=evaluateNativeSpatialGeometry(geometry,groups,input.policy,input.world,{placements:layout.holes,profiles:input.holeProfiles},{landRects:layout.plan.land,placements:layout.bays,landJoins:layout.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx},diagnostic=>store('geometry-diagnostic.v8.gz',diagnostic));
    const visibility=evaluateNativeSpatialVisibility(geometry,groups.structures,input.policy),boundary=measureNativeConstructionBoundary(layout.definition.terrainOutline,shore.maxCleanRunPx);
    result.gates={geometry:ground,visibility};result.boundary=boundary;result.geometryAccepted=ground.accepted&&boundary.accepted;result.visibilityAccepted=visibility.accepted;
    fs.writeFileSync(path.join(dir,'layout.json'),JSON.stringify(layout,null,2)+'\n');
    const t=geometry.terrain;store('geometry.v8.gz',{layout,terrain:{cols:t.cols,rows:t.rows,width:t.width,height:t.height,matter:t.matter,definition:t.definition,spawnPoint:t.spawnPoint},supported:geometry.supported,reachable:geometry.reachable,links8:geometry.links8,solidPrimitives:geometry.solidPrimitives});
    const m=ground.metrics;result.summary={reasons:ground.reasons,maxEmptyUpperPx:m.maxEmptyUpperPx,maxDeepSpanPx:m.maxDeepSpanPx,wideRatio:m.wideRatio,largestWideRatio:m.largestWideRatio,walkAreaPx2:m.walkAreaPx2,cover:visibility.metrics.coverage,visibilityReasons:visibility.reasons};
  }catch(error){result.error=String(error.stack??error);}
  result.elapsedMs=performance.now()-began;write();console.log(JSON.stringify({worldId:report.worldId,id:result.id,summary:result.summary,error:result.error,elapsedMs:result.elapsedMs}));
}
report.completed=true;report.acceptedCases=report.cases.filter(c=>c.geometryAccepted&&c.visibilityAccepted).map(c=>c.id);write();
