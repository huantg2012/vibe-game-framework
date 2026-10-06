import { installR100PreparedGameplay, type R100PreparedGameplay } from './r100-world/prepared-gameplay';
import type { SourceRegionAssignment } from '@/generation/contaminant-source-regions';
/** Formal native-material presentation. No DEV fixture owns this lifecycle. */
import type { GeneratedRiftLayout } from '@/generation/types';
import { validR100ProductionRecipe } from '@/generation/world-study/r100-package';
import type { WorldProductionRecipeV3 } from '@/generation/world-study/production-recipe';
import { hydrateR100MasterWorld, type R100NativeWorldData } from '@/generation/world-study/r100-native-data';
import type { MasterWorld } from '@/generation/world-study/r100-master-world';
import type { RiftDevRuntimeContext } from '@/scenes/rift-scene';
import { loadPaintedMaterial, paintedMaterialDefinition, type PaintedMaterial } from './r100-world/painted-material';
import { MasterPresentation } from './r100-world/presentation';
import { MasterSurfaceRenderer } from './r100-world/surface-renderer';
import { R100SurfacePreparationClient } from './r100-world/surface-preparation-client';
import { r100SurfaceIdentity } from './r100-world/surface-preparation';
import type { WorldProductionMap } from '@/generation/world-study/production-map';
import type { NativeVolumeFamily } from '@/generation/world-study/native-volume-geometry';
import type { ContaminationForm } from '@/generation/contamination-draw';
import { paintGenomePreparationKey, type PreparedPaintGenome } from '@/entities/form-renderers/d/paint-genome/prepared';
import { resolvePaintVeinVariant } from '@/entities/form-renderers/d/paint-genome/topology';

export { r100PresentationIdentity, validR100PresentationState } from './r100-world/presentation-state';
export type { R100PresentationState } from './r100-world/presentation-state';
export type { PaintedMaterial } from './r100-world/painted-material';

// Keys retain no generated maps or scene owners. The material loader owns one
// immutable pair per registered family (currently six 512px RGBA buffers).
// At most three prepared package/family identities are retained as aliases.
const prepared = new Map<string, PaintedMaterial>();
const PREPARED_LIMIT = 3;

function preparationKey(recipe: WorldProductionRecipeV3): string {
  if (!validR100ProductionRecipe(recipe)) throw new Error('Native material preparation requires an available frozen v3 package');
  return `${recipe.package.dependencyHash}:${materialFamilies(recipe).join(',')}`;
}

function materialFamilies(recipe: WorldProductionRecipeV3): NativeVolumeFamily[] {
  return [...new Set([recipe.nativeDefinition.family,...recipe.nativeDefinition.instances.map(instance=>instance.family??recipe.nativeDefinition.family)])];
}

function abortError(): DOMException {
  return new DOMException('Native material preparation was cancelled', 'AbortError');
}

/** A cancelled subscriber leaves a shared decode available to other subscribers,
 * but may neither publish a prepared scene entry nor retain its abort listener. */
function observeAbort<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return request;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const aborted = (): void => { cleanup(); reject(abortError()); };
    const cleanup = (): void => signal.removeEventListener('abort', aborted);
    signal.addEventListener('abort', aborted, { once: true });
    request.then(value => { cleanup(); if (signal.aborted) reject(abortError()); else resolve(value); },
      reason => { cleanup(); reject(reason); });
  });
}

interface PreparedSurface {
 readonly renderer:MasterSurfaceRenderer;
 readonly layout:GeneratedRiftLayout;
 readonly paintHosts:readonly PreparedPaintGenome[];
 readonly gameplay:R100PreparedGameplay;
 readonly releaseGameplay:()=>void;
 readonly release:()=>void;
}
// GPU ownership is separate from shared source pixels. No abandoned prepared
// scene can retain a context after cancel, replacement or bounded eviction.
const surfaces=new Map<string,PreparedSurface>();
const preparations=new Map<string,symbol>();
const surfaceClient=new R100SurfacePreparationClient();
const SURFACE_LIMIT=2;
function discardSurface(key:string):void {
 const entry=surfaces.get(key);if(!entry)return;
 surfaces.delete(key);entry.release();entry.releaseGameplay();entry.renderer.destroy();
}
/** Drop an unconsumed preparation after an entry transaction is abandoned. */
export function discardPreparedR100Presentation(world:WorldProductionMap):void {
 if(world.native)discardSurface(r100SurfaceIdentity(world.native));
}
function yieldPreparation(signal?:AbortSignal):Promise<void>{
 return new Promise((resolve,reject)=>setTimeout(()=>signal?.aborted?reject(abortError()):resolve(),0));
}
export async function prepareR100Presentation(recipe:WorldProductionRecipeV3,
 options:{readonly signal?:AbortSignal;readonly world:WorldProductionMap}):Promise<PaintedMaterial>{
 if(options.signal?.aborted)throw abortError();
 const key=preparationKey(recipe),native=options.world.native;
 if(!native||native.packageHash!==recipe.package.dependencyHash||native.definition.id!==recipe.nativeDefinition.id)
  throw new Error('Native preparation requires its admitted generated world');
 const surfaceKey=r100SurfaceIdentity(native),ticket=Symbol(surfaceKey);
 preparations.set(surfaceKey,ticket);discardSurface(surfaceKey);
 let renderer:MasterSurfaceRenderer|undefined;
 try {
  const families=materialFamilies(recipe);
  const sources=await observeAbort(Promise.all(families.map(family=>loadPaintedMaterial(family,family===recipe.nativeDefinition.family?recipe.appearance?.materialOrganization:undefined))),options.signal);
  const material:PaintedMaterial=Object.freeze({...sources[0]!,
   ...(native.appearance?{appearance:native.appearance}:{}),
   ...(families.length>1?{families:Object.freeze(Object.fromEntries(families.map((family,index)=>[family,sources[index]!])))}:{})});
  const result=await surfaceClient.prepare({native,layout:options.world.layout,painting:material},options.signal);
  await yieldPreparation(options.signal);
  if(preparations.get(surfaceKey)!==ticket)throw abortError();
  renderer=new MasterSurfaceRenderer(hydrateR100MasterWorld(native,options.world.layout),undefined,undefined,material,result.surface);
  // Permit cancellation and UI paint after GPU creation, before publishing.
  await yieldPreparation(options.signal);
  if(preparations.get(surfaceKey)!==ticket)throw abortError();
  const cancelled=():void=>discardSurface(surfaceKey);
  const release=():void=>options.signal?.removeEventListener('abort',cancelled);
  options.signal?.addEventListener('abort',cancelled,{once:true});
  const releaseGameplay=installR100PreparedGameplay(options.world.layout,native,result.gameplay);
  surfaces.set(surfaceKey,{renderer,layout:options.world.layout,release,releaseGameplay,gameplay:result.gameplay,paintHosts:result.paintHosts});renderer=undefined;
  while(surfaces.size>SURFACE_LIMIT)discardSurface(surfaces.keys().next().value!);
  prepared.delete(key);prepared.set(key,material);
  while(prepared.size>PREPARED_LIMIT)prepared.delete(prepared.keys().next().value!);
  return material;
 }finally{
  renderer?.destroy();
  if(preparations.get(surfaceKey)===ticket)preparations.delete(surfaceKey);
 }
}

/** Scene creation is synchronous. Missing/stale preparation fails before the
 * scene allocates render resources, rather than briefly showing another world. */
export function getPreparedR100Presentation(recipe: WorldProductionRecipeV3): PaintedMaterial {
  const key = preparationKey(recipe), material = prepared.get(key);
  if (!material) throw new Error('Native materials were not prepared before scene creation');
  prepared.delete(key); prepared.set(key, material);
  return material;
}

export interface R100WorldPresentation {
  readonly world: MasterWorld;
  readonly sourceRegions: ReadonlyMap<string,SourceRegionAssignment>;
  readonly takePaintGenome: (form:ContaminationForm,seed:number,fragmentTypeId:string)=>PreparedPaintGenome;
  readonly createRuntime: (context: RiftDevRuntimeContext) => MasterPresentation;
  /** Release only this scene's preparation if construction ended before handoff. */
  readonly disposeUnconsumed: () => void;
}

export function createR100WorldPresentation(native: R100NativeWorldData, layout: GeneratedRiftLayout,
  painting: PaintedMaterial): R100WorldPresentation {
  const families=new Set([native.definition.family,...native.definition.instances.map(instance=>instance.family??native.definition.family)]);
  for(const family of families){
  const definition = paintedMaterialDefinition(family,family===native.definition.family?native.appearance?.materialOrganization:undefined),source=family===native.definition.family?painting:painting.families?.[family];
  if (!definition || !source || source.source !== definition.source || source.solid?.source !== definition.solid.source
    || source.width !== definition.logical_pixels || source.height !== definition.logical_pixels
    || source.pixels.length !== source.width * source.height * 4
    || source.solid.width !== definition.solid.logical_pixels || source.solid.height !== definition.solid.logical_pixels
    || source.solid.pixels.length !== source.solid.width * source.solid.height * 4)
    throw new Error('Prepared native material does not match the frozen world family');
  }
  const world = hydrateR100MasterWorld(native, layout),surfaceKey=r100SurfaceIdentity(native);
  const ownedEntry=surfaces.get(surfaceKey);
  if(!ownedEntry)throw new Error('Native surface was not prepared before scene creation');
  if(ownedEntry.layout!==layout)throw new Error('Native surface belongs to a different admitted layout');
  const paintHosts=new Map(ownedEntry.paintHosts.map(row=>[row.key,row]));
  return { world, sourceRegions:new Map(ownedEntry.gameplay.sourceRegions), disposeUnconsumed() {
    paintHosts.clear();
    // A delayed shutdown must never release a newer preparation of this seed.
    // Once consumed, the runtime owns its renderer and this does nothing to it.
    if(surfaces.get(surfaceKey)===ownedEntry)discardSurface(surfaceKey);
  }, takePaintGenome(form,seed,fragmentTypeId) {
    const key=paintGenomePreparationKey({substrate:form.substrate,coverage:form.coverage,seed,continuity:form.continuity,
      sense:form.lexemes.sense,rhythm:form.lexemes.rhythm,fragmentTypeId,veinVariant:resolvePaintVeinVariant(form.substrate,seed),geometryVersion:2});
    const prepared=paintHosts.get(key);
    if(!prepared)throw new Error('Native paint Host was not prepared or was already consumed');
    paintHosts.delete(key);return prepared;
  }, createRuntime(context) {
    if (context.layout !== layout) throw new Error('Native presentation and gameplay must own the same admitted layout');
    const entry=surfaces.get(surfaceKey);
    if(entry!==ownedEntry)throw new Error('Prepared native surface was already consumed or cancelled');
    surfaces.delete(surfaceKey);entry.release();
    try{return new MasterPresentation(context,world,painting,entry.renderer,entry.gameplay.sourceCells);}
    catch(error){entry.releaseGameplay();entry.renderer.destroy();throw error;}
  } };
}
