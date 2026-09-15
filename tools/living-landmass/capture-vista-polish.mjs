/** Diagnostic actual-camera captures; does not grade gameplay or aesthetic acceptance. */
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const directory=path.resolve(process.env.ARTIFACT_DIR??`docs/qa/artifacts/iteration-23/vista-polish/${new Date().toISOString().replace(/[:.]/g,'-')}`);
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const report={scope:'Diagnostic camera and visible composition only',errors:[],observations:[]};
page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
async function capture(name){const state=await page.evaluate(()=>window.__livingLandmassStage.getState());await page.locator('canvas[data-living-stage]').screenshot({path:path.join(directory,name+'.png')});report.observations.push({name,state});console.log(name,JSON.stringify({player:state.player,camera:state.camera}));}
try{
 for(const angle of [28,32,36]){
  await page.goto(`${process.env.GAME_URL??'http://127.0.0.1:3011'}/living-landmass-stage.html?camera=${angle}`);
  await page.waitForFunction(()=>window.__livingLandmassStage?.getState().ready,null,{timeout:30000});await page.waitForTimeout(350);await capture(`camera-${angle}`);
 }
 await page.goto(`${process.env.GAME_URL??'http://127.0.0.1:3011'}/living-landmass-stage.html`);
 await page.waitForFunction(()=>window.__livingLandmassStage?.getState().ready,null,{timeout:30000});await page.locator('#game-container').click({position:{x:20,y:20}});
 for(const [keys,ms,name] of [[['w'],2200,'near-cliff'],[['s'],2200,'return'],[['d'],7500,'right-walk']]){
  for(const key of keys)await page.keyboard.down(key);await page.waitForTimeout(ms);for(const key of keys)await page.keyboard.up(key);await page.waitForTimeout(180);await capture(name);
 }
}catch(error){report.failure=String(error);console.error(error);process.exitCode=1;}
finally{await writeFile(path.join(directory,'diagnostic.json'),JSON.stringify(report,null,2));await context.close();await browser.close();console.log(directory);}
