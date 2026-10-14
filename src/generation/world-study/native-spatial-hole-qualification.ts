/** Cheap complete-H qualification. This is real geometry work and must be
 * called only inside the controller's shared geometry-work budget. */
import {compileR100FragmentShape,type R100FrozenFragmentShape} from './r100-fragment-shape';
import {FragmentShapeError} from './fragment-shape';
import type {Vector2} from '@/types/game-types';
import {compareNativeSpatialConstraintScores,type NativeSpatialConstraintScore} from './native-spatial-wide-domain';
import type {NativeSpatialHolePlacement} from './native-spatial-structures';
import {identifyNativeSpatialVoid,identifyNativeSpatialHoles,rasterNativeSpatialFragment} from './native-spatial-void-identity';

export interface NativeSpatialHoleQualification {
  readonly accepted:boolean;readonly reasons:readonly string[];readonly invalidHoleIds:readonly string[];
}
export function qualifyNativeSpatialHoles(fragment:R100FrozenFragmentShape,requestedSeed:number,placements:readonly NativeSpatialHolePlacement[],expectedHoleCount:number):NativeSpatialHoleQualification {
  if(!Number.isSafeInteger(expectedHoleCount)||expectedHoleCount<1||placements.length!==expectedHoleCount)throw new Error('Native hole qualification requires complete H authoring');
  let compiled:ReturnType<typeof compileR100FragmentShape>;
  try{compiled=compileR100FragmentShape(fragment,requestedSeed);}catch(error){
    if(!(error instanceof FragmentShapeError))throw error;
    return{accepted:false,reasons:[`hole-identity-fragment-${error.code}`],invalidHoleIds:placements.map(p=>p.holeId)};
  }
  const {matter,cols,rows}=rasterNativeSpatialFragment(fragment.layout.authoringFrame[0]*2,fragment.layout.authoringFrame[1]*2,compiled.terrainOutline,compiled.erosion);
  const identities=identifyNativeSpatialVoid(matter,cols,rows),holes=identifyNativeSpatialHoles(cols,rows,identities.labels,compiled.erosion,placements),reasons:string[]=[];
  if(holes.records.some(row=>!row.valid))reasons.push('hole-profile-final-identity');
  if(holes.records.some(row=>row.duplicate))reasons.push('hole-profile-merged-identity');
  if(holes.orphanLabels.length||holes.orphanContours.length)reasons.push('hole-profile-unassigned-final-hole');
  return{accepted:!reasons.length,reasons,invalidHoleIds:holes.records.filter(row=>!row.valid||row.duplicate).map(row=>row.holeId)};
}

/** The existing per-object full-score quota. Qualification never refills it. */
export const NATIVE_SPATIAL_SITE_EVALUATION_LIMIT=12;

export interface NativeSpatialQualifiedSiteSelection {readonly site?:Readonly<Vector2>;readonly checks:number;readonly rejected:number}
export function selectNativeSpatialQualifiedSite(evaluated:readonly Readonly<{site:Readonly<Vector2>;score:NativeSpatialConstraintScore}>[],qualify:(site:Readonly<Vector2>)=>NativeSpatialHoleQualification):NativeSpatialQualifiedSiteSelection {
  if(evaluated.length>NATIVE_SPATIAL_SITE_EVALUATION_LIMIT)throw new Error('Native hole qualification exceeds the existing full-score quota');
  let checks=0,rejected=0;
  for(const entry of [...evaluated].sort((a,b)=>compareNativeSpatialConstraintScores(a.score,b.score))){
    const result=qualify(entry.site);checks++;
    if(result.accepted)return{site:entry.site,checks,rejected};rejected++;
  }
  return{checks,rejected};
}
