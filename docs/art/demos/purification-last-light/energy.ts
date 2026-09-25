import {add,cross,dot,mul,sub,unit,clamp,type V3,type EnergyVolume} from './model';
import type {Camera} from './render';

export const ENERGY_FRAMES=8;
export const ENERGY_PERIOD=4.8;
function hash(x:number,y:number,z:number):number {
  let h=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(z,1442695041);
  h=Math.imul(h^h>>>13,1274126177);return ((h^h>>>16)>>>0)/4294967296;
}
function noise(x:number,y:number,z:number):number {
  const a=Math.floor(x),b=Math.floor(y),c=Math.floor(z);
  let u=x-a,v=y-b,w=z-c;u=u*u*(3-2*u);v=v*v*(3-2*v);w=w*w*(3-2*w);
  let n=0;for(let i=0;i<2;i++)for(let j=0;j<2;j++)for(let k=0;k<2;k++)n+=hash(a+i,b+j,c+k)*(i?u:1-u)*(j?v:1-v)*(k?w:1-w);
  return n;
}

/** Density emits throughout a real three-dimensional region. There is no
 * opaque surface or lit mesh shell. Looped advection moves the internal
 * concentrations inside a slow expansion and a faster forced compression. */
function sample(x:number,y:number,z:number,phase:number,seed:number):readonly[number,number] {
  const ca=Math.cos(phase),sa=Math.sin(phase);
  const cycle=phase/(Math.PI*2);
  const expansion=cycle<.7?(1-Math.cos(Math.PI*cycle/.7))*.5:(1+Math.cos(Math.PI*(cycle-.7)/.3))*.5;
  // The core pushes sideways and swells between the restraint heights. During
  // compression its volume narrows, stretches upward and becomes denser. This
  // changes the actual occupied region, not just its light or texture phase.
  const neck=1-.10*Math.exp(-(((y-.44)/.15)**2))-.08*Math.exp(-(((y+.80)/.17)**2));
  const sx=(.79+.43*expansion)*neck,sy=1.08-.12*expansion,sz=.84+.36*expansion;
  x=(x-.055*expansion*Math.sin(y*3.8+phase))/sx;
  y/=sy;
  z=(z-.045*expansion*Math.sin(y*4.3-phase))/sz;
  // Advect a deep, irregular mass. The old sin(ax+by+cz) ridges were sheets
  // through the volume: integrating them still produced a luminous curtain.
  // Here broad concentrations wrap around one another in all three axes.
  const turn=y*1.5+sa*.32,ct=Math.cos(turn),st=Math.sin(turn);
  const xx=x*ct-z*st,zz=x*st+z*ct;
  const a=noise(xx*2.4+ca*.34+seed,y*2.8+sa*.38,zz*2.4+sa*.34);
  const b=noise(xx*5.3+sa*.40,y*4.7-ca*.32+seed,zz*5.1+ca*.32);
  const radius=Math.sqrt(xx*xx+y*y+zz*zz);
  const envelope=clamp((1-radius+(a-.5)*.52)*4.2);
  if(envelope===0)return [0,0];
  const lobe=(cx:number,cy:number,cz:number,rx:number,ry:number,rz:number):number=>
    Math.exp(-2.6*(((xx-cx)/rx)**2+((y-cy)/ry)**2+((zz-cz)/rz)**2));
  const upper=lobe(.21+sa*.08,.34,-.18+ca*.12,.57,.56,.58);
  const lower=lobe(-.24-ca*.07,-.35,.19+sa*.09,.59,.53,.55);
  const middle=lobe(.06,-.02,-.04,.77,.70,.77);
  const concentration=clamp(upper*.45+lower*.45+middle*1.15);
  // Cooler, optically dense folds pass IN FRONT of the emitting pockets.
  // Their attenuation, rather than a painted dark side, reveals depth.
  const fold=clamp((noise(xx*3.1+3+ca*.2,y*3.6+seed,zz*3.1-sa*.24)-.40)*4.8);
  const mantle=lobe(.32+sa*.10,.02,-.35+ca*.06,.46,.55,.38)
    +lobe(-.27,-.43,.31,.42,.30,.39);
  const occupied=clamp((concentration-.12+(a-.5)*.13)*2.8);
  const density=envelope*occupied*(.42+a*.35+fold*.55+mantle*1.5)/(sx*sy*sz);
  // Small high-energy currents are subordinate to the broad luminous body.
  const current=Math.pow(clamp(1-Math.abs(b-.51)*11),3)*Math.sqrt(concentration);
  const hot=clamp(.22+concentration*.58+current*.78-fold*.22-mantle*.42+.045*(1-expansion));
  return [density,hot];
}

export interface VolumeFrames {
  frames:Uint8ClampedArray[];
  body:Uint8Array;
  depth:Float32Array;
  objects:Uint8Array;
}

/** Fixed-camera volume integration stops at the nearest opaque surface.
 * Real clamp/crown depth masks both body and its local scattering. */
export function renderEnergy(volumes:readonly EnergyVolume[],camera:Camera,opaqueDepth:Float32Array):VolumeFrames {
  const W=camera.width,H=camera.height,N=W*H;
  const frames=Array.from({length:ENERGY_FRAMES},()=>new Uint8ClampedArray(N*4));
  const body=new Uint8Array(N),depth=new Float32Array(N).fill(-Infinity),objects=new Uint8Array(N);
  const back=unit(camera.direction),right=unit(cross([0,1,0],back)),up=unit(cross(back,right));
  for(const volume of volumes){
    const cs=Math.cos(volume.yaw),sn=Math.sin(volume.yaw);
    const local=(p:V3):V3=>[(p[0]*cs-p[2]*sn)/volume.radii[0],p[1]/volume.radii[1],(p[0]*sn+p[2]*cs)/volume.radii[2]];
    const dir=local(back),A=dot(dir,dir),relative=sub(volume.center,camera.target);
    const centerX=camera.origin[0]+dot(relative,right)*camera.scale,centerY=camera.origin[1]-dot(relative,up)*camera.scale;
    const bound=1.45,extent=Math.max(...volume.radii)*camera.scale*bound+3;
    const x0=Math.max(0,Math.floor(centerX-extent)),x1=Math.min(W-1,Math.ceil(centerX+extent));
    const y0=Math.max(0,Math.floor(centerY-extent)),y1=Math.min(H-1,Math.ceil(centerY+extent));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const i=y*W+x;
      const plane=add(camera.target,add(mul(right,(x+.5-camera.origin[0])/camera.scale),mul(up,(camera.origin[1]-y-.5)/camera.scale)));
      const origin=local(sub(plane,volume.center));
      const B=2*dot(origin,dir),C=dot(origin,origin)-bound*bound,disc=B*B-4*A*C;if(disc<=0)continue;
      const near=(-B+Math.sqrt(disc))/(2*A),far=Math.max((-B-Math.sqrt(disc))/(2*A),opaqueDepth[i]!+.015);
      if(near<=far)continue;
      const steps=56,ds=(near-far)/steps;
      for(let frame=0;frame<ENERGY_FRAMES;frame++){
        const phase=frame/ENERGY_FRAMES*Math.PI*2;
        let transmission=1,r=0,g=0,b=0,firstDepth=-Infinity;
        for(let step=0;step<steps;step++){
          const d=near-(step+.5)*ds;
          const [density,hot]=sample(origin[0]+dir[0]*d,origin[1]+dir[1]*d,origin[2]+dir[2]*d,phase,volume.seed);
          if(density>.012&&firstDepth===-Infinity)firstDepth=d;
          const alpha=1-Math.exp(-density*ds*3.4),weight=transmission*alpha;
          // Cold, muted green density; deep blue-green remains in the body,
          // with pale cold emission reserved for its concentrated currents.
          const radiance=hot*hot;
          r+=weight*(24+radiance*285)*1.42;g+=weight*(45+radiance*385)*1.42;b+=weight*(36+radiance*331)*1.42;
          transmission*=1-alpha;
        }
        // Compress the shared radiance peak before byte conversion. Independent
        // channel clipping turned overlapping concentrations into a flat white
        // bulb and discarded precisely the depth variation we need to retain.
        const peak=Math.max(r,g,b),mapped=peak<=185?peak:185+65*(1-Math.exp(-(peak-185)/125));
        const exposure=peak>0?mapped/peak:1;
        const o=i*4;frames[frame]![o]=r*exposure;frames[frame]![o+1]=g*exposure;frames[frame]![o+2]=b*exposure;frames[frame]![o+3]=(1-transmission)*255;
        if(g>12){body[i]=1;depth[i]=Math.max(depth[i]!,firstDepth);objects[i]=volume.object;}
      }
    }
  }
  // A small air halo is derived from radiance, not an independent light disc.
  // Foreground solid geometry suppresses scattering across its silhouette.
  const radius=Math.max(3,Math.round(camera.scale*.20));
  for(const frame of frames){
    const scatter=new Float32Array(N*3);
    for(let i=0;i<N;i++)if(frame[i*4+1]!>15){
      const x=i%W,y=Math.floor(i/W);
      for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
        const xx=x+dx,yy=y+dy;if(xx<0||xx>=W||yy<0||yy>=H)continue;
        const j=yy*W+xx;if(opaqueDepth[j]!>depth[i]!+.06)continue;
        const weight=Math.exp(-(dx*dx+dy*dy)/(radius*radius*.42))*.10/(radius*radius);
        for(let k=0;k<3;k++)scatter[j*3+k]!+=frame[i*4+k]!*weight;
      }
    }
    for(let i=0;i<N;i++){for(let k=0;k<3;k++)frame[i*4+k]!+=scatter[i*3+k]!;}
  }
  return {frames,body,depth,objects};
}
