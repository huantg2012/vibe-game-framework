/** Native material occupies the same anatomical supports as the human remnant.
 * Only attached tissue changes; feet, attack hands and gameplay timing do not. */
import type { createModelRaster } from './model-raster';
import type { EnemyWorldAdaptation } from './world-adaptation';
type Raster = ReturnType<typeof createModelRaster>;
type V = readonly [number, number, number];
const at = (p: V, x: number, y: number, z: number): V => [p[0]+x,p[1]+y,p[2]+z];

export function drawWorldTorso(r: Raster, world: EnemyWorldAdaptation, pelvis: V, chest: V, level: number, individual: number): boolean {
  const { volume, tube } = r;
  const width = 5.8 + level * .6;
  if (world.kind === 'slab') {
    // Stepped, overlapping planes grow out of a central bearing column.
    tube(pelvis,chest,2.8,3.4,world.dark);
    for(let i=0;i<world.fibreCount;i++) {
      const t=i/(world.fibreCount-1), z=pelvis[2]+3+(chest[2]-pelvis[2]-3)*t;
      const c: V=[pelvis[0]*(1-t)+chest[0]*t+(i%2?1:-1)*(1+individual),pelvis[1]*(1-t)+chest[1]*t,z];
      volume([{at:at(c,0,0,-1.6),rx:width*.6,ry:2.5},{at:c,rx:width*(.78+t*.22),ry:3.8},{at:at(c,-.6,-.3,1.1),rx:width*.86,ry:3}],world.mid);
    }
  } else if(world.kind === 'shell') {
    tube(pelvis,chest,3.3,4.3,world.dark);
    for(const side of [-1,1]) {
      const c=at(chest,side*2.7,side<0?-.7:1.1,side<0?1:-2);
      volume([{at:at(pelvis,side*2,0,2),rx:2,ry:2},{at:at(c,0,0,-3),rx:3.8+individual,ry:4},{at:c,rx:3.6,ry:3.6},{at:at(c,side*1.3,-.7,3.4),rx:1.2,ry:2.8}],world.mid);
      // Exposed inner seam; attached broken lip, never orbiting fragments.
      tube(at(c,side*1.8,2,-3),at(c,side*1.4,2,2.5),.65,.95,world.light);
    }
  } else if(world.kind === 'granular') {
    tube(pelvis,chest,3.4,4.2,world.dark);
    for(let i=0;i<world.fibreCount+2;i++) {
      const t=i/(world.fibreCount+1), side=i%2?1:-1;
      const c: V=[pelvis[0]*(1-t)+chest[0]*t+side*(1.8+individual),pelvis[1]*(1-t)+chest[1]*t+side*.7,pelvis[2]+2+(chest[2]-pelvis[2])*t];
      const size=2.5+(i%3)*.65;
      volume([{at:at(c,.5,0,-2.2),rx:size*.65,ry:2.1},{at:c,rx:size,ry:3.2},{at:at(c,-.5,-.4,2.1),rx:size*.7,ry:2.5}],i%3?world.mid:world.light);
    }
  } else if(world.kind === 'gel') {
    // Continuous descending tissue, widest below the shoulder. Not a bubble head.
    volume([{at:at(pelvis,1,1,-4),rx:3,ry:2.5},{at:at(pelvis,1.4,1,2),rx:width*.92,ry:4.2},{at:at(chest,-.5,.5,-4),rx:width,ry:4.6},{at:at(chest,-1,0,2.5),rx:width*.72,ry:3.3}],world.mid);
    tube(at(chest,-3,3,1),at(pelvis,-1,3,-1),1.5,2.5,world.light);
    tube(at(chest,3,2,-2),at(pelvis,4,2,-5),2.3,1.1,world.dark);
  } else return false;
  return true;
}

export function drawWorldArm(r: Raster, world: EnemyWorldAdaptation, shoulder: V, elbow: V, side: number, response: number): void {
  const { volume, tube }=r;
  if(world.kind==='slab') {
    volume([{at:at(elbow,0,0,1),rx:1.7,ry:1.7},{at:at(shoulder,side*1.1,0,-1),rx:3.4,ry:2.9},{at:at(shoulder,side*1.7,0,1.7),rx:2.3,ry:2.5}],world.mid);
  } else if(world.kind==='shell') {
    volume([{at:at(elbow,0,0,2),rx:1.6,ry:2},{at:at(shoulder,side*1.1,-.8,0),rx:3.9,ry:3.4},{at:at(shoulder,side*1.5,-.8,2.8),rx:1.5,ry:2.6}],world.mid);
  } else if(world.kind==='granular') {
    for(let i=0;i<3;i++) { const t=i/3,c:V=[shoulder[0]*(1-t)+elbow[0]*t+side*.7,shoulder[1]*(1-t)+elbow[1]*t,shoulder[2]*(1-t)+elbow[2]*t];
      volume([{at:at(c,0,0,-1.5),rx:2,ry:2},{at:c,rx:3-i*.3,ry:2.7},{at:at(c,0,0,1.5),rx:1.5,ry:1.8}],world.mid); }
  } else if(world.kind==='gel') {
    const sag: V=[(shoulder[0]+elbow[0])*.5+side*world.membraneSpread,(shoulder[1]+elbow[1])*.5+response*.6,(shoulder[2]+elbow[2])*.5-1];
    tube(shoulder,sag,3.1,3.4,world.mid);tube(sag,elbow,3.4,1.8,world.mid);
    tube(at(shoulder,0,1,0),at(sag,0,1,0),.7,1.1,world.light);
  }
}
