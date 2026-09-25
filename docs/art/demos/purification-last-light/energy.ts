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
 * concentrations while the enclosing pressure field remains stable. */
function sample(x:number,y:number,z:number,phase:number,seed:number):readonly[number,number] {
  const ca=Math.cos(phase),sa=Math.sin(phase);
  const twist=y*2.7;
  const xx=x+Math.sin(twist+z*2)*.14,zz=z+Math.cos(twist+x*2)*.11;
  const radius=Math.sqrt(xx*xx*(1.07+.16*Math.sin(y*4.6))+y*y+zz*zz);
  const envelope=clamp((1-radius)*2.7);
  if(envelope===0)return [0,0];
  const a=noise(xx*3.1+ca*.6+seed,y*3.5+sa*.65,zz*3.1+sa*.5);
  const b=noise(xx*6.2+sa*.5,y*5.4-ca*.4+seed,zz*5.2+ca*.4);
  const fold=Math.sin(xx*7.3+y*4.1+zz*5.7+(a-.5)*7+sa*.9);
  const vein=Math.pow(Math.max(0,1-Math.abs(fold)),5);
  const valley=xx+y*.42+Math.sin(y*4.1+sa*.35)*.13+zz*.18;
  const cavity=(.20+.80*clamp((a-.25)*3.4))*(1-.88*Math.exp(-valley*valley/.022));
  return [envelope*cavity*(.38+a*.83+b*.38+vein*.5),clamp(vein*.88+a*.44+b*.12)];
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
    const extent=Math.max(...volume.radii)*camera.scale+3;
    const x0=Math.max(0,Math.floor(centerX-extent)),x1=Math.min(W-1,Math.ceil(centerX+extent));
    const y0=Math.max(0,Math.floor(centerY-extent)),y1=Math.min(H-1,Math.ceil(centerY+extent));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const i=y*W+x;
      const plane=add(camera.target,add(mul(right,(x+.5-camera.origin[0])/camera.scale),mul(up,(camera.origin[1]-y-.5)/camera.scale)));
      const origin=local(sub(plane,volume.center));
      const B=2*dot(origin,dir),C=dot(origin,origin)-1,disc=B*B-4*A*C;if(disc<=0)continue;
      const near=(-B+Math.sqrt(disc))/(2*A),far=Math.max((-B-Math.sqrt(disc))/(2*A),opaqueDepth[i]!+.015);
      if(near<=far)continue;
      const steps=40,ds=(near-far)/steps;
      for(let frame=0;frame<ENERGY_FRAMES;frame++){
        const phase=frame/ENERGY_FRAMES*Math.PI*2;
        let transmission=1,r=0,g=0,b=0;
        for(let step=0;step<steps;step++){
          const d=near-(step+.5)*ds;
          const [density,hot]=sample(origin[0]+dir[0]*d,origin[1]+dir[1]*d,origin[2]+dir[2]*d,phase,volume.seed);
          const alpha=1-Math.exp(-density*ds*3.4),weight=transmission*alpha;
          // Grey, mineral green warms toward pale sulphurous light at the
          // concentrated filaments. No saturated emerald skin.
          const radiance=hot*hot;
          r+=weight*(27+radiance*355)*1.42;g+=weight*(47+radiance*365)*1.42;b+=weight*(28+radiance*292)*1.42;
          transmission*=1-alpha;
        }
        const o=i*4;frames[frame]![o]=r;frames[frame]![o+1]=g;frames[frame]![o+2]=b;frames[frame]![o+3]=(1-transmission)*255;
        if(g>12){body[i]=1;depth[i]=near;objects[i]=volume.object;}
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
