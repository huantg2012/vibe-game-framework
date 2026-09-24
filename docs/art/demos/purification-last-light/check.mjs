import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {buildHaven} from './scene.ts';
import {WALK_SURFACES} from './environment.ts';
import {ShapeUtils,Vector2} from 'three';

const here=path.dirname(fileURLToPath(import.meta.url));
const files=fs.readdirSync(here).filter(x=>x.endsWith('.ts')).map(x=>path.join(here,x));
const program=ts.createProgram(files,{strict:true,noEmit:true,noUnusedLocals:true,noUnusedParameters:true,noUncheckedIndexedAccess:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,lib:['lib.es2022.d.ts','lib.dom.d.ts'],skipLibCheck:true});
const diagnostics=ts.getPreEmitDiagnostics(program);
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));process.exit(1);}
const {model,stations}=buildHaven();
assert.deepEqual(stations.map(s=>s.key),['core','storage','purifier','offering','growth','rift']);
for(const t of model.triangles)for(const v of [...t.a,...t.b,...t.c,...t.normal,t.tint])assert(Number.isFinite(v));
const triangles=WALK_SURFACES.flatMap(surface=>ShapeUtils.triangulateShape(surface.points.map(p=>new Vector2(p[0],p[2])),[]).map(face=>({points:face.map(i=>surface.points[i]),id:surface.id})));
function elevation(x,z){
  let height=-Infinity,id='';
  for(const t of triangles){const [a,b,c]=t.points,det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(det)<1e-9)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det,w=1-u-v;
    if(u<0||v<0||w<0)continue;const y=u*a[1]+v*b[1]+w*c[1];if(y>height){height=y;id=t.id;}
  }return {height,id};
}
// Conservative foot clearance against six station mounting footprints, the
// furnace and the shelf returns. This checks this art layout, not game physics.
const obstacles=stations.filter(s=>s.key!=='rift').map(s=>{
 const ts=model.triangles.filter(t=>t.object===s.id&&Math.min(t.a[1],t.b[1],t.c[1])<s.position[1]+.65);
 const ps=ts.flatMap(t=>[t.a,t.b,t.c]);
 return {x0:Math.min(...ps.map(p=>p[0])),x1:Math.max(...ps.map(p=>p[0])),z0:Math.min(...ps.map(p=>p[2])),z1:Math.max(...ps.map(p=>p[2])),y:s.position[1]};
});
obstacles.push({x0:7.15,x1:8.85,z0:5.35,z1:6.65,y:0});
const step=.16,radius=.22,x0=-5.2,z0=-8.2,nx=128,nz=104,nodes=new Map();
for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
 const x=x0+ix*step,z=z0+iz*step,h=elevation(x,z);if(!Number.isFinite(h.height))continue;
 let clear=true;for(let k=0;k<8;k++){const a=k*Math.PI/4,q=elevation(x+Math.cos(a)*radius,z+Math.sin(a)*radius);if(!Number.isFinite(q.height)||Math.abs(q.height-h.height)>.27){clear=false;break;}}
 if(!clear||obstacles.some(b=>Math.abs(h.height-b.y)<.3&&x>b.x0-radius&&x<b.x1+radius&&z>b.z0-radius&&z<b.z1+radius))continue;
 nodes.set(iz*nx+ix,{x,z,y:h.height,id:h.id});
}
function nearest(p){let best,dist=Infinity;for(const [i,n]of nodes){const d=(n.x-p[0])**2+(n.z-p[2])**2+(n.y-p[1])**2*3;if(d<dist){best=i;dist=d;}}assert(dist<.2,`No clear standing location near ${p}; squared distance ${dist}`);return best;}
const start=nearest([3.8,0,3.8]),queue=[start],seen=new Set(queue);
for(let q=0;q<queue.length;q++){
 const i=queue[q],a=nodes.get(i);for(const d of [-nx,nx,-1,1]){const next=i+d,b=nodes.get(next);if(!b||seen.has(next)||Math.hypot(a.x-b.x,a.z-b.z)>step*1.1||Math.abs(a.y-b.y)>.25)continue;seen.add(next);queue.push(next);}
}
const reached=stations.map(s=>{const i=nearest(s.approach);assert(seen.has(i),`${s.key}: disconnected approach`);return s.key;});
for(const id of ['west-ramp','east-ramp'])assert([...seen].some(i=>nodes.get(i).id===id),`${id}: unreachable`);
const result={strictModules:files.length,finiteTriangles:model.triangles.length,stations:reached,reachableSamples:seen.size,totalStandableSamples:nodes.size,footRadius:radius,samplingStep:step,ramps:['west-ramp','east-ramp'],scope:'Art layout with conservative station/furnace footprints. Does not claim production collision or gameplay integration.'};
console.log(JSON.stringify(result,null,2));
if(process.argv.includes('--write'))fs.writeFileSync(path.join(here,'assets','layout-check.json'),JSON.stringify(result,null,2)+'\n');
