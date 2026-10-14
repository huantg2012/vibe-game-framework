/** One CSV reference, one compiled geometry. Never invokes a layout search. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {serialize} from 'node:v8';
import {gzipSync} from 'node:zlib';
import sharp from 'sharp';
import {parseNativeSpatialConstructionReference,constructNativeSpatialReference} from '../../src/generation/world-study/native-spatial-construction-reference.ts';
import {parseNativeConstructionShore,constructNativeMacroShore,nativeConstructionAddedCoverage,measureNativeConstructionBoundary} from '../../src/generation/world-study/native-spatial-construction-shore.ts';
import {createR100NativeSpatialDevelopmentRecipe} from '../../src/generation/world-study/r100-package.ts';
import {buildNativeSpatialGeometry,nativePrimitive,nativePrimitiveTree} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';
import {evaluateNativeSpatialVisibility} from '../../src/generation/world-study/native-spatial-visibility.ts';
import {nativeSpatialGeometryFingerprint} from '../../src/generation/world-study/native-spatial-generation.ts';
import {completeNativeSpatialCandidate} from '../../src/generation/world-study/r100-production-map.ts';

const csvPath=process.argv[2],output=process.argv[3];
const options=process.argv.slice(4);let shorePath;
for(let i=0;i<options.length;i++){if(options[i]==='--shore'){assert(options[i+1]&&!options[i+1].startsWith('--')&&!shorePath,'--shore requires one CSV');shorePath=options[++i];}else assert.equal(options[i],'--check-only','Unknown reference option');}
assert(csvPath&&output,'Usage: check-construction-reference.mjs CSV NEW_OUTPUT_DIRECTORY [--shore SHORE_CSV] [--check-only]');
assert(!fs.existsSync(output),'Never overwrite a reference result');fs.mkdirSync(output,{recursive:true});
const sha=value=>createHash('sha256').update(value).digest('hex');
const files=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{const file=path.join(directory,entry.name);return entry.isDirectory()?files(file):[file];});
const hashes=()=>Object.fromEntries([...files('src').filter(file=>/\.(?:[cm]?[jt]sx?|json)$/.test(file)),...files('data').filter(file=>file.endsWith('.csv')),'tools/native-spatial/check-construction-reference.mjs'].sort().map(file=>[file,sha(fs.readFileSync(file))]));
const report={status:'running',scope:'DEV reference only; no production connection, placement search, retry, or ordinary recipe replay. One fragment authoring compile and initial geometry build; successful admission may additionally build the official Master once.',sourceHashes:hashes(),csvPath,csvSHA256:sha(fs.readFileSync(csvPath)),shoreCSVPath:shorePath??null,shoreCSVSHA256:shorePath?sha(fs.readFileSync(shorePath)):null,stages:[],counts:{references:0,fragmentCompiles:0,initialGeometryBuilds:0,masterBuildAttempts:0,visibilityEvaluations:0,fullCandidates:0},errors:[]};
const start=performance.now(),save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
let stage='input',attempt;
const checkpoint=()=>{if(performance.now()-start>=60000){if(attempt)attempt.stopReason='deadline';throw new Error('Single direct reference exceeded 60 seconds; no retry');}};
const run=(name,fn)=>{stage=name;checkpoint();const began=performance.now();try{return fn();}finally{report.stages.push({stage:name,elapsedMs:performance.now()-began});checkpoint();}};
const store=(name,value)=>fs.writeFileSync(path.join(output,name),gzipSync(serialize(value)));
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function silhouette(geometry,groups,gate,map){
  const t=geometry.terrain;let land='';
  for(let y=0;y<t.rows;y++)for(let x=0;x<t.cols;){if(!t.matter[y*t.cols+x]){x++;continue;}const from=x;while(x<t.cols&&t.matter[y*t.cols+x])x++;land+=`M${from*8},${y*8}h${(x-from)*8}v8h-${(x-from)*8}z`;}
  const triangles=geometry.solidPrimitives.map(p=>`M${p.points[0]},${p.points[1]}L${p.points[2]},${p.points[3]}L${p.points[4]},${p.points[5]}z`).join('');
  const text=(x,y,value,color='#f2f3ed')=>`<text x="${x}" y="${y}" fill="${color}" font-family="sans-serif" font-size="20" stroke="#10161b" stroke-width="4" paint-order="stroke">${esc(value)}</text>`;
  let labels=groups.structures.map(s=>text((s.bounds.minX+s.bounds.maxX)/2,(s.bounds.minY+s.bounds.maxY)/2,s.id,s.kind==='hole'?'#69d9e7':'#f3c685')).join('');
  const marker=(p,label,color)=>`<circle cx="${p.x}" cy="${p.y}" r="10" fill="${color}" stroke="#111" stroke-width="3"/>${text(p.x+15,p.y-15,label,color)}`;
  labels+=marker(t.spawnPoint,'spawn','#e9f0ed');
  if(map)labels+=marker(map.layout.extractionPoint.position,'exit','#ffd16e');
  if(gate.metrics.worstEmptyPoint)labels+=marker(gate.metrics.worstEmptyPoint,'G1 worst','#ff6a6a');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${t.width}" height="${t.height}" viewBox="0 0 ${t.width} ${t.height}"><rect width="100%" height="100%" fill="#10161b"/><path d="${land}" fill="#7a918e" shape-rendering="crispEdges"/><path d="${triangles}" fill="#c49b63"/>${labels}${text(24,34,map?'Full reference admitted':'Reference diagnosis — not admitted')}${text(24,64,map?'':'Exit is only selected after all geometry gates pass.')}</svg>`;
}
try{
  const csv=fs.readFileSync(csvPath,'utf8'),reference=parseNativeSpatialConstructionReference(csv,report.csvSHA256);
  fs.writeFileSync(path.join(output,'reference.csv'),csv);report.reference=reference;
  let shore;
  if(shorePath){const text=fs.readFileSync(shorePath,'utf8'),policy=parseNativeConstructionShore(text,report.shoreCSVSHA256);assert.equal(policy.referenceId,reference.id);report.combinedSourceSHA256=sha(JSON.stringify({referenceSHA256:report.csvSHA256,shoreSHA256:report.shoreCSVSHA256}));shore={policy,combinedSourceHash:report.combinedSourceSHA256};fs.writeFileSync(path.join(output,'shore.csv'),text);report.shorePolicy=policy;}
  else report.combinedSourceSHA256=report.csvSHA256;
  if(process.argv.includes('--check-only')){
    assert.throws(()=>parseNativeSpatialConstructionReference(csv.replace('reference_id','wrong_header'),report.csvSHA256),/header/);
    assert.throws(()=>parseNativeSpatialConstructionReference(csv,'bad'),/SHA256/);
    const lines=csv.trim().split(/\r?\n/);assert.throws(()=>parseNativeSpatialConstructionReference([...lines,lines[1]].join('\n'),report.csvSHA256),/duplicate/);
    const recipe=createR100NativeSpatialDevelopmentRecipe(reference.worldId,reference.seed,reference.grade);assert.equal(recipe.package.algorithmRevision,12);
    let noShoreShape;const stopBeforeCompile=new Error('pure authoring inspection');
    assert.throws(()=>constructNativeSpatialReference(recipe,reference,shape=>{noShoreShape=shape;throw stopBeforeCompile;}),error=>error===stopBeforeCompile);
    assert.equal(noShoreShape.sourceHash,reference.sourceHash);assert.equal(noShoreShape.edgeSeed,(reference.seed+reference.seedSalt)>>>0);
    assert.deepEqual(noShoreShape.layout.landRects,reference.rows.filter(r=>r.kind==='land').map(r=>[r.x_px,r.y_px,r.width_px,r.height_px].map(v=>Number(v)/2)));
    assert.deepEqual(noShoreShape.layout.voidRects,reference.rows.filter(r=>r.kind==='hole').flatMap(r=>r.rects.split('|').map(rect=>rect.split(':').map(v=>Number(v)/2))));
    report.checks=['strict-header','source-hash-required','duplicate-id-rejected','explicit-development-recipe','no-shore-original-rectangles-and-seed-before-compile'];report.status='passed';
    // Pure authoring only: no terrain compiler or layout sampler is called.
    if(shore){
      const filledFrame=[nativePrimitive([0,0,1792,0,1792,1536],1),nativePrimitive([0,0,1792,1536,0,1536],1)];
      const policy=shore.policy,base={land:[[256,256,1024,768]],protectedRects:[],supportBounds:[],coverPrimitives:filledFrame,maxAddedCoverDistancePx:112,frame:[1792,1536],seed:reference.seed};
      const first=constructNativeMacroShore(base,policy),again=constructNativeMacroShore(base,policy);
      assert.deepEqual(first,again);assert(first.additions.length>0&&first.cuts.length>0);assert.equal(first.originalShore.length,4);assert(first.trials.every(t=>t.sourceEdge<4));
      const guarded=constructNativeMacroShore({...base,protectedRects:base.land},policy);assert.equal(guarded.cuts.length,0);
      const supported=constructNativeMacroShore({...base,supportBounds:base.land},policy);assert.equal(supported.cuts.length,0);
      assert.deepEqual(base.land,[[256,256,1024,768]]);
      for(const r of [...first.additions,...first.cuts])assert(r[0]>=0&&r[1]>=0&&r[0]+r[2]<=base.frame[0]&&r[1]+r[3]<=base.frame[1]);
      const ring={...base,land:[[256,256,1024,128],[256,896,1024,128],[256,384,128,512],[1152,384,128,512]]};
      assert.equal(constructNativeMacroShore(ring,policy).originalShore.length,4);
      const uncovered=constructNativeMacroShore({...base,coverPrimitives:[]},policy);assert.equal(uncovered.additions.length,0);assert(uncovered.trials.some(t=>t.reason==='added-land-cover-distance'));assert.equal(uncovered.trials.length,first.trials.length);
      const onFrame=constructNativeMacroShore({...base,land:[[0,0,...base.frame]]},policy);assert(onFrame.cuts.length>0);assert.equal(onFrame.additions.length,0);
      for(const r of onFrame.cuts)assert(r[0]>=0&&r[1]>=0&&r[0]+r[2]<=base.frame[0]&&r[1]+r[3]<=base.frame[1]);
      for(const r of first.additions)assert(r[0]>=32&&r[1]>=32&&r[0]+r[2]<=base.frame[0]-32&&r[1]+r[3]<=base.frame[1]-32);
      assert.equal(nativeConstructionAddedCoverage([128,128,8,8],nativePrimitiveTree([nativePrimitive([26,0,26,512],1)]),112).accepted,true);
      assert.equal(nativeConstructionAddedCoverage([128,128,8,8],nativePrimitiveTree([nativePrimitive([25,0,25,512],1)]),112).accepted,false);
      assert.equal(nativeConstructionAddedCoverage([256,256,8,8],nativePrimitiveTree([nativePrimitive([0,0,320,0,0,320],1)]),112).accepted,false);
      assert.throws(()=>parseNativeConstructionShore(fs.readFileSync(shorePath,'utf8').replace('macro-shore-step-v1','wrong'),report.shoreCSVSHA256),/identity/);
      const subdivided=[{x:200,y:0},{x:400,y:0},{x:400,y:128},{x:0,y:128},{x:0,y:0}];
      const cleanRun=measureNativeConstructionBoundary(subdivided,384);assert.equal(cleanRun.maxCleanRunPx,400);assert.equal(cleanRun.accepted,false);
      assert.equal(measureNativeConstructionBoundary(subdivided,400).accepted,true);
      report.boundaryChecks=['collinear-wrap-merged','over-limit-rejected','exact-limit-accepted'];
      report.shoreChecks={checks:['deterministic-single-layer','cut-and-add','protected-rects','projected-support-bounds','frame','enclosed-union-cavity-excluded','strict-policy','input-unchanged','uncovered-addition-rejected-without-retry','32px-added-frame-inset','on-frame-cut-clamped','8px-cell-corner-error','triangle-distance-not-bounds'],trials:first.trials.length,additions:first.additions.length,cuts:first.cuts.length};
    }else assert.equal(report.combinedSourceSHA256,report.csvSHA256);
  }else{
    const recipe=createR100NativeSpatialDevelopmentRecipe(reference.worldId,reference.seed,reference.grade),input=recipe.nativeSpatial;assert(input);
    fs.writeFileSync(path.join(output,'recipe.json'),JSON.stringify(recipe,null,2)+'\n');
    const frozenRecipe=JSON.stringify(recipe);report.counts.references++;
    const layout=run('construct-and-break-edges',()=>constructNativeSpatialReference(recipe,reference,()=>{report.counts.fragmentCompiles++;},shore));
    if(layout.constructionShore)report.shore=layout.constructionShore;
    if(shore)report.boundary=measureNativeConstructionBoundary(layout.definition.terrainOutline,shore.policy.maxCleanRunPx);
    fs.writeFileSync(path.join(output,'layout.json'),JSON.stringify(layout,null,2)+'\n');
    const geometry=run('initial-geometry',()=>{report.counts.initialGeometryBuilds++;return buildNativeSpatialGeometry(layout.definition,reference.seed);});
    // Persist actual failed terrain too. Runtime callbacks are intentionally not serialized.
    const t=geometry.terrain;store('geometry.v8.gz',{layout,terrain:{cols:t.cols,rows:t.rows,width:t.width,height:t.height,matter:t.matter,definition:t.definition,spawnPoint:t.spawnPoint},supported:geometry.supported,reachable:geometry.reachable,links8:geometry.links8,solidPrimitives:geometry.solidPrimitives});
    const groups=run('structure-identities',()=>identifyNativeSpatialStructures(geometry,layout.assemblies,input.policy));
    const ground=run('G1-G3',()=>evaluateNativeSpatialGeometry(geometry,groups,input.policy,input.world,{placements:layout.holes,profiles:input.holeProfiles},
      {landRects:layout.plan.land,placements:layout.bays,landJoins:layout.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx}));
    report.geometryHash=nativeSpatialGeometryFingerprint(geometry,layout).hash;report.gates={geometry:ground};
    const beforeFullSvg=silhouette(geometry,groups,ground);
    fs.writeFileSync(path.join(output,'silhouette.svg'),beforeFullSvg);await sharp(Buffer.from(beforeFullSvg)).resize({width:1152}).png().toFile(path.join(output,'silhouette.png'));save();
    // One official visibility measurement, also on failed G1/G3 references for
    // diagnosis. It cannot override geometry rejection or authorize deployment.
    const visibility=run('G2',()=>{report.counts.visibilityEvaluations++;return evaluateNativeSpatialVisibility(geometry,groups.structures,input.policy);});report.gates.visibility=visibility;
    const reasons=[...ground.reasons,...visibility.reasons,...(report.boundary?.accepted===false?['shore-long-clean-run']:[])],trace={candidate:0,geometrySeed:reference.seed,layoutSeed:layout.layoutSeed,geometryHash:report.geometryHash,requestedCounts:layout.requestedCounts,accepted:reasons.length===0,reasons,gates:report.gates};report.candidate=trace;
    if(trace.accepted){
      attempt={geometrySeed:reference.seed,proposalBudget:1,layoutProposals:1,geometryEvaluations:1,finalGeometryEvaluations:1,fullCandidates:0,feedbackBases:[],candidates:[trace],deploymentRejections:[],stopReason:'searching'};
      const result=run('complete',()=>{const value=completeNativeSpatialCandidate(recipe,{layout,geometry,groups,trace},{attempt:0,trace:attempt,attempts:[attempt],rejected:[],checkpoint});report.complete={accepted:value.accepted,...(!value.accepted?{feedback:value.feedback}:{})};return value;});
      report.counts.fullCandidates=attempt.fullCandidates;report.attempt=attempt;
      if(result.accepted){store('map.v8.gz',result.map);const svg=silhouette(geometry,groups,ground,result.map);fs.writeFileSync(path.join(output,'silhouette.svg'),svg);await sharp(Buffer.from(svg)).resize({width:1152}).png().toFile(path.join(output,'silhouette.png'));report.status='passed';}
      else report.status='rejected';
    }else report.status='rejected';
    assert.equal(JSON.stringify(recipe),frozenRecipe,'Reference mutated its original recipe');
  }
}catch(error){report.status='failed';report.errors.push({stage,error:String(error.stack??error)});if(attempt)report.attempt=attempt;}
finally{if(attempt){report.counts.fullCandidates=attempt.fullCandidates;report.attempt=attempt;report.counts.masterBuildAttempts=Number(report.complete?.accepted===true||attempt.deploymentRejections.some(r=>['master','deployment','routes'].includes(r.stage)));}report.elapsedMs=performance.now()-start;report.sourceHashesAfter=hashes();report.sourcesStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.sourceHashesAfter);if(!report.sourcesStable)report.status='failed';save();console.log(JSON.stringify({status:report.status,counts:report.counts,geometry:report.gates?.geometry,visibility:report.gates?.visibility?.accepted,errors:report.errors,sourcesStable:report.sourcesStable,output},null,2));}
if(report.status!=='passed')process.exitCode=1;
