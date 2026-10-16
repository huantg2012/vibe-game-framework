/** Bounded offline authoring refinement. All admissions use the shared compiler
 * and actual geometry gates. The coarse predictor only orders fixed proposals. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {serialize} from 'node:v8';
import {gzipSync} from 'node:zlib';
import {parseNativeSpatialConstructionReference,constructNativeSpatialReference,NATIVE_CONSTRUCTION_REFERENCE_COLUMNS as columns} from '../../src/generation/world-study/native-spatial-construction-reference.ts';
import {parseNativeConstructionShore,measureNativeConstructionBoundary} from '../../src/generation/world-study/native-spatial-construction-shore.ts';
import {createR100NativeSpatialDevelopmentRecipe} from '../../src/generation/world-study/r100-package.ts';
import {buildNativeSpatialGeometry,createNativeSpatialActualVoidFeedback,nativeVoidCellBoundary,nativePrimitiveTree,nativePrimitiveDistance,nativeCellPoint} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';
import {evaluateNativeSpatialVisibility} from '../../src/generation/world-study/native-spatial-visibility.ts';

const MAX_CANDIDATES=80,MAX_MS=90000,SEARCH_MS=83000,MAX_OFFSET=160,STEP=32,FINE_MAX_CANDIDATES=16;
const spatialReasons=new Set(['G1-largest-empty-radius','G1-long-deep-empty-region','G3-wide-domain-area','G3-wide-domain-connectivity']);
const sha=value=>createHash('sha256').update(value).digest('hex');
const snap=value=>Math.round(value/8)*8;
const stringify=rows=>columns.join(',')+'\n'+rows.map(row=>columns.map(column=>row[column]??'').join(',')).join('\n')+'\n';
const clone=rows=>rows.map(row=>({...row}));
const compare=(a,b)=>{for(let i=0;i<Math.max(a.length,b.length);i++){if(a[i]!==b[i])return(a[i]??0)-(b[i]??0);}return 0;};
const shiftRect=(text,dx,dy)=>text.split('|').map(rect=>{const[x,y,w,h]=rect.split(':').map(Number);return[x+dx,y+dy,w,h].join(':');}).join('|');
const bounds=rects=>({minX:Math.min(...rects.map(r=>r[0])),minY:Math.min(...rects.map(r=>r[1])),maxX:Math.max(...rects.map(r=>r[0]+r[2])),maxY:Math.max(...rects.map(r=>r[1]+r[3]))});
const deficits=(m,p)=>[Math.max(0,m.maxEmptyUpperPx/p.maxEmptyRadiusPx-1),Math.max(0,m.maxDeepSpanPx/p.maxDeepEmptySpanPx-1),Math.max(0,p.minWideRatio/Math.max(m.wideRatio,.0001)-1),Math.max(0,p.minLargestWideRatio/Math.max(m.largestWideRatio,.0001)-1)];
function score(gate,boundary,policy,mean=0){const d=deficits(gate.metrics,policy),hard=gate.reasons.filter(reason=>!spatialReasons.has(reason));return[hard.length+Number(!boundary.accepted),Math.max(...d),d.reduce((a,b)=>a+b,0),d.filter(v=>v>0).length,mean];}

/** Expand only original authoring values, never raster/compiled contours. */
function expand(receipt,layout,input){
  const original=receipt.reference.rows,metadata=Object.fromEntries(columns.slice(0,5).map(key=>[key,original[0][key]])),row=values=>({...Object.fromEntries(columns.map(c=>[c,''])),...metadata,...values});
  const translation=layout.constructionExtension?.translation??{x:0,y:0};
  const landIds=layout.plan.land.map((_,i)=>original.filter(r=>r.kind==='land')[i]?.id??`expanded-land-${i}`);
  const rows=layout.plan.land.map((r,i)=>row({kind:'land',id:landIds[i],profile_id:layout.plan.landPlates[i].role,x_px:r[0],y_px:r[1],width_px:r[2],height_px:r[3],parent_id:layout.plan.landPlates[i].parentIndex===null?'':landIds[layout.plan.landPlates[i].parentIndex]}));
  for(const source of original.filter(r=>r.kind==='assembly'))rows.push({...source,x_px:Number(source.x_px)+translation.x,y_px:Number(source.y_px)+translation.y});
  for(const object of layout.plan.objects.filter(o=>o.kind==='solid'&&!original.some(r=>r.kind==='assembly'&&r.id===o.assembly.assemblyId))){
    assert.equal(object.instances.length,1,'Only one-instance subordinate objects may be refined');
    const instance=object.instances[0],source=original.find(r=>r.id===object.assembly.assemblyId);
    const profile=source?input.subordinateProfiles.find(p=>p.id===source.profile_id):input.subordinateProfiles.find(p=>p.family===(instance.family??layout.definition.family)&&p.shapeProfile===instance.shapeProfile&&p.constructionVersion===instance.constructionVersion);
    assert(profile,`Missing profile for ${object.assembly.assemblyId}`);
    rows.push(row({kind:'solid',id:object.assembly.assemblyId,profile_id:profile.id,x_px:instance.x+object.site.x,y_px:instance.y+object.site.y,width_px:instance.width,height_px:instance.height,length_px:instance.length,rotation_rad:instance.rotation}));
  }
  for(const hole of layout.holes){const b=bounds(hole.rects);rows.push(row({kind:'hole',id:hole.holeId,profile_id:hole.profileId,x_px:snap((b.minX+b.maxX)/2),y_px:snap((b.minY+b.maxY)/2),rects:hole.rects.map(r=>r.join(':')).join('|')}));}
  for(const source of original.filter(r=>r.kind==='protect'))rows.push({...source,rects:shiftRect(source.rects,translation.x,translation.y)});
  const spawn=original.find(r=>r.kind==='spawn');rows.push({...spawn,x_px:Number(spawn.x_px)+translation.x,y_px:Number(spawn.y_px)+translation.y});
  return rows.map(r=>Object.fromEntries(columns.map(k=>[k,String(r[k]??'')])));
}
function compact(rows,input,mode){return rows.map(source=>{
  const r={...source};
  if(r.kind==='hole'&&mode!=='solids'){
    if(mode==='large'&&r.profile_id==='offset-cut-small')return r;
    const rects=r.rects.split('|').map(s=>s.split(':').map(Number)),b=bounds(rects),vertical=b.maxY-b.minY>b.maxX-b.minX;
    // The 120px profile has a half-cell centre. Preserve the nearest legal
    // authoring anchor (4px centre offset), never emit off-grid rectangles.
    const x=Number(r.x_px),y=Number(r.y_px),form=[[-56,-40,80,72],[16,-16,48,40],[-40,16,40,24]];
    r.rects=form.map(([a,b,w,h])=>vertical?[x-b-h,y+a,h,w]:[x+a,y+b,w,h]).map(v=>v.join(':')).join('|');r.profile_id='offset-cut-small';
  }
  if(r.kind==='solid'&&(mode==='solids'||mode==='both')){const p=input.subordinateProfiles.find(p=>p.id===r.profile_id);r.length_px=String(Math.max(p.minLengthPx,snap(Number(r.length_px)*.91)));r.width_px=String(Math.max(p.minWidthPx,snap(Number(r.width_px)*.9)));}
  return r;
});}

if(process.argv.includes('--self-test')){
  assert(compare([0,.2,.4],[1,0,0])<0);assert(compare([0,.2,.4],[0,.2,.5])<0);
  assert.equal(shiftRect('8:16:24:32|0:8:16:24',32,-8),'40:8:24:32|32:0:16:24');
  for(const rects of ['48:200:144:96|128:216:72:96','88:176:96:144|72:256:96:72']){
    const result=compact([{kind:'hole',profile_id:'offset-cut-medium',x_px:'128',y_px:'256',rects}],{},'large')[0];
    assert(result.rects.split('|').flatMap(rect=>rect.split(':').map(Number)).every(value=>value%8===0),'Compaction must preserve the 8px authoring grid in both orientations');
  }
  assert.equal(MAX_CANDIDATES,80);assert.equal(FINE_MAX_CANDIDATES,16);assert.equal(MAX_MS,90000);assert.equal(MAX_OFFSET,160);
  console.log('PASS: fixed bounds, structural-first score, atomic rectangle translation');
  process.exit(0);
}
const[receiptDirectory,shoreFile,output,...options]=process.argv.slice(2);
assert(receiptDirectory&&shoreFile&&output,'Usage: refine-approved-layout.mjs BASELINE_RECEIPT_DIRECTORY SHORE_CSV NEW_OUTPUT_DIRECTORY [--land-source CSV | --resume-reference COMPLETE_CSV --intent DERIVED_INTENT_JSON [--fine-step 8]] [--max-ms 10000..90000] [--max-compiles 1..80]');
let landSource,resumeReference,intentFile,fineStep,maxElapsedMs=MAX_MS,compileLimit=MAX_CANDIDATES;
for(let i=0;i<options.length;i+=2){
  assert(options[i+1],`Missing value for ${options[i]}`);
  if(options[i]==='--land-source')landSource=options[i+1];
  else if(options[i]==='--resume-reference')resumeReference=options[i+1];
  else if(options[i]==='--intent')intentFile=options[i+1];
  else if(options[i]==='--fine-step')fineStep=Number(options[i+1]);
  else if(options[i]==='--max-ms')maxElapsedMs=Number(options[i+1]);
  else if(options[i]==='--max-compiles')compileLimit=Number(options[i+1]);
  else assert.fail(`Unknown option ${options[i]}`);
}
assert.equal(Boolean(resumeReference),Boolean(intentFile),'A complete resume CSV and frozen derived intent must be supplied together');
if(fineStep!==undefined){assert.equal(fineStep,8,'Fine refinement uses exactly one 8px authoring step');assert(resumeReference,'Fine refinement requires an explicit complete resume source');}
assert(!(landSource&&resumeReference),'Resume cannot also replace the frozen macro land');
const candidateLimit=fineStep?FINE_MAX_CANDIDATES:MAX_CANDIDATES;
assert(Number.isInteger(maxElapsedMs)&&maxElapsedMs>=10000&&maxElapsedMs<=MAX_MS,'Elapsed cap must be between 10000 and 90000ms');
assert(Number.isInteger(compileLimit)&&compileLimit>=1&&compileLimit<=MAX_CANDIDATES,'Compile cap must be between 1 and 80');
const searchCutoffMs=Math.min(SEARCH_MS,maxElapsedMs-7000);
assert(!fs.existsSync(output),'Refinement never overwrites prior evidence');fs.mkdirSync(output,{recursive:true});
const sourceReceipt=JSON.parse(fs.readFileSync(path.join(receiptDirectory,'report.json'),'utf8'));
const sourceLayout=JSON.parse(fs.readFileSync(path.join(receiptDirectory,'layout.json'),'utf8'));
if(landSource){
  const csv=fs.readFileSync(landSource,'utf8'),override=parseNativeSpatialConstructionReference(csv,sha(csv)),translation=sourceLayout.constructionExtension?.translation??{x:0,y:0};
  assert.equal(override.worldId,sourceReceipt.reference.worldId);
  sourceReceipt.reference.rows.filter(r=>r.kind==='land').forEach((row,index)=>{const replacement=override.rows.find(r=>r.kind==='land'&&r.id===row.id);assert(replacement,`Missing fixed base land ${row.id}`);assert.equal(replacement.parent_id,row.parent_id);sourceLayout.plan.land[index]=[Number(replacement.x_px)+translation.x,Number(replacement.y_px)+translation.y,Number(replacement.width_px),Number(replacement.height_px)];});
}
const worldId=sourceReceipt.reference.worldId,seed=sourceReceipt.reference.seed;
assert.equal(seed,20261012);assert.equal(sourceReceipt.reference.grade,'medium');
const recipe=createR100NativeSpatialDevelopmentRecipe(worldId,seed,'medium');
const assessment=sourceLayout.assessmentInput??{world:recipe.nativeSpatial.world,policy:recipe.nativeSpatial.policy};
recipe.nativeSpatial={...recipe.nativeSpatial,world:{...assessment.world},policy:{...assessment.policy}};
const input=recipe.nativeSpatial;
if(intentFile){
  const intent=JSON.parse(fs.readFileSync(intentFile,'utf8'));
  assert.equal(intent.worldId,worldId);assert.equal(intent.appendExtension,false);
  for(const key of ['frameWidthPx','frameHeightPx','targetWalkAreaPx2']){assert(Number.isFinite(intent[key])&&intent[key]>0);input.world[key]=intent[key];}
  assert(Number.isFinite(intent.planningCellFactor)&&intent.planningCellFactor>0);input.policy.planningCellFactor=intent.planningCellFactor;
}
let original;
if(resumeReference){
  const csv=fs.readFileSync(resumeReference,'utf8'),reference=parseNativeSpatialConstructionReference(csv,sha(csv));
  assert.equal(reference.worldId,worldId);assert.equal(reference.seed,seed);assert.equal(reference.grade,'medium');
  original=reference.rows.map(row=>({...row}));
  sourceLayout.plan.land=original.filter(row=>row.kind==='land').map(row=>[Number(row.x_px),Number(row.y_px),Number(row.width_px),Number(row.height_px)]);
}else original=expand(sourceReceipt,sourceLayout,input);
const fixed=original.filter(r=>!['hole','solid'].includes(r.kind));
const initialCSV=stringify(original),shoreCSV=fs.readFileSync(shoreFile,'utf8'),shorePolicy=parseNativeConstructionShore(shoreCSV,sha(shoreCSV));
const derivedIntent={worldId,frameWidthPx:input.world.frameWidthPx,frameHeightPx:input.world.frameHeightPx,targetWalkAreaPx2:input.world.targetWalkAreaPx2,planningCellFactor:input.policy.planningCellFactor,appendExtension:false};
fs.writeFileSync(path.join(output,'expanded-reference.csv'),initialCSV);fs.writeFileSync(path.join(output,'shore.csv'),shoreCSV);fs.writeFileSync(path.join(output,'derived-intent.json'),JSON.stringify(derivedIntent,null,2)+'\n');
const start=performance.now(),expired=()=>performance.now()-start>=searchCutoffMs,seen=new Set(),records=[],states=[];
const anchors=new Map(original.filter(r=>['hole','solid'].includes(r.kind)).map(r=>[r.id,{x:Number(r.x_px),y:Number(r.y_px)}]));
let best,compiles=0,observer;
function evaluate(rows,cause){
  if(records.length>=candidateLimit||compiles>=compileLimit||expired())return;
  assert.deepEqual(rows.filter(r=>!['hole','solid'].includes(r.kind)),fixed,'Macro land, complete mother and spawn must remain frozen');
  const csv=stringify(rows),hash=sha(csv);if(seen.has(hash))return;seen.add(hash);
  const record={candidate:records.length,cause,sourceHash:hash};records.push(record);const began=performance.now();
  try{
    const reference=parseNativeSpatialConstructionReference(csv,hash),layout=constructNativeSpatialReference(recipe,reference,()=>compiles++,{policy:shorePolicy,combinedSourceHash:sha(hash+shorePolicy.sourceHash)});
    assert.equal(layout.constructionExtension,undefined,'Expanded authoring must not append another extension');
    assert.deepEqual(layout.plan.land,sourceLayout.plan.land,'Macro land rectangles changed');
    const geometry=buildNativeSpatialGeometry(layout.definition,seed),groups=identifyNativeSpatialStructures(geometry,layout.assemblies,input.policy);
    const gate=evaluateNativeSpatialGeometry(geometry,groups,input.policy,input.world,{placements:layout.holes,profiles:input.holeProfiles},{landRects:layout.plan.land,placements:layout.bays,landJoins:layout.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx},value=>{observer=value;});
    const diagnostic=observer,boundary=measureNativeConstructionBoundary(layout.definition.terrainOutline,shorePolicy.maxCleanRunPx);
    let total=0;for(let i=0;i<diagnostic.distances.length;i++)if(geometry.supported[i])total+=diagnostic.distances[i];
    const rank=score(gate,boundary,input.policy,total/geometry.supportedCount),state={rows,csv,hash,layout,geometry,groups,gate,diagnostic,boundary,rank,expanded:false,index:record.candidate};
    record.rank=rank;record.reasons=gate.reasons;record.boundary=boundary.accepted;record.metrics=Object.fromEntries(Object.entries(gate.metrics).filter(([,v])=>typeof v==='number'||v===null||['worstEmptyPoint','worstDeepPoint','worstDeepBounds'].includes(Object.entries(gate.metrics).find(([,w])=>w===v)?.[0])));
    states.push(state);if(!best||compare(rank,best.rank)<0)best=state;
    console.log(JSON.stringify({worldId,candidate:record.candidate,cause,rank,max:gate.metrics.maxEmptyUpperPx,deep:gate.metrics.maxDeepSpanPx,wide:gate.metrics.wideRatio,reasons:gate.reasons}));
    return state;
  }catch(error){record.error=String(error.stack??error);record.rank=[999,Infinity,Infinity];}
  finally{record.elapsedMs=performance.now()-began;}
}

/** Predictor uses this candidate's actual H/S boundaries and actual exterior.
 * Fixed 32px proposal grid, +/-160px from original anchors. Real gates follow. */
function proposals(state){
  const feedback=createNativeSpatialActualVoidFeedback(state.geometry,state.groups,state.layout.holes).feedback;if(!feedback)return[];
  const g=state.geometry,{cols,rows}=g.terrain,gridCols=Math.ceil(cols/4),gridRows=Math.ceil(rows/4),count=gridCols*gridRows;
  const exterior=[];for(let i=0;i<feedback.exteriorMask.length;i++)if(feedback.exteriorMask[i])exterior.push(i);
  const coastTree=nativePrimitiveTree(nativeVoidCellBoundary(exterior,cols,rows,-1)),coast=new Float32Array(count);
  const structures=state.groups.structures,distances=structures.map(()=>new Float32Array(count)),rowGroups=new Map();
  for(const row of state.rows.filter(r=>['hole','solid'].includes(r.kind))){
    let group;
    if(row.kind==='solid')group=structures.findIndex(s=>s.kind==='solid'&&s.assemblyIds.includes(row.id));
    else{const h=feedback.holes.find(h=>h.holeId===row.id);group=h?structures.findIndex(s=>s.kind==='hole'&&s.cells.includes(h.cells[0])):-1;}
    if(group>=0)rowGroups.set(row.id,group);
  }
  for(let y=0;y<gridRows;y++)for(let x=0;x<gridCols;x++){
    const p={x:x*STEP+4,y:y*STEP+4},i=y*gridCols+x,cell=Math.min(rows-1,y*4)*cols+Math.min(cols-1,x*4);
    coast[i]=feedback.exteriorMask[cell]?0:nativePrimitiveDistance(coastTree,p.x,p.y);
    for(let s=0;s<structures.length;s++)distances[s][i]=structures[s].kind==='hole'&&state.groups.holeLabelByCell[cell]===state.groups.holeLabelByCell[structures[s].cells[0]]?0:structures[s].distance(p);
  }
  const deep=new Uint8Array(count),marked=new Uint8Array(count),queue=new Int32Array(count);
  function prediction(entries){
    let body=0,wide=0,max=0,total=0;deep.fill(0);marked.fill(0);
    const shifts=new Map(entries.map(e=>[rowGroups.get(e.id),{dx:e.dx/STEP,dy:e.dy/STEP}]));
    for(let y=0;y<gridRows;y++)for(let x=0;x<gridCols;x++){
      const i=y*gridCols+x;if(coast[i]<14)continue;let d=Infinity;
      for(let s=0;s<distances.length;s++){const shift=shifts.get(s);if(!shift)d=Math.min(d,distances[s][i]);else{const xx=x-shift.dx,yy=y-shift.dy;if(xx>=0&&yy>=0&&xx<gridCols&&yy<gridRows)d=Math.min(d,distances[s][yy*gridCols+xx]);}}
      if(d<14)continue;body++;total+=d;const open=Math.min(coast[i],d);max=Math.max(max,open+4*Math.SQRT2);if(open>=input.policy.wideRadiusPx)wide++;deep[i]=Number(d>118);
    }
    let span=0;
    for(let i=0;i<count;i++)if(deep[i]&&!marked[i]){let head=0,tail=1,minX=i%gridCols,maxX=minX,minY=Math.floor(i/gridCols),maxY=minY;queue[0]=i;marked[i]=1;
      while(head<tail){const cell=queue[head++],x=cell%gridCols,y=Math.floor(cell/gridCols);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        for(let yy=Math.max(0,y-1);yy<=Math.min(gridRows-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(gridCols-1,x+1);xx++){const n=yy*gridCols+xx;if(deep[n]&&!marked[n]){marked[n]=1;queue[tail++]=n;}}}
      span=Math.max(span,(maxX-minX+1)*STEP,(maxY-minY+1)*STEP);
    }
    return{maxEmptyUpperPx:max,maxDeepSpanPx:span,wideRatio:wide/Math.max(1,body),mean:total/Math.max(1,body)};
  }
  const current=prediction([]),m=state.gate.metrics,proposalMap=new Map();
  const rank=entries=>{const p=prediction(entries),predicted={...m,maxEmptyUpperPx:Math.max(0,m.maxEmptyUpperPx+p.maxEmptyUpperPx-current.maxEmptyUpperPx),maxDeepSpanPx:Math.max(0,m.maxDeepSpanPx+p.maxDeepSpanPx-current.maxDeepSpanPx),wideRatio:Math.max(.001,m.wideRatio+p.wideRatio-current.wideRatio)};const d=deficits(predicted,input.policy);return[Math.max(...d),d.reduce((a,b)=>a+b,0),p.mean];};
  function add(entries){
    if(expired())return;
    const normalized=entries.filter(e=>e.dx||e.dy).sort((a,b)=>a.id.localeCompare(b.id));if(!normalized.length||new Set(normalized.map(e=>e.id)).size!==normalized.length)return;
    for(const e of normalized){const row=state.rows.find(r=>r.id===e.id),anchor=anchors.get(e.id);if(!rowGroups.has(e.id)||Math.abs(Number(row.x_px)+e.dx-anchor.x)>MAX_OFFSET||Math.abs(Number(row.y_px)+e.dy-anchor.y)>MAX_OFFSET)return;}
    const key=JSON.stringify(normalized);if(proposalMap.has(key))return;proposalMap.set(key,{entries:normalized,rank:rank(normalized)});
  }
  const witness=[m.worstEmptyPoint,m.worstDeepPoint,m.internalWorstEmptyPoint].filter(Boolean);
  for(const component of state.diagnostic.deepComponents.map(cells=>{const points=cells.map(c=>nativeCellPoint(c,cols));return{minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};}).sort((a,b)=>Math.max(b.maxX-b.minX,b.maxY-b.minY)-Math.max(a.maxX-a.minX,a.maxY-a.minY)).slice(0,2)){
    for(const t of [.25,.5,.75])witness.push({x:component.minX+(component.maxX-component.minX)*t,y:component.minY+(component.maxY-component.minY)*t});
  }
  const movable=state.rows.filter(r=>rowGroups.has(r.id));
  for(const p of witness){
    const nearest=movable.map(r=>({r,d:structures[rowGroups.get(r.id)].distance(p)})).sort((a,b)=>a.d-b.d).slice(0,3);
    for(const {r}of nearest){const dx=p.x-Number(r.x_px),dy=p.y-Number(r.y_px),length=Math.hypot(dx,dy)||1;for(const step of [32,64,96,128,160])add([{id:r.id,dx:Math.round(dx/length*step/STEP)*STEP,dy:Math.round(dy/length*step/STEP)*STEP}]);}
  }
  // Orthogonal release proposals can widen a crowded passage while a second
  // object covers the vacated responsibility; no random direction sampling.
  for(const r of movable)for(const [dx,dy]of [[32,0],[-32,0],[0,32],[0,-32]])add([{id:r.id,dx,dy}]);
  const singles=[...proposalMap.values()].sort((a,b)=>compare(a.rank,b.rank)).slice(0,12);
  for(let i=0;i<singles.length;i++)for(let j=i+1;j<singles.length;j++)if(singles[i].entries[0].id!==singles[j].entries[0].id)add([...singles[i].entries,...singles[j].entries]);
  const ranked=[...proposalMap.values()].sort((a,b)=>compare(a.rank,b.rank));
  return [...ranked.filter(p=>p.entries.length===2).slice(0,6),...ranked.filter(p=>p.entries.length===1).slice(0,6)].sort((a,b)=>compare(a.rank,b.rank));
}

/** Fixed local proposals never accumulate: each changes one field or translates
 * one whole object by 8px from the explicit warm source. Smaller S are tried
 * away from the actual G1 witnesses first, preserving their coverage margin. */
function fineProposals(state){
  const witnesses=[state.gate.metrics.worstEmptyPoint,state.gate.metrics.worstDeepPoint].filter(Boolean);
  const distance=row=>Math.min(...witnesses.map(p=>Math.hypot(Number(row.x_px)-p.x,Number(row.y_px)-p.y)));
  const ordered=state.rows.filter(row=>['solid','hole'].includes(row.kind)).sort((a,b)=>distance(b)-distance(a)||a.id.localeCompare(b.id));
  const result=[];
  for(const row of ordered.filter(row=>row.kind==='solid')){
    const profile=input.subordinateProfiles.find(profile=>profile.id===row.profile_id);
    for(const [field,min]of [['width_px',profile.minWidthPx],['length_px',profile.minLengthPx]]){
      const value=Number(row[field])-fineStep;if(value<min)continue;
      const rows=clone(state.rows);rows.find(r=>r.id===row.id)[field]=String(value);
      result.push({rows,cause:{parent:state.index,id:row.id,field,delta:-fineStep}});
    }
  }
  for(const row of ordered)for(const [dx,dy]of [[fineStep,0],[-fineStep,0],[0,fineStep],[0,-fineStep]]){
    const rows=clone(state.rows),target=rows.find(r=>r.id===row.id);
    target.x_px=String(Number(target.x_px)+dx);target.y_px=String(Number(target.y_px)+dy);
    if(target.kind==='hole')target.rects=shiftRect(target.rects,dx,dy);
    result.push({rows,cause:{parent:state.index,id:row.id,dx,dy}});
  }
  return result;
}

const initial=evaluate(original,resumeReference?'explicit-complete-warm-source':'expanded-approved-authoring');
if(fineStep){
  assert(initial,'Warm source must construct successfully');
  for(const proposal of fineProposals(initial)){
    if(records.length>=candidateLimit||compiles>=compileLimit||expired()||best?.gate.accepted&&best.boundary.accepted)break;
    evaluate(proposal.rows,proposal.cause);
  }
}else for(const mode of ['holes','solids','both','large'])evaluate(compact(original,input,mode),`fixed-compact-${mode}`);
while(!fineStep&&records.length<candidateLimit&&compiles<compileLimit&&!expired()&&!best?.gate.accepted){
  const available=states.filter(s=>!s.expanded).sort((a,b)=>compare(a.rank,b.rank));if(!available.length)break;
  const state=available[0];state.expanded=true;
  // A warm source can retain several large H that global compaction could not
  // admit. Release one at a time, retaining exact macro and other H/S sources.
  if(resumeReference)for(const row of state.rows.filter(row=>row.kind==='hole'&&row.profile_id!=='offset-cut-small')){
    const replacement=compact([row],input,'large')[0];
    evaluate(state.rows.map(source=>source.id===row.id?replacement:{...source}),{parent:state.index,compactHole:row.id});
    if(records.length>=candidateLimit||compiles>=compileLimit||expired()||best?.gate.accepted)break;
  }
  if(records.length>=candidateLimit||compiles>=compileLimit||expired()||best?.gate.accepted)break;
  const candidates=proposals(state);
  for(const proposal of candidates){
    const rows=clone(state.rows);for(const entry of proposal.entries){const row=rows.find(r=>r.id===entry.id);row.x_px=String(Number(row.x_px)+entry.dx);row.y_px=String(Number(row.y_px)+entry.dy);if(row.kind==='hole')row.rects=shiftRect(row.rects,entry.dx,entry.dy);}
    evaluate(rows,{parent:state.index,entries:proposal.entries,predicted:proposal.rank});
    if(records.length>=candidateLimit||compiles>=compileLimit||expired()||best?.gate.accepted)break;
  }
  // Retain at most six unexpanded actual candidates. Keep independent best
  // width and deep states to avoid discarding the useful joint trade-off.
  const pending=states.filter(s=>!s.expanded).sort((a,b)=>compare(a.rank,b.rank)),keep=new Set(pending.slice(0,4));
  if(pending.length){keep.add([...pending].sort((a,b)=>b.gate.metrics.wideRatio-a.gate.metrics.wideRatio)[0]);keep.add([...pending].sort((a,b)=>a.gate.metrics.maxDeepSpanPx-b.gate.metrics.maxDeepSpanPx)[0]);}
  for(const s of pending)if(!keep.has(s))s.expanded=true;
}
assert(best,'No valid geometry was constructed');
const visibility=evaluateNativeSpatialVisibility(best.geometry,best.groups.structures,input.policy),elapsedMs=performance.now()-start;
const report={status:best.gate.accepted&&best.boundary.accepted&&visibility.accepted?'passed-geometry-only':'rejected',scope:'One bounded offline refinement; frozen approved macro L and complete mother; shared shore re-evaluated; no appended extension, production search, content deployment, or acceptance relaxation.',worldId,seed,sourceReceipt:receiptDirectory,landSource:landSource??null,resumeReference:resumeReference??null,intentFile:intentFile??null,derivedIntent,limits:{maxCandidates:candidateLimit,maxFragmentCompiles:compileLimit,maxElapsedMs,searchCutoffMs,maxAnchorOffsetPx:fineStep??MAX_OFFSET,proposalGridPx:fineStep??STEP},counts:{candidates:records.length,fragmentCompiles:compiles,visibilityEvaluations:1,fullCandidates:0},elapsedMs,budgetExceeded:elapsedMs>maxElapsedMs,chosenCandidate:best.index,rank:best.rank,reference:parseNativeSpatialConstructionReference(best.csv,best.hash),gates:{geometry:best.gate,visibility},boundary:best.boundary,records};
if(report.budgetExceeded)report.status='budget-exceeded';
fs.writeFileSync(path.join(output,'best-reference.csv'),best.csv);fs.writeFileSync(path.join(output,'best-layout.json'),JSON.stringify(best.layout,null,2)+'\n');
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const store=(name,value)=>fs.writeFileSync(path.join(output,name),gzipSync(serialize(value)));
const t=best.geometry.terrain;store('geometry.v8.gz',{layout:best.layout,terrain:{cols:t.cols,rows:t.rows,width:t.width,height:t.height,matter:t.matter,definition:t.definition,spawnPoint:t.spawnPoint},supported:best.geometry.supported,reachable:best.geometry.reachable,links8:best.geometry.links8,solidPrimitives:best.geometry.solidPrimitives});store('geometry-diagnostic.v8.gz',best.diagnostic);
console.log(JSON.stringify({status:report.status,worldId,counts:report.counts,elapsedMs,chosenCandidate:best.index,rank:best.rank,geometryReasons:best.gate.reasons,visibilityReasons:visibility.reasons,output}));
if(report.status!=='passed-geometry-only')process.exitCode=1;
