// Decode selected original recording frames only. Never loads or changes game state.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const dir=path.resolve(process.argv[2]),e=JSON.parse(await readFile(path.join(dir,'evidence.json'),'utf8'));
const {chromium}=await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const canvasMode=['OCCLUSION-REGRESSION','FALLEN-ALIGNMENT-REGRESSION'].includes(e.mode);const folder=canvasMode?'canvas-video-frames':'video-frames';const origin=canvasMode?Date.parse(e.observations[0].at):Date.parse(e.startedAt);const page=await browser.newPage(),bytes=await readFile(canvasMode?path.join(dir,'main-canvas.webm'):e.video),frames=[];
try{
 await page.route('http://qa.local/recording.webm',r=>r.fulfill({contentType:'video/webm',headers:{'Access-Control-Allow-Origin':'*'},body:bytes}));
 await page.setContent('<video crossorigin="anonymous" id="v" src="http://qa.local/recording.webm" preload="auto" muted></video>');
 await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
 // Recording begins at page creation just after evidence.startedAt. Times below
 // are approximate wall-to-video offsets, explicitly recorded rather than claimed exact input synchronization.
 for(const label of (canvasMode?(e.mode==='FALLEN-ALIGNMENT-REGRESSION'?['check-fallen-rib-contact','check-fallen-rib-stop','check-fallen-rib-return','route-05-outer','route-08-gap']:['check-fallen-rib-contact','check-fallen-rib-return','route-08-rejoin']):['route-04-rejoin','route-24-rejoin','route-39-rejoin'])){
  const inputs=e.inputs.filter(i=>i.label===label);if(!inputs.length)continue;
  const start=Math.max(0,(inputs[0].at-origin)/1000),end=(inputs.at(-1).at+inputs.at(-1).ms-origin)/1000;
  for(let time=start;time<=end;time+=(canvasMode?Math.max(.65,(end-start)/3):.65)){
   const data=await page.evaluate(async time=>{const v=document.querySelector('video');await new Promise((resolve,reject)=>{v.addEventListener('seeked',resolve,{once:true});v.addEventListener('error',reject,{once:true});v.currentTime=time;});const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);return c.toDataURL('image/png').split(',')[1];},time);
   const file=`${folder}/${label}-${time.toFixed(2)}s.png`;await mkdir(path.join(dir,folder),{recursive:true});await writeFile(path.join(dir,file),Buffer.from(data,'base64'));frames.push({label,time,file});
  }
 }
}finally{await browser.close();}
await writeFile(path.join(dir,folder,'index.json'),JSON.stringify({method:'Unedited PNG decoding of original continuous WebM; original dimensions; selection uses approximate wall-to-video offsets. Frames do not replace original recording.',frames},null,2));console.log(JSON.stringify(frames));
