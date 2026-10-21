/** Independent collision oracle. Reads one saved definition; never generates a map. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {build} from 'esbuild';

const args=process.argv.slice(2);
const savedFile=args.length===1?'docs/qa/artifacts/automatic-world-generation-2026-10-21/connected-source-pocket-before.json.gz':args[0],output=args.at(-1);
assert(savedFile&&output&&args.length<=2,'Usage: node tools/native-spatial/check-connected-collision-equivalence.mjs [SAVED_LAYOUT.json[.gz]] NEW_REPORT.json');
assert(!fs.existsSync(output),'Retain previous evidence');
const baseline='1ab523f3',source='src/generation/world-study/native-body-collision.ts';
const files=[source,'src/generation/world-study/native-auto-traversal.ts','src/generation/world-study/native-spatial-geometry.ts','src/generation/world-study/native-terrain.ts'];
const hashes=()=>Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const before=hashes(),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'coh-connected-collision-'));
const buildOptions={bundle:true,platform:'node',format:'esm',target:'node22',tsconfig:'tools/contam-preview/tsconfig.json',logLevel:'silent'};
const cases=[];
async function check(id,run){
  const started=performance.now();let evidence={};
  try{evidence=await run();cases.push({id,passed:true,...evidence,elapsedMs:performance.now()-started});}
  catch(error){cases.push({id,passed:false,...evidence,error:String(error.stack??error),elapsedMs:performance.now()-started});}
  console.log(JSON.stringify(cases.at(-1)));
}
try{
  const old=execFileSync('git',['show',`${baseline}:${source}`],{encoding:'utf8'});
  await build({...buildOptions,stdin:{contents:old,sourcefile:path.resolve(source),resolveDir:path.resolve(path.dirname(source)),loader:'ts'},outfile:path.join(temporary,'old.mjs')});
  await build({...buildOptions,stdin:{contents:`
    export {NativeBodyCollision,createNativeBodyPrimitiveProbe} from './src/generation/world-study/native-body-collision';
    export {compileNativeTerrain} from './src/generation/world-study/native-terrain';
    export {nativeSolidPrimitives,nativePrimitive,NATIVE_SPATIAL_DIRECTIONS} from './src/generation/world-study/native-spatial-geometry';
    export {createNativeAutoTraversalTemplate,createNativeAutoConnectivity} from './src/generation/world-study/native-auto-traversal';
    export {TileType} from './src/types/game-types';`,resolveDir:process.cwd(),loader:'ts'},outfile:path.join(temporary,'current.mjs')});
  const {NativeBodyCollision:Old}=await import(pathToFileURL(path.join(temporary,'old.mjs')).href);
  const api=await import(pathToFileURL(path.join(temporary,'current.mjs')).href);
  const fixtureBytes=fs.readFileSync(savedFile),saved=JSON.parse((savedFile.endsWith('.gz')?gunzipSync(fixtureBytes):fixtureBytes).toString('utf8')),definition=saved.layout?.definition??saved.definition;
  assert(definition,'Saved file must contain layout.definition or definition');
  const seed=saved.layout?.layoutSeed??saved.recipe?.nativeAuto?.geometrySeed??saved.recipe?.requestedSeed;
  assert(Number.isInteger(seed),'Saved file must identify the compile seed');
  const terrain=api.compileNativeTerrain(definition,seed,false),current=new api.NativeBodyCollision(terrain,terrain.tileMap),oldCollision=new Old(terrain,terrain.tileMap);
  const directions=api.NATIVE_SPATIAL_DIRECTIONS;
  const supported=[],oldLinks=[],at=cell=>({x:(cell%terrain.cols+.5)*8,y:(Math.floor(cell/terrain.cols)+.5)*8});
  await check('saved-failure-all-supports-and-eight-direction-sweeps',()=>{
    let edges=0,blocked=0;
    for(let cell=0;cell<terrain.cols*terrain.rows;cell++){
      const point=at(cell),expected=oldCollision.supports(point,10,10);
      assert.equal(current.supports(point,10,10),expected,`Support at ${point.x},${point.y}`);
      if(!expected)continue;supported.push(cell);let mask=0;
      for(let direction=0;direction<directions.length;direction++){
        const [dx,dy]=directions[direction];
        const expectedFraction=oldCollision.displacementFraction(point,10,10,dx*8,dy*8);
        assert.equal(current.displacementFraction(point,10,10,dx*8,dy*8),expectedFraction,`Sweep at ${point.x},${point.y} by ${dx},${dy}`);
        if(expectedFraction>=1-1e-9)mask|=1<<direction;
        edges++;blocked+=Number(expectedFraction<1);
      }
      oldLinks.push(mask);
    }
    return{cells:terrain.cols*terrain.rows,supported:supported.length,sweeps:edges,blockedSweeps:blocked,triangleCount:current.triangleCount};
  });
  await check('connected-core-rejects-saved-source-pocket-with-old-edges',()=>{
    const points=supported.map(cell=>({gx:cell%terrain.cols,gy:Math.floor(cell/terrain.cols)}));
    const connected=api.createNativeAutoConnectivity(points,terrain.spawnPoint),available=new Uint8Array(points.length).fill(1),links=Uint8Array.from(oldLinks);
    const indices=new Map(supported.map((cell,index)=>[cell,index])),start=Math.floor(terrain.spawnPoint.y/8)*terrain.cols+Math.floor(terrain.spawnPoint.x/8),seen=new Set([start]),queue=[start];
    for(let head=0;head<queue.length;head++){
      const cell=queue[head],index=indices.get(cell);
      for(let direction=0;direction<8;direction++)if(oldLinks[index]&(1<<direction)){
        const [dx,dy]=directions[direction],next=cell+dx+dy*terrain.cols;
        if(indices.has(next)&&!seen.has(next)){seen.add(next);queue.push(next);}
      }
    }
    const unreachable=supported.filter(cell=>!seen.has(cell)).map(at);
    assert.deepEqual(unreachable,[{x:1404,y:708},{x:1412,y:708}],'Historical failure fixture retains the known source pocket');
    assert.equal(connected(available,links),false,'All legal body points must be connected, not only the spawn component');
    available[indices.get(start)]=0;
    assert.equal(connected(available,links),false,'Unavailable spawn cannot accept a candidate');
    return{supported:points.length,reachable:queue.length,unreachable};
  });
  await check('saved-failure-representative-motion-exemptions-and-invalid-inputs',()=>{
    let sweeps=0,motions=0;
    const indices=[...new Set([0,supported.length-1,...Array.from({length:96},(_,i)=>Math.floor(i*supported.length/96))])];
    for(const index of indices){
      const point=at(supported[index]);
      for(const [dx,dy] of directions)for(const length of [0,1,32,128]){
        const exemption={left:point.x-24,right:point.x+48,top:point.y-24,bottom:point.y+48};
        assert.equal(current.displacementFraction(point,10,10,dx*length,dy*length,exemption),oldCollision.displacementFraction(point,10,10,dx*length,dy*length,exemption));sweeps++;
        const next={},prior={};current.resolveMotion(point,10,10,dx*length,dy*length,{x:dx*100,y:dy*100},next);oldCollision.resolveMotion(point,10,10,dx*length,dy*length,{x:dx*100,y:dy*100},prior);
        assert.deepEqual(next,prior);motions++;
      }
    }
    const point=at(supported[0]);
    for(const value of [NaN,Infinity,-Infinity]){
      assert.equal(current.supports({x:value,y:point.y},10,10),oldCollision.supports({x:value,y:point.y},10,10));
      assert.equal(current.displacementFraction(point,10,10,value,0),oldCollision.displacementFraction(point,10,10,value,0));
    }
    for(const half of [0,-1,NaN,Infinity])assert.equal(current.supports(point,half,10),oldCollision.supports(point,half,10));
    for(const p of [{x:0,y:0},{x:10,y:10},{x:terrain.width-10,y:terrain.height-10},{x:terrain.width,y:terrain.height},{x:1404,y:708},{x:1412,y:708}])assert.equal(current.supports(p,10,10),oldCollision.supports(p,10,10));
    return{representativePoints:indices.length,sweeps,motions,invalidInputs:10,knownIsolatedPoints:[{x:1404,y:708},{x:1412,y:708}]};
  });
  await check('independent-primitive-template-matches-old-swept-edge-contract',()=>{
    // Narrow gaps, exact tangency, asymmetric triangles, bucket crossing, and
    // floor rectangles are independent fixtures, not generated candidates.
    const fixtures=[[[64,64,128,64,128,128],[64,64,128,128,64,128]],
      [[64,64,80,64,80,144],[100,64,116,64,100,144]],
      [[64,64,80,64,80,144],[99,64,116,64,99,144]],
      [[64,64,144,72,80,144]],[[56,56,64,56,64,64,56,64]]];
    let points=0,edges=0;
    for(const coordinates of fixtures){
      const primitives=coordinates.map((p,i)=>api.nativePrimitive(p,i+1)),template=api.createNativeAutoTraversalTemplate(primitives);
      const meshes=coordinates.map((p,i)=>({spec:{id:i+1},positions:Float32Array.from(p.flatMap((value,index)=>index%2===0?[value,p[index+1],0]:[])),indices:Uint16Array.from(p.length===8?[0,1,2,0,2,3]:[0,1,2])}));
      const fixture={definition:{instances:coordinates.map((_,i)=>({id:i+1,role:'solid'}))},meshes};
      const map={cols:32,rows:32,tileSize:8,tiles:Array.from({length:32},()=>Array(32).fill(api.TileType.FLOOR))};
      const oracle=new Old(fixture,map);
      for(let y=20;y<=228;y+=8)for(let x=20;x<=228;x+=8){
        const point={x,y},expected=oracle.supports(point,10,10);
        assert.equal(template.supported(x,y),expected,`Fixture support at ${x},${y}`);points++;
        if(!expected)continue;
        for(let direction=0;direction<8;direction++){
          const [dx,dy]=directions[direction],expectedEdge=oracle.displacementFraction(point,10,10,dx*8,dy*8)>=1-1e-9;
          assert.equal(Boolean(template.links(x,y)&(1<<direction)),expectedEdge,`Fixture edge at ${x},${y} direction ${direction}`);edges++;
        }
      }
    }
    return{fixtures:fixtures.length,points,edges};
  });
}finally{
  const after=hashes(),stable=JSON.stringify(before)===JSON.stringify(after);
  const report={status:cases.length===4&&cases.every(row=>row.passed)&&stable?'passed':'failed',createdAt:new Date().toISOString(),baseline,fixture:path.resolve(savedFile),fixtureSha256:createHash('sha256').update(fs.readFileSync(savedFile)).digest('hex'),sourceHashes:before,sourceHashesAfter:after,sourcesStable:stable,cases,
    limitations:['One existing failing definition and independent small fixtures; no candidate/map generation.','No full pipeline, build, browser, actual gameplay, visual, or performance acceptance.']};
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  fs.rmSync(temporary,{recursive:true,force:true});if(report.status!=='passed')process.exitCode=1;
}
