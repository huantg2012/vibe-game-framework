/** Narrow proof for the explicit opt-in sampling and ground-edge branches. */
import assert from 'node:assert/strict';
import ts from 'typescript';
const printer = ts.createPrinter({removeComments:true});
const parse = text => { const ast=ts.createSourceFile('source.ts',text,ts.ScriptTarget.Latest,true); assert.equal(ast.parseDiagnostics.length,0); return ast; };
const canonical = text => printer.printFile(parse(text));
export function assertInertPresentationModule(text) {
  for (const node of parse(text).statements) {
    if (ts.isImportDeclaration(node)) { assert(node.importClause?.isTypeOnly); continue; }
    assert(ts.isFunctionDeclaration(node)||ts.isInterfaceDeclaration(node)||ts.isTypeAliasDeclaration(node), 'No presentation module top-level execution');
  }
}
export function assertInactivePresentationChanges({beforeSurface,afterSurface,beforeGeometry,afterGeometry,samplingModule,edgeModule,instances,appearances}) {
  assert(instances.length&&instances.every(row=>row.groundEdgeWidth===undefined), 'Selected world owns a revised edge');
  assert(appearances.length&&appearances.every(row=>row.materialOrganization===undefined), 'Selected world uses organization sampling');
  assert.equal(canonical(afterGeometry),canonical(beforeGeometry), 'Shared geometry cannot change under this exception');
  const geometry=parse(afterGeometry),calls=[];
  const visit=node=>{if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='appendNativeGroundEdges')calls.push(node);ts.forEachChild(node,visit);};visit(geometry);
  assert.equal(calls.length,1);const call=calls[0],statement=call.parent,guard=statement.parent;
  assert(ts.isExpressionStatement(statement)&&ts.isIfStatement(guard)&&guard.thenStatement===statement);
  assert.equal(guard.expression.getText(geometry),'spec.groundEdgeWidth !== undefined');
  assert.equal(call.getText(geometry),'appendNativeGroundEdges(builder, ground!)');
  assertInertPresentationModule(samplingModule);assertInertPresentationModule(edgeModule);
  // Each replacement is a single known expression/statement. The complete
  // normalized AST must then match, so an unrelated change cannot hide here.
  let restored=afterSurface;
  const replace=(from,to)=>{assert.equal(restored.split(from).length,2,`Unique reviewed sampling change required: ${from}`);restored=restored.replace(from,to);};
  replace("import { organizationSampleIndex, prepareOrganizationSurfaceWindows } from './organization-sampling';\n",'');
  replace('  const organizationWindows=appearance?.materialOrganization&&painting\n    ?prepareOrganizationSurfaceWindows(world.meshes,world.definition.family,painting):undefined;\n','');
  replace('   const organizedSurface=hasSurface?organizationWindows?.get(r.objectId[i]!):undefined;\n','');
  replace('const local=fields.solid[i]===1||cut||(hasSurface&&r.family[i]===2)||organizedSurface!==undefined;','const local=fields.solid[i]===1||cut||(hasSurface&&r.family[i]===2);');
  replace('     const organizedWindow=(solidPaint?organizedSurface?.solid:organizedSurface?.ground)?.[paintRegion];\n     if(organizedWindow){\n      paintingIndex=organizationSampleIndex(organizedWindow,u,v);\n     }else{\n      const sx=left+mirror(u*scale+(seed%83),pw),sy=top+mirror(v*scale+((seed>>>8)%97),ph);\n      paintingIndex=(sy*receiverPaint.width+sx)*4;\n     }','     const sx=left+mirror(u*scale+(seed%83),pw),sy=top+mirror(v*scale+((seed>>>8)%97),ph);\n     paintingIndex=(sy*receiverPaint.width+sx)*4;');
  replace('const patchWeight=solidPaint||organizedSurface?1:.92,worldWeight=1-patchWeight;','const patchWeight=solidPaint?1:.92,worldWeight=1-patchWeight;');
  assert.equal(canonical(restored),canonical(beforeSurface),'Unselected surface path must remain AST exact');
  return {status:'pass',scope:'Selected worlds have no organization option and no ground-edge width. The revised edge is never invoked, both imported modules have no top-level execution, and the sampling opt-in reduces to the complete original surface AST. This is a source proof, not a new rendered/gameplay execution.'};
}
