/** Read-only AST checks over actual pre-organization source and current code. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {assertOrganizationDispatchContinuity} from './r100-organization-dispatch-continuity.mjs';
const base='docs/qa/artifacts/r100-i10-i12/';
const sourcePath=base+'b02-refined-source/source-snapshot.json',source=JSON.parse(fs.readFileSync(sourcePath));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const ref=file=>({path:file,sha256:hash(fs.readFileSync(file))});
const geometry='src/generation/world-study/native-volume-geometry.ts',ground='src/generation/world-study/native-volume-ground.ts',module='src/generation/world-study/native-volume-organization.ts';
const old=file=>{const bytes=fs.readFileSync(path.join(source.temporaryRoot,file));assert.equal(hash(bytes),source.sources[file]);return bytes.toString();};
const text=fs.readFileSync('src/generated/r100-native-worlds.ts','utf8');const ast=ts.createSourceFile('catalog.ts',text,ts.ScriptTarget.Latest,true);
const declaration=ast.statements.filter(ts.isVariableStatement).flatMap(n=>[...n.declarationList.declarations]).find(d=>d.name.getText(ast)==='R100_NATIVE_WORLDS');
let literal=declaration.initializer;while(ts.isAsExpression(literal))literal=literal.expression;
const worlds=JSON.parse(literal.getText(ast));
const input={oldGeometry:old(geometry),newGeometry:fs.readFileSync(geometry,'utf8'),oldGround:old(ground),newGround:fs.readFileSync(ground,'utf8'),module:fs.readFileSync(module,'utf8'),instances:worlds.flatMap(w=>w.definitions.flatMap(d=>d.instances))};
const checks=[];const result=assertOrganizationDispatchContinuity(input);checks.push({name:'actual unselected organization additions',status:'pass'});
for(const [name,mutate]of[
 ['missing version guard',x=>x.newGeometry=x.newGeometry.replace("spec.constructionVersion === 4 && (spec.shapeProfile === 'compressed-wedge'","(spec.shapeProfile === 'compressed-wedge'")],
 ['changed shared prior body',x=>x.newGeometry=x.newGeometry.replace('const heightScale = this.spec.height / Math.max(1, this.bounds.maxZ);','const heightScale = 1;')],
 ['new profile actually selected',x=>x.instances=[{constructionVersion:4,shapeProfile:'porous-break'}]],
 ['top-level module side effect',x=>x.module+='\nglobalThis.changed = true;\n'],
 ['changed synchronous ground entry',x=>x.newGround=x.newGround.replace('export function buildGroundNativeVolume','export async function buildGroundNativeVolume')],
 ['changed profile export',x=>x.newGround=x.newGround.replace('export const NATIVE_VOLUME_V4_PROFILES','const NATIVE_VOLUME_V4_PROFILES')],
]){const value=structuredClone(input);mutate(value);assert.throws(()=>assertOrganizationDispatchContinuity(value));checks.push({name,status:'pass'});}
const output=process.argv[2];assert(output&&!fs.existsSync(output));fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify({status:'pass',before:ref(sourcePath),worlds:worlds.map(w=>w.id),result,checks,
 sources:[geometry,ground,module,'tools/qa/r100-organization-dispatch-continuity.mjs','tools/qa/check-r100-organization-dispatch.mjs'].map(ref),
 scope:'Actual-source AST and negative contracts only. No maps, RGBA bakes or browser. Existing156 RGBA evidence stays bound to3105; this proves added unselected code has no old-profile execution effect.'},null,2)+'\n',{flag:'wx'});
console.log(`PASS ${checks.length} organization dispatch contracts for ${worlds.length} unselected worlds`);
