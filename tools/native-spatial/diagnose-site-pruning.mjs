/** Read-only instrumented copy: score rejected/pruned sites without changing
 * production selection, then compare the previous objective at the same base. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {build} from 'esbuild';import sharp from 'sharp';
import * as data from '../../src/generated/r100-native-spatial.ts';
import {createR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createNativeSpatialLayout} from '../../src/generation/world-study/native-spatial-layout.ts';
import {buildNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {nativeSpatialGeometryFingerprint} from '../../src/generation/world-study/native-spatial-generation.ts';
import {TileType} from '../../src/types/game-types.ts';
const [out]=process.argv.slice(2);assert(out&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const source='docs/qa/artifacts/native-spatial-2026-10-14/production-gel-feedback-round1.json',production=JSON.parse(fs.readFileSync(source)),trace=production.failures[0].diagnostics.attempts[0],seed=20261012;
const native=createR100ProductionRecipe('gel-rafts',seed,'medium').nativeDefinition,input={policy:data.NATIVE_SPATIAL_POLICY,world:data.NATIVE_SPATIAL_WORLDS.find(w=>w.worldId==='gel-rafts'),holeProfiles:data.NATIVE_SPATIAL_HOLE_PROFILES,bayProfiles:data.NATIVE_SPATIAL_BAY_PROFILES,assemblies:data.NATIVE_SPATIAL_ASSEMBLIES.filter(a=>a.worldId==='gel-rafts'&&(a.grade==='all'||a.grade==='medium')),subordinateProfiles:data.NATIVE_SPATIAL_SUBORDINATE_PROFILES.filter(p=>p.family===native.family)};
const receipts=new Map(),replay=[];
for(const candidate of [9,15,16]){const row=trace.candidates.find(r=>r.candidate===candidate),base=receipts.get(row.feedbackBaseCandidate),proposal=createNativeSpatialLayout(native,input,seed,seed,candidate,base?{layout:base,gate:trace.candidates.find(r=>r.candidate===row.feedbackBaseCandidate).gates.geometry}:undefined,row.countPairIndex,row.bayCountIndex),g=buildNativeSpatialGeometry(proposal.definition,seed),hash=nativeSpatialGeometryFingerprint(g,proposal).hash;assert.equal(hash,row.geometryHash);receipts.set(candidate,proposal);replay.push({candidate,hash});}
const base=receipts.get(16),baseGate=trace.candidates.find(r=>r.candidate===16).gates.geometry;
fs.writeFileSync(path.join(out,'candidate-16.json'),JSON.stringify({input,proposal:base,gate:baseGate},null,2)+'\n');
const g=buildNativeSpatialGeometry(base.definition,seed),tile=g.terrain.tileMap,rgba=Buffer.alloc(tile.cols*tile.rows*4);
for(let y=0;y<tile.rows;y++)for(let x=0;x<tile.cols;x++){const c=tile.tiles[y][x]===TileType.VOID?[4,7,8]:tile.tiles[y][x]===TileType.WALL?[192,145,89]:[133,152,149],at=(y*tile.cols+x)*4;for(let j=0;j<3;j++)rgba[at+j]=c[j];rgba[at+3]=255;}
const markers=Buffer.from(`<svg width="${tile.cols*4}" height="${tile.rows*4}"><circle cx="414" cy="618" r="80" stroke="#ff655e" stroke-width="2" fill="none"/><circle cx="414" cy="618" r="5" fill="#ff655e"/><text x="425" y="615" fill="#ff655e" font-size="14">worst (828,1236)</text></svg>`);
await sharp(rgba,{raw:{width:tile.cols,height:tile.rows,channels:4}}).resize(tile.cols*4,tile.rows*4,{kernel:'nearest'}).composite([{input:markers}]).png().toFile(path.join(out,'candidate-16.png'));
const modulePath='src/generation/world-study/native-spatial-layout.ts',original=fs.readFileSync(modulePath,'utf8');
const report={scope:'No production edit; c9/15/16 exact replay, instrumented c19 from same c16. Extra evaluations are diagnostic only and cannot win production selection.',source,layoutHash:createHash('sha256').update(original).digest('hex'),replay,comparisons:[]};
async function instrument(mode){
 let text=original;const replace=(a,b)=>{assert(text.includes(a),a);text=text.replace(a,b);};
 replace('  // Relief needs real land support',`  const record={kind:object.source.kind,profileId:object.source.profileId,ids:object.source.instances.map(i=>i.id),site:object.source.site,wideCorrection,preferred,areaPointCount,fieldLength:field.length,hotspotFields:preferred.map(p=>({point:p,index:field.findIndex(q=>q.x===p.x&&q.y===p.y)})),candidates:[]};globalThis.__nativeSiteDiagnostics.push(record);let lastComponents,roughRank=0;\n  // Relief needs real land support`);
 replace('    return (coverExcess*coverExcess+deepExcess*deepExcess+4*wideExcess*wideExcess)*100000+score/Math.max(1,walk);',`    if(!indices)lastComponents={maximum,walk,areaWalk,wide,estimatedWide,coverExcess,deepExcess,wideExcess,meanExcess:score/Math.max(1,walk)};\n    return (coverExcess*coverExcess+deepExcess*deepExcess+4*wideExcess*wideExcess)*100000+score/Math.max(1,walk);`);
 replace('  for(const {p}of rough){',`  for(const {p,score:roughScore}of rough){\n    const entry={p,roughRank:roughRank++,roughScore,hotspot:preferred.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<=70)};record.candidates.push(entry);`);
 replace('    if(ground.margin(p)<24)continue;',`    if(ground.margin(p)<24){entry.reject='anchor-coast';continue;}`);
 replace('    if(support.some(q=>ground.margin({x:p.x+q.x,y:p.y+q.y})<24||nativePrimitiveDistance(holes,p.x+q.x,p.y+q.y)<24))continue;',`    if(support.some(q=>ground.margin({x:p.x+q.x,y:p.y+q.y})<24||nativePrimitiveDistance(holes,p.x+q.x,p.y+q.y)<24)){entry.reject='support-vertex';continue;}`);
 replace('    if(!ground.supportsFootprint(object.support,p))continue;',`    if(!ground.supportsFootprint(object.support,p)){entry.reject='support-footprint';continue;}`);
 replace('    if(body.some(q=>nativePrimitiveDistance(forbiddenTree,p.x+q.x,p.y+q.y)<input.policy.wideRadiusPx*1.5||nativePrimitiveDistance(reliefTree,p.x+q.x,p.y+q.y)<24))continue;',`    if(body.some(q=>nativePrimitiveDistance(forbiddenTree,p.x+q.x,p.y+q.y)<input.policy.wideRadiusPx*1.5||nativePrimitiveDistance(reliefTree,p.x+q.x,p.y+q.y)<24)){entry.reject='structure-or-relief';continue;}`);
 replace('    if(blockingPoints.some(q=>nativePrimitiveDistance(shiftedTree,q.x,q.y)<input.policy.wideRadiusPx*1.5)||reliefPoints.some(q=>nativePrimitiveDistance(shiftedTree,q.x,q.y)<24))continue;',`    if(blockingPoints.some(q=>nativePrimitiveDistance(shiftedTree,q.x,q.y)<input.policy.wideRadiusPx*1.5)||reliefPoints.some(q=>nativePrimitiveDistance(shiftedTree,q.x,q.y)<24)){entry.reject='symmetric-structure-or-relief';continue;}`);
 replace('    if(score<best){best=score;chosen=p;}if(++legalCount>=12)break;',`    entry.legalRank=legalCount;entry.fullScore=score;entry.components={...lastComponents};entry.worstDistance=Math.min(nativePrimitiveDistance(coverageTree,828,1236),nativePrimitiveDistance(bodyTree,828-p.x,1236-p.y));\n    if(legalCount<12&&score<best){best=score;chosen=p;}legalCount++;`);
 replace("  if(!chosen)throw new Error('Joint layout has no supported non-overlapping site for the next complete object');",`  record.chosen=chosen;record.best=best;record.legalCount=legalCount;\n  if(!chosen)throw new Error('Joint layout has no supported non-overlapping site for the next complete object');`);
 if(mode==='old-objective'){
   replace('      wideCorrection=actualWide-priorRaw;','      wideCorrection=0;');
   replace('if(fieldIndex<areaPointCount)', 'if(fieldIndex<field.length)');
 }
 const result=await build({stdin:{contents:text,loader:'ts',resolveDir:path.resolve('src/generation/world-study')},bundle:true,write:false,platform:'node',format:'esm',tsconfig:'tsconfig.json'});globalThis.__nativeSiteDiagnostics=[];
 const module=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 const start=performance.now(),proposal=module.createNativeSpatialLayout(native,input,seed,seed,19,{layout:base,gate:baseGate}),diagnostics=globalThis.__nativeSiteDiagnostics,geometry=buildNativeSpatialGeometry(proposal.definition,seed),hash=nativeSpatialGeometryFingerprint(geometry,proposal).hash;
 const expected=(mode==='current'?production:JSON.parse(fs.readFileSync('docs/qa/artifacts/native-spatial-2026-10-14/production-gel-core-shoulder-round1.json'))).failures[0].diagnostics.attempts[0].candidates.find(r=>r.candidate===19).geometryHash;assert.equal(hash,expected,`Instrumentation changed ${mode} selection`);
 fs.writeFileSync(path.join(out,`${mode}.json`),JSON.stringify({mode,proposal,diagnostics,geometryHash:hash,ms:performance.now()-start},null,2)+'\n');
 report.comparisons.push({mode,geometryHash:hash,ms:performance.now()-start,objects:diagnostics.map(d=>({kind:d.kind,profileId:d.profileId,ids:d.ids,site:d.site,chosen:d.chosen,best:d.best,legalCount:d.legalCount,hotspotFields:d.hotspotFields,chosenDetails:d.candidates.find(c=>c.p.x===d.chosen.x&&c.p.y===d.chosen.y),betterPruned:d.candidates.filter(c=>c.legalRank>=12&&c.fullScore<d.best).sort((a,b)=>a.fullScore-b.fullScore).slice(0,3),bestCovering:d.candidates.filter(c=>c.worstDistance<154.35).sort((a,b)=>a.fullScore-b.fullScore).slice(0,3)}))});
 console.log(mode,hash,Math.round(performance.now()-start)+'ms');
}
await instrument('current');await instrument('old-objective');
report.sourcesStable=createHash('sha256').update(fs.readFileSync(modulePath)).digest('hex')===report.layoutHash;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
