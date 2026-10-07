import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.cwd(), base=path.join(root,'docs/qa/artifacts/r100-i10-i12');
const current=fs.readFileSync('data/rift-native-worlds.csv','utf8');
const sha=s=>createHash('sha256').update(s).digest('hex');
for(const batch of ['b07','b08','b09','b10']){
 const out='/tmp/r100-i11-'+batch+'-catalog';
 for(const file of ['src/generation/world-study/r100-generated-scenes.ts','src/generated/rift-world-profile-data.ts']){
  fs.mkdirSync(path.dirname(path.join(out,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(out,file));
 }
 const dir=path.join(base,batch+'-isolated-author'),csv=fs.readFileSync(path.join(dir,'native-draft.csv'),'utf8');
 const rows=csv.trim().split('\n'); assert.equal(rows.length,5);assert.equal(rows[0],current.split('\n')[0]);
 fs.mkdirSync(out+'/data',{recursive:true});fs.writeFileSync(out+'/data/rift-native-worlds.csv',current+rows.slice(1).join('\n')+'\n');
 const result=spawnSync(process.execPath,[path.join(root,'tools/world-study/codegen-r100-worlds.mjs')],{cwd:out,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);console.log('compiled',batch);
 fs.writeFileSync(path.join(dir,'preparation.json'),JSON.stringify({status:'isolated-author-awaiting-checks',sourceCsv:batch+'-isolated-author/native-draft.csv',sourceSha256:sha(csv),formalCatalogSha256:sha(current),compiledCatalog:out+'/src/generated/r100-native-worlds.ts',compiledSha256:sha(fs.readFileSync(out+'/src/generated/r100-native-worlds.ts'))},null,2)+'\n');
}
assert.equal(fs.readFileSync('data/rift-native-worlds.csv','utf8'),current);
