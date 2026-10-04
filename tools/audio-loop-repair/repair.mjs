/** Repair the actual authored loop endings; no synthesis, pitch shift or new bank.
 * The fixed Git source revision makes reruns idempotent (never re-encode output).
 * 30ms equal-power circular overlap is removed from the period; body unchanged.
 */
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const revision='a089bf787b80349533e850485419e3c157b879f4',ffmpeg=path.resolve('tools/audio-placeholders/.bin/ffmpeg');
const directory=path.resolve('docs/qa/artifacts/r100-i03-i06/audio-mix/loop-repair');fs.mkdirSync(directory,{recursive:true});
const recipes=[['bgm','bgm-rift-base-drone'],['bgm','bgm-rift-high-chaos'],['bgm','bgm-rift-threat'],['ambient','amb-rift-proximity'],['ambient','amb-rift-alien-atmosphere'],['sfx/enemy','sfx-rift-enemy-idle'],['sfx/enemy','sfx-rift-enemy-overwriter-hum']];
const hash=b=>createHash('sha256').update(b).digest('hex'),rows=[];
const run=(args,input)=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error',...args],{input,maxBuffer:64*1024*1024});
function measures(bytes){let peak=0,sq=0,maxStep=0;const n=bytes.length/4;for(let i=0;i<n;i++){const v=bytes.readFloatLE(i*4);peak=Math.max(peak,Math.abs(v));sq+=v*v;if(i)maxStep=Math.max(maxStep,Math.abs(v-bytes.readFloatLE((i-1)*4)));}return{duration:n/44100,peak,rms:Math.sqrt(sq/n),seam:Math.abs(bytes.readFloatLE(0)-bytes.readFloatLE((n-1)*4)),maxStep};}
for(const [dir,key] of recipes){
 const source=execFileSync('git',['show',`${revision}:assets/audio/${dir}/${key}.ogg`],{maxBuffer:16*1024*1024});
 const input=path.join(directory,key+'-source.ogg');if(!fs.existsSync(input))fs.writeFileSync(input,source);
 const pcm=run(['-i','pipe:0','-f','f32le','-ac','1','-ar','44100','pipe:1'],source),n=pcm.length/4,overlap=Math.round(.03*44100),fixed=Buffer.alloc((n-overlap)*4);
 for(let i=0;i<n-overlap;i++){
  let value=pcm.readFloatLE(i*4);if(i<overlap){const phase=i/(overlap-1)*Math.PI*.5;value=pcm.readFloatLE((n-overlap+i)*4)*Math.cos(phase)+value*Math.sin(phase);}fixed.writeFloatLE(value,i*4);
 }
 // The very tonal overwriter source leaves a codec-edge error even after
 // overlap. Move that same periodic signal's seam to its quietest three-sample
 // crossing; no new fade, level or pitch change. Other sources keep phase.
 let rotationSamples=0;
 if(key==='sfx-rift-enemy-overwriter-hum'){
  let minimum=Infinity;
  for(let i=1;i<fixed.length/4-1;i++){
   const value=Math.abs(fixed.readFloatLE((i-1)*4))+Math.abs(fixed.readFloatLE(i*4))+Math.abs(fixed.readFloatLE((i+1)*4));
   if(value<minimum){minimum=value;rotationSamples=i;}
  }
  Buffer.concat([fixed.subarray(rotationSamples*4),fixed.subarray(0,rotationSamples*4)]).copy(fixed);
 }
 const before=measures(pcm),after=measures(fixed);assert(after.seam<=after.maxStep);assert(after.peak<.9);assert(Math.abs(after.rms/before.rms-1)<.02);
 const encodings=[];
 for(const format of ['ogg','mp3']){
  const output=path.resolve('assets/audio',dir,key+'.'+format);const args=['-y','-f','f32le','-ar','44100','-ac','1','-i','pipe:0','-c:a',format==='ogg'?'libvorbis':'libmp3lame','-b:a',dir==='ambient'?'96k':'128k',output];run(args,fixed);fs.copyFileSync(output,path.resolve('public/assets/audio',dir,key+'.'+format));
  const bytes=fs.readFileSync(output),decoded=run(['-i',output,'-f','f32le','-ac','1','-ar','44100','pipe:1']);encodings.push({format,sha256:hash(bytes),bytes:bytes.length,...measures(decoded)});
 }
 // Five loop boundaries at original playback level, for subsequent human audit.
 const excerpt=Buffer.concat([pcm.subarray(pcm.length-44100*4*.25),pcm.subarray(0,44100*4*.25)]);
 const correctedExcerpt=Buffer.concat([fixed.subarray(fixed.length-44100*4*.25),fixed.subarray(0,44100*4*.25)]);
 for(const [label,bytes] of [['before',excerpt],['after',correctedExcerpt]])run(['-y','-f','f32le','-ar','44100','-ac','1','-i','pipe:0',path.join(directory,key+'-'+label+'.wav')],Buffer.concat(Array(5).fill(bytes)));
 rows.push({key,sourceRevision:revision,sourceSha256:hash(source),overlapMs:30,rotationSamples,before,after,encodings});console.log(key,JSON.stringify({beforeSeam:before.seam,afterSeam:after.seam,rmsChangeDb:20*Math.log10(after.rms/before.rms)}));
}
fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify({method:'30ms circular overlap/trim of decoded original OGG; original spectral body preserved; overwriter seam rotated to quiet crossing; no normalization/no synthesis. Actual browser codec decode and real mix checked separately. No subjective listening assertion.',rows},null,2));
