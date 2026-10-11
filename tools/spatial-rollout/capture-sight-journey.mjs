/** Diagnostic full-map navigation, ordinary keyboard movement and production FOV.
 * Fresh isolated memory gym per witness. No teleport/light/health/clock edits. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=process.env.GAME_URL??'http://127.0.0.1:3027';
const proof=JSON.parse(fs.readFileSync(process.env.QA_SIGHT_REPORT,'utf8'));
assert.equal(proof.status,'passed','Require a completed source measurement');
const cases=proof.cases.filter(item=>!process.env.QA_WORLD||item.world===process.env.QA_WORLD);
assert(cases.length,'No matching sight cases');
const out=path.resolve(process.env.QA_OUTPUT_DIR);fs.mkdirSync(out,{recursive:true});
assert(!fs.existsSync(path.join(out,'report.json')),'Preserve historical evidence');
const report={status:'running',sourceReport:process.env.QA_SIGHT_REPORT,scope:'Controlled production memory gym; full map used only to plan normal WASD routes. Target is a real ground point, not spawned loot. No relocation, visibility, health or clock edits. Not blind player exploration.',cases:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const snapshot=await fetch(`${base}/source-snapshot.json`).then(r=>r.json());fs.writeFileSync(path.join(out,'source-snapshot.json'),JSON.stringify(snapshot,null,2));
for(const [file,hash]of Object.entries(proof.sourceHashes)) if(file.startsWith('src/')||file.startsWith('data/')) assert.equal(snapshot.files[file],hash,`Witness source differs from browser snapshot: ${file}`);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{for(const item of cases){
 const witnesses=item.witnesses??item.sight?.witnesses??item.measurement?.witnesses;
 assert(witnesses?.length,'No sight witnesses');const w=process.env.QA_WITNESS? witnesses[Number(process.env.QA_WITNESS)] : [...witnesses].sort((a,b)=>a.spawnApproach.routeLength-b.spawnApproach.routeLength)[0];
 const grade=item.grade??'medium',seed=item.requestedSeed??proof.requestedSeed??20261010;
 const dir=path.join(out,`${item.world}-${grade}-${seed}`);assert(!fs.existsSync(dir),'Duplicate sight case');fs.mkdirSync(dir,{recursive:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir,size:{width:1440,height:1000}}}),page=await context.newPage();
 const row={world:item.world,grade,seed,witness:w,events:[],errors:[]};report.cases.push(row);page.on('pageerror',e=>row.errors.push(String(e)));
 try{
  await page.goto(`${base}/r100-gym.html?world=${item.world}&grade=${grade}&seed=${seed}`);
  await page.waitForFunction(()=>window.__r100Gym?.getState().runtime.running||!document.getElementById('error')?.hidden,null,{timeout:120000});
  assert((await page.evaluate(()=>window.__r100Gym?.getState())).runtime.running,await page.locator('#error').textContent());
  row.geometryFingerprint=await page.evaluate(()=>window.__r100Gym.getNative().diagnostics.geometryFingerprint);
  assert.equal(row.geometryFingerprint,item.geometryFingerprint,'Browser geometry differs from measured witness map');
  await page.evaluate(async target=>{
   const {audioManager}=await import('/src/managers/audio-manager.ts');
   const {bodyHasSupport,bodyDisplacementFraction}=await import('/src/systems/ai/physical-grid.ts');
   const s=audioManager.game.scene.getScene('RiftScene'),g=s.formFloorGrid,physical=s.nativeBody;
   if(g.tileSize!==8||!physical)throw Error('Sight journey requires the native 8px grid and real body queries');
   const supported=Uint8Array.from({length:g.cols*g.rows},(_,i)=>bodyHasSupport(g,{x:(i%g.cols+.5)*8,y:(Math.floor(i/g.cols)+.5)*8},10,10)?1:0);
   window.__sightJourney={s,g,supported,target,physical,bodyHasSupport,bodyDisplacementFraction};
  },w.target);
  const state=()=>page.evaluate(()=>{const {s,target}=window.__sightJourney;return{position:{...s.player.getPosition()},target,visibility:s.visibility.getVisibilityAt(target),unoccludedVisibility:s.visibility.getUnoccludedVisibilityAt(target),forwardRadius:s.visibility.getEffectiveRadius(0),facingAngle:s.player.getFacingAngle(),targetDistance:Math.hypot(target.x-s.player.getPosition().x,target.y-s.player.getPosition().y),hp:s.combat.getHealth(),elapsedMs:s.runController.getElapsedMs(),ended:s.runController.isRunEnded()};});
  const walk=async target=>{
   const navigation=await page.evaluate(async target=>{
    const {s,g,supported,physical,bodyHasSupport,bodyDisplacementFraction}=window.__sightJourney,p={...s.player.getPosition()};
    // BEGIN NATIVE JOURNEY START: also exercised offline against the failed position.
    const planRoute=(p,target)=>{
     const center=k=>({x:(k%g.cols+.5)*8,y:(Math.floor(k/g.cols)+.5)*8});
     const begin=Math.floor(p.y/8)*g.cols+Math.floor(p.x/8),end=Math.floor(target.y/8)*g.cols+Math.floor(target.x/8);
     if(!physical.supports(p,10,10))throw Error('Actual player lacks native body support');
     if(!supported[end])throw Error('Witness endpoint lacks full grid-body support');
     // Native triangle collision permits legal positions excluded by the
     // conservative navigation grid. Connect the actual position to that
     // graph with a real 20px body sweep; never snap or relocate the player.
     const sweepTo=q=>physical.displacementFraction(p,10,10,q.x-p.x,q.y-p.y);
     let seeds=[];
     if(supported[begin]&&physical.supports(center(begin),10,10)&&sweepTo(center(begin))===1)seeds=[begin];
     else{
      const col=Math.floor(p.x/8),row=Math.floor(p.y/8);
      for(let y=row-4;y<=row+4;y++)for(let x=col-4;x<=col+4;x++){
       if(x<0||y<0||x>=g.cols||y>=g.rows)continue;
       const k=y*g.cols+x,q=center(k);
       if(supported[k]&&Math.hypot(q.x-p.x,q.y-p.y)<=32&&physical.supports(q,10,10)&&sweepTo(q)===1)seeds.push(k);
      }
      seeds.sort((a,b)=>Math.hypot(center(a).x-p.x,center(a).y-p.y)-Math.hypot(center(b).x-p.x,center(b).y-p.y));
     }
     if(!seeds.length)throw Error('No nearby grid center reachable by native body sweep');
     const prev=new Int32Array(supported.length).fill(-2),queue=[...seeds];for(const k of queue)prev[k]=-1;
     for(let at=0;at<queue.length&&prev[end]===-2;at++){const k=queue[at],x=k%g.cols,y=Math.floor(k/g.cols);for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,j=yy*g.cols+xx;if(xx<0||yy<0||xx>=g.cols||yy>=g.rows||!supported[j]||prev[j]!==-2)continue;if(bodyDisplacementFraction(g,center(k),10,10,dx*8,dy*8)<1)continue;prev[j]=k;queue.push(j);}}
     if(prev[end]===-2)throw Error('No swept-body path to witness');
     const raw=[];for(let k=end;k>=0;k=prev[k])raw.push(center(k));raw.reverse();
     const entry={actualPosition:p,snappedCenter:center(begin),actualGridSupported:bodyHasSupport(g,p,10,10),snappedGridSupported:!!supported[begin],actualNativeSupported:true,seedCount:seeds.length,selectedCenter:raw[0],distancePx:Math.hypot(raw[0].x-p.x,raw[0].y-p.y),sweepFraction:sweepTo(raw[0])};
     return{raw,entry};
    };
    // END NATIVE JOURNEY START
    const {raw,entry}=planRoute(p,target);
    const points=[raw[0]];for(let i=1;i<raw.length-1;i++){const a=raw[i-1],b=raw[i],c=raw[i+1];if(b.x-a.x!==c.x-b.x||b.y-a.y!==c.y-b.y)points.push(b);}points.push(raw.at(-1));
    const held=new Set(),codes={w:87,a:65,s:83,d:68},events=[];
    const change=next=>{for(const key of [...held])if(!next.includes(key)){window.dispatchEvent(new KeyboardEvent('keyup',{key,code:`Key${key.toUpperCase()}`,keyCode:codes[key],which:codes[key],bubbles:true}));held.delete(key);}for(const key of next)if(!held.has(key)){window.dispatchEvent(new KeyboardEvent('keydown',{key,code:`Key${key.toUpperCase()}`,keyCode:codes[key],which:codes[key],bubbles:true}));held.add(key);}};
    let index=0,last={...p},still=performance.now();const started=still;
    try{while(index<points.length){await new Promise(resolve=>requestAnimationFrame(resolve));const p=s.player.getPosition();if(s.runController.isRunEnded())throw Error('Run ended during normal navigation');if(performance.now()-started>180000)throw Error('Bounded route timed out');if(Math.hypot(p.x-last.x,p.y-last.y)>.3){still=performance.now();last={...p};}else if(held.size&&performance.now()-still>5000)throw Error('Swept path blocked');const t=points[index],dx=t.x-p.x,dy=t.y-p.y;if(Math.hypot(dx,dy)<=3){index++;change([]);continue;}const keys=[];if(Math.abs(dx)>2)keys.push(dx>0?'d':'a');if(Math.abs(dy)>2)keys.push(dy>0?'s':'w');change(keys);}}
    finally{change([]);}return{points,length:entry.distancePx+(raw.length-1)*8,entry,elapsedWallMs:performance.now()-started,position:{...s.player.getPosition()},events};
   },target);row.events.push(navigation);save();
  };
  const face=async()=>{const s=await state(),dx=w.target.x-s.position.x,dy=w.target.y-s.position.y;const key=Math.abs(dx)>Math.abs(dy)?(dx>0?'d':'a'):(dy>0?'s':'w');await page.keyboard.down(key);await page.waitForTimeout(220);await page.keyboard.up(key);await page.waitForTimeout(80);};
  await page.locator('#game-container').focus();row.entry=await state();await walk(w.observer);await face();row.hidden=await state();assert(row.hidden.unoccludedVisibility>0,'Target outside actual facing/range: not a valid VOID witness');assert.equal(row.hidden.visibility,0,'Ground across VOID is not hidden');await page.screenshot({path:path.join(dir,'before.png')});
  await walk(w.reveal);await face();row.revealed=await state();assert(row.revealed.visibility>0,'Target not revealed after walking around VOID');assert(!row.revealed.ended);await page.screenshot({path:path.join(dir,'after.png')});
  await walk(w.observer);await face();row.returned=await state();assert(row.returned.unoccludedVisibility>0,'Return target outside actual facing/range');assert.equal(row.returned.visibility,0,'Current FOV must hide target again when returning');await page.screenshot({path:path.join(dir,'returned.png')});assert.deepEqual(row.errors,[]);row.status='passed';
 }catch(error){row.status='failed';row.failure=String(error.stack??error);report.errors.push({world:item.world,error:row.failure});console.log(`FAIL ${item.world}: ${error.message}`);}
 finally{await context.close();save();}console.log(`${row.status} sight journey ${item.world}`);
}report.status=report.errors.length?'failed':'passed';save();if(report.errors.length)process.exitCode=1;}
finally{await browser.close();}
