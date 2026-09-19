/** Diagnostic play recorder. Reads full geometry for routing, then drives only
 * genuine keyboard events. This is NOT novice-navigation or autonomous-user
 * evidence. No state setters, grants, teleport, forced outcome or game clock. */
import fs from 'node:fs';
import path from 'node:path';
export function createJourneyDriver(page, out) {
  fs.mkdirSync(out, {recursive:true});
  const log = value => fs.appendFileSync(path.join(out,'journey.jsonl'),JSON.stringify({at:new Date().toISOString(),...value})+'\n');
  async function state() {
    return page.evaluate(()=>{
      const game=window.__game;
      if(!game)throw Error('Same-source diagnostic build required');
      const base=game.scene.getScene('PurificationScene'), rift=game.scene.getScene('RiftScene');
      const baseLive=base?.scene.isActive()||base?.scene.isPaused();
      if(baseLive)return {scene:'base',active:base.scene.isActive(),paused:base.scene.isPaused(),...base.probeJourneyState?.()};
      if(rift?.player&&rift?.runController&&rift?.chaos&&rift?.combat&&rift?.search&&rift?.extraction)return {scene:'rift',active:rift.scene.isActive(),paused:rift.scene.isPaused(),ended:rift.runController.isRunEnded(),pos:{...rift.player.getPosition()},hp:rift.combat.getHealth(),chaos:rift.chaos.getValue(),carried:rift.search.getCarriedKindling(),seed:rift.layoutDebug,elapsedMs:rift.runController.getElapsedMs(),exit:rift.extraction.extractionPoint,nodes:rift.search.nodes.map(n=>({id:n.id,kind:n.kind,pos:n.position,tier:n.tier,value:n.value,collected:n.collected}))};
      return {scene:'menu',scenes:game.scene.scenes.map(s=>({key:s.scene.key,active:s.scene.isActive(),paused:s.scene.isPaused()}))};
    });
  }
  async function press(key, delay=90){log({event:'key',key,delay});await page.keyboard.press(key,{delay});}
  async function hold(keys,ms){log({event:'hold',keys,ms});try{for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(ms);}finally{for(const k of keys)await page.keyboard.up(k);}await page.waitForTimeout(35);}
  async function snap(label){const s=await state();await page.screenshot({path:path.join(out,label+'.png')});const text=await page.locator('body').innerText();log({event:'snapshot',label,state:s,text});return {state:s,text};}
  async function ledger(label){const storage=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));fs.writeFileSync(path.join(out,label+'.storage.json'),JSON.stringify(storage,null,2));const parsed=Object.entries(storage).flatMap(([key,raw])=>{try{return [{key,value:JSON.parse(raw)}]}catch{return []}});log({event:'ledger',label,state:await state(),records:parsed});return parsed;}
  async function go(target,maxMs=45000){
    const initial=await state();
    if(initial.scene!=='rift'||!initial.active||initial.ended)return {ok:false,reason:'not-running',state:initial};
    const data=await page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene'),g=s.formFloorGrid;return {cols:g.cols,rows:g.rows,size:g.tileSize,walk:Array.from({length:g.cols*g.rows},(_,i)=>g.isWalkable(i%g.cols,Math.floor(i/g.cols))),start:{...s.player.getPosition()}}});
    const {cols,rows,size,walk,start}=data,idx=p=>Math.floor(p.y/size)*cols+Math.floor(p.x/size),begin=idx(start),end=idx(target);
    const q=[begin],prev=new Map([[begin,-1]]);
    for(let n=0;n<q.length&&!prev.has(end);n++){const i=q[n],x=i%cols,y=Math.floor(i/cols);for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,j=yy*cols+xx;if(xx<0||yy<0||xx>=cols||yy>=rows||!walk[j]||prev.has(j))continue;prev.set(j,i);q.push(j)}}
    if(!prev.has(end))return {ok:false,reason:'no-path',target};
    const raw=[];for(let i=end;i!==-1;i=prev.get(i))raw.push({x:(i%cols+.5)*size,y:(Math.floor(i/cols)+.5)*size});raw.reverse();
    const points=[raw[0]];for(let i=1;i<raw.length-1;i++){const a=raw[i-1],b=raw[i],c=raw[i+1];if(b.x-a.x!==c.x-b.x||b.y-a.y!==c.y-b.y)points.push(b)}points.push(raw.at(-1));
    log({event:'omniscient-route',target,points,disclosure:'Read-only full floor map; real input only. Not novice navigation.'});
    const started=Date.now();let last=null,stuck=0;
    for(const p of points)for(let step=0;step<100;step++){
      const s=await state();if(s.scene!=='rift'||s.ended||!s.active)return {ok:false,reason:'run-stopped',state:s};
      if(Date.now()-started>maxMs)return {ok:false,reason:'time-budget',state:s};
      const dx=p.x-s.pos.x,dy=p.y-s.pos.y;if(Math.hypot(dx,dy)<3)break;
      stuck=last&&Math.hypot(last.x-s.pos.x,last.y-s.pos.y)<.4?stuck+1:0;
      if(stuck>8){log({event:'blocked-route',goal:p,state:s});return {ok:false,reason:'physical-obstacle',state:s,goal:p};}last=s.pos;
      const keys=[];if(Math.abs(dx)>2)keys.push(dx>0?'d':'a');if(Math.abs(dy)>2)keys.push(dy>0?'s':'w');
      await hold(keys,Math.max(50,Math.min(260,Math.hypot(dx,dy)/80*1000)));
    }
    const final=await state();
    if(final.scene!=='rift'||Math.hypot(final.pos.x-target.x,final.pos.y-target.y)>5)return {ok:false,reason:'target-not-reached',state:final};
    const result={ok:true,state:final};log({event:'arrived',target,...result});return result;
  }
  return {state,press,hold,snap,ledger,go,log};
}
