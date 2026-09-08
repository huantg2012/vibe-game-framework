/** R3 surface anatomy. The occupancy field remains the sole footprint source. */
import type { CoverageId } from '@/generated/contamination-lexicon-data';
import type { FormVisualPose } from '@/entities/form-renderers/form-renderer';
import { ENV_INK as C, activityOf, cluster, putPixel, stageOf, type Ink } from '../environment-pixels';

export function paintSurfaceMaterial(
  out: Uint8ClampedArray, field: Float32Array, w: number, h: number,
  substrate: string, coverage: CoverageId, seed: number, elapsedMs=0, pose?: FormVisualPose,
): void {
  out.fill(0);
  const stage=stageOf(coverage), activity=activityOf(pose);
  const phase=elapsedMs*Math.PI*2/2400;
  const inflated=pose?.signal==='inflated';
  const lift=activity*(inflated?1:.45);
  const cx=w*.5,cy=h*.5;
  for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++) {
    const i=y*w+x, v=field[i]!;
    if(v<.1) continue;
    const r=Math.hypot(x-cx,y-cy), a=Math.atan2(y-cy,x-cx);
    const north=field[i-w]!<.1, south=field[i+w]!<.1;
    const edge=north||south||field[i-1]!<.1||field[i+1]!<.1;
    let ink:Ink=C.shadow, alpha=255;
    if(substrate==='fungal_mat') {
      // Overlapping, frilled shelves with directional gills. Coverage bends
      // the growth axis and breaks the concentric order into offset lobes.
      const fold=((Math.floor(y*.65+Math.sin(x*.16+stage*.3)*(3+stage)+Math.sin(y*.09)*2+Math.sin(phase-y*.08)*lift*1.8)%7)+7)%7;
      ink=fold<=1?C.seam:fold===2?C.ridge:fold<5?C.body:C.shadow;
      if(north) ink=C.ridge;
      if(south) ink=C.seam;
      if(cluster(x,y,seed)===3&&fold>2&&fold<5) ink=C.shadow;
      if(stage>0&&Math.abs(Math.sin(a*(3+stage)+r*.08))<.1&&fold===2) ink=C.teal;
    } else if(substrate==='oil_film') {
      // Dense meniscus, long broken reflections, thin dark interior. Stable
      // seed topology retains beads/smear/rim-pool; this is liquid, not flesh.
      const ribbon=Math.floor(y+Math.sin(x*.11+stage*.4)*(2+stage)+Math.sin(phase)*lift*2)%12;
      ink=C.oil;
      if(north) ink=C.oilRidge;
      else if(south) ink=C.seam;
      else if(ribbon===2&&cluster(x,y,seed)<7) ink=C.oilRidge;
      else if(ribbon===3&&cluster(x,y,seed)<4) ink=C.body;
      if(stage>0&&ribbon===8&&Math.floor(x/5)%3===1) ink=C.shadow;
      if(stage===2&&ribbon===9&&Math.floor(x/4)%5===0) ink=C.teal;
    } else {
      // Ash is a stack of torn settling laminae. Its seams drift laterally;
      // it has neither fungal radial gills nor liquid specular crescents.
      const shear=Math.round(Math.sin(phase+y*.12)*lift*(1+stage));
      const fold=(y+Math.floor(x/8)*(stage+1)+shear+1000)%8;
      ink=fold===0?C.seam:fold<3?C.ash:fold<5?C.ashShadow:C.shadow;
      if(north) ink=C.ash;
      if(south) ink=C.seam;
      if(cluster(x,y,seed)===5&&fold>2) ink=C.ashShadow;
      if(stage>0&&fold===1&&Math.floor(x/4)%7===0) ink=C.teal;
    }
    if(edge&&cluster(x,y,seed)<2) ink=C.shadow;
    // Tiny anatomy pores are not independent hittable cores. The shared host
    // core sits at the pinned centre and gets the single bright focal mark.
    if(v>=.78) ink=activity>.35?C.teal:C.body;
    if(activity<.3&&ink===C.teal) ink=C.body;
    if(ink===C.teal&&inflated) ink=C.lit;
    putPixel(out,w,h,x,y,ink,alpha);
  }
  // Hittable nuclei are painted by the Host at their real deployed positions.
}
