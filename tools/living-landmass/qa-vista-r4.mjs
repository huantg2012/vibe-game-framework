/** DEC-164 browser QA. Normal input/time; game probe is read-only. */
import {mkdir,readFile,writeFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const dir=path.resolve(process.env.ARTIFACT_DIR??`docs/qa/artifacts/iteration-23/vista-r4/${new Date().toISOString().replace(/[:.]/g,'-')}`);
const url=process.env.GAME_URL??'http://127.0.0.1:3011/living-landmass-stage.html';
const evidence={schema:1,spec:'docs/tasks/iteration-23.md DEC-164 R4-01..11',startedAt:new Date().toISOString(),url,
 method:'Isolated headed Chrome, real keyboard/mouse, normal clock, read-only product probe. QA-owned rAF observer and passive recording branch preserve actual destination playback, gain and timing. No game-state writes, teleport, synthetic game events or time overrides.',
 checks:[],unverified:[],observations:[],samples:[],inputs:[],resources:[],errors:[],consoleErrors:[],warnings:[],failedRequests:[],audioLifecycle:[],recordings:[],visualVerdict:'HUMAN REVIEW PENDING'};
await mkdir(dir,{recursive:true});
const list=(...args)=>execFileSync('rg',['--files',...args],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const files=[...list('src/dev/living-landmass-stage'),...list('data').filter(p=>p.includes('living-landmass-vista')),
 ...list('public/assets/dev/living-landmass').filter(p=>/\.(png|webp|ogg|mp3|wav)$/.test(p)),
 'living-landmass-stage.html','src/dev/living-landmass-stage.ts','src/dev/spatial-study/stage/actors.ts',
 'src/dev/spatial-study/stage/actor-pixels.ts','src/entities/player.ts','src/systems/ai/physical-grid.ts','src/systems/tile-grid.ts','src/config/game-config.ts','tools/living-landmass/qa-vista-r4.mjs'];
const hashes=()=>Promise.all([...new Set(files)].sort().map(async file=>({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')})));
evidence.sourceBefore=await hashes();
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:process.env.HEADLESS==='1',executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
evidence.browser={version:browser.version(),headless:process.env.HEADLESS==='1'};
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir,size:{width:1440,height:1000}}});
const check=(name,ok,details)=>{evidence.checks.push({name,ok:Boolean(ok),details});if(!ok)console.error('CHECK FAILED',name,JSON.stringify(details));return Boolean(ok);};
let writeQueue=Promise.resolve();
async function prepare(page,label,owner=context){
 const cdp=await owner.newCDPSession(page);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});
 await cdp.send('WebAudio.enable').catch(error=>evidence.unverified.push(`CDP WebAudio lifecycle unavailable: ${error.message}`));
 for(const event of ['contextCreated','contextChanged','contextWillBeDestroyed'])cdp.on(`WebAudio.${event}`,data=>evidence.audioLifecycle.push({label,event,at:Date.now(),data}));
 page.on('pageerror',e=>evidence.errors.push({label,message:e.message}));page.on('console',m=>{if(m.type()==='error')evidence.consoleErrors.push({label,message:m.text()});else if(m.type()==='warning')evidence.warnings.push({label,message:m.text()});});
 page.on('response',r=>{if(r.status()>=400)evidence.failedRequests.push({url:r.url(),status:r.status()});if(r.url().includes('/assets/dev/living-landmass/'))evidence.resources.push({url:r.url(),status:r.status()});});
 await page.exposeBinding('__qaR4AudioData',(_source,{id,bytes,metadata})=>{const file=`${label}-audio-${id}.webm`;if(!evidence.recordings.some(r=>r.file===file))evidence.recordings.push({file,metadata});writeQueue=writeQueue.then(()=>appendFile(path.join(dir,file),Buffer.from(bytes,'base64')));return writeQueue;});
 await page.addInitScript(()=>{
  const recorders=[],contexts=new WeakMap();const originalConnect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(...args){const result=originalConnect.apply(this,args);if(args[0]===this.context.destination){
   let tap=contexts.get(this.context);if(!tap){const destination=this.context.createMediaStreamDestination();const recorder=new MediaRecorder(destination.stream,{mimeType:'audio/webm;codecs=opus'});let queue=Promise.resolve();const id=recorders.length+1;const context=this.context;
    recorder.ondataavailable=event=>{queue=queue.then(async()=>{if(!event.data.size)return;const data=new Uint8Array(await event.data.arrayBuffer());let bytes='';for(let i=0;i<data.length;i++)bytes+=String.fromCharCode(data[i]);await window.__qaR4AudioData({id,bytes:btoa(bytes),metadata:{mimeType:recorder.mimeType,sampleRate:context.sampleRate}});});};
    tap={destination,recorder,context,id,flush:()=>new Promise(resolve=>{if(recorder.state==='inactive')return queue.then(resolve);recorder.addEventListener('stop',()=>queue.then(resolve),{once:true});recorder.stop();})};contexts.set(context,tap);recorders.push(tap);recorder.start(1000);
   }originalConnect.call(this,tap.destination);
  }return result;};
  Object.defineProperty(window,'__qaR4Audio',{value:{stop:()=>Promise.all(recorders.map(r=>r.flush())),snapshot:()=>recorders.map(r=>({id:r.id,state:r.recorder.state,contextState:r.context.state,contextTime:r.context.currentTime}))}});
  const intervals=[];let previous=null;function frame(t){if(previous!==null&&!document.hidden)intervals.push(t-previous);previous=document.hidden?null:t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
  Object.defineProperty(window,'__qaR4Frames',{value:intervals});
 });return cdp;
}
const page=await context.newPage();const cdp=await prepare(page,'main');
const read=()=>page.evaluate(()=>({...window.__livingLandmassStage.getState(),qaAudioObservation:window.__qaR4Audio.snapshot()}));
const distance=(a,b)=>Math.hypot(a.player.x-b.player.x,a.player.y-b.player.y);
function support(s,label){if(!check(`${label}: ready`,s.ready,s))throw Error('Scene not ready');check(`${label}: complete body supported`,s.player.supported,s.player);
 check(`${label}: both soles on actual terrain`,s.player.feet.length===2&&s.player.feet.every(f=>Number.isFinite(f.clearance)&&f.clearance>=1.49&&f.clearance<5),s.player.feet);
 check(`${label}: player projection inside frame`,s.player.screen.x>14&&s.player.screen.x<946&&s.player.screen.y>28&&s.player.screen.y<628,s.player.screen);
 const ray=Math.atan2(s.camera.position[1]-s.player.height,s.camera.position[2]-s.player.y)*180/Math.PI;
 check(`${label}: actor follows camera ray`,Math.abs(ray-s.actorProjection.elevation)<.001,{ray,actual:s.actorProjection.elevation});
 if(s.audio?.state==='running'){const diff=Math.abs(s.audio.cycle.time-s.scenery.motion.time);check(`${label}: actual audio-driven scenery phase`,Math.min(diff,26-diff)<.08,{audio:s.audio.cycle.time,visual:s.scenery.motion.time,context:s.audio.audioContextTime});check(`${label}: clean audio`,!s.audio.errors.length,s.audio.errors);}
 check(`${label}: clean scene`,!s.errors.length&&!s.pageErrors.length,{errors:s.errors,pageErrors:s.pageErrors});
}
async function sample(label){const s=await read();support(s,label);evidence.samples.push({label,at:Date.now(),state:s});return s;}
async function capture(label){const s=await sample(label);evidence.observations.push({label,at:new Date().toISOString(),state:s});await page.locator('canvas[data-living-stage]').screenshot({path:path.join(dir,`${label}.png`)});console.log(label,JSON.stringify({x:s.player.x,y:s.player.y,height:s.player.height,screen:s.player.screen}));return s;}
async function hold(keys,ms,label,captureAfter=false){const before=await read();evidence.inputs.push({label,keys,ms,at:Date.now(),before:before.player});for(const key of keys)await page.keyboard.down(key);let middle;try{await page.waitForTimeout(ms/2);middle=await sample(`${label}-moving`);await page.waitForTimeout(ms/2);}finally{for(const key of [...keys].reverse())await page.keyboard.up(key);}await page.waitForTimeout(90);const after=captureAfter?await capture(label):await sample(label);Object.assign(evidence.inputs.at(-1),{after:after.player});return{before,middle,after,distance:distance(before,after)};}
async function navigate(node,label){
 const began=await read(),start=Date.now(),origin={x:began.player.x,y:began.player.y},vx=node.x-origin.x,vy=node.y-origin.y,length=Math.hypot(vx,vy);
 let keys=[],stalled=0,last=began;try{while(Date.now()-start<35000){const state=await read();const remaining=Math.hypot(node.x-state.player.x,node.y-state.player.y);if(remaining<9)break;
  const along=length?Math.max(0,Math.min(length,((state.player.x-origin.x)*vx+(state.player.y-origin.y)*vy)/length)):0;
  const look=Math.min(length,along+18),aim={x:origin.x+vx*look/(length||1),y:origin.y+vy*look/(length||1)};
  const dx=aim.x-state.player.x,dy=aim.y-state.player.y,next=[];if(Math.abs(dx)>4)next.push(dx>0?'d':'a');if(Math.abs(dy)>4)next.push(dy>0?'s':'w');
  if(!next.length){if(Math.abs(node.x-state.player.x)>Math.abs(node.y-state.player.y))next.push(node.x>state.player.x?'d':'a');else next.push(node.y>state.player.y?'s':'w');}
  for(const key of keys)if(!next.includes(key))await page.keyboard.up(key);for(const key of next)if(!keys.includes(key))await page.keyboard.down(key);keys=next;
  const ms=Math.max(60,Math.min(160,remaining/80*700));evidence.inputs.push({label,keys:[...keys],ms,at:Date.now(),before:state.player});await page.waitForTimeout(ms);const after=await sample(`${label}-moving`);evidence.inputs.at(-1).after=after.player;
  if(distance(last,after)<.15)stalled++;else stalled=0;last=after;if(stalled>6)throw Error(`Route blocked at ${label}: ${JSON.stringify(after.player)}, target=${JSON.stringify(node)}`);
 }}finally{for(const key of keys)await page.keyboard.up(key);}const arrived=await capture(label);if(Math.hypot(arrived.player.x-node.x,arrived.player.y-node.y)>15)throw Error(`Node ${label} not reached`);
}
async function runBoundary(test,node){
 const contact=await hold([test.key.toLowerCase()],Math.max(Math.abs(test.dx),Math.abs(test.dy))/80*1000,`check-${test.id}-contact`,true);
 const stop=await hold([test.key.toLowerCase()],650,`check-${test.id}-stop`,true);check(`${test.id}: real blocking`,stop.distance<.1&&stop.after.blockedFrames>contact.after.blockedFrames,{distance:stop.distance,player:stop.after.player});await navigate(node,`check-${test.id}-return`);
}
function normalizeRoute(geometry){const nodes=Array.isArray(geometry.routeNodes)?geometry.routeNodes:Object.entries(geometry.routeNodes??{}).map(([id,p])=>({id,...p}));const byId=new Map(nodes.map(n=>[n.id,n]));return geometry.recommendedRoute.map(entry=>typeof entry==='string'?byId.get(entry):entry).map(n=>{if(!n||!Number.isFinite(n.x)||!Number.isFinite(n.y))throw Error('Invalid route metadata');return n;});}
try{
 const load=Date.now();await page.goto(url);await page.waitForFunction(()=>window.__livingLandmassStage?.getState().ready,null,{timeout:30000});evidence.readyMs=Date.now()-load;await page.bringToFront();
 const start=await capture('00-start-locked');check('revision4',start.revision===4,start.revision);check('working camera24',start.camera.elevation===24,start.camera);check('four distance roles',start.scenery.distanceRoles?.length===4&&start.scenery.paintedLayers===1&&start.scenery.landforms>=1,start.scenery);for(const asset of ['vista-r2.png','ground-strata-r3.png','shoulder-r4.png'])check(`asset ${asset} loaded`,evidence.resources.some(r=>r.url.endsWith('/'+asset)&&r.status===200),null);check('audio waits for real movement',start.audio?.state==='locked-until-movement',start.audio);
 check('render AA enabled',start.render.antialias===true,start.render);check('1920x1280 internal / 960x640 logical',start.render.internal?.width===1920&&start.render.internal?.height===1280&&start.render.logical?.width===960&&start.render.logical?.height===640,start.render);
 check('five regions and six links',start.geometry.regions?.length===5&&start.geometry.connectors?.length===6,{regions:start.geometry.regions,connectors:start.geometry.connectors});
 const east=await hold(['d'],350,'01-first-movement',true);check('cardinal speed80',Math.abs(Math.hypot(east.middle.player.velocity.x,east.middle.player.velocity.y)-80)<.01,east.middle.player.velocity);check('movement unlocks real AudioContext',east.after.audio?.state==='running',east.after.audio);
 const diagonal=await hold(['d','s'],280,'02-diagonal',true);check('diagonal normalized80',Math.abs(Math.hypot(diagonal.middle.player.velocity.x,diagonal.middle.player.velocity.y)-80)<.01,diagonal.middle.player.velocity);
 await navigate({x:start.player.x,y:start.player.y},'03-return-spawn');
 const route=normalizeRoute(start.geometry);evidence.route=route;const tests=start.geometry.qaChecks??[],done=new Set();const nodeMap=new Map(start.geometry.routeNodes.map(n=>[n.id,n]));const routeStarted=Date.now();
 for(let i=0;i<route.length;i++){
  const node=route[i];await navigate(node,`route-${String(i).padStart(2,'0')}-${node.id??'node'}`);
  for(const test of tests.filter(t=>t.node===node.id&&!done.has(t.id))){await runBoundary(test,node);done.add(test.id);}
  if(node.id==='spawn'&&i===0){for(const test of tests.filter(t=>t.node==='arrival-look')){const near=nodeMap.get(test.node);await navigate(near,`check-${test.id}-approach`);await runBoundary(test,near);await navigate(node,`check-${test.id}-back-spawn`);done.add(test.id);}}
  if(Date.now()-routeStarted>230000)throw Error('Route exceeded 230 real seconds; stopping instead of accelerating');
 }
 check('all authored boundary/obstacle probes executed',done.size===tests.length,[...done]);
 const returned=await capture('04-route-complete');check('full route returns to spawn',distance(start,returned)<25,{distance:distance(start,returned)});
 for(const connector of start.geometry.connectors){const ids=route.map(n=>n.id),sequence=connector.nodes.join('|'),reverse=[...connector.nodes].reverse().join('|');check(`connector ${connector.id}: route traversed`,ids.join('|').includes(sequence)||ids.join('|').includes(reverse),connector.nodes);}
 const observedStages=[...new Set(evidence.samples.map(s=>s.state.scenery.motion.stage))];check('normal route covers complete load cycle',['rest','loading','bearing','release'].every(stage=>observedStages.includes(stage)),observedStages);const pans=evidence.samples.map(s=>s.state.audio.pan),gains=evidence.samples.map(s=>s.state.audio.gain);check('travel changes source direction and distance gain',Math.min(...pans)<-.2&&Math.max(...pans)>0&&Math.max(...gains)-Math.min(...gains)>.1,{pan:[Math.min(...pans),Math.max(...pans)],gain:[Math.min(...gains),Math.max(...gains)]});
 const stationary=await read();await page.waitForTimeout(550);const idle=await read();check('release has no drift',distance(stationary,idle)<.01,distance(stationary,idle));
 const phaseA=await capture('05-rest-phase-a');await page.waitForTimeout(3500);const phaseB=await capture('06-rest-phase-b');check('nonwalking motion never moves resting player',distance(phaseA,phaseB)<.01&&Math.abs(phaseA.player.height-phaseB.player.height)<.001,{a:phaseA.player,b:phaseB.player});
 await page.keyboard.press('m');await page.waitForTimeout(450);const muted=await capture('07-muted');check('M actually mutes',muted.audio?.muted===true,muted.audio);await page.keyboard.press('m');await page.waitForTimeout(450);const unmuted=await capture('08-unmuted');check('M restores sound without restart',unmuted.audio?.muted===false&&unmuted.audio?.sourceStarts===muted.audio?.sourceStarts,unmuted.audio);
 // Actual browser window minimization after disabling forced focus before load.
 const {windowId}=await cdp.send('Browser.getWindowForTarget');await page.keyboard.down('d');await page.waitForTimeout(160);await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'minimized'}});await page.waitForTimeout(400);const focus=await page.evaluate(()=>({focused:document.hasFocus(),hidden:document.hidden}));evidence.focusFact=focus;
 if(!focus.focused||focus.hidden){const a=await read();await page.waitForTimeout(700);const b=await read();check('real blur pauses movement and audio',b.inputPaused&&b.audio?.paused&&distance(a,b)<.01,{a,b});}else evidence.unverified.push('Window action did not establish actual focus loss; no real blur claim.');
 await page.keyboard.up('d');await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});await page.bringToFront();await page.locator('#game-container').click({position:{x:12,y:12}});await page.waitForTimeout(300);const back=await read();await page.waitForTimeout(400);const back2=await read();check('return no latched movement',distance(back,back2)<.01,distance(back,back2));
 evidence.frameIntervals=await page.evaluate(()=>window.__qaR4Frames.slice());const ordered=evidence.frameIntervals.filter(v=>v>0).sort((a,b)=>a-b);const percentile=q=>ordered[Math.min(ordered.length-1,Math.floor(ordered.length*q))];evidence.frameSummary={samples:ordered.length,medianMs:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),maxMs:ordered.at(-1),over33:ordered.filter(v=>v>33.34).length,over50:ordered.filter(v=>v>50).length,over100:ordered.filter(v=>v>100).length,method:'Browser rAF intervals under active recording; includes screenshot overhead, no synthetic clock and not isolated GPU timing.'};
 const storage=await context.storageState();const webStorage=await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage)}));check('no game save writes',!storage.cookies.length&&!storage.origins.length&&!webStorage.local.length&&!webStorage.session.length,{storage,webStorage});
 await page.evaluate(()=>window.__qaR4Audio.stop());await writeQueue;evidence.audioContextsBeforeReload=await page.evaluate(()=>window.__qaR4Audio.snapshot());
 await page.reload();await page.waitForFunction(()=>window.__livingLandmassStage?.getState().ready,null,{timeout:30000});const refreshed=await capture('09-refresh');check('refresh spawn and audio lock reset',distance(start,refreshed)<.01&&refreshed.audio?.state==='locked-until-movement',refreshed.audio);check('unique visible Three canvas',await page.locator('canvas[data-living-stage]').count()===1,null);
 await page.goto('about:blank');await page.waitForTimeout(350);evidence.destroyedAudioContexts=evidence.audioLifecycle.filter(e=>e.event==='contextWillBeDestroyed');check('actual navigation destroys started audio context',evidence.destroyedAudioContexts.length>0,evidence.audioLifecycle);
 const reducedContext=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',recordVideo:{dir,size:{width:1440,height:1000}}});const reduced=await reducedContext.newPage();await prepare(reduced,'reduced',reducedContext);await reduced.goto(url);await reduced.waitForFunction(()=>window.__livingLandmassStage?.getState().ready,null,{timeout:30000});await reduced.bringToFront();
 await reduced.keyboard.down('s');await reduced.waitForTimeout(180);await reduced.keyboard.up('s');await reduced.waitForTimeout(120);const reducedA=await reduced.evaluate(()=>window.__livingLandmassStage.getState());await reduced.waitForTimeout(2200);const reducedB=await reduced.evaluate(()=>window.__livingLandmassStage.getState());evidence.reducedMotion={before:reducedA,after:reducedB};check('reduced-motion really requested',await reduced.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),null);check('reduced-motion freezes scenic transforms',reducedB.scenery.reducedMotion===true&&JSON.stringify(reducedA.scenery.transforms)===JSON.stringify(reducedB.scenery.transforms),{a:reducedA.scenery,b:reducedB.scenery});check('reduced-motion uses static audio bed',reducedB.audio.state==='running'&&reducedB.audio.reducedMotion===true&&reducedB.audio.cycle.time===0,reducedB.audio);await reduced.evaluate(()=>window.__qaR4Audio.stop());await writeQueue;await reduced.locator('canvas[data-living-stage]').screenshot({path:path.join(dir,'10-reduced-motion.png')});await reducedContext.close();
 check('no browser errors',!evidence.errors.length&&!evidence.consoleErrors.length&&!evidence.failedRequests.length,{errors:evidence.errors,consoleErrors:evidence.consoleErrors,requests:evidence.failedRequests});
 evidence.sourceAfter=await hashes();check('source frozen through run',JSON.stringify(evidence.sourceBefore)===JSON.stringify(evidence.sourceAfter),null);evidence.verdict=evidence.checks.every(c=>c.ok)?'COVERED CHECKS PASS / HUMAN REVIEW PENDING':'CHECK FAILURES';if(evidence.checks.some(c=>!c.ok))process.exitCode=1;
}catch(error){evidence.verdict='INCOMPLETE';evidence.failure=error.stack??String(error);console.error(error);process.exitCode=1;}finally{evidence.endedAt=new Date().toISOString();await page.evaluate(()=>window.__qaR4Audio?.stop()).catch(()=>{});await writeQueue;await context.close();await browser.close();evidence.video=await page.video()?.path();await writeFile(path.join(dir,'evidence.json'),JSON.stringify(evidence,null,2));console.log('Artifacts:',dir);}
