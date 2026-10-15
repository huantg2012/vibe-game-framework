/** Capture the three fixed DEV samples once, using the real Chrome canvas. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/native-three-samples-2026-10-15/browser');
const origin=process.env.GAME_URL??'http://127.0.0.1:3027';
const samples=[{id:'split-rib-causeway',label:'双脊渡口'},{id:'gel-rafts',label:'断脂浅片'},{id:'ash-strata',label:'无彩层原'}];
const seed=20261012,grade='medium';
const sha=value=>createHash('sha256').update(value).digest('hex');
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const sourcePaths=['native-construction.html','src/dev/native-construction.ts','src/generation/world-study/native-spatial-construction-reference.ts','src/generation/world-study/native-spatial-construction-shore.ts','src/systems/r100-world/surface-world.ts','src/systems/r100-world/ground.ts','src/systems/r100-world/surface-fields.ts','src/systems/r100-world/surface-bake.ts','src/systems/r100-world/surface-renderer.ts',...['reference','shore','gel-rafts','gel-rafts-shore','ash-strata','ash-strata-shore'].map(name=>`data/rift-native-construction-${name}.csv`)];
const sourceHashes=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async file=>[file,sha(await fs.readFile(file))])));
await fs.mkdir(out,{recursive:true});
assert(!(await fs.readdir(out)).includes('capture.json'),'Never overwrite a capture receipt');
const report={status:'running',startedAt:new Date().toISOString(),scope:'Three fixed DEV construction samples; actual material renderer without observation fog, plus actual geometry silhouettes. No r12 search, full content deployment, gameplay admission, or ordinary recipe recovery.',seed,grade,sourceHashes:await sourceHashes(),browserErrors:[],samples:[],cacheRevisits:[]};
const save=()=>fs.writeFile(path.join(out,'capture.json'),JSON.stringify(report,null,2)+'\n');
await save();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
report.browserVersion=browser.version();
const page=await browser.newPage({viewport:{width:1600,height:1180},deviceScaleFactor:1});
page.on('pageerror',error=>report.browserErrors.push(String(error)));
const state=()=>page.evaluate(()=>window.__nativeConstruction?.getState());
const waitReady=async id=>{
  await page.waitForFunction(id=>{
    const state=window.__nativeConstruction?.getState();
    return state?.ready&&state.worldId===id||Boolean(state?.errors?.length)||Boolean(document.getElementById('error')&&!document.getElementById('error').hidden);
  },id,{timeout:180000});
  const current=await state();
  assert(current?.ready,JSON.stringify(current??await page.locator('#error').textContent()));
  assert.equal(current.worldId,id);assert.equal(current.seed,seed);assert.equal(current.grade,grade);
  assert.equal(current.admission,'DEV-not-complete');assert.equal(current.errors?.length??0,0,JSON.stringify(current.errors));
  return current;
};
const setMode=async(mode,id)=>{
  await page.locator(`#${mode}`).click();
  await page.waitForFunction(mode=>window.__nativeConstruction?.getState().mode===mode,mode);
  return waitReady(id);
};
const canvasData=()=>page.evaluate(()=>{
  const canvas=document.getElementById('map');
  if(!(canvas instanceof HTMLCanvasElement)||canvas.width<=0||canvas.height<=0)throw new Error('No rendered sample canvas');
  return{width:canvas.width,height:canvas.height,png:canvas.toDataURL('image/png').split(',')[1]};
});
try{
  const response=await page.goto(`${origin}/native-construction.html?sample=${samples[0].id}`);
  assert.equal(response.status(),200);
  for(const sample of samples){
    if(sample.id!==samples[0].id)await page.locator('#sample').selectOption(sample.id);
    const initial=await waitReady(sample.id),counts=initial.countsBySample?.[sample.id];
    assert.deepEqual(counts,{constructions:1,fragmentCompiles:1,initialGeometryBuilds:1,visualTerrainCompiles:1,visualRasterBuilds:1,fullCandidates:0},'Each sample must construct once without any full candidate');
    assert.equal(initial.label,sample.label);
    assert(initial.gates?.boundary&&initial.gates?.geometry&&initial.gates?.visibility,'Missing actual geometry measurements');
    assert.equal(sha(await fs.readFile(initial.sources.referenceCSV.slice(1))),initial.sources.referenceSHA256,'Reference CSV identity differs');
    assert.equal(sha(await fs.readFile(initial.sources.shoreCSV.slice(1))),initial.sources.shoreSHA256,'Shore CSV identity differs');
    assert.equal(sha(JSON.stringify({referenceSHA256:initial.sources.referenceSHA256,shoreSHA256:initial.sources.shoreSHA256})),initial.sources.combinedSHA256);
    const record={...sample,state:initial,exports:[]};report.samples.push(record);await save();
    for(const mode of ['material','silhouette']){
      const current=await setMode(mode,sample.id);
      assert.deepEqual(current.countsBySample[sample.id],counts,'Mode change reconstructed the sample');
      const data=await canvasData(),bytes=Buffer.from(data.png,'base64'),file=`${sample.id}-${mode}.png`;
      await fs.writeFile(path.join(out,file),bytes,{flag:'wx'});
      record.exports.push({mode,file,width:data.width,height:data.height,bytes:bytes.length,sha256:sha(bytes)});
      await save();
    }
    record.after=await setMode('material',sample.id);
    assert.deepEqual(record.after.countsBySample[sample.id],counts,'Mode return reconstructed the sample');
    assert.notEqual(record.exports[0].sha256,record.exports[1].sha256,'Material and silhouette exports are identical');
    await page.locator('#native').click();assert(await page.locator('body').evaluate(node=>node.classList.contains('native')));
    await page.locator('#fit').click();assert(!(await page.locator('body').evaluate(node=>node.classList.contains('native'))));
    record.verifiedControls=['material','silhouette','native','fit'];
    console.log(JSON.stringify({captured:sample.id,seed:initial.seed,counts,exports:record.exports.map(item=>item.file)}));
  }
  const before=await state();
  assert.deepEqual([...before.cachedSampleIds].sort(),samples.map(sample=>sample.id).sort());
  for(const sample of samples){
    await page.locator('#sample').selectOption(sample.id);
    const revisit=await waitReady(sample.id);
    assert.deepEqual(revisit.countsBySample,before.countsBySample,'Cached sample selection reconstructed geometry');
    report.cacheRevisits.push({worldId:sample.id,seed:revisit.seed,countsBySample:revisit.countsBySample});
  }
  assert.equal(report.browserErrors.length,0,report.browserErrors.join('\n'));
  report.finalState=await state();report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack??error);process.exitCode=1;}
finally{
  report.sourceHashesAfter=await sourceHashes();
  report.sourcesStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.sourceHashesAfter);
  if(!report.sourcesStable){report.status='failed';process.exitCode=1;}
  await save();await browser.close();
}
const gateLabel=gate=>gate?.accepted?'通过':'未过';
const cards=report.samples.map(sample=>`<section id="${sample.id}"><header><h2>${esc(sample.label)}</h2><a href="${esc(origin)}/native-construction.html?sample=${sample.id}">打开 DEV</a></header><p>外岸${gateLabel(sample.state.gates?.boundary)} · G1/G3${gateLabel(sample.state.gates?.geometry)} · G2${gateLabel(sample.state.gates?.visibility)}</p><div class="views">${sample.exports.map(item=>`<a class="image" href="${item.file}" target="_blank" rel="noopener"><span>${item.mode==='material'?'真实材质 · 去雾':'实际剪影'}</span><img src="${item.file}" alt="${esc(sample.label)}${item.mode==='material'?'真实材质':'实际剪影'}" width="${item.width}" height="${item.height}"></a>`).join('')}</div></section>`).join('\n');
await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>参差岸 · 三图</title><style>body{margin:0;background:#10161b;color:#e1e5e3;font:16px/1.6 system-ui,"PingFang SC",sans-serif}main{max-width:1480px;margin:auto;padding:28px}h1{font-size:26px;margin:0}p{color:#a6b4b5;margin:8px 0}nav{display:flex;gap:22px;margin:22px 0}a{color:#c9d8d7;text-decoration:none}a:hover{text-decoration:underline}section{margin:28px 0 52px;scroll-margin-top:20px}header{display:flex;align-items:baseline;gap:22px}h2{font-size:20px}.views{display:grid;grid-template-columns:1fr 1fr;gap:20px}.image{display:block;background:#0b1115;padding:12px}.image span{display:block;margin-bottom:10px;color:#b1bdbc}img{width:100%;height:auto;display:block;image-rendering:pixelated}footer{color:#8d9d9e;font-size:13px}</style><main><h1>参差岸 · 三图</h1><p>中污染 · 固定种子 ${seed} · 点击看原尺寸</p><p>DEV 固定样本。几何门状态见回执；未通过完整地图准入。</p><nav>${samples.map(sample=>`<a href="#${sample.id}">${esc(sample.label)}</a>`).join('')}</nav>${cards}<footer><a href="capture.json">采集回执</a> · 实际画布导出，无生成后修图。</footer></main></html>\n`);
console.log(JSON.stringify({status:report.status,samples:report.samples.length,errors:report.browserErrors,sourcesStable:report.sourcesStable,output:out}));
