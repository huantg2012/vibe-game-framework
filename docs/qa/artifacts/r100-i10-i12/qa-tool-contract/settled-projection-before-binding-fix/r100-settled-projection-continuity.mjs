/** Prove the two new shallow profiles are unselected; this never approves their appearance. */
import assert from 'node:assert/strict';
import ts from 'typescript';
import {assertInertOrganizationSource} from './r100-organization-dispatch-continuity.mjs';
const profiles=['settled-bundle','settled-clamp'];
const previousProfiles=['fracture-fan','fallen-bundle','clamp-bank','torn-sheet','compressed-wedge','porous-break','settled-sheet','settled-fan'];
const printer=ts.createPrinter({removeComments:true});
const parse=(source,name)=>{const tree=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true);assert.equal(tree.parseDiagnostics.length,0);return tree;};
const print=(node,tree)=>printer.printNode(ts.EmitHint.Unspecified,node,tree);
const text=source=>{const tree=parse(source,'fragment.ts');return print(tree,tree);};
function rewritten(tree,replacements){
 // Splice only already matched AST node ranges, then reparse. Printing nodes
 // from a different SourceFile directly can reuse the wrong literal offsets.
 let source=tree.text;
 const edits=[...replacements].map(([node,replacement])=>({start:node.getStart(tree),end:node.end,
  value:replacement?replacement.getText(replacement.getSourceFile()):''})).sort((a,b)=>b.start-a.start);
 for(const edit of edits)source=source.slice(0,edit.start)+edit.value+source.slice(edit.end);
 return text(source);
}
function matchingIf(tree,expected){const nodes=[];const visit=node=>{if(ts.isIfStatement(node)&&print(node,tree)===text(expected).trim())nodes.push(node);ts.forEachChild(node,visit);};visit(tree);assert.equal(nodes.length,1,'One exact audited validator guard');return nodes[0];}
export function assertSettledProjectionContinuity({oldGeometry,newGeometry,oldGround,newGround,module,instances}){
 assert(instances.length&&instances.every(row=>!profiles.includes(row.shapeProfile)),'Selected world uses the added shallow profile');
 // The old whitelist contains only sheet/fan with this prefix. The new prefix
 // guard therefore has identical semantics for every old legal profile. The
 // earlier strict version whitelist (and all other validation) stays exact.
 assert.deepEqual(previousProfiles.filter(id=>id.startsWith('settled-')),['settled-sheet','settled-fan']);
 const oldGuard="if ((spec.shapeProfile === 'settled-sheet' || spec.shapeProfile === 'settled-fan') && (spec.blocking !== 0 || spec.height > 6)) throw new Error('Settled material requires explicit nonblocking material with height at most 6');";
 const newGuard="if (spec.shapeProfile?.startsWith('settled-') && (spec.blocking !== 0 || spec.height > 6)) throw new Error('Settled material requires explicit nonblocking material with height at most 6');";
 const oldGeometryTree=parse(oldGeometry,'old-geometry.ts'),newGeometryTree=parse(newGeometry,'new-geometry.ts');
 const oldIf=matchingIf(oldGeometryTree,oldGuard),newIf=matchingIf(newGeometryTree,newGuard);
 assert.equal(rewritten(newGeometryTree,new Map([[newIf,oldIf]])),text(oldGeometry),'Shared geometry and validation must otherwise stay AST-exact');
 const tree=parse(newGround,'ground.ts');
 const imports=tree.statements.filter(node=>ts.isImportDeclaration(node)&&node.moduleSpecifier.text==='./native-volume-settled-projection');
 assert.equal(imports.length,1);
 assert.equal(print(imports[0],tree),text("import { buildSettledProjection } from './native-volume-settled-projection';").trim());
 const replacements=new Map([[imports[0],undefined]]);
 const previous=text(`export const NATIVE_VOLUME_V4_PROFILES = ${JSON.stringify(previousProfiles)} as const;`).trim();
 const current=text(`export const NATIVE_VOLUME_V4_PROFILES = ${JSON.stringify([...previousProfiles,...profiles])} as const;`).trim();
 // Preserve authored quote spelling by normalizing only string literals in
 // this single declaration, never executable module text.
 const declaration=tree.statements.find(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>d.name.getText(tree)==='NATIVE_VOLUME_V4_PROFILES'));
 assert(declaration);const initial=declaration.declarationList.declarations[0].initializer;
 assert(ts.isAsExpression(initial)&&ts.isArrayLiteralExpression(initial.expression));
 assert.deepEqual(initial.expression.elements.map(node=>{assert(ts.isStringLiteral(node));return node.text;}),[...previousProfiles,...profiles]);
 const oldTree=parse(oldGround,'old-ground.ts'),oldDeclaration=oldTree.statements.find(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>d.name.getText(oldTree)==='NATIVE_VOLUME_V4_PROFILES'));
 assert(oldDeclaration);
 const canonical=node=>text(print(node,node===declaration?tree:oldTree).replace(/'([^']*)'/g,(_,value)=>JSON.stringify(value))).trim();
 assert.equal(canonical(declaration),current);assert.equal(canonical(oldDeclaration),previous);
 replacements.set(declaration,oldDeclaration);
 const dispatch=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='buildGroundNativeVolume');
 assert(dispatch?.body);const statement=dispatch.body.statements[0];assert(ts.isSwitchStatement(statement));
 const added=statement.caseBlock.clauses.filter(node=>ts.isCaseClause(node)&&ts.isStringLiteral(node.expression)&&profiles.includes(node.expression.text));
 assert.equal(added.length,2);
 for(const [index,clause]of added.entries()){
  assert.equal(clause.expression.text,profiles[index]);
  const wanted=parse(index===0?'buildSettledProjection(builder, fallenBundle, true); return;':'buildSettledProjection(builder, clampBank, false); return;','case.ts');
  assert.deepEqual(clause.statements.map(node=>print(node,tree)),wanted.statements.map(node=>print(node,wanted)));
  replacements.set(clause,undefined);
 }
 // Reparse after removal to discard whitespace left by the removed cases.
 assert.equal(rewritten(tree,replacements),text(oldGround),'Old dispatch, constructors and all other ground module statements stay exact');
 assertInertOrganizationSource(module);
 const newModule=parse(module,'projection.ts');
 const exported=newModule.statements.filter(node=>node.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.ExportKeyword));
 assert.equal(exported.length,1);assert(ts.isFunctionDeclaration(exported[0])&&exported[0].name?.text==='buildSettledProjection');
 return {status:'pass',newProfiles:profiles,selectedInstances:instances.length,scope:'Only an inert module and two unselected construction4 dispatch branches are added. Previous legal profile validation, shared Builder and all old constructors remain AST-exact. No changed authored world, material choice, entry/performance or new visual approval is inherited.'};
}
