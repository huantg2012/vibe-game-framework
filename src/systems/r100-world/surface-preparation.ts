import { createRiftHostManifest } from '../rift-host-manifest';
import { createContaminantSourceRegions } from '@/generation/contaminant-source-regions';
import { CATALOG_SOURCE_AFFINITIES } from '@/generated/contaminant-catalog-data';
import { TileGrid } from '../tile-grid';
import { selectMasterSourceCells } from './source-cells';
import { r100NativePreparationIdentity, type R100PreparedGameplay } from './prepared-gameplay';
export { r100NativePreparationIdentity as r100SurfaceIdentity } from './prepared-gameplay';
/** Transfer-only preparation contract: no scene owner or GPU handle crosses it. */
import type { GeneratedRiftLayout } from '@/generation/types';
import { hydrateR100MasterWorld, type R100NativeWorldData } from '@/generation/world-study/r100-native-data';
import type { PaintedMaterial } from './painted-material';
import { bakeMasterWorldSurface, type MasterSurfaceBake } from './surface-bake';
import { bakePaintGenome } from '@/entities/form-renderers/d/paint-genome/bake';
import { resolvePaintVeinVariant } from '@/entities/form-renderers/d/paint-genome/topology';
import { paintGenomePreparationKey, type PreparedPaintGenome } from '@/entities/form-renderers/d/paint-genome/prepared';
import { mix32 } from '@/generation/seed-fork';
export interface R100SurfacePreparationInput {
 readonly native:R100NativeWorldData; readonly layout:GeneratedRiftLayout;
 readonly painting:PaintedMaterial;
}
export interface R100SurfacePreparationResult { readonly identity:string; readonly surface:MasterSurfaceBake; readonly paintHosts:readonly PreparedPaintGenome[]; readonly gameplay:R100PreparedGameplay }
export interface R100SurfacePreparationRequest { readonly id:number; readonly input:R100SurfacePreparationInput }
export type R100SurfacePreparationResponse={readonly id:number;readonly started:true}|{readonly id:number;readonly result:R100SurfacePreparationResult}|{readonly id:number;readonly error:string};
export function executeR100SurfacePreparation(input:R100SurfacePreparationInput):R100SurfacePreparationResult {
 const world=hydrateR100MasterWorld(input.native,input.layout);
 const paintHosts = r100PaintHostRequests(input.layout).map(request => ({key:paintGenomePreparationKey(request),baked:bakePaintGenome(request)}));
 const identity=r100NativePreparationIdentity(input.native);
 const gameplay:R100PreparedGameplay={identity,
  hostManifest:createRiftHostManifest(input.layout,input.native.hostTileMap,paintHosts),
  sourceCells:selectMasterSourceCells(world),
  sourceRegions:createContaminantSourceRegions({grid:new TileGrid(input.layout.tileMap),spawn:input.layout.spawnPoint,
   nodes:[...input.layout.kindlingNodes,...input.layout.contaminantNodes],seed:input.layout.seed}),
 };
 return {identity,surface:bakeMasterWorldSurface(world,input.painting),paintHosts,gameplay};
}
export function r100PaintHostRequests(layout:GeneratedRiftLayout) {
 return layout.contaminationDraw.forms.filter(form=>form.portfolio==='bing').map((form,index)=>{
  const seed=mix32(layout.seed,`ENM_BING_${String(index+1).padStart(2,'0')}`);
  return {substrate:form.substrate,coverage:form.coverage,seed,continuity:form.continuity,
   sense:form.lexemes.sense,rhythm:form.lexemes.rhythm,fragmentTypeId:layout.fragmentTypeId,
   veinVariant:resolvePaintVeinVariant(form.substrate,seed),geometryVersion:2 as const};
 });
}
export function validateR100SurfacePreparation(result:R100SurfacePreparationResult,input:R100SurfacePreparationInput):void {
 const {surface}=result,size=input.native.raster.width*input.native.raster.height*4;
 if(result.identity!==r100NativePreparationIdentity(input.native)||surface.width!==input.native.raster.width||surface.height!==input.native.raster.height
   ||![surface.albedo,surface.normal,surface.response,surface.emission].every(data=>data instanceof Uint8Array&&data.length===size))
  throw new Error('Prepared native surface does not match the admitted world');
 const requests=r100PaintHostRequests(input.layout);
 if(!Array.isArray(result.paintHosts)||result.paintHosts.length!==requests.length)throw new Error('Prepared paint Host count differs');
 for(let index=0;index<requests.length;index++){
  const row=result.paintHosts[index]!,b=row.baked,size=b.canvasW*b.canvasH;
  if(row.key!==paintGenomePreparationKey(requests[index]!)||b.geometryVersion!==2||!Number.isSafeInteger(size)||size<1||size>512*512
   ||!(b.field instanceof Float32Array)||b.field.length!==size||!(b.terrainFootprintField instanceof Float32Array)||b.terrainFootprintField.length!==size
   ||!(b.buf.data instanceof Uint8ClampedArray)||b.buf.data.length!==size*4)
   throw new Error('Prepared paint Host does not match its frozen form');
 }
 validateR100PreparedGameplay(result,input);
}

/** Small bound/identity checks never redo material painting or the BFS. */
export function validateR100PreparedGameplay(result:R100SurfacePreparationResult,input:R100SurfacePreparationInput):void {
 const data=result.gameplay;
 if(!data||data.identity!==result.identity||!Array.isArray(data.hostManifest?.targets)
  ||!(data.hostManifest.nucleusCounts instanceof Map)||!Array.isArray(data.sourceCells)||!(data.sourceRegions instanceof Map))
  throw new Error('Prepared gameplay does not match the admitted world');
 // Reuse the transferred field, rather than trusting stored target names or
 // repeating the original complete bake. This is only a small footprint scan.
 const expected=createRiftHostManifest(input.layout,input.native.hostTileMap,result.paintHosts);
 if(JSON.stringify(data.hostManifest.targets)!==JSON.stringify(expected.targets)
  ||JSON.stringify([...data.hostManifest.nucleusCounts])!==JSON.stringify([...expected.nucleusCounts]))
  throw new Error('Prepared admission manifest differs');
 const world=hydrateR100MasterWorld(input.native,input.layout),r=world.raster;
 let previous=-1;
 for(const source of data.sourceCells){
  if(!Number.isSafeInteger(source.meshIndex)||source.meshIndex<=previous||source.meshIndex>=world.meshes.length
   ||!Number.isSafeInteger(source.cell)||source.cell<0||source.cell>=r.width*r.height
   ||r.objectId[source.cell]!==world.meshes[source.meshIndex]!.spec.id||r.material[source.cell]!==3
   ||!world.matterAt(source.cell%r.width,Math.floor(source.cell/r.width)))throw new Error('Prepared source cell differs');
  previous=source.meshIndex;
 }
 if(JSON.stringify(data.sourceCells)!==JSON.stringify(selectMasterSourceCells(world)))throw new Error('Prepared source cell differs');
 const nodes=[...input.layout.kindlingNodes,...input.layout.contaminantNodes];
 if(data.sourceRegions.size!==nodes.length||nodes.some(node=>{
  const value=data.sourceRegions.get(node.id);
  return !value||!Object.prototype.hasOwnProperty.call(CATALOG_SOURCE_AFFINITIES,value.sourceTag)
   ||value.hint!==(CATALOG_SOURCE_AFFINITIES[value.sourceTag]?.[0]?.publicHint??'残留特征混杂');
 }))throw new Error('Prepared source region differs');
}
