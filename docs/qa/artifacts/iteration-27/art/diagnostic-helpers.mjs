import fs from 'node:fs';
const root='/Users/yilungao/coh/docs/qa/artifacts/iteration-27/art';
function log(value){fs.appendFileSync(root+'/diagnostic-events.jsonl',JSON.stringify({time:new Date().toISOString(),...value})+'\n');}
export async function state(page){return page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene');return {scene:s.scene.key,active:s.scene.isActive(),ended:s.runController.isRunEnded(),pos:{...s.player.getPosition()},hp:s.combat.getHealth(),chaos:s.chaos.getValue(),carried:s.search.getCarriedKindling(),seed:s.layoutDebug,exit:s.extraction.extractionPoint,nodes:s.search.nodes.map(n=>({id:n.id,kind:n.kind,pos:n.position,tier:n.tier,value:n.value,collected:n.collected}))};});}
export async function snap(page,label){await page.screenshot({path:root+'/diag-'+label+'.png'});const s=await state(page);const text=await page.locator('body').innerText();log({event:'snapshot',label,state:s,text});return {state:s,text};}
export async function hold(page,keys,ms){log({event:'input',keys,ms});for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(ms);for(const k of keys)await page.keyboard.up(k);await page.waitForTimeout(45);}
export async function go(page,target,maxMs=45000){
 const data=await page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene');const g=s.formFloorGrid;return {cols:g.cols,rows:g.rows,size:g.tileSize,walk:Array.from({length:g.cols*g.rows},(_,i)=>g.isWalkable(i%g.cols,Math.floor(i/g.cols))),start:{...s.player.getPosition()}}});
 const {cols,rows,size,walk,start}=data;const idx=p=>Math.floor(p.y/size)*cols+Math.floor(p.x/size);const begin=idx(start),end=idx(target);
 const q=[begin],prev=new Map([[begin,-1]]);for(let n=0;n<q.length&&!prev.has(end);n++){const i=q[n],x=i%cols,y=Math.floor(i/cols);for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,j=yy*cols+xx;if(xx<0||yy<0||xx>=cols||yy>=rows||!walk[j]||prev.has(j))continue;prev.set(j,i);q.push(j)}}
 if(!prev.has(end))return {ok:false,reason:'no-path',target};
 const path=[];for(let i=end;i!==-1;i=prev.get(i))path.push({x:(i%cols+.5)*size,y:(Math.floor(i/cols)+.5)*size});path.reverse();
 const points=[path[0]];for(let i=1;i<path.length-1;i++){const a=path[i-1],b=path[i],c=path[i+1];if(b.x-a.x!==c.x-b.x||b.y-a.y!==c.y-b.y)points.push(b)}points.push(path[path.length-1]);
 log({event:'omniscient-route',target,points,disclosure:'Read-only full map route; real keyboard input, no teleport, invulnerability, forced results or resource changes. Not novice-navigation evidence.'});
 const began=Date.now();let stuck=0,last=null;
 for(const goal of points){for(let step=0;step<100;step++){
   const s=await state(page);if(s.ended)return {ok:false,reason:'run-ended',state:s};if(Date.now()-began>maxMs)return {ok:false,reason:'time-budget',state:s};
   const dx=goal.x-s.pos.x,dy=goal.y-s.pos.y;if(Math.hypot(dx,dy)<3)break;
   if(last&&Math.hypot(last.x-s.pos.x,last.y-s.pos.y)<.4)stuck++;else stuck=0;
   if(stuck>8){log({event:'route-stuck',goal,state:s});return {ok:false,reason:'collision',goal,state:s};}last=s.pos;
   const keys=[];if(Math.abs(dx)>2)keys.push(dx>0?'d':'a');if(Math.abs(dy)>2)keys.push(dy>0?'s':'w');
   await hold(page,keys,Math.max(55,Math.min(260,Math.hypot(dx,dy)/80*1000)));
 }}const result={ok:true,state:await state(page)};log({event:'route-arrived',...result});return result;
}
