/** Bounded integration journey: full static geometry aids routing, actual keys
 * drive normal RiftScene. No health, time, loot, visibility or position edits. */
import assert from 'node:assert/strict';
const expectedRevision = Number(process.env.QA_ALGORITHM_REVISION ?? 7);
assert(Number.isSafeInteger(expectedRevision) && expectedRevision > 0, 'QA_ALGORITHM_REVISION must be a positive integer');
import fs from 'node:fs';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const world=process.env.QA_WORLD??'ash-strata',grade=process.env.QA_GRADE??'low',seed=Number(process.env.QA_SEED??20261010);
const out=path.resolve(process.env.QA_OUTPUT_DIR??`docs/qa/artifacts/r100-spatial-rollout-2026-10-10/journey-${world}-${grade}`);fs.mkdirSync(out,{recursive:true});
const report={status:'running',world,grade,seed,scope:'Controlled world/seed in isolated memory gym. Full static body-support graph and one safe node are read for diagnostic routing. Real keys, normal enemies, fog, clock, health and rewards. Proves integration of movement/search/discovery/extraction, not novice discovery difficulty, deep search or natural economy.',events:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
assert(!fs.existsSync(path.join(out,'report.json')),'Refusing to replace existing evidence');
const base=process.env.GAME_URL??'http://127.0.0.1:3027';
const snapshot=await fetch(`${base}/source-snapshot.json`).then(r=>r.ok?r.json():null).catch(()=>null);
if(process.env.QA_REQUIRE_SNAPSHOT==='1')assert(snapshot?.files,'Immutable source snapshot required');
if(snapshot)fs.writeFileSync(path.join(out,'source-snapshot.json'),JSON.stringify(snapshot,null,2)+'\n');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(`${process.env.GAME_URL??'http://127.0.0.1:3027'}/r100-gym.html?world=${world}&grade=${grade}&seed=${seed}`);
 await page.waitForFunction(()=>window.__r100Gym?.getState().runtime.running||!document.getElementById('error')?.hidden,null,{timeout:120000});
 const admission=await page.evaluate(()=>window.__r100Gym?.getState());assert(admission?.runtime.running,await page.locator('#error').textContent());report.recipe=admission.recipe;report.metadata=admission.metadata;
 await page.evaluate(async()=>{
  const {audioManager}=await import('/src/managers/audio-manager.ts'),{bodyHasSupport,bodyDisplacementFraction}=await import('/src/systems/ai/physical-grid.ts');
  const scene=audioManager.game.scene.getScene('RiftScene'),g=scene.formFloorGrid,physical=scene.nativeBody;
  if(g.tileSize!==8||!physical)throw Error('Journey requires the actual 8px/native body queries');
  const supported=Array.from({length:g.cols*g.rows},(_,i)=>bodyHasSupport(g,{x:(i%g.cols+.5)*g.tileSize,y:(Math.floor(i/g.cols)+.5)*g.tileSize},10,10));
  window.__spatialJourney={scene,g,supported,physical,bodyHasSupport,bodyDisplacementFraction};
 });
 const state=()=>page.evaluate(()=>{const {scene:s}=window.__spatialJourney;return{pos:{...s.player.getPosition()},hp:s.combat.getHealth(),chaos:s.chaos.getValue(),elapsedMs:s.runController.getElapsedMs(),ended:s.runController.isRunEnded(),known:s.minimap.exportRuntimeState().extractionDiscovered,carried:s.search.getCarriedKindling(),prompt:s.search.getPrompt(),nodes:s.search.nodes.map(n=>({id:n.id,collected:n.collected})),canExtract:s.extraction.canExtract()};});
 const hold=async(keys,ms)=>{report.events.push({keys,ms,at:Date.now()});try{for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(ms);}finally{for(const k of keys)await page.keyboard.up(k);}};
 async function go(target){
  const plan=await page.evaluate(target=>{
   const {scene:s,g,supported,physical,bodyHasSupport,bodyDisplacementFraction}=window.__spatialJourney,start={...s.player.getPosition()};
   const center=k=>({x:(k%g.cols+.5)*8,y:(Math.floor(k/g.cols)+.5)*8});
   const begin=Math.floor(start.y/8)*g.cols+Math.floor(start.x/8);
   if(!physical.supports(start,10,10))throw Error('Actual player lacks native 20px support');
   const nativeSweep=(a,b)=>physical.displacementFraction(a,10,10,b.x-a.x,b.y-a.y);
   const gridSweep=(a,b)=>bodyDisplacementFraction(g,a,10,10,b.x-a.x,b.y-a.y);
   // Connect the actual position by a native sweep, rather than rounding to a
   // grid center or assuming a point-supported neighbor is body-reachable.
   let seeds=[];
   if(supported[begin]&&physical.supports(center(begin),10,10)&&nativeSweep(start,center(begin))===1)seeds=[begin];
   else{
    const col=Math.floor(start.x/8),row=Math.floor(start.y/8);
    for(let y=row-4;y<=row+4;y++)for(let x=col-4;x<=col+4;x++){
     if(x<0||y<0||x>=g.cols||y>=g.rows)continue;
     const cell=y*g.cols+x,q=center(cell);
     if(supported[cell]&&Math.hypot(q.x-start.x,q.y-start.y)<=32&&physical.supports(q,10,10)&&nativeSweep(start,q)===1)seeds.push(cell);
    }
    seeds.sort((a,b)=>Math.hypot(center(a).x-start.x,center(a).y-start.y)-Math.hypot(center(b).x-start.x,center(b).y-start.y));
   }
   if(!seeds.length)throw Error(`No native swept connection from actual position ${JSON.stringify(start)}`);
   const prev=new Int32Array(supported.length).fill(-2),queue=[...seeds];for(const cell of queue)prev[cell]=-1;let end=-1,edgeChecks=0;
   for(let i=0;i<queue.length;i++){
    const k=queue[i],x=k%g.cols,y=Math.floor(k/g.cols),a=center(k);
    if(Math.hypot(a.x-target.x,a.y-target.y)<=30){end=k;break;}
    for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
     const xx=x+dx,yy=y+dy,j=yy*g.cols+xx;
     if(xx<0||yy<0||xx>=g.cols||yy>=g.rows||!supported[j]||prev[j]!==-2)continue;
     const b=center(j);edgeChecks++;
     if(gridSweep(a,b)!==1||!physical.supports(b,10,10)||nativeSweep(a,b)!==1)continue;
     prev[j]=k;queue.push(j);
    }
   }
   if(end<0)throw Error('No complete swept 20px body route to interaction range');
   const raw=[];for(let k=end;k>=0;k=prev[k])raw.push(center(k));raw.reverse();
   const points=[raw[0]];
   for(let i=1;i<raw.length-1;i++){const a=raw[i-1],b=raw[i],c=raw[i+1];if(b.x-a.x!==c.x-b.x||b.y-a.y!==c.y-b.y)points.push(b);}
   if(raw.length>1)points.push(raw.at(-1));
   const segments=[];
   for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],gridFraction=gridSweep(a,b),nativeFraction=nativeSweep(a,b);
    if(gridFraction!==1||nativeFraction!==1)throw Error(`Compressed route lost full body sweep at segment ${i}`);
    segments.push({from:a,to:b,gridFraction,nativeFraction});
   }
   const entry={actual:start,snappedCenter:center(begin),selectedCenter:raw[0],actualGridSupported:bodyHasSupport(g,start,10,10),actualNativeSupported:true,seedCount:seeds.length,nativeSweep:nativeSweep(start,raw[0])};
   return{points,distance:Math.hypot(raw[0].x-start.x,raw[0].y-start.y)+(raw.length-1)*8,entry,edgeChecks,segments};
  },target);
  report.events.push({route:plan,target});save();
  if(process.env.QA_FRAME_INPUT==='1'){
   report.inputMode='Animation-frame DOM keyboard events through normal Phaser input; diagnostic routing only, no player/physics/time/state writes';
   const movement=await page.evaluate(async points=>{
    const {scene:s,g,physical,bodyHasSupport,bodyDisplacementFraction}=window.__spatialJourney,held=new Set(),events=[],codes={w:87,a:65,s:83,d:68};
    const arrivalTolerance=1.5,axisDeadzone=.65;
    const change=next=>{for(const key of [...held])if(!next.includes(key)){window.dispatchEvent(new KeyboardEvent('keyup',{key,code:`Key${key.toUpperCase()}`,keyCode:codes[key],which:codes[key],bubbles:true}));held.delete(key);events.push({key,down:false,at:performance.now()});}for(const key of next)if(!held.has(key)){window.dispatchEvent(new KeyboardEvent('keydown',{key,code:`Key${key.toUpperCase()}`,keyCode:codes[key],which:codes[key],bubbles:true}));held.add(key);events.push({key,down:true,at:performance.now()});}};
    const start=performance.now();let index=0,previous={...s.player.getPosition()},stationarySince=start,failure=null;
    const diagnostic=message=>{
     const actual={...s.player.getPosition()},waypoint=points[index]??null;
     return{message,actual,waypoint,index,held:[...held],arrivalTolerance,axisDeadzone,
      actualGridSupported:bodyHasSupport(g,actual,10,10),actualNativeSupported:physical.supports(actual,10,10),
      waypointGridSupported:waypoint?bodyHasSupport(g,waypoint,10,10):null,waypointNativeSupported:waypoint?physical.supports(waypoint,10,10):null,
      gridSweep:waypoint?bodyDisplacementFraction(g,actual,10,10,waypoint.x-actual.x,waypoint.y-actual.y):null,
      nativeSweep:waypoint?physical.displacementFraction(actual,10,10,waypoint.x-actual.x,waypoint.y-actual.y):null};
    };
    try{while(index<points.length){
     await new Promise(resolve=>requestAnimationFrame(resolve));const p=s.player.getPosition();
     if(s.runController.isRunEnded())throw Error('Run ended during ordinary keyboard navigation');
     if(performance.now()-start>180000)throw Error('180s frame-input leg budget exhausted');
     if(Math.hypot(p.x-previous.x,p.y-previous.y)>.3){stationarySince=performance.now();previous={...p};}
     else if(held.size&&performance.now()-stationarySince>5000)throw Error('Physical route blocked for5s');
     const target=points[index],dx=target.x-p.x,dy=target.y-p.y;
     // The former 4.5px tolerance cut 8px staircase corners early. Shell's
     // exact center edges were valid; its off-center early turn was blocked.
     if(Math.hypot(dx,dy)<=arrivalTolerance){index++;change([]);continue;}
     const keys=[];if(Math.abs(dx)>axisDeadzone)keys.push(dx>0?'d':'a');if(Math.abs(dy)>axisDeadzone)keys.push(dy>0?'s':'w');change(keys);
    }}catch(error){failure=diagnostic(String(error.stack??error));}
    finally{change([]);}
    return{status:failure?'failed':'passed',failure,events,arrivalTolerance,axisDeadzone,elapsedWallMs:performance.now()-start,position:{...s.player.getPosition()}};
   },plan.points);
   report.events.push({frameNavigation:movement});save();assert.equal(movement.status,'passed',JSON.stringify(movement.failure));const s=await state();assert(Math.hypot(s.pos.x-target.x,s.pos.y-target.y)<=44);return s;
  }
  let last=null,stuck=0;const start=Date.now();let lastFrame=start;
  report.walkFrames??=[];
  for(const p of plan.points)for(let tick=0;tick<150;tick++){
   const s=await state();assert(!s.ended,'run ended during real input');assert(Date.now()-start<90000,'90s diagnostic leg exhausted');
   if(Date.now()-lastFrame>=15000){const file=`walk-${report.walkFrames.length+1}.png`;await page.screenshot({path:path.join(out,file)});report.walkFrames.push({file,state:s});lastFrame=Date.now();}
   const dx=p.x-s.pos.x,dy=p.y-s.pos.y;if(Math.hypot(dx,dy)<=1.5)break;
   stuck=last&&Math.hypot(s.pos.x-last.x,s.pos.y-last.y)<.3?stuck+1:0;last=s.pos;assert(stuck<10,`body blocked on route at ${JSON.stringify(s.pos)} toward ${JSON.stringify(p)}`);
   const keys=[];if(Math.abs(dx)>.65)keys.push(dx>0?'d':'a');if(Math.abs(dy)>.65)keys.push(dy>0?'s':'w');
   await hold(keys,Math.max(25,Math.min(220,Math.hypot(dx,dy)/80*1000)));
  }
  const s=await state();assert(Math.hypot(s.pos.x-target.x,s.pos.y-target.y)<=44);return s;
 }
 await page.locator('#game-container').focus();report.entry=await state();assert.equal(report.entry.known,false);
 const nearX=Number(process.env.QA_NEAR_X),nearY=Number(process.env.QA_NEAR_Y);
 if(Number.isFinite(nearX)&&Number.isFinite(nearY)){
  const near=await page.evaluate(({x,y})=>{const {scene:s,g,supported}=window.__spatialJourney,begin=Math.floor(s.player.getPosition().y/8)*g.cols+Math.floor(s.player.getPosition().x/8),seen=new Set([begin]),queue=[begin];let chosen=null,best=Infinity;
   for(let i=0;i<queue.length;i++){const cell=queue[i],col=cell%g.cols,row=Math.floor(cell/g.cols),p={x:(col+.5)*8,y:(row+.5)*8},d=Math.hypot(p.x-x,p.y-y);if(d<best){best=d;chosen=p;}for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const xx=col+dx,yy=row+dy,next=yy*g.cols+xx;if(xx>=0&&yy>=0&&xx<g.cols&&yy<g.rows&&supported[next]&&!seen.has(next)){seen.add(next);queue.push(next);}}}
   if(best>96)throw Error('No reachable diagnostic near-view seat within96px');return chosen;
  },{x:nearX,y:nearY});
  report.scope='Normal shoulder-light near-view reached with actual WASD; diagnostic static full-body routing, no relocation or visibility/health/time edits. Not a complete expedition.';
  report.nearTarget={requested:{x:nearX,y:nearY},seat:near};report.atNear=await go(near);
  if(process.env.QA_FACE){assert(['w','a','s','d'].includes(process.env.QA_FACE));await hold([process.env.QA_FACE],75);}
  await page.waitForTimeout(350);report.nearState=await state();assert(!report.nearState.ended);await page.screenshot({path:path.join(out,'near.png')});assert.deepEqual(report.errors,[]);report.status='passed';
 }else{
 const target=await page.evaluate(()=>{const layout=window.__r100Gym.getLayout();return{node:layout.kindlingNodes.find(n=>n.tier==='safe'),exit:layout.extractionPoint.position,revision:window.__r100Gym.getState().recipe.package.algorithmRevision};});assert.equal(target.revision,expectedRevision);
 report.afterApproach=await go(target.node.position);
 // Face the visible remains using ordinary movement before the real search key.
 const dx=target.node.position.x-report.afterApproach.pos.x,dy=target.node.position.y-report.afterApproach.pos.y;
 await hold([Math.abs(dx)>Math.abs(dy)?dx>0?'d':'a':dy>0?'s':'w'],80);await hold(['e'],1650);
 report.afterSearch=await state();assert(report.afterSearch.nodes.find(n=>n.id===target.node.id)?.collected,'safe node not collected by real E input');assert(report.afterSearch.carried>0);
 await page.screenshot({path:path.join(out,'searched.png')});
 report.atExit=await go(target.exit);assert(report.atExit.canExtract);assert(report.atExit.known,'exit must become discovered through normal movement');
 await page.screenshot({path:path.join(out,'discovered.png')});await page.keyboard.press('e',{delay:100});await page.waitForTimeout(850);
 report.terminal=await state();assert(report.terminal.ended,'normal extraction did not end run');assert(report.terminal.hp>0);assert.deepEqual(report.errors,[]);
 await page.screenshot({path:path.join(out,'extracted.png')});report.status='passed';
 }
}catch(error){report.status='failed';report.failure=String(error.stack??error);process.exitCode=1;}
finally{save();await browser.close();}
console.log(`${report.status}: ${world}/${grade} ${report.failure??''}`);
