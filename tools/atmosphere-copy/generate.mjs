/** CSV → typed presentation copy. No game state or gameplay random input. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export function atmosphereSource(csv){
  const lines=csv.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
  assert.equal(lines.shift(),'id,pool,text','atmosphere-lines.csv header must be id,pool,text');
  assert(lines.length,'atmosphere-lines.csv must not be empty');
  const ids=new Set(),pools=Object.create(null);
  for(const [index,line] of lines.entries()){
    const columns=line.split(',');assert.equal(columns.length,3,`atmosphere-lines.csv:${index+2}: use Chinese punctuation, not ASCII commas`);
    const [id,pool,text]=columns;
    assert(/^[a-z][a-z0-9_-]*$/.test(id)&&!ids.has(id),`Duplicate or invalid atmosphere id ${id}`);ids.add(id);
    assert(/^[a-z][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)*$/.test(pool),`Invalid atmosphere pool ${pool}`);
    assert(text===text.trim()&&text.length>0&&[...text].length<=40,`${id}: text must be 1–40 characters with no outside whitespace`);
    assert(!/[\u0000-\u001f\u007f]/.test(text),`${id}: control character in text`);
    (pools[pool]??=[]).push({id,text});
  }
  const poolNames=Object.keys(pools);
  return '// AUTO-GENERATED from data/atmosphere-lines.csv — DO NOT EDIT\n'
    + 'export interface AtmosphereLine { readonly id: string; readonly text: string }\n'
    + `export type AtmospherePool = ${poolNames.map(name=>JSON.stringify(name)).join(' | ')};\n`
    + `export const ATMOSPHERE_LINES: Readonly<Record<AtmospherePool, readonly AtmosphereLine[]>> = ${JSON.stringify(pools,null,2)};\n`;
}

export function generateAtmosphereCopy(repository=root,output=path.join(repository,'src/generated'),check=false){
  const source=atmosphereSource(fs.readFileSync(path.join(repository,'data/atmosphere-lines.csv'),'utf8'));
  const target=path.join(output,'atmosphere-copy-data.ts');
  if(check)assert.equal(fs.readFileSync(target,'utf8'),source,'Stale atmosphere-copy-data.ts: run npm run codegen');
  else{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(target,source);}
  console.log(`  atmosphere-copy-data.ts (${check?'verified':'generated'})`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert(process.argv.slice(2).every(arg=>arg==='--check'),'Only --check is supported.');
  generateAtmosphereCopy(root,path.join(root,'src/generated'),process.argv.includes('--check'));
}
