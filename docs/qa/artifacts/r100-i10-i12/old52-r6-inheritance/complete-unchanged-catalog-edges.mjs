import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import ts from 'typescript';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const base='docs/qa/artifacts/r100-i10-i12/',to=base+'b12-source/source-snapshot.json',after=JSON.parse(fs.readFileSync(to));
const sha=b=>createHash('sha256').update(b).digest('hex'),ref=p=>({path:p,sha256:sha(fs.readFileSync(p))});
const literal=(snapshot,file,name)=>{const src=fs.readFileSync(path.join(snapshot.temporaryRoot,file),'utf8');assert.equal(sha(src),snapshot.sources[file]);const ast=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true);for(const n of ast.statements)if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations)if(d.name.getText(ast)===name){let v=d.initializer;while(ts.isAsExpression(v)||ts.isSatisfiesExpression(v))v=v.expression;return JSON.parse(v.getText(ast));}throw Error(name);};
const fields=[['src/generated/r100-native-worlds.ts','R100_NATIVE_WORLDS','id'],['src/generated/r100-world-appearance.ts','R100_WORLD_APPEARANCES','worldId'],['src/generated/rift-search-remains.ts','SEARCH_REMAINS','worldId']];
const current=fields.map(([file,name])=>literal(after,file,name));
const execution={status:'running',after:ref(to),tool:ref('tools/qa/r100-source-continuity.mjs'),stages:[]},output=base+'old52-r6-inheritance/unchanged-catalog-edges-execution.json';assert(!fs.existsSync(output));
const save=()=>fs.writeFileSync(output,JSON.stringify(execution,null,2)+'\n');save();
try{for(const folder of ['b03-shard-refined-source','b04-buried-raised-source','b07-source','b08-source','b09-source','b10-source']){
 const from=base+folder+'/source-snapshot.json',before=JSON.parse(fs.readFileSync(from)),old=fields.map(([file,name])=>literal(before,file,name));
 const worlds=old[0].filter(row=>fields.every(([, ,key],i)=>JSON.stringify(old[i].find(x=>x[key]===row.id))===JSON.stringify(current[i].find(x=>x[key]===row.id)))).map(x=>x.id);
 assert(worlds.length);const target=base+'old52-r6-inheritance/'+folder+'-to-b12-exact-selection.json';
 const args=['tools/qa/r100-source-continuity.mjs','--from',from,'--to',to,'--worlds',worlds.join(','),'--output',target],r=spawnSync(process.execPath,args,{encoding:'utf8'});
 execution.stages.push({before:ref(from),worlds,excluded:old[0].filter(x=>!worlds.includes(x.id)).map(x=>x.id),args,exitCode:r.status,stdout:r.stdout,stderr:r.stderr,...(r.status===0?{report:ref(target)}:{})});save();assert.equal(r.status,0,'Retain failed source audit; do not continue');console.log(folder,worlds.length,'pass');
}execution.status='pass';save();}catch(error){execution.status='failed';execution.error=String(error.stack??error);save();throw error;}
