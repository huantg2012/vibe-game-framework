/** Decode the actual production assets; signal metrics cannot certify aesthetic listening. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const assets = [...fs.readFileSync('src/managers/audio-catalog.ts', 'utf8').matchAll(/key: '([^']+)', dir: '([^']+)'/g)].map(m => ({key:m[1],dir:m[2]}));
const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try {
 const page = await browser.newPage(); await page.goto((process.env.GAME_URL ?? 'http://127.0.0.1:3019')+'/');
 const result = await page.evaluate(async assets => {
  const context = new AudioContext(), rows=[];
  for (const asset of assets) for (const format of ['ogg','mp3']) {
   const response=await fetch('/assets/audio/'+asset.dir+'/'+asset.key+'.'+format); if(!response.ok)throw Error(asset.key+' '+response.status);
   const buffer=await context.decodeAudioData(await response.arrayBuffer());
   let peak=0, sum=0, clipped=0, count=0;
   for(let c=0;c<buffer.numberOfChannels;c++)for(const value of buffer.getChannelData(c)){peak=Math.max(peak,Math.abs(value));sum+=value*value;clipped+=Math.abs(value)>=.999?1:0;count++;}
   rows.push({...asset,format,duration:buffer.duration,channels:buffer.numberOfChannels,sampleRate:buffer.sampleRate,peak,rms:Math.sqrt(sum/count),clippedSamples:clipped,samples:count});
  }
  await context.close(); return rows;
 }, assets);
 assert.equal(result.length,98); assert(result.every(row=>row.duration>0 && row.rms>0 && Number.isFinite(row.peak)));
 fs.writeFileSync('docs/qa/artifacts/iteration-27/audio/asset-signals.json', JSON.stringify({method:'Browser decode of actual public OGG and MP3; source signal metrics only, not listening or final mix.',rows:result},null,2));
 console.log(JSON.stringify({decoded:result.length,silent:result.filter(r=>r.rms===0).length,clipped:result.filter(r=>r.clippedSamples>0).map(r=>({key:r.key,format:r.format,ratio:r.clippedSamples/r.samples})),maxPeak:Math.max(...result.map(r=>r.peak))}));
} finally { await browser.close(); }
