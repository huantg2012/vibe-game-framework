/** Bounded I14 mask A/B: real keyboard arrival, real Escape pause, same scene/state.
 * Diagnostic Gym only. Never changes world/actor state, light, fog, clock, resources,
 * production sources, or the natural48 chain. --freeze does not start a browser. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const dir='docs/qa/artifacts/r100-i14/occlusion-visual/v3';
const sha=v=>createHash('sha256').update(v).digest('hex');
const ref=file=>({file,bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))});
const read=file=>JSON.parse(fs.readFileSync(file));
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const planFile=`${dir}/capture-policy.json`;
const oldManifest='docs/qa/artifacts/r100-i14/frozen-source/source-snapshot.json';
const newManifest='docs/qa/artifacts/r100-i14/actor-occlusion/frozen-source/source-snapshot.json';
const source='src/systems/r100-world/presentation.ts';
if(process.argv.includes('--freeze')){
 assert(!fs.existsSync(planFile),'Never replace a frozen attempt.');
 const old=read(oldManifest),file=path.join(old.temporaryRoot,source),copy=`${dir}/old-presentation.ts.txt`;
 assert.equal(ref(file).sha256,old.sources[source]);fs.copyFileSync(file,copy,fs.constants.COPYFILE_EXCL);
 assert(fs.readFileSync(copy,'utf8').includes("const visible=x<=x1&&(this.world.roleAt(x,y)!=='solid'||nativeVolumeHeightAt(this.world.raster,x,y)<Math.max(1,ground-y));"));
 write(planFile,{schemaVersion:1,createdAt:new Date().toISOString(),worlds:['hollow-wreckage','felt-wedges'],grade:'severe',seed:20261004,loadout:'bare',gameUrl:'http://127.0.0.1:3037',viewport:{width:1440,height:1000},maxPairsPerWorld:1,maxTravelMsPerPose:25000,
  authorization:'Root approved two worlds, at most three normal-keyboard stopping points each. Real Escape freezes simulation; only old-oracle/new-cache query is switched for mask redraw. No natural sortie count or performance qualification.',
  dependencies:[ref('docs/qa/artifacts/r100-i14/occlusion-visual/v2/capture-report.json'),ref('docs/qa/artifacts/r100-i14/occlusion-visual/capture-report.json'),ref(import.meta.filename),ref(oldManifest),ref(newManifest),ref(copy),ref('docs/qa/artifacts/r100-i14/actor-occlusion/delta-freeze.json'),ref('docs/qa/artifacts/r100-i14/actor-occlusion/equivalence/report.json')],
  selection:'Only the remaining third pair per world authorized by Root: body-supported candidate using actual visible masked Image objects, including cropped body, held weapon and lamp. Each opaque sample is alpha-weighted >=0.15 and transformed by its actual world matrix. No synthetic union rectangle pixels count. Graphics arm is not sampled. Actual reachable case misses retained; no teleport, invulnerability, enemy deletion, forced facing or clock manipulation.',
  reliefClarification:'Fixed felt-wedges severe seed20261004 has zero top-visible relief pixels; hollow-wreckage supplies the relief opportunity. No role change or fabricated relief fixture.',
  capture:'Gym formal RiftScene renderer, normal shoulder lamp/fog/camera. Canvas PNGs omit DOM. Raw fillRect spans and all available exported simulation state plus read-only combat/AI probe retained; Gym formal combat and AI recovery exports unavailable before/after each pair. PNG equality is separate from mask equality.',
  limits:['Controlled Gym map/equipment identity, full static geometry assists routing; not natural exploration.','At most six paused A/B pairs, not continuous-motion video or full four-facing/all-world review.','Multiple actor masks are compared where naturally present; offscreen masks do not prove visible art.','No audio perception, final aesthetic acceptance, weak-device or performance conclusion.','The previously denied file review page is never visited.']});
 console.log(JSON.stringify({policy:ref(planFile)}));process.exit(0);
}
assert(process.argv.includes('--run'),'Use --freeze or --run.');
assert(process.env.I14_ART_WINDOW==='1','Root-coordinated visual window must be explicit.');
const plan=read(planFile);for(const r of plan.dependencies)assert.equal(ref(r.file).sha256,r.sha256,r.file);
assert(!fs.existsSync(`${dir}/capture-report.json`),'Preserve original attempt.');
const current=read(newManifest);for(const file of [source,'src/systems/r100-world/actor-occlusion-field.ts'])assert.equal(ref(file).sha256,current.sources[file]);
const report={schemaVersion:1,supplementScope:'v2 completed four pairs, all equal. It found no reachable primary-body partial. Root authorized only each world remaining third-pair quota, using visible actor composite images. If still no partial, record missing without expansion.',correction:'Original attempt stopped before any image/movement because Gym does not enable combat/AI formal recovery exports. This derivative records these explicit omissions, adds read-only combat stats and full Gym probe, keeps all remaining actual exporters. No recovery capability is enabled or game state changed.',status:'running',startedAt:new Date().toISOString(),policy:ref(planFile),naturalSortiesAdded:0,performanceSample:false,cases:[],errors:[]};
const save=()=>fs.writeFileSync(`${dir}/capture-report.json`,JSON.stringify(report,null,2)+'\n');
save();let browser;
try{
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});report.browser=browser.version();
 for(const world of plan.worlds){
  const row={world,grade:plan.grade,seed:plan.seed,loadout:plan.loadout,status:'running',inputs:[],pairs:[],misses:[]};report.cases.push(row);save();
  const context=await browser.newContext({viewport:plan.viewport,deviceScaleFactor:1});const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push({world,error:String(e)}));
  try{
   await page.goto(`${plan.gameUrl}/r100-gym.html?${new URLSearchParams({world,grade:plan.grade,seed:String(plan.seed),loadout:plan.loadout})}`);
   await page.waitForFunction(()=>window.__r100Gym?.getState().runtime.running,null,{timeout:60000});
   await page.locator('#game-container').focus();await page.keyboard.press('Escape',{delay:80});row.inputs.push({key:'Escape',purpose:'freeze-entry'});
   await page.waitForFunction(()=>window.__r100Gym.getState().runtime.paused);
   await page.evaluate(async()=>{
    const {audioManager}=await import('/src/managers/audio-manager.ts');
    const {nativeVolumeHeightAt}=await import('/src/generation/world-study/native-volume-raster.ts');
    const {inventoryStore}=await import('/src/systems/inventory-store.ts');
    const game=audioManager.game,s=game.scene.getScene('RiftScene'),p=s.devRuntime;
    const newQuery=p.actorOcclusionField.isVisibleAtPixel;
    const oldQuery=(x,y,limit)=>p.world.roleAt(x,y)!=='solid'||nativeVolumeHeightAt(p.world.raster,x,y)<limit;
    const state=()=>({formalRecoveryExportsUnavailable:['combat','ai'],probe:s.probeBuildLabState(),combatStats:s.combat.getStats(),elapsedMs:s.devElapsedMs,sceneTime:s.time.now,physicsElapsed:s.physics.world._elapsed,
     conditions:structuredClone(s.recoveryConditions),presentationSequence:s.devEventSequence,result:{killCount:s.sortieKillCount,acquired:structuredClone(s.sortieAcquired),passiveTriggers:[...s.sortiePassiveTriggers]},defenseHudEffects:structuredClone(s.defenseHudEffects),
     player:s.player.exportRuntimeState(),tools:s.toolSystem.exportRuntimeState(),chaos:s.chaos.exportRuntimeState(),search:s.search.exportRuntimeState(),field:s.fieldInventory.exportRuntimeState(),trail:s.trail.exportRuntimeState(),minimap:s.minimap.exportRuntimeState(),hosts:s.hosts.exportRuntimeState(),world:p.exportRuntimeState(),run:s.runController.exportRuntimeState(),inventory:inventoryStore.getState(),
     camera:{x:s.cameras.main.scrollX,y:s.cameras.main.scrollY,zoom:s.cameras.main.zoom},sourceState:{mode:p.mode,time:p.time,lastElapsed:p.lastElapsed,lamp:{...p.lamp},phase:p.phase,activity:p.activity},paused:game.scene.isPaused('RiftScene')});
    const opaqueOffsets=()=>{
     const offsets=[],base=s.player.getPosition();
     for(const sprite of p.actorMasks[0].objects){
      if(!sprite.scene||!sprite.visible||sprite.alpha<.15||!sprite.frame||!sprite.getWorldTransformMatrix)continue;
      const f=sprite.frame,img=f.source.image,canvas=document.createElement('canvas');canvas.width=f.cutWidth;canvas.height=f.cutHeight;
      const c=canvas.getContext('2d');c.drawImage(img,f.cutX,f.cutY,f.cutWidth,f.cutHeight,0,0,f.cutWidth,f.cutHeight);const pixels=c.getImageData(0,0,canvas.width,canvas.height).data,matrix=sprite.getWorldTransformMatrix(),crop=sprite.isCropped?sprite._crop:null;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
       if(crop&&(x<crop.x||y<crop.y||x>=crop.x+crop.width||y>=crop.y+crop.height))continue;
       if(pixels[(y*canvas.width+x)*4+3]/255*sprite.alpha<.15)continue;
       const point=matrix.transformPoint(x-sprite.displayOriginX,y-sprite.displayOriginY);offsets.push({x:point.x-base.x,y:point.y-base.y,texture:sprite.texture.key});
      }
     }
     return offsets;
    };
    const coverage=point=>{const groundOffset=s.player.getGroundY()-s.player.getPosition().y,offsets=opaqueOffsets(),byTexture={};let hidden=0,relief=0;for(const q of offsets){const x=Math.floor(point.x+q.x),y=Math.floor(point.y+q.y),entry=byTexture[q.texture]??={opaque:0,hidden:0};entry.opaque++;if(!oldQuery(x,y,Math.max(1,point.y+groundOffset-y))){hidden++;entry.hidden++;}if(p.world.roleAt(x,y)==='relief')relief++;}return{opaque:offsets.length,hidden,visible:offsets.length-hidden,relief,byTexture};};
    const redraw=mode=>{
     if(!game.scene.isPaused('RiftScene'))throw Error('A/B redraw requires real pause');
     p.actorOcclusionField.isVisibleAtPixel=mode==='old'?oldQuery:newQuery;
     const records=p.actorMasks.map((entry,index)=>({index,retired:entry.retired,point:{...entry.actor.getPosition()},ground:entry.actor.getGroundY(),spans:[],objects:entry.actor.objects.filter(o=>o.scene).map(o=>({type:o.type,visible:o.visible,alpha:o.alpha,x:o.x,y:o.y,texture:o.texture?.key,bounds:o.getBounds?o.getBounds():null}))}));
     const restore=[];
     try{p.actorMasks.forEach((entry,i)=>{if(entry.retired)return;entry.key='';const original=entry.graphics.fillRect;entry.graphics.fillRect=function(...args){records[i].spans.push(args);return original.apply(this,args);};restore.push(()=>entry.graphics.fillRect=original);});p.maskActor();}
     finally{for(const f of restore)f();}
     p.actorMasks.forEach((entry,i)=>records[i].key=entry.key);
     return{records,compositeCoverage:coverage(s.player.getPosition()),facing:s.player.getFacing4(),position:{...s.player.getPosition()},ground:s.player.getGroundY()};
    };
    const restore=()=>{p.actorOcclusionField.isVisibleAtPixel=newQuery;for(const e of p.actorMasks)if(!e.retired)e.key='';p.maskActor();return p.actorOcclusionField.isVisibleAtPixel===newQuery;};
    window.__artMask={s,p,game,state,redraw,restore,coverage,opaqueOffsets,oldQuery};
   });
   const fullState=()=>page.evaluate(()=>window.__artMask.state());
   async function pair(label){
    assert(row.pairs.length<plan.maxPairsPerWorld);
    const before=await fullState();assert(before.paused);
    const pair={id:`${world}-${row.pairs.length+1}-${label}`,label,beforeStateSha256:sha(JSON.stringify(before)),variants:[]};row.pairs.push(pair);save();
    write(`${dir}/${pair.id}-state-before.json`,before);
    for(const mode of ['old','new']){
     const masks=await page.evaluate(mode=>window.__artMask.redraw(mode),mode);
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     const file=`${dir}/${pair.id}-${mode}.png`;await page.locator('#game-container canvas').screenshot({path:file});
     const spans=masks.records.map(r=>({index:r.index,retired:r.retired,key:r.key,spans:r.spans}));
     pair.variants.push({mode,image:ref(file),maskSpanSha256:sha(JSON.stringify(spans)),compositeCoverage:masks.compositeCoverage,facing:masks.facing,position:masks.position,ground:masks.ground,actors:masks.records.map(({spans,...rest})=>({...rest,spanCount:spans.length}))});
     write(`${dir}/${pair.id}-${mode}-masks.json`,masks);
    }
    assert(await page.evaluate(()=>window.__artMask.restore()));
    const after=await fullState();write(`${dir}/${pair.id}-state-after.json`,after);pair.afterStateSha256=sha(JSON.stringify(after));
    pair.observedStateEqual=pair.beforeStateSha256===pair.afterStateSha256;
    pair.maskSpansEqual=pair.variants[0].maskSpanSha256===pair.variants[1].maskSpanSha256;
    pair.pngBytesEqual=pair.variants[0].image.sha256===pair.variants[1].image.sha256;
    assert(pair.observedStateEqual,'Observed paused simulation state advanced during A/B');assert(pair.maskSpansEqual,'Old/new actual actor spans differ');save();
    console.log(JSON.stringify({pair:pair.id,maskEqual:pair.maskSpansEqual,stateEqual:pair.observedStateEqual,pngEqual:pair.pngBytesEqual,coverage:pair.variants[1].compositeCoverage,facing:pair.variants[1].facing}));
   }
   async function route(kind){
    return page.evaluate(kind=>{
     const {s,p,coverage,opaqueOffsets,oldQuery}=window.__artMask,g=s.formFloorGrid,b=s.player.getSprite().body,start={...s.player.getPosition()},step=8,cols=Math.ceil(g.cols*g.tileSize/step),rows=Math.ceil(g.rows*g.tileSize/step),halfX=b.width/2+1,halfY=b.height/2+1;
     const center=i=>({x:(i%cols+.5)*step,y:(Math.floor(i/cols)+.5)*step});
     const clear=point=>{for(let y=Math.floor((point.y-halfY)/g.tileSize);y<=Math.floor((point.y+halfY-.01)/g.tileSize);y++)for(let x=Math.floor((point.x-halfX)/g.tileSize);x<=Math.floor((point.x+halfX-.01)/g.tileSize);x++)if(!g.isWalkable(x,y))return false;return true;};
     const begin=Math.floor(start.y/step)*cols+Math.floor(start.x/step),prev=new Map([[begin,-1]]),queue=[begin],offsets=opaqueOffsets(),groundOffset=s.player.getGroundY()-start.y;let end=null,summary=null;
     for(let cursor=0;cursor<queue.length;cursor++){
      const i=queue[cursor],q=center(i),distance=Math.hypot(q.x-start.x,q.y-start.y);
      if(distance>=18){let hidden=0,relief=0;for(const o of offsets){const x=Math.floor(q.x+o.x),y=Math.floor(q.y+o.y);if(!oldQuery(x,y,Math.max(1,q.y+groundOffset-y)))hidden++;if(p.world.roleAt(x,y)==='relief')relief++;}
       const match=kind==='partial'?hidden>=6&&hidden<offsets.length*.8:kind==='relief'?hidden===0&&relief>=12:hidden===0&&distance>=48;
       if(match){end=i;summary={opaque:offsets.length,hidden,relief};break;}
      }
      for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=i%cols+dx,y=Math.floor(i/cols)+dy,n=y*cols+x;if(x<0||y<0||x>=cols||y>=rows||prev.has(n)||!clear(center(n)))continue;prev.set(n,i);queue.push(n);}
     }
     if(end===null)return{kind,unavailable:'No reachable static-body/texture candidate',visited:prev.size};
     const raw=[];for(let i=end;i!==-1;i=prev.get(i))raw.push(center(i));raw.reverse();const points=[];
     for(let i=1;i<raw.length-1;i++)if((raw[i-1].x===raw[i].x)!==(raw[i].x===raw[i+1].x))points.push(raw[i]);points.push(raw.at(-1));
     return{kind,start,target:center(end),predicted:summary,points,visited:prev.size,disclosure:'Read-only full static geometry and actual visible masked Image pixels; candidate is a diagnostic hypothesis, not a visual observation.'};
    },kind);
   }
   async function travel(planRoute){
    const started=Date.now();row.inputs.push({route:planRoute});save();
    await page.keyboard.press('Escape',{delay:80});await page.waitForFunction(()=>!window.__r100Gym.getState().runtime.paused);
    let stopped=null;
    try{for(const point of planRoute.points){let previous=null,stuck=0;for(let i=0;i<70;i++){
      if(Date.now()-started>plan.maxTravelMsPerPose){stopped='bounded-route-timeout';break;}
      const state=await page.evaluate(()=>{const {s}=window.__artMask;return{point:{...s.player.getPosition()},speed:s.player.getEffectiveSpeed(),ended:s.runController.isRunEnded(),elapsed:s.devElapsedMs};});
      if(state.ended){stopped='normal-run-ended';break;}
      const dx=point.x-state.point.x,dy=point.y-state.point.y,d=Math.hypot(dx,dy);if(d<2.5)break;
      stuck=previous&&Math.hypot(previous.x-state.point.x,previous.y-state.point.y)<.2?stuck+1:0;previous=state.point;if(stuck>=8){stopped='normal-collision-stall';break;}
      const keys=[];if(Math.abs(dx)>1.8)keys.push(dx>0?'d':'a');if(Math.abs(dy)>1.8)keys.push(dy>0?'s':'w');
      const ms=Math.max(20,Math.min(110,d/Math.max(30,state.speed)*850));row.inputs.push({keys,ms,from:state.point,target:point,elapsed:state.elapsed});
      for(const key of keys)await page.keyboard.down(key);await page.waitForTimeout(ms);for(const key of keys)await page.keyboard.up(key);
     }if(stopped)break;}}
    finally{for(const key of ['w','a','s','d'])await page.keyboard.up(key);if(!await page.evaluate(()=>window.__r100Gym.getState().runtime.paused)){await page.keyboard.press('Escape',{delay:80});row.inputs.push({key:'Escape',purpose:'freeze-arrival'});}await page.waitForFunction(()=>window.__r100Gym.getState().runtime.paused);}
    if(stopped)row.misses.push({kind:planRoute.kind,reason:stopped});save();return stopped;
   }
   const partial=await route('partial');row.partialRoute=partial;
   if(partial.unavailable)row.misses.push(partial);else{await travel(partial);await pair('composite-partial-arrival');}
   row.actualPartialObservedInCompositeQuery=row.pairs.some(pair=>{const c=pair.variants[1]?.compositeCoverage;return c&&c.hidden>0&&c.visible>0;});
   row.actualReliefOverlapInCompositeQuery=row.pairs.some(pair=>{const c=pair.variants[1]?.compositeCoverage;return c&&c.hidden===0&&c.relief>0;});
   row.status='bounded-capture-completed';
  }catch(error){row.status='failed';row.failure=String(error.stack??error);report.errors.push({world,error:row.failure});}
  finally{try{row.queryRestored=await page.evaluate(()=>window.__artMask?.restore()??true);}catch{}await context.close();row.contextClosed=true;save();}
 }
 report.status=report.errors.length?'bounded-capture-with-failures':'bounded-capture-completed';
}catch(error){report.status='failed';report.failure=String(error.stack??error);process.exitCode=1;}
finally{await browser?.close();report.browsersClosed=true;report.finishedAt=new Date().toISOString();report.sourceFilesUnchanged=[source,'src/systems/r100-world/actor-occlusion-field.ts'].every(file=>ref(file).sha256===current.sources[file]);save();}
console.log(JSON.stringify({status:report.status,report:ref(`${dir}/capture-report.json`)}));
