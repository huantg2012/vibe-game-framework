import fs from 'node:fs';import path from 'node:path';import {createHash}from'node:crypto';
const root='/Users/yilungao/coh',base=root+'/docs/qa/artifacts/r100-i10-i12/b03-shard-refined',out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),parse=p=>JSON.parse(fs.readFileSync(p,'utf8').split('export const R100_NATIVE_WORLDS: readonly R100NativeWorldEntry[] = ')[1].replace(/;\s*$/,''));
const {buildNativeVolume,NativeBodyCollision}=await import(base+'/body3/executor.mjs');
const wanted=[[270,380],[456,404],[574,529],[723,478],[858,390]],boxes=[[240,350,500,451],[425,385,650,580],[540,420,795,580],[685,330,920,535]];
const sources=[['original',base+'/native72-before.ts.txt'],['first-repair',root+'/src/generated/r100-native-worlds.ts']],results=[];
for(const [label,src]of sources){const definition=parse(src).find(r=>r.id==='shard-switchback').definitions[1],seed=20261005;
const inside=(poly,x,y)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
const tiles=Array.from({length:96},(_,r)=>Array.from({length:128},(_,c)=>{const x=c*8+4,y=r*8+4,C=Math.floor(x/32),R=Math.floor(y/32);return C>=1&&R>=1&&C<31&&R<23&&!(C<3&&R<3)&&!(C>28&&R>20)&&!definition.erosion.some(p=>inside(p,x,y))?1:3;}));
const meshes=definition.instances.map(({role,...s})=>buildNativeVolume({...s,family:s.family??definition.family,blocking:role==='solid'?1:0,seed:seed^Math.imul(s.id,104729)})),body=new NativeBodyCollision({definition,meshes},{cols:128,rows:96,tileSize:8,tiles});
const point=i=>({x:i%128*8+4,y:Math.floor(i/128)*8+4}),cells=Uint8Array.from({length:128*96},(_,i)=>body.supports(point(i),10,10)?1:0);
const nearest=([x,y])=>{let cell=-1,distance=Infinity;for(let i=0;i<cells.length;i++)if(cells[i]){const p=point(i),d=Math.hypot(p.x-x,p.y-y);if(d<distance){distance=d;cell=i;}}return{wanted:{x,y},actual:point(cell),cell,distance};};
const search=(start,end,box)=>{const prev=new Int32Array(cells.length).fill(-1),queue=[start];prev[start]=start;for(let at=0;at<queue.length&&prev[end]<0;at++){const cell=queue[at],p=point(cell);for(const[dc,dr]of[[1,0],[-1,0],[0,1],[0,-1]]){const c=cell%128+dc,r=Math.floor(cell/128)+dr,n=r*128+c,q=point(n);if(c<0||r<0||c>=128||r>=96||!cells[n]||prev[n]>=0||box&&(q.x<box[0]||q.y<box[1]||q.x>box[2]||q.y>box[3]))continue;if(body.displacementFraction(p,10,10,dc*8,dr*8)<1||body.displacementFraction(q,10,10,-dc*8,-dr*8)<1)continue;prev[n]=cell;queue.push(n);}}
if(prev[end]<0)return{status:'BLOCKED',reachableCells:queue.length};const route=[];for(let p=end;;p=prev[p]){route.push(point(p));if(p===start)break;}route.reverse();return{status:'PASS',lengthPx:(route.length-1)*8,route};};
const stations=wanted.map(nearest),spawn=nearest([196,588]),spawnRoutes=stations.map(s=>search(spawn.cell,s.cell)),corridors=boxes.map((b,i)=>({box:b,...search(stations[i].cell,stations[i+1].cell,b)}));
results.push({label,source:src,sourceSha256:sha(src),stations,spawnRoutes,corridors});
console.log(label,'spawn',spawnRoutes.map(r=>r.status),'corridors',corridors.map(r=>r.status));
}
fs.writeFileSync(out+'/report.json',JSON.stringify({scope:'Read-only diagnostic of the exact two authored XY meshes and existing 8px authored floor; no MasterWorld, no art/production admission. Boxes were newly introduced in the failed repair fixture and are explicitly tested against the old baseline before attributing failure.',executorSha256:sha(base+'/body3/executor.mjs'),seed:20261005,results},null,2)+'\n');
