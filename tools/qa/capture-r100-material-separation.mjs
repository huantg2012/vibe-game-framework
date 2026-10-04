/** Real native keyboard collision and normal-FOV visual evidence. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(process.env.PLAYWRIGHT_MODULE)
 : await import('playwright').catch(()=>import(pathToFileURL(path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href));
const phase = process.env.QA_PHASE ?? 'before';
const out = path.join(root,`docs/qa/artifacts/r100-material-separation/${phase}`); await mkdir(out, { recursive: true });
const report = { phase, at: new Date().toISOString(), scope: 'Controlled legal starts, actual native keyboard facing/movement and finite normal FOV. Geometry diagnostic is not an art approval. Not natural complete-run traversal.', server:process.env.GAME_URL??'http://127.0.0.1:3058', sources: {}, cases: [], errors: [] };
for (const file of ['src/systems/r100-world/surface-renderer.ts','src/generation/world-study/native-volume-geometry.ts','src/dev/rift-r100-masters/world.ts','src/systems/r100-world/painted-material.ts','src/generated/r100-materials.ts','data/rift-master-materials.csv','public/assets/r100-materials/slab-solid-source.png','public/assets/r100-materials/fibre-solid-source.png','public/assets/r100-materials/shell-solid-source.png']) report.sources[file] = createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');
const executablePath=process.env.CHROME_EXECUTABLE??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined);
const browser = await chromium.launch({ headless: true,...(executablePath?{executablePath}:{}) });
const page = await browser.newPage({ viewport: { width: 1340, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', error => report.errors.push(String(error)));
async function load(family, grade) {
 await page.goto(`${process.env.GAME_URL ?? 'http://127.0.0.1:3058'}/rift-r100-masters.html?family=${family}&grade=${grade}&seed=20261002`);
 await page.waitForFunction(() => { try { return JSON.parse(document.querySelector('#diagnostics').textContent).runtime.running; } catch { return false; } }, null, { timeout: 60000 });
 await page.locator('#pixel').click();
}
async function place(point, keys) {
 await page.evaluate(async point => {
  const { audioManager }=await import('/src/managers/audio-manager.ts'); const { TileGrid }=await import('/src/systems/tile-grid.ts'); const { bodyHasSupport }=await import('/src/systems/ai/physical-grid.ts');
  const s=audioManager.game.scene.getScene('RiftScene');if(!bodyHasSupport(new TileGrid(s.devRuntime.world.layout.tileMap),point,10,10))throw new Error('Illegal controlled start');s.probePlacePlayer(point.x,point.y);
 },point);
 await page.locator('#game-container').focus();for(const key of keys)await page.keyboard.down(key);await page.waitForTimeout(130);for(const key of keys)await page.keyboard.up(key);
 await page.evaluate(async point=>{const {audioManager}=await import('/src/managers/audio-manager.ts');audioManager.game.scene.getScene('RiftScene').probePlacePlayer(point.x,point.y);},point);await page.waitForTimeout(250);
}
async function sample(){return page.evaluate(async()=>{const{audioManager}=await import('/src/managers/audio-manager.ts');const s=audioManager.game.scene.getScene('RiftScene');return{probe:s.probeBuildLabState(),presentation:s.devRuntime.snapshot(),camera:{x:s.cameras.main.scrollX,y:s.cameras.main.scrollY,zoom:s.cameras.main.zoom}};});}
async function nativeScreenshot(name){const box=await page.locator('#game-container canvas').boundingBox();assert(box&&Math.abs(box.width-960)<.1&&Math.abs(box.height-640)<.1,'native canvas must remain 960x640');await page.screenshot({clip:box,path:path.join(out,name)});}
async function capturePair(id){
 await page.locator('#mode').selectOption('normal');await page.waitForTimeout(80);await nativeScreenshot(`${id}-normal.png`);
 await page.locator('#mode').selectOption('geometry');await page.waitForTimeout(80);await nativeScreenshot(`${id}-geometry.png`);await page.locator('#mode').selectOption('normal');
}
async function directionalSeat(direction){return page.evaluate(async direction=>{
 const{audioManager}=await import('/src/managers/audio-manager.ts');const{TileGrid}=await import('/src/systems/tile-grid.ts');const{TileType}=await import('/src/types/game-types.ts');const{bodyHasSupport,bodyDisplacementFraction}=await import('/src/systems/ai/physical-grid.ts');
 const s=audioManager.game.scene.getScene('RiftScene'),w=s.devRuntime.world,g=new TileGrid(w.layout.tileMap),mesh=w.meshes.find(m=>w.definition.instances.find(i=>i.id===m.spec.id)?.role==='solid');
 if(!mesh)return{unavailable:'No solid object in this definition'};
 const length=Math.hypot(direction.x,direction.y),ox=direction.x/length,oy=direction.y/length,choices=[],offset=direction.offset;
 for(let row=1;row<g.rows-1;row++)for(let col=1;col<g.cols-1;col++){
  if(g.getTile(col,row)!==TileType.WALL)continue;const x=(col+.5)*g.tileSize,y=(row+.5)*g.tileSize;
  if(w.raster.objectId[Math.floor(y)*w.raster.width+Math.floor(x)]!==mesh.spec.id)continue;
  const along=(x-mesh.spec.x)*ox+(y-mesh.spec.y)*oy;if(along<0)continue;
  const point={x:x+ox*offset,y:y+oy*offset};if(!bodyHasSupport(g,point,10,10))continue;
  const f=bodyDisplacementFraction(g,point,10,10,-ox*112,-oy*112);if(f<=.07||f>=.8)continue;
  const hit={x:point.x-ox*112*f,y:point.y-oy*112*f},past={x:hit.x-ox*.25,y:hit.y-oy*.25};let found=null,voidHit=false;
  for(let yy=Math.floor((past.y-10+1e-6)/g.tileSize);yy<=Math.floor((past.y+10-1e-6)/g.tileSize);yy++)for(let xx=Math.floor((past.x-10+1e-6)/g.tileSize);xx<=Math.floor((past.x+10-1e-6)/g.tileSize);xx++){
   const tile=g.getTile(xx,yy);if(tile===TileType.VOID)voidHit=true;if(tile===TileType.WALL){const qx=(xx+.5)*g.tileSize,qy=(yy+.5)*g.tileSize;if(w.raster.objectId[Math.floor(qy)*w.raster.width+Math.floor(qx)]===mesh.spec.id)found={x:qx,y:qy};}
  }
  if(voidHit||!found)continue;let open=true;for(let d=0;d<offset;d+=4)if(!w.matterAt(point.x-ox*d,point.y-oy*d)){open=false;break;}if(!open)continue;
  const perpendicular=Math.abs((x-mesh.spec.x)*oy-(y-mesh.spec.y)*ox);
  choices.push({point,edge:found,expectedContact:hit,distanceToContact:f*112,standoff:offset,objectId:mesh.spec.id,score:along-perpendicular*.65,inward:{x:-ox,y:-oy}});
 }
 choices.sort((a,b)=>b.score-a.score);return choices[0]??{unavailable:`No tested ${offset}px-offset legal 20px-body start reaches this object from this direction without VOID first`};
},{...direction,offset:Number(process.env.QA_STANDOFF??64)});}
async function movementSample(){return page.evaluate(async()=>{
 const{audioManager}=await import('/src/managers/audio-manager.ts');const{TileGrid}=await import('/src/systems/tile-grid.ts');const{bodyHasSupport,bodyDisplacementFraction}=await import('/src/systems/ai/physical-grid.ts');
 const s=audioManager.game.scene.getScene('RiftScene'),body=s.player.getSprite().body,g=new TileGrid(s.devRuntime.world.layout.tileMap),p=s.player.getPosition();
 return{...s.probeBuildLabState(),actualSupport:bodyHasSupport(g,p,10,10),velocity:{x:body.velocity.x,y:body.velocity.y},blocked:{...body.blocked},touching:{...body.touching}};
});}
try {
 for(const grade of process.env.QA_ONLY?[]:['medium','severe']) {
  await load('folded-slab',grade);
  let seat = await page.evaluate(async()=>{
   const{audioManager}=await import('/src/managers/audio-manager.ts');const{TileGrid}=await import('/src/systems/tile-grid.ts');const{TileType}=await import('/src/types/game-types.ts');const{bodyHasSupport}=await import('/src/systems/ai/physical-grid.ts');
   const s=audioManager.game.scene.getScene('RiftScene'),w=s.devRuntime.world,g=new TileGrid(w.layout.tileMap),list=[];
   for(let row=1;row<g.rows-1;row++)for(let col=1;col<g.cols-1;col++){
    if(g.getTile(col,row)!==TileType.WALL||g.getTile(col,row+1)!==TileType.FLOOR)continue;
    const x=(col+.5)*g.tileSize,y=(row+1)*g.tileSize,point={x,y:y+60};if(!bodyHasSupport(g,point,10,10))continue;
    list.push({point,edge:{x,y},score:Math.abs(x-w.meshes[0].spec.x)+Math.abs(y-w.meshes[0].bounds.maxY)});
   }list.sort((a,b)=>a.score-b.score);if(!list[0])throw Error('No south observation seat');return list[0];
  });
  if(phase!=='before')seat=JSON.parse(await readFile(path.join(root,'docs/qa/artifacts/r100-material-separation/before/report.json'),'utf8')).cases.find(c=>c.grade===grade).seat;
  await place(seat.point,['w']);await capturePair(`folded-slab-${grade}-south-60`);
  report.cases.push({family:'folded-slab',grade,direction:'south',seat,state:await sample()});
  console.log(`${phase}: ${grade} south normal/geometry saved`);
 }
 if(process.env.QA_FULL==='1'){
  const directions=[{id:'south',x:0,y:1,keys:['w']},{id:'south-east',x:1,y:1,keys:['w','a']},{id:'east',x:1,y:0,keys:['a']},{id:'north-east',x:1,y:-1,keys:['a','s']},{id:'north',x:0,y:-1,keys:['s']},{id:'north-west',x:-1,y:-1,keys:['s','d']},{id:'west',x:-1,y:0,keys:['d']},{id:'south-west',x:-1,y:1,keys:['d','w']}];
  for(const family of ['folded-slab','fibre-knot','broken-shell'])for(const grade of ['low','medium','severe'])for(const direction of directions.filter(d=>family==='folded-slab'||d.x===0||d.y===0)){
   const id=`${family}-${grade}-${direction.id}`;if(process.env.QA_ONLY&&!process.env.QA_ONLY.split(',').includes(id))continue;await load(family,grade);const seat=await directionalSeat(direction);
   if(seat.unavailable){report.cases.push({family,grade,direction:direction.id,...seat});console.log(`${id}: unavailable`);continue;}
   await place(seat.point,direction.keys);await page.locator('#mode').selectOption('normal');await page.waitForTimeout(80);
   const before=await movementSample();await nativeScreenshot(`${id}-approach.png`);
   const visibility=await page.evaluate(async edge=>{const{audioManager}=await import('/src/managers/audio-manager.ts');return audioManager.game.scene.getScene('RiftScene').visibility.getVisibilityAt(edge);},seat.edge);
   await page.locator('#game-container').focus();for(const key of direction.keys)await page.keyboard.down(key);
   const samples=[];for(let i=0;i<12;i++){await page.waitForTimeout(150);samples.push(await movementSample());}
   for(const key of direction.keys)await page.keyboard.up(key);await page.waitForTimeout(150);
   const after=await movementSample();await nativeScreenshot(`${id}-contact.png`);
   const travel=Math.hypot(after.player.x-before.player.x,after.player.y-before.player.y),lastTravel=Math.hypot(samples.at(-1).player.x-samples.at(-3).player.x,samples.at(-1).player.y-samples.at(-3).player.y);
   const blocked=samples.some(p=>Object.entries(p.blocked).some(([key,value])=>key!=='none'&&value));
   const state=samples.some(p=>!p.actualSupport)?'unsupported':samples.some(p=>p.ended)?'run-ended':blocked?(lastTravel<1?'stopped':'blocked-and-sliding'):'no-collision-observed';
   report.cases.push({id,family,grade,direction:direction.id,seat,visibility,before,samples,after,travel,lastTravel,blocked,state,images:[`${id}-approach.png`,`${id}-contact.png`]});
   await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({id,state,travel,lastTravel,visibility,hp:after.hp}));
  }
 }
 assert.equal(report.errors.length,0);report.status='captured';
}catch(error){report.status='failed';report.failure=String(error);throw error;}
finally{
 report.endSources={};for(const file of Object.keys(report.sources))report.endSources[file]=createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');
 report.sourceChangedDuringCapture=Object.entries(report.sources).some(([file,hash])=>hash!==report.endSources[file]);
 await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
 await writeFile(path.join(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>R100 实体边界 · ${phase}</title><style>body{background:#101310;color:#d0d6cd;font:15px/1.6 system-ui;max-width:1400px;margin:24px auto}h1,h2{font-weight:500}section{border-top:1px solid #354035;padding:20px 0}.pair{display:flex;gap:8px}.pair a{width:50%}img{width:100%;image-rendering:pixelated}a{color:#99bdab}p{color:#adb8ad}</style><h1>实体边界 · ${phase}</h1><p>受控合法起点、正常有限视野、真实键盘走近。左为碰撞前，右为接触后。诊断法线图不替代正常画面，也不代表美术通过。</p><a href="report.json">状态、来源指纹与缺失方向记录</a>${report.cases.map(c=>c.images?`<section><h2>${c.id} · ${c.state}</h2><p>实走${c.travel.toFixed(1)}px；末300ms位移${c.lastTravel.toFixed(2)}px；原生边界可见度${c.visibility}；HP ${c.before.hp}→${c.after.hp}。</p><div class="pair">${c.images.map(file=>`<a href="${file}"><img src="${file}" loading="lazy"></a>`).join('')}</div></section>`:c.unavailable?`<section><h2>${c.family} ${c.grade} ${c.direction}</h2><p>未采集：${c.unavailable}</p></section>`:`<section><h2>${c.family} ${c.grade} 同原站位：正常 / 法线</h2><div class="pair">${['normal','geometry'].map(mode=>`<a href="${c.family}-${c.grade}-south-60-${mode}.png"><img src="${c.family}-${c.grade}-south-60-${mode}.png"></a>`).join('')}</div></section>`).join('')}`);
 await browser.close();
}
