/** Review witness: original native XY triangles against frozen terrain; excludes appended shores. */
import fs from 'node:fs';
import path from 'node:path';
import {buildNativeVolume} from '../../src/generation/world-study/native-volume-geometry.ts';
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const inRing=(p,ring)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;};
const inTri=(p,t)=>{const c=t.map((a,i)=>cross(a,t[(i+1)%3],p));return c.every(x=>x>1e-6)||c.every(x=>x<-1e-6);};
export function footprintWitness(definition){
 const rings=[definition.terrainOutline,...definition.erosion],bounds=rings.map(r=>({x:Math.min(...r.map(p=>p.x)),y:Math.min(...r.map(p=>p.y)),X:Math.max(...r.map(p=>p.x)),Y:Math.max(...r.map(p=>p.y))}));
 const matter=p=>inRing(p,rings[0])&&!rings.slice(1).some(r=>inRing(p,r));
 return definition.instances.map(instance=>{
  const {role,groundEdgeWidth,...geometry}=instance;
  // Omitting groundEdge attachment is intentional: only native object surface is audited.
  const mesh=buildNativeVolume({...geometry,blocking:role==='solid'?1:0,family:instance.family??definition.family,seed:definition.seed^Math.imul(instance.id,104729)});
  let outside=0,crossings=0,enclosedBoundary=0,triangles=0;
  for(let i=0;i<mesh.triangleCount;i++){
   const t=[0,1,2].map(j=>{const k=mesh.indices[i*3+j]*3;return{x:mesh.positions[k],y:mesh.positions[k+1]};});
   if(Math.abs(cross(...t))<1e-6)continue;triangles++;
   outside+=t.filter(p=>!matter(p)).length;
   const x=Math.min(...t.map(p=>p.x)),y=Math.min(...t.map(p=>p.y)),X=Math.max(...t.map(p=>p.x)),Y=Math.max(...t.map(p=>p.y));
   for(let r=0;r<rings.length;r++){
    const box=bounds[r];if(box.X<x||box.x>X||box.Y<y||box.y>Y)continue;
    for(let j=0;j<rings[r].length;j++){
     const a=rings[r][j],b=rings[r][(j+1)%rings[r].length];
     if(inTri(a,t))enclosedBoundary++;
     for(let z=0;z<3;z++){const c=t[z],d=t[(z+1)%3];if(cross(a,b,c)*cross(a,b,d)<-1e-7&&cross(c,d,a)*cross(c,d,b)<-1e-7)crossings++;}
    }
   }
  }
  return {id:instance.id,role,triangles,outsideVertexReferences:outside,boundaryCrossings:crossings,enclosedBoundaryVertices:enclosedBoundary,clipped:outside+crossings+enclosedBoundary>0};
 });
}
if(process.argv[1]?.endsWith('check-footprints.mjs')){
 const root=process.argv[2];if(!root)throw Error('Evidence directory required');const rows=[];
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(e.name==='geometry.json'){const g=JSON.parse(fs.readFileSync(f));if(!g.definition?.terrainOutline)continue;rows.push({file:f,worldId:g.definition.id,grade:g.definition.grade,objects:footprintWitness(g.definition)});}}}
 walk(root);const output=process.env.QA_OUTPUT_FILE;if(!output)throw Error('QA_OUTPUT_FILE required');if(fs.existsSync(output))throw Error('Refusing evidence overwrite');fs.writeFileSync(output,JSON.stringify({scope:'Frozen original mesh XY footprint. Detects clipping, not an aesthetic judgement; historical or intended contacts need review.',cases:rows},null,2));console.log(JSON.stringify({cases:rows.length,clipped:rows.filter(r=>r.objects.some(o=>o.clipped)).map(r=>({file:r.file,objects:r.objects.filter(o=>o.clipped)}))}));
}
