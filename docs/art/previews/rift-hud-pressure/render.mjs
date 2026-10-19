import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.COH_PLAYWRIGHT_MODULE ?? path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out=path.dirname(fileURLToPath(import.meta.url));
const browser=await chromium.launch({headless:true,executablePath:process.env.COH_CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1100,height:1060},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(new URL('/docs/art/previews/rift-hud-pressure/',process.env.COH_QA_BASE_URL ?? 'http://127.0.0.1:3027').href);
 await page.waitForFunction(()=>!!window.__hudArt);
 const comparison=await page.locator('#comparison').evaluate(c=>c.toDataURL('image/png'));
 await fs.writeFile(out+'/comparison.png',Buffer.from(comparison.split(',')[1],'base64'));
 const samples=[];
 for(let i=0;i<3;i++){
  await page.evaluate(i=>window.__hudArt.renderPreset(i),i);
  await page.locator('#scene').screenshot({path:out+'/scene-'+i+'.png'});
  samples.push(await page.evaluate(()=>{
   const hud=document.querySelector('#hud'),g=hud.getContext('2d');
   const backdrop=document.createElement('canvas');backdrop.width=960;backdrop.height=640;
   const b=backdrop.getContext('2d');b.drawImage(document.querySelector('.scene img'),0,0);
   const luminance=rgb=>rgb.reduce((sum,v,i)=>{v/=255;return sum+[.2126,.7152,.0722][i]*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4);},0);
   return [0,18,36].map(y=>{
    const d=g.getImageData(28,y,hud.width-28,16).data,points=[],colors=new Set();let minContrast=Infinity;
    for(let i=0;i<d.length/4;i++)if(d[i*4+3]){
     const p={x:28+i%(hud.width-28),y:Math.floor(i/(hud.width-28))};points.push(p);
     const bg=b.getImageData(960-24-hud.width+p.x,24+y+p.y,1,1).data;
     const foreground=luminance([d[i*4],d[i*4+1],d[i*4+2]]),background=luminance(Array.from(bg).slice(0,3));
     minContrast=Math.min(minContrast,(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05));
     colors.add('#'+[d[i*4],d[i*4+1],d[i*4+2]].map(v=>v.toString(16).padStart(2,'0')).join(''));
    }
    return {right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y)),colors:[...colors].sort(),minContrast};
   });
  }));
 }
 for(const [i,rows] of samples.entries()){
  assert(rows.every(r=>r.right===109 && r.bottom===12));
  assert.deepEqual(rows[0].colors,['#b89040']);
  assert.deepEqual(rows[1].colors,['#8a8f96',['#b3baae','#bd9c68','#bf965b'][i]]);
  assert.deepEqual(rows[2].colors,[['#b3baae','#b9857a','#bd685e'][i]]);
  assert(rows.every(r=>r.minContrast>=4.5));
 }
 await page.locator('#weight').fill('7.5');assert((await page.evaluate(()=>window.__hudArt.getState())).weight===7.5);
 await page.locator('#assimilation').fill('32');assert((await page.evaluate(()=>window.__hudArt.getState())).assimilation===32);
 await page.locator('[data-preset="1"]').click();
 assert.deepEqual(errors,[]);
 await fs.writeFile(out+'/art-check.json',JSON.stringify({pass:true,scope:'Text HUD preview only: continuous muted cost colors, aligned rows, numeric contrast >=4.5 against captured scene, independent controls, no page errors. Not production integration or human visual approval.',errors,samples},null,2)+'\n');
 console.log(JSON.stringify({pass:true,states:samples.length}));
}finally{await browser.close();}
