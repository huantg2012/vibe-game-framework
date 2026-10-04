/** Actual decoded production sources and Phaser/WebAudio bus; controlled mix bench.
 * This is not natural play and does not certify subjective listening. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const {chromium}=await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-i03-i06/audio-mix/before');fs.mkdirSync(out,{recursive:true});
const base=process.env.GAME_URL??'http://127.0.0.1:3074';const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1152,height:768}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
const report={url:base,method:'Isolated ordinary boot loads actual audio. Controlled Phaser AudioManager mix at fixed listener distance zero, actual material-pressure clocks; explicit threat/proximity stress and cue injection, not natural encounter/play. Real WebAudio master PCM capture + playable Opus. No subjective listening claim.',sources:{},cases:[],errors};
for(const file of ['src/systems/r100-world/audio.ts','src/managers/audio-manager.ts','src/managers/audio-catalog.ts'])report.sources[file]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
try{
 await page.goto(base+'/');await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'),null,{timeout:60000});
 const assets=await page.evaluate(async()=>{
  const {audioManager}=await import('/src/managers/audio-manager.ts');const {AUDIO_ASSETS}=await import('/src/managers/audio-catalog.ts');const ctx=audioManager.game.sound.context;await ctx.resume();const rows=[];
  for(const a of AUDIO_ASSETS){const ab=await fetch(`/assets/audio/${a.dir}/${a.key}.ogg`).then(r=>r.arrayBuffer());const b=await ctx.decodeAudioData(ab);let peak=0,sq=0,n=0,step=0,seam=0,dc=0;for(let c=0;c<b.numberOfChannels;c++){const d=b.getChannelData(c);seam=Math.max(seam,Math.abs(d[0]-d.at(-1)));for(let i=0;i<d.length;i++){peak=Math.max(peak,Math.abs(d[i]));sq+=d[i]*d[i];dc+=d[i];n++;if(i)step=Math.max(step,Math.abs(d[i]-d[i-1]));}}rows.push({...a,duration:b.duration,sampleRate:b.sampleRate,peak,rms:Math.sqrt(sq/n),dc:dc/n,seam,maximumNeighborStep:step});}
  return rows;
 });fs.writeFileSync(path.join(out,'assets.json'),JSON.stringify(assets,null,2));
 const families=(process.env.QA_FAMILIES??'folded-slab,fibre-knot,broken-shell,granular-ridge,membrane-rim,gel-flow').split(',');const grades=(process.env.QA_GRADES??'low,medium,severe').split(',');
 for(const family of families)for(const grade of grades){
  const result=await page.evaluate(async({family,grade})=>{
   const {audioManager:a}=await import('/src/managers/audio-manager.ts');const{MasterMaterialAudio}=await import('/src/systems/r100-world/audio.ts');const{r100MaterialPressure}=await import('/src/systems/r100-world/presentation-state.ts');
   a.stopBGM(0);a.haltNonBgm(0);a.resumeAll();a.unlock();const ctx=a.game.sound.context;await ctx.resume();
   const master=a.game.sound.masterVolumeNode,dest=ctx.createMediaStreamDestination();master.connect(dest);const chunks=[];const recorder=new MediaRecorder(dest.stream,{mimeType:'audio/webm;codecs=opus'});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   const processor=ctx.createScriptProcessor(2048,2,2),silent=ctx.createGain();silent.gain.value=0;master.connect(processor);processor.connect(silent);silent.connect(ctx.destination);
   let peak=0,squares=0,count=0,clipped=0,maxStep=0,previous=[0,0];const buckets=[];
   processor.onaudioprocess=e=>{let bpeak=0,bsq=0,bn=0;for(let c=0;c<e.inputBuffer.numberOfChannels;c++){const d=e.inputBuffer.getChannelData(c);for(const v of d){bpeak=Math.max(bpeak,Math.abs(v));bsq+=v*v;bn++;maxStep=Math.max(maxStep,Math.abs(v-previous[c]));previous[c]=v;if(Math.abs(v)>=.999)clipped++;}}peak=Math.max(peak,bpeak);squares+=bsq;count+=bn;buckets.push({time:ctx.currentTime,peak:bpeak,rms:Math.sqrt(bsq/bn)});};
   const owned=new MasterMaterialAudio({family,grade,seed:20261004},a);const periods={'folded-slab':[19,16,14],'fibre-knot':[22,18,16],'broken-shell':[24,20,17],'granular-ridge':[19,16,14],'membrane-rim':[24,20,17],'gel-flow':[22,18,16]};const period=periods[family][['low','medium','severe'].indexOf(grade)];
   const stamps=[],voices=[],cues=[];const listener={x:0,y:0},sources=[{x:0,y:0}];
   a.playBGM('bgm-rift-base-drone',0);a.setLayerVolume('base',.4,0);a.setLayerVolume('tension',grade==='low'?0:grade==='medium'?.14:.4,0);a.setLayerVolume('threat',.5,0);a.setLayerVolume('proximity',.3,0);
   if(grade==='low')a.playAmbient('amb-rift-alien-atmosphere',0);
   const start=performance.now(),audioStart=ctx.currentTime;let running=true,lastVoice=0;const sent=new Set();
   const emit=(id,key)=>{if(sent.has(id))return;sent.add(id);a.playSFX(key);cues.push({id,key,at:performance.now()-start,audioAt:ctx.currentTime});};
   recorder.start(250);
   function frame(){if(!running)return;const t=performance.now()-start;const p=r100MaterialPressure(t,period);owned.update(t,p,listener,sources);
    if(t>period*1000*.74)emit('alert','sfx-rift-enemy-alert');if(t>period*1000*.775)emit('hurt','sfx-shared-player-hurt');if(t>period*1000*.81)emit('interrupt','sfx-shared-player-search-interrupt');if(t>period*1000*.85)emit('threshold','sfx-shared-chaos-threshold');
    if(t-lastVoice>50){lastVoice=t;stamps.push({at:t,pressure:p,owned:owned.snapshot()});voices.push({at:t,...a.getState()});}requestAnimationFrame(frame);
   }requestAnimationFrame(frame);await new Promise(r=>setTimeout(r,(period+1)*1000));
   owned.setPaused(true);a.pauseAll();const pausedAt=ctx.currentTime;await new Promise(r=>setTimeout(r,700));const paused=a.getState();a.resumeAll();owned.setPaused(false);await new Promise(r=>setTimeout(r,300));running=false;owned.destroy();a.stopBGM(0);a.haltNonBgm(0);await new Promise(r=>setTimeout(r,180));
   await new Promise(r=>{recorder.onstop=r;recorder.stop();});processor.onaudioprocess=null;master.disconnect(dest);master.disconnect(processor);processor.disconnect();silent.disconnect();for(const t of dest.stream.getTracks())t.stop();
   const b=new Uint8Array(await new Blob(chunks,{type:'audio/webm'}).arrayBuffer());let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));
   return{family,grade,period,peak,rms:Math.sqrt(squares/count),clipped,maxStep,audioStart,pausedAt,pauseVoices:paused.voices,maximumVoices:Math.max(...voices.map(v=>v.playingCount)),cues,buckets,stamps,voices,audio:btoa(s),ended:a.getState()};
  },{family,grade});
  const name=family+'-'+grade;fs.writeFileSync(path.join(out,name+'.webm'),Buffer.from(result.audio,'base64'));delete result.audio;fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(result,null,2));report.cases.push({name,peak:result.peak,rms:result.rms,clipped:result.clipped,maxStep:result.maxStep,maximumVoices:result.maximumVoices,events:result.stamps.at(-1)?.owned.eventCount,voicesReleased:result.ended.playingCount===0});save();console.log(JSON.stringify(report.cases.at(-1)));
 }
 assert.deepEqual(errors,[]);report.status='measured-listening-unverified';save();
}catch(e){report.status='failed';report.failure=String(e);save();throw e;}finally{await browser.close();}
