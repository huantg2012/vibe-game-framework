/** Actual frozen-source opt-out proof and focused negative checks; no bake. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {assertInactivePresentationChanges} from './r100-inactive-presentation-continuity.mjs';
const base='docs/qa/artifacts/r100-i10-i12/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const ref=file=>({path:file,sha256:hash(fs.readFileSync(file))});
const beforePath=base+'b01-final-source/source-snapshot.json',afterPath=base+'b02-refined-source/source-snapshot.json';
const before=JSON.parse(fs.readFileSync(beforePath)),after=JSON.parse(fs.readFileSync(afterPath));
const load=(source,file)=>{const bytes=fs.readFileSync(path.join(source.temporaryRoot,file));assert.equal(hash(bytes),source.sources[file]);return bytes.toString();};
const literal=(source,file,name)=>{
 const ast=ts.createSourceFile(file,load(source,file),ts.ScriptTarget.Latest,true);
 const declaration=ast.statements.filter(ts.isVariableStatement).flatMap(n=>[...n.declarationList.declarations]).find(d=>d.name.getText(ast)===name);
 let node=declaration.initializer;while(ts.isAsExpression(node))node=node.expression;return JSON.parse(node.getText(ast));
};
const worlds=literal(before,'src/generated/r100-native-worlds.ts','R100_NATIVE_WORLDS').filter(row=>row.id!=='cleft-tableland');assert.equal(worlds.length,55);
const appearances=literal(before,'src/generated/r100-world-appearance.ts','R100_WORLD_APPEARANCES').filter(row=>worlds.some(w=>w.id===row.worldId));
const surface='src/systems/r100-world/surface-bake.ts',geometry='src/generation/world-study/native-volume-geometry.ts';
const input={beforeSurface:load(before,surface),afterSurface:load(after,surface),beforeGeometry:load(before,geometry),afterGeometry:load(after,geometry),
 samplingModule:load(after,'src/systems/r100-world/organization-sampling.ts'),edgeModule:load(after,'src/generation/world-study/native-volume-ground-edge.ts'),
 beforeEdgeModule:load(before,'src/generation/world-study/native-volume-ground-edge.ts'),
 instances:worlds.flatMap(row=>row.definitions.flatMap(d=>d.instances)),appearances};
const checks=[];const result=assertInactivePresentationChanges(input);checks.push({name:'actual55 unselected world paths',status:'pass'});
for(const[name,mutate]of[
 ['world owns revised edge',x=>x.instances[0].groundEdgeWidth=16],
 ['world selects organization',x=>x.appearances[0].materialOrganization='short-fibre'],
 ['default source mix changed',x=>x.afterSurface=x.afterSurface.replace('solidPaint||organizedSurface?1:.92','solidPaint||organizedSurface?1:.91')],
 ['opt-in guard removed',x=>x.afterSurface=x.afterSurface.replace('appearance?.materialOrganization&&painting','painting')],
 ['sampling top-level side effect',x=>x.samplingModule+='\nglobalThis.changed=true;\n'],
 ['edge top-level side effect',x=>x.edgeModule+='\nappendNativeGroundEdges(null,null);\n'],
 ['removed original module side effect',x=>x.beforeEdgeModule+='\nglobalThis.oldState=true;\n'],
 ['shared builder changed',x=>x.afterGeometry=x.afterGeometry.replace('return builder.finish();','return builder.finish(true);')],
]){const value=structuredClone(input);mutate(value);assert.throws(()=>assertInactivePresentationChanges(value));checks.push({name,status:'pass'});}
const output=process.argv[2];assert(output&&!fs.existsSync(output));fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify({status:'pass',before:ref(beforePath),after:ref(afterPath),worlds:worlds.map(w=>w.id),result,checks,
 sources:['tools/qa/r100-inactive-presentation-continuity.mjs','tools/qa/check-r100-inactive-presentation-continuity.mjs'].map(ref),
 scope:'Frozen-source AST proof only; six cleft play identities and all144 cleft generation cases are explicitly outside this55-world scope.'},null,2)+'\n',{flag:'wx'});
console.log(`PASS ${checks.length} inactive presentation contracts for55worlds; no game execution`);
