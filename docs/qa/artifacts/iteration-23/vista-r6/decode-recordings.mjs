// Offline decoding of QA passive recordings; does not load or alter the game.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const dir=path.resolve(process.argv[2]);
const {chromium}=await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage(),results=[];
try{for(const file of ['main-audio-2.webm','reduced-audio-2.webm']){
 const bytes=await readFile(path.join(dir,file));
 const result=await page.evaluate(async base64=>{const b=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const ctx=new OfflineAudioContext(2,1,48000);const audio=await ctx.decodeAudioData(b.buffer);let peak=0,sum=0;for(let ch=0;ch<audio.numberOfChannels;ch++)for(const v of audio.getChannelData(ch)){peak=Math.max(peak,Math.abs(v));sum+=v*v;}
 const n=Math.min(audio.length,30*audio.sampleRate),channels=audio.numberOfChannels,pcm=new ArrayBuffer(44+n*channels*2),view=new DataView(pcm);function str(offset,s){for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));}str(0,'RIFF');view.setUint32(4,pcm.byteLength-8,true);str(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,audio.sampleRate,true);view.setUint32(28,audio.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,n*channels*2,true);for(let i=0;i<n;i++)for(let c=0;c<channels;c++){const v=Math.max(-1,Math.min(1,audio.getChannelData(c)[i]));view.setInt16(44+(i*channels+c)*2,Math.round(v*(v<0?32768:32767)),true);}let out='';for(const v of new Uint8Array(pcm))out+=String.fromCharCode(v);return {sampleRate:audio.sampleRate,channels,duration:audio.duration,peak,rms:Math.sqrt(sum/(audio.length*channels)),excerptSeconds:n/audio.sampleRate,wav:btoa(out)};},bytes.toString('base64'));
 const wavFile=file.replace('.webm','-first30.wav');await writeFile(path.join(dir,wavFile),Buffer.from(result.wav,'base64'));delete result.wav;results.push({file,wavFile,...result});
}}finally{await browser.close();}
await writeFile(path.join(dir,'audio-decode.json'),JSON.stringify({method:'Passive actual audio destination output, offline native Chrome decode, PCM16 excerpt without normalization. No Agent listening.',results},null,2));console.log(JSON.stringify(results,null,2));
