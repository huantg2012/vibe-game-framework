/** Static author evidence only: actual source meshes, no surface bake, gameplay or invented lighting. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import sharp from 'sharp';
import {footprintWitness} from '../../../../../tools/world-upgrades-rollout/check-footprints.mjs';
import {buildNativeVolume} from '../../../../../src/generation/world-study/native-volume-geometry.ts';
const outputName=process.argv[2]??'attempt1';if(!/^(attempt[12]|root-correction)$/.test(outputName))throw Error('Bounded author output required');
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../../..');
const parse=s=>{const[h,...ls]=s.trim().split(/\r?\n/);const ks=h.split(',');return ls.map(l=>Object.fromEntries(l.split(',').map((v,i)=>[ks[i],v])));};
const natives=parse(fs.readFileSync(path.join(root,'data/rift-native-worlds.csv'),'utf8'));
const report={scope:'Actual native construction XY at fixed author seeds; triangle samples plus shared exact triangle/terrain crossing witness, not production raster/body/content/admission/lighting or human approval.',cases:[],failures:[]};
const inside=(p,loop)=>{let hit=false;for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[i],b=loop[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
for(const dir of fs.readdirSync(path.join(here,outputName))){
 const file=path.join(here,outputName,dir,'geometry.json');if(!fs.existsSync(file))continue;
 const g=JSON.parse(fs.readFileSync(file)),plan=g.nativeAuthorTransform,native=natives.find(n=>n.world_id===g.worldId),seed=Number(dir.split('-').at(-1));
 const s=Number(plan.native_uniform_scale),target=[Number(plan.native_target_center_x_px),Number(plan.native_target_center_y_px)],source=[Number(plan.native_source_center_x_px),Number(plan.native_source_center_y_px)];
 const onLand=p=>g.result.contours.reduce((hit,loop)=>hit!==inside(p,loop),false);let paths={solid:'',relief:''},samples=0,unsupported=0,firstOutside=[];const instances=[];
 const objects=native.instances.split('|').map((descriptor,index)=>{
  const f=descriptor.split(':'),names=['x','y','rotation','length','width','height','thickness','fold','branches','opening','distortion'];
  const spec={id:index+1,family:f[0],seed:seed^Math.imul(index+1,104729),blocking:f[1]==='solid'?1:0,constructionVersion:Number(native.construction_version),shapeProfile:native.shape_profiles.split('|')[index]};
  names.forEach((name,i)=>spec[name]=Number(f[i+2]));spec.x=target[0]+(spec.x-source[0])*s;spec.y=target[1]+(spec.y-source[1])*s;spec.length*=s;spec.width*=s;spec.rotation+=Number(plan.native_rotation_delta_rad);
  instances.push({...spec,role:f[1]});const mesh=buildNativeVolume(spec);let count=0;
  for(let t=0;t<mesh.triangleCount;t++){
   const vs=[0,1,2].map(v=>{const q=mesh.indices[t*3+v]*3;return[mesh.positions[q]/2,mesh.positions[q+1]/2];});
   if(Math.abs((vs[1][0]-vs[0][0])*(vs[2][1]-vs[0][1])-(vs[1][1]-vs[0][1])*(vs[2][0]-vs[0][0]))<1e-7)continue;
   paths[f[1]]+=`M${vs.map(p=>p.join(',')).join('L')}Z `;
   const steps=Math.max(1,Math.ceil(Math.max(...[0,1,2].map(i=>Math.hypot(vs[i][0]-vs[(i+1)%3][0],vs[i][1]-vs[(i+1)%3][1])))/4));
   for(let u=0;u<=steps;u++)for(let v=0;v<=steps-u;v++){const a=u/steps,b=v/steps,c=1-a-b,p=[vs[0][0]*a+vs[1][0]*b+vs[2][0]*c,vs[0][1]*a+vs[1][1]*b+vs[2][1]*c];samples++;if(!onLand(p)){unsupported++;count++;if(firstOutside.length<12)firstOutside.push(p);}}
  }
  return{id:spec.id,family:spec.family,shapeProfile:spec.shapeProfile,triangles:mesh.triangleCount,unsupported:count,bounds:mesh.bounds};
 });
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="896"><rect width="1152" height="896" fill="black"/><path d="${g.result.pathD}" fill="#ececec" fill-rule="evenodd"/><path d="${paths.relief}" fill="#688b9b" fill-rule="nonzero"/><path d="${paths.solid}" fill="#967449" fill-rule="nonzero"/></svg>`;
 fs.writeFileSync(path.join(here,outputName,dir,'native-mesh-footprints.svg'),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(here,outputName,dir,'native-mesh-footprints.png'));
 const contour=(points)=>points.map(([x,y])=>({x:x*2,y:y*2}));const definition={id:g.worldId,seed,family:native.family,terrainOutline:contour(g.result.contours[g.result.contourKinds.indexOf('outer')]),erosion:g.result.contours.filter((_,i)=>g.result.contourKinds[i]==='hole').map(contour),instances};const witnesses=footprintWitness(definition);
 fs.writeFileSync(path.join(here,outputName,dir,'native-definition.json'),JSON.stringify(definition,null,2));
 report.cases.push({witnesses,world:g.worldId,seed,objects,samples,unsupported,firstOutside});if(unsupported||witnesses.some(w=>w.clipped))report.failures.push({world:g.worldId,seed,unsupported});
}
fs.writeFileSync(path.join(here,`${outputName}-native-footprint-check.json`),JSON.stringify(report,null,2));console.log(JSON.stringify({cases:report.cases.map(c=>({world:c.world,seed:c.seed,samples:c.samples,unsupported:c.unsupported,clipped:c.witnesses.filter(w=>w.clipped)})),failures:report.failures},null,2));
if(report.failures.length)process.exitCode=1;
