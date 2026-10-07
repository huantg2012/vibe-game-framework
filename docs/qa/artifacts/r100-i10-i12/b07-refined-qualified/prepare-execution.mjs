import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {validateExpansionExecutionPlan} from '../../../../../tools/qa/check-r100-expansion-plan.mjs';

const base='docs/qa/artifacts/r100-i10-i12/', out=base+'b07-refined-qualified';
const sha=b=>createHash('sha256').update(b).digest('hex');
const receipt=file=>({path:file,sha256:sha(fs.readFileSync(file))});
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const beforePath=base+'b13-and-low-surface-source/source-snapshot.json';
const preparedPath=out+'/preparation/commands.json', prepared=read(preparedPath);
const before=read(beforePath), after=read(prepared.source.path), worlds=prepared.worlds;
assert.equal(prepared.batch,'B07');
assert.equal(prepared.source.sha256,'3221ae2e6d09628faa8a030ddd7782ad7f6f7847ec2ecad90a1a15ee6e87c09d');
assert.deepEqual(worlds,['staggered-cups','split-tows','curled-flats','pitch-forks']);
const load=(snapshot,file)=>{const bytes=fs.readFileSync(path.join(snapshot.temporaryRoot,file));assert.equal(sha(bytes),snapshot.sources[file],file);return bytes.toString('utf8');};
function literal(snapshot,file,name){
  const ast=ts.createSourceFile(file,load(snapshot,file),ts.ScriptTarget.Latest,true);
  assert.equal(ast.parseDiagnostics.length,0);
  for(const statement of ast.statements) if(ts.isVariableStatement(statement))
    for(const declaration of statement.declarationList.declarations) if(declaration.name.getText(ast)===name){
      let value=declaration.initializer;
      while(value&&(ts.isAsExpression(value)||ts.isSatisfiesExpression(value)))value=value.expression;
      return JSON.parse(value.getText(ast));
    }
  throw new Error(`Missing literal ${file}:${name}`);
}
const pick=(rows,key,value)=>{const matches=rows.filter(row=>row[key]===value);assert.equal(matches.length,1,value);return matches[0];};
const fields=[
  ['src/generated/r100-native-worlds.ts','R100_NATIVE_WORLDS','id'],
  ['src/generated/r100-world-appearance.ts','R100_WORLD_APPEARANCES','worldId'],
  ['src/generated/rift-search-remains.ts','SEARCH_REMAINS','worldId'],
];
const checks=[], keys=new Set();
for(const [file,name,key]of fields){
  const prior=literal(before,file,name),current=literal(after,file,name);
  for(const world of worlds){
    const old=pick(prior,key,world),next=pick(current,key,world);
    assert.deepEqual(next,old,`${world}:${name}`);
    checks.push({worldId:world,field:name,sha256:sha(JSON.stringify(old))});
    if(name==='R100_NATIVE_WORLDS') for(const definition of old.definitions){
      keys.add(definition.family);
      for(const instance of definition.instances)keys.add(instance.family??definition.family);
    }
    if(name==='R100_WORLD_APPEARANCES'&&old.materialOrganization)keys.add(`organization:${old.materialOrganization}`);
  }
}
const materialFile='src/generated/r100-package-manifest.ts';
const oldMaterials=literal(before,materialFile,'R100_MATERIAL_DEPENDENCIES');
const newMaterials=literal(after,materialFile,'R100_MATERIAL_DEPENDENCIES');
const materials=[...keys].sort().map(key=>{assert(Object.hasOwn(oldMaterials,key));assert.deepEqual(newMaterials[key],oldMaterials[key],key);return{key,...oldMaterials[key]};});
const projectionPath=out+'/reviewed-content-projection.json';
write(projectionPath,{status:'pass-selected-data-only',before:receipt(beforePath),after:prepared.source,worlds,
  checks,materials,tool:receipt(out+'/prepare-execution.mjs'),
  scope:'Exact authored definitions, appearance, remains and selected material hashes only. This does not assert complete runtime continuity, RGBA equality, Worker recovery, or inherited generation/play qualification. New generation executes the current frozen source.'});
const planPath=base+'qualification-plan.json',execution=read(planPath);
execution.executionSource=receipt(planPath);execution.batches.find(row=>row.id==='B07').status='ready';
const validation=validateExpansionExecutionPlan(execution,{batch:'B07'});
write(out+'/execution-plan.json',execution);
write(out+'/execution-plan-check.json',validation);
write(out+'/commands.json',{schemaVersion:1,status:'ready-for-full-batch-cpu',worlds,wholeBatchReady:true,
  source:prepared.source,qualificationPlan:prepared.qualificationPlan,executor:prepared.executor,
  rootReview:receipt(base+'low-surface-and-b07-grades-remaining/independent-review.json'),
  additionalReceipts:[receipt(projectionPath),receipt(out+'/execution-plan.json')],
  originalPreparation:receipt(preparedPath),generation:prepared.generation,
  scope:'B07 original fixed576 on3120. Root authorizes current-source generation; old review projections are limited to selected content and do not certify complete source equivalence. Actual24 is separate.'});
const originalRunner=fs.readFileSync(base+'b05-refined-qualified/run-generation.mjs','utf8');
const runner=originalRunner.replaceAll('b05-refined-qualified','b07-refined-qualified').replace('B05 original576','B07 original576');
fs.writeFileSync(out+'/run-generation.mjs',runner,{flag:'wx'});
console.log(JSON.stringify({status:'ready',worlds,projectionChecks:checks.length,materials:materials.length,executor:prepared.executor,commands:receipt(out+'/commands.json')}));
