/** Frozen closures and asset paths are reproducible integrity contracts. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as factory from '../../src/generation/legacy-r100-v8/executor-revision8.js';
import * as recovery from '../../src/generation/legacy-r100-v8/executor-recovery.js';
const root='src/generation/legacy-r100-v8',sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(fs.readFileSync(`${root}/manifest-recovery.json`,'utf8'));
assert.equal(manifest.sourceRevision,'7c744d3dabdee45cafbafe375878f81bae328c1c');
assert.equal(sha(fs.readFileSync(`${root}/executor-recovery.js`)),manifest.executorSha256);
assert.equal(sha(fs.readFileSync(manifest.source.path)),manifest.source.sha256);
const revision=manifest.sourceRevision;
const source=['data/rift-master-materials.csv','data/rift-material-organizations.csv'].map(file=>execFileSync('git',['show',`${revision}:${file}`],{encoding:'utf8'})).join('\n');
const paths=[...new Set([...source.matchAll(/\/assets\/[a-zA-Z0-9_./-]+\.png/g)].map(match=>`public${match[0]}`))].sort();
const assets=paths.map(file=>({path:file,sha256:sha(execFileSync('git',['show',`${revision}:${file}`],{maxBuffer:16*1024*1024}))}));
for(const asset of assets)assert.equal(sha(fs.readFileSync(asset.path)),asset.sha256,`Immutable material path changed: ${asset.path}`);
const assetReceipt=JSON.stringify({sourceRevision:revision,assets},null,2)+'\n',assetPath=`${root}/assets.json`;
if(process.argv.includes('--write-assets')){assert(!fs.existsSync(assetPath));fs.writeFileSync(assetPath,assetReceipt,{flag:'wx'});}
else assert.equal(fs.readFileSync(assetPath,'utf8'),assetReceipt);
let recipes=0;
for(const id of manifest.projection.ids)for(const grade of ['low','medium','severe']){
 const recipe=factory.createR100ProductionRecipe(id,20261012,grade);
 assert(factory.validR100ProductionRecipe(recipe)&&recovery.validR100ProductionRecipe(recipe));
 const relabelled=structuredClone(recipe);relabelled.package.algorithmRevision=9;
 assert(!recovery.validR100ProductionRecipe(relabelled),'Frozen r8 cannot accept a relabelled r9');
 recipes++;
}
const report={status:'passed',sourceRevision:revision,assets:assets.length,oldRecipesValidated:recipes,relabelled9Rejected:true,
 executors:[{path:`${root}/executor-revision8.js`,sha256:manifest.source.sha256},{path:`${root}/executor-recovery.js`,sha256:manifest.executorSha256}],
 limitations:['Integrity, all historical recipe validation and immutable asset paths only; full-map/material replay and browser continuation use separate gates.']};
const flag=process.argv.indexOf('--report');if(flag>=0)fs.writeFileSync(process.argv[flag+1],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));
