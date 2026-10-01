/** One authored world for the opening and the playable haven.
 * Decorative additions preserve the navigation shell, station origins and rig.
 * The old production builder/assets are deliberately untouched. */
import { buildOption } from '../../docs/art/demos/purification-forecourt-options/option-a';
import { Model, random, cross, sub, unit, type V2, type V3, type Layer } from '../../docs/art/demos/purification-last-light/model';

function cuboid(m:Model,c:V3,s:V3,mat:'wood'|'paper',tint:number):void {
  const [x,y,z]=c,[w,h,d]=s.map(v=>v/2);
  const a:V3=[x-w,y-h,z-d],b:V3=[x+w,y-h,z-d],c0:V3=[x+w,y-h,z+d],d0:V3=[x-w,y-h,z+d];
  const e:V3=[x-w,y+h,z-d],f:V3=[x+w,y+h,z-d],g:V3=[x+w,y+h,z+d],h0:V3=[x-w,y+h,z+d];
  for(const q of [[e,h0,g,f],[a,b,c0,d0],[a,e,f,b],[d0,c0,g,h0],[a,d0,h0,e],[b,f,g,c0]] as [V3,V3,V3,V3][])m.quad(...q,mat,tint);
}
function wallPier(m: Model, x: number, z: number, bottom: number, top: number, width: number, seed: number, tint: number): void {
  const rng=random(seed);
  // Unequal construction courses change the silhouette and expose a recessed
  // core. The long shadowed face is not a single extruded uniform rectangle.
  m.box([x,(top+bottom)/2,z],[width*.82,top-bottom,width*.86],'stone',.055,tint*.73);
  let y=bottom;
  while(y<top){
    const h=Math.min(top-y,1.18+rng()*1.25);
    const shift=(rng()-.5)*.04;
    m.box([x+shift,y+h*.5,z],[width*(.93+rng()*.10),h-.012,width*(.92+rng()*.06)],'stone',.04,tint*(.96+rng()*.075));
    if(rng()>.6)m.rock([x+width*.4,y+h*.7,z+width*.35],[width*.28,.45,width*.22],'stone',seed+Math.floor(y*100),tint*.91);
    y+=h;
  }
  m.box([x,top-.23,z],[width*1.32,.23,width*1.31],'cutstone',.065,tint*1.04);
  m.box([x,top-.49,z],[width*1.12,.12,width*1.09],'stone',.04,tint*.81);
}

function shelves(m:Model,x:number,y:number,z:number,w:number,h:number,seed:number,tint:number):void {
  const rng=random(seed),rows=Math.ceil(h/.72),step=h/rows;
  // Recessed darkness belongs to a closed rear wall, while shelves and books
  // stand forward with readable depth and missing bays.
  cuboid(m,[x,y+h/2,z-.35],[w,h,.13],'wood',tint*.42);
  for(const dx of [-w/2,w/2])m.box([x+dx,y+h/2,z],[.13,h,.66],'wood',.027,tint*.92);
  for(let r=0;r<=rows;r++){
    const yy=y+r*step;
    cuboid(m,[x,yy,z],[w+.12,.095,.70],'wood',tint);
    if(r===rows)continue;
    let xx=-w/2+.1;
    while(xx<w/2-.15){
      const bw=.08+rng()*.10,bh=step*(.46+rng()*.35);
      if(rng()>.23){
        cuboid(m,[x+xx+bw/2,yy+.065+bh/2,z+.16],[bw,bh,.33],'wood',tint*(.76+rng()*.55));
        if(rng()>.68)cuboid(m,[x+xx+bw/2,yy+bh*.72,z+.332],[bw*.73,.027,.022],'paper',tint*.74);
      }
      xx+=bw+.028;
    }
  }
}

function gallery(m:Model,width:number,seed:number,tint:number,broken=false):void {
  const rng=random(seed),half=width/2;
  m.slab([[-half,-1.65],[half-.7,-1.65],[half,-1.1],[half-.28,.50],[half-.93,.91],[-half+.14,.93],[-half-.2,.37]],0,-.71,'stone',tint);
  m.box([-.15,-.22,.66],[width-.2,.21,.37],'cutstone',.035,tint*1.08);
  m.beam([-half,-.67,-.95],[half-.4,-.67,-.95],.3,.44,'iron',tint*.7);
  for(const x of [-half+.75,half-.92]){
    wallPier(m,x,-.5,-13.8,-.7,1.05,seed+Math.round(x*10),tint*.87);
    m.beam([x,-1.1,-.2],[x+(x<0?1.7:-1.7),-3.2,-.2],.47,.57,'stone',tint*.81);
  }
  for(let i=0;i<3;i++){
    const x=-half+1.05+i*(width-2.1)/2;
    wallPier(m,x,-1.1,0,6+(i===2&&broken?-2:.4),.66,seed+i,tint);
    if(i<2)shelves(m,x+(width-2.1)/4,.09,-1.02,(width-2.1)/2-.7,3.75,seed+i*17,tint*.98);
  }
  m.beam([-half+.66,6.2,-1.1],[-half+2.7,6.04,-1.02],.6,.71,'stone',tint);
  if(!broken)m.beam([-1.2,6.2,-1.1],[half-.91,6.32,-1.1],.6,.75,'stone',tint*.92);
  // Low parapet only remains at one end. The gap exposes the archive depth.
  for(const x of [-half+.18,-half+1.4,-half+2.6]){
    m.beam([x,.06,.67],[x,.88,.67],.047,.058,'iron',tint*.83);
  }
  m.beam([-half+.15,.88,.67],[-half+2.6,.88,.67],.06,.067,'iron',tint*.92);
  for(let i=0;i<12;i++){
    const x=half-1.2+rng()*1.15,z=-1.1+rng()*1.65;
    m.rock([x,-.21-rng()*.45,z],[.22+rng()*.44,.21+rng()*.35,.27+rng()*.35],'stone',seed+i,tint*(.9+rng()*.15));
  }
  for(const x of [-half+.25,half-1])m.cable([[x,-.54,.8],[x+.16,-3.7,.9],[x-.1,-7.6,.87],[x+.38,-11.8,.99]],.053,'iron',tint*.72);
}

function appendTilted(m:Model,origin:V3,yaw:number,lean:number,layer:Layer,id:number,draw:(part:Model)=>void):void {
  const part=new Model();part.layer=layer;part.object=id;draw(part);
  const c=Math.cos(yaw),s=Math.sin(yaw),cl=Math.cos(lean),sl=Math.sin(lean);
  const transform=(p:V3):V3=>{
    const x=p[0]*cl-p[1]*sl,y=p[0]*sl+p[1]*cl;
    return [origin[0]+x*c+p[2]*s,origin[1]+y,origin[2]-x*s+p[2]*c];
  };
  for(const t of part.triangles){const a=transform(t.a),b=transform(t.b),c=transform(t.c);m.triangles.push({...t,a,b,c,normal:unit(cross(sub(b,a),sub(c,a)))});}
  for(const l of part.lights)m.lights.push({...l,position:transform(l.position)});
}

function fissure(m:Model,points:V3[],id:string,power:number):void {
  m.cable(points,.045,'pollutant',.95);
  // Broken mineral skins cling to the fracture rather than outlining every
  // beam. Their local source illuminates the receiving stone in both views.
  const rng=random(id.length*193+Math.round(points[0]![0]*47));
  for(let i=1;i<points.length;i++){
    const a=points[i-1]!,b=points[i]!;
    for(let j=0;j<5;j++){
      const f=(j+.2)/5;
      m.rock([a[0]+(b[0]-a[0])*f+(rng()-.5)*.24,a[1]+(b[1]-a[1])*f+.012,a[2]+(b[2]-a[2])*f+(rng()-.5)*.2],[.10+rng()*.13,.025+rng()*.025,.07+rng()*.11],'pollutant',i*71+j,1.08+rng()*.22);
    }
  }
  const p=points[Math.floor(points.length/2)]!;
  m.light([p[0],p[1]+.16,p[2]+.18],[.38,.53,.45],power*1.38,7.2,{kind:'pollution',id});
}

/** Convex 2D intersection used only to overlay millimetre-scale stone relief
 * on already-carved top triangles. No decorative face bridges a real void. */
function clip(poly:V2[],tri:V2[]):V2[]{
  const area=(a:V2,b:V2,p:V2)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  const sign=Math.sign(area(tri[0]!,tri[1]!,tri[2]!));
  let result=poly;
  for(let i=0;i<3;i++){
    const a=tri[i]!,b=tri[(i+1)%3]!,out:V2[]=[];
    for(let j=0;j<result.length;j++){
      const p=result[j]!,q=result[(j+1)%result.length]!,dp=area(a,b,p)*sign,dq=area(a,b,q)*sign;
      if(dp>=-1e-8)out.push(p);
      if((dp>=0)!==(dq>=0)){const f=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*f,p[1]+(q[1]-p[1])*f]);}
    }
    result=out;if(!out.length)break;
  }
  return result;
}

function paving(m:Model):void {
  const ground=m.triangles.filter(t=>t.object===0&&t.layer==='haven'&&t.material==='cutstone'&&Math.abs(t.normal[1])>.995&&Math.abs(t.a[1]-t.b[1])<1e-6&&Math.abs(t.b[1]-t.c[1])<1e-6&&(Math.abs(t.a[1])<.001||Math.abs(t.a[1]-2.6)<.001));
  const bounds=ground.map(t=>({t,minX:Math.min(t.a[0],t.b[0],t.c[0]),maxX:Math.max(t.a[0],t.b[0],t.c[0]),minZ:Math.min(t.a[2],t.b[2],t.c[2]),maxZ:Math.max(t.a[2],t.b[2],t.c[2])}));
  const rng=random(94182);
  m.layer='haven';m.object=0;
  for(let row=0;row<12;row++){
    const z=-8+row*1.39;
    for(let x=-6+(row%2)*.62;x<16;){
      const width=1.7+rng()*1.02,height=1.37,gap=.014;
      // Weathering removes clusters of old wearing course, leaving large
      // quiet substrate where paths cross; no uniform checkerboard.
      const keep=(Math.sin(x*.61+z*.37)+Math.cos(z*.7-x*.19)>.0)||z<-4||x>11;
      if(keep){
        const tint=.88+rng()*.13;
        const outer:V2[]=[[x+gap,z+gap],[x+width-gap,z+gap],[x+width-gap,z+height-gap],[x+gap,z+height-gap]];
        const inner:V2[]=[[x+gap+.035,z+gap+.035],[x+width-gap-.035,z+gap+.035],[x+width-gap-.035,z+height-gap-.035],[x+gap+.035,z+height-gap-.035]];
        for(const b of bounds){
          if(x>b.maxX||x+width<b.minX||z>b.maxZ||z+height<b.minZ)continue;
          const tri=[b.t.a,b.t.b,b.t.c].map(p=>[p[0],p[2]] as V2),base=b.t.a[1];
          for(const [poly,y,t] of [[outer,base+.003,tint*.87],[inner,base+.010,tint]] as [V2[],number,number][]){
            const p=clip(poly,tri);if(p.length<3)continue;
            for(let i=1;i<p.length-1;i++)m.triangle([p[0]![0],y,p[0]![1]],[p[i+1]![0],y,p[i+1]![1]],[p[i]![0],y,p[i]![1]],'cutstone',t);
          }
        }
      }
      x+=width;
    }
  }
}

function masonrySection(m:Model):void {
  m.layer='haven';m.object=0;
  // Original occupied wall roots, well below all walk surfaces. Individual
  // courses turn around a corner, with core/recess/coping sharing real depth.
  for(const [origin,yaw,width,bottom,seed] of [
    [[4.96,-.38,7.53],-.32,2.05,-4.4,8101],
    [[-1.73,-.39,4.73],-.70,1.38,-3.2,8102],
    [[12.46,-.40,6.10],.69,1.42,-2.7,8103],
  ] as [V3,number,number,number,number][]){
    m.at(origin,yaw,0,()=>{
      const rng=random(seed);let y=-.18;
      for(let row=0;y>bottom;row++,y-=.39){
        const w=width*(1-Math.abs(y)/Math.abs(bottom)*.18);
        for(let j=0;j<3;j++){
          if(row>3&&rng()<.22)continue;
          const bw=w/3-.021;
          m.box([-w/2+(j+.5)*w/3+(row%2)*.07,y,0],[bw,.365,.34+rng()*.12],'stone',.045,.65+rng()*.14);
        }
      }
    });
  }
}

export function buildJointScene(){
  const option=buildOption(),m=option.model;
  // The first thirteen lamps belong to the replaced far/middle fabric. Match
  // IDs, never splice by array position, so author changes fail loudly.
  const removed=new Set(['seam--15.70-10.02--13.51','seam--19.90-4.35--5.93','attachment-4333','seam--17.68-2.85--10.96','seam--10.95--3.94-3.19','seam--9.32-2.71--4.92','attachment-3611','attachment-3617','attachment-3629','attachment-3789','attachment-3767','attachment-4231','seam--13.79--6.07-1.94']);
  if(m.lights.filter(l=>removed.has(l.id)).length!==removed.size)throw new Error('Exterior sources changed; review joint-scene before baking.');
  m.triangles.splice(0,m.triangles.length,...m.triangles.filter(t=>t.layer!=='far'&&t.layer!=='middle'));
  m.lights.splice(0,m.lights.length,...m.lights.filter(l=>!removed.has(l.id)));
  // Massive archive wings, interrupted in depth. Nothing is added on the
  // playable plane, and no distant colonnade receives a navigation surface.
  appendTilted(m,[-11.8,-7.8,-.8],.24,-.28,'middle',91,p=>{
    gallery(p,10.6,4001,.78,true);
    fissure(p,[[-3.7,.027,.66],[-3.1,.028,.61],[-2.7,.03,.4],[-2.3,.03,.5]],'joint-middle-wound',2.15);
    fissure(p,[[3.6,-.4,.05],[3.67,-1.2,.05],[3.55,-1.8,.08],[3.62,-2.35,.06]],'joint-middle-pier',1.65);
  });
  appendTilted(m,[-18.4,-9.6,7.7],-.34,-.17,'middle',92,p=>{
    gallery(p,8.6,4101,.77,true);
    fissure(p,[[2.9,-.1,.79],[3.1,-.6,.85],[3.04,-1.1,.8]],'joint-lower-wound',1.8);
    fissure(p,[[-2.5,.04,.58],[-1.8,.03,.63],[-1.45,.035,.48]],'joint-lower-gallery',1.55);
  });
  appendTilted(m,[-20.3,-4.5,-14],.05,.09,'far',93,p=>{
    gallery(p,17,4201,.97);
    wallPier(p,-7,-1,-23,13.6,1.5,4207,.77);
    wallPier(p,7,-1,-25,15,1.5,4208,.79);
    p.beam([-7,12.8,-1],[2.8,13.4,-1],1.1,1.5,'stone',.8);
    fissure(p,[[-6.9,5,-.17],[-6.84,4.45,-.16],[-6.7,3.7,-.18]],'joint-high-wound',1.7);
    fissure(p,[[6.9,12.3,-.09],[7.02,11.8,-.07],[6.94,11.45,-.11]],'joint-high-pier',1.3);
  });
  appendTilted(m,[-34,-19,-15],-.08,.08,'far',94,p=>{
    gallery(p,18,4301,.81,true);
    fissure(p,[[2.5,.03,.63],[2.9,.03,.67],[3.2,.03,.48]],'joint-abyss-wound',1.7);
  });
  appendTilted(m,[-7,-20,-5],-.14,.23,'far',95,p=>gallery(p,11.4,4401,.65,true));
  paving(m);masonrySection(m);
  // One source power drives both baked receivers and the real moving actor.
  // Keep furnace emission bright, while retaining coat/helmet form at its side.
  const furnace=m.lights.find(light=>light.id==='haven-furnace');
  if(!furnace)throw new Error('Missing furnace light');
  furnace.power=2.7;
  m.layer='haven';m.object=0;
  return {...option,title:'余烬与深井',summary:'同一座断裂藏书楼：炉席的微小停留与贯穿深处的建筑余体。',model:m};
}
