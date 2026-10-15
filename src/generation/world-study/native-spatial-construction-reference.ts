/** DEV-only, CSV-authored complete reference. No placement search or retries.
 * Keep the CSV receipt with the result: the ordinary r12 recipe does not encode
 * this separate reference and must never be used to resume it in normal play. */
import {mix32} from '@/generation/seed-fork';
import type {Vector2} from '@/types/game-types';
import type {WorldProductionRecipeV3} from './production-recipe';
import type {MasterDefinition} from './r100-master-world';
import type {NativeSpatialLayout} from './native-spatial-layout';
import {nativeSpatialCountPairs} from './native-spatial-layout';
import {nativeSpatialLandJoins} from './native-spatial-bay-layout';
import type {NativeSpatialLandPlate} from './native-spatial-land';
import type {NativeSpatialAssemblyPlacement,NativeSpatialHolePlacement} from './native-spatial-structures';
import {compileR100FragmentShape,type R100FrozenFragmentShape} from './r100-fragment-shape';
import type {FragmentRect} from './fragment-shape';
import {constructNativeMacroShore,nativeConstructionFootprints,type NativeConstructionShorePolicy,type NativeConstructionShoreResult} from './native-spatial-construction-shore';
import {nativePrimitive} from './native-spatial-geometry';
import {constructNativeConstructionExtensions,type NativeConstructionExtensionPolicy,type NativeConstructionExtensionResult} from './native-spatial-construction-extension';
import type {NativeSpatialFrozenInput} from './native-spatial-types';

export const NATIVE_CONSTRUCTION_REFERENCE_COLUMNS=['reference_id','world_id','grade','seed','seed_salt','kind','id','profile_id','x_px','y_px','width_px','height_px','length_px','rotation_rad','scale','parent_id','rects'] as const;
type Column=typeof NATIVE_CONSTRUCTION_REFERENCE_COLUMNS[number];
type Row=Readonly<Record<Column,string>>;
type Rect=[number,number,number,number];
type Instance=MasterDefinition['instances'][number];
type ObjectPlacement=NativeSpatialLayout['plan']['objects'][number];
export interface NativeSpatialConstructionReference {
  readonly id:string;readonly worldId:string;readonly grade:string;
  readonly seed:number;readonly seedSalt:number;readonly sourceHash:string;
  readonly rows:readonly Row[];
}
export interface NativeSpatialConstructedReference extends NativeSpatialLayout {
  readonly constructionShore?:NativeConstructionShoreResult&Readonly<{referenceSourceHash:string;combinedSourceHash:string}>;
  readonly constructionExtension?:NativeConstructionExtensionResult&Readonly<{moduleSourceHash:string;combinedSourceHash:string;coordinateSpace:'before-global-translation';baseCounts:Readonly<{holes:number;solids:number}>;finalCounts:Readonly<{holes:number;solids:number}>;baseTargetWalkAreaPx2:number}>;
  /** Explicit DEV intent; the original frozen recipe and gameplay limits are
   * unchanged. Area and density intent account for the authored extension. */
  readonly assessmentInput?:Pick<NativeSpatialFrozenInput,'policy'|'world'>;
}
function number(row:Row,key:Column):number {
  if(!row[key].trim()||!Number.isFinite(Number(row[key])))throw new Error(`Reference ${row.id}: invalid ${key}`);
  return Number(row[key]);
}
function uint32(row:Row,key:Column):number {
  const value=number(row,key);if(!Number.isSafeInteger(value)||value<0||value>0xffffffff)throw new Error(`Reference ${row.id}: invalid uint32 ${key}`);return value;
}
function rectangle(text:string,id:string):Rect {
  const values=text.split(':').map(Number);
  if(values.length!==4||values.some(n=>!Number.isFinite(n)||n%8!==0)||values[2]!<=0||values[3]!<=0)throw new Error(`Reference ${id}: invalid snapped rectangle`);
  return values as Rect;
}
function within(value:number,min:number,max:number,label:string):void {
  if(value<min||value>max)throw new Error(`Reference ${label}: ${value} outside [${min},${max}]`);
}
/** This deliberately narrow CSV contains no quoted fields or embedded commas.
 * Reject malformed input instead of interpreting a partial layout. */
export function parseNativeSpatialConstructionReference(csv:string,sourceHash:string):NativeSpatialConstructionReference {
  if(!/^[0-9a-f]{64}$/.test(sourceHash))throw new Error('Reference requires its CSV SHA256');
  const lines=csv.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  if(lines.shift()!==NATIVE_CONSTRUCTION_REFERENCE_COLUMNS.join(','))throw new Error('Invalid construction reference CSV header');
  const rows=lines.filter(line=>line.trim()).map((line,index):Row=>{
    if(line.includes('"'))throw new Error(`Reference CSV line ${index+2}: quoted fields are unsupported`);
    const values=line.split(',');if(values.length!==NATIVE_CONSTRUCTION_REFERENCE_COLUMNS.length)throw new Error(`Reference CSV line ${index+2}: wrong column count`);
    return Object.fromEntries(NATIVE_CONSTRUCTION_REFERENCE_COLUMNS.map((key,i)=>[key,values[i]!.trim()])) as Record<Column,string>;
  });
  if(!rows.length)throw new Error('Empty construction reference');
  const first=rows[0]!,ids=new Set<string>();
  for(const row of rows){
    if(!/^[a-z][a-z0-9-]*$/.test(row.id)||ids.has(row.id))throw new Error(`Reference duplicate/invalid object ${row.id}`);ids.add(row.id);
    for(const key of ['reference_id','world_id','grade','seed','seed_salt'] as const)if(row[key]!==first[key])throw new Error(`Mixed reference metadata: ${key}`);
    if(!['land','hole','assembly','solid','spawn','protect'].includes(row.kind))throw new Error(`Reference ${row.id}: unsupported kind ${row.kind}`);
  }
  if(!/^[a-z][a-z0-9-]{0,80}$/.test(first.reference_id))throw new Error('Invalid reference ID');
  return{id:first.reference_id,worldId:first.world_id,grade:first.grade,seed:uint32(first,'seed'),seedSalt:uint32(first,'seed_salt'),sourceHash,rows};
}

/** Build the one authored L/H/S arrangement, then break its edges exactly once.
 * All real geometry/body/visibility/content gates are run by the DEV caller. */
export function constructNativeSpatialReference(recipe:WorldProductionRecipeV3,reference:NativeSpatialConstructionReference,onFragmentCompile?:(shape:R100FrozenFragmentShape)=>void,shore?:Readonly<{policy:NativeConstructionShorePolicy;combinedSourceHash:string}>,extension?:Readonly<{policy:NativeConstructionExtensionPolicy;moduleSourceHash:string;combinedSourceHash:string}>):NativeSpatialConstructedReference {
  const input=recipe.nativeSpatial,native=recipe.nativeDefinition;
  if(recipe.package.algorithmRevision!==12||!input)throw new Error('Reference requires the explicit native development recipe');
  if(reference.worldId!==input.world.worldId||reference.seed!==recipe.requestedSeed||reference.grade!==native.grade)throw new Error('Reference does not match its frozen recipe');
  const rows=reference.rows,landRows=rows.filter(r=>r.kind==='land'),spawnRows=rows.filter(r=>r.kind==='spawn');
  if(!landRows.length||spawnRows.length!==1)throw new Error('Reference requires land and exactly one spawn probe');
  const land:Rect[]=landRows.map(row=>rectangle([number(row,'x_px'),number(row,'y_px'),number(row,'width_px'),number(row,'height_px')].join(':'),row.id));
  for(const [index,r]of land.entries())if(r[0]<0||r[1]<0||r[0]+r[2]>input.world.frameWidthPx||r[1]+r[3]>input.world.frameHeightPx)throw new Error(`Reference ${landRows[index]!.id}: land outside frame`);
  const landPlates:NativeSpatialLandPlate[]=landRows.map((row,index)=>{
    if(row.profile_id!=='core'&&row.profile_id!=='shoulder')throw new Error(`Reference ${row.id}: invalid land role`);
    const parentIndex=row.parent_id?landRows.findIndex(r=>r.id===row.parent_id):null;
    if(index===0?parentIndex!==null:parentIndex===null||parentIndex<0||parentIndex>=index)throw new Error(`Reference ${row.id}: parent must be an earlier land plate`);
    return{role:row.profile_id,parentIndex};
  });
  let landJoins=nativeSpatialLandJoins(land,input.world.landRectMinOverlapPx,landPlates.map(p=>p.parentIndex));
  const spawnRow=spawnRows[0]!,spawn:Vector2={x:number(spawnRow,'x_px'),y:number(spawnRow,'y_px')};
  if(spawn.x<0||spawn.y<0||spawn.x>=input.world.frameWidthPx||spawn.y>=input.world.frameHeightPx)throw new Error('Reference spawn outside frame');
  const objects:ObjectPlacement[]=[],assemblies:NativeSpatialAssemblyPlacement[]=[],holes:NativeSpatialHolePlacement[]=[],usedAssemblies=new Set<string>();
  let nextId=Math.max(...native.instances.map(i=>i.id))+1;
  for(const row of rows){
    if(row.kind==='land'||row.kind==='spawn'||row.kind==='protect')continue;
    if(row.kind==='hole'){
      const profile=input.holeProfiles.find(p=>p.id===row.profile_id);if(!profile)throw new Error(`Reference ${row.id}: unknown hole profile`);
      const rects=row.rects.split('|').map(text=>rectangle(text,row.id));within(rects.length,profile.minRectCount,profile.maxRectCount,`${row.id} rectangle count`);
      const hole={holeId:row.id,profileId:profile.id,rects};holes.push(hole);objects.push({kind:'hole',profileId:profile.id,rects,instances:[],site:{x:0,y:0}});continue;
    }
    const site={x:number(row,'x_px'),y:number(row,'y_px')};
    if(site.x%8||site.y%8)throw new Error(`Reference ${row.id}: solid placement must be snapped to 8px`);
    let instances:Instance[],assembly:NativeSpatialAssemblyPlacement;
    if(row.kind==='assembly'){
      const author=input.assemblies.find(a=>a.id===row.profile_id);if(!author||usedAssemblies.has(author.id))throw new Error(`Reference ${row.id}: unknown or repeated complete assembly`);
      usedAssemblies.add(author.id);const multiplier=number(row,'scale'),rotation=number(row,'rotation_rad');within(multiplier,author.minScale,author.maxScale,`${row.id} scale`);
      if(!author.rotationOffsetsRad.some(r=>Math.abs(rotation-r)<1e-9))throw new Error(`Reference ${row.id}: unsupported assembly rotation`);
      const scale=author.sourceScale*multiplier,c=Math.cos(rotation),s=Math.sin(rotation),sourceIds=new Set([...author.sourceInstanceIds,...author.attachedReliefIds]);
      const anchors=author.sourceInstanceIds.map(id=>native.instances.find(i=>i.id===id)!);
      if(anchors.some(i=>!i))throw new Error(`Reference ${row.id}: missing source instance`);
      const cx=anchors.reduce((sum,i)=>sum+i.x,0)/anchors.length,cy=anchors.reduce((sum,i)=>sum+i.y,0)/anchors.length;
      instances=native.instances.filter(i=>sourceIds.has(i.id)).map(i=>({...i,x:((i.x-cx)*c-(i.y-cy)*s)*scale,y:((i.x-cx)*s+(i.y-cy)*c)*scale,rotation:i.rotation+rotation,length:i.length*scale,width:i.width*scale,height:i.role==='solid'?i.height*scale:i.height,thickness:i.role==='solid'?i.thickness*scale:i.thickness}));
      assembly={assemblyId:row.id,instanceIds:author.sourceInstanceIds,maxSpanPx:author.maxSpanPx};
    }else{
      const profile=input.subordinateProfiles.find(p=>p.id===row.profile_id);if(!profile)throw new Error(`Reference ${row.id}: unknown subordinate profile`);
      const length=number(row,'length_px'),width=number(row,'width_px'),height=number(row,'height_px'),rotation=number(row,'rotation_rad');
      within(length,profile.minLengthPx,profile.maxLengthPx,`${row.id} length`);within(width,profile.minWidthPx,profile.maxWidthPx,`${row.id} width`);within(height,profile.minHeightPx,profile.maxHeightPx,`${row.id} height`);
      within(rotation,input.world.materialAxisRad+profile.rotationOffsetRad-.25,input.world.materialAxisRad+profile.rotationOffsetRad+.25,`${row.id} rotation`);
      const id=nextId++;instances=[{id,role:'solid',family:profile.family,constructionVersion:profile.constructionVersion,shapeProfile:profile.shapeProfile,x:0,y:0,length,width,height,rotation,thickness:profile.thicknessPx,fold:profile.fold,branches:profile.branches,opening:profile.opening,distortion:profile.distortion}];
      assembly={assemblyId:row.id,instanceIds:[id],maxSpanPx:512};
    }
    assemblies.push(assembly);objects.push({kind:'solid',instances,rects:[],assembly,site});
  }
  if(input.assemblies.some(a=>!usedAssemblies.has(a.id)))throw new Error('Reference omitted an authored whole assembly');
  let requestedCounts={holes:holes.length,solids:assemblies.length};const countPairIndex=nativeSpatialCountPairs(input).findIndex(p=>p.holes===holes.length&&p.solids===assemblies.length),bayCountIndex=input.world.bayCountOptions.indexOf(0);
  if(countPairIndex<0||bayCountIndex<0)throw new Error('Reference count/B0 choice violates frozen intent');
  const protect=rows.filter(row=>row.kind==='protect').flatMap(row=>row.rects.split('|').map(text=>rectangle(text,row.id)));
  let frame:[number,number]=[input.world.frameWidthPx,input.world.frameHeightPx],constructionExtension:NativeSpatialConstructedReference['constructionExtension'],assessmentInput:NativeSpatialConstructedReference['assessmentInput'];
  if(extension){
    if(!/^[0-9a-f]{64}$/.test(extension.moduleSourceHash)||!/^[0-9a-f]{64}$/.test(extension.combinedSourceHash))throw new Error('Extension requires module and combined source SHA256');
    const templates=rows.filter(row=>row.kind==='solid').map(row=>{const object=objects.find(o=>o.assembly?.assemblyId===row.id);if(!object)throw new Error('Missing extension subordinate template');return{id:row.id,instances:object.instances};});
    const result=constructNativeConstructionExtensions({land,holes,instances:objects.flatMap(o=>o.instances.map(i=>({...i,x:i.x+o.site.x,y:i.y+o.site.y}))),solidTemplates:templates,family:native.family,spawn,protectedRects:protect,frame,seed:reference.seed,placementSeed:mix32(reference.seed,`${reference.worldId}:${reference.seedSalt}:construction-extension`),spatialPolicy:input.policy},extension.policy);
    const baseCounts=requestedCounts;
    for(const addition of result.additions){land.push([...addition.rect]);landPlates.push({role:'shoulder',parentIndex:addition.parentIndex});}
    for(const hole of result.holes){holes.push(hole);objects.push({kind:'hole',profileId:hole.profileId,rects:hole.rects.map(r=>[...r] as Rect),instances:[],site:{x:0,y:0}});}
    for(const solid of result.solids){assemblies.push(solid.assembly);objects.push({kind:'solid',instances:solid.instances,rects:[],assembly:solid.assembly,site:solid.site});}
    const {x:dx,y:dy}=result.translation,shift=(rect:readonly number[]):Rect=>[rect[0]!+dx,rect[1]!+dy,rect[2]!,rect[3]!];
    for(let i=0;i<land.length;i++)land[i]=shift(land[i]!);
    for(let i=0;i<holes.length;i++)holes[i]={...holes[i]!,rects:holes[i]!.rects.map(shift)};
    for(let i=0;i<objects.length;i++){const object=objects[i]!;objects[i]=object.kind==='hole'?{...object,rects:object.rects.map(shift)}:{...object,site:{x:object.site.x+dx,y:object.site.y+dy}};}
    for(let i=0;i<protect.length;i++)protect[i]=shift(protect[i]!);spawn.x+=dx;spawn.y+=dy;frame=[...result.frameAfter];
    landJoins=nativeSpatialLandJoins(land,input.world.landRectMinOverlapPx,landPlates.map(p=>p.parentIndex));
    requestedCounts={holes:holes.length,solids:assemblies.length};
    const targetWalkAreaPx2=input.world.targetWalkAreaPx2+result.addedLandAreaPx2-result.addedHoleAreaPx2-result.addedSolidAreaLowerPx2;
    assessmentInput={world:{...input.world,targetWalkAreaPx2,frameWidthPx:frame[0],frameHeightPx:frame[1]},policy:{...input.policy,...(result.additions.length?{sourceHash:extension.combinedSourceHash,planningCellFactor:targetWalkAreaPx2/((requestedCounts.holes+requestedCounts.solids)*input.policy.spacingPx**2)}:{})}};
    constructionExtension={...result,moduleSourceHash:extension.moduleSourceHash,combinedSourceHash:extension.combinedSourceHash,coordinateSpace:'before-global-translation',baseCounts,finalCounts:requestedCounts,baseTargetWalkAreaPx2:input.world.targetWalkAreaPx2};
  }
  const instances=objects.flatMap(o=>o.instances.map(i=>({...i,x:i.x+o.site.x,y:i.y+o.site.y}))),voidRects=holes.flatMap(h=>h.rects);
  let constructionShore:NativeSpatialConstructedReference['constructionShore'];
  if(shore){
    if(shore.policy.referenceId!==reference.id||!/^[0-9a-f]{64}$/.test(shore.combinedSourceHash))throw new Error('Shore policy requires matching reference and combined CSV SHA256');
    const footprints=nativeConstructionFootprints(instances,native.family,reference.seed),holePrimitives=voidRects.flatMap(([x,y,w,h])=>[nativePrimitive([x,y,x+w,y,x+w,y+h],-1),nativePrimitive([x,y,x+w,y+h,x,y+h],-1)]);
    constructionShore={...constructNativeMacroShore({land,protectedRects:[...voidRects,...landJoins.map(join=>join.rect),...protect,[spawn.x-10,spawn.y-10,20,20]],supportBounds:footprints.supportBounds,coverPrimitives:[...holePrimitives,...footprints.solidPrimitives],maxAddedCoverDistancePx:input.policy.maxEmptyRadiusPx,frame,seed:(reference.seed+reference.seedSalt)>>>0,...(constructionExtension?{seedLand:land.slice(0,landRows.length),seedTranslation:constructionExtension.translation}:{})},shore.policy),referenceSourceHash:reference.sourceHash,combinedSourceHash:extension?.combinedSourceHash??shore.combinedSourceHash};
  }
  const finalLand=[...land,...(constructionShore?.additions??[])],finalVoids=[...voidRects,...(constructionShore?.cuts??[])];
  if(instances.length>48||finalLand.length+finalVoids.length>128)throw new Error('Reference exceeds native instance/rectangle capacity');
  const fragmentShape:R100FrozenFragmentShape={algorithmVersion:'rectilinear-fragment-v1',layoutId:reference.id,sourceHash:extension?.combinedSourceHash??shore?.combinedSourceHash??reference.sourceHash,seedMode:'run-seed',seedSalt:reference.seedSalt,edgeSeed:(reference.seed+reference.seedSalt)>>>0,
    layout:{worldScale:2,authoringFrame:[frame[0]/2,frame[1]/2],landRects:finalLand.map(r=>r.map(v=>v/2) as unknown as FragmentRect),voidRects:finalVoids.map(r=>r.map(v=>v/2) as unknown as FragmentRect)}};
  onFragmentCompile?.(fragmentShape);const compiled=compileR100FragmentShape(fragmentShape,reference.seed);
  const definition:MasterDefinition={...native,cols:frame[0]/32,rows:frame[1]/32,instances,erosion:compiled.erosion,terrainOutline:compiled.terrainOutline,fragmentShapeVersion:'rectilinear-fragment-v1',spawn_x:spawn.x,spawn_y:spawn.y,exit_x:spawn.x,exit_y:spawn.y,search_x:spawn.x,search_y:spawn.y,enemy_x:spawn.x,enemy_y:spawn.y};
  return{candidate:0,countPairIndex,bayCountIndex,layoutSeed:reference.seed,definition,fragmentShape,assemblies,requestedCounts,holes,bays:[],landJoins,...(constructionShore?{constructionShore}:{}),...(constructionExtension?{constructionExtension,assessmentInput}:{}),
    plan:{land,landPlates,bays:[],objects,deepSpanProxyPx:Number.NaN,largestWideRatioProxy:null}};
}
