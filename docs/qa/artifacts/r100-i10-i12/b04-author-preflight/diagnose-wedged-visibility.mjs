import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const root=process.cwd(),folder=path.join(root,'docs/qa/artifacts/r100-i10-i12/b04-author-preflight'),{buildNativeVolume}=await import(folder+'/body12/executor.mjs');
const raw=fs.readFileSync('src/generated/r100-native-worlds.ts','utf8'),worlds=JSON.parse(raw.split('export const R100_NATIVE_WORLDS: readonly R100NativeWorldEntry[] = ')[1].replace(/;\s*$/,''));
const bary=(px,py,a,b,c)=>{const d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-9)return null;const u=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/d,v=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/d,w=1-u-v;if(Math.min(u,v,w)<-1e-6)return null;return u*a[2]+v*b[2]+w*c[2];};
const results=[];
for(const d of worlds.find(w=>w.id==='wedged-hide').definitions){const meshes=d.instances.map(({role,...s})=>buildNativeVolume({...s,family:s.family??d.family,blocking:role==='solid'?1:0,seed:20261005^Math.imul(s.id,104729)}));
 const triangle=(m,t)=>[0,1,2].map(c=>Array.from(m.positions.slice(m.indices[t*3+c]*3,m.indices[t*3+c]*3+3)));
 const m=meshes.find(m=>m.spec.id===3),fractures=[];for(let t=0;t<m.triangleCount;t++)if(m.materials[t]===3){const tri=triangle(m,t),centre=[0,1,2].map(i=>tri.reduce((n,p)=>n+p[i],0)/3),covers=[];
  for(const other of meshes)for(let q=0;q<other.triangleCount;q++){const xyz=triangle(other,q),z=bary(centre[0],centre[1],...xyz);if(z!==null&&z>centre[2]+.01)covers.push({id:other.spec.id,triangle:q,material:other.materials[q],height:z,aboveBy:z-centre[2]});}
  fractures.push({triangle:t,positions:tri,centroid:centre,covers:covers.sort((a,b)=>b.height-a.height)});
 }
 results.push({grade:d.grade,fractures});}
const report={scope:'Read-only native triangle-height diagnosis at real local material3 triangle centroids; original actual raster failure retained. No new MasterWorld or source changes.',inputExecutorSha256:createHash('sha256').update(fs.readFileSync(folder+'/body12/executor.mjs')).digest('hex'),results};fs.writeFileSync(folder+'/wedged-fracture-diagnosis.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(results));
