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
  const {audioManager}=await import('/src/managers/audio-manager.ts'),{bodyHasSupport}=await import('/src/systems/ai/physical-grid.ts');
  const scene=audioManager.game.scene.getScene('RiftScene'),g=scene.formFloorGrid;
  const supported=Array.from({length:g.cols*g.rows},(_,i)=>bodyHasSupport(g,{x:(i%g.cols+.5)*g.tileSize,y:(Math.floor(i/g.cols)+.5)*g.tileSize},10,10));
  window.__spatialJourney={scene,g,supported};
 });
 const state=()=>page.evaluate(()=>{const {scene:s}=window.__spatialJourney;return{pos:{...s.player.getPosition()},hp:s.combat.getHealth(),chaos:s.chaos.getValue(),elapsedMs:s.runController.getElapsedMs(),ended:s.runController.isRunEnded(),known:s.minimap.exportRuntimeState().extractionDiscovered,carried:s.search.getCarriedKindling(),prompt:s.search.getPrompt(),nodes:s.search.nodes.map(n=>({id:n.id,collected:n.collected})),canExtract:s.extraction.canExtract()};});
 const hold=async(keys,ms)=>{report.events.push({keys,ms,at:Date.now()});try{for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(ms);}finally{for(const k of keys)await page.keyboard.up(k);}};
 async function go(target){
  const plan=await page.evaluate(target=>{
   const {scene:s,g,supported}=window.__spatialJourney,start=s.player.getPosition(),begin=Math.floor(start.y/8)*g.cols+Math.floor(start.x/8),prev=new Int32Array(supported.length).fill(-2),queue=[begin];prev[begin]=-1;let end=-1;
   for(let i=0;i<queue.length;i++){const k=queue[i],x=k%g.cols,y=Math.floor(k/g.cols);if(Math.hypot((x+.5)*8-target.x,(y+.5)*8-target.y)<=30){end=k;break;}for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,j=yy*g.cols+xx;if(xx>=0&&yy>=0&&xx<g.cols&&yy<g.rows&&supported[j]&&prev[j]===-2){prev[j]=k;queue.push(j);}}}
   if(end<0)throw Error('No complete body route to interaction range');const raw=[];for(let k=end;k>=0;k=prev[k])raw.push({x:(k%g.cols+.5)*8,y:(Math.floor(k/g.cols)+.5)*8});raw.reverse();
   const points=[raw[0]];for(let i=1;i<raw.length-1;i++){const a=raw[i-1],b=raw[i],c=raw[i+1];if(b.x-a.x!==c.x-b.x||b.y-a.y!==c.y-b.y)points.push(b);}points.push(raw.at(-1));return{points,distance:(raw.length-1)*8};
  },target);
  report.events.push({route:plan,target});save();
  if(process.env.QA_FRAME_INPUT==='1'){
   report.inputMode='Animation-frame DOM keyboard events through normal Phaser input; diagnostic routing only, no player/physics/time/state writes';
   const movement=await page.evaluate(async points=>{
    const s=window.__spatialJourney.scene,held=new Set(),events=[],codes={w:87,a:65,s:83,d:68};
    const change=next=>{for(const key of [...held])if(!next.includes(key)){window.dispatchEvent(new KeyboardEvent('keyup',{key,code:`Key${key.toUpperCase()}`,keyCode:codes[key],which:codes[key],bubbles:true}));held.delete(key);events.push({key,down:false,at:performance.now()});}for(const key of next)if(!held.has(key)){window.dispatchEvent(new KeyboardEvent('keydown',{key,code:`Key${key.toUpperCase()}`,keyCode:codes[key],which:codes[key],bubbles:true}));held.add(key);events.push({key,down:true,at:performance.now()});}};
    const start=performance.now();let index=0,previous={...s.player.getPosition()},stationarySince=start;
    try{while(index<points.length){await new Promise(resolve=>requestAnimationFrame(resolve));const p=s.player.getPosition();if(s.runController.isRunEnded())throw Error('Run ended during ordinary keyboard navigation');if(performance.now()-start>180000)throw Error('180s frame-input leg budget exhausted');
     if(Math.hypot(p.x-previous.x,p.y-previous.y)>.3){stationarySince=performance.now();previous={...p};}else if(held.size&&performance.now()-stationarySince>5000)throw Error('Physical route blocked for5s');
     const target=points[index],dx=target.x-p.x,dy=target.y-p.y;if(Math.hypot(dx,dy)<=4.5){index++;change([]);continue;}const keys=[];if(Math.abs(dx)>3)keys.push(dx>0?'d':'a');if(Math.abs(dy)>3)keys.push(dy>0?'s':'w');change(keys);
    }}finally{change([]);}return{events,elapsedWallMs:performance.now()-start,position:{...s.player.getPosition()}};
   },plan.points);
   report.events.push({frameNavigation:movement});save();const s=await state();assert(Math.hypot(s.pos.x-target.x,s.pos.y-target.y)<=44);return s;
  }
  let last=null,stuck=0;const start=Date.now();let lastFrame=start;
  report.walkFrames??=[];
  for(const p of plan.points)for(let tick=0;tick<150;tick++){
   const s=await state();assert(!s.ended,'run ended during real input');assert(Date.now()-start<90000,'90s diagnostic leg exhausted');
   if(Date.now()-lastFrame>=15000){const file=`walk-${report.walkFrames.length+1}.png`;await page.screenshot({path:path.join(out,file)});report.walkFrames.push({file,state:s});lastFrame=Date.now();}
   const dx=p.x-s.pos.x,dy=p.y-s.pos.y;if(Math.hypot(dx,dy)<3.5)break;
   stuck=last&&Math.hypot(s.pos.x-last.x,s.pos.y-last.y)<.3?stuck+1:0;last=s.pos;assert(stuck<10,`body blocked on route at ${JSON.stringify(s.pos)} toward ${JSON.stringify(p)}`);
   const keys=[];if(Math.abs(dx)>2)keys.push(dx>0?'d':'a');if(Math.abs(dy)>2)keys.push(dy>0?'s':'w');
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
