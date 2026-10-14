/** Render one saved rejected proposal. Never invokes a layout sampler or deploys content. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import sharp from 'sharp';

const [candidateFile,inputFile,output,diagnosticMode]=process.argv.slice(2);
assert(candidateFile&&inputFile&&output,'Usage: render-saved-proposal.mjs CANDIDATE INPUT_OR_RECEIPT NEW_DIRECTORY [--deep]');
assert(diagnosticMode===undefined||diagnosticMode==='--deep');
assert(!fs.existsSync(output),'Evidence directory must be new');
const root=process.cwd(),candidate=JSON.parse(fs.readFileSync(candidateFile,'utf8')),savedInput=JSON.parse(fs.readFileSync(inputFile,'utf8'));
const expectedHash=candidate.geometryHash??savedInput.after?.hash;
const geometrySeed=savedInput.geometrySeed??savedInput.work?.geometrySeed;
const frozenInput=candidate.input??savedInput.input;
const savedGate=candidate.gate??savedInput.after?.gate;
assert(candidate.proposal?.definition&&expectedHash&&savedGate);
assert.equal(typeof geometrySeed,'number');
const stem=`candidate-${String(candidate.proposal.candidate).padStart(3,'0')}`;
const geometryFile='src/generation/world-study/native-spatial-geometry.ts';
const generationFile='src/generation/world-study/native-spatial-generation.ts';
const measureFile='src/generation/world-study/native-spatial-measure.ts';
const sha=value=>createHash('sha256').update(value).digest('hex');
const resolveImport=(parent,spec)=>{
  if(!spec.startsWith('.')&&!spec.startsWith('@/'))return null;
  const base=spec.startsWith('@/')?path.resolve(root,'src',spec.slice(2)):path.resolve(path.dirname(parent),spec);
  return [base,base+'.ts',base+'.js',base+'.json',path.join(base,'index.ts')].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile())??null;
};
const dependencies=new Set();
function collect(file){
  const absolute=path.resolve(root,file);if(dependencies.has(absolute))return;dependencies.add(absolute);
  if(!/\.[cm]?[jt]s$/.test(absolute))return;
  const ast=ts.createSourceFile(absolute,fs.readFileSync(absolute,'utf8'),ts.ScriptTarget.Latest,true);
  for(const node of ast.statements){
    if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){
      if(node.isTypeOnly||node.importClause?.isTypeOnly)continue;
      const resolved=resolveImport(absolute,node.moduleSpecifier.text);if(resolved)collect(resolved);
    }
  }
}
collect(geometryFile);if(diagnosticMode==='--deep')collect(measureFile);
dependencies.add(path.resolve(candidateFile));dependencies.add(path.resolve(inputFile));dependencies.add(path.resolve('tools/native-spatial/render-saved-proposal.mjs'));
function fingerprintFunctionSource(){
  const source=fs.readFileSync(generationFile,'utf8'),ast=ts.createSourceFile(generationFile,source,ts.ScriptTarget.Latest,true);
  const fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='nativeSpatialGeometryFingerprint');
  assert(fn);return fn.getText(ast);
}
const snapshot=()=>({...Object.fromEntries([...dependencies].sort().map(p=>[path.relative(root,p),sha(fs.readFileSync(p))])),[generationFile+'#nativeSpatialGeometryFingerprint']:sha(fingerprintFunctionSource())});
const before=snapshot(),startedAt=new Date().toISOString();
const {buildNativeSpatialGeometry}=await import(pathToFileURL(path.resolve(geometryFile)).href);
const {nativeSpatialGeometryFingerprint}=await import(pathToFileURL(path.resolve(generationFile)).href);
const start=performance.now(),geometry=buildNativeSpatialGeometry(candidate.proposal.definition,geometrySeed);
const compileMs=performance.now()-start,fingerprint=nativeSpatialGeometryFingerprint(geometry,candidate.proposal);
assert.equal(fingerprint.hash,expectedHash,'Saved geometry must reproduce exactly');
let observed,actualGate,measureMs,diagnostic;
if(diagnosticMode==='--deep'){
  assert(frozenInput?.policy&&frozenInput?.world,'Deep overlay requires the original frozen authoring input');
  const {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry}=await import(pathToFileURL(path.resolve(measureFile)).href);
  const proposal=candidate.proposal,groups=identifyNativeSpatialStructures(geometry,proposal.assemblies,frozenInput.policy),measureStart=performance.now();
  let observerCalls=0;
  actualGate=evaluateNativeSpatialGeometry(geometry,groups,frozenInput.policy,frozenInput.world,
    {placements:proposal.holes,profiles:frozenInput.holeProfiles},
    {landRects:proposal.plan.land,placements:proposal.bays,landJoins:proposal.landJoins,profiles:frozenInput.bayProfiles,allowedCounts:frozenInput.world.bayCountOptions,minWideJoinPx:frozenInput.world.landRectMinOverlapPx},
    value=>{observerCalls++;observed=value;});
  measureMs=performance.now()-measureStart;
  assert.equal(observerCalls,1);assert(observed);assert.deepEqual(actualGate,savedGate,'Current official gate must exactly reproduce the saved gate');
  const point=actualGate.metrics.worstDeepPoint,cell=Math.floor(point.y/observed.cellSizePx)*observed.cols+Math.floor(point.x/observed.cellSizePx);
  const worstComponentIndex=observed.deepComponents.findIndex(cells=>cells.includes(cell));assert(worstComponentIndex>=0);
  const cells=observed.deepComponents[worstComponentIndex],cellPx=observed.cellSizePx;
  const xs=cells.map(c=>(c%observed.cols)*cellPx),ys=cells.map(c=>Math.floor(c/observed.cols)*cellPx);
  const bounds={minX:Math.min(...xs),minY:Math.min(...ys),maxX:Math.max(...xs)+cellPx,maxY:Math.max(...ys)+cellPx};
  assert.deepEqual(bounds,actualGate.metrics.worstDeepBounds);
  const spanPx=Math.max(bounds.maxX-bounds.minX,bounds.maxY-bounds.minY);assert.equal(spanPx,actualGate.metrics.maxDeepSpanPx);
  const rasterAreaPx2=cells.length*cellPx*cellPx,bboxAreaPx2=(bounds.maxX-bounds.minX)*(bounds.maxY-bounds.minY);
  diagnostic={observerCalls,officialGeometryGateCalls:1,source:'Detached masks and connected components delivered by evaluateNativeSpatialGeometry; no reimplementation of deep classification, erosion or connectivity.',cellSizePx:cellPx,deepThresholdPx:observed.deepThresholdPx,distanceCellUpperErrorPx:observed.distanceCellUpperErrorPx,deepCells:observed.deep.reduce((a,b)=>a+b,0),deepBodyCells:observed.deepBody.reduce((a,b)=>a+b,0),componentCount:observed.deepComponents.length,worstComponentIndex,worstComponent:{cellCount:cells.length,cells,bounds,spanPx,rasterAreaPx2,bboxAreaPx2,bboxFillRatio:rasterAreaPx2/bboxAreaPx2},areaMeaning:'Cell-count area of the observed body-centre mask, not exact continuous exposed land area.'};
}
const {terrain}=geometry,width=terrain.cols*8,height=terrain.rows*8,scale=.5;
const pngWidth=width*scale,pngHeight=height*scale;
fs.mkdirSync(output,{recursive:true});
const pixelImage=async(colors,file)=>{
  const rgba=Buffer.alloc(terrain.cols*terrain.rows*4);
  for(let i=0;i<terrain.matter.length;i++){const color=terrain.matter[i]?colors.floor:colors.void;for(let c=0;c<3;c++)rgba[i*4+c]=color[c];rgba[i*4+3]=255;}
  await sharp(rgba,{raw:{width:terrain.cols,height:terrain.rows,channels:4}}).resize(pngWidth,pngHeight,{kernel:'nearest'}).png().toFile(path.join(output,file));
};
await pixelImage({floor:[255,255,255],void:[0,0,0]},`${stem}-topology.png`);
await pixelImage({floor:[133,152,149],void:[4,7,8]},`${stem}-floor.png`);
const triangles=geometry.solidPrimitives.map(p=>`<polygon points="${p.points.reduce((s,n,i)=>s+(i%2?',':' ')+n,'').trim()}"/>`).join('');
const base=fs.readFileSync(path.join(output,`${stem}-floor.png`));
const overlay=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pngWidth}" height="${pngHeight}" viewBox="0 0 ${width} ${height}"><g fill="#c09159" shape-rendering="crispEdges">${triangles}</g></svg>`);
const structure=await sharp(base).composite([{input:overlay}]).png().toBuffer();
fs.writeFileSync(path.join(output,`${stem}-structure.png`),structure);
fs.unlinkSync(path.join(output,`${stem}-floor.png`));
const outline=candidate.proposal.definition.terrainOutline;
const outer=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pngWidth}" height="${pngHeight}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="black"/><polygon points="${outline.map(p=>p.x+','+p.y).join(' ')}" fill="white"/></svg>`);
await sharp(outer).png().toFile(path.join(output,`${stem}-outer.png`));
if(observed){
  const colors=Buffer.alloc(terrain.cols*terrain.rows*4),worstCells=new Set(diagnostic.worstComponent.cells);
  for(let cell=0;cell<observed.deep.length;cell++){
    const color=worstCells.has(cell)?[255,101,94,235]:observed.deepBody[cell]?[161,105,189,190]:observed.deep[cell]?[103,82,162,95]:null;
    if(color)for(let c=0;c<4;c++)colors[cell*4+c]=color[c];
  }
  const masks=await sharp(colors,{raw:{width:terrain.cols,height:terrain.rows,channels:4}}).resize(pngWidth,pngHeight,{kernel:'nearest'}).png().toBuffer();
  fs.writeFileSync(path.join(output,`${stem}-deep-mask.png`),masks);
  const b=diagnostic.worstComponent.bounds,p=savedGate.metrics.worstEmptyPoint;
  const marks=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pngWidth}" height="${pngHeight}" viewBox="0 0 ${width} ${height}"><g fill="none" stroke="#fff" stroke-width="2"><rect x="${b.minX}" y="${b.minY}" width="${b.maxX-b.minX}" height="${b.maxY-b.minY}" stroke-dasharray="12 8"/><circle cx="${p.x}" cy="${p.y}" r="10" stroke-width="4"/><path d="M${p.x-22} ${p.y}h44M${p.x} ${p.y-22}v44"/></g><g font-family="sans-serif" font-size="22" fill="#fff"><text x="24" y="35">Saved c${candidate.proposal.candidate} · REJECTED · ${fingerprint.hash}</text><text x="24" y="67" fill="#ff655e">Red: actual worst deepBody component</text><text x="24" y="99" fill="#ba98d2">Purple: other deepBody · dim purple: deep-only fringe</text><text x="${b.minX+12}" y="${b.minY-14}">${b.maxX-b.minX} × ${b.maxY-b.minY} bbox · fill ${(diagnostic.worstComponent.bboxFillRatio*100).toFixed(1)}%</text><text x="${p.x+30}" y="${p.y-22}">max empty (${p.x}, ${p.y})</text></g></svg>`);
  await sharp(structure).composite([{input:masks},{input:marks}]).png().toFile(path.join(output,`${stem}-deep-overlay.png`));
}
const after=snapshot();assert.deepEqual(after,before,'Actual rendering dependencies changed');
const report={status:'rendered-rejected-diagnostic',startedAt,finishedAt:new Date().toISOString(),candidateFile,inputFile,geometrySeed,geometryHash:fingerprint.hash,canonicalSha256:sha(fingerprint.canonical),actualCompilations:1,layoutSamplerCalls:0,compileMs,measureMs,diagnostic,sourceHashes:before,sourceHashesAfter:after,sourcesStable:true,sourceScope:'Runtime geometry and optional official measurement import closures plus the directly called official fingerprint function body. Layout/controller modules are not executed by this diagnostic; their unrelated edits are deliberately not treated as geometry changes.',render:{worldWidth:width,worldHeight:height,outputWidth:pngWidth,outputHeight:pngHeight,worldPxPerImagePx:2,terrain:'Official 8px matter raster',solids:'Actual projected solid triangles, not bounding boxes',palette:'Geometry diagnostic false colors; not game materials'},gate:savedGate,limits:['Rejected saved candidate, not an admitted map.','No new seed, new layout, parameter edits, full deployment, G4 or G5.','No lighting, materials, fog, actors, enemies or search remains.','Terrain identity and shape only; does not establish production readability or gameplay quality.']};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,geometryHash:fingerprint.hash,sourcesStable:true,actualCompilations:1,compileMs,gateAccepted:savedGate.accepted,reasons:savedGate.reasons}));
