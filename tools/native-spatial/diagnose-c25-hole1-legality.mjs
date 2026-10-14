/** Saved sites only: no layout call, random stream, contour or map compilation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {nativePrimitiveTree,nativePrimitiveDistance} from '../../src/generation/world-study/native-spatial-geometry.ts';

const root='docs/qa/artifacts/native-spatial-2026-10-14/',savedPath=root+'incumbent-c25-replay/candidate-25.json',auditPath=root+'incumbent-c25-existing-sites/report.json',tool='tools/native-spatial/diagnose-c25-hole1-legality.mjs',out=process.argv[2];
assert(out&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const formalPath=root+'production-gel-incumbent-round1.json',formal=JSON.parse(fs.readFileSync(formalPath)),geometrySeed=formal.failures[0].diagnostics.attempts[0].candidates.find(c=>c.candidate===25).geometrySeed;
assert(Number.isSafeInteger(geometrySeed));
const saved=JSON.parse(fs.readFileSync(savedPath)),audit=JSON.parse(fs.readFileSync(auditPath)),holeAudit=audit.objects.find(o=>o.id==='hole-1');
assert.equal(holeAudit.sequenceIndex,0);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
const snapshot=()=>Object.fromEntries([...walk('src').filter(p=>/\.(?:[cm]?[jt]sx?|json)$/.test(p)),...walk('data').filter(p=>p.endsWith('.csv')),savedPath,auditPath,formalPath,tool].sort().map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const start=performance.now(),checkpoint=()=>{if(performance.now()-start>=60000)throw Error('Read-only diagnosis 60s limit');},report={scope:'All original hole-1 local 16/32/64 sites, saved c25 footprints and support only. No new sites or candidate execution.',sourceHashes:snapshot(),status:'running',sites:[]};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
try{
  for(const [file,hash]of Object.entries(audit.sourceHashes))if(file.startsWith('src/')||file.startsWith('data/'))assert.equal(report.sourceHashes[file],hash,`Source mismatch ${file}`);
  const sourcePath='src/generation/world-study/native-spatial-layout.ts',groundPath=path.resolve('src/generation/world-study/native-spatial-bay-layout.ts');
  // Read-only exports expose existing pure footprint functions. The ground
  // observer exposes its existing exact raw L-B segments, without changing it.
  const code=fs.readFileSync(sourcePath,'utf8')+'\nexport {planningObject,shifted,pointCloud,createNativeSpatialPlanningGround};\n';
  const bundle=await build({stdin:{contents:code,loader:'ts',resolveDir:path.resolve('src/generation/world-study')},bundle:true,write:false,platform:'node',format:'esm',tsconfig:'tsconfig.json',plugins:[{name:'read-ground-segments',setup(build){build.onLoad({filter:/native-spatial-bay-layout\.ts$/},args=>{assert.equal(args.path,groundPath);let contents=fs.readFileSync(args.path,'utf8');const from='return{contains,margin:p=>contains(p)?nativePrimitiveDistance(tree,p.x,p.y):-1,supportsFootprint};';assert.equal(contents.split(from).length,2);contents=contents.replace(from,'return{contains,margin:p=>contains(p)?nativePrimitiveDistance(tree,p.x,p.y):-1,supportsFootprint,diagnosticSegments:segments};');return{contents,loader:'ts'};});}}]});
  const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const objects=saved.proposal.plan.objects.map(source=>m.planningObject(source,saved.proposal.definition,geometrySeed));
  let holeIndex=0;const ids=objects.map(o=>o.source.kind==='hole'?`hole-${holeIndex++}`:o.source.assembly.assemblyId),index=ids.indexOf('hole-1'),object=objects[index],others=objects.filter((_,i)=>i!==index);
  assert.equal(index,holeAudit.objectIndex);assert.deepEqual(object.source.site,holeAudit.incumbent);
  for(const other of holeAudit.others){const o=objects[ids.indexOf(other.id)];assert.deepEqual(o.source.site,other.site);}
  const ground=m.createNativeSpatialPlanningGround(saved.proposal.plan.land,saved.proposal.bays.flatMap(b=>b.rects)),coastTree=nativePrimitiveTree(ground.diagnosticSegments);
  const groups=others.map(o=>{const reliefIds=new Set(o.source.instances.filter(i=>i.role==='relief').map(i=>i.id)),at=objects.indexOf(o);return{id:ids[at],kind:o.source.kind,blocking:m.shifted(o.blocking,o.source.site.x,o.source.site.y),relief:m.shifted(o.support.filter(p=>reliefIds.has(p.objectId)),o.source.site.x,o.source.site.y)};});
  const blocking=groups.flatMap(g=>g.blocking),relief=groups.flatMap(g=>g.relief),holes=groups.filter(g=>g.kind==='hole').flatMap(g=>g.blocking),forbiddenTree=nativePrimitiveTree(blocking),reliefTree=nativePrimitiveTree(relief),holesTree=nativePrimitiveTree(holes),support=m.pointCloud(object.support),body=m.pointCloud(object.blocking),blockingPoints=m.pointCloud(blocking),reliefPoints=m.pointCloud(relief),gap=saved.input.policy.wideRadiusPx*1.5,worst=saved.gate.metrics.worstEmptyPoint;
  const coordinate=(primitive,p,d)=>{if(d===0)return{...p};let nearest,minimum=Infinity;const points=primitive.points,n=points.length/2;for(let i=0;i<(n===2?1:n);i++){const j=(i+1)%n,ax=points[i*2],ay=points[i*2+1],dx=points[j*2]-ax,dy=points[j*2+1]-ay,t=Math.max(0,Math.min(1,((p.x-ax)*dx+(p.y-ay)*dy)/(dx*dx+dy*dy||1))),q={x:ax+t*dx,y:ay+t*dy},distance=Math.hypot(q.x-p.x,q.y-p.y);if(distance<minimum){minimum=distance;nearest=q;}}return nearest;};
  const nearest=(primitives,p)=>{let result={distance:Infinity};for(const primitive of primitives){const d=nativePrimitiveDistance(nativePrimitiveTree([primitive]),p.x,p.y);if(d<result.distance)result={distance:d,instanceId:primitive.objectId,coordinate:coordinate(primitive,p,d),primitive:primitive.points};}return result;};
  const nearestGroup=(kind,p)=>{let result={distance:Infinity};for(const g of groups){if(kind==='holes'&&g.kind!=='hole')continue;const n=nearest(kind==='relief'?g.relief:g.blocking,p);if(n.distance<result.distance)result={id:g.id,kind:g.kind,...n};}return result;};
  const local=holeAudit.candidates.filter(c=>c.source==='local-16-32-64');assert.equal(local.length,24);
  for(const original of local){
    checkpoint();const p=original.site,shifted=m.shifted(object.blocking,p.x,p.y),shiftedTree=nativePrimitiveTree(shifted),all=[],checks=[];
    const record=(stage,reason,point,threshold,distance,nearestInfo)=>{const entry={stage,reason,point,threshold,distance,...(nearestInfo?{nearest:nearestInfo}:{})};all.push(entry);};
    const originMargin=ground.margin(p);if(originMargin<24)record(0,'origin-shore-margin',p,24,originMargin,nearest(ground.diagnosticSegments,p));
    for(const q of support){const point={x:p.x+q.x,y:p.y+q.y},margin=ground.margin(point),holeDistance=nativePrimitiveDistance(holesTree,point.x,point.y);if(margin<24)record(1,'support-vertex-shore-margin',point,24,margin,nearest(ground.diagnosticSegments,point));if(holeDistance<24)record(1,'support-vertex-to-hole',point,24,holeDistance,nearestGroup('holes',point));}
    const footprintSupported=ground.supportsFootprint(object.support,p);if(!footprintSupported)record(2,'complete-support-crosses-raw-L-minus-B',p,0,0);
    for(const q of body){const point={x:p.x+q.x,y:p.y+q.y},distance=nativePrimitiveDistance(forbiddenTree,point.x,point.y),reliefDistance=nativePrimitiveDistance(reliefTree,point.x,point.y);if(distance<gap)record(3,'moving-body-to-blocking',point,gap,distance,nearestGroup('blocking',point));if(reliefDistance<24)record(3,'moving-body-to-attached-relief',point,24,reliefDistance,nearestGroup('relief',point));}
    for(const point of blockingPoints){const distance=nativePrimitiveDistance(shiftedTree,point.x,point.y);if(distance<gap)record(4,'stationary-blocking-to-moving-body',point,gap,distance,{...nearestGroup('blocking',point),movingBoundary:nearest(shifted,point)});}
    for(const point of reliefPoints){const distance=nativePrimitiveDistance(shiftedTree,point.x,point.y);if(distance<24)record(5,'stationary-relief-to-moving-body',point,24,distance,{...nearestGroup('relief',point),movingBoundary:nearest(shifted,point)});}
    const bodyAt=body.map(q=>({x:p.x+q.x,y:p.y+q.y}));
    for(const g of groups){const bp=m.pointCloud(g.blocking),rp=m.pointCloud(g.relief),bt=nativePrimitiveTree(g.blocking),rt=nativePrimitiveTree(g.relief);checks.push({id:g.id,kind:g.kind,blockingMin:Math.min(...bodyAt.map(q=>nativePrimitiveDistance(bt,q.x,q.y)),...bp.map(q=>nativePrimitiveDistance(shiftedTree,q.x,q.y))),reliefMin:g.relief.length?Math.min(...bodyAt.map(q=>nativePrimitiveDistance(rt,q.x,q.y)),...rp.map(q=>nativePrimitiveDistance(shiftedTree,q.x,q.y))):null});}
    assert.equal(all.length===0,original.legal,`Saved legality differs at ordinal ${original.ordinal}`);
    const dx=p.x-object.source.site.x,dy=p.y-object.source.site.y;
    report.sites.push({ordinal:original.ordinal,roughRank:original.roughRank,site:p,delta:{x:dx,y:dy},towardWorst:dx*(worst.x-object.source.site.x)+dy*(worst.y-object.source.site.y)>0,closerToWorst:Math.hypot(p.x-worst.x,p.y-worst.y)<Math.hypot(object.source.site.x-worst.x,object.source.site.y-worst.y),legal:all.length===0,firstRejection:all[0]??null,rejectionKinds:[...new Set(all.map(r=>r.reason))],allRejections:all,originMargin,minSupportShoreMargin:Math.min(...support.map(q=>ground.margin({x:p.x+q.x,y:p.y+q.y}))),footprintSupported,structureDistances:checks.sort((a,b)=>Math.min(a.blockingMin,a.reliefMin??Infinity)-Math.min(b.blockingMin,b.reliefMin??Infinity))});
    save();
  }
  report.status='saved-site-legality-complete';report.worst=worst;report.incumbent=object.source.site;report.geometrySeed=geometrySeed;report.summary=report.sites.filter(s=>!s.legal).map(s=>({ordinal:s.ordinal,site:s.site,towardWorst:s.towardWorst,first:s.firstRejection,allKinds:s.rejectionKinds,nearestStructures:s.structureDistances.slice(0,3)}));
}catch(error){report.status='failed-no-retry';report.error={message:error.message,stack:error.stack};process.exitCode=1;}
finally{report.elapsedMs=performance.now()-start;report.sourceHashesAfter=snapshot();report.sourcesStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.sourceHashesAfter);if(!report.sourcesStable)process.exitCode=1;save();console.log(JSON.stringify({status:report.status,sourcesStable:report.sourcesStable,elapsedMs:report.elapsedMs,error:report.error,summary:report.summary},null,2));}
