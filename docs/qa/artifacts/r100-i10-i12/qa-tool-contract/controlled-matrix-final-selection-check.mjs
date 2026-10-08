/** Source-expression contract only. Never generates a world or renders a frame. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { transformSync } from 'esbuild';
const area='docs/qa/artifacts/r100-i10-i12/qa-tool-contract';
const harness='tools/qa/check-r100-presentation-phases.ts';
const source=fs.readFileSync(harness,'utf8');
const start=source.indexOf('const hash = '), end=source.indexOf('const rows: ');
assert(start>=0 && end>start);
const expression=source.slice(start,end)+'\nreturn {finalMatrix,selected,phases};';
const compiled=transformSync(expression,{loader:'ts',target:'node22',define:{'process.env.QA_MATRIX_FINAL':'"1"'}}).code;
const run=new Function('assert','createHash','readFileSync','R100_NATIVE_WORLDS','process',compiled);
const catalogSource=fs.readFileSync('src/generated/r100-native-worlds.ts','utf8');
const marker='export const R100_NATIVE_WORLDS: readonly R100NativeWorldEntry[] = ';
const catalog=JSON.parse(catalogSource.slice(catalogSource.indexOf(marker)+marker.length).trim().replace(/;$/,''));
assert.equal(catalog.length,108);
const tests=[];
function probe(name,change={},reject=false){
 const invoke=()=>run(assert,createHash,change.read??fs.readFileSync,change.catalog??catalog,{env:change.env??{}});
 if(reject)assert.throws(invoke,assert.AssertionError,name);else{const r=invoke();assert.equal(r.finalMatrix,true);assert.equal(r.selected.length,108);assert.equal(r.phases.length,6);}
 tests.push({name,result:reject?'rejected-before-world-generation':'accepted-final108-selection'});
}
probe('Current real108 catalog and original fixed plan');
probe('Runtime QA_MATRIX_FINAL=0 cannot disable compiled final gate',{env:{QA_MATRIX_FINAL:'0'}});
probe('QA_WORLDS explicit one-world subset',{env:{QA_WORLDS:catalog[0].id}},true);
probe('QA_WORLDS empty override',{env:{QA_WORLDS:''}},true);
probe('Stale104 generated catalog',{catalog:catalog.slice(0,104)},true);
probe('Same count duplicate replaces a planned world',{catalog:[...catalog.slice(0,107),catalog[0]]},true);
probe('Same count unknown replaces a planned world',{catalog:[...catalog.slice(0,107),{...catalog[107],id:'not-in-frozen-plan'}]},true);
probe('Modified plan bytes despite identical parsed data',{read:file=>Buffer.concat([fs.readFileSync(file),Buffer.from('\n')])},true);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={status:'pass-source-expression-contract',harness:{path:harness,sha256:sha(fs.readFileSync(harness))},extractedExpressionSha256:sha(expression),compiledFinalDefine:'process.env.QA_MATRIX_FINAL=1',tests,scope:'Runs the real harness selection-prefix expressions under the same esbuild final define, against the actual108 catalog and original plan. Six intentional invalid input variants reject before any runtime/map imports; no matrix, game, browser, rendered pixels or audio was executed.'};
const output=area+'/controlled-matrix-final-selection-check.json';assert(!fs.existsSync(output));fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,tests:tests.length}));
