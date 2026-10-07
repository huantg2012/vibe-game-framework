/** One reviewed migration, not a general exclusion of transport code. The two
 * clients and helper are pinned to the independently reviewed repair bytes;
 * execution modules and Worker bodies receive additional semantic checks. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import ts from 'typescript';

const sha=text=>createHash('sha256').update(text).digest('hex');
const printer=ts.createPrinter({removeComments:true});
const parse=(text,name)=>{const ast=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true);assert.equal(ast.parseDiagnostics.length,0);return ast;};
const print=(node,ast)=>printer.printNode(ts.EmitHint.Unspecified,node,ast);
const javascript=text=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,removeComments:true}}).outputText;
export const STARTUP_REPAIR_FILES={
 'src/generation/rift-generation-client.ts':['aa686256bba14afc8f80ac42b797fd6ae3ddf9b8f1bce7fc4320f47b52e1c10c','eadc68f5d3ed49d53fc0d251b5e316d97aba91acbf2e2a3b23aad1153eb57e1b'],
 'src/systems/r100-world/surface-preparation-client.ts':['d83258c6688a7e8a3a7eababfd6fe4de766c4f2073b3a63b56525fa1a156b846','864d605301d0323257cf455bd9710e9245517dd1691bdd7616cae91eba488ce0'],
};
export const STARTUP_HELPER='src/utils/worker-request.ts';
const helperSha='daffb6b048af03e206c50756dbfe5ecc66763e5a222a44081de66e4ef8395e87';
const pureFiles=['src/generation/rift-generation-protocol.ts','src/systems/r100-world/surface-preparation.ts'];
const workerFiles=['src/generation/rift-generation-worker.ts','src/systems/r100-world/surface-preparation-worker.ts'];

function withoutAck(text){
 const ast=parse(javascript(text),'worker.js');let count=0;
 const result=ts.transform(ast,[context=>root=>{
  const visit=node=>{
   if(ts.isTryStatement(node)){
    const first=node.tryBlock.statements[0];
    const expected=parse('worker.postMessage({ id: data.id, started: true });','expected.js');
    if(first&&print(first,ast)===print(expected.statements[0],expected)){
     count++;
     return context.factory.updateTryStatement(node,context.factory.updateBlock(node.tryBlock,node.tryBlock.statements.slice(1)),node.catchClause,node.finallyBlock);
    }
   }
   return ts.visitEachChild(node,visit,context);
  };
  return ts.visitNode(root,visit);
 }]);
 const normalized=printer.printFile(result.transformed[0]);result.dispose();
 assert.equal(count,1,'Exactly one initial acknowledgement, immediately inside the existing try');
 return normalized;
}

export function assertReviewedStartupRepair({before,after,review}){
 assert.equal(review.status,'bounded-code-review-pass');assert.equal(review.reviewer,'identity_pipeline');
 const evidence=new Map(review.reviewedSource.map(row=>[row.path,row.sha256]));
 assert.equal(evidence.size,7,'The exact seven reviewed transport inputs are required');
 const changes=[];
 for(const[file,[oldHash,newHash]]of Object.entries(STARTUP_REPAIR_FILES)){
  assert.equal(sha(before(file)),oldHash,`Unreviewed earlier client: ${file}`);
  assert.equal(sha(after(file)),newHash,`Unreviewed replacement client: ${file}`);
  assert.equal(evidence.get(file),newHash);changes.push(file);
 }
 assert.equal(sha(after(STARTUP_HELPER)),helperSha,'No arbitrary helper revision may inherit this review');
 assert.equal(evidence.get(STARTUP_HELPER),helperSha);
 for(const file of pureFiles){
  assert.equal(javascript(after(file)),javascript(before(file)),`Pure execution changed: ${file}`);
  assert.equal(sha(after(file)),evidence.get(file));changes.push(file);
 }
 for(const file of workerFiles){
  assert.equal(withoutAck(after(file)),printer.printFile(parse(javascript(before(file)),'old-worker.js')),`Worker computation/transfer/error path changed: ${file}`);
  assert.equal(sha(after(file)),evidence.get(file));changes.push(file);
 }
 return {status:'pass',changedFiles:changes,addedFiles:[STARTUP_HELPER],
  scope:'Only this exact reviewed pre-ack retry implementation is admitted. Pure execution after type erasure and Worker bodies without the single initial ACK are exact. Client code is not ignored: both old/new clients and the new helper must match the reviewed hashes.',
  excludedEvidence:['old entry/cold-resume qualification','old performance/load measurements','failed pre-entry attempts','P36 release closure']};
}

const ORGANIZATION_FILE='src/generated/r100-material-organizations.ts';
const APPEARANCE_FILE='src/generation/world-study/r100-world-appearance.ts';
const ORGANIZATION_CSV='data/rift-material-organizations.csv';
const newKey='short-fibre-loose';
export function assertUnusedMaterialExtension({before,after,literal,appearances}){
 assert(appearances.length&&appearances.every(row=>row.materialOrganization!==newKey),'An inherited world selects the changed material');
 const old=literal('before',ORGANIZATION_FILE,'ORGANIZATION_MATERIALS');
 const next=literal('after',ORGANIZATION_FILE,'ORGANIZATION_MATERIALS');
 assert.deepEqual(old.map(row=>row.organization),['short-fibre','porous-marrow']);
 assert.deepEqual(next.slice(0,-1),old,'Previously available material definitions changed');
 assert.equal(next.length,3);assert.equal(next.at(-1).organization,newKey);
 const assets=[next.at(-1).source,next.at(-1).solid.source].map(url=>{assert(url.startsWith('/assets/r100-materials/short-fibre-loose-'));assert(!url.includes('..'));return 'public'+url;});
 assert.deepEqual(assets,['public/assets/r100-materials/short-fibre-loose-ground-source.png','public/assets/r100-materials/short-fibre-loose-solid-source.png']);
 for(const text of [before(ORGANIZATION_FILE),after(ORGANIZATION_FILE)]){
  const ast=parse(text,ORGANIZATION_FILE);assert.equal(ast.statements.length,2);
  for(const statement of ast.statements){
   assert(ts.isVariableStatement(statement)&&(statement.declarationList.flags&ts.NodeFlags.Const));
   assert.equal(statement.declarationList.declarations.length,1);
   const d=statement.declarationList.declarations[0];assert(['ORGANIZATION_MATERIALS_SOURCE_HASH','ORGANIZATION_MATERIALS'].includes(d.name.getText(ast)));
   let value=d.initializer;while(ts.isAsExpression(value)||ts.isSatisfiesExpression(value))value=value.expression;
   if(d.name.getText(ast)==='ORGANIZATION_MATERIALS')assert(ts.isArrayLiteralExpression(value));
   else assert(ts.isStringLiteral(value));
  }
 }
 const oldAst=parse(before(APPEARANCE_FILE),APPEARANCE_FILE),newAst=parse(after(APPEARANCE_FILE),APPEARANCE_FILE);
 const normalize=(ast,current)=>ast.statements.map(statement=>{
  if(ts.isVariableStatement(statement)&&statement.declarationList.declarations.some(d=>d.name.getText(ast)==='WORLD_MATERIAL_ORGANIZATIONS')){
   const d=statement.declarationList.declarations[0];assert.equal(statement.declarationList.declarations.length,1);
   assert(statement.declarationList.flags&ts.NodeFlags.Const);
   let value=d.initializer;while(ts.isAsExpression(value))value=value.expression;
   assert(ts.isArrayLiteralExpression(value)&&value.elements.every(ts.isStringLiteral));
   assert.deepEqual(value.elements.map(v=>v.text),current?['short-fibre','porous-marrow',newKey]:['short-fibre','porous-marrow']);
   return print(statement,ast).replace(print(value,ast),'[reviewed-unchanged-selected-enum]');
  }
  return print(statement,ast);
 });
 assert.deepEqual(normalize(newAst,true),normalize(oldAst,false),'Appearance logic outside the appended enum changed');
 return {status:'pass',changedFiles:[ORGANIZATION_FILE,ORGANIZATION_CSV,APPEARANCE_FILE],addedFiles:assets,
  scope:'A third material definition/assets and its enum are appended. Both previous definitions are exact and every inherited world excludes the new key; ordinary loader/sampler behavior remains subject to the whole-source comparison.'};
}
