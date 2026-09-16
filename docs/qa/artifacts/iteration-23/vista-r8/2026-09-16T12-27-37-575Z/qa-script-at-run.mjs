/** R8 browser QA. Normal input/time; game probe is read-only. */
import {mkdir,readFile,writeFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const dir=path.resolve(process.env.ARTIFACT_DIR??`docs/qa/artifacts/iteration-23/vista-r8/${new Date().toISOString().replace(/[:.]/g,'-')}`);
const qualityOnly=process.argv.includes('--quality');
// Reviewed, source-independent expectations are frozen alongside the run; no baseline-self-certification.
const contractPath=path.resolve(process.env.QA_CONTRACT??'docs/qa/artifacts/iteration-23/vista-r8/expected-contract.json');
const contract=JSON.parse(await readFile(contractPath,'utf8'));
if(contract.status!=='FROZEN')throw Error('R8 QA contract not frozen; wait for product/quality freeze');
if(!contract.qualityRoute.length||!contract.probeIds.length||(!qualityOnly&&(!contract.route.length||!contract.reverseRoute.length)))throw Error('ROOT-reviewed route/probe contract missing');
const url=process.env.GAME_URL??'http://127.0.0.1:3011/living-landmass-stage.html';
const evidence={schema:1,spec:'docs/tasks/iteration-23.md R8 continuous terrain / painted 3D',startedAt:new Date().toISOString(),url,
 method:'Isolated headed Chrome, real keyboard/mouse, normal clock, read-only product probe. QA-owned rAF observer and passive recording branch preserve actual destination playback, gain and timing. No game-state writes, teleport, synthetic game events or time overrides.',
 mode:qualityOnly?'QUALITY-SEGMENT':'FINAL-ROUTE',checks:[],unverified:[],observations:[],samples:[],inputs:[],resources:[],errors:[],consoleErrors:[],warnings:[],failedRequests:[],audioLifecycle:[],recordings:[],visualVerdict:'HUMAN REVIEW PENDING'};
await mkdir(dir,{recursive:true});
const list=(...args)=>execFileSync('rg',['--files',...args],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const files=[...list('src/dev/living-landmass-stage'),...list('data').filter(p=>p.includes('living-landmass-vista')),
 ...list('public/assets/dev/living-landmass').filter(p=>/\.(png|webp|ogg|mp3|wav)$/.test(p)),
 contractPath,'living-landmass-stage.html','src/dev/living-landmass-stage.ts','src/dev/spatial-study/stage/actors.ts',
 'src/dev/spatial-study/stage/actor-pixels.ts','src/entities/player.ts','src/systems/ai/physical-grid.ts','src/systems/tile-grid.ts','src/config/game-config.ts','tools/living-landmass/qa-vista-r8.mjs'];
const hashes=()=>Promise.all([...new Set(files)].sort().map(async file=>({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')})));
evidence.contract=contract;evidence.sourceBefore=await hashes();
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:process.env.HEADLESS==='1',executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
evidence.browser={version:browser.version(),headless:process.env.HEADLESS==='1'};
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir,size:{width:1440,height:1000}}});
const checkGroups=new Map();evidence.checkFailures=[];evidence.assertions=0;
const check=(name,ok,details)=>{const rule=name.includes(': ')?name.slice(name.indexOf(': ')+2):name;let group=checkGroups.get(rule);if(!group){group={name:rule,ok:true,samples:0,failed:0};checkGroups.set(rule,group);evidence.checks.push(group);}group.samples++;evidence.assertions++;if(!ok){group.ok=false;group.failed++;evidence.checkFailures.push({name,at:Date.now(),details});console.error('CHECK FAILED',name,JSON.stringify(details));}return Boolean(ok);};
const position=s=>[s.x,s.y,s.height];
// Raw dynamic evidence remains numeric, with static prose/material/layout saved only at startup.
function slim(s){return {elapsedMs:s.elapsedMs,inputPaused:s.inputPaused,blockedFrames:s.blockedFrames,
 player:{x:s.player.x,y:s.player.y,height:s.player.height,supported:s.player.supported,moving:s.player.moving,facing:s.player.facing,velocity:s.player.velocity,screen:s.player.screen,feet:s.player.feet},
 camera:{position:s.camera.position,focus:s.camera.focus},actorProjection:{elevation:s.actorProjection.elevation},
 scenery:{motion:s.scenery.motion,reducedMotion:s.scenery.reducedMotion,transforms:s.scenery.transforms,deformation:s.scenery.deformation},
 audio:s.audio?{state:s.audio.state,muted:s.audio.muted,paused:s.audio.paused,cycle:s.audio.cycle,audioContextTime:s.audio.audioContextTime,presentationSeconds:s.audio.presentationSeconds,pan:s.audio.pan,gain:s.audio.gain,distance:s.audio.distance,sourceStarts:s.audio.sourceStarts,errors:s.audio.errors}:null,
 render:{frames:s.render.frames,drawCalls:s.render.drawCalls,triangles:s.render.triangles,buffers:s.render.buffers,textures:s.render.textures}};}

let writeQueue=Promise.resolve();
async function prepare(page,label,owner=context){
 const cdp=await owner.newCDPSession(page);await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:false});
 // No CDP destruction-event assertion: navigation can discard that observation target.
 page.on('pageerror',e=>evidence.errors.push({label,message:e.message}));page.on('console',m=>{if(m.type()==='error')evidence.consoleErrors.push({label,message:m.text()});else if(m.type()==='warning')evidence.warnings.push({label,message:m.text()});});
 page.on('response',r=>{if(r.status()>=400)evidence.failedRequests.push({url:r.url(),status:r.status()});if(r.url().includes('/assets/dev/living-landmass/'))evidence.resources.push({url:r.url(),status:r.status()});});
 await page.exposeBinding('__qaR8AudioData',(_source,{id,bytes,metadata})=>{const file=`${label}-audio-${id}.webm`;if(!evidence.recordings.some(r=>r.file===file))evidence.recordings.push({file,metadata});writeQueue=writeQueue.then(()=>appendFile(path.join(dir,file),Buffer.from(bytes,'base64')));return writeQueue;});
 await page.addInitScript(()=>{
  const recorders=[],contexts=new WeakMap();const originalConnect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(...args){const result=originalConnect.apply(this,args);if(args[0]===this.context.destination){
   let tap=contexts.get(this.context);if(!tap){const destination=this.context.createMediaStreamDestination();const recorder=new MediaRecorder(destination.stream,{mimeType:'audio/webm;codecs=opus'});let queue=Promise.resolve();const id=recorders.length+1;const context=this.context;
    recorder.ondataavailable=event=>{queue=queue.then(async()=>{if(!event.data.size)return;const data=new Uint8Array(await event.data.arrayBuffer());let bytes='';for(let i=0;i<data.length;i++)bytes+=String.fromCharCode(data[i]);await window.__qaR8AudioData({id,bytes:btoa(bytes),metadata:{mimeType:recorder.mimeType,sampleRate:context.sampleRate}});});};
    tap={destination,recorder,context,id,flush:()=>new Promise(resolve=>{if(recorder.state==='inactive')return queue.then(resolve);recorder.addEventListener('stop',()=>queue.then(resolve),{once:true});recorder.stop();})};contexts.set(context,tap);recorders.push(tap);recorder.start(1000);
   }originalConnect.call(this,tap.destination);
  }return result;};
  Object.defineProperty(window,'__qaR8Audio',{value:{stop:()=>Promise.all(recorders.map(r=>r.flush())),snapshot:()=>recorders.map(r=>({id:r.id,state:r.recorder.state,contextState:r.context.state,contextTime:r.context.currentTime}))}});
  const intervals=[];let previous=null;function frame(t){if(previous!==null&&!document.hidden)intervals.push(t-previous);previous=document.hidden?null:t;requestAnimationFrame(frame);}requestAnimationFrame(frame);
  Object.defineProperty(window,'__qaR8Frames',{value:intervals});
 });return cdp;
}
const page=await context.newPage();const cdp=await prepare(page,'main');
const read=(full=false)=>page.evaluate(full=>{const probe=window.__livingLandmassStage;const state=!full&&probe.getDynamicState?probe.getDynamicState():probe.getState();const {geometry,...dynamic}=state;return {...(full?state:dynamic),qaAudioObservation:window.__qaR8Audio.snapshot()};},full);
const distance=(a,b)=>Math.hypot(a.player.x-b.player.x,a.player.y-b.player.y);
function support(s,label){if(!check(`${label}: ready`,s.ready,s))throw Error('Scene not ready');check(`${label}: complete body supported`,s.player.supported,s.player);
 check(`${label}: production body20`,s.player.body.width===20&&s.player.body.height===20,s.player.body);
 check(`${label}: both soles on actual terrain`,s.player.feet.length===2&&s.player.feet.every(f=>Number.isFinite(f.clearance)&&f.clearance>=1.49&&f.clearance<5),s.player.feet);
 check(`${label}: player projection inside frame`,s.player.screen.x>14&&s.player.screen.x<946&&s.player.screen.y>28&&s.player.screen.y<628,s.player.screen);
 const ray=Math.atan2(s.camera.position[1]-s.player.height,s.camera.position[2]-s.player.y)*180/Math.PI;
 check(`${label}: actor follows camera ray`,Math.abs(ray-s.actorProjection.elevation)<.001,{ray,actual:s.actorProjection.elevation});
 if(s.audio?.state==='running'){const diff=Math.abs(s.audio.cycle.time-s.scenery.motion.time);check(`${label}: actual audio-driven scenery phase`,Math.min(diff,contract.cycleSeconds-diff)<.08,{audio:s.audio.cycle.time,visual:s.scenery.motion.time,context:s.audio.audioContextTime});check(`${label}: clean audio`,!s.audio.errors.length,s.audio.errors);}
 check(`${label}: contracted local deformers`,s.scenery.deformation?.length===contract.deformers.length&&contract.deformers.every(expected=>s.scenery.deformation.some(d=>d.name===expected.name&&d.role===expected.role)),s.scenery.deformation);
 check(`${label}: scenic geometry never grants support`,s.scenery.collision===false,s.scenery.collision);
 for(const d of s.scenery.deformation??[]){check(`${label}: ${d.name} anchored`,Math.abs(d.anchor.y-d.anchor.restY)<.00001,d.anchor);check(`${label}: ${d.name} local flex matches real mesh`,Math.abs((d.flex.y-d.flex.restY)-d.maxDisplacement)<.001,d);check(`${label}: ${d.name} same phase`,Math.abs(d.phase-s.scenery.motion[d.role])<.00001,d);}
 check(`${label}: clean scene`,!s.errors.length&&!s.pageErrors.length,{errors:s.errors,pageErrors:s.pageErrors});
}
async function sample(label){const s=await read();support(s,label);evidence.samples.push({label,at:Date.now(),state:slim(s)});return s;}
async function capture(label,supplied){const s=supplied??await sample(label);if(supplied)support(s,label);evidence.observations.push({label,at:new Date().toISOString(),state:slim(s)});await page.locator('canvas[data-living-stage]').screenshot({path:path.join(dir,`${label}.png`)});console.log(label,JSON.stringify({x:s.player.x,y:s.player.y,height:s.player.height,screen:s.player.screen}));return s;}
async function hold(keys,ms,label,captureAfter=false){const before=await read();evidence.inputs.push({label,keys,ms,at:Date.now(),before:position(before.player)});for(const key of keys)await page.keyboard.down(key);let middle;try{await page.waitForTimeout(ms/2);middle=await sample(`${label}-moving`);await page.waitForTimeout(ms/2);}finally{for(const key of [...keys].reverse())await page.keyboard.up(key);}await page.waitForTimeout(90);const after=captureAfter?await capture(label):await sample(label);Object.assign(evidence.inputs.at(-1),{after:position(after.player)});return{before,middle,after,distance:distance(before,after)};}
async function navigate(node,label){
 const began=await read(),start=Date.now(),origin={x:began.player.x,y:began.player.y},vx=node.x-origin.x,vy=node.y-origin.y,length=Math.hypot(vx,vy);
 let keys=[],stalled=0,last=began;try{while(Date.now()-start<35000){const state=await read();const remaining=Math.hypot(node.x-state.player.x,node.y-state.player.y);if(remaining<9)break;
  const along=length?Math.max(0,Math.min(length,((state.player.x-origin.x)*vx+(state.player.y-origin.y)*vy)/length)):0;
  const look=Math.min(length,along+18),aim={x:origin.x+vx*look/(length||1),y:origin.y+vy*look/(length||1)};
  const dx=aim.x-state.player.x,dy=aim.y-state.player.y,next=[];if(Math.abs(dx)>4)next.push(dx>0?'d':'a');if(Math.abs(dy)>4)next.push(dy>0?'s':'w');
  if(!next.length){if(Math.abs(node.x-state.player.x)>Math.abs(node.y-state.player.y))next.push(node.x>state.player.x?'d':'a');else next.push(node.y>state.player.y?'s':'w');}
  for(const key of keys)if(!next.includes(key))await page.keyboard.up(key);for(const key of next)if(!keys.includes(key))await page.keyboard.down(key);keys=next;
  const ms=Math.max(60,Math.min(160,remaining/80*700));evidence.inputs.push({label,keys:[...keys],ms,at:Date.now(),before:position(state.player)});await page.waitForTimeout(ms);const after=await sample(`${label}-moving`);evidence.inputs.at(-1).after=position(after.player);
  if(distance(last,after)<.15)stalled++;else stalled=0;last=after;if(stalled>6)throw Error(`Route blocked at ${label}: ${JSON.stringify(after.player)}, target=${JSON.stringify(node)}`);
 }}finally{for(const key of keys)await page.keyboard.up(key);}const arrived=await capture(label);if(Math.hypot(arrived.player.x-node.x,arrived.player.y-node.y)>15)throw Error(`Node ${label} not reached`);
}
async function runBoundary(test,node){
 const contact=await hold([test.key.toLowerCase()],Math.max(Math.abs(test.dx),Math.abs(test.dy))/80*1000,`check-${test.id}-contact`,true);
 const stop=await hold([test.key.toLowerCase()],650,`check-${test.id}-stop`,true);check(`${test.id}: real blocking`,stop.distance<.1&&stop.after.blockedFrames>contact.after.blockedFrames,{distance:stop.distance,player:stop.after.player});await navigate(node,`check-${test.id}-return`);
}
function normalizeRoute(geometry,route=geometry.recommendedRoute){const nodes=Array.isArray(geometry.routeNodes)?geometry.routeNodes:Object.entries(geometry.routeNodes??{}).map(([id,p])=>({id,...p}));const byId=new Map(nodes.map(n=>[n.id,n]));return route.map(entry=>typeof entry==='string'?byId.get(entry):entry).map(n=>{if(!n||!Number.isFinite(n.x)||!Number.isFinite(n.y))throw Error('Invalid route metadata');return n;});}
function verifyTopology(g){
 const t=contract.topology;
 check('terrain geometry independent of route graph',g.topology?.geometryFromRoutes===false,g.topology);
 check('contracted region and connector counts',g.regions.length===t.regions&&g.connectors.length===t.connectors,{regions:g.regions.length,connectors:g.connectors.length});
 check('contracted continuous terrain and void count',g.holes.length===t.holes,g.holes.length);
 const area=points=>Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0)/2);
 const areas=g.holes.map(area); // No required holes: route choices are not terrain perforations.
 const adjacency=new Map(g.routeNodes.map(n=>[n.id,new Set()])),edgeKeys=new Set();
 for(const connector of g.connectors){for(let i=1;i<connector.nodes.length;i++){
  const a=connector.nodes[i-1],b=connector.nodes[i];if(!adjacency.has(a)||!adjacency.has(b))throw Error('Connector references missing route node');if(a===b)throw Error('Consecutive duplicate route node is not a traversable edge');
  const key=JSON.stringify([a,b].sort());if(edgeKeys.has(key))continue;edgeKeys.add(key);adjacency.get(a).add(b);adjacency.get(b).add(a);
 }}
 const visited=new Set();let components=0;for(const id of adjacency.keys())if(!visited.has(id)){components++;const queue=[id];while(queue.length){const cur=queue.pop();if(visited.has(cur))continue;visited.add(cur);queue.push(...adjacency.get(cur));}}
 const cycles=edgeKeys.size-adjacency.size+components;const junctions=[...adjacency].filter(([,edges])=>edges.size>=3).map(([id])=>id);
 evidence.topology={nodeCount:adjacency.size,edgeCount:edgeKeys.size,edges:[...edgeKeys].map(JSON.parse),components,cycles,junctions,holeAreas:areas,method:'Unique undirected edges from consecutive connector.nodes; region from/to never forms graph vertices'};
 check('contracted route-node graph size',adjacency.size===t.nodes&&edgeKeys.size===t.edges,{nodes:adjacency.size,edges:edgeKeys.size});
 check('one connected traversable network',components===1,components);check('contracted independent loops',cycles===t.cycles,cycles);check('authored approach and merge junctions',junctions.length>=t.minJunctions,junctions);
 const probes=g.qaChecks.map(p=>p.id).sort();check('all reviewed probes present',JSON.stringify(probes)===JSON.stringify([...contract.probeIds].sort()),probes);
}

try{
 const load=Date.now();await page.goto(url);await page.waitForFunction(()=>window.__livingLandmassStage?.getState().ready,null,{timeout:30000});evidence.readyMs=Date.now()-load;await page.bringToFront();
 const fullStart=await read(true);evidence.initialGeometry=fullStart.geometry;const {geometry:ignoredGeometry,...dynamicStart}=fullStart;evidence.initialState=dynamicStart;const start=await capture('00-start-locked',dynamicStart);check('R8 revision',start.revision===contract.revision,start.revision);check('contracted camera',start.camera.elevation===contract.cameraElevation&&start.camera.spanAtFocus===contract.cameraSpan,start.camera);check('contracted distance roles',JSON.stringify(start.scenery.distanceRoles)===JSON.stringify(contract.distanceRoles)&&start.scenery.paintedLayers===contract.paintedLayers&&start.scenery.landforms===contract.landforms,start.scenery);check('all contracted scene assets loaded',contract.assets.every(asset=>evidence.resources.some(r=>new URL(r.url).pathname===asset&&r.status===200))&&evidence.resources.every(r=>r.status===200),evidence.resources);check('audio waits for real movement',start.audio?.state==='locked-until-movement',start.audio);
 check('render AA enabled',start.render.antialias===true,start.render);check('contracted physical and logical resolution',JSON.stringify(start.render.internal)===JSON.stringify(contract.internal)&&JSON.stringify(start.render.logical)===JSON.stringify(contract.logical),start.render);
 for(const [key,value] of Object.entries(contract.materials))check(`material contract ${key}`,JSON.stringify(evidence.initialGeometry.materials?.[key])===JSON.stringify(value),evidence.initialGeometry.materials?.[key]);for(const [section,values] of Object.entries(contract.background)){for(const [key,value] of Object.entries(values))check(`background contract ${section}.${key}`,JSON.stringify(start.scenery[section]?.[key])===JSON.stringify(value),start.scenery[section]?.[key]);}
 check('authored structural strata present',evidence.initialGeometry.strata?.length>=contract.minStrata,evidence.initialGeometry.strata?.length);check('contracted atmosphere layers',start.scenery.atmosphereLayers===contract.atmosphereLayers,start.scenery.atmosphereLayers);
 verifyTopology(evidence.initialGeometry);
 if(qualityOnly){
  const nodes=new Map(evidence.initialGeometry.routeNodes.map(node=>[node.id,node]));
  for(const id of contract.qualityRoute){if(!nodes.has(id))throw Error(`Missing quality waypoint ${id}`);await navigate(nodes.get(id),`quality-${id}`);}
  evidence.sourceAfter=await hashes();evidence.sourceStable=JSON.stringify(evidence.sourceBefore)===JSON.stringify(evidence.sourceAfter);
  check('quality source frozen through run',evidence.sourceStable,null);check('quality browser errors absent',!evidence.errors.length&&!evidence.consoleErrors.length&&!evidence.failedRequests.length,{errors:evidence.errors,consoleErrors:evidence.consoleErrors,requests:evidence.failedRequests});evidence.verdict=evidence.checks.every(c=>c.ok)?'QUALITY SEGMENT CAPTURED; NOT FINAL ACCEPTANCE':'QUALITY CHECK FAILURES';if(evidence.checks.some(c=>!c.ok))process.exitCode=1;
 }else{
 const east=await hold(['d'],350,'01-first-movement',true);check('cardinal speed80',Math.abs(Math.hypot(east.middle.player.velocity.x,east.middle.player.velocity.y)-80)<.01,east.middle.player.velocity);check('movement unlocks real AudioContext',east.after.audio?.state==='running',east.after.audio);
 const diagonal=await hold(['d','s'],280,'02-diagonal',true);check('diagonal normalized80',Math.abs(Math.hypot(diagonal.middle.player.velocity.x,diagonal.middle.player.velocity.y)-80)<.01,diagonal.middle.player.velocity);
 await navigate({x:start.player.x,y:start.player.y},'03-return-spawn');
 const outbound=normalizeRoute(evidence.initialGeometry,contract.route);const reverse=normalizeRoute(evidence.initialGeometry,contract.reverseRoute);const route=[...outbound,...reverse];evidence.route=route;evidence.reverseRouteStartsAt=outbound.length;const tests=evidence.initialGeometry.qaChecks??[],done=new Set();const nodeMap=new Map(evidence.initialGeometry.routeNodes.map(n=>[n.id,n]));const routeStarted=Date.now();
 for(let i=0;i<route.length;i++){
  const node=route[i];await navigate(node,`route-${String(i).padStart(2,'0')}-${node.id??'node'}`);
  for(const test of tests.filter(t=>t.node===node.id&&!done.has(t.id))){await runBoundary(test,node);done.add(test.id);}
  for(const detour of (contract.probeDetours??[]).filter(d=>d.from===node.id)){for(const test of tests.filter(t=>t.id===detour.probe&&!done.has(t.id))){for(const id of detour.path)await navigate(nodeMap.get(id),`check-${test.id}-approach-${id}`);await runBoundary(test,nodeMap.get(test.node));for(const id of [...detour.path.slice(0,-1)].reverse())await navigate(nodeMap.get(id),`check-${test.id}-return-${id}`);await navigate(node,`check-${test.id}-back-${node.id}`);done.add(test.id);}}
  if(Date.now()-routeStarted>contract.maxRouteWallSeconds*1000)throw Error('Route exceeded approved normal-clock bound; stopping instead of accelerating');
 }
 evidence.routeWallSeconds=(Date.now()-routeStarted)/1000;
 check('all contracted authored holes retained',evidence.initialGeometry.holes?.length===contract.topology.holes,evidence.initialGeometry.holes?.length);
 check('all authored boundary/obstacle probes executed',done.size===tests.length,[...done]);
 const returned=await capture('04-route-complete');check('full route returns to spawn',distance(start,returned)<25,{distance:distance(start,returned)});
 for(const connector of evidence.initialGeometry.connectors){const ids=route.map(n=>n.id),sequence=connector.nodes.join('|'),reverse=[...connector.nodes].reverse().join('|');check(`connector ${connector.id}: route traversed`,ids.join('|').includes(sequence)||ids.join('|').includes(reverse),connector.nodes);}
 const observedStages=[...new Set(evidence.samples.map(s=>s.state.scenery.motion.stage))];check('normal route covers complete load cycle',['rest','loading','bearing','release'].every(stage=>observedStages.includes(stage)),observedStages);const pans=evidence.samples.map(s=>s.state.audio.pan),gains=evidence.samples.map(s=>s.state.audio.gain);check('travel changes source direction and distance gain',Math.min(...pans)<-.2&&Math.max(...pans)>0&&Math.max(...gains)-Math.min(...gains)>.1,{pan:[Math.min(...pans),Math.max(...pans)],gain:[Math.min(...gains),Math.max(...gains)]});
 for(const {name,minCycleSpan} of contract.deformers){const values=evidence.samples.flatMap(s=>s.state.scenery.deformation.filter(d=>d.name===name).map(d=>d.maxDisplacement));check(`full cycle bends ${name} locally`,values.length>0&&Math.max(...values)-Math.min(...values)>=minCycleSpan,{range:[Math.min(...values),Math.max(...values)]});}
 const stationary=await read();await page.waitForTimeout(550);const idle=await read();check('release has no drift',distance(stationary,idle)<.01,distance(stationary,idle));
 const phaseA=await capture('05-rest-phase-a');await page.waitForTimeout(3500);const phaseB=await capture('06-rest-phase-b');check('nonwalking motion never moves resting player',distance(phaseA,phaseB)<.01&&Math.abs(phaseA.player.height-phaseB.player.height)<.001,{a:phaseA.player,b:phaseB.player});
 await page.keyboard.press('m');await page.waitForTimeout(450);const muted=await capture('07-muted');check('M actually mutes',muted.audio?.muted===true,muted.audio);await page.keyboard.press('m');await page.waitForTimeout(450);const unmuted=await capture('08-unmuted');check('M restores sound without restart',unmuted.audio?.muted===false&&unmuted.audio?.sourceStarts===muted.audio?.sourceStarts,unmuted.audio);
 evidence.focusFact=await page.evaluate(()=>({focused:document.hasFocus(),hidden:document.hidden}));
 evidence.unverified.push('Real OS blur/resume remains unverified: prior bounded window/Finder attempts did not establish focus loss. No CUA/Finder or repeated OS switching in R8.');
 evidence.frameIntervals=await page.evaluate(()=>window.__qaR8Frames.slice());const ordered=evidence.frameIntervals.filter(v=>v>0).sort((a,b)=>a-b);const percentile=q=>ordered[Math.min(ordered.length-1,Math.floor(ordered.length*q))];evidence.frameSummary={samples:ordered.length,medianMs:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),maxMs:ordered.at(-1),over33:ordered.filter(v=>v>33.34).length,over50:ordered.filter(v=>v>50).length,over100:ordered.filter(v=>v>100).length,method:'Browser rAF intervals under active recording; includes screenshot overhead, no synthetic clock and not isolated GPU timing.'};
 const storage=await context.storageState();const webStorage=await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage)}));check('no game save writes',!storage.cookies.length&&!storage.origins.length&&!webStorage.local.length&&!webStorage.session.length,{storage,webStorage});
 await page.evaluate(()=>window.__qaR8Audio.stop());await writeQueue;evidence.audioContextsBeforeReload=await page.evaluate(()=>window.__qaR8Audio.snapshot());
 await page.reload();await page.waitForFunction(()=>window.__livingLandmassStage?.getState().ready,null,{timeout:30000});const refreshed=await capture('09-refresh');check('refresh spawn and audio lock reset',distance(start,refreshed)<.01&&refreshed.audio?.state==='locked-until-movement',refreshed.audio);check('unique visible Three canvas',await page.locator('canvas[data-living-stage]').count()===1,null);
 await page.goto('about:blank');await page.waitForTimeout(200);
 // Surviving same-origin parent observes native close on real child navigation.
 const lifeContext=await browser.newContext({viewport:{width:1440,height:1000}}),life=await lifeContext.newPage();
 const lifecycleURL=new URL('/qa-r8-lifecycle.html',url).href,gamePath=new URL(url).pathname;
 await life.route(lifecycleURL,r=>r.fulfill({contentType:'text/html',body:`<script>window.__qaContexts=[];window.__qaClose=[];window.__qaWatch=(c,p)=>{window.__qaClose.push({type:"called",state:c.state});p.then(()=>window.__qaClose.push({type:"resolved",state:c.state}));}</script><iframe src="${gamePath}" style="width:1400px;height:950px;border:0"></iframe>`}));
 await life.addInitScript(()=>{if(window.parent===window)return;const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(...a){super(...a);window.parent.__qaContexts.push(this);}close(){const promise=super.close();window.parent.__qaWatch(this,promise);return promise;}};});
 life.on('pageerror',error=>evidence.errors.push({label:'lifecycle',message:String(error)}));
 await life.goto(lifecycleURL);const child=life.frames().find(f=>f.parentFrame());await child.waitForFunction(()=>window.__livingLandmassStage?.getState().ready,null,{timeout:15000});await child.locator('#game-container').click();await life.keyboard.press('w');await life.waitForTimeout(350);evidence.lifecycleBefore=await child.evaluate(()=>({audio:window.__livingLandmassStage.getState().audio}));
 await child.goto('about:blank');await life.waitForTimeout(500);evidence.lifecycle=await life.evaluate(()=>({contexts:window.__qaContexts.map(c=>({state:c.state})),events:window.__qaClose}));
 check('real navigation closes native AudioContexts and resolves promise',evidence.lifecycle.contexts.length>=2&&evidence.lifecycle.contexts.every(c=>c.state==='closed')&&evidence.lifecycle.events.some(e=>e.type==='resolved'),evidence.lifecycle);await lifeContext.close();
 const reducedContext=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',recordVideo:{dir,size:{width:1440,height:1000}}});const reduced=await reducedContext.newPage();await prepare(reduced,'reduced',reducedContext);await reduced.goto(url);await reduced.waitForFunction(()=>window.__livingLandmassStage?.getState().ready,null,{timeout:30000});await reduced.bringToFront();
 await reduced.keyboard.down('s');await reduced.waitForTimeout(180);await reduced.keyboard.up('s');await reduced.waitForTimeout(120);const reducedA=await reduced.evaluate(()=>window.__livingLandmassStage.getDynamicState());await reduced.waitForTimeout(2200);const reducedB=await reduced.evaluate(()=>window.__livingLandmassStage.getDynamicState());evidence.reducedMotion={before:slim(reducedA),after:slim(reducedB)};check('reduced-motion really requested',await reduced.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),null);check('reduced-motion freezes scenic transforms',reducedB.scenery.reducedMotion===true&&JSON.stringify(reducedA.scenery.transforms)===JSON.stringify(reducedB.scenery.transforms),{a:reducedA.scenery,b:reducedB.scenery});check('reduced-motion zero local deformation',reducedB.scenery.deformation.length===contract.deformers.length&&reducedB.scenery.deformation.every(d=>d.phase===0&&Math.abs(d.maxDisplacement)<.00001&&Math.abs(d.flex.y-d.flex.restY)<.00001)&&JSON.stringify(reducedA.scenery.deformation)===JSON.stringify(reducedB.scenery.deformation),{a:reducedA.scenery.deformation,b:reducedB.scenery.deformation});check('reduced-motion uses static audio bed',reducedB.audio.state==='running'&&reducedB.audio.reducedMotion===true&&reducedB.audio.cycle.time===0,reducedB.audio);await reduced.evaluate(()=>window.__qaR8Audio.stop());await writeQueue;await reduced.locator('canvas[data-living-stage]').screenshot({path:path.join(dir,'10-reduced-motion.png')});await reducedContext.close();
 check('no browser errors',!evidence.errors.length&&!evidence.consoleErrors.length&&!evidence.failedRequests.length,{errors:evidence.errors,consoleErrors:evidence.consoleErrors,requests:evidence.failedRequests});
 evidence.sourceAfter=await hashes();check('source frozen through run',JSON.stringify(evidence.sourceBefore)===JSON.stringify(evidence.sourceAfter),null);evidence.verdict=evidence.checks.every(c=>c.ok)?'COVERED CHECKS PASS / HUMAN REVIEW PENDING':'CHECK FAILURES';if(evidence.checks.some(c=>!c.ok))process.exitCode=1;
 }
}catch(error){evidence.verdict='INCOMPLETE';evidence.failure=error.stack??String(error);console.error(error);process.exitCode=1;}finally{evidence.endedAt=new Date().toISOString();await page.evaluate(()=>window.__qaR8Audio?.stop()).catch(()=>{});await writeQueue;await context.close();await browser.close();evidence.video=await page.video()?.path();await writeFile(path.join(dir,'evidence.json'),JSON.stringify(evidence));console.log('Artifacts:',dir);}
