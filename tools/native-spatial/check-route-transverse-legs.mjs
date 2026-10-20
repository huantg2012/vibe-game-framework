/** Small grid geometry only: no world generation, deployment, browser or saved-game writes. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NATIVE_SPATIAL_DIRECTIONS as directions,nativeCellPoint} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {evaluateNativeSpatialRoutes} from '../../src/generation/world-study/native-spatial-routes.ts';

const policy={
  encounterRadiusPx:112,minRouteLengthPx:224,minRouteEncounters:6,
  minRouteHoleShare:.6,maxRouteHoleShare:.75,holeToSolidRatio:2,windowSize:6,minWindowHoles:3,
  referenceSightPx:224,narrowWidthPx:160,maxNarrowRatio:.2,maxNarrowRunPx:224,
};
// Rectangular unions provide independent, exact grid boundaries. Body edges use
// the same 20px box throughout; this fixture is a route measurement, not G1–G4 admission.
function geometryFor(rectangles){
  const cols=Math.max(...rectangles.map(r=>r[2]))/8,rows=Math.max(...rectangles.map(r=>r[3]))/8;
  const matter=new Uint8Array(cols*rows),reachable=new Uint8Array(cols*rows),links8=new Uint8Array(cols*rows);
  const hasMatter=(x,y)=>rectangles.some(([left,top,right,bottom])=>x>=left&&x<right&&y>=top&&y<bottom);
  const supports=p=>[-10,10-1e-7].every(dx=>[-10,10-1e-7].every(dy=>hasMatter(p.x+dx,p.y+dy)));
  const displacementFraction=(p,_halfW,_halfH,dx,dy)=>{
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)));
    for(let i=0;i<=steps;i++)if(!supports({x:p.x+dx*i/steps,y:p.y+dy*i/steps}))return Math.max(0,(i-1)/steps);
    return 1;
  };
  for(let cell=0;cell<matter.length;cell++){
    const p=nativeCellPoint(cell,cols);matter[cell]=Number(hasMatter(p.x,p.y));reachable[cell]=Number(supports(p));
  }
  for(let cell=0;cell<reachable.length;cell++)if(reachable[cell]){
    const p=nativeCellPoint(cell,cols);
    directions.forEach(([dx,dy],index)=>{
      const x=cell%cols+dx,y=Math.floor(cell/cols)+dy,next=y*cols+x;
      if(x>=0&&y>=0&&x<cols&&y<rows&&reachable[next]&&displacementFraction(p,10,10,dx*8,dy*8)===1)links8[cell]|=1<<index;
    });
  }
  return{
    terrain:{cols,rows,matter},reachable,links8,reachableCount:reachable.reduce((sum,n)=>sum+n,0),
    collision:{supports,displacementFraction},solidPrimitives:[],solidDistance:()=>Infinity,
    sight:{cols,rows,tileSize:8,version:0,isOpaque:(x,y)=>x<0||y<0||x>=cols||y>=rows||!matter[y*cols+x]},
  };
}
const layout=(spawnPoint,exitPoint,nodes=[])=>({spawnPoint,extractionPoint:{position:exitPoint},kindlingNodes:nodes,contaminantNodes:[]});
const fixtures=[
  {id:'short-recess-return',rects:[[0,0,256,80]],layout:layout({x:20,y:44},{x:20,y:44},[{id:'recess',position:{x:212,y:44}}])},
  {id:'long-one-way',rects:[[0,0,384,80]],layout:layout({x:20,y:44},{x:340,y:44})},
  {id:'unequal-legs',rects:[[0,0,256,320],[256,112,512,192]],layout:layout({x:100,y:156},{x:20,y:156},[{id:'tail',position:{x:436,y:156}}])},
  {id:'zero-length',rects:[[0,0,80,80]],layout:layout({x:44,y:44},{x:44,y:44})},
];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const measured=fixtures.map(f=>({...f,geometry:geometryFor(f.rects)}));
// Entire output fingerprints captured from the unchanged revision 12/13
// evaluator before adding the option. Includes paths, diagnostics and sections.
const legacyHashes=[
  '7f7ec147ed51b9447c9611c18208b1c65cd0662c5ff34234bad4cb0dfac171c6',
  '9e78b90530990c976b751f4f15a62d317f260be592ce0653035b5d19433e60b0',
  '1756c0339de1df6b88edf36208f06c53b48ee6580487156837db67b730c3c34c',
  'b6585c951a046df174e7e4857a93236a42011bd153e5677308259572d3ebce22',
];
const results=measured.map((f,index)=>{
  const legacy=evaluateNativeSpatialRoutes(f.geometry,[],policy,f.layout);
  assert.equal(hash(legacy),legacyHashes[index],`${f.id}: no-option output must exactly preserve its pre-change fingerprint`);
  assert.deepEqual(evaluateNativeSpatialRoutes(f.geometry,[],policy,f.layout,{}),legacy);
  assert.deepEqual(evaluateNativeSpatialRoutes(f.geometry,[],policy,f.layout,{transverseMode:'legacy-complete'}),legacy);
  const current=evaluateNativeSpatialRoutes(f.geometry,[],policy,f.layout,{transverseMode:'per-leg'});
  assert.match(current.metrics.transverseScope,/Per actual leg/);
  assert.deepEqual(current.qualityDiagnostics.filter(r=>!r.endsWith(':narrow-ratio')),legacy.qualityDiagnostics.filter(r=>!r.endsWith(':narrow-ratio')));
  assert.deepEqual(current.reasons.filter(r=>!r.endsWith(':max-narrow-run')),legacy.reasons.filter(r=>!r.endsWith(':max-narrow-run')));
  for(const [i,route] of current.metrics.routes.entries()){
    const {transverse,...other}=route,{transverse:oldTransverse,...oldOther}=legacy.metrics.routes[i];
    assert.deepEqual(other,oldOther,'Paths, seats, first encounters and non-transverse results remain unchanged');
    assert.equal(transverse.scope,'per-leg');
    assert.equal(transverse.lengthPx,transverse.legs.reduce((sum,l)=>sum+l.lengthPx,0));
    assert.equal(transverse.narrowPx,transverse.legs.reduce((sum,l)=>sum+l.narrowPx,0));
    assert.equal(transverse.uncertainPx,transverse.legs.reduce((sum,l)=>sum+l.uncertainPx,0));
    assert.equal(transverse.maxNarrowOrUncertainRunPx,Math.max(...transverse.legs.map(l=>l.maxNarrowOrUncertainRunPx)));
    assert.equal(transverse.narrowRatio,transverse.lengthPx?transverse.narrowPx/transverse.lengthPx:0);
    assert.equal(current.qualityDiagnostics.includes(`${route.id}:narrow-ratio`),transverse.narrowRatio>policy.maxNarrowRatio);
    for(const section of transverse.sections){
      const leg=transverse.legs[section.legIndex];
      assert.equal(section.at,leg.startAtPx+section.legAtPx);
    }
    if(route.id==='direct-exit'){
      const {legIndex,startAtPx,...single}=transverse.legs[0];
      assert.equal(legIndex,0);assert.equal(startAtPx,0);
      assert.deepEqual(single,oldTransverse,'A single physical leg must retain its original measurement');
    }
  }
  return{id:f.id,legacy,current};
});
const routeOf=(gate,id)=>gate.metrics.routes.find(r=>r.id===id);
const recess=results[0],short=routeOf(recess.current,'node:recess').transverse;
assert.equal(routeOf(recess.legacy,'node:recess').transverse.maxNarrowOrUncertainRunPx,288);
assert(recess.legacy.reasons.includes('node:recess:max-narrow-run'));
assert.equal(short.lengthPx,288);assert.deepEqual(short.legs.map(l=>l.lengthPx),[144,144]);
assert.equal(short.maxNarrowOrUncertainRunPx,144);assert.equal(short.narrowPx,288);assert.equal(short.uncertainPx,0);
assert.equal(short.narrowRatio,1,'Both traversals remain in real mileage, even when a run cannot cross their stop');
assert(!recess.current.reasons.some(r=>r.startsWith('node:recess:')&&r.endsWith(':max-narrow-run')));
assert.equal(short.accepted,false,'The existing combined diagnostic still reports the high narrow ratio');

const long=results[1].current;
assert.equal(routeOf(long,'direct-exit').transverse.maxNarrowOrUncertainRunPx,320);
assert(long.reasons.includes('direct-exit:leg:0:max-narrow-run'));
for(const [length,rejected] of [[224,false],[232,true]]){
  const gate=evaluateNativeSpatialRoutes(measured[1].geometry,[],policy,layout({x:20,y:44},{x:20+length,y:44}),{transverseMode:'per-leg'});
  assert.equal(routeOf(gate,'direct-exit').transverse.maxNarrowOrUncertainRunPx,length);
  assert.equal(gate.reasons.includes('direct-exit:leg:0:max-narrow-run'),rejected);
}

const unequal=routeOf(results[2].current,'node:tail').transverse;
assert.deepEqual(unequal.legs.map(l=>l.lengthPx),[288,368]);
assert.deepEqual(unequal.legs.map(l=>l.narrowPx),[128,136]);
assert.equal(unequal.narrowRatio,264/656);
assert.notEqual(unequal.narrowRatio,unequal.legs.reduce((sum,l)=>sum+l.narrowRatio,0)/2,'Do not average leg percentages');
const stationary=routeOf(results[3].current,'direct-exit').transverse;
assert.equal(stationary.lengthPx,0);assert.equal(stationary.narrowRatio,0);assert.equal(stationary.maxNarrowOrUncertainRunPx,0);
console.log(JSON.stringify({
  status:'passed',scope:'Synthetic route measurements only; no full map admission, generation, deployment or browser',
  legacyExactFixtures:results.length,
  shortRecess:{travelledPx:short.lengthPx,legLengthsPx:short.legs.map(l=>l.lengthPx),maxRunPx:short.maxNarrowOrUncertainRunPx,narrowRatio:short.narrowRatio},
  longOneWay:{maxRunPx:320,rejected:true},strictThreshold:{at224:'accepted',at232:'rejected'},
  unequalLegs:{lengthPx:unequal.lengthPx,narrowPx:unequal.narrowPx,narrowRatio:unequal.narrowRatio},
},null,2));
