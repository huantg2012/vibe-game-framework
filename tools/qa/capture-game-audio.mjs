/** Technical signal/cue capture, isolated context; opens the ordinary prepare panel via its scene method. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:960}}), errors=[], records=[], bundles=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{if(r.url().endsWith('.js'))bundles.push(r.url())});
const root='docs/qa/artifacts/iteration-27/audio';
const press=async key=>page.keyboard.press(key,{delay:100});
const soundState=()=>page.evaluate(()=>({scene:window.__game.scene.getScenes(true).map(s=>s.scene.key),sounds:window.__game.sound.sounds.filter(s=>s.isPlaying||s.isPaused).map(s=>({key:s.key,playing:s.isPlaying,paused:s.isPaused,volume:s.volume}))}));
try {
 await page.goto((process.env.GAME_URL??'http://127.0.0.1:3019')+'/');await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
 await page.evaluate(()=>{
  const m=window.__game.sound,dest=m.context.createMediaStreamDestination();m.masterVolumeNode.connect(dest);
  const recorder=new MediaRecorder(dest.stream,{mimeType:'audio/webm;codecs=opus'}),chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.start(250);
  window.__qaAudioCapture={recorder,chunks,dest,source:m.masterVolumeNode};
  const play=m.play.bind(m);m.play=(key,...args)=>{(window.__qaSounds??=[]).push({key,at:performance.now()});return play(key,...args)};
 });
 await press('Enter');await page.waitForTimeout(2300);records.push({label:'hub',...await soundState()});
 assert(await page.evaluate(()=>window.__game.scene.isActive('PurificationScene')));
 await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').openWorldInteraction('rift'));
 await page.waitForTimeout(500);await press('Shift+Enter');await page.waitForTimeout(2300);
 assert(await page.evaluate(()=>window.__game.scene.isActive('RiftScene')));records.push({label:'rift',...await soundState()});
 await press('Space');await page.waitForTimeout(700);await page.keyboard.down('d');await page.waitForTimeout(300);await page.keyboard.up('d');
 await press('Escape');await page.waitForTimeout(350);records.push({label:'paused',...await soundState()});
 assert(records.at(-1).sounds.every(s=>s.paused&&!s.playing));
 await press('Escape');await page.waitForTimeout(1400);records.push({label:'resumed',...await soundState()});assert(records.at(-1).sounds.some(s=>s.playing));
 await page.screenshot({path:root+'/actual-rift.png'});
 const captured=await page.evaluate(async()=>{const c=window.__qaAudioCapture;await new Promise(resolve=>{c.recorder.onstop=resolve;c.recorder.stop()});c.source.disconnect(c.dest);const blob=new Blob(c.chunks,{type:'audio/webm'}),buffer=await blob.arrayBuffer();const context=new AudioContext(),audio=await context.decodeAudioData(buffer.slice(0));let peak=0,sum=0,count=0,clipped=0;for(let c=0;c<audio.numberOfChannels;c++)for(const v of audio.getChannelData(c)){peak=Math.max(peak,Math.abs(v));sum+=v*v;count++;if(Math.abs(v)>=.999)clipped++;}await context.close();let binary='';const bytes=new Uint8Array(buffer);for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {base64:btoa(binary),duration:audio.duration,peak,rms:Math.sqrt(sum/count),clipped};});
 fs.writeFileSync(root+'/actual-game-audio.webm',Buffer.from(captured.base64,'base64'));delete captured.base64;
 assert(captured.rms>0);assert.equal(captured.clipped,0);assert.deepEqual(errors,[]);
 fs.writeFileSync(root+'/lifecycle.json',JSON.stringify({method:'Real production audio from Phaser master output: menu, fresh hub, ordinary prepare/departure, Space swing, movement, Escape pause/resume. Opens prepare panel by scene method, no grants/teleports/audio synthesis. Hearing aesthetics not assessed.',url:page.url(),bundles,records,captured,errors},null,2));
 console.log(JSON.stringify({passed:true,...captured,states:records.map(r=>r.label)}));
} finally {await browser.close();}
