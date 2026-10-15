/** Capture a registered group of fixed DEV samples once, using the real Chrome canvas. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/native-three-samples-2026-10-15/browser');
const origin=process.env.GAME_URL??'http://127.0.0.1:3027';
const diverseCapture=process.env.QA_DIVERSE==='1';
const extensionCapture=diverseCapture||process.env.QA_EXTENSIONS==='1';
const macroCapture=extensionCapture||process.env.QA_MACRO==='1';
const previousOut=macroCapture&&!diverseCapture?path.resolve(process.env.QA_BASELINE_DIR??(extensionCapture?'docs/qa/artifacts/native-three-macro-2026-10-15/browser':'docs/qa/artifacts/native-three-samples-2026-10-15/browser')):null;
const galleryTitle=diverseCapture?'四种材质 · 共享新构型':extensionCapture?'中尺度扩展前后':macroCapture?'大形前后':'三图';
const registryFile='data/rift-native-construction-samples.csv';
const registry=(await fs.readFile(registryFile,'utf8')).trim().split(/\r?\n/).slice(1).map(line=>{const [id,label,reference,shore,cohort,character]=line.split(',');return{id,label,reference,shore,cohort,character};});
const samples=registry.filter(sample=>sample.cohort===(diverseCapture?'diverse':'original'));
assert.equal(samples.length,diverseCapture?4:3);
const seed=20261012,grade='medium';
const sha=value=>createHash('sha256').update(value).digest('hex');
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const sourcePaths=['native-construction.html','src/dev/native-construction.ts',registryFile,'src/generation/world-study/native-spatial-construction-reference.ts','src/generation/world-study/native-spatial-construction-shore.ts','src/systems/r100-world/surface-world.ts','src/systems/r100-world/ground.ts','src/systems/r100-world/surface-fields.ts','src/systems/r100-world/surface-bake.ts','src/systems/r100-world/surface-renderer.ts','src/generated/r100-native-spatial.ts','src/generated/r100-native-worlds.ts','src/generated/r100-world-appearance.ts','data/rift-native-spatial-worlds.csv','data/rift-native-spatial-assemblies.csv','data/rift-native-spatial-subordinate-profiles.csv','data/rift-world-appearance.csv',...samples.flatMap(sample=>[sample.reference.slice(1),sample.shore.slice(1)])];
if(macroCapture)sourcePaths.push('src/generation/world-study/native-spatial-construction-macro.ts','data/rift-native-construction-macro-policy.csv');
if(extensionCapture)sourcePaths.push('src/generation/world-study/native-spatial-construction-extension.ts','data/rift-native-construction-extension.csv');
if(extensionCapture)sourcePaths.push('src/generation/world-study/native-volume-raster.ts');
const sourceHashes=async()=>Object.fromEntries(await Promise.all(sourcePaths.map(async file=>[file,sha(await fs.readFile(file))])));
const scalarFields=value=>Object.fromEntries(Object.entries(value??{}).filter(([,entry])=>entry===null||['string','number','boolean'].includes(typeof entry)));
const compactGate=gate=>({...scalarFields(gate),...(Array.isArray(gate?.reasons)?{reasons:gate.reasons}:{}),...(gate?.metrics?{metrics:{...scalarFields(gate.metrics),...(gate.metrics.coverage?{coverage:scalarFields(gate.metrics.coverage)}:{})}}:{})});
const compactExtension=value=>({...scalarFields(value),translation:value.translation,frameBefore:value.frameBefore,frameAfter:value.frameAfter,
  baseCounts:value.baseCounts,finalCounts:value.finalCounts,
  trials:value.trials,additions:value.additions,
  holes:value.holes?.map(hole=>({...scalarFields(hole),rects:hole.rects})),
  solids:value.solids?.map(solid=>({site:solid.site,instanceIds:solid.instances?.map(instance=>instance.id),assembly:scalarFields(solid.assembly)})),
});
const compactState=(value,includeMeasurements=false)=>({
  ...scalarFields(value),cachedSampleIds:value.cachedSampleIds,countsBySample:value.countsBySample,errors:value.errors,
  ...(includeMeasurements?{gates:Object.fromEntries(Object.entries(value.gates??{}).map(([key,gate])=>[key,compactGate(gate)])),geometryMetrics:scalarFields(value.geometryMetrics),sources:value.sources,...(value.macro?{macro:value.macro}:{}),...(value.extension?{extension:compactExtension(value.extension),assessmentIntent:value.assessmentIntent}:{})}:{}),
});
const previousBytes=previousOut?await fs.readFile(path.join(previousOut,'capture.json')):null;
const previousReport=previousBytes?JSON.parse(previousBytes.toString()):null;
const previousPrefix=previousOut?path.relative(out,previousOut).split(path.sep).join('/'):null;
if(previousReport){
  assert.equal(previousReport.status,'passed','The previous capture must be a completed browser receipt, not a map admission');
  assert.deepEqual(previousReport.samples.map(sample=>sample.id),samples.map(sample=>sample.id));
}
await fs.mkdir(out,{recursive:true});
assert(!(await fs.readdir(out)).includes('capture.json'),'Never overwrite a capture receipt');
const report={status:'running',startedAt:new Date().toISOString(),scope:`${samples.length} fixed DEV construction samples; actual material renderer without observation fog, plus actual geometry silhouettes. No r12 search, full content deployment, gameplay admission, or ordinary recipe recovery.`,receiptFormat:'compact-v2: scalar geometry metrics and gate reasons, no repeated witness arrays or full-source snapshots',macroCapture,extensionCapture,diverseCapture,seed,grade,sourceHashes:await sourceHashes(),browserErrors:[],samples:[],cacheRevisits:[]};
if(extensionCapture){const file='data/rift-native-construction-extension.csv';report.extensionPolicy={path:file,sha256:report.sourceHashes[file],csv:await fs.readFile(file,'utf8')};}
if(previousBytes)report.previousCapture={path:path.join(previousOut,'capture.json'),sha256:sha(previousBytes)};
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
    if(macroCapture){
      assert.equal(initial.macro?.scope,'filled-exterior-only','Macro diagnostics must measure the exterior ring');
      assert.equal(sha(await fs.readFile(initial.sources.macroPolicyCSV.slice(1))),initial.sources.macroPolicySHA256,'Macro policy CSV identity differs');
      if(initial.macro.regression)assert.equal(initial.macro.regression.policySourceHash,initial.sources.macroPolicySHA256);
    }
    assert.equal(sha(await fs.readFile(initial.sources.referenceCSV.slice(1))),initial.sources.referenceSHA256,'Reference CSV identity differs');
    assert.equal(sha(await fs.readFile(initial.sources.shoreCSV.slice(1))),initial.sources.shoreSHA256,'Shore CSV identity differs');
    const combinedSources={referenceSHA256:initial.sources.referenceSHA256,shoreSHA256:initial.sources.shoreSHA256};
    if(extensionCapture){
      assert.equal(initial.extension?.algorithm,'coherent-extension-v1','Missing actual extension diagnostics');
      assert.equal(sha(await fs.readFile(initial.sources.extensionCSV.replace(/^\//,''))),initial.sources.extensionSHA256);
      assert.equal(sha(await fs.readFile(initial.sources.extensionModule.replace(/^\//,'').split('?')[0])),initial.sources.extensionModuleSHA256);
      assert.equal(initial.extension.sourceHash,initial.sources.extensionSHA256);
      assert.equal(initial.extension.moduleSourceHash,initial.sources.extensionModuleSHA256);
      assert.equal(initial.extension.combinedSourceHash,initial.sources.combinedSHA256);
      assert(initial.assessmentIntent,'Missing explicit DEV assessment intent');
      Object.assign(combinedSources,{extensionSHA256:initial.sources.extensionSHA256,extensionModuleSHA256:initial.sources.extensionModuleSHA256});
    }
    assert.equal(sha(JSON.stringify(combinedSources)),initial.sources.combinedSHA256);
    const record={...sample,state:compactState(initial,true),exports:[]};report.samples.push(record);await save();
    if(extensionCapture){
      const previous=previousReport?.samples.find(item=>item.id===sample.id).state.geometryMetrics??{holes:initial.extension.baseCounts.holes,solids:initial.extension.baseCounts.solids,positiveLandAreaPx2:null};
      const extension=initial.extension,accepted=extension.additions.length;
      record.extensionCounts={accepted,expectedAddedHoles:accepted*2,actualAddedHoles:extension.holes.length,expectedAddedSolids:accepted,actualAddedSolids:extension.solids.length,
        declaredBaseCounts:extension.baseCounts,declaredFinalCounts:extension.finalCounts,
        expectedFinalHoles:previous.holes+accepted*2,actualFinalHoles:initial.geometryMetrics.holes,
        expectedFinalSolids:previous.solids+accepted,actualFinalSolids:initial.geometryMetrics.solids,
        addedLandToPreviousPositiveLandRatio:previous.positiveLandAreaPx2?extension.addedLandAreaPx2/previous.positiveLandAreaPx2:null};
    }
    for(const mode of ['material','silhouette']){
      const current=await setMode(mode,sample.id);
      assert.deepEqual(current.countsBySample[sample.id],counts,'Mode change reconstructed the sample');
      const data=await canvasData(),bytes=Buffer.from(data.png,'base64'),file=`${sample.id}-${mode}.png`;
      await fs.writeFile(path.join(out,file),bytes,{flag:'wx'});
      record.exports.push({mode,file,width:data.width,height:data.height,bytes:bytes.length,sha256:sha(bytes)});
      await save();
    }
    record.after=compactState(await setMode('material',sample.id));
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
  report.finalState=compactState(await state());report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack??error);process.exitCode=1;}
finally{
  report.sourceHashesAfter=await sourceHashes();
  report.sourcesStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.sourceHashesAfter);
  if(!report.sourcesStable){report.status='failed';process.exitCode=1;}
  await save();await browser.close();
}
const gateLabel=gate=>gate?.accepted?'通过':'未过';
const previousOffset=id=>report.samples.find(sample=>sample.id===id)?.state.extension?.translation??{x:0,y:0};
const comparedExports=previousReport?[
  ...previousReport.samples.flatMap(sample=>sample.exports.map(item=>({...item,...previousOffset(sample.id)}))),
  ...report.samples.flatMap(sample=>sample.exports.map(item=>({...item,x:0,y:0}))),
]:[];
let comparisonFrame=null;
if(comparedExports.length){
  const x=Math.min(0,...comparedExports.map(item=>item.x)),y=Math.min(0,...comparedExports.map(item=>item.y));
  comparisonFrame={x,y,width:Math.max(...comparedExports.map(item=>item.x+item.width))-x,height:Math.max(...comparedExports.map(item=>item.y+item.height))-y};
  report.comparisonPresentation={commonFrame:comparisonFrame,previousOffsets:Object.fromEntries(report.samples.map(sample=>[sample.id,previousOffset(sample.id)])),rawPNGsUnmodified:true};
  await save();
}
const imageLink=(sample,item,prefix,label)=>{
  if(!item)return`<p>${esc(label)}未采集，见失败回执。</p>`;
  const offset=prefix?previousOffset(sample.id):{x:0,y:0};
  const picture=`<img src="${esc(prefix+item.file)}" alt="${esc(sample.label+' '+label)}" width="${item.width}" height="${item.height}"${comparisonFrame?` style="width:${item.width/comparisonFrame.width*100}%;height:${item.height/comparisonFrame.height*100}%;left:${(offset.x-comparisonFrame.x)/comparisonFrame.width*100}%;top:${(offset.y-comparisonFrame.y)/comparisonFrame.height*100}%"`:''}>`;
  return`<a class="image" href="${esc(prefix+item.file)}" target="_blank" rel="noopener"><span>${esc(label)} · ${item.width} × ${item.height}</span>${comparisonFrame?`<div class="comparison-frame" style="aspect-ratio:${comparisonFrame.width}/${comparisonFrame.height}">${picture}</div>`:picture}</a>`;
};
const cards=report.samples.map(sample=>{
  let views;
  if(previousReport){
    const previous=previousReport.samples.find(item=>item.id===sample.id);
    const pair=mode=>`<div class="views">${imageLink(sample,previous.exports.find(item=>item.mode===mode),`${previousPrefix}/`,'此前')}${imageLink(sample,sample.exports.find(item=>item.mode===mode),'','本轮')}</div>`;
    views=`${pair('silhouette')}<details><summary>真实材质 · 去雾</summary>${pair('material')}</details>`;
  }else views=`<div class="views">${sample.exports.map(item=>imageLink(sample,item,'',item.mode==='material'?'真实材质 · 去雾':'实际剪影')).join('')}</div>`;
  const extension=sample.state.extension;
  const extensionNote=extension?`<p>扩展 ${extension.additions.length} 处 · 新增地块 ${Math.round(extension.addedLandAreaPx2).toLocaleString('en-US')} px² · 画框 ${extension.frameBefore.join(' × ')} → ${extension.frameAfter.join(' × ')} · 主体平移 ${extension.translation.x}, ${extension.translation.y} px</p>`:'';
  return `<section id="${sample.id}"><header><h2>${esc(sample.label)}</h2>${diverseCapture?`<span>${esc(sample.character)}</span>`:''}<a href="${esc(origin)}/native-construction.html?sample=${sample.id}">打开 DEV</a></header><p>外岸${gateLabel(sample.state.gates?.boundary)} · 几何门${gateLabel(sample.state.gates?.geometry)} · G2${gateLabel(sample.state.gates?.visibility)}</p>${extensionNote}${views}</section>`;
}).join('\n');
await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>参差岸 · ${galleryTitle}</title><style>body{margin:0;background:#10161b;color:#e1e5e3;font:16px/1.6 system-ui,"PingFang SC",sans-serif}main{max-width:1480px;margin:auto;padding:28px}h1{font-size:26px;margin:0}p{color:#a6b4b5;margin:8px 0}nav{display:flex;gap:22px;margin:22px 0}a{color:#c9d8d7;text-decoration:none}a:hover{text-decoration:underline}section{margin:28px 0 52px;scroll-margin-top:20px}header{display:flex;align-items:baseline;gap:22px}h2{font-size:20px}.views{display:grid;grid-template-columns:1fr 1fr;gap:20px}.image{display:block;background:#0b1115;padding:12px}.image span{display:block;margin-bottom:10px;color:#b1bdbc}img{width:100%;height:auto;display:block;image-rendering:pixelated}.comparison-frame{position:relative;width:100%;background:#080d10}.comparison-frame img{position:absolute;top:0;left:0}.overview img{height:280px;object-fit:contain}details{margin-top:14px}summary{cursor:pointer;padding:8px 0;color:#b1bdbc}footer{color:#8d9d9e;font-size:13px}</style><main><h1>参差岸 · ${galleryTitle}</h1>${diverseCapture?'<p>四个现有世界的原配色与实体。共同应用矩形拼合、自由断缘和偏置宽臂规则；下方可对照结构剪影。</p>':''}<p>中污染 · 固定种子 ${seed} · 点击看原尺寸</p><p>${macroCapture&&!diverseCapture?'左：此前 · 右：本轮。同一像素比例、同等画框；旧主体按实际平移对齐。材质可展开。指标仅为诊断。':'DEV 固定样本。'} 未通过完整地图准入。</p>${diverseCapture?`<div class="views overview">${report.samples.map(sample=>`<a class=image href="#${sample.id}"><strong>${esc(sample.label)}</strong><p>${esc(sample.character)}</p><img src="${sample.id}-material.png" alt="${esc(sample.label)}去雾材质全图"></a>`).join('')}</div>`:''}<nav>${samples.map(sample=>`<a href="#${sample.id}">${esc(sample.label)}</a>`).join('')}</nav>${cards}<footer><a href="capture.json">采集回执</a>${previousPrefix?` · <a href="${previousPrefix}/index.html">此前图册</a>`:''} · 实际画布导出，无生成后修图。</footer></main></html>\n`);
console.log(JSON.stringify({status:report.status,samples:report.samples.length,errors:report.browserErrors,sourcesStable:report.sourcesStable,output:out}));
