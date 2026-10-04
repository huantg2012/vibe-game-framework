/** Capture the actual native canvas + Phaser master output. This establishes
 * signal/synchronization evidence, not a listening or aesthetic verdict. */
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/rift-r100-i02-validation/audio');
const base=process.env.GAME_URL??'http://127.0.0.1:3027';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??pathToFileURL(path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
await mkdir(out,{recursive:true});
const report={date:new Date().toISOString(),revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  method:'Real canvas captureStream with Phaser master output, unmodified native clock and existing keyboard-input patrol. Isolated browser and in-memory DEV storage. No sound injection, gain edit, actor teleport, or hearing claim.',
  sources:{},cases:[],errors:[],listening:'pending; signal measurement is not listening'};
for(const file of ['src/systems/r100-world/audio.ts','src/systems/r100-world/presentation.ts','src/managers/audio-manager.ts','data/rift-master-scenes.csv'])report.sources[file]=createHash('sha256').update(await readFile(file)).digest('hex');
try{
  for(const family of ['folded-slab','fibre-knot','broken-shell']){
    const context=await browser.newContext({viewport:{width:1500,height:1040},deviceScaleFactor:1});
    const page=await context.newPage();page.on('pageerror',error=>report.errors.push(String(error)));
    await page.goto(`${base}/rift-r100-masters.html?family=${family}&grade=severe&seed=20261002`);
    await page.waitForFunction(()=>{try{return JSON.parse(document.getElementById('diagnostics').textContent).runtime.running;}catch{return false;}},null,{timeout:60000});
    // The light-only entrance shuttle stays outside some material emitters'
    // earshot. Use the existing five-station route, which passes their surfaces.
    await page.locator('#patrol').click();
    await page.waitForFunction(()=>{try{return JSON.parse(document.getElementById('diagnostics').textContent).patrol.active;}catch{return false;}},null,{timeout:60000});
    await page.waitForFunction(()=>{const d=JSON.parse(document.getElementById('diagnostics').textContent),p=d.runtime.probe.player;
      return d.presentation.sourceLights.some(s=>Math.hypot(s.x-p.x,s.y-p.y)<135);},null,{timeout:30000});
    await page.locator('#patrol').click(); // stop input at the physically reached listening position
    await page.evaluate(async()=>{
      const {audioManager}=await import('/src/managers/audio-manager.ts');
      audioManager.unlock();
      const manager=audioManager.game.sound;
      if(!manager.context||!manager.masterVolumeNode)throw Error('WebAudio output unavailable');
      await manager.context.resume();
      const destination=manager.context.createMediaStreamDestination();manager.masterVolumeNode.connect(destination);
      const canvas=audioManager.game.canvas,videoStream=canvas.captureStream(30);
      const stream=new MediaStream([...videoStream.getVideoTracks(),...destination.stream.getAudioTracks()]);
      const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:1400000});
      const audioRecorder=new MediaRecorder(destination.stream,{mimeType:'audio/webm;codecs=opus'});
      const chunks=[],audioChunks=[],samples=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      audioRecorder.ondataavailable=e=>{if(e.data.size)audioChunks.push(e.data);};
      const started=performance.now();
      const timer=setInterval(()=>{
        const d=JSON.parse(document.getElementById('diagnostics').textContent);
        samples.push({at:performance.now()-started,phase:d.presentation?.phase,elapsedMs:d.presentation?.elapsedMs,
          sounds:d.presentation?.sounds,player:d.runtime?.probe?.player,paused:d.runtime?.paused,
          playing:manager.sounds.filter(s=>s.isPlaying).map(s=>({key:s.key,volume:s.volume}))});
      },100);
      window.__audioProof={recorder,audioRecorder,chunks,audioChunks,samples,timer,destination,source:manager.masterVolumeNode,stream,videoStream};
      recorder.start(250);audioRecorder.start(250);
    });
    // Include two full real cycles from this reached position and a pause.
    await page.waitForTimeout(36000);
    await page.locator('#pause').click();await page.waitForTimeout(1100);
    await page.screenshot({path:path.join(out,`${family}-paused.jpg`)});
    await page.locator('#pause').click();await page.waitForTimeout(1200);
    const captured=await page.evaluate(async()=>{
      const c=window.__audioProof;clearInterval(c.timer);
      await Promise.all([c.recorder,c.audioRecorder].map(r=>new Promise(resolve=>{r.onstop=resolve;r.stop();})));
      c.source.disconnect(c.destination);for(const track of c.stream.getTracks())track.stop();
      const bytes=async(blob)=>{const buffer=await blob.arrayBuffer();let text='';const b=new Uint8Array(buffer);for(let i=0;i<b.length;i+=8192)text+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(text);};
      const audioBlob=new Blob(c.audioChunks,{type:'audio/webm'}),audioBuffer=await audioBlob.arrayBuffer();
      const decoder=new AudioContext(),decoded=await decoder.decodeAudioData(audioBuffer);
      let peak=0,sum=0,clipped=0,count=0;
      for(let channel=0;channel<decoded.numberOfChannels;channel++)for(const sample of decoded.getChannelData(channel)){peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;count++;if(Math.abs(sample)>=.999)clipped++;}
      await decoder.close();
      return {video:await bytes(new Blob(c.chunks,{type:'video/webm'})),audio:await bytes(audioBlob),samples:c.samples,
        signal:{duration:decoded.duration,channels:decoded.numberOfChannels,peak,rms:Math.sqrt(sum/count),clipped}};
    });
    await writeFile(path.join(out,`${family}.webm`),Buffer.from(captured.video,'base64'));
    await writeFile(path.join(out,`${family}-audio.webm`),Buffer.from(captured.audio,'base64'));
    const signals=captured.samples.filter(s=>s.sounds?.eventCount>0);
    const actualKeys=[...new Set(captured.samples.flatMap(s=>s.playing.map(p=>p.key)))];
    const materialKeys=actualKeys.filter(key=>key.startsWith('sfx-suspended-sea-'));
    const result={family,grade:'severe',seed:20261002,signal:captured.signal,actualKeys,materialKeys,samples:captured.samples};
    await writeFile(path.join(out,`${family}.json`),JSON.stringify(result,null,2));
    assert(captured.signal.rms>0,'actual output must contain a signal');assert.equal(captured.signal.clipped,0,'master output must not clip');
    assert(materialKeys.length>0,'material events must reach the actual Phaser output');assert(signals.length>0,'natural pressure must produce owned events');
    const paused=captured.samples.filter(s=>s.paused);assert(paused.length>=4,'pause must be sampled');
    assert.equal(new Set(paused.map(s=>s.elapsedMs)).size,1,'visible pressure clock is frozen during pause');
    assert(paused.slice(1).every(s=>s.playing.length===0),'pause stops actual output voices');
    report.cases.push({...result,samples:undefined,sampleCount:captured.samples.length,pauseSamples:paused.length,video:`${family}.webm`,audio:`${family}-audio.webm`});
    await context.close();console.log(JSON.stringify(report.cases.at(-1)));
  }
  assert.equal(report.errors.length,0);report.status='signal-and-pause-verified-listening-pending';
}catch(error){report.status='failed';report.failure=String(error);throw error;}
finally{await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
