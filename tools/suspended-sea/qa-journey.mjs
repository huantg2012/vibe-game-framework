/** Actual-input, same-page journey QA. Commands are logged JSON; never game-state writes. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import readline from 'node:readline';

const sourceRoot=process.env.SOURCE_ROOT??'/private/tmp/coh-i22-journey-review';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const dir=path.resolve('docs/qa/artifacts/iteration-22',`base-journey-${runId}`);
const evidence={schema:1,runId,sourceRoot,method:'One empty Chrome context, formal initial white crowbar and original base/rift scenes; only logged keyboard/mouse. Read-only probes from the existing bound game. No grants, fake impact, teleport, HP/state/time override. Pauses are the actual page control.',commands:[],inputs:[],checkpoints:[],failures:[],errors:[],resourceFailures:[]};
const digest=b=>createHash('sha256').update(b).digest('hex');
async function sources(){
  const names=execFileSync('rg',['--files','src','data','assets/audio','public/assets/audio'],{cwd:sourceRoot,encoding:'utf8'}).trim().split('\n').filter(n=>!n.startsWith('assets/')&&!n.startsWith('public/')||n.includes('suspended-sea'));
  names.push('suspended-sea-journey.html','package.json','vite.config.ts');
  const files=await Promise.all(names.sort().map(async file=>({file,sha256:digest(await readFile(path.join(sourceRoot,file)))})));
  files.push({file:'QA:tools/suspended-sea/qa-journey.mjs',sha256:digest(await readFile(new URL(import.meta.url)))});
  return {head:execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim(),files};
}
await mkdir(dir,{recursive:true});evidence.sourceBefore=await sources();
await writeFile(path.join(dir,'source-start.json'),JSON.stringify(evidence.sourceBefore,null,2));
const {chromium}=await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:960},recordVideo:{dir,size:{width:1440,height:960}}});
assert.deepEqual(await context.storageState(),{cookies:[],origins:[]});
const page=await context.newPage();page.on('pageerror',e=>evidence.errors.push(String(e)));
page.on('response',r=>{if(r.status()>=400)evidence.resourceFailures.push({url:r.url(),status:r.status()});});
await page.goto('http://127.0.0.1:3005/suspended-sea-journey.html?scene=sea-open-channel&seed=19');
await page.waitForFunction(()=>window.__suspendedSeaJourney?.read().ready,null,{timeout:30000});
await page.evaluate(async sentinel=>{
  if(localStorage.getItem('coh-save-v1')!==null)throw Error('Refuse to replace existing formal SAVE');
  localStorage.setItem('coh-save-v1',sentinel);
  const {audioManager}=await import('/src/managers/audio-manager.ts');
  // Inspect the game already bound by Boot; no new Phaser game or mutating probe.
  window.__qaJourneyRead=()=>{
    const state=window.__suspendedSeaJourney.read(),scene=audioManager.game.scene.getScene(state.activeScene);
    const frame=state.ready&&state.activeScene==='RiftScene'?scene.probePresentationFrame():null;
    return {...state,frame,error:document.querySelector('#error')?.textContent??'',audio:audioManager.getState()};
  };
  window.__qaJourneyLayout=()=>{
    const scene=audioManager.game.scene.getScene('RiftScene'),world=scene.devRuntime.world;
    return structuredClone({map:world.layout.tileMap,spawn:world.layout.spawnPoint,extraction:world.layout.extractionPoint,
      nodes:[...world.layout.kindlingNodes,...world.layout.contaminantNodes],water:world.water});
  };
  window.__qaJourney={samples:[],sampleErrors:[],events:[],lastRun:null,lastEvent:0,frameTimes:[]};
  let previous;
  const tick=now=>{if(previous&&window.__qaJourney.frameTimes.length<160000)window.__qaJourney.frameTimes.push(now-previous);previous=now;requestAnimationFrame(tick);};requestAnimationFrame(tick);
  setInterval(()=>{try{
    const s=window.__qaJourneyRead();if(!s.frame||s.paused)return;
    const q=window.__qaJourney,scene=audioManager.game.scene.getScene('RiftScene'),world=scene.devRuntime.world,b=s.frame.player.body;
    if(q.lastRun!==s.session.runId){q.lastRun=s.session.runId;q.lastEvent=0;}
    const physical=[[b.x+.01,b.y+.01],[b.x+b.width-.01,b.y+.01],[b.x+.01,b.y+b.height-.01],[b.x+b.width-.01,b.y+b.height-.01]].map(([x,y])=>world.isFloor(x,y));
    if(q.samples.length<50000)q.samples.push({runId:s.session.runId,frame:structuredClone(s.frame),physical,audio:s.audio});
    for(const event of s.frame.events)if(event.sequence>q.lastEvent){q.events.push({runId:s.session.runId,...structuredClone(event)});q.lastEvent=event.sequence;}
  }catch(e){window.__qaJourney.sampleErrors.push(String(e));}},100);
  const manager=audioManager.game.sound,destination=manager.context.createMediaStreamDestination();manager.masterVolumeNode.connect(destination);
  const recorder=new MediaRecorder(destination.stream,{mimeType:'audio/webm;codecs=opus'}),chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};window.__qaJourneyAudio={recorder,chunks,destination,source:manager.masterVolumeNode};recorder.start(1000);
},`journey-${runId}`);
const sleep=ms=>page.waitForTimeout(ms);
async function read(){const s=await page.evaluate(()=>window.__qaJourneyRead());assert(!s.error,s.error);assert.notEqual(s.session.phase,'faulted',s.session.fault);return s;}
function brief(s){return {phase:s.session.phase,active:s.activeScene,paused:s.paused,base:s.base,rift:s.rift,game:s.session.game,tide:s.session.tide,inventory:s.session.inventory,water:s.space?.water,shell:s.space?.shell,frame:s.frame?{player:s.frame.player,tools:s.frame.tools,enemies:s.frame.enemies}:null};}
async function focus(){await page.locator('#game-container').click({position:{x:8,y:8}});}
async function press(key,ms=80){evidence.inputs.push({key,ms,at:Date.now()});await page.keyboard.down(key);try{await sleep(ms);}finally{await page.keyboard.up(key);}}
async function pause(value){const s=await read();if(s.paused!==value&&!(s.rift?.ended)){evidence.inputs.push({click:'#pause',at:Date.now()});await page.locator('#pause').click();await sleep(60);}}
async function until(test,label,timeout=8000){const end=Date.now()+timeout;while(Date.now()<end){const s=await read();if(test(s))return s;await sleep(80);}throw Error(`Timeout ${label}`);}
async function capture(label){assert(/^[\w-]+$/.test(label));const s=await read();evidence.checkpoints.push({label,at:Date.now(),state:s});await page.screenshot({path:path.join(dir,`${label}.png`)});await writeFile(path.join(dir,`${label}.json`),JSON.stringify(s,null,2));await checkpoint();return brief(s);}
async function checkpoint(){const record=await page.evaluate(()=>window.__suspendedSeaJourney.export());await writeFile(path.join(dir,'journey-record.json'),JSON.stringify(record));await writeFile(path.join(dir,'evidence.json'),JSON.stringify(evidence,null,2));}
const point=s=>s.rift?.player??s.base.player;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
async function face(key){const desired={d:0,a:Math.PI,s:Math.PI/2,w:-Math.PI/2}[key];for(let i=0;i<12;i++){const s=await read();if(!s.frame){await press(key,180);return;}const angle=s.frame.player.facing;if(Math.abs(Math.atan2(Math.sin(angle-desired),Math.cos(angle-desired)))<.08)return;await press(key,55);}throw Error('Facing did not converge');}
async function fight(id){
  for(let n=0;n<22;n++){const s=await read(),enemy=s.rift.enemies.find(e=>e.id===id);if(!enemy)return;assert(!s.rift.ended,'Real combat ended run');const p=point(s),dx=enemy.position.x-p.x,dy=enemy.position.y-p.y,key=Math.abs(dx)>Math.abs(dy)?dx>0?'d':'a':dy>0?'s':'w';await face(key);if(distance(enemy.position,p)>64)await press(key,160);await press('Space',80);await sleep(440);}
  throw Error(`Enemy remains after real fight: ${id}`);
}
async function move(axis,target,combat=false){let previous,stalls=0;for(let i=0;i<350;i++){const s=await read();assert(!s.paused&&!s.rift?.ended,'Move needs live scene');if(combat&&s.rift){const e=s.rift.enemies.find(e=>distance(e.position,point(s))<112);if(e){await fight(e.id);return false;}}
  const n=point(s)[axis],d=target-n;if(Math.abs(d)<3.5)return true;stalls=previous!==undefined&&Math.abs(n-previous)<.2?stalls+1:0;assert(stalls<16,`Blocked ${axis} ${n} → ${target}`);previous=n;await press(axis==='x'?d>0?'d':'a':d>0?'s':'w',Math.max(24,Math.min(180,Math.abs(d)*3)));}throw Error('Movement budget exhausted');}
function route(layout,start,goal,water=false){const m=layout.map,t=m.tileSize,key=(x,y)=>`${x},${y}`;
  const legal=(x,y)=>[-10,10].every(dx=>[-10,10].every(dy=>m.tiles[Math.floor((y+dy)/t)]?.[Math.floor((x+dx)/t)]===1))&&(water||!(x>=layout.water.left-12&&x<=layout.water.right+12&&y>=layout.water.top-12&&y<=layout.water.bottom+12));
  const from={x:Math.floor(start.x/t),y:Math.floor(start.y/t)},to={x:Math.floor(goal.x/t),y:Math.floor(goal.y/t)},queue=[from],prev=new Map([[key(from.x,from.y),null]]);
  for(let i=0;i<queue.length;i++){const a=queue[i];if(a.x===to.x&&a.y===to.y)break;for(const [dx,dy]of[[1,0],[0,-1],[0,1],[-1,0]]){const b={x:a.x+dx,y:a.y+dy},k=key(b.x,b.y);if(prev.has(k)||!legal((b.x+.5)*t,(b.y+.5)*t))continue;prev.set(k,a);queue.push(b);}}
  assert(prev.has(key(to.x,to.y)),'No legal dry path');const points=[];let a=to;while(a){points.push({x:(a.x+.5)*t,y:(a.y+.5)*t});a=prev.get(key(a.x,a.y));}points.reverse();const corners=[points[0]];for(let i=1;i<points.length-1;i++)if((points[i-1].x===points[i].x)!==(points[i].x===points[i+1].x))corners.push(points[i]);corners.push(points.at(-1),goal);return corners;
}
async function go(goal,options={}){const layout=await page.evaluate(()=>window.__qaJourneyLayout());for(let attempt=0;attempt<8;attempt++){const points=route(layout,point(await read()),goal,options.water);let stopped=false;for(const p of points){const current=point(await read()),axes=Math.abs(p.x-current.x)>Math.abs(p.y-current.y)?['x','y']:['y','x'];for(const axis of axes)if(!await move(axis,p[axis],options.combat!==false)){stopped=true;break;}if(stopped)break;}if(!stopped)return;}throw Error('Path repeatedly interrupted');}
async function search(id){const layout=await page.evaluate(()=>window.__qaJourneyLayout()),node=layout.nodes.find(n=>n.id===id);assert(node,`Missing ${id}`);await go(node.position);await face('d');const before=(await read()).rift.search.remaining;await press('e',1550);if((await read()).rift.search.remaining===before){const s=await read(),e=s.rift.enemies.find(e=>distance(e.position,point(s))<140);if(e)await fight(e.id);await press('e',1550);}assert((await read()).rift.search.remaining<before,`Search failed ${id}`);await sleep(300);
  const ground=(await read()).session.inventory.items.filter(i=>i.location.kind==='ground'&&distance(i.location.position,node.position)<50);for(const item of ground){await press('e',100);await sleep(150);if(await page.locator('#inventory-panel').count()){await capture(`capacity-${evidence.checkpoints.length}`);await press('Tab',60);}}
}
async function finish(status='completed'){await pause(true).catch(()=>{});evidence.status=status;evidence.final=await read();evidence.sourceAfter=await sources();const after=new Map(evidence.sourceAfter.files.map(f=>[f.file,f.sha256]));evidence.sourceChanged=evidence.sourceBefore.files.filter(f=>after.get(f.file)!==f.sha256).map(f=>f.file);evidence.saveSentinelUnchanged=await page.evaluate(v=>localStorage.getItem('coh-save-v1')===v,`journey-${runId}`);
  const trace=await page.evaluate(()=>window.__qaJourney);evidence.trace={samples:trace.samples.length,illegal:trace.samples.filter(s=>s.physical.some(v=>!v)).length,sampleErrors:trace.sampleErrors,lureSamples:trace.samples.filter(s=>s.frame.enemies.some(e=>e.targetingLure)).length};await writeFile(path.join(dir,'trace.json'),JSON.stringify(trace));
  const audio=await page.evaluate(async()=>{const a=window.__qaJourneyAudio;await new Promise(r=>{a.recorder.onstop=r;a.recorder.stop();});a.source.disconnect(a.destination);const b=new Uint8Array(await new Blob(a.chunks).arrayBuffer());let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s);});await writeFile(path.join(dir,'actual-game-audio.webm'),Buffer.from(audio,'base64'));evidence.audio='Actual existing game bus captured; not listened.';await checkpoint();const video=page.video();await context.close();await rename(await video.path(),path.join(dir,'continuous.webm'));await browser.close();console.log(JSON.stringify({finished:true,dir,status,trace:evidence.trace,sourceChanged:evidence.sourceChanged,save:evidence.saveSentinelUnchanged}));process.exit(0);}
async function handle(c){evidence.commands.push({...c,at:Date.now()});
  if(c.op==='state')return brief(await read());if(c.op==='layout')return page.evaluate(()=>window.__qaJourneyLayout());
  if(c.op==='dom')return page.locator('#dom-ui-root').innerText();if(c.op==='capture')return capture(c.label);if(c.op==='finish')return finish(c.status);
  if(c.op==='pause'){await pause(c.value);return brief(await read());}
  await pause(false);await focus();
  if(c.op==='keys'){for(const k of c.keys){await press(k.key,k.ms??80);if(k.wait)await sleep(k.wait);}}
  else if(c.op==='move'){for(const p of c.points)for(const axis of p.order??['x','y'])if(p[axis]!==undefined)await move(axis,p[axis],false);}
  else if(c.op==='go')await go(c.point,c.options);
  else if(c.op==='search'){for(const id of c.ids)await search(id);}
  else if(c.op==='face')await face(c.key);
  else if(c.op==='fight')await fight(c.id);
  else if(c.op==='wait')await sleep(c.ms);
  else if(c.op==='click'){const target=c.text?page.getByText(c.text,{exact:true}):page.locator(c.selector);evidence.inputs.push({click:c.selector??c.text,at:Date.now()});await target.click({timeout:4000});await sleep(c.wait??300);}
  else if(c.op==='seed'){await page.locator('#seed').fill(String(c.value));await page.locator('#seed').press('Tab');}
  else if(c.op==='depart'){await page.locator('.inventory-primary').click();await until(s=>s.activeScene==='RiftScene'&&s.ready&&s.rift.elapsedMs>100,'normal departure',12000);}
  else if(c.op==='extract'){const l=await page.evaluate(()=>window.__qaJourneyLayout());await go(l.extraction);await press('e',100);await until(s=>s.rift?.ended,'real extraction',5000);}
  else if(c.op==='return'){await press('r',90);await until(s=>s.activeScene==='PurificationScene'&&s.ready&&s.session.phase==='base','real return',10000);}
  else throw Error(`Unknown command ${c.op}`);
  if(c.autoPause!==false&&(await read()).activeScene==='RiftScene')await pause(true);
  await checkpoint();return brief(await read());
}
await sleep(1800);await capture('00-initial-base');console.log(JSON.stringify({ready:true,dir,state:brief(await read())}));
let queue=Promise.resolve();const input=readline.createInterface({input:process.stdin});input.on('line',line=>{if(!line.trim())return;queue=queue.then(async()=>{let c;try{c=JSON.parse(line);console.log(JSON.stringify({result:await handle(c)}));}catch(error){evidence.failures.push({command:c,error:String(error),at:Date.now()});await pause(true).catch(()=>{});await capture(`failure-${evidence.failures.length}`).catch(()=>{});console.log(JSON.stringify({failure:String(error),state:brief(await read())}));}});});
