/** Preserve exploration rules on the actual final 20px body graph. */
import {GAME_CONSTANTS} from '@/config/constants';
import {nativeCellPoint,type NativeSpatialGeometry} from './native-spatial-geometry';
import {nativeSpatialShortestPaths} from './native-spatial-visibility';
import {selectSpatialExtraction,type SpatialExtractionPolicy,type SpatialExtractionField,type SpatialExtractionCandidate} from './spatial-extraction-selection';

export function selectNativeSpatialExtraction(geometry:NativeSpatialGeometry,policy:SpatialExtractionPolicy,seed:number) {
  const {cols,rows,spawnPoint:spawn}=geometry.terrain,start=Math.floor(spawn.y/8)*cols+Math.floor(spawn.x/8);
  const paths=nativeSpatialShortestPaths(geometry,[start]),distances=Float64Array.from(paths.distance,d=>d/1000);
  let maxPathDistancePx=0;
  for(const cell of paths.visited)maxPathDistancePx=Math.max(maxPathDistancePx,distances[cell]!);
  const minPath=Math.max(policy.minPathDistancePx,maxPathDistancePx*policy.minPathFraction),maxPath=maxPathDistancePx*policy.maxPathFraction;
  const candidates:SpatialExtractionCandidate[]=[],regionCounts:Record<number,number>={},distanceBandCounts:Record<number,number>={};
  const trigger=GAME_CONSTANTS.EXTRACTION.TRIGGER_RADIUS,offsets:{dx:number;dy:number}[]=[];
  for(let dy=-Math.floor(trigger/8);dy<=Math.floor(trigger/8);dy++)for(let dx=-Math.floor(trigger/8);dx<=Math.floor(trigger/8);dx++)if(Math.hypot(dx*8,dy*8)<=trigger)offsets.push({dx,dy});
  let minCandidatePathDistancePx=Infinity,maxCandidatePathDistancePx=0;
  for(let cell=0;cell<distances.length;cell++){
    const pathDistancePx=distances[cell]!;
    if(!Number.isFinite(pathDistancePx)||pathDistancePx<minPath||pathDistancePx>maxPath)continue;
    const point=nativeCellPoint(cell,cols),euclideanDistancePx=Math.hypot(point.x-spawn.x,point.y-spawn.y);
    if(euclideanDistancePx<policy.minEuclideanDistancePx||!geometry.collision.supports(point,policy.clearanceHalfSize,policy.clearanceHalfSize))continue;
    let interactionPathDistancePx=pathDistancePx;const col=cell%cols,row=Math.floor(cell/cols);
    for(const {dx,dy}of offsets){const x=col+dx,y=row+dy;if(x>=0&&y>=0&&x<cols&&y<rows)interactionPathDistancePx=Math.min(interactionPathDistancePx,distances[y*cols+x]!);}
    if(interactionPathDistancePx<minPath)continue;
    const regionCol=Math.min(policy.regionCols-1,Math.floor(point.x/(cols*8)*policy.regionCols)),regionRow=Math.min(policy.regionRows-1,Math.floor(point.y/(rows*8)*policy.regionRows));
    const regionId=regionRow*policy.regionCols+regionCol,distanceBand=Math.min(policy.distanceBands-1,Math.floor((pathDistancePx-minPath)/Math.max(8,maxPath-minPath)*policy.distanceBands));
    candidates.push({point,cell,pathDistancePx,interactionPathDistancePx,euclideanDistancePx,pathFraction:pathDistancePx/maxPathDistancePx,regionId,distanceBand});
    minCandidatePathDistancePx=Math.min(minCandidatePathDistancePx,pathDistancePx);maxCandidatePathDistancePx=Math.max(maxCandidatePathDistancePx,pathDistancePx);
    regionCounts[regionId]=(regionCounts[regionId]??0)+1;distanceBandCounts[distanceBand]=(distanceBandCounts[distanceBand]??0)+1;
  }
  if(!candidates.length)throw new Error(`Native extraction has no legal exploration candidate (reachable=${paths.visited.length}, maxPath=${Math.round(maxPathDistancePx)})`);
  const field:SpatialExtractionField={cols,rows,tileSize:8,spawn,policy,distances,parents:paths.parent,candidates,
    summary:{reachableCount:paths.visited.length,maxPathDistancePx,minCandidatePathDistancePx,maxCandidatePathDistancePx,candidateCount:candidates.length,
      regionCount:Object.keys(regionCounts).length,distanceBandCount:Object.keys(distanceBandCounts).length,regionCounts,distanceBandCounts}};
  return{extraction:selectSpatialExtraction(field,seed),summary:field.summary};
}
