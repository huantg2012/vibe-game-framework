import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {buildHaven} from '../../../art/demos/purification-last-light/scene.ts';
import {WALK_SURFACES,FURNACE_BOUNDS} from '../../../art/demos/purification-last-light/environment.ts';
import {REST_OBJECT_ID,REST_POSITION} from '../../../art/demos/purification-last-light/rest.ts';
import {ShapeUtils,Vector2} from 'three';
// This archive is a read-only scene measurement, not a collision implementation.
// Run from the repository root: node --import tsx docs/reviews/artifacts/purification-platform-layout-2026-09-26/audit.mjs
const outputDir=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(outputDir,'../../../..');
const sceneDir=path.join(repoRoot,'docs/art/demos/purification-last-light');
const git=(...args)=>execFileSync('git',args,{cwd:repoRoot,encoding:'utf8'}).trim();
const hash=value=>createHash('sha256').update(value).digest('hex');
const measuredFiles=['scene.ts','environment.ts','devices.ts','rest.ts','actor.ts','model.ts','check.mjs'];
const sceneBaseline='e243381';
const files=measuredFiles.map(name=>{
 const relative=`docs/art/demos/purification-last-light/${name}`;
 const current=fs.readFileSync(path.join(repoRoot,relative));
 const baseline=execFileSync('git',['show',`${sceneBaseline}:${relative}`],{cwd:repoRoot});
 assert.equal(hash(current),hash(baseline),`${relative} changed since the archived scene baseline; review and version this audit before updating evidence`);
 return {path:relative,sha256:hash(current),matchesSceneBaseline:true};
});
const metadata={sceneBaseline,currentHead:git('rev-parse','HEAD'),files,scope:'Read-only art-layout measurement. No production movement, collision, interaction or gameplay is executed.'};
const transcript=[];
const log=(...values)=>transcript.push(values.map(v=>typeof v==='string'?v:JSON.stringify(v,null,2)).join(' '));
const {model,stations,rest}=buildHaven();
const check=fs.readFileSync(path.join(sceneDir,'check.mjs'),'utf8');
for(const marker of ['const triangles=WALK_SURFACES','const restTriangles=','const step=.16','const start=nearest'])assert(check.includes(marker),`Checker boundary missing: ${marker}`);
const source=check.slice(check.indexOf('const triangles=WALK_SURFACES'),check.indexOf('const restTriangles='))+check.slice(check.indexOf('const step=.16'),check.indexOf('const start=nearest'));
const base=Function('assert','WALK_SURFACES','ShapeUtils','Vector2','stations','REST_OBJECT_ID','REST_POSITION','model','FURNACE_BOUNDS',source+';return {triangles,elevation,obstacles,step,radius,x0,z0,nx,nz,nodes,nearest};')(assert,WALK_SURFACES,ShapeUtils,Vector2,stations,REST_OBJECT_ID,REST_POSITION,model,FURNACE_BOUNDS);
const {nodes,nearest,nx,step,elevation,radius}=base;
const points=Object.fromEntries([['actor',[3.8,0,3.8]],...stations.map(s=>[s.key,s.approach]),['rest',rest.approach]].map(([k,p])=>[k,{p,index:nearest(p),sample:nodes.get(nearest(p))}]));
class Heap{a=[];push(v){this.a.push(v);let i=this.a.length-1;while(i){const p=(i-1)>>1;if(this.a[p][0]<=v[0])break;this.a[i]=this.a[p];i=p;}this.a[i]=v;}pop(){const root=this.a[0],v=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let j=i*2+1;if(j+1<this.a.length&&this.a[j+1][0]<this.a[j][0])j++;if(this.a[j][0]>=v[0])break;this.a[i]=this.a[j];i=j;}this.a[i]=v;}return root;}}
function route(from,to,graph=nodes){const start=points[from].index,end=points[to].index;if(!graph.has(start)||!graph.has(end))return {blockedEndpoint:!graph.has(start)?from:to};const q=new Heap();q.push([0,start]);const ds=new Map([[start,0]]),prev=new Map();while(q.a.length){const [d,i]=q.pop();if(d!==ds.get(i))continue;if(i===end)break;const a=graph.get(i);for(const dz of [-1,0,1])for(const dx of [-1,0,1]){if(!dx&&!dz)continue;const j=i+dx+dz*nx,b=graph.get(j);if(!b||Math.hypot(a.x-b.x,a.z-b.z)>step*1.5||Math.abs(a.y-b.y)>.25)continue;if(dx&&dz&&(!graph.has(i+dx)||!graph.has(i+dz*nx)))continue;const n=d+Math.hypot(a.x-b.x,a.z-b.z,a.y-b.y);if(n<(ds.get(j)??Infinity)){ds.set(j,n);prev.set(j,i);q.push([n,j]);}}}if(!ds.has(end))return {unreachable:true};let i=end,path=[];while(i!==undefined){path.push(graph.get(i));i=prev.get(i);}path.reverse();const p=points[from].p,t=points[to].p;return {length:+ds.get(end).toFixed(3),direct:+Math.hypot(...p.map((v,i)=>v-t[i])).toFixed(3),ramps:[...new Set(path.filter(p=>p.id.includes('ramp')).map(p=>p.id))],path};}
let output={count:nodes.size,stations,points:structuredClone(points),obstacles:base.obstacles,routes:{}};
for(const a of Object.keys(points))for(const b of Object.keys(points)){if(a>=b)continue;const r=route(a,b);output.routes[a+'->'+b]={...r,path:undefined};}
log(JSON.stringify(output,null,2));
// Explicit ordinary props omitted from current checker. OBB tops and real pillars;
// avoid treating complete floor+upper-shell object0 as a single huge obstacle.
const props=[
 {id:'crate',p:[8.95,0,5.78],yaw:-.25,half:[.35,.355]},
 {id:'canister',p:[10.13,0,5.22],r:.27},
 {id:'shelf-west',p:[4.13,2.6,-6.55],yaw:.19,half:[(1.58+.18)/2,(.59+.10)/2]},
 {id:'shelf-middle',p:[8.8,2.6,-6.76],yaw:-.12,half:[(3.08+.18)/2,(.72+.10)/2]},
 {id:'shelf-east',p:[12.32,2.6,-5.13],yaw:-.28,half:[(2.45+.18)/2,(.80+.10)/2]},
 {id:'pier-east',p:[13.28,2.6,-5.2],yaw:0,half:[.29,.355]},
 {id:'pier-middle',p:[9.53,2.6,-7.2],yaw:0,half:[.245,.305]},
 {id:'pier-under-west',p:[4.7,0,-5.04],yaw:0,half:[.17,.205]},
 {id:'pier-under-middle',p:[8.07,0,-3.39],yaw:0,half:[.22,.245]},
 {id:'pier-under-east',p:[12.65,0,-2.7],yaw:0,half:[.205,.24]},
];
function clearance(p,o){const x=p.x-o.p[0],z=p.z-o.p[2];if(o.r)return Math.hypot(x,z)-o.r;const lx=x*Math.cos(o.yaw)-z*Math.sin(o.yaw),lz=x*Math.sin(o.yaw)+z*Math.cos(o.yaw);return Math.hypot(Math.max(0,Math.abs(lx)-o.half[0]),Math.max(0,Math.abs(lz)-o.half[1]));}
const realNodes=new Map([...nodes].filter(([i,p])=>!props.some(o=>Math.abs(p.y-o.p[1])<.3&&clearance(p,o)<radius)));
output.extraProps={count:realNodes.size,removed:nodes.size-realNodes.size,endpointClearances:Object.fromEntries(Object.entries(points).map(([key,n])=>[key,props.filter(o=>Math.abs(n.p[1]-o.p[1])<.3).map(o=>({id:o.id,distance:+clearance({x:n.p[0],z:n.p[2]},o).toFixed(3)})).sort((a,b)=>a.distance-b.distance).slice(0,2)])),routes:{}};
for(const a of Object.keys(points))for(const b of Object.keys(points)){if(a>=b)continue;const r=route(a,b,realNodes);output.extraProps.routes[a+'->'+b]={...r,path:undefined};}
log('ADDED STATIC PROPS',JSON.stringify(output.extraProps,null,2));
const withoutWest=new Map([...nodes].filter(([i,p])=>p.id!=='west-ramp'));
const visits=new Set([points.actor.index]),todo=[points.actor.index];for(let n=0;n<todo.length;n++){const i=todo[n],a=withoutWest.get(i);for(const d of [-nx,nx,-1,1]){const j=i+d,b=withoutWest.get(j);if(!b||visits.has(j)||Math.hypot(a.x-b.x,a.z-b.z)>step*1.1||Math.abs(a.y-b.y)>.25)continue;visits.add(j);todo.push(j);}}
const withoutWestConnectivity=Object.fromEntries([...new Set([...nodes.values()].map(n=>n.id))].map(id=>[id,{total:[...withoutWest.values()].filter(n=>n.id===id).length,reachable:[...visits].filter(i=>withoutWest.get(i).id===id).length}]));
log('NO WEST',withoutWestConnectivity);
const east=[...nodes].filter(([i,n])=>n.id==='east-ramp');
log('EAST ROWS',Object.fromEntries([...new Set(east.map(([i,n])=>n.z))].sort((a,b)=>a-b).map(z=>[z.toFixed(2),east.filter(([i,n])=>n.z===z).map(([i,n])=>[+n.x.toFixed(2),+n.y.toFixed(3),visits.has(i)?'A':'U'])])));
const pathOut={algorithm:'0.16 scene-unit grid; radius .22; 8-neighbour Dijkstra, 3D distance, no corner cutting; same conservative station/seat/furnace AABBs as check.mjs; environment props not included in base routes',routes:{}};
for(const [a,b] of [['rift','storage'],['core','storage'],['actor','growth'],['offering','growth'],['purifier','rest'],['actor','purifier']]){const r=route(a,b),pp=r.path;const simple=pp.filter((p,i)=>{if(i===0||i===pp.length-1)return true;const a=pp[i-1],b=pp[i+1];return Math.abs((p.x-a.x)*(b.z-p.z)-(p.z-a.z)*(b.x-p.x))>1e-6||p.id!==a.id||p.id!==b.id;});pathOut.routes[a+'->'+b]={length:r.length,direct:r.direct,ramps:r.ramps,points:simple.map(p=>[+p.x.toFixed(3),+p.y.toFixed(3),+p.z.toFixed(3)])};}
function footAt(x,z){const h=elevation(x,z);let delta=0;for(let k=0;k<8;k++){const a=k*Math.PI/4,q=elevation(x+Math.cos(a)*radius,z+Math.sin(a)*radius);delta=Math.max(delta,Math.abs(q.height-h.height));}return {x,z,y:+h.height.toFixed(4),surface:h.id,maximumFootHeightDifference:+delta.toFixed(4),valid:delta<=.27};}
const eastTopWithoutObstacles=[-2.60,-2.44,-2.32,-2.28,-2.24,-2.20,-2.16,-2.12].map(z=>footAt(12.08,z));
log('EAST TOP NO OBSTACLES',eastTopWithoutObstacles);
let nr,dd=Infinity;for(const [i,n]of realNodes){const d=(n.x-points.rift.p[0])**2+(n.z-points.rift.p[2])**2+(n.y-points.rift.p[1])**2*3;if(d<dd){dd=d;nr=i;}}log('RIFT SHIFT',realNodes.get(nr),'offset',Math.sqrt(dd));points.rift.index=nr;
log('RIFT ALTERNATIVE ROUTES',Object.fromEntries(['actor','core','storage','growth'].map(k=>{const r=route('rift',k,realNodes);return [k,{...r,path:undefined}]})));
pathOut.withAuthoredProps={riftApproachAlternative:[realNodes.get(nr).x,realNodes.get(nr).y,realNodes.get(nr).z],props,routes:{}};
for(const [a,b] of [['rift','storage'],['rift','growth'],['core','rift']]){const r=route(a,b,realNodes),pp=r.path;const simple=pp.filter((p,i)=>{if(i===0||i===pp.length-1)return true;const a=pp[i-1],b=pp[i+1];return Math.abs((p.x-a.x)*(b.z-p.z)-(p.z-a.z)*(b.x-p.x))>1e-6||p.id!==a.id||p.id!==b.id;});pathOut.withAuthoredProps.routes[a+'->'+b]={length:r.length,direct:r.direct,ramps:r.ramps,points:simple.map(p=>[+p.x.toFixed(3),+p.y.toFixed(3),+p.z.toFixed(3)])};}
pathOut.eastRampUpperSeam={x:12.08,lowerNode:[12.08,2.3527,-2.12],rejectedUpperNode:[12.08,2.6,-2.28],nextUpperNode:[12.08,2.6,-2.44],reason:'Foot-circle maximum elevation spread .2919 exceeds .27; intervening sampled row rejected independently of device or prop obstacles. Removing west-ramp nodes leaves every east-ramp sample and main node connected to actor, zero upper nodes.'};

output.metadata=metadata;
output.withoutWestConnectivity=withoutWestConnectivity;
output.eastTopWithoutObstacles=eastTopWithoutObstacles;
output.extraProps.definitions=props;
output.extraProps.riftApproachAlternative={point:pathOut.withAuthoredProps.riftApproachAlternative,offset:Math.sqrt(dd)};
output.extraProps.alternativeRoutes=pathOut.withAuthoredProps.routes;
pathOut.metadata=metadata;
fs.writeFileSync(path.join(outputDir,'audit.json'),JSON.stringify(output,null,2)+'\n');
fs.writeFileSync(path.join(outputDir,'routes.json'),JSON.stringify(pathOut,null,2)+'\n');
fs.writeFileSync(path.join(outputDir,'audit-output.txt'),JSON.stringify(metadata,null,2)+'\n\n'+transcript.join('\n\n')+'\n');
console.log(JSON.stringify({sceneBaseline,currentHead:metadata.currentHead,baseNodes:nodes.size,withStaticProps:realNodes.size,withoutWestConnectivity,riftApproachAlternative:output.extraProps.riftApproachAlternative,files:['audit.json','routes.json','audit-output.txt']},null,2));
