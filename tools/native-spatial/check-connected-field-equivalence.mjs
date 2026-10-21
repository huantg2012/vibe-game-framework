/** Reconstruct a saved automatic proposal's masks without running placement. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {nativeConstructionFootprints} from '../../src/generation/world-study/native-spatial-construction-shore.ts';
import {nativeAutoHole} from '../../src/generation/world-study/native-auto-layout.ts';
import {nativeAutoCompiledField,nativeAutoCompileHole,nativeAutoPolygonRects} from '../../src/generation/world-study/native-auto-shape.ts';
import {createNativeAutoTraversalTemplate} from '../../src/generation/world-study/native-auto-traversal.ts';
import {buildNativeSpatialGeometry,nativePrimitive,nativePrimitiveTree,nativePrimitiveDistance,NATIVE_SPATIAL_DIRECTIONS} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {mix32} from '../../src/generation/seed-fork.ts';

const [file,output]=process.argv.slice(2);assert(file&&output&&!fs.existsSync(output),'Pass saved candidate JSON and NEW_REPORT.json');
const bytes=fs.readFileSync(file),saved=JSON.parse((bytes[0]===0x1f&&bytes[1]===0x8b?gunzipSync(bytes):bytes).toString('utf8')),{recipe,layout}=saved,{definition}=layout,input=recipe.nativeAuto,seed=layout.layoutSeed;
const files=['native-auto-layout','native-auto-shape','native-auto-traversal','native-body-collision','native-spatial-geometry','native-auto-refinement'].map(name=>`src/generation/world-study/${name}.ts`);
const hashes=()=>Object.fromEntries(files.map(name=>[name,createHash('sha256').update(fs.readFileSync(name)).digest('hex')])),before=hashes();
assert.deepEqual(nativeAutoPolygonRects([{x:-24,y:-24},{x:8,y:-24},{x:8,y:8},{x:-24,y:8}]),[-24,-16,-8,0].map(y=>[-24,y,32,8]),'Negative local x coordinates are occupied cells, not an empty-run sentinel');
const outer=nativeAutoCompiledField([...layout.plan.land,...layout.constructionShore.additions],[],layout.constructionShore.cuts,[],[definition.cols*32,definition.rows*32],seed,input.policy.sourceHash);
assert.deepEqual(outer.terrainOutline,definition.terrainOutline,'Final definition retains the compiled outer contour');
const templates=[],distance=[];
for(const object of layout.plan.objects.filter(object=>object.kind==='solid')){
  const footprint=nativeConstructionFootprints(object.instances,definition.family,seed),tree=nativePrimitiveTree(footprint.solidPrimitives);
  const template=createNativeAutoTraversalTemplate(footprint.solidPrimitives),site=object.site;
  templates.push({template,site});distance.push(point=>nativePrimitiveDistance(tree,point.x-site.x,point.y-site.y));
}
for(let index=0;index<layout.holes.length;index++){
  const raw=nativeAutoHole(index,seed,input.nativeSpatial.holeProfiles),placed=layout.holes[index];
  const site={x:placed.rects[0][0]-raw.rects[0][0],y:placed.rects[0][1]-raw.rects[0][1]};
  assert.deepEqual(placed.rects,raw.rects.map(([x,y,w,h])=>[x+site.x,y+site.y,w,h]));
  const polygon=nativeAutoCompileHole(raw.rects,mix32(seed,`auto-hole-edge:${index}`),input.policy.sourceHash);
  assert.deepEqual(definition.erosion[index],polygon.map(point=>({x:point.x+site.x,y:point.y+site.y})),'Final hole is a translation of the frozen local contour');
  const rects=nativeAutoPolygonRects(polygon),template=createNativeAutoTraversalTemplate(rects.map(([x,y,w,h])=>nativePrimitive([x,y,x+w,y,x+w,y+h,x,y+h],-1)));
  templates.push({template,site});distance.push(point=>Math.min(...rects.map(([x,y,w,h])=>Math.hypot(Math.max(x-(point.x-site.x),0,point.x-site.x-x-w),Math.max(y-(point.y-site.y),0,point.y-site.y-y-h)))));
}
const actual=buildNativeSpatialGeometry(definition,seed),{cols,rows}=actual.terrain,count=cols*rows,predicted=new Uint8Array(count),links=new Uint8Array(count);
const supportMismatches=[],edgeMismatches=[],wideMismatches=[];let bodyCount=0,wideCount=0,actualWideCount=0,edges=0;
for(let cell=0;cell<count;cell++){
  const point={x:(cell%cols+.5)*8,y:(Math.floor(cell/cols)+.5)*8};
  const supported=outer.ground.supportsBody(point)&&templates.every(({template,site})=>template.supported(point.x-site.x,point.y-site.y));
  predicted[cell]=Number(supported);bodyCount+=Number(supported);
  if(predicted[cell]!==actual.supported[cell]&&supportMismatches.length<12)supportMismatches.push({point,predicted:predicted[cell],actual:actual.supported[cell]});
  const actualOpen=actual.supported[cell]?Math.min(actual.solidDistance(point),actual.voidDistance(point)):0;
  const actualWide=actual.supported[cell]!==0&&actualOpen>=input.nativeSpatial.policy.wideRadiusPx;
  actualWideCount+=Number(actualWide);
  if(!supported)continue;
  links[cell]=templates.reduce((mask,{template,site})=>mask&template.links(point.x-site.x,point.y-site.y),outer.ground.links(point));
  const plannedOpen=Math.min(outer.ground.margin(point),...distance.map(get=>get(point)));
  const plannedWide=plannedOpen>=input.nativeSpatial.policy.wideRadiusPx;
  wideCount+=Number(plannedWide);
  if(plannedWide!==actualWide&&wideMismatches.length<12)wideMismatches.push({point,plannedOpen,actualOpen});
}
for(let cell=0;cell<count;cell++)if(predicted[cell]){
  let effective=0;
  for(let direction=0;direction<8;direction++){
    const [dx,dy]=NATIVE_SPATIAL_DIRECTIONS[direction],x=cell%cols+dx,y=Math.floor(cell/cols)+dy;
    if(x>=0&&x<cols&&y>=0&&y<rows&&predicted[y*cols+x]&&(links[cell]&(1<<direction)))effective|=1<<direction;
  }
  edges+=8;
  if(effective!==actual.links8[cell]&&edgeMismatches.length<12)edgeMismatches.push({cell,predicted:effective,actual:actual.links8[cell]});
}
const after=hashes(),stable=JSON.stringify(before)===JSON.stringify(after),report={status:!supportMismatches.length&&!edgeMismatches.length&&stable?'passed':'failed',createdAt:new Date().toISOString(),fixture:file,fixtureSha256:createHash('sha256').update(bytes).digest('hex'),sourceHashes:before,sourceHashesAfter:after,sourcesStable:stable,cells:count,predictedSupported:bodyCount,actualSupported:actual.supportedCount,edges,supportMismatches,edgeMismatches,wide:{reconstructed:wideCount/bodyCount,actual:actualWideCount/actual.supportedCount,recordedPlanner:saved.trace.gates.geometry.metrics.automaticPlanning.refinement.after.wideRatio,wideMismatches},limitations:['Reuses one saved definition. No map placement, content deployment, browser, or gameplay executed.','recordedPlanner is the historical saved attempt; reconstructed is the current-source measurement.']};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(report.status!=='passed')process.exitCode=1;
