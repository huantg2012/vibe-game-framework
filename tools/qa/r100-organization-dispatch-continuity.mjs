/** Narrow AST proof for unused organization geometry. No execution or mesh generation. */
import assert from 'node:assert/strict';
import ts from 'typescript';
const profiles=['compressed-wedge','porous-break'];
const printer=ts.createPrinter({removeComments:true});
const parse=(text,name)=>{const ast=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true);assert.equal(ast.parseDiagnostics.length,0);return ast;};
const print=(node,ast)=>printer.printNode(ts.EmitHint.Unspecified,node,ast);
const fragment=text=>print(parse(text,'expected.ts'),parse(text,'expected.ts'));
const importName=node=>ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)?node.moduleSpecifier.text:null;
const unwrap=node=>ts.isAsExpression(node)||ts.isParenthesizedExpression(node)?unwrap(node.expression):node;
const signature=(node,ast)=>({modifiers:node.modifiers?.map(n=>print(n,ast)),generator:!!node.asteriskToken,
 name:node.name?.text,typeParameters:node.typeParameters?.map(n=>print(n,ast)),
 parameters:node.parameters.map(n=>print(n,ast)),type:node.type&&print(node.type,ast)});
function inertModule(ast){
 const inert=node=>ts.isArrowFunction(node)||ts.isFunctionExpression(node)||ts.isStringLiteral(node)||ts.isNumericLiteral(node)
  ||ts.isArrayLiteralExpression(node)&&node.elements.every(inert);
 for(const node of ast.statements){
  if(ts.isImportDeclaration(node)){assert(node.importClause?.isTypeOnly,'Organization module imports types only');continue;}
  if(ts.isFunctionDeclaration(node)||ts.isInterfaceDeclaration(node)||ts.isTypeAliasDeclaration(node))continue;
  assert(ts.isVariableStatement(node)&&(node.declarationList.flags&ts.NodeFlags.Const),'No organization top-level execution');
  for(const d of node.declarationList.declarations){
   assert(ts.isIdentifier(d.name),'Organization constants require a plain identifier binding');
   assert(d.initializer&&inert(unwrap(d.initializer)),'No executed organization initializer');
  }
 }
}
export function assertInertOrganizationSource(text){ inertModule(parse(text,'organization.ts')); }
export function assertOrganizationDispatchContinuity({oldGeometry,newGeometry,oldGround,newGround,module,instances}){
 assert(instances.length&&instances.every(row=>!profiles.includes(row.shapeProfile)),'Selected world uses new organization geometry');
 const before=parse(oldGeometry,'geometry.ts'),after=parse(newGeometry,'geometry.ts');
 const priorBuild=before.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='buildNativeVolume');
 const currentBuild=after.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='buildNativeVolume');
 assert(priorBuild?.body&&currentBuild?.body);
 const imports=after.statements.filter(node=>importName(node)==='./native-volume-organization');assert.equal(imports.length,1);
 assert.equal(print(imports[0],after),fragment("import { smoothOrganizedSurface } from './native-volume-organization';").trim());
 const oldOutside=before.statements.filter(node=>node!==priorBuild).map(node=>print(node,before));
 const newOutside=after.statements.filter(node=>node!==currentBuild&&node!==imports[0]).map(node=>print(node,after));
 assert.deepEqual(newOutside,oldOutside,'Only guarded organization dispatch may change geometry module');
 const oldStatements=priorBuild.body.statements.map(node=>print(node,before));
 const newStatements=currentBuild.body.statements.map(node=>print(node,after));
 assert.equal(oldStatements.at(-1),'return builder.finish();');
 const expected=parse("const mesh = builder.finish();\nif (spec.constructionVersion === 4 && (spec.shapeProfile === 'compressed-wedge' || spec.shapeProfile === 'porous-break')) return smoothOrganizedSurface(mesh);\nreturn mesh;",'tail.ts');
 assert.deepEqual(newStatements.slice(-3),expected.statements.map(node=>print(node,expected)),'Explicit construction4 and exact two-profile guard required');
 assert.deepEqual(newStatements.slice(0,-3),oldStatements.slice(0,-1),'Prior physical construction remains exact');
 assert.deepEqual(signature(currentBuild,after),signature(priorBuild,before));
 const old=parse(oldGround,'ground.ts'),current=parse(newGround,'ground.ts');
 const groundImports=current.statements.filter(node=>importName(node)==='./native-volume-organization');assert.equal(groundImports.length,1);
 assert.equal(print(groundImports[0],current),fragment("import { buildCompressedWedge, buildPorousBreak } from './native-volume-organization';").trim());
 const normalize=(ast,isNew)=>ast.statements.filter(node=>!isNew||node!==groundImports[0]).map(node=>{
  if(ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>d.name.getText(ast)==='NATIVE_VOLUME_V4_PROFILES')){
   assert(node.declarationList.flags&ts.NodeFlags.Const);
   assert.equal(node.declarationList.declarations.length,1);const values=unwrap(node.declarationList.declarations[0].initializer);
   assert(ts.isArrayLiteralExpression(values)&&values.elements.every(ts.isStringLiteral));
   const ids=values.elements.map(v=>v.text);
   if(isNew){assert.deepEqual(ids.slice(-2),profiles);ids.splice(-2);}
   assert.deepEqual(ids,['fracture-fan','fallen-bundle','clamp-bank','torn-sheet']);
   const declaration=node.declarationList.declarations[0];
   return JSON.stringify({kind:'exact-v4-profile-list',modifiers:node.modifiers?.map(n=>print(n,ast)),
    flags:node.declarationList.flags,name:print(declaration.name,ast),type:declaration.type&&print(declaration.type,ast),
    initializer:print(declaration.initializer,ast).replace(print(values,ast),JSON.stringify(ids))});
  }
  if(ts.isFunctionDeclaration(node)&&node.name?.text==='buildGroundNativeVolume'){
   const body=node.body;assert.equal(body.statements.length,1);const statement=body.statements[0];assert(ts.isSwitchStatement(statement));
   assert.equal(statement.expression.getText(ast),'builder.spec.shapeProfile');
   const added=statement.caseBlock.clauses.filter(c=>ts.isCaseClause(c)&&ts.isStringLiteral(c.expression)&&profiles.includes(c.expression.text));
   assert.equal(added.length,isNew?2:0);
   if(isNew)for(const [index,c]of added.entries()){
    assert.equal(c.expression.text,profiles[index]);
    const expected=parse(index===0?'buildCompressedWedge(builder); return;':'buildPorousBreak(builder); return;','case.ts');
    assert.deepEqual(c.statements.map(s=>print(s,ast)),expected.statements.map(s=>print(s,expected)));
   }
   return JSON.stringify({signature:signature(node,ast),clauses:statement.caseBlock.clauses.filter(c=>!added.includes(c)).map(c=>print(c,ast))});
  }
  return print(node,ast);
 });
 assert.deepEqual(normalize(current,true),normalize(old,false),'Existing v4 bodies and dispatch stay exact');
 inertModule(parse(module,'organization.ts'));
 return {status:'pass',newProfiles:profiles,selectedInstances:instances.length,
  scope:'Only two unselected construction4 branches and an inert imported module are added. Existing physical builder, prior shape bodies, old dispatch and old mesh return remain AST-exact. No RGBA or authored-world visual approval is created.'};
}
