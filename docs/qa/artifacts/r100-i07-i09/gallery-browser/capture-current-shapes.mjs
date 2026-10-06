import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const plan={seed:20261005,worlds:['tendon-shelves','sentinel-mass'],grades:['low','medium','severe'],viewport:{width:1440,height:1000},method:'One actual-keyboard approach per case from Gym spawn. Normal camera/FOV, no tool inputs or player/health/time/lighting edits; diagnostic static body route is read. One final target PNG per case. Failures remain and halt the batch.'};
if(process.argv.includes('--plan')){console.log(JSON.stringify(plan,null,2));process.exit(0);}
assert.equal(process.env.QA_BROWSER_WINDOW,'granted','Launch only after explicit sole-browser window');
assert(process.env.GAME_URL&&process.env.QA_SOURCE_MANIFEST&&process.env.QA_OUTPUT_DIR,'Frozen URL, source manifest and fresh output path required');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifestBytes=fs.readFileSync(process.env.QA_SOURCE_MANIFEST),manifest=JSON.parse(manifestBytes);
assert.equal(new URL(process.env.GAME_URL).port,String(manifest.port),'URL must match frozen manifest');
const sourceRecord={path:process.env.QA_SOURCE_MANIFEST,sha256:hash(manifestBytes)};

const{chromium}=await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.resolve(process.env.QA_OUTPUT_DIR);assert(!fs.existsSync(path.join(out,'report.json')),'Never overwrite a prior attempt');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={plan,sourceManifest:sourceRecord,harnessSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),scope:'Normal finite FOV and camera; controlled candidate world/training loadout, actual keyboard from original spawn. Full floor geometry read for diagnostic body routing, not novice navigation; no position/HP/clock/fog edits. Enemy and pollution simulation stays active.',cases:[],errors:[]};
try{for(const world of plan.worlds)for(const grade of plan.grades){
 const dir=path.join(out,world+'-'+grade);fs.mkdirSync(dir,{recursive:true});const context=await browser.newContext({viewport:plan.viewport}),page=await context.newPage();
 const log=v=>fs.appendFileSync(path.join(dir,'journey.jsonl'),JSON.stringify({at:new Date().toISOString(),...v})+'\n');
 page.on('framenavigated',f=>log({event:'frame-navigated',url:f.url(),main:f===page.mainFrame()}));page.on('crash',()=>log({event:'page-crash'}));page.on('close',()=>log({event:'page-close'}));page.on('console',m=>{if(['error','warning'].includes(m.type()))log({event:'console',type:m.type(),text:m.text()});});page.on('requestfailed',r=>log({event:'request-failed',url:r.url(),failure:r.failure()}));
 const driver={log,async state(){return page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene');return {scene:'rift',active:s.scene.isActive(),ended:s.runController.isRunEnded(),pos:{...s.player.getPosition()},facingAngle:s.player.getFacingAngle(),facing4:s.player.getFacing4(),hp:s.combat.getHealth(),chaos:s.chaos.getValue(),elapsedMs:s.runController.getElapsedMs()};});},async hold(keys,ms){log({event:'hold',keys,ms});try{for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(ms);}finally{for(const k of keys)await page.keyboard.up(k);}await page.waitForTimeout(35);}};page.on('pageerror',e=>report.errors.push(String(e)));
 assert(process.env.GAME_URL,'Explicit frozen GAME_URL required');await page.goto(`${process.env.GAME_URL}/r100-gym.html?world=${world}&grade=${grade}&seed=${plan.seed}`);await page.waitForFunction(()=>window.__r100Gym?.getState().runtime.running,null,{timeout:60000});await page.evaluate(async()=>{const{audioManager}=await import('/src/managers/audio-manager.ts');window.__game=audioManager.game;});await page.waitForFunction(()=>{const s=window.__game?.scene.getScene('RiftScene');return s?.scene.isActive()&&!s.stagedEntry?.isActive()&&!s.nativeEntryFence?.isActive()&&s.search&&s.chaos&&!s.runController.isRunEnded();});await page.waitForTimeout(300);log({event:'entry-stable',url:page.url(),state:await driver.state()});await page.locator('#game-container').focus();
 const identity=await page.evaluate(()=>{const g=window.__r100Gym.getState();return {requestedSeed:g.recipe.requestedSeed,worldId:g.recipe.profile.id,grade:g.recipe.gradeDefinition.id,package:g.recipe.package,runtimeGrade:g.runtime.probe.pollutionGrade,viewport:{width:innerWidth,height:innerHeight},url:location.href};});
 assert.equal(new URL(identity.url).searchParams.get('seed'),String(plan.seed),'Final URL must retain requested seed');assert.equal(identity.requestedSeed,plan.seed,'Actual generated recipe must retain fixed seed');assert.equal(identity.worldId,world,'Actual generated world');assert.equal(identity.grade,grade,'Actual generated grade');assert.equal(identity.runtimeGrade,grade,'Runtime grade');assert.deepEqual(page.viewportSize(),plan.viewport,'Playwright viewport');assert.deepEqual(identity.viewport,plan.viewport,'Actual page viewport');
 const result={world,grade,seed:plan.seed,identity,steps:[]}; report.cases.push(result);log({event:'identity-verified',identity});
 async function planRoute(target){
 const data=await page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene'),g=s.formFloorGrid,b=s.player.getSprite().body;return{cols:g.cols,rows:g.rows,size:g.tileSize,walk:Array.from({length:g.cols*g.rows},(_,i)=>g.isWalkable(i%g.cols,Math.floor(i/g.cols))),start:{...s.player.getPosition()},halfX:b.width/2+1,halfY:b.height/2+1}});
 const{cols,rows,size,walk,start,halfX,halfY}=data,center=i=>({x:(i%cols+.5)*size,y:(Math.floor(i/cols)+.5)*size}),floor=(x,y)=>x>=0&&y>=0&&x<cols&&y<rows&&walk[y*cols+x];
 const clear=p=>{for(let y=Math.floor((p.y-halfY)/size);y<=Math.floor((p.y+halfY-.01)/size);y++)for(let x=Math.floor((p.x-halfX)/size);x<=Math.floor((p.x+halfX-.01)/size);x++)if(!floor(x,y))return false;return true;};
 const safe=walk.map((v,i)=>v&&clear(center(i))),begin=Math.floor(start.y/size)*cols+Math.floor(start.x/size),prev=new Map([[begin,-1]]),q=[begin];
 for(let n=0;n<q.length;n++){const i=q[n],x=i%cols,y=Math.floor(i/cols);for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=y+dy,k=b*cols+a;if(!floor(a,b)||!safe[k]||prev.has(k))continue;prev.set(k,i);q.push(k);}}
 const end=q.filter(i=>safe[i]).sort((a,b)=>Math.hypot(center(a).x-target.x,center(a).y-target.y)-Math.hypot(center(b).x-target.x,center(b).y-target.y))[0];assert(end!==undefined,'No reachable body target');const raw=[];for(let i=end;i!==-1;i=prev.get(i))raw.push(center(i));raw.reverse();const points=[raw[0]];for(let i=1;i<raw.length-1;i++)if((raw[i-1].x===raw[i].x)!==(raw[i].x===raw[i+1].x))points.push(raw[i]);points.push(raw.at(-1));return{requested:target,actual:center(end),points,length:(raw.length-1)*size};}
 const goalsByWorld={
 'sentinel-mass':[
  {label:'west-foot-approach',x:104,y:270,faces:[]},
  {label:'current-shape',x:245.7,y:270,precise:true,faces:[['d','east']]}
 ],
 'tendon-shelves':[
  {label:'second-foot-approach',x:670.1138550126403,y:526.471520654267,faces:[]},
  {label:'current-shape',x:788.0937700428253,y:547.8432227266411,precise:true,faces:[['w','north']]}
 ]};
 const goals=goalsByWorld[world]; assert(goals,'Only two declared repaired worlds');
 for(const goal of goals){const route=goal.precise?{requested:goal,actual:{x:goal.x,y:goal.y},points:[(await driver.state()).pos,{x:goal.x,y:goal.y}],length:Math.hypot(goal.x-(await driver.state()).pos.x,goal.y-(await driver.state()).pos.y),precise:true}:await planRoute(goal),started=Date.now();let last=null,stuck=0;driver.log({event:'body-route',route});
 if(goal.precise){
  const start={...(await driver.state()).pos},dx=goal.x-start.x,dy=goal.y-start.y,len=Math.hypot(dx,dy);
  const validation=await page.evaluate(({start,goal})=>{const s=window.__game.scene.getScene('RiftScene'),b=s.player.getSprite().body,q=s.nativeBody;return{halfWidth:b.halfWidth,halfHeight:b.halfHeight,start:q.supports(start,b.halfWidth,b.halfHeight),end:q.supports(goal,b.halfWidth,b.halfHeight),fraction:q.displacementFraction(start,b.halfWidth,b.halfHeight,goal.x-start.x,goal.y-start.y)};},{start,goal});
  log({event:'precise-segment-validation',start,goal,validation});assert(validation.start&&validation.end&&validation.fraction>=.99999,'Declared actual 20px segment must remain fully supported');
  for(let step=0;step<600;step++){
   const st=await driver.state();assert(!st.ended&&st.active,'Real run must remain active');assert(Date.now()-started<60000,'Precise segment budget');
   const distance=Math.hypot(goal.x-st.pos.x,goal.y-st.pos.y);if(distance<1.6)break;
   const progress=Math.max(0,Math.min(1,((st.pos.x-start.x)*dx+(st.pos.y-start.y)*dy)/(len*len||1))),t=Math.min(1,progress+4/(len||1));
   const ux=start.x+dx*t-st.pos.x,uy=start.y+dy*t-st.pos.y,angle=Math.atan2(uy,ux),oct=Math.round(angle/(Math.PI/4));
   const vx=Math.round(Math.cos(oct*Math.PI/4)),vy=Math.round(Math.sin(oct*Math.PI/4));const keys=[];if(vx)keys.push(vx>0?'d':'a');if(vy)keys.push(vy>0?'s':'w');
   stuck=last&&Math.hypot(last.x-st.pos.x,last.y-st.pos.y)<.15?stuck+1:0;last=st.pos;assert(stuck<12,'Actual fine foot movement stalled');
   await driver.hold(keys,Math.max(15,Math.min(30,distance/80*1000)));
  }
  const actual=await driver.state(),supported=await page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene'),b=s.player.getSprite().body;return s.nativeBody.supports(s.player.getPosition(),b.halfWidth,b.halfHeight);});
  assert(supported&&Math.hypot(actual.pos.x-goal.x,actual.pos.y-goal.y)<2.4,'Actual body must reach declared mouth station');log({event:'precise-segment-complete',goal,actual,supported});
 }else{
 for(const p of route.points)for(let step=0;step<90;step++){const s=await driver.state();assert(s.scene==='rift'&&!s.ended&&s.active,'Route must remain an active real run');assert(Date.now()-started<60000,'Route over budget');const dx=p.x-s.pos.x,dy=p.y-s.pos.y;if(Math.hypot(dx,dy)<3)break;stuck=last&&Math.hypot(last.x-s.pos.x,last.y-s.pos.y)<.35?stuck+1:0;last=s.pos;assert(stuck<9,`actual movement blocked near ${JSON.stringify(p)}`);const keys=[];if(Math.abs(dx)>2)keys.push(dx>0?'d':'a');if(Math.abs(dy)>2)keys.push(dy>0?'s':'w');await driver.hold(keys,Math.max(35,Math.min(160,Math.hypot(dx,dy)/80*1000)));}
 }

 for(const[key,direction]of goal.faces){const desired={w:-Math.PI/2,a:Math.PI,s:Math.PI/2,d:0}[key];let actual=await driver.state(),turnInputs=0;const angleError=a=>Math.abs(Math.atan2(Math.sin(a-desired),Math.cos(a-desired)));while(angleError(actual.facingAngle)>.12&&turnInputs<5){await driver.hold([key],80);turnInputs++;actual=await driver.state();assert(!actual.ended,'Real run ended during facing');}await page.waitForTimeout(80);actual=await driver.state();const observation={event:'facing-observation',goal:goal.label,key,requestedDirection:direction,desiredAngle:desired,actual,angleError:angleError(actual.facingAngle),matched:angleError(actual.facingAngle)<=.12,turnInputs};log(observation);result.facingObservations??=[];result.facingObservations.push(observation);assert(observation.matched,'Actual facing must match the declared view');
const png=path.join(dir,'current-shape.png');await page.locator('#game-container canvas').screenshot({path:png});const bytes=fs.readFileSync(png);result.image={path:path.relative(process.cwd(),png),sha256:hash(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),state:actual};} result.steps.push({goal,route,state:await driver.state()});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 }
 await context.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(world+' '+grade+': current-shape normal frame captured');
}assert.deepEqual(report.errors,[]);assert.equal(report.cases.filter(c=>c.image).length,6);report.status='captured';}catch(error){report.status='failed';report.failure=String(error);report.stack=error.stack;console.error(error);process.exitCode=1;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
