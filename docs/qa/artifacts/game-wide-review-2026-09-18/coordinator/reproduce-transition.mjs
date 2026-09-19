import fs from 'node:fs';
const root='/Users/yilungao/coh/docs/qa/artifacts/game-wide-review-2026-09-18/coordinator';
export async function run(browser){
 const storage=JSON.parse(fs.readFileSync(root+'/diag-fourth-return.storage.json','utf8'));
 const context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1});
 await context.addInitScript(values=>{for(const [k,v]of Object.entries(values))localStorage.setItem(k,v);},storage);
 const p=await context.newPage();const errors=[],log=[];p.on('pageerror',e=>errors.push({message:String(e),stack:e.stack}));
 async function snap(label){await p.screenshot({path:root+'/repro-'+label+'.png'});log.push({time:new Date().toISOString(),label,text:await p.locator('body').innerText()});}
 async function hold(k,ms){await p.keyboard.down(k);await p.waitForTimeout(ms);await p.keyboard.up(k);await p.waitForTimeout(80);}
 try{
  await p.goto('http://127.0.0.1:3014/');await p.waitForTimeout(1500);await p.keyboard.press('Enter',{delay:100});await p.waitForTimeout(1700);
  await snap('restored-settled-base');await hold('w',520);await p.keyboard.press('e',{delay:100});await p.waitForTimeout(400);await snap('repair-before');
  await p.keyboard.press('ArrowRight',{delay:100});await p.keyboard.press('Enter',{delay:100});await p.waitForTimeout(450);await snap('repair-after');
  await hold('d',600);const y=await p.evaluate(()=>window.__game.scene.getScene('PurificationScene').player.getPosition().y);await hold('w',(y-64)/80*1000);await hold('a',600);
  await p.keyboard.press('e',{delay:100});await p.waitForTimeout(400);await p.getByText('凝滞的石块',{exact:true}).click();await p.getByRole('button',{name:'装到 工具 Q',exact:true}).click();await snap('equipped');
  await p.keyboard.press('Shift+Enter',{delay:100});await p.waitForTimeout(4000);await snap('after-departure');
  const state=await p.evaluate(()=>({scenes:window.__game.scene.getScenes(true).map(s=>s.scene.key),frame:window.__game.loop.frame}));
  const result={source:'Unmodified copy of real fourth return; same-source diagnostic build; normal menu/input only.',errors,log,state};fs.writeFileSync(root+'/transition-repro.json',JSON.stringify(result,null,2));return result;
 }catch(e){const result={errors,log,driverError:String(e)};fs.writeFileSync(root+'/transition-repro.json',JSON.stringify(result,null,2));return result;}
 finally{await context.close();}
}
