import { validateSearchSites as validateRevision11SearchSites } from '../legacy-r100-v11/executor-recovery.js';
import { validateSearchSites as validateRevision10SearchSites } from '../legacy-r100-v10/executor-recovery.js';
import { validateSearchSites as validateRevision9SearchSites } from '../legacy-r100-v9/executor-recovery.js';
/** Environmental context is ranked only after the expedition's physical/risk admission. */
import {mix32} from '@/generation/seed-fork';
import {hasLineOfSight} from '@/utils/grid-raycast';
import type {Vector2} from '@/types/game-types';
import type {MasterWorld} from './r100-master-world';
import {NATIVE_VOLUME_FAMILY_SEQUENCE, type NativeVolumeMesh} from './native-volume-geometry';
import type {R100SearchSitePlacement, R100SearchSitePolicy} from './search-site-types';

const tau = Math.PI * 2;
const direction = (angle: number): number => ((angle % tau) + tau) % tau;
const finitePoint = (point: unknown): point is Readonly<Vector2> => Boolean(point && typeof point === 'object'
  && Number.isFinite((point as Vector2).x) && Number.isFinite((point as Vector2).y));
export function validSearchSitePolicy(value: unknown, worldId: string): value is R100SearchSitePolicy {
  if (!value || typeof value !== 'object') return false;
  const p = value as R100SearchSitePolicy;
  return Object.keys(p).sort().join(',') === 'algorithm,environmentScoreCap,footprintProfile,peelPreference,sourceHash,sourceReachPx,version,worldId'
    && p.version === 1 && p.algorithm === 'grounded-search-v1' && p.worldId === worldId
    && /^[a-f0-9]{64}$/.test(p.sourceHash) && p.footprintProfile === 'grounded-material-v1'
    && Number.isFinite(p.sourceReachPx) && p.sourceReachPx >= 24 && p.sourceReachPx <= 96
    && Number.isFinite(p.environmentScoreCap) && p.environmentScoreCap >= 0 && p.environmentScoreCap <= 16
    && Number.isFinite(p.peelPreference) && p.peelPreference >= 0 && p.peelPreference <= 1;
}
interface SurfacePoint {readonly point: Readonly<Vector2>; readonly distance: number; readonly mesh: NativeVolumeMesh}
interface SiteContext {readonly score: number; readonly site: Omit<R100SearchSitePlacement, 'nodeId'>}
function segmentPoint(x: number,y: number,ax: number,ay: number,bx: number,by: number): Vector2 {
  const dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy;
  const t=length===0?0:Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/length));
  return{x:ax+t*dx,y:ay+t*dy};
}
/** Real projected triangles only; appended world shores are not a fabricated parent. */
function nearestFormation(world: MasterWorld, point: Readonly<Vector2>, reach: number, onlyObjectId?: number): SurfacePoint | null {
  let best: SurfacePoint | null = null, distance = reach;
  for (const mesh of world.meshes) {
    if (onlyObjectId !== undefined && mesh.spec.id !== onlyObjectId) continue;
    const b=mesh.bounds;
    if(Math.hypot(Math.max(b.minX-point.x,0,point.x-b.maxX),Math.max(b.minY-point.y,0,point.y-b.maxY))>distance)continue;
    const p=mesh.positions,count=mesh.groundEdgeStart?.triangle??mesh.triangleCount;
    for(let face=0;face<count;face++){
      const a=mesh.indices[face*3]!*3,c=mesh.indices[face*3+1]!*3,d=mesh.indices[face*3+2]!*3;
      const ax=p[a]!,ay=p[a+1]!,bx=p[c]!,by=p[c+1]!,cx=p[d]!,cy=p[d+1]!;
      if(Math.hypot(Math.max(Math.min(ax,bx,cx)-point.x,0,point.x-Math.max(ax,bx,cx)),
        Math.max(Math.min(ay,by,cy)-point.y,0,point.y-Math.max(ay,by,cy)))>distance)continue;
      const cross=(x1:number,y1:number,x2:number,y2:number):number=>(x2-x1)*(point.y-y1)-(y2-y1)*(point.x-x1);
      const e0=cross(ax,ay,bx,by),e1=cross(bx,by,cx,cy),e2=cross(cx,cy,ax,ay);
      const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
      const interior=Math.abs(area)>1e-7&&((e0>=0&&e1>=0&&e2>=0)||(e0<=0&&e1<=0&&e2<=0));
      const candidates=interior?[point]:[segmentPoint(point.x,point.y,ax,ay,bx,by),segmentPoint(point.x,point.y,bx,by,cx,cy),segmentPoint(point.x,point.y,cx,cy,ax,ay)];
      for(const candidate of candidates){
        const gap=Math.hypot(candidate.x-point.x,candidate.y-point.y);
        if(gap>distance || (gap===distance&&best&&mesh.spec.id>=best.mesh.spec.id)
          ||!world.matterAt(candidate.x,candidate.y)||!hasLineOfSight(world.sight,point,candidate,reach+.001))continue;
        best={point:{x:candidate.x,y:candidate.y},distance:gap,mesh};distance=gap;
      }
    }
  }
  return best;
}
/** One generation-scoped cache. It is never retained by a scene or a saved map. */
export class SearchSitePlanner {
  private readonly contexts = new Map<string, SiteContext>();
  private readonly meshes: ReadonlyMap<number, NativeVolumeMesh>;
  constructor(private readonly world: MasterWorld, private readonly policy: R100SearchSitePolicy) {
    this.meshes = new Map(world.meshes.map(mesh=>[mesh.spec.id,mesh]));
  }
  score(position: Readonly<Vector2>): number { return this.sample(position).score; }
  placement(nodeId: string, position: Readonly<Vector2>): R100SearchSitePlacement {
    return {nodeId, ...this.sample(position).site};
  }
  private sample(position: Readonly<Vector2>): SiteContext {
    const key=`${position.x},${position.y}`,cached=this.contexts.get(key);if(cached)return cached;
    const world=this.world,policy=this.policy,r=world.raster;
    if(!world.matterAt(position.x,position.y))throw new Error('Search-site core lacks actual terrain');
    const visualSeed=mix32(world.sample.seed,`grounded-search-v1:${key}`);
    const unit=mix32(visualSeed,'environment-relation')/0x100000000;
    const i=Math.floor(position.y)*r.width+Math.floor(position.x);
    const rasterLocal=world.roleAt(position.x,position.y)==='relief'?this.meshes.get(r.objectId[i]!):undefined;
    // Shore geometry shares its owner's raster ID but is not the original formation.
    const local=rasterLocal ? nearestFormation(world,position,.001,rasterLocal.spec.id)?.mesh : undefined;
    const nearby=local?null:nearestFormation(world,position,policy.sourceReachPx);
    const detached=nearby && unit < 1-nearby.distance/policy.sourceReachPx ? nearby : null;
    const formation=local??detached?.mesh;
    const sourceKind=local?'surface-peel':detached?'detached'
      :mix32(visualSeed,'ground-layer-relation')/0x100000000<policy.peelPreference?'surface-peel':'ground-accumulation';
    const site:Omit<R100SearchSitePlacement,'nodeId'>={version:1,position:{x:position.x,y:position.y},visualSeed,sourceKind,
      family:formation?.spec.family??world.definition.family,groundFamily:world.definition.family,
      sourceObjectId:formation?.spec.id??null,sourceAnchor:local?{x:position.x,y:position.y}:detached?.point??null,
      sourceDomain:formation?'formation':'ground',axis:direction(formation?.spec.rotation??world.definition.axis),footprintProfile:policy.footprintProfile};
    // Existing route/risk/spacing score remains dominant; even strongest context
    // cannot add more than the CSV cap (currently 12 versus 64 random spread).
    const quality = detached ? 1 - detached.distance / policy.sourceReachPx : local ? .75 : sourceKind === 'surface-peel' ? .45 : .25;
    const value={site,score:Math.max(0,Math.min(policy.environmentScoreCap,quality*policy.environmentScoreCap))};
    this.contexts.set(key,value);return value;
  }
}
/** Small receiving-thread validation: no generation, material baking or reward reads. */
export function validateSearchSites(world: MasterWorld): void {
  if(world.algorithmRevision===9){validateRevision9SearchSites(world);return;}
  if(world.algorithmRevision===10){validateRevision10SearchSites(world);return;}
  if(world.algorithmRevision===11){validateRevision11SearchSites(world);return;}
  if(world.algorithmRevision!==12){if(world.searchSites!==undefined)throw new Error('Historical world cannot acquire grounded search sites');return;}
  const nodes=[...world.layout.kindlingNodes,...world.layout.contaminantNodes],sites=world.searchSites;
  if(!sites||sites.length!==nodes.length)throw new Error('Grounded search sites must cover every admitted node');
  const ids=new Set<string>(),instances=new Map(world.meshes.map(mesh=>[mesh.spec.id,mesh]));
  for(const site of sites){
    if (!site || typeof site !== 'object' || Object.keys(site).sort().join(',') !== 'axis,family,footprintProfile,groundFamily,nodeId,position,sourceAnchor,sourceDomain,sourceKind,sourceObjectId,version,visualSeed') throw new Error('Unexpected grounded search-site fields');
    const node=nodes.find(node=>node.id===site.nodeId);
    if(!node||ids.has(site.nodeId)||site.version!==1||!finitePoint(site.position)||site.position.x!==node.position.x||site.position.y!==node.position.y
      ||!world.matterAt(site.position.x,site.position.y)||!Number.isSafeInteger(site.visualSeed)||site.visualSeed<0||site.visualSeed>0xffffffff
      ||!NATIVE_VOLUME_FAMILY_SEQUENCE.includes(site.family)||site.groundFamily!==world.definition.family
      ||!['detached','surface-peel','ground-accumulation'].includes(site.sourceKind)||site.footprintProfile!=='grounded-material-v1'
      ||!Number.isFinite(site.axis)||site.axis<0||site.axis>=tau)throw new Error('Invalid grounded search-site identity');
    ids.add(site.nodeId);
    if (site.visualSeed !== mix32(world.sample.seed, `grounded-search-v1:${site.position.x},${site.position.y}`)) throw new Error('Grounded search-site visual seed changed');
    if(site.sourceDomain==='ground'){
      if(site.sourceObjectId!==null||site.sourceAnchor!==null||site.family!==site.groundFamily||site.sourceKind==='detached'
        ||site.axis!==direction(world.definition.axis))throw new Error('Ground site claims a fictitious formation or material direction');
    }else if(site.sourceDomain==='formation'){
      const mesh=site.sourceObjectId===null?undefined:instances.get(site.sourceObjectId);
      if(!mesh||mesh.spec.family!==site.family||!finitePoint(site.sourceAnchor)||!world.matterAt(site.sourceAnchor.x,site.sourceAnchor.y)
        ||Math.hypot(site.sourceAnchor.x-site.position.x,site.sourceAnchor.y-site.position.y)>96.001
        ||!hasLineOfSight(world.sight,site.position,site.sourceAnchor,96.002)||site.sourceKind==='ground-accumulation')throw new Error('Invalid search-site material provenance');
      if (!nearestFormation(world, site.sourceAnchor, .001, mesh.spec.id) || site.axis !== direction(mesh.spec.rotation)) throw new Error('Search-site parent is not the claimed original surface');
      if (site.sourceKind === 'surface-peel' && (site.sourceAnchor.x !== site.position.x || site.sourceAnchor.y !== site.position.y
        || world.roleAt(site.position.x, site.position.y) !== 'relief')) throw new Error('Formation peel must share its real walkable surface');
    }else throw new Error('Unknown search-site source domain');
  }
}
