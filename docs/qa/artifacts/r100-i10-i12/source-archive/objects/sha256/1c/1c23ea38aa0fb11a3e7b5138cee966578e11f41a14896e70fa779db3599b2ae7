import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createJourneyDriver } from '../../../../../../tools/qa/i27-journey-driver.mjs';
const {chromium}=await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const root=path.resolve('public/assets/items/contaminant-catalog/context/browser');
const out=path.join(root,'drop-current-final');fs.mkdirSync(out,{recursive:true});
const fixture='docs/qa/artifacts/iteration-28/browser/natural-current/03-carry.storage.json';
const raw=fs.readFileSync(fixture), values=JSON.parse(raw);
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const sourceFiles=fs.readdirSync('src/art').filter(n=>n.startsWith('contaminant-catalog')).map(name=>{
  const file=path.join('src/art',name);return {file,mtime:fs.statSync(file).mtime.toISOString(),sha256:hash(fs.readFileSync(file))};
});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
  const context=await browser.newContext({viewport:{width:1440,height:960}});
  await context.addInitScript(data=>{if(sessionStorage.getItem('i28-capture-init'))return;sessionStorage.setItem('i28-capture-init','1');localStorage.clear();for(const[k,v]of Object.entries(data))localStorage.setItem(k,v);},values);
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push({kind:'pageerror',message:e.stack??String(e)}));
  page.on('console',m=>{if(m.type()==='error')errors.push({kind:'console',message:m.text()});});
  const driver=createJourneyDriver(page,out), loadedAt=new Date().toISOString();
  await page.goto('http://127.0.0.1:3017/');
  await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
  await driver.press('Enter');
  await page.waitForFunction(()=>window.__game?.scene.isActive('RiftScene'));
  await page.waitForTimeout(400);
  const browserSource=await page.evaluate(async()=>{const m=await import('/src/art/contaminant-catalog-icons.ts');const p=m.catalogWorldPixels({kind:'shell',appearanceId:'ceramic_seal'});return {width:p.width,height:p.height,data:Array.from(p.data)};});
  fs.writeFileSync(path.join(out,'browser-world-source.rgba'),Buffer.from(browserSource.data));
  await driver.press('Tab');await page.getByRole('button',{name:'放在脚边',exact:true}).waitFor();
  await driver.snap('01-bag-before-drop');
  await page.getByRole('button',{name:'放在脚边',exact:true}).click();await page.waitForTimeout(150);
  await driver.snap('02-drop-committed-bag');
  await driver.press('Escape');await driver.hold(['w'],450);
  await driver.snap('06-drop-world');await driver.press('Escape');
  await driver.snap('04-paused-drop');
  const measurement=await page.evaluate(()=>{
    const s=window.__game.scene.getScene('RiftScene'),cam=s.cameras.main,canvas=window.__game.canvas,r=canvas.getBoundingClientRect();
    return {paused:s.scene.isPaused(),elapsedMs:s.runController.getElapsedMs(),player:{...s.player.getPosition()},camera:{zoom:cam.zoom,scrollX:cam.scrollX,scrollY:cam.scrollY},canvas:{width:canvas.width,height:canvas.height,left:r.left,top:r.top,cssWidth:r.width,cssHeight:r.height},worldPixelScale:cam.zoom*r.width/canvas.width,
      ground:[...s.fieldInventory.visuals].map(([id,v])=>{const q=cam.matrix.transformPoint(v.x-cam.scrollX,v.y-cam.scrollY);return {id,world:{x:v.x,y:v.y},visible:v.visible,alpha:v.alpha,visibility:s.visibility.getVisibilityAt({x:v.x,y:v.y}),logicalScreen:{x:q.x,y:q.y},screen:{x:r.left+q.x*r.width/canvas.width,y:r.top+q.y*r.height/canvas.height},commandBuffer:[...v.commandBuffer]};}),
      nearby:s.fieldInventory.getNearby().map(i=>({id:i.id,location:i.location,catalog:i.contaminant?.catalog}))};
  });
  if(!measurement.paused||measurement.ground.length!==1)throw Error('Expected one committed ground object in paused scene');
  const oldRoot=await page.evaluate(()=>{const r=document.getElementById('dom-ui-root'),v=r.style.visibility;r.style.visibility='hidden';return v;});
  await page.waitForTimeout(100);await page.screenshot({path:path.join(out,'08-paused-world-only-diagnostic.png')});
  await page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene');for(const v of s.fieldInventory.visuals.values())v.visible=false;});
  await page.waitForTimeout(100);await page.screenshot({path:path.join(out,'09-paused-background-only-diagnostic.png')});
  await page.evaluate(old=>{const s=window.__game.scene.getScene('RiftScene');for(const v of s.fieldInventory.visuals.values())v.visible=true;document.getElementById('dom-ui-root').style.visibility=old;},oldRoot);
  fs.writeFileSync(path.join(out,'drop-measurement.json'),JSON.stringify(measurement,null,2));
  const source={width:browserSource.width,height:browserSource.height,rgbaSha256:hash(Buffer.from(browserSource.data)),module:'/src/art/contaminant-catalog-icons.ts',ref:{kind:'shell',appearanceId:'ceramic_seal'}};
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({status:'CAPTURED',loadedAt,completedAt:new Date().toISOString(),url:page.url(),fixture,fixtureSha256:hash(raw),sourceFiles,browserSource:source,errors,disclosure:'Fresh isolated context, original fixture. Real Enter/Tab/click Drop/Esc/W/Esc inputs. Paired diagnostic temporarily hides DOM overlay and ground Graphics only, restored afterward; no game-domain state or source mutations.',measurementFile:'drop-measurement.json'},null,2));
  console.log(JSON.stringify({out,source,ground:measurement.ground.map(({commandBuffer,...rest})=>rest),worldPixelScale:measurement.worldPixelScale,errors}));
}finally{await browser.close();}
