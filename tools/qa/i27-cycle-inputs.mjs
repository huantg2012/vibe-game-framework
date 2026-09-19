/** Shared real-input base navigation for the I27 recorded journeys. */
export function createCycleInputs(page, driver) {
 async function basePosition(){return page.evaluate(()=>({...window.__game.scene.getScene('PurificationScene').player.getPosition()}));}
 async function baseTo(point){
  let last=null,stuck=0;
  for(let i=0;i<80;i++){
   const p=await basePosition(),dx=point.x-p.x,dy=point.y-p.y;
   if(Math.hypot(dx,dy)<3)return {ok:true,pos:p};
   stuck=last&&Math.hypot(last.x-p.x,last.y-p.y)<.3?stuck+1:0;
   if(stuck>5)return {ok:false,reason:'blocked-base-path',pos:p,target:point};
   last=p;const keys=[];if(Math.abs(dx)>2)keys.push(dx>0?'d':'a');if(Math.abs(dy)>2)keys.push(dy>0?'s':'w');
   await driver.hold(keys,Math.max(50,Math.min(250,Math.hypot(dx,dy)/80*1000)));
  }
  return {ok:false,reason:'base-time-budget',pos:await basePosition()};
 }
 async function depart(label){
  const p=await basePosition();for(const goal of [{x:272,y:p.y},{x:272,y:112},{x:248,y:96},{x:224,y:88}]){const r=await baseTo(goal);if(!r.ok)return r;}
  await driver.press('e');await page.waitForTimeout(350);await driver.snap(label+'-prepare');
  await driver.press('Shift+Enter');await page.waitForTimeout(1000);
  const s=await driver.state();await driver.snap(label+'-entry');if(s.scene==='rift'&&s.active&&!s.ended){await driver.press('Escape');await page.waitForTimeout(250);}
  return {ok:s.scene==='rift'&&!s.ended,state:await driver.state()};
 }
 async function returnBase(label){
  let s=await driver.state();if(s.scene==='rift'&&s.paused)await driver.press('Escape');
  await driver.press('r');await page.waitForTimeout(850);await driver.snap(label+'-impact');
  if((await page.locator('body').innerText()).includes('冲击之后')){await driver.press('Enter');await page.waitForTimeout(450);}
  s=await driver.state();await driver.ledger(label+'-base');return {ok:s.scene==='base',state:s};
 }
 async function searchNode(node,label){
  let s=await driver.state();if(s.scene==='rift'&&s.paused){await driver.press('Escape');await page.waitForTimeout(250);}
  const r=await driver.go(node.pos,30000);if(!r.ok)return r;
  await driver.hold(['e'],1350);await driver.snap(label);s=await driver.state();if(s.active&&!s.ended){await driver.press('Escape');await page.waitForTimeout(250);}
  return {ok:!!s.nodes?.find(n=>n.id===node.id)?.collected,state:await driver.state()};
 }
 return {baseTo,depart,returnBase,searchNode};
}
