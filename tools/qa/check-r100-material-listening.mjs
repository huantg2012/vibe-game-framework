import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const out=process.env.QA_OUT_DIR??'docs/qa/artifacts/r100-i10-i12/audio-listening-page-cancel-fixed';await mkdir(out,{recursive:true});
const report={at:new Date().toISOString(),url:'http://127.0.0.1:3027/docs/qa/interactive/r100-material-listening.html',checks:[],errors:[],browserClosed:false,subjectiveListening:false};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
 const page=await browser.newPage({viewport:{width:1280,height:1000}});
 page.on('console',m=>{if(m.type()==='error')report.errors.push({type:'console',text:m.text(),location:m.location()});});
 page.on('pageerror',e=>report.errors.push({type:'pageerror',text:String(e)}));
 await page.goto(report.url);await page.waitForFunction(()=>document.querySelectorAll('article').length===6);
 assert.equal(await page.locator('article').count(),6);report.checks.push('6 materials');
 const first=page.locator('article').first();
 await first.getByRole('button',{name:'听15秒',exact:true}).click();
 await page.waitForFunction(()=>{const a=document.querySelector('audio');return !a.paused&&a.currentTime>.2;});
 assert.equal(await first.locator('audio').evaluate(a=>a.volume),1);report.checks.push('actual WebM playback and volume 1');
 await page.waitForFunction(()=>{const a=document.querySelector('audio');return a.paused&&a.currentTime>=15;},null,{timeout:18000});
 report.previewEnd=await first.locator('audio').evaluate(a=>a.currentTime);assert(report.previewEnd<15.6);report.checks.push('15 second stop');
 for(const grade of ['low','medium','severe']){await first.locator('select').selectOption(grade);assert((await first.locator('audio').getAttribute('src')).endsWith(`-${grade}.webm`));}
 report.checks.push('3 grade source switch');
 await first.getByRole('button',{name:'完整一轮',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('audio').paused);
 await page.locator('article').nth(1).getByRole('button',{name:'完整一轮',exact:true}).click();
 await page.waitForFunction(()=>{const a=[...document.querySelectorAll('audio')];return a[0].paused&&!a[1].paused;});report.checks.push('single active mix');
 await page.locator('article').nth(1).locator('select').selectOption('low');assert(await page.locator('article').nth(1).locator('audio').evaluate(a=>a.paused));report.checks.push('grade switch pauses previous audio');
 await page.waitForTimeout(150);
 report.visibleStatus=await page.locator('#status').innerText();
 assert(!/无法播放|无法载入/.test(report.visibleStatus));
 report.checks.push('cancelled play promise does not display playback failure');
 await page.screenshot({path:`${out}/page.png`,fullPage:true});
 const metadata=JSON.parse(await readFile('docs/qa/interactive/r100-material-listening.json','utf8'));
 for(const family of metadata.families)for(const clip of family.clips){const response=await page.request.get(new URL(clip.audio,report.url).href);assert.equal(response.status(),200);assert.equal(createHash('sha256').update(await response.body()).digest('hex'),clip.sha256);}
 report.checks.push('18 HTTP audio bytes match recorded SHA');
 for(const name of ['html','json'])report[name+'Sha256']=createHash('sha256').update(await readFile('docs/qa/interactive/r100-material-listening.'+name)).digest('hex');
 assert.equal(report.errors.length,0);report.status='pass-playback-not-listening';
} catch(e){report.status='failed';report.failure=String(e);process.exitCode=1;}
finally{await browser.close();report.browserClosed=true;await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
