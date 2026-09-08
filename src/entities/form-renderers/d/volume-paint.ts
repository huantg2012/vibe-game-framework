/** New occupied volumes: material is drawn only where the authoritative field exists. */
import type { VolumePresenceFrame } from '@/systems/volume-presence';
import { sampleVolumeDensity } from '@/systems/volume-presence';
import { VOLUME_INKS,dustIdentity,volumeGrain,type MaterialVolumeFamily } from './volume-material';

export function isMaterialVolume(family:string):family is MaterialVolumeFamily {
 return family==='gas_mass'||family==='mist_bank'||family==='dust_swarm';
}
/** Canvas is centred on frame.rect; both scene and offline sheet call this. */
export function paintVolumePresence(
 out:Uint8ClampedArray,w:number,h:number,frame:Readonly<VolumePresenceFrame>,seed:number,coreSpan=0,activityOpacity=frame.active?1:.5,
):void {
 out.fill(0);
 if(!isMaterialVolume(frame.substrate))return;
 const family=frame.substrate,colors=VOLUME_INKS[family];
 const stage=frame.coverage==='infiltrate'?0:frame.coverage==='rewrite'?1:2;
 const originX=frame.rect.x+frame.rect.w*.5-w*.5,originY=frame.rect.y+frame.rect.h*.5-h*.5;
 const x0=Math.max(0,Math.floor((w-frame.rect.w)*.5)),x1=Math.min(w,Math.ceil((w+frame.rect.w)*.5));
 const y0=Math.max(0,Math.floor((h-frame.rect.h)*.5)),y1=Math.min(h,Math.ceil((h+frame.rect.h)*.5));
 const animation=frame.active?frame.elapsedMs:0;
 const materialTime=animation*(stage===2&&family==='dust_swarm'?-1:1);
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++) {
  const density=sampleVolumeDensity(frame,originX+x+.5,originY+y+.5);
  if(density<.035)continue;
  const dangerBody=density>=frame.dangerThreshold;
  let band=0,alpha=0;
  if(family==='gas_mass') {
   // Broken overlapping curls: volume is read through folded internal vapour,
   // rather than a solid concentric skin around the density contour.
   const px=Math.floor(x/2)*2,py=Math.floor(y/2)*2;
   const phase=animation*.001*(stage===2?-1:1);
   const curl=Math.sin(px*.16+Math.sin(py*.11+phase)*2.8-phase)
     +Math.sin(py*.22+Math.sin(px*.09-phase)*2+phase*.6)*.7;
   const grain=volumeGrain(px,py,seed);
   const fissure=stage>0&&Math.sin(px*.085-py*.12+phase*.8)>.55;
   band=Math.max(0,Math.min(4,Math.floor(density*2.7+curl*.85+(grain<3?.6:0))));
   alpha=density<.12?30:density<.25?65:density<.5?114:164;
   if(curl>.7){alpha+=40;band=Math.min(4,band+1);}
   if(curl<-.6){alpha=Math.max(45,alpha-62);band=Math.max(0,band-1);}
   if(fissure&&curl<.4){alpha=Math.max(48,alpha-42);band=stage===2?0:1;}
   if(stage>0&&curl>1.2&&grain===4)band=5;
  } else if(family==='mist_bank') {
   const px=Math.floor(x/2)*2,py=Math.floor(y/2)*2;
   const wave=Math.sin(px*.035+materialTime*.0005)*5
     +Math.sin(px*.092-materialTime*.0007+py*.047)*(2+stage);
   const track=py+wave;
   const strand=Math.sin(track*.81+Math.sin(py*.087)*2);
   const patch=volumeGrain(Math.floor((px+materialTime*.007)/8)*8,Math.floor(py/3)*3,seed);
   const broken=patch<4||Math.sin(px*.14-py*.08+materialTime*.0006)>.78;
   // Quiet vapour establishes the real occupied area; light catches only
   // short, unequal pieces of the suspended threads, with gaps between them.
   band=density>.55?1:0;
   alpha=density<.12?15:density<.35?28:48;
   if(strand>.12&&!broken){band=density>.6?3:2;alpha+=35+Math.floor(density*34);}
   if(strand>.72&&!broken&&patch>9){band=4;alpha+=15;}
   if(stage>0&&Math.sin(px*.053+py*.12-materialTime*.0009)>.7&&strand<.2){band=2;alpha+=27;}
   if(stage===2&&Math.sin(px*.09-py*.19+materialTime*.001)>.65){band=Math.max(0,band-1);alpha=Math.max(35,alpha-25);}
  } else {
   // The shared irregular clumps remain readable between their individual
   // fibres. No screen-space grain, repeating slash mask, or moving tile grid.
   // Broad translucent lint, with light scattered through its interior.
   // No dark spine or bright outlining that could read as a small animal.
   band=density>.58?2:1;
   alpha=density<.12?20:density<.25?43:density<.55?70:102;
  }
  // The shared contact threshold must never be hidden by texture holes.
  if(dangerBody)alpha=Math.max(family==='mist_bank'?50:family==='dust_swarm'?48:90,alpha);
  alpha=Math.round(alpha*activityOpacity);
  const color=colors[band]!;const i=(y*w+x)*4;
  out[i]=color[0];out[i+1]=color[1];out[i+2]=color[2];out[i+3]=alpha;
 }
 if(family==='dust_swarm')paintDustFragments(out,w,h,frame,seed,stage,animation,activityOpacity,originX,originY);
 if(coreSpan>0&&frame.hasPresence) {
  const cx=Math.round(frame.coreX-originX),cy=Math.round(frame.coreY-originY),half=Math.max(1,Math.ceil(coreSpan/2));
  for(let y=-half;y<=half;y++)for(let x=-half;x<=half;x++) {
   if(Math.abs(x)+Math.abs(y)>half+1)continue;
   const px=cx+x,py=cy+y;
   if(px<0||py<0||px>=w||py>=h||sampleVolumeDensity(frame,originX+px+.5,originY+py+.5)<frame.dangerThreshold)continue;
   const o=(py*w+px)*4,edge=Math.abs(x)+Math.abs(y)>=half;
   const color=edge?[28,51,43]:[102,176,139];out[o]=color[0]!;out[o+1]=color[1]!;out[o+2]=color[2]!;out[o+3]=Math.round(245*activityOpacity);
  }
 }

}

/** Each curl is attached to its own local parcel of air; only its tip flutters. */
function paintDustFragments(out:Uint8ClampedArray,w:number,h:number,frame:Readonly<VolumePresenceFrame>,seed:number,stage:number,time:number,opacity:number,originX:number,originY:number):void {
 const colors=VOLUME_INKS.dust_swarm;
 const ink=(wx:number,wy:number,band:number,alpha:number)=>{
  const px=Math.round(wx-originX),py=Math.round(wy-originY);
  if(px<0||py<0||px>=w||py>=h)return;
  const density=sampleVolumeDensity(frame,originX+px+.5,originY+py+.5);
  if(density<.035)return;
  const o=(py*w+px)*4,a=Math.round(alpha*opacity*Math.min(1,density*3.5));
  if(a<out[o+3]!)return;
  const c=colors[band]!;out[o]=c[0];out[o+1]=c[1];out[o+2]=c[2];out[o+3]=a;
 };
 for(let i=0;i<frame.partCount;i++){
  const part=frame.parts[i]!,count=7+Math.floor(dustIdentity(i*17,seed)*5)+stage;
  const cs=Math.cos(part.angle),sn=Math.sin(part.angle);
  for(let j=0;j<count;j++){
   const id=i*83+j*11,identity=dustIdentity(id,seed),type=dustIdentity(id+1,seed);
   const a=dustIdentity(id+2,seed)*Math.PI*2;
   const radius=Math.sqrt(dustIdentity(id+3,seed))*.73;
   const lx=Math.cos(a)*part.rx*radius,ly=Math.sin(a)*part.ry*radius;
   const phase=dustIdentity(id+4,seed)*Math.PI*2;
   const reverse=stage===2&&identity>.73?-1:1;
   const flutter=Math.sin(time/(910+identity*1300)*reverse+phase);
   const angle=part.angle+(identity-.5)*2.9+flutter*(.16+stage*.09);
   const dx=Math.cos(angle),dy=Math.sin(angle);
   const cx=part.cx+lx*cs-ly*sn,cy=part.cy+lx*sn+ly*cs;
   const altered=stage>0&&identity>(stage===1?.76:.55);
   const length=(type<.23?1:type<.77?3+Math.floor(identity*3):2+Math.floor(identity*2))+(altered?stage:0);
   const bright=identity>.94?4:identity>.46?3:2;
   const unusual=stage>0&&identity>.96?5:bright;
   for(let k=0;k<length;k++){
    const t=k/Math.max(1,length-1)-.5;
    // A bent filament has a stable spine and a slightly delayed loose tip.
    const bend=altered?Math.sin(t*(stage===2?6:4)+phase)*(.7+stage*.55)+t*t*flutter
     :type<.77?Math.sin(t*3+phase)*.45+t*t*flutter:0;
    const x=cx+dx*t*length-dy*bend,y=cy+dy*t*length+dx*bend;
    ink(x,y,unusual,115+Math.floor(identity*50));
    if(altered&&k===Math.floor(length*.6)){
     // Medium pollution begins to knot; high pollution folds a second short
     // strand back across the first instead of merely adding more speckles.
     for(let arm=1;arm<=stage+1;arm++)ink(x-dy*arm-dx*arm*.3,y+dx*arm-dy*arm*.3,stage===2?3:2,135);
    }
    if(type>=.77&&k>0){
     ink(x+dy,y-dx,unusual,140);
     if(k===length-1)ink(x+dy-dx,y-dx-dy,2,130);
    }
   }
  }
 }
}
