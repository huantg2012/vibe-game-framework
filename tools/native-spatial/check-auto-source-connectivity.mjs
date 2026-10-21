/** Saved failure is source-only: real 20px support exists inside a pocket made
 * by two complete source solids. No shore or whole-map generation is needed. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createNativeAutoRuntimeInput,validNativeAutoRuntimeInput} from '../../src/generation/world-study/native-auto-recipe.ts';
import {nativeAutoSourceProjection} from '../../src/generation/world-study/native-auto-source.ts';
import {createNativeBodyPrimitiveProbe} from '../../src/generation/world-study/native-body-collision.ts';

const fixture=fs.readFileSync(process.argv[2]??new URL('../../docs/qa/artifacts/automatic-world-generation-2026-10-21/connected-source-pocket-before.json.gz',import.meta.url));
const saved=JSON.parse((fixture[0]===0x1f&&fixture[1]===0x8b?gunzipSync(fixture):fixture).toString('utf8'));
const native=saved.recipe.nativeDefinition,seed=saved.recipe.nativeAuto.geometrySeed;
const original=structuredClone(native),input=createNativeAutoRuntimeInput(native,native.grade,seed);
const before=nativeAutoSourceProjection(native,seed,1),after=nativeAutoSourceProjection(native,seed,input.nativeSpatial.assemblies[0].sourceScale,input.policy.objectClearancePx);

function connectivity(primitives){
  const left=Math.floor((Math.min(...primitives.map(p=>p.minX))-40)/8)*8,top=Math.floor((Math.min(...primitives.map(p=>p.minY))-40)/8)*8;
  const cols=Math.ceil((Math.max(...primitives.map(p=>p.maxX))+40-left)/8),rows=Math.ceil((Math.max(...primitives.map(p=>p.maxY))+40-top)/8);
  assert(cols*rows<=32768,'Source-only graph has a fixed cell bound');
  const cache=new Map(),point=i=>({x:left+(i%cols+.5)*8,y:top+(Math.floor(i/cols)+.5)*8});
  // A 64px bucket includes every triangle the 20px body can touch during one
  // 8px edge. SAT and sweep themselves are the actual runtime implementation.
  const probe=p=>{
    const x=Math.floor(p.x/64)*64,y=Math.floor(p.y/64)*64,key=`${x},${y}`;
    if(!cache.has(key))cache.set(key,createNativeBodyPrimitiveProbe(primitives.filter(t=>t.minX<=x+82&&t.maxX>=x-18&&t.minY<=y+82&&t.maxY>=y-18)
      .map(t=>[0,2,4].map(at=>({x:t.points[at],y:t.points[at+1]})))));
    return cache.get(key);
  };
  const supported=Uint8Array.from({length:cols*rows},(_,i)=>Number(probe(point(i)).supports(point(i))));
  const reached=new Uint8Array(supported.length),queue=new Int32Array(supported.length);let head=0,tail=1;queue[0]=0;reached[0]=1;
  assert(supported[0]);
  while(head<tail){
    const cell=queue[head++],p=point(cell),x=cell%cols,y=Math.floor(cell/cols),body=probe(p);
    for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]]){
      const xx=x+dx,yy=y+dy,next=yy*cols+xx;
      if(xx<0||yy<0||xx>=cols||yy>=rows||!supported[next]||reached[next])continue;
      if(body.displacementFraction(p,dx*8,dy*8)<1)continue;
      reached[next]=1;queue[tail++]=next;
    }
  }
  return{supported:supported.reduce((sum,n)=>sum+n,0),reachable:tail,missing:Array.from(supported.keys()).filter(i=>supported[i]&&!reached[i]).map(point)};
}

const originalGraph=connectivity(before.footprint.solidPrimitives),preparedGraph=connectivity(after.footprint.solidPrimitives);
assert.deepEqual(originalGraph.missing,[{x:28,y:-20},{x:36,y:-20}],'Original saved failure retains its two real body seats');
assert.equal(preparedGraph.supported,preparedGraph.reachable,'Prepared source retains access to every legal body seat');
assert(after.areaPx2<=input.policy.targetWalkAreaPx2*input.policy.maxSourceAreaPercent/100,'Prepared group fits the same 20% budget');
assert.deepEqual(native,original,'Native source model is untouched');
assert.deepEqual(after.instances.map(i=>[i.id,i.role]),native.instances.map(i=>[i.id,i.role]),'Complete object set survives');
assert(validNativeAutoRuntimeInput(JSON.parse(JSON.stringify(input)),native,native.profile),'JSON frozen replay validates');
assert.deepEqual(createNativeAutoRuntimeInput(native,native.grade,seed),input,'Preparation is deterministic');
for(const mutate of [x=>{x.preparedSource.instances[0].x+=8;},x=>{x.preparedSource.instances[0].length+=8;},x=>{x.preparedSource.instances.pop();},
  x=>{x.preparedSource.instances[2].height+=1;},x=>{x.preparedSource.algorithm='unknown';},x=>{x.preparedSource.instances[0].x=Infinity;},x=>{x.preparedSource.instances[0].extra=1;}]){
  const damaged=structuredClone(input);mutate(damaged);assert(!validNativeAutoRuntimeInput(damaged,native,native.profile),'Frozen source cannot be replaced or partially modified');
}
const source1=before.instances.find(i=>i.id===1),relief=before.instances.find(i=>i.role==='relief');
const moved1=after.instances.find(i=>i.id===1),movedRelief=after.instances.find(i=>i.id===relief.id);
assert.equal(movedRelief.x-moved1.x,relief.x-source1.x,'Relief retains its original parent-relative offset');
assert.equal(movedRelief.y-moved1.y,relief.y-source1.y);
console.log(JSON.stringify({status:'passed',worldId:native.profile,grade:native.grade,seed,originalGraph,preparedGraph,sourceAreaPx2:after.areaPx2,scale:input.nativeSpatial.assemblies[0].sourceScale}));
