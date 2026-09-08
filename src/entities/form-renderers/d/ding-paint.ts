/** R3: three non-material hazards, not three tints of the same cloud. */
import type { FormVisualPose } from '@/entities/form-renderers/form-renderer';
import type { DingRecipe } from './ding-recipe';
import type { CloudPose } from './ding-cloud';
import { ENV_INK as C, activityOf, cluster, pixelLine, putPixel, stageOf, type Ink } from './environment-pixels';

export function paintDingFrame(
  out: Uint8ClampedArray,w: number,h: number,recipe: DingRecipe,
  pose: FormVisualPose,elapsedMs: number,box: CloudPose,
): void {
  out.fill(0);
  const stage=stageOf(recipe.coverage), active=activityOf(pose);
  const phase=elapsedMs*Math.PI*2/2400;
  const x0=Math.round(box.cx-box.rx), x1=Math.round(box.cx+box.rx)-1;
  const y0=Math.round(box.cy-box.ry), y1=Math.round(box.cy+box.ry)-1;
  const width=x1-x0,height=y1-y0;
  const p=(x:number,y:number,ink:Ink,a=255):void=>{
    if(x<x0||x>x1||y<y0||y>y1) return; putPixel(out,w,h,x,y,ink,a);
  };
  const line=(ax:number,ay:number,bx:number,by:number,ink:Ink,a=255,thick=1):void=>{
    // All internal geometry is designed within the live AABB; no fabricated
    // ellipsoid danger zone extending beyond the host's actual occupied box.
    pixelLine(out,w,h,Math.max(x0,Math.min(x1,ax)),Math.max(y0,Math.min(y1-thick+1,ay)),Math.max(x0,Math.min(x1,bx)),Math.max(y0,Math.min(y1-thick+1,by)),ink,a,thick);
  };
  // Deposit depth varies over a broad inward band. Nothing is drawn along
  // the exact four bounding edges: they must not read as a selection box.
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) {
    const edge=Math.min(x-x0,x1-x,y-y0,y1-y);
    const grain=cluster(x+17,y-31,recipe.seed);
    const inset=3+cluster(x-23,y+19,recipe.seed+7);
    const interior=edge>13?1:Math.max(0,Math.min(1,(edge-1)/(8+grain*.6)));
    const alpha=Math.round((28+active*20)*interior);
    if(alpha>0)p(x,y,C.seam,alpha);
    // Sparse small flakes at different distances from the perimeter, with
    // larger missing groups. All stay within the live billed AABB.
    if(edge>=3&&edge<15&&Math.abs(edge-inset)<2&&grain<4&&cluster(x+41,y+7,recipe.seed+31)<5)
      p(x,y,grain===0?C.body:C.shadow,48+Math.round(active*24));
  }
  if(recipe.family==='sound_echo') {
    // A phrase repeats as paired pressure scars. At higher coverage the
    // repetitions lose their common origin and develop counter-flowing lobes.
    const rings=3+stage*2;
    for(let r=0;r<rings;r++) {
      const travel=(.5+.5*Math.sin(phase-r*.72))*active;
      const rad=(r+1)/(rings+1)*.8+travel*.08;
      const ox=stage===2?Math.sin(r*2.3)*width*.12:0;
      let last:{x:number;y:number}|null=null;
      for(let k=0;k<=80;k++) {
        const angle=k*Math.PI*2/80;
        const broken=(k+Math.floor(r*3))%17;
        const warp=1+Math.sin(angle*(2+stage)+r)*(.025+stage*.045);
        const x=Math.round(box.cx+ox+Math.cos(angle)*width*.48*rad*warp);
        const y=Math.round(box.cy+Math.sin(angle)*height*.46*rad*warp);
        if(broken>12) {last=null;continue;}
        if(last) line(last.x,last.y,x,y,k%7<3?C.body:C.shadow,150+Math.round(active*65),2);
        if(last&&k%9<4) line(last.x,last.y-2,x,y-2,C.ridge,70+Math.round(active*100));
        last={x,y};
      }
    }
    for(let k=0;k<4+stage;k++) {
      const x=box.cx+(k-(3+stage)/2)*4,y=box.cy+Math.sin(phase-k)*active*3;
      line(x,y-3,x,y+3,k%2?C.teal:C.body,180);
    }
  } else if(recipe.family==='light_scatter') {
    // Parallel fractured shafts split at a displaced refraction joint. Short
    // banded slivers imply light without a solid triangular prism body.
    const shafts=3+stage*2;
    for(let k=0;k<shafts;k++) {
      const anchor=(k+1)/(shafts+1), x=x0+width*anchor;
      const start=y0+5+(k*13+recipe.seed)%18;
      const knee=y0+height*(.35+.15*Math.sin(k+recipe.seed));
      const bend=(4+stage*7)*Math.sin(k*2.1+phase)*active;
      const stop=y1-4-(k*7)%19;
      const slant=Math.sin(k*1.7+recipe.seed)*.18;
      for(let y=start;y<stop;y++) {
        if(y>knee-2&&y<knee+3)continue;
        const t=(y-knee)/Math.max(1,stop-knee);
        const rayX=x+(y-start)*slant+(y>knee?bend*t:0);
        const radius=1+((Math.floor((y-start)/13)+k)%3===0?1:0);
        for(let dx=-radius;dx<=radius;dx++) {
          if(cluster(rayX+dx,y,k+recipe.seed)===3&&Math.abs(dx)===radius)continue;
          const ink=dx===0?C.ridge:dx<0?C.teal:C.shadow;
          p(Math.round(rayX+dx),y,ink,dx===0?160+Math.round(active*60):95+Math.round(active*45));
        }
        if((y+k*3)%17<3) p(Math.round(rayX-3),y,C.body,110);
      }
      const joint=x+(knee-start)*slant;
      line(joint-3,knee,joint+3,knee+1,C.lit,110+Math.round(active*80));
      if(stage>0) line(joint+3,knee+4,joint+3+bend*.6,Math.min(y1-2,knee+14+stage*5),C.body,170,2);
    }
  } else {
    // Space repeats fragments of a floor joint at contradictory offsets.
    // The centre interval closes as activity rises; no fog-ball surrogate.
    const ribs=3+stage;
    const collapse=active*(3+stage*2)+Math.sin(phase)*active*2;
    for(let k=0;k<ribs;k++) {
      const y=y0+(k+1)*height/(ribs+1), offset=(k%2?1:-1)*(stage*3+collapse);
      const gap=Math.max(3,11-stage*2-collapse*.45);
      for(let side=-1;side<=1;side+=2) {
        const inner=box.cx+side*gap+offset;
        const outer=side<0?x0+4:x1-4;
        for(let q=0;q<4;q++) {
          const ink=q===0?C.ridge:q===3?C.seam:C.shadow;
          line(outer,y+q,inner,y+q,ink,q===0?190:230);
        }
        line(inner,y,inner+side*2,y+6+stage*2,C.body,210,2);
        // Broken two-pixel mortar edge rather than a smooth extruded face.
        for(let x=Math.min(outer,inner)+3;x<Math.max(outer,inner);x+=9) p(Math.round(x),Math.round(y+2),C.seam,255);
      }
      if(stage===2) line(box.cx+offset-2,y-4,box.cx+offset+2,y+6,C.teal,130+Math.round(active*80));
    }
  }
  if(recipe.paintStrikeCore) {
    const span=Math.max(2,recipe.strikeCorePx);
    for(let y=-span;y<=span;y++) for(let x=-span;x<=span;x++) {
      if(Math.abs(x)+Math.abs(y)>span+1) continue;
      p(Math.round(box.cx+x),Math.round(box.cy+y),Math.abs(x)+Math.abs(y)>span-1?C.seam:active>.3?C.teal:C.body);
    }
  }
}
