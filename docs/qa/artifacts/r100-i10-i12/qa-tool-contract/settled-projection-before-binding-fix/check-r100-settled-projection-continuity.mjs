import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assertSettledProjectionContinuity} from './r100-settled-projection-continuity.mjs';
const base='docs/qa/artifacts/r100-i10-i12/',output=process.argv[2];assert(output&&!fs.existsSync(output));
const sha=x=>createHash('sha256').update(x).digest('hex'),ref=p=>({path:p,sha256:sha(fs.readFileSync(p))});
const beforePath=base+'p34-and-b09-b10-refined-source/source-snapshot.json',afterPath=base+'late-low-surfaces-refined-source/source-snapshot.json';
const before=JSON.parse(fs.readFileSync(beforePath)),after=JSON.parse(fs.readFileSync(afterPath));
const load=(snapshot,file)=>{const b=fs.readFileSync(path.join(snapshot.temporaryRoot,file));assert.equal(sha(b),snapshot.sources[file]);return b.toString();};
const input={instances:[{constructionVersion:4,shapeProfile:'settled-sheet'},{constructionVersion:1}]};
for(const [name,file]of [['Geometry','native-volume-geometry.ts'],['Ground','native-volume-ground.ts']])for(const [side,snapshot]of [['old',before],['new',after]])input[side+name]=load(snapshot,'src/generation/world-study/'+file);
input.module=load(after,'src/generation/world-study/native-volume-settled-projection.ts');
const report={status:'running',before:ref(beforePath),after:ref(afterPath),helper:ref('tools/qa/r100-settled-projection-continuity.mjs'),harness:ref('tools/qa/check-r100-settled-projection-continuity.mjs'),checks:[],scope:'Actual frozen AST/default-path proof and adversarial mutations only; no game execution or changed-world approval.'};
try{
 report.proof=assertSettledProjectionContinuity(input);report.checks.push({name:'actual old paths including settled-sheet',status:'pass'});
 for(const [name,mutate]of [
  ['selected new bundle',x=>x.instances[0].shapeProfile='settled-bundle'],
  ['selected new clamp',x=>x.instances[0].shapeProfile='settled-clamp'],
  ['old branch enters new construction',x=>x.newGround=x.newGround.replace("case 'fallen-bundle': fallenBundle(builder);", "case 'fallen-bundle': buildSettledProjection(builder, fallenBundle, true);")],
  ['old constructor changed',x=>x.newGround=x.newGround.replace('const uv =', 'const changedUv =')],
  ['new branch unknown arguments',x=>x.newGround=x.newGround.replace('fallenBundle, true','fallenBundle, false')],
  ['shared size contract changed',x=>x.newGeometry=x.newGeometry.replace('spec.length < 16','spec.length < 8')],
  ['prefix check weakened',x=>x.newGeometry=x.newGeometry.replace("startsWith('settled-')","includes('settled-')")],
  ['module executed initializer',x=>x.module+='\nconst eager=Math.random();\n'],
  ['module runtime import',x=>x.module=x.module.replace('import type {','import {')],
  ['unreviewed export',x=>x.module+='\nexport function other() {}\n'],
 ]){const candidate=structuredClone(input);mutate(candidate);assert.notDeepEqual(candidate,input,`No-op mutation ${name}`);assert.throws(()=>assertSettledProjectionContinuity(candidate),undefined,name);report.checks.push({name,status:'pass'});}
 report.status='pass';
}catch(error){report.status='failed';report.error=String(error.stack??error);process.exitCode=1;}
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(report.status,report.checks.length,report.error??'');
