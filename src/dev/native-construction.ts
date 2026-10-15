/** Three fixed CSV references. This diagnostic entry never searches for a
 * production candidate or deploys gameplay content. View changes use caches. */
import {R100_NATIVE_WORLDS} from '@/generated/r100-native-worlds';
import {createR100NativeSpatialDevelopmentRecipe} from '@/generation/world-study/r100-package';
import {constructNativeSpatialReference,parseNativeSpatialConstructionReference} from '@/generation/world-study/native-spatial-construction-reference';
import {parseNativeConstructionShore,measureNativeConstructionBoundary} from '@/generation/world-study/native-spatial-construction-shore';
import {measureNativeConstructionMacro,parseNativeConstructionMacroPolicy,type NativeConstructionMacroMetrics,type NativeConstructionMacroPolicy} from '@/generation/world-study/native-spatial-construction-macro';
import {parseNativeConstructionExtensionPolicy} from '@/generation/world-study/native-spatial-construction-extension';
import extensionModuleSource from '@/generation/world-study/native-spatial-construction-extension.ts?raw';
import {buildNativeSpatialGeometry,nativeSolidPrimitives,type NativeSpatialGeometry} from '@/generation/world-study/native-spatial-geometry';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '@/generation/world-study/native-spatial-measure';
import {evaluateNativeSpatialVisibility} from '@/generation/world-study/native-spatial-visibility';
import {compileNativeTerrain} from '@/generation/world-study/native-terrain';
import {compileNativeVolumeRaster,NativeVolumeLighting} from '@/generation/world-study/native-volume-raster';
import {paintMasterGround} from '@/systems/r100-world/ground';
import {bakeMasterSurface,masterVolumePalette} from '@/systems/r100-world/surface-bake';
import {MasterSurfaceRenderer} from '@/systems/r100-world/surface-renderer';
import {loadPaintedMaterial,type PaintedMaterial} from '@/systems/r100-world/painted-material';
import type {MasterSurfaceWorld} from '@/systems/r100-world/surface-world';

if(!import.meta.env.DEV)throw new Error('Native construction review is development-only');
const samples=[
  {id:'split-rib-causeway',reference:'/data/rift-native-construction-reference.csv',shore:'/data/rift-native-construction-shore.csv'},
  {id:'gel-rafts',reference:'/data/rift-native-construction-gel-rafts.csv',shore:'/data/rift-native-construction-gel-rafts-shore.csv'},
  {id:'ash-strata',reference:'/data/rift-native-construction-ash-strata.csv',shore:'/data/rift-native-construction-ash-strata-shore.csv'},
] as const;
type Sample=typeof samples[number];
type Mode='material'|'silhouette';
interface Counts {constructions:number;fragmentCompiles:number;initialGeometryBuilds:number;visualTerrainCompiles:number;visualRasterBuilds:number;fullCandidates:number}
interface SampleResult {
  readonly id:string;readonly label:string;readonly seed:number;readonly counts:Counts;
  readonly material:HTMLCanvasElement;readonly silhouette:HTMLCanvasElement;
  readonly gates:Readonly<Record<string,unknown>>;readonly geometryMetrics:Readonly<Record<string,unknown>>|null;
  readonly errors:readonly string[];readonly sources:Readonly<Record<string,string>>;
  readonly macro:NativeConstructionMacroMetrics;
  readonly extension:ReturnType<typeof constructNativeSpatialReference>['constructionExtension'];
  readonly assessmentIntent:Readonly<{targetWalkAreaPx2:number;planningCellFactor:number;frameWidthPx:number;frameHeightPx:number;requestedCounts:Readonly<{holes:number;solids:number}>}>;
}
const element=<T extends HTMLElement>(id:string):T=>{const node=document.getElementById(id);if(!node)throw new Error(`Missing review element ${id}`);return node as T;};
const canvas=element<HTMLCanvasElement>('map'),selector=element<HTMLSelectElement>('sample'),viewport=element('viewport'),stage=element('stage');
const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas 2D unavailable');const context=ctx;
const cache=new Map<string,Promise<SampleResult>>(),results=new Map<string,SampleResult>(),countsBySample:Record<string,Counts>={};
let selected:Sample=samples.find(s=>s.id===new URLSearchParams(location.search).get('sample'))??samples[0],mode:Mode='material',nativeSize=false,ready=false,phase='idle',errors:string[]=[];
const labelFor=(id:string):string=>R100_NATIVE_WORLDS.find(world=>world.id===id)?.label??id;
for(const sample of samples){const option=document.createElement('option');option.value=sample.id;option.textContent=labelFor(sample.id);selector.append(option);}selector.value=selected.id;
const yieldPaint=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
const textFile=async(url:string)=>{const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`${url}: HTTP ${response.status}`);return response.text();};
const sha=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
const macroPolicyURL='/data/rift-native-construction-macro-policy.csv';
let macroPolicyPromise:Promise<NativeConstructionMacroPolicy>|undefined;
const loadMacroPolicy=()=>macroPolicyPromise??=(async()=>{const csv=await textFile(macroPolicyURL);return parseNativeConstructionMacroPolicy(csv,await sha(csv));})();
const extensionPolicyURL='/data/rift-native-construction-extension.csv';
const extensionModuleURL='/src/generation/world-study/native-spatial-construction-extension.ts';
let extensionPolicyPromise:Promise<{policy:ReturnType<typeof parseNativeConstructionExtensionPolicy>;moduleSourceHash:string}>|undefined;
const loadExtensionPolicy=()=>extensionPolicyPromise??=(async()=>{const csv=await textFile(extensionPolicyURL);return{policy:parseNativeConstructionExtensionPolicy(csv,await sha(csv)),moduleSourceHash:await sha(extensionModuleSource)};})();
const setPhase=async(value:string)=>{phase=value;element('summary').textContent=value;await yieldPaint();};
const makeCanvas=(width:number,height:number):HTMLCanvasElement=>{const next=document.createElement('canvas');next.width=width;next.height=height;return next;};
const drawSpawn=(target:CanvasRenderingContext2D,x:number,y:number)=>{target.strokeStyle='#f1f0e6';target.fillStyle='#080c0e';target.lineWidth=4;target.beginPath();target.arc(x,y,12,0,Math.PI*2);target.fill();target.stroke();target.fillStyle='#f1f0e6';target.fillRect(x-3,y-3,6,6);};

async function construct(sample:Sample):Promise<SampleResult>{
  const counts:Counts={constructions:0,fragmentCompiles:0,initialGeometryBuilds:0,visualTerrainCompiles:0,visualRasterBuilds:0,fullCandidates:0};countsBySample[sample.id]=counts;
  const [referenceText,shoreText,macroPolicy,extensionPolicy]=await Promise.all([textFile(sample.reference),textFile(sample.shore),loadMacroPolicy(),loadExtensionPolicy()]);
  const [referenceHash,shoreHash]=await Promise.all([sha(referenceText),sha(shoreText)]);
  const reference=parseNativeSpatialConstructionReference(referenceText,referenceHash),shorePolicy=parseNativeConstructionShore(shoreText,shoreHash);
  if(reference.worldId!==sample.id||reference.seed!==20261012||reference.grade!=='medium'||shorePolicy.referenceId!==reference.id)throw new Error('Sample CSV must preserve its registered world, medium grade and seed 20261012');
  const recipe=createR100NativeSpatialDevelopmentRecipe(reference.worldId,reference.seed,'medium'),input=recipe.nativeSpatial;if(!input)throw new Error('Missing frozen native intent');
  const baseCombinedHash=await sha(JSON.stringify({referenceSHA256:referenceHash,shoreSHA256:shoreHash}));
  const combinedHash=await sha(JSON.stringify({referenceSHA256:referenceHash,shoreSHA256:shoreHash,extensionSHA256:extensionPolicy.policy.sourceHash,extensionModuleSHA256:extensionPolicy.moduleSourceHash}));
  await setPhase('共同构造宽地块、孔洞、实体与参差岸线…');counts.constructions++;
  const layout=constructNativeSpatialReference(recipe,reference,()=>counts.fragmentCompiles++,{policy:shorePolicy,combinedSourceHash:baseCombinedHash},{...extensionPolicy,combinedSourceHash:combinedHash});
  const assessment=layout.assessmentInput??{policy:input.policy,world:input.world};
  const assessmentIntent={targetWalkAreaPx2:assessment.world.targetWalkAreaPx2,planningCellFactor:assessment.policy.planningCellFactor,frameWidthPx:assessment.world.frameWidthPx,frameHeightPx:assessment.world.frameHeightPx,requestedCounts:layout.requestedCounts};
  const macro=measureNativeConstructionMacro(layout.definition.terrainOutline!,macroPolicy);
  const gates:Record<string,unknown>={boundary:measureNativeConstructionBoundary(layout.definition.terrainOutline!,shorePolicy.maxCleanRunPx)},diagnosticErrors:string[]=[];
  let geometry:NativeSpatialGeometry|undefined,geometryMetrics:Readonly<Record<string,unknown>>|null=null;
  await setPhase('检查真实身体通路、空白与遮视…');
  try{
    counts.initialGeometryBuilds++;geometry=buildNativeSpatialGeometry(layout.definition,reference.seed);
    const groups=identifyNativeSpatialStructures(geometry,layout.assemblies,assessment.policy);
    const ground=evaluateNativeSpatialGeometry(geometry,groups,assessment.policy,assessment.world,{placements:layout.holes,profiles:input.holeProfiles},
      {landRects:layout.plan.land,placements:layout.bays,landJoins:layout.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx});
    gates.geometry=ground;geometryMetrics=ground.metrics;
    gates.visibility=evaluateNativeSpatialVisibility(geometry,groups.structures,assessment.policy);
  }catch(error){diagnosticErrors.push(`几何检查：${error instanceof Error?error.message:String(error)}`);}
  await setPhase('编译含岸壁的视觉数据；加载正式材质…');
  counts.visualTerrainCompiles++;const terrain=compileNativeTerrain(layout.definition,reference.seed,true);
  if(geometry&&(geometry.terrain.matter.length!==terrain.matter.length||geometry.terrain.matter.some((v,i)=>v!==terrain.matter[i])))throw new Error('Visual terrain changed the diagnosed land mask');
  const definition=layout.definition,families=[...new Set([definition.family,...definition.instances.map(instance=>instance.family??definition.family)])];
  const textures=await Promise.all(families.map(family=>loadPaintedMaterial(family,family===definition.family?recipe.appearance?.materialOrganization:undefined)));
  const painting:PaintedMaterial={...textures[0]!,...(recipe.appearance?{appearance:recipe.appearance}:{}),families:Object.fromEntries(families.map((family,i)=>[family,textures[i]!]))};
  await setPhase('烘焙原生地面、实体表面与光照…');
  counts.visualRasterBuilds++;
  const raster=compileNativeVolumeRaster(terrain.meshes,{x:0,y:0,width:terrain.width,height:terrain.height,pixelSize:1,supportCellSize:8,opticalHeight:24,maxPixels:5_242_880});
  const world:MasterSurfaceWorld={definition,meshes:terrain.meshes,raster,matterAt:terrain.matterAt,appearance:recipe.appearance,
    sample:{profile:{...recipe.profile,surface:{...recipe.profile.surface,quietness:definition.ground_quietness,contrast:definition.ground_contrast,coverage:definition.ground_coverage}},topologyId:'loops',seed:reference.seed,cols:definition.cols,rows:definition.rows,tileSize:32,land:terrain.land,walls:terrain.walls,spawn:terrain.spawnPoint,exit:terrain.exitPoint,formations:[],flowAngle:terrain.flowAngle,deposition:terrain.deposition}};
  const ground=paintMasterGround(world),volume=new NativeVolumeLighting(raster,masterVolumePalette(world),{seed:reference.seed,axis:definition.axis});
  const prepared=bakeMasterSurface(world,ground,volume,painting),material=makeCanvas(terrain.width,terrain.height),silhouette=makeCanvas(terrain.width,terrain.height);
  const materialContext=material.getContext('2d'),silhouetteContext=silhouette.getContext('2d');if(!materialContext||!silhouetteContext)throw new Error('Review canvases unavailable');
  let renderer:MasterSurfaceRenderer|undefined;
  try{
    renderer=new MasterSurfaceRenderer(world,undefined,undefined,painting,prepared);
    const spawn=terrain.spawnPoint;
    renderer.draw([{x:spawn.x,y:spawn.y,z:28,radius:264,intensity:3.1,color:[1,.94,.86],castsShadow:false}],.72,0,0);
    materialContext.drawImage(renderer.canvas,0,0);drawSpawn(materialContext,spawn.x,spawn.y);
  }finally{renderer?.destroy();}
  silhouetteContext.fillStyle='#080d10';silhouetteContext.fillRect(0,0,silhouette.width,silhouette.height);silhouetteContext.fillStyle='#809995';
  for(let y=0;y<terrain.rows;y++)for(let x=0;x<terrain.cols;){if(!terrain.matter[y*terrain.cols+x]){x++;continue;}const from=x;while(x<terrain.cols&&terrain.matter[y*terrain.cols+x])x++;silhouetteContext.fillRect(from*8,y*8,(x-from)*8,8);}
  silhouetteContext.fillStyle='#c49b63';silhouetteContext.beginPath();
  for(const primitive of geometry?.solidPrimitives??nativeSolidPrimitives(terrain)){
    const p=primitive.points;
    // One nonzero fill represents the projected union only when all faces
    // have the same winding; opposing mesh faces must not cancel each other.
    const reverse=(p[2]!-p[0]!)*(p[5]!-p[1]!)-(p[3]!-p[1]!)*(p[4]!-p[0]!)<0;
    silhouetteContext.moveTo(p[0]!,p[1]!);
    silhouetteContext.lineTo(p[reverse?4:2]!,p[reverse?5:3]!);
    silhouetteContext.lineTo(p[reverse?2:4]!,p[reverse?3:5]!);
    silhouetteContext.closePath();
  }silhouetteContext.fill();drawSpawn(silhouetteContext,terrain.spawnPoint.x,terrain.spawnPoint.y);
  return{id:sample.id,label:recipe.profile.label,seed:reference.seed,counts,material,silhouette,gates,geometryMetrics,macro,extension:layout.constructionExtension,assessmentIntent,errors:diagnosticErrors,sources:{referenceCSV:sample.reference,shoreCSV:sample.shore,referenceSHA256:referenceHash,shoreSHA256:shoreHash,combinedSHA256:combinedHash,macroPolicyCSV:macroPolicyURL,macroPolicySHA256:macroPolicy.sourceHash,extensionCSV:extensionPolicyURL,extensionSHA256:extensionPolicy.policy.sourceHash,extensionModule:extensionModuleURL,extensionModuleSHA256:extensionPolicy.moduleSourceHash}};
}

function fit():void{
  if(!ready)return;const scale=nativeSize?1:Math.min(viewport.clientWidth/canvas.width,viewport.clientHeight/canvas.height);
  stage.style.width=`${canvas.width*scale}px`;stage.style.height=`${canvas.height*scale}px`;canvas.style.width=`${canvas.width*scale}px`;canvas.style.height=`${canvas.height*scale}px`;
}
function draw():void{
  const result=results.get(selected.id);if(!result||!ready)return;
  const source=result[mode];canvas.width=source.width;canvas.height=source.height;context.imageSmoothingEnabled=false;context.drawImage(source,0,0);fit();
  for(const id of ['material','silhouette'])element(id).setAttribute('aria-pressed',String(mode===id));
  element('legend').textContent=mode==='material'?'正式材质与岸壁 · 固定照明 · 白圈：出生点':'黑色：缺地 · 赭色：真实实体 · 白圈：出生点';
}
function diagnostics():void{
  const result=results.get(selected.id);element('diagnostics').textContent=JSON.stringify({scope:'DEV geometric/material diagnostic; no production admission, content or exit; no layout search',worldId:selected.id,seed:20261012,counts:countsBySample[selected.id],extension:result?.extension,assessmentIntent:result?.assessmentIntent,macro:result?.macro,gates:result?.gates,errors,sources:result?.sources},null,2);
}
async function select(sample:Sample):Promise<void>{
  selected=sample;selector.value=sample.id;ready=false;errors=[];element('error').hidden=true;
  element('sample-title').textContent=labelFor(sample.id);selector.disabled=true;for(const button of document.querySelectorAll<HTMLButtonElement>('nav button'))button.disabled=true;
  canvas.width=canvas.height=1;stage.style.width=stage.style.height='1px';
  try{
    let pending=cache.get(sample.id);if(!pending){pending=construct(sample);cache.set(sample.id,pending);}else await setPhase('读取已构造样本缓存…');
    const result=await pending;results.set(sample.id,result);errors=[...result.errors];ready=true;phase='ready';
    element('identity').textContent=`${sample.id} · 中污染 · 种子 ${result.seed} · ${result.material.width} × ${result.material.height}`;
    const geometry=result.gates.geometry as {accepted:boolean;reasons:readonly string[]}|undefined,visibility=result.gates.visibility as {accepted:boolean;reasons:readonly string[]}|undefined;
    element('summary').textContent=`次级地块：${result.extension?.additions.length??0} 处；G1/G3：${geometry?(geometry.accepted?'通过':geometry.reasons.join(' / ')):'未完成'}；G2：${visibility?(visibility.accepted?'通过':visibility.reasons.join(' / ')):'未完成'}。完整内容未运行。`;
    const sources=element('sources');sources.replaceChildren();for(const [name,url]of [['参考 CSV',sample.reference],['岸线 CSV',sample.shore],['共享扩展 CSV',extensionPolicyURL]]){const link=document.createElement('a');link.textContent=name!;link.href=url!;link.target='_blank';link.rel='noopener';sources.append(link);}
    const url=new URL(location.href);url.searchParams.set('sample',sample.id);history.replaceState(null,'',url);draw();
  }catch(error){phase='failed';errors.push(error instanceof Error?error.message:String(error));element('summary').textContent='此样本未显示；错误已保留，不自动重试或替换地图。';}
  finally{selector.disabled=false;for(const button of document.querySelectorAll<HTMLButtonElement>('nav button'))button.disabled=!ready;element('error').hidden=errors.length===0;element('error').textContent=errors.join('\n');diagnostics();}
}
selector.addEventListener('change',()=>{const sample=samples.find(s=>s.id===selector.value);if(sample)void select(sample);});
for(const id of ['material','silhouette'] as const)element(id).addEventListener('click',()=>{mode=id;draw();});
for(const id of ['fit','native'])element(id).addEventListener('click',()=>{nativeSize=id==='native';document.body.classList.toggle('native',nativeSize);element('fit').setAttribute('aria-pressed',String(!nativeSize));element('native').setAttribute('aria-pressed',String(nativeSize));fit();});
window.addEventListener('resize',fit);
Object.assign(window,{__nativeConstruction:{canvas,getState:()=>{const result=results.get(selected.id);return structuredClone({worldId:selected.id,label:labelFor(selected.id),seed:20261012,grade:'medium',ready,phase,mode,cachedSampleIds:[...results.keys()],countsBySample,gates:result?.gates??null,geometryMetrics:result?.geometryMetrics??null,macro:result?.macro??null,extension:result?.extension??null,assessmentIntent:result?.assessmentIntent??null,errors,sources:result?.sources??null,admission:'DEV-not-complete'});}}});
void select(selected);
