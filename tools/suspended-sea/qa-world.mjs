/** Iteration22 actual-input route QA. Navigation reads the authored map; only keyboard/mouse act. */
import assert from 'node:assert/strict';
import { SeaQaDriver } from './qa-driver.mjs';
import { SEA_ROUTE_GUIDES } from './route-guides.ts';

const scene = process.env.SCENE ?? 'sea-open-channel';
const loadout = process.env.LOADOUT ?? 'bare';
const seed = Number(process.env.SEED ?? 7);
const testCase = process.env.CASE ?? 'route';
const qa = new SeaQaDriver({ scene, loadout, seed, testCase });
const handled = new Set();
let map, bounds, sequence = 0;
const label = text => `${String(++sequence).padStart(2, '0')}-${text}`;
const pos = state => state.snapshot.player;
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

function floor(x,y) { return map.tiles[Math.floor(y/map.tileSize)]?.[Math.floor(x/map.tileSize)] === 1; }
function legal(x,y,{water=false}={}) {
  if (![-10,10].every(dx => [-10,10].every(dy => floor(x+dx,y+dy)))) return false;
  return water || !bounds.some(b => x >= b.left-12 && x <= b.right+12 && y >= b.top-12 && y <= b.bottom+12);
}
function pathTo(start, goal, options={}) {
  const t=map.tileSize, key=(x,y)=>`${x},${y}`;
  const from={x:Math.floor(start.x/t),y:Math.floor(start.y/t)}, to={x:Math.floor(goal.x/t),y:Math.floor(goal.y/t)};
  const queue=[from], previous=new Map([[key(from.x,from.y),null]]);
  for(let at=0;at<queue.length;at++) {
    const current=queue[at]; if(current.x===to.x&&current.y===to.y) break;
    // Deterministic shortest four-neighbour path. This is a QA navigator, never injected into game AI.
    for(const [dx,dy] of [[1,0],[0,-1],[0,1],[-1,0]]) {
      const next={x:current.x+dx,y:current.y+dy}, id=key(next.x,next.y);
      if(previous.has(id)||!legal((next.x+.5)*t,(next.y+.5)*t,options))continue;
      previous.set(id,current);queue.push(next);
    }
  }
  assert(previous.has(key(to.x,to.y)),`No safe full-body route to ${JSON.stringify(goal)}`);
  const points=[];let current=to;
  while(current) {points.push({x:(current.x+.5)*t,y:(current.y+.5)*t});current=previous.get(key(current.x,current.y));}
  points.reverse();
  const compressed=[];
  for(let i=1;i<points.length-1;i++) {
    const a=points[i-1],b=points[i],c=points[i+1];
    if((a.x===b.x)!==(b.x===c.x))compressed.push(b);
  }
  compressed.push(points.at(-1));
  return {points,compressed};
}

async function face(target) {
  const p=pos(await qa.read()),dx=target.x-p.x,dy=target.y-p.y;
  const key=Math.abs(dx)>Math.abs(dy)?dx>0?'d':'a':dy>0?'s':'w';
  const desired={d:0,s:Math.PI/2,a:Math.PI,w:-Math.PI/2}[key];
  for(let n=0;n<12;n++) {
    const state=await qa.read(),angle=state.frame.player.facing;
    if(Math.abs(Math.atan2(Math.sin(angle-desired),Math.cos(angle-desired)))<.08)return key;
    // The formal player turns gradually. A 24ms tap is not a completed 90/180-degree turn.
    await qa.press(key,55);
  }
  throw Error(`Actual movement failed to turn toward ${key}`);
}
async function encounter(enemy) {
  if(handled.has(enemy.id))return;
  handled.add(enemy.id);
  await qa.capture(label(`encounter-${enemy.id}`));
  const hearing=enemy.id==='SS_listener';
  if(loadout==='melee') {
    await face(enemy.position);await qa.press('q',50);
    const line=(await qa.read()).frame.tools.seams.length>0;
    qa.evidence.checks.push(`stitch deployment at ${enemy.id}: ${line}`);
    if(line) {
      await qa.press('Space',60);
      const until=Date.now()+5000;
      while(Date.now()<until) {
        const current=await qa.read(),recipient=current.frame.enemies.find(e=>e.id===enemy.id);
        if(!recipient||recipient.restraint?.snared)break;
        if(distance(current.snapshot.player,recipient.position)<38)break;
        await qa.page.waitForTimeout(60);
      }
      await qa.capture(label('line-recipient'));
    }
    // The pressure zone is placed at the player's feet. Wait for the real enemy to approach it.
    await qa.press('f',50);
    const until=Date.now()+5000;
    while(Date.now()<until) {
      const current=await qa.read(),recipient=current.frame.enemies.find(e=>e.id===enemy.id);
      if(!recipient||recipient.restraint?.pressure)break;
      await qa.press('Space',70);await qa.page.waitForTimeout(250);
    }
    await qa.capture(label('pressure-recipient'));
  } else if(hearing&&(loadout==='light'||loadout==='shore')) {
    await face(enemy.position);await qa.press('q',50);
    const until=Date.now()+3500;
    while(Date.now()<until) {
      if((await qa.read()).frame.enemies.some(e=>e.id===enemy.id&&e.targetingLure))break;
      await qa.page.waitForTimeout(60);
    }
    await qa.capture(label('lure-recipient'));
    if(loadout==='shore') {await face(enemy.position);await qa.press('f',50);await qa.capture(label('shore-line'));}
  }
  // Same ordinary weapon and exact formal strike path in every configuration.
  await qa.strikeEnemy(enemy.id);
  await qa.capture(label(`defeated-${enemy.id}`));
}

async function walkSegment(axis,target,{encounters=true,water=false}={}) {
  let previous,stalls=0;
  for(let n=0;n<250;n++) {
    const state=await qa.read();assert(!state.snapshot.ended,'Run ended during navigation');
    if(encounters) {
      const enemy=state.snapshot.enemies.find(e=>!handled.has(e.id)&&distance(e.position,pos(state))<115);
      if(enemy){await encounter(enemy);return false;}
    }
    const current=pos(state)[axis],diff=target-current;
    if(Math.abs(diff)<=4)return true;
    stalls=previous!==undefined&&Math.abs(current-previous)<.2?stalls+1:0;
    assert(stalls<12,`Navigation physically blocked at ${axis}=${current} toward ${target}`);previous=current;
    await qa.press(axis==='x'?diff>0?'d':'a':diff>0?'s':'w',Math.max(24,Math.min(180,Math.abs(diff)*3)));
  }
  throw Error('Navigation step budget exhausted');
}

async function go(goal,options={}) {
  for(let attempt=0;attempt<6;attempt++) {
    const start=pos(await qa.read()),route=pathTo(start,goal,options);
    qa.evidence.moves.push({kind:'planned-real-input-route',from:start,to:goal,options,points:route.points});
    // Snap to the current cell centre without crossing an unknown corner.
    let interrupted=false;
    for(const point of [route.points[0],...route.compressed]) {
      const state=await qa.read(),current=pos(state);
      const axes=Math.abs(point.x-current.x)>Math.abs(point.y-current.y)?['x','y']:['y','x'];
      for(const axis of axes)if(!await walkSegment(axis,point[axis],options)){interrupted=true;break;}
      if(interrupted)break;
    }
    if(interrupted)continue;
    for(const axis of ['x','y'])if(!await walkSegment(axis,goal[axis],options)){interrupted=true;break;}
    if(!interrupted)return;
  }
  throw Error('Repeated encounter prevented route completion');
}

async function panelTakeOrLeave() {
  if(!await qa.page.locator('#inventory-panel').count())return;
  await qa.capture(label('capacity-choice'));
  const ground=await qa.page.locator('.inventory-item[data-lane="nearby"]').count();
  qa.evidence.checks.push(`Actual capacity panel opened with ${ground} nearby item(s); retain held finds and leave excess.`);
  await qa.press('Tab',50);await qa.page.waitForTimeout(220);await qa.focus();
}

async function searchNode(node) {
  await go(node.position);
  await face({x:node.position.x+10,y:node.position.y});
  const before=(await qa.read()).snapshot.search.remaining;
  await qa.press('e',1550);
  // Damage interrupts search legitimately. Resolve the actual nearby fight and retry, retaining its cost.
  if((await qa.read()).snapshot.search.remaining===before) {
    const state=await qa.read(),enemy=state.snapshot.enemies.find(e=>distance(e.position,pos(state))<140);
    if(enemy&&!handled.has(enemy.id))await encounter(enemy);
    await qa.press('e',1550);
  }
  assert((await qa.read()).snapshot.search.remaining<before,`Search ${node.id} did not complete through actual E`);
  const revealed=await qa.fullState();
  const nearby=revealed.inventory.items.filter(i=>i.location.kind==='ground'&&distance(i.location.position,node.position)<=50);
  qa.evidence.observations.push({label:`${node.id}-revealed`,inventory:revealed.inventory});
  for(const item of nearby) {
    await qa.press('e',100);await qa.page.waitForTimeout(120);
    await panelTakeOrLeave();
  }
  await qa.capture(label(`searched-${node.id}`));
}

async function dropAndRetake() {
  const state=await qa.fullState(),equipped=new Set([state.inventory.equipment.weaponId,...state.inventory.equipment.toolIds]);
  const item=state.inventory.items.find(i=>i.location.kind==='carried'&&!equipped.has(i.id));
  assert(item,'Route returns with at least one unequipped pickup for actual drop/re-take');
  await qa.press('Tab',50);
  await qa.page.locator('#inventory-panel').waitFor();
  const before=(await qa.read()).snapshot.elapsedMs;
  await qa.page.waitForTimeout(400);
  assert((await qa.read()).snapshot.elapsedMs>before+200,'Opening the carried-find panel does not pause the world');
  const row=qa.page.locator(`.inventory-item[data-item-id="${item.id}"][data-lane="main"]`);
  await row.click();
  await qa.page.locator('.inventory-primary').click();
  await qa.page.waitForTimeout(120);
  const dropped=(await qa.fullState()).inventory.items.find(i=>i.id===item.id);
  assert.equal(dropped.location.kind,'ground','Actual UI drop leaves the same item on supported ground');
  await qa.capture(label('tab-live-dropped-item'));
  const near=qa.page.locator(`.inventory-item[data-item-id="${item.id}"][data-lane="nearby"]`);
  if(await near.getAttribute('aria-selected')!=='true')await near.click();
  await qa.page.locator('.inventory-primary').click();
  await qa.page.waitForTimeout(120);
  const retaken=(await qa.fullState()).inventory.items.find(i=>i.id===item.id);
  assert.equal(retaken.location.kind,'carried','Actual exchange re-takes the dropped item');
  assert.deepEqual({...retaken,location:null},{...item,location:null},'Taking a dropped item preserves source, quality, identity and charges');
  await qa.capture(label('same-item-retaken'));
  await qa.press('Tab',50);await qa.page.waitForTimeout(220);await qa.focus();
  qa.evidence.checks.push('Tab world remains live; one actual item dropped and re-taken via ordinary panel, no reroll or lifecycle change.');
}

async function routeCase() {
  const initial=await qa.fullState();
  qa.evidence.initialInventory=initial.inventory;
  assert.equal(initial.inventory.firstWeaponDiscovered,false,'All comparison runs start without first weapon discovery');
  const guide=SEA_ROUTE_GUIDES[scene];
  const nodes=[...initial.layout.kindlingNodes,...initial.layout.contaminantNodes];
  assert.equal(nodes.length,7);
  await searchNode(nodes.find(n=>n.id==='SS_near-kindling'));
  if(scene==='sea-open-channel') {
    await go(guide.observation);await qa.capture(label('safe-water-observation'));
    await qa.page.waitForTimeout(900);
  }
  for(const id of guide.nodeOrder.filter(id=>id!=='near-kindling')) {
    if(id==='foreign-remnant'&&loadout!=='bare'&&!handled.has('SS_listener')) {
      const hearing=(await qa.read()).snapshot.enemies.find(e=>e.id==='SS_listener');
      if(hearing)await go(hearing.position);
    }
    await searchNode(nodes.find(n=>n.id===`SS_${id}`));
  }
  await go(initial.layout.extractionPoint.position);
  await qa.capture(label('loaded-return'));
  await dropAndRetake();
  await qa.press('e',100);await qa.until(s=>s.snapshot.ended,'actual extraction',6000);
  await qa.page.waitForFunction(()=>window.__suspendedSea.getRecords().some(r=>r.gameplay.outcome==='extract'),null,{timeout:6000});
  await qa.capture(label('extracted'));
  const records=await qa.page.evaluate(()=>window.__suspendedSea.getRecords());
  const result=records.at(-1).gameplay;
  assert.equal(result.outcome,'extract');
  assert.equal((await qa.read()).snapshot.search.remaining,0,'All seven authored piles revealed');
  assert(result.finalInventory.run.returnedIds.length>0,'Real retrieved items were committed on extraction');
  qa.evidence.checks.push('All seven piles revealed, real retrieval and extraction committed; no requirement to take over-capacity items.');
}

async function shellUntil(predicate,name,timeout=13000) {
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline) {
    const state=await qa.fullState();if(predicate(state))return state;
    await qa.page.waitForTimeout(25);
  }
  throw Error(`Timeout waiting for ${name}`);
}

async function waterCase() {
  assert.equal(scene,'sea-open-channel');assert.equal(loadout,'melee');
  const initial=await qa.fullState(),node=initial.layout.contaminantNodes.find(n=>n.id==='SS_retreat-deposit');
  await searchNode(node);
  await go({x:790,y:477});await face({x:850,y:477});
  // Remain on the dry side of the lip, close enough to step into genuine residual water after hitting.
  await qa.move('x',812);await qa.capture(label('dry-side-before-water'));
  let ready=await shellUntil(s=>s.spatial.shell.canHit&&s.spatial.shell.coreActive&&s.spatial.shell.cycleTimeMs<7800,'fresh active core with enough remaining tail');
  const hpBefore=ready.snapshot.hp,hitsBefore=ready.spatial.shell.hitSequence,durability=(await qa.read()).frame.player.durability;
  await qa.press('Space',30);
  const struck=await shellUntil(s=>s.spatial.shell.hitSequence>hitsBefore,'real crowbar shell hit',3000);
  assert.equal((await qa.read()).frame.player.durability,durability-1,'Real shell contact costs one durability');
  // Do not capture before moving: screenshot latency would consume the 600ms residual window.
  await qa.press('d',380);
  const residual=await qa.fullState();
  qa.evidence.observations.push({label:'actual-residual-contact',state:residual});
  assert(residual.spatial.shell.committedHits>struck.spatial.shell.committedHits,'Stepping into actual residual spill causes a committed hit');
  assert.equal(residual.spatial.shell.lastContactRegion,'spill','This first hazard contact is side spill, not the vertical core');
  assert(residual.spatial.shell.lastContactAtMs-residual.spatial.shell.hitAtMs<600,'Residual hit really occurs before the authored diversion delay ends');
  assert.equal(residual.snapshot.hp,hpBefore-12,'Physical residual water deals the authored 12 HP despite passive pollution resistance');
  assert((await qa.read()).frame.tools.siphonRemainingMs>0,'Actual water damage triggers the equipped passive');
  await qa.capture(label('residual-water-real-injury'));
  await shellUntil(s=>s.spatial.shell.mode==='diverted'&&!s.spatial.shell.spillActive&&s.spatial.shell.coreActive,'side water ends while vertical core remains');
  const coreBefore=(await qa.read()).snapshot.hp;
  await qa.move('x',890);
  const core=await shellUntil(s=>s.snapshot.hp<coreBefore&&s.spatial.shell.lastContactRegion==='core','diverted vertical core still hurts',4000);
  assert.equal(coreBefore-core.snapshot.hp,12,'Core contact retains full physical damage while siphon is active');
  await qa.capture(label('diverted-core-real-injury'));
  await qa.press('Escape',50);await qa.until(s=>s.paused,'pause amid actual water/passive');
  const paused=await qa.fullState();await qa.page.waitForTimeout(400);const afterPause=await qa.fullState();
  assert.equal(afterPause.snapshot.elapsedMs,paused.snapshot.elapsedMs);
  assert.deepEqual(afterPause.spatial.shell,paused.spatial.shell);
  assert.deepEqual(afterPause.spatial.water,paused.spatial.water);
  assert.deepEqual(afterPause.inventory,paused.inventory);
  await qa.capture(label('active-water-paused'));await qa.press('Escape',50);
  await shellUntil(s=>s.spatial.shell.mode==='returning','natural shell recovery',6000);
  await qa.capture(label('natural-returning'));
  await shellUntil(s=>s.spatial.shell.cycle>ready.spatial.shell.cycle&&!s.spatial.shell.canHit,'new quiet cycle before another full warning',6000);
  await qa.capture(label('quiet-after-return'));
  // Deliberately remain inside the real next falling-water cycles. No forced HP or time changes.
  const prior=await qa.fullState(),carriedIds=prior.inventory.items.filter(i=>i.location.kind==='carried').map(i=>i.id);
  await qa.until(s=>s.snapshot.ended,'death from actual repeated water contact',45000,100);
  await qa.page.waitForFunction(()=>window.__suspendedSea.getRecords().some(r=>r.gameplay.outcome==='death'),null,{timeout:6000});
  const dead=await qa.fullState();assert.equal(dead.snapshot.hp,0);
  assert(carriedIds.every(id=>!dead.inventory.items.some(i=>i.id===id)),'Death removes all brought equipment and actual acquired finds');
  assert.deepEqual(dead.inventory.run.returnedIds,[],'Death returns no carried finds');
  const frozen=dead.spatial.elapsedMs;await qa.page.waitForTimeout(500);
  assert.equal((await qa.fullState()).spatial.elapsedMs,frozen,'Death freezes water and shell runtime');
  await qa.capture(label('real-water-death-and-loss'));
  qa.evidence.checks.push('Actual shell hit, residual side-water injury, still-dangerous redirected core, passive trigger without physical reduction, active pause, natural return and next warning, genuine water death/full inventory loss.');
}

let failure;
try {
  await qa.open();await qa.start();await qa.recordAudio();
  const initial=await qa.fullState();map=initial.layout.tileMap;
  bounds=[initial.spatial.water.outline,initial.spatial.shell.spillOutline].map(points=>({
    left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),
    top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))}));
  await qa.capture(label('start'));
  if(testCase==='route')await routeCase();
  else if(testCase==='water')await waterCase();
  else throw Error(`Unknown actual-input case: ${testCase}`);
}catch(error){failure=error;console.error(String(error.stack??error));}
const result=await qa.finish(failure);
if(!result.passed)process.exitCode=1;
