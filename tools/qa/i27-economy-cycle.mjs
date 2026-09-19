/** I27 natural economy play. Reads state for deliberate choices; performs only
 * real input. Full-map routes are disclosed by the journey driver. */
export function createEconomyCycle(page, driver, inputs) {
 const readSave=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('coh-save-v1')));
 async function repair(moduleId, amount, label) {
  const p=(await driver.state()).player;
  const targets={CORE:[{x:272,y:p.y},{x:272,y:215},{x:224,y:215}],STORAGE:[{x:272,y:p.y},{x:272,y:215},{x:313,y:201}],PURIFIER:[{x:272,y:p.y},{x:272,y:277},{x:224,y:277}]};
  for(const goal of targets[moduleId]){const r=await inputs.baseTo(goal);if(!r.ok)return r;}
  await driver.press('e');await page.waitForTimeout(250);
  if(!(await driver.state()).panels?.allocation)return {ok:false,reason:'repair-panel-not-open'};
  for(let i=0;i<amount;i++)await driver.press('ArrowRight',50);
  await driver.snap(label+'-repair-selected');await driver.press('Enter');await page.waitForTimeout(1100);
  await driver.ledger(label+'-repaired');return {ok:true,save:await readSave()};
 }
 async function forage(label) {
  const seen=new Set(),results=[];
  for(let step=0;step<6;step++){
   const s=await driver.state();if(s.scene!=='rift'||s.ended)break;
   if(s.hp<55||s.chaos>100||s.carried>=11)break;
   const nodes=s.nodes.filter(n=>!n.collected&&!seen.has(n.id)&&n.kind==='kindling');
   const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
   // Early search near landing; afterwards prefer useful income along the exit direction.
   nodes.sort((a,b)=>(dist(s.pos,a.pos)+.35*dist(a.pos,s.exit.position)-(step>=2?a.value*48:0))-(dist(s.pos,b.pos)+.35*dist(b.pos,s.exit.position)-(step>=2?b.value*48:0)));
   const n=nodes[0];if(!n)break;seen.add(n.id);
   const r=await inputs.searchNode(n,label+'-'+n.id);results.push({node:n,...r});
   if(!r.ok){const now=await driver.state();if(now.active&&!now.ended){await driver.press('Escape');await page.waitForTimeout(250);}break;}
  }
  return results.map(r=>({id:r.node.id,ok:r.ok,hp:r.state?.hp,chaos:r.state?.chaos,carried:r.state?.carried,reason:r.reason}));
 }
 async function extract(label){
  let s=await driver.state();if(s.ended)return {ok:false,reason:'already-ended',state:s};
  if(s.paused){await driver.press('Escape');await page.waitForTimeout(250);}
  const r=await driver.go(s.exit.position,55000);
  if(r.ok){await driver.press('e');await page.waitForTimeout(250);await driver.snap(label+'-extracted');return {ok:(await driver.state()).ended,state:await driver.state()};}
  s=await driver.state();if(s.active&&!s.ended){await driver.press('Escape');await page.waitForTimeout(250);}
  await driver.snap(label+'-extract-failed');return r;
 }
 return {repair,forage,extract,readSave};
}
