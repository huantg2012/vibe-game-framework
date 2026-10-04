/** Read-only patrol observation, not a substitute for an actual stealth trip. */
import fs from 'node:fs';import path from 'node:path';
const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-i03/loot-windows');fs.mkdirSync(out,{recursive:true});
const {chromium}=await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const cases=[['ash-strata',20261004],['ash-strata',20261005],['crystal-fibre',20261005]],report={scope:'Real engine patrol/Host clocks at untouched spawn. Read-only sampling of all supported 48px search seats with real LOS, body clearance, live paint/volume danger. Proves potential stationary windows; does not claim approach or complete search success.',cases:[],status:'running'};
try{for(const [world,seed]of cases){
 const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage();
 await page.goto(`${process.env.GAME_URL??'http://127.0.0.1:3060'}/r100-gym.html?world=${world}&grade=severe&seed=${seed}`);
 await page.waitForFunction(()=>window.__r100Gym?.getState().runtime.running,null,{timeout:60000});
 const start=await page.evaluate(async()=>{
  const {audioManager}=await import('/src/managers/audio-manager.ts');
  const s=audioManager.game.scene.getScene('RiftScene');
  const {bodyHasSupport}=await import('/src/systems/ai/physical-grid.ts');
  const {hasLineOfSight}=await import('/src/utils/grid-raycast.ts');
  const {isVolumeDangerousAt}=await import('/src/systems/volume-presence.ts');
  const world=s.nativeWorldPresentation.world,grid=world.combat,layout=world.layout;
  const nodes=[...layout.kindlingNodes,...layout.contaminantNodes].filter(n=>n.tier==='deep'||n.tier==='contested').map(node=>{
   const seats=[];
   for(let dy=-48;dy<=48;dy+=8)for(let dx=-48;dx<=48;dx+=8){const p={x:node.position.x+dx,y:node.position.y+dy};
    if(Math.hypot(dx,dy)>48||!bodyHasSupport(grid,p,10,10)||!hasLineOfSight(world.sight,p,node.position,48.001))continue;
    seats.push({position:p,since:null,maxMs:0,windows:0});
   }
   return{id:node.id,tier:node.tier,position:node.position,seats};
  });
  const data={nodes,started:s.devElapsedMs,last:s.devElapsedMs,frames:0,gaps:0,stateCounts:{},maxProgress:0};window.__lootWindow={data};
  window.__lootWindow.timer=setInterval(()=>{
   const t=s.devElapsedMs,dt=t-data.last;if(dt<=0)return;data.frames++;if(dt>180)data.gaps++;
   const enemies=s.ai.getEnemies(),sources=s.hosts.getSubjects();
   for(const enemy of enemies)data.stateCounts[enemy.getState()]=(data.stateCounts[enemy.getState()]??0)+1;
   for(const node of nodes)for(const seat of node.seats){const p=seat.position;
    const threatened=enemies.some(enemy=>{
     const ai=enemy.ai,sight=enemy.config.sight,q=enemy.getPosition(),d=Math.hypot(p.x-q.x,p.y-q.y);
     if(d<30)return true;
     const range=ai.state==='chase'?sight.chaseRange:sight.rangeCore;
     if(d>range*ai.perceptionRangeMult||!hasLineOfSight(world.sight,q,p,range*ai.perceptionRangeMult))return false;
     if(ai.state==='chase')return true;
     const a=Math.atan2(p.y-q.y,p.x-q.x)-enemy.getFacingAngle(),offset=Math.abs(Math.atan2(Math.sin(a),Math.cos(a)));
     return (d<=sight.rangeCore*ai.perceptionRangeMult&&offset<=sight.halfAngleCore)||(d<=sight.rangePeripheral*ai.perceptionRangeMult&&offset<=sight.halfAnglePeripheral);
    })||sources.some(source=>{
     if(source.form.portfolio==='bing')return s.hosts.isPaintFloorActive(source.id,Math.floor(p.x/32),Math.floor(p.y/32));
     const frame=s.hosts.getVolumePresenceFrame(source.id);return frame&&isVolumeDangerousAt(frame,p.x,p.y);
    });
    if(threatened||dt>180)seat.since=null;
    else if(seat.since===null)seat.since=t;
    else{const duration=t-seat.since;seat.maxMs=Math.max(seat.maxMs,duration);if(duration>=1200&&duration-dt<1200)seat.windows++;}
   }
   data.last=t;data.maxProgress=t-data.started;
  },100);
  return{started:data.started,recipe:window.__r100Gym.getState().recipe,patrols:layout.enemySpawns,nodes:nodes.map(n=>({id:n.id,position:n.position,seats:n.seats.length}))};
 });
 await page.waitForFunction(()=>window.__lootWindow.data.maxProgress>=45000,null,{timeout:90000});
 const observation=await page.evaluate(()=>{clearInterval(window.__lootWindow.timer);return window.__lootWindow.data;});
 const result={world,seed,start,observation,nodes:observation.nodes.map(n=>({id:n.id,tier:n.tier,position:n.position,supportedSeats:n.seats.length,windowSeats:n.seats.filter(p=>p.maxMs>=1200).length,best:[...n.seats].sort((a,b)=>b.maxMs-a.maxMs).slice(0,5)}))};
 report.cases.push(result);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(world,seed,result.nodes.map(n=>[n.id,n.windowSeats,Math.round(n.best[0]?.maxMs??0)]));await context.close();
}report.status=report.cases.every(c=>c.nodes.every(n=>n.windowSeats>0))?'stationary-windows-observed':'missing-window';}
catch(error){report.status='error';report.error=String(error);console.error(error);process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
