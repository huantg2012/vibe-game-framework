import type {NativeSpatialPolicy} from './native-spatial-types';

/** Complete 2H/1S units use the same density intent in sizing and packing. */
export function nativeAutoCounts(targetWalkAreaPx2:number,policy:NativeSpatialPolicy):Readonly<{holes:number;solids:number}> {
  const target=Math.round(targetWalkAreaPx2/(policy.planningCellFactor*policy.spacingPx**2));
  const solids=Math.max(policy.minSolidCount,Math.ceil(target/3)),holes=2*solids,total=holes+solids;
  if(total<Math.ceil(target*(1-policy.countToleranceRatio))||total>Math.floor(target*(1+policy.countToleranceRatio))
    ||Math.abs(holes-policy.holeToSolidRatio*solids)>Math.max(policy.holeCountAbsTolerance,policy.holeCountRelTolerance*solids))
    throw new Error('Automatic density unit is outside the frozen count contract');
  return{holes,solids};
}
